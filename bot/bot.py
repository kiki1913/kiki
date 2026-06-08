"""
============================================================
 BiznesOnline — Telegram Bot (aiogram v3)
 Buyurtmalarni do'kon adminlarining Telegram kanaliga yuboradi.

 ISHLATISH:
   1. @BotFather dan yangi bot yarating va TOKEN oling
   2. .env ga BOT_TOKEN=xxx yozing (yoki pastdagi qiymatni o'zgartiring)
   3. python3 -m pip install -r requirements.txt
   4. python3 bot.py

 BOT JARAYONI:
   1. Foydalanuvchi /start yuboradi → bot kutib oladi
   2. Bot Bot ID ni so'raydi (admin paneldan nusxalanadi)
   3. Bot kanal username/ID ni so'raydi
   4. Foydalanuvchi botni kanalga admin qiladi
   5. Bot kanalga "✅ Muvaffaqiyatli ulandi" yuboradi
   6. POST /orders/:botId endpoint orqali admin panel yangi buyurtmani yuboradi
      → bot uni ulangan kanalga yuboradi
============================================================
"""

import asyncio
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path

from aiogram import BaseMiddleware, Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatMemberStatus, ParseMode
from aiogram.exceptions import (
    TelegramAPIError,
    TelegramForbiddenError,
    TelegramNetworkError,
    TelegramRetryAfter,
)
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import Message
from aiohttp import web

# ============ CONFIG ============
BOT_TOKEN = os.getenv("BOT_TOKEN", "8917607768:AAGcwl9CuafvR_TKGcE1Q-bMkK-pHEfE2jg")
HTTP_PORT = int(os.getenv("PORT", "3344"))
# Standart — faqat localhost (admin panel shu mashinada). Internetga ochish uchun HOST=0.0.0.0
HTTP_HOST = os.getenv("HOST", "127.0.0.1")
DB_FILE = Path(__file__).parent / "bot-db.json"
# Bot bilan muloqot qilgan foydalanuvchilar (broadcast uchun)
USERS_FILE = Path(__file__).parent / "bot-users.json"
# Broadcast endpoint himoyasi. Bo'sh bo'lsa — ochiq (faqat localhost uchun mo'ljallangan).
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
# Telegram /broadcast komandasi uchun qo'shimcha admin ID lar (vergul bilan)
ADMIN_IDS = {x.strip() for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()}
# Broadcast'da xabarlar orasidagi pauza (Telegram rate-limit: ~30 msg/s)
BROADCAST_DELAY = float(os.getenv("BROADCAST_DELAY", "0.05"))

BOT_ID_RE = re.compile(r"^BOT-[A-Z0-9]+-[A-Z0-9]{5}$", re.IGNORECASE)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("bot")


# ============ MINI DB (fayl asosida) ============
# Tuzilishi: { botId: { chatId, channel, connectedAt, status } }
def load_db() -> dict:
    try:
        if not DB_FILE.exists():
            return {}
        return json.loads(DB_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        log.error("load_db error: %s", e)
        return {}


def save_db(db: dict) -> None:
    try:
        DB_FILE.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.error("save_db error: %s", e)


def find_by_bot_id(bot_id: str):
    return load_db().get(bot_id)


def find_by_chat_id(chat_id: int):
    for bot_id, cfg in load_db().items():
        if cfg.get("chatId") == chat_id:
            return {"botId": bot_id, **cfg}
    return None


# ============ FOYDALANUVCHILAR DB (broadcast uchun) ============
# Tuzilishi: { "<userId>": { id, firstName, username, joinedAt, lastSeen, active } }
def load_users() -> dict:
    try:
        if not USERS_FILE.exists():
            return {}
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        log.error("load_users error: %s", e)
        return {}


def save_users(users: dict) -> None:
    try:
        USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.error("save_users error: %s", e)


def md_strip(s) -> str:
    """Legacy Markdown maxsus belgilarini olib tashlaydi (foydalanuvchi matni xabarni buzmasligi uchun)."""
    return re.sub(r"[_*`\[\]]", "", str(s or ""))


def track_user(message: "Message") -> None:
    """Bot bilan muloqot qilgan har bir foydalanuvchini ro'yxatga oladi/yangilaydi."""
    u = getattr(message, "from_user", None)
    if u is None or getattr(u, "is_bot", False):
        return
    # Faqat shaxsiy chatlardagi odamlarni hisoblaymiz (kanal/guruh emas)
    if getattr(message.chat, "type", "private") != "private":
        return
    users = load_users()
    uid = str(u.id)
    now = datetime.now()
    now_iso = now.isoformat()
    existing = users.get(uid)
    if existing:
        # Debounce: oxirgi 60s ichida ko'rilgan va ma'lumotlari o'zgarmagan bo'lsa — diskka yozmaymiz
        try:
            recent = (now - datetime.fromisoformat(existing.get("lastSeen", ""))).total_seconds() < 60
        except Exception:
            recent = False
        unchanged = (existing.get("firstName") == (u.first_name or "")
                     and existing.get("username") == u.username
                     and existing.get("active") is True)
        if recent and unchanged:
            return
        existing["lastSeen"] = now_iso
        existing["firstName"] = u.first_name or existing.get("firstName") or ""
        existing["username"] = u.username
        existing["active"] = True
    else:
        users[uid] = {
            "id": u.id,
            "firstName": u.first_name or "",
            "username": u.username,
            "joinedAt": now_iso,
            "lastSeen": now_iso,
            "active": True,
        }
    save_users(users)


def is_broadcast_admin(user_id: int) -> bool:
    """Broadcast huquqi — faqat ADMIN_IDS ro'yxatidagilar (ulangan do'kon egalari EMAS)."""
    return str(user_id) in ADMIN_IDS


# Bir vaqtda faqat bitta broadcast ishlashi uchun
broadcast_lock = asyncio.Lock()


async def broadcast_message(bot: "Bot", text: str) -> dict:
    """Barcha ro'yxatdagi foydalanuvchilarga matn (oddiy matn sifatida) yuboradi."""
    if broadcast_lock.locked():
        return {"sent": 0, "failed": 0, "total": 0, "busy": True}
    async with broadcast_lock:
        users = load_users()
        sent, failed = 0, 0
        blocked_ids = []  # faqat bloklagan/o'chirgan foydalanuvchilar (rate-limit EMAS)
        for uid, info in list(users.items()):
            target = int(info.get("id", uid))
            for attempt in range(2):  # rate-limit bo'lsa bir marta qayta urinish
                try:
                    # parse_mode=None — foydalanuvchi matni Markdown sifatida talqin qilinmasin
                    await bot.send_message(target, text, parse_mode=None)
                    sent += 1
                    break
                except TelegramRetryAfter as e:
                    log.warning("broadcast rate-limited %ss for %s", e.retry_after, uid)
                    await asyncio.sleep(e.retry_after + 0.5)
                    continue  # qayta urinish
                except TelegramForbiddenError:
                    failed += 1
                    blocked_ids.append(uid)  # bot bloklangan / akkaunt o'chirilgan
                    break
                except TelegramAPIError as e:
                    failed += 1
                    log.warning("broadcast to %s failed: %s", uid, e)
                    break
                except Exception as e:
                    failed += 1
                    log.warning("broadcast to %s error: %s", uid, e)
                    break
            else:
                # ikkala urinish ham rate-limit bilan tugadi
                failed += 1
            if BROADCAST_DELAY > 0:
                await asyncio.sleep(BROADCAST_DELAY)
        # Faqat haqiqatan bloklaganlarni nofaol deb belgilaymiz (qayta yuklab — track_user'ni yo'qotmaslik uchun)
        if blocked_ids:
            fresh = load_users()
            for uid in blocked_ids:
                if uid in fresh:
                    fresh[uid]["active"] = False
            save_users(fresh)
        return {"sent": sent, "failed": failed, "total": len(users)}


# ============================================================
# ====== STORE BOTS — do'kon egasining boti ==================
# ============================================================
# Har bir do'kon egasi admin paneldan O'Z bot tokenini ulaydi. Bot:
#   • /start ga javob beradi va mijozni ro'yxatga oladi (broadcast uchun)
#   • yangi buyurtmalarni do'konning Telegram kanaliga yuboradi
#   • admin paneldan barcha mijozlarga ommaviy xabar (broadcast) yuboradi
# Tuzilishi: { clientId: {token, username, shopName, channel,
#                         channelConnectedAt, sentCount, status, connectedAt} }
STORE_DB_FILE = Path(__file__).parent / "store-bots.json"
TOKEN_RE = re.compile(r"^\d{6,}:[A-Za-z0-9_-]{30,}$")

# clientId -> {"bot": Bot, "dp": Dispatcher, "task": asyncio.Task}
store_runtime: dict = {}


def load_store_db() -> dict:
    try:
        if not STORE_DB_FILE.exists():
            return {}
        return json.loads(STORE_DB_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        log.error("load_store_db error: %s", e)
        return {}


def save_store_db(db: dict) -> None:
    try:
        STORE_DB_FILE.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.error("save_store_db error: %s", e)


# ---- Har bir do'kon boti foydalanuvchilari (broadcast uchun) ----
# Tuzilishi: { shopKey: { "<uid>": {id, firstName, username, joinedAt, lastSeen} } }
STORE_USERS_FILE = Path(__file__).parent / "store-bot-users.json"


def load_store_users() -> dict:
    try:
        if not STORE_USERS_FILE.exists():
            return {}
        return json.loads(STORE_USERS_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        log.error("load_store_users error: %s", e)
        return {}


def save_store_users(data: dict) -> None:
    try:
        STORE_USERS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.error("save_store_users error: %s", e)


def track_store_user(shop_key: str, message: "Message") -> None:
    """Do'kon boti bilan yozishgan har bir (shaxsiy chatdagi) foydalanuvchini saqlaydi."""
    u = getattr(message, "from_user", None)
    if u is None or getattr(u, "is_bot", False):
        return
    if getattr(message.chat, "type", "private") != "private":
        return
    data = load_store_users()
    bucket = data.setdefault(shop_key, {})
    uid = str(u.id)
    now = datetime.now().isoformat()
    ex = bucket.get(uid)
    if ex:
        ex["lastSeen"] = now
        ex["firstName"] = u.first_name or ex.get("firstName") or ""
        ex["username"] = u.username
    else:
        bucket[uid] = {
            "id": u.id,
            "firstName": u.first_name or "",
            "username": u.username,
            "joinedAt": now,
            "lastSeen": now,
        }
    save_store_users(data)


class StoreTrackingMiddleware(BaseMiddleware):
    """Har bir do'kon botida foydalanuvchilarni ro'yxatga oladi."""

    def __init__(self, shop_key: str):
        self.shop_key = shop_key

    async def __call__(self, handler, event, data):
        try:
            if isinstance(event, Message):
                track_store_user(self.shop_key, event)
        except Exception as e:
            log.error("store tracking error: %s", e)
        return await handler(event, data)


def _money(n) -> str:
    try:
        return f"{int(n or 0):,}".replace(",", " ")
    except Exception:
        return "0"


def format_store_order(cfg: dict, order: dict) -> str:
    """Buyurtmani kanalga yuborish uchun oddiy matn (parse_mode=None)."""
    lines = []
    for it in (order.get("items") or []):
        name = str(it.get("name", ""))
        qty = int(it.get("qty", 0) or 0)
        price = int(it.get("price", 0) or 0)
        lines.append(f"   • {name} × {qty} = {_money(price * qty)} so'm")
    items_text = "\n".join(lines) or "   (bo'sh)"
    shop = cfg.get("shopName") or "Do'kon"
    return (
        f"🔔 YANGI BUYURTMA — {shop}\n\n"
        f"📦 Buyurtma: {order.get('id', '—')}\n"
        f"👤 Mijoz: {order.get('userName', 'Anonim')}\n"
        f"📞 Tel: {order.get('phone', '—')}\n"
        f"📍 Manzil: {order.get('address', '—')}\n\n"
        f"🛒 Mahsulotlar:\n{items_text}\n\n"
        f"💰 Jami: {_money(order.get('total'))} so'm"
    )


async def _store_bot_for(client_id: str, cfg: dict):
    """Amal uchun Bot instansi: ishlab turgani bo'lsa o'shani, bo'lmasa vaqtinchalik yaratadi.
    Qaytaradi: (bot, is_temp). is_temp=True bo'lsa, chaqiruvchi session ni yopishi kerak."""
    info = store_runtime.get(client_id)
    if info and info.get("bot"):
        return info["bot"], False
    return Bot(token=cfg["token"]), True


async def store_start_handler(message: "Message", cfg: dict) -> None:
    """Mijoz /start bosganda — oddiy xush kelibsiz xabari (tugmasiz)."""
    shop = cfg.get("shopName") or "do'konimiz"
    name = (getattr(message.from_user, "first_name", "") or "").strip()
    hello = f"Salom, {name}! " if name else "Salom! "
    await message.answer(
        f"👋 {hello}{shop} ga xush kelibsiz!\n\n"
        f"Bu yerda do'kon yangiliklari va maxsus takliflarini birinchi bo'lib olasiz. "
        f"Buyurtma berish uchun do'kon ilovasidan foydalaning.",
        parse_mode=None,
    )


def _make_store_dp(cfg: dict, shop_key: str) -> Dispatcher:
    dp = Dispatcher()
    dp.message.outer_middleware(StoreTrackingMiddleware(shop_key))

    async def _on_start(message: "Message") -> None:
        await store_start_handler(message, cfg)

    dp.message.register(_on_start, CommandStart())
    return dp


async def _store_poll(client_id: str, bot: Bot, dp: Dispatcher) -> None:
    try:
        await bot.delete_webhook(drop_pending_updates=True)
    except Exception as e:
        log.warning("store delete_webhook (%s): %s", client_id, e)
    log.info("🟢 Store bot polling ishlamoqda: %s", client_id)
    try:
        await dp.start_polling(bot, handle_signals=False)
    except asyncio.CancelledError:
        raise
    except Exception as e:
        log.error("store bot polling to'xtadi (%s): %s", client_id, e)
    finally:
        try:
            await bot.session.close()
        except Exception:
            pass


async def stop_store_bot(client_id: str) -> None:
    """Do'kon botini to'xtatadi (polling + ikkala session)."""
    info = store_runtime.pop(client_id, None)
    if not info:
        return
    dp, task = info.get("dp"), info.get("task")
    try:
        if dp:
            await dp.stop_polling()
    except Exception:
        pass
    if task:
        task.cancel()
        try:
            await task
        except BaseException:
            pass
    # SENDER va polling botlarining sessiyalarini yopamiz
    for b in (info.get("poll_bot"), info.get("bot")):
        if b:
            try:
                await b.session.close()
            except Exception:
                pass


async def start_store_bot(client_id: str, cfg: dict) -> dict:
    """Tokenni tekshiradi va do'kon botini ishga tushiradi.
    SENDER bot (kanalga yuborish) DOIMIY va 'ulangan' holatini belgilaydi.
    Polling (/start javobi + mijoz ro'yxati) ALOHIDA, best-effort instansiyada —
    u uzilsa ham (masalan bot boshqa joyda ishlab 409 bersa) bot 'ulangan' qoladi
    va buyurtmalar kanalga yuborilaveradi."""
    await stop_store_bot(client_id)
    bot = Bot(token=cfg["token"])  # DOIMIY sender — orderlar/broadcast uchun
    try:
        me = await bot.get_me()  # token yaroqliligini tekshiradi + username oladi
    except Exception:
        try:
            await bot.session.close()
        except Exception:
            pass
        raise
    username = ("@" + me.username) if me.username else None
    cfg["username"] = username
    # Polling — alohida (disposable) bot instansiyasida; uzilsa SENDER ta'sirlanmaydi
    poll_bot = Bot(token=cfg["token"])
    dp = _make_store_dp(cfg, client_id)
    task = asyncio.create_task(_store_poll(client_id, poll_bot, dp))
    store_runtime[client_id] = {"bot": bot, "poll_bot": poll_bot, "dp": dp, "task": task}
    return {"username": username}


async def start_all_store_bots() -> None:
    """Server ishga tushganda saqlangan barcha do'kon botlarini tiklaydi."""
    db = load_store_db()
    for client_id, cfg in db.items():
        if cfg.get("status") != "connected":
            continue
        try:
            res = await start_store_bot(client_id, cfg)
            log.info("✅ Store bot tiklandi: %s (%s)", res.get("username"), client_id)
        except Exception as e:
            log.error("Store bot tiklanmadi (%s): %s", client_id, e)


# ============ MIDDLEWARE: har bir foydalanuvchini ro'yxatga olish ============
class TrackingMiddleware(BaseMiddleware):
    async def __call__(self, handler, event, data):
        try:
            if isinstance(event, Message):
                track_user(event)
        except Exception as e:
            log.error("tracking middleware error: %s", e)
        return await handler(event, data)


# ============ FSM BOSQICHLARI ============
class Connect(StatesGroup):
    awaiting_id = State()
    awaiting_channel = State()


router = Router()
# Har bir xabarda foydalanuvchini ro'yxatga olish (filtrlardan oldin ishlaydi)
router.message.outer_middleware(TrackingMiddleware())


# ============ /start ============
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(Connect.awaiting_id)
    name = md_strip(message.from_user.first_name) or "foydalanuvchi"
    await message.answer(
        f"👋 Salom, {name}!\n\n"
        f"Men BiznesOnline buyurtmalar botiman. Sizning do'koningiz uchun yangi "
        f"buyurtmalarni shu yerdan kanalingizga yuboraman.\n\n"
        f"📋 *1-qadam:* Iltimos, admin paneldan olingan *Bot ID* ni yuboring.\n\n"
        f"Misol: `BOT-CL001-X7K9P`",
    )


# ============ /help ============
@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "📚 *Yordam*\n\n"
        "/start — Ulanishni boshlash\n"
        "/status — Joriy ulanish holati\n"
        "/disconnect — Botni uzish\n\n"
        "Muammo bo'lsa: @support"
    )


# ============ /status ============
@router.message(Command("status"))
async def cmd_status(message: Message) -> None:
    me = find_by_chat_id(message.chat.id)
    if not me or me.get("status") != "connected":
        await message.answer("❌ Hozir hech qanday do'konga ulanmagansiz. /start ni bosing.")
        return
    connected_at = datetime.fromisoformat(me["connectedAt"]).strftime("%d.%m.%Y %H:%M")
    await message.answer(
        "✅ *Ulangan*\n\n"
        f"🆔 Bot ID: `{me['botId']}`\n"
        f"📢 Kanal: {me['channel']}\n"
        f"🕐 Ulangan vaqt: {connected_at}"
    )


# ============ /disconnect ============
@router.message(Command("disconnect"))
async def cmd_disconnect(message: Message, state: FSMContext) -> None:
    me = find_by_chat_id(message.chat.id)
    if not me:
        await message.answer("❌ Ulanish topilmadi")
        return
    db = load_db()
    db.pop(me["botId"], None)
    save_db(db)
    await state.clear()
    await message.answer("🔌 Bot uzildi. Yangi buyurtmalar yuborilmaydi.")


# ============ /broadcast — faqat ADMIN_IDS uchun ommaviy xabar ============
@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message, state: FSMContext, bot: Bot) -> None:
    if not ADMIN_IDS:
        await message.answer(
            "⚙️ Broadcast sozlanmagan.\n\n"
            "Botni ishga tushirayotganda `ADMIN_IDS` muhit o'zgaruvchisiga "
            f"o'z Telegram ID'ingizni qo'shing.\n\nSizning ID: `{message.from_user.id}`"
        )
        return
    if not is_broadcast_admin(message.from_user.id):
        await message.answer("❌ Bu komanda faqat adminlar uchun.")
        return
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        await message.answer("✍️ Foydalanish: `/broadcast Xabar matni`")
        return
    if broadcast_lock.locked():
        await message.answer("⏳ Avvalgi broadcast hali yuborilmoqda. Biroz kuting.")
        return
    await state.clear()
    await message.answer("📤 Yuborilmoqda...")
    result = await broadcast_message(bot, parts[1].strip())
    if result.get("busy"):
        await message.answer("⏳ Avvalgi broadcast hali yuborilmoqda. Biroz kuting.")
        return
    await message.answer(
        f"✅ *Broadcast yakunlandi*\n\n"
        f"📨 Yuborildi: {result['sent']} ta\n"
        f"❌ Xato: {result['failed']} ta\n"
        f"👥 Jami foydalanuvchi: {result['total']} ta"
    )


# ============ Bot ID qabul qilish ============
@router.message(Connect.awaiting_id, F.text)
async def receive_bot_id(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if not BOT_ID_RE.match(text):
        await message.answer(
            "❌ Bot ID format noto'g'ri.\n\n"
            "To'g'ri format: `BOT-CL001-X7K9P`\n\n"
            "Admin paneldan to'liq nusxa oling."
        )
        return

    bot_id = text.upper()
    await state.update_data(bot_id=bot_id)
    await state.set_state(Connect.awaiting_channel)

    await message.answer(
        f"✅ Bot ID qabul qilindi: `{bot_id}`\n\n"
        f"📢 *2-qadam:* Endi kanal username yoki ID sini yuboring.\n\n"
        f"Misol: `@mening_kanalim` yoki `-1001234567890`"
    )


# ============ Kanal qabul qilish + admin tekshirish ============
@router.message(Connect.awaiting_channel, F.text)
async def receive_channel(message: Message, state: FSMContext, bot: Bot) -> None:
    channel = (message.text or "").strip()
    if not channel.startswith("@") and not channel.startswith("-"):
        channel = "@" + channel

    data = await state.get_data()
    bot_id = data.get("bot_id")
    if not bot_id:
        await state.clear()
        await message.answer("❌ Sessiya tugagan. /start ni qaytadan bosing.")
        return

    try:
        me = await bot.get_me()
        member = await bot.get_chat_member(channel, me.id)
        if member.status not in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR):
            await message.answer(
                f"⚠️ Bot {channel} kanalida *admin emas*.\n\n"
                f"🔧 *3-qadam:* Iltimos, botni kanalingizga *admin* sifatida qo'shing "
                f"(yozish huquqi bilan), so'ng yana shu kanalni yuboring."
            )
            return

        # Hammasi joyida — saqlash
        db = load_db()
        db[bot_id] = {
            "chatId": message.chat.id,
            "channel": channel,
            "connectedAt": datetime.now().isoformat(),
            "status": "connected",
        }
        save_db(db)

        # Foydalanuvchiga tasdiq
        await message.answer(
            "🎉 *Muvaffaqiyatli ulandi!*\n\n"
            f"Bot endi {channel} kanaliga yangi buyurtmalarni avtomatik yuboradi."
        )

        # Kanalga tasdiq habari
        await bot.send_message(
            channel,
            "✅ *BiznesOnline boti muvaffaqiyatli ulandi!*\n\n"
            f"🆔 Do'kon ID: `{bot_id}`\n"
            f"🕐 {datetime.now().strftime('%d.%m.%Y %H:%M')}\n\n"
            f"Endi yangi buyurtmalar avtomatik shu kanalga keladi."
        )

        await state.clear()

    except TelegramAPIError as err:
        log.error("Channel check error: %s", err)
        await message.answer(
            f"❌ Xato: {err.message or 'Kanalga ulana olmadim'}.\n\n"
            f"Tekshiring:\n"
            f"• Kanal username to'g'rimi?\n"
            f"• Bot kanalda admin qilinganmi?\n\n"
            f"Yana kanal username/ID ni yuboring."
        )


# ============ Holat bo'lmagan xabarlar ============
@router.message(F.text)
async def fallback(message: Message, state: FSMContext) -> None:
    current = await state.get_state()
    if current is None:
        await message.answer("Ulanish boshlanmagan. /start ni bosing.")


# ============================================================
# ============ HTTP ENDPOINT: BUYURTMA QABUL QILISH ============
# ============================================================
async def handle_order(request: web.Request) -> web.Response:
    """Admin panel POST /orders/:botId — buyurtmani ulangan kanalga yuboradi."""
    bot_id = request.match_info["bot_id"].upper()
    bot: Bot = request.app["bot"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)

    order = body.get("order") or {}
    cfg = find_by_bot_id(bot_id)
    if not cfg:
        return web.json_response({"ok": False, "error": "Bot not connected"}, status=404)

    items_lines = [
        f"   • {md_strip(it.get('name', ''))} × {it.get('qty', 0)} = "
        f"{int(it.get('price', 0)) * int(it.get('qty', 0)):,} so'm".replace(",", " ")
        for it in (order.get("items") or [])
    ]
    items_text = "\n".join(items_lines) or "   (bo'sh)"

    total = int(order.get("total") or 0)
    msg = (
        "🔔 *YANGI BUYURTMA*\n\n"
        f"📦 Buyurtma: `{md_strip(order.get('id', '—'))}`\n"
        f"👤 Mijoz: {md_strip(order.get('userName', 'Anonim'))}\n"
        f"📞 Tel: {md_strip(order.get('phone', '—'))}\n"
        f"📍 Manzil: {md_strip(order.get('address', '—'))}\n\n"
        f"🛒 Mahsulotlar:\n{items_text}\n\n"
        f"💰 *Jami: {total:,} so'm*".replace(",", " ")
    )

    try:
        await bot.send_message(cfg["channel"], msg)
        return web.json_response({"ok": True})
    except TelegramAPIError as err:
        log.error("send to channel error: %s", err)
        return web.json_response({"ok": False, "error": str(err)}, status=500)


# ============================================================
# ====== HTTP ENDPOINT: BOT STATISTIKASI (admin panel) =======
# ============================================================
async def handle_stats(request: web.Request) -> web.Response:
    """GET /bot/stats — bot foydalanuvchilari soni va ro'yxati (admin panel uchun)."""
    users = load_users()
    now = datetime.now()
    user_list = []
    active_count = 0
    for info in users.values():
        last_seen = info.get("lastSeen")
        is_active = bool(info.get("active", True))
        if last_seen:
            try:
                is_active = is_active and (now - datetime.fromisoformat(last_seen)).days < 7
            except Exception:
                pass
        if is_active:
            active_count += 1
        user_list.append({
            "id": info.get("id"),
            "firstName": info.get("firstName") or "",
            "username": info.get("username"),
            "joinedAt": info.get("joinedAt"),
            "lastSeen": last_seen,
            "active": is_active,
        })
    user_list.sort(key=lambda x: x.get("lastSeen") or "", reverse=True)
    return web.json_response({
        "ok": True,
        "total": len(users),
        "active": active_count,
        "connections": len(load_db()),
        "users": user_list[:100],
    })


# ============================================================
# ====== HTTP ENDPOINT: BROADCAST (admin panel) ==============
# ============================================================
async def handle_broadcast(request: web.Request) -> web.Response:
    """POST /bot/broadcast {text} — barcha bot foydalanuvchilariga xabar yuboradi."""
    if ADMIN_TOKEN and request.headers.get("X-Admin-Token") != ADMIN_TOKEN:
        return web.json_response({"ok": False, "error": "Ruxsat yo'q"}, status=403)
    bot: Bot = request.app["bot"]
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    text = (body.get("text") or "").strip()
    if not text:
        return web.json_response({"ok": False, "error": "Bo'sh xabar"}, status=400)
    result = await broadcast_message(bot, text)
    if result.get("busy"):
        return web.json_response({"ok": False, "error": "Avvalgi broadcast hali tugamadi"}, status=409)
    return web.json_response({"ok": True, **result})


# ============================================================
# ====== HTTP ENDPOINT: STORE BOT (do'kon boti) ==============
# ============================================================
async def handle_store_connect(request: web.Request) -> web.Response:
    """POST /store-bot/connect — do'kon egasining buyurtma botini ulaydi (token tekshiriladi)."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)

    client_id = str(body.get("clientId") or "").strip()
    token = str(body.get("token") or "").strip()
    if not client_id or not token:
        return web.json_response({"ok": False, "error": "clientId va token kerak"}, status=400)
    if not TOKEN_RE.match(token):
        return web.json_response({"ok": False, "error": "Token formati noto'g'ri"}, status=400)
    if token == BOT_TOKEN:
        return web.json_response({"ok": False, "error": "Bu token buyurtma boti tomonidan band"}, status=409)

    db = load_store_db()
    # Shu token boshqa client_id ostida (eski/stale yozuv yoki kalit o'zgargan) bo'lsa —
    # RAD ETMAYMIZ, balki ko'chiramiz: bitta egali platforma, oxirgi ulanish ustivor.
    # Eski entry qoldirilsa "token boshqa do'konda ishlatilmoqda" deb noto'g'ri to'sib qo'yardi.
    moved = [cid for cid, c in list(db.items()) if cid != client_id and c.get("token") == token]
    for cid in moved:
        await stop_store_bot(cid)
        db.pop(cid, None)
    if moved:
        save_store_db(db)
        log.info("Store-bot token ko'chirildi: %s -> %s", moved, client_id)

    # Qayta ulanishda kanal/hisoblagichni saqlab qolamiz
    prev = db.get(client_id) or {}
    cfg = {
        "token": token,
        "shopName": str(body.get("shopName") or prev.get("shopName") or "Do'kon"),
        "channel": prev.get("channel"),
        "channelConnectedAt": prev.get("channelConnectedAt"),
        "sentCount": int(prev.get("sentCount") or 0),
        "status": "connected",
        "connectedAt": datetime.now().isoformat(),
    }
    try:
        result = await start_store_bot(client_id, cfg)
    except TelegramNetworkError:
        return web.json_response({"ok": False, "error": "Telegram serveriga ulanib bo'lmadi — internet ulanishini tekshiring"}, status=502)
    except TelegramAPIError as e:
        return web.json_response({"ok": False, "error": "Token yaroqsiz: " + (getattr(e, "message", None) or str(e))}, status=400)
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)

    cfg["username"] = result.get("username")
    db = load_store_db()
    db[client_id] = cfg
    save_store_db(db)
    return web.json_response({"ok": True, "username": result.get("username")})


async def handle_store_disconnect(request: web.Request) -> web.Response:
    """POST /store-bot/disconnect — do'kon botini to'xtatadi."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    client_id = str(body.get("clientId") or "").strip()
    if not client_id:
        return web.json_response({"ok": False, "error": "clientId kerak"}, status=400)
    await stop_store_bot(client_id)
    db = load_store_db()
    if client_id in db:
        db.pop(client_id, None)
        save_store_db(db)
    return web.json_response({"ok": True})


async def handle_store_status(request: web.Request) -> web.Response:
    """GET /store-bot/status?clientId= — bot holati, kanal va mijozlar soni."""
    client_id = str(request.query.get("clientId") or "").strip()
    if not client_id:
        return web.json_response({"ok": False, "error": "clientId kerak"}, status=400)
    cfg = load_store_db().get(client_id) or {}
    info = store_runtime.get(client_id)
    # "Ulangan" = saqlangan konfiguratsiyada token bor (DOIMIY holat).
    # Polling runtime (store_runtime) jarayon qayta ishga tushganda yoki bir nechta
    # nusxa ishlaganda bo'sh bo'lishi mumkin — lekin buyurtma/broadcast/kanal ulash
    # baribir cfg dan vaqtinchalik bot yaratib ishlaydi. Shuning uchun "connected"
    # ni runtime'ga emas, saqlangan token'ga bog'laymiz (aks holda ulangan bot
    # "Ulanmagan" bo'lib ko'rinadi va kanal ulash ishlamaydi).
    polling = bool(info) and info.get("bot") is not None
    user_count = len(load_store_users().get(client_id, {}))
    return web.json_response({
        "ok": True,
        "connected": bool(cfg.get("token")),
        "polling": polling,
        "username": cfg.get("username"),
        "shopName": cfg.get("shopName"),
        "channel": cfg.get("channel"),
        "channelConnected": bool(cfg.get("channel")),
        "sentCount": int(cfg.get("sentCount") or 0),
        "userCount": user_count,
    })


async def handle_store_set_channel(request: web.Request) -> web.Response:
    """POST /store-bot/set-channel — do'kon botini buyurtma kanaliga ulaydi (admin tekshiradi)."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    client_id = str(body.get("clientId") or "").strip()
    if not client_id:
        return web.json_response({"ok": False, "error": "clientId kerak"}, status=400)

    db = load_store_db()
    cfg = db.get(client_id)
    if not cfg:
        return web.json_response({"ok": False, "error": "Avval botni ulang"}, status=404)

    # Kanalni uzish
    if body.get("clear"):
        cfg["channel"] = None
        cfg["channelConnectedAt"] = None
        db[client_id] = cfg
        save_store_db(db)
        return web.json_response({"ok": True, "channel": None})

    channel = str(body.get("channel") or "").strip()
    if not channel:
        return web.json_response({"ok": False, "error": "channel kerak"}, status=400)
    if not channel.startswith("@") and not channel.startswith("-"):
        channel = "@" + channel

    bot, is_temp = await _store_bot_for(client_id, cfg)
    try:
        me = await bot.get_me()
        member = await bot.get_chat_member(channel, me.id)
        if member.status not in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR):
            return web.json_response({
                "ok": False,
                "error": f"Bot {channel} kanalida admin emas. Botni kanalga admin (yozish huquqi bilan) qo'shing.",
            }, status=400)
        cfg["channel"] = channel
        cfg["channelConnectedAt"] = datetime.now().isoformat()
        db = load_store_db()
        db[client_id] = cfg
        save_store_db(db)
        try:
            await bot.send_message(
                channel,
                f"✅ {cfg.get('shopName') or 'Dokon'} boti ulandi!\nEndi yangi buyurtmalar shu kanalga keladi.",
                parse_mode=None,
            )
        except TelegramAPIError:
            pass
        return web.json_response({"ok": True, "channel": channel})
    except TelegramAPIError as e:
        return web.json_response({"ok": False, "error": (getattr(e, "message", None) or str(e))}, status=400)
    finally:
        if is_temp:
            try:
                await bot.session.close()
            except Exception:
                pass


async def handle_store_order(request: web.Request) -> web.Response:
    """POST /store-bot/order — buyurtmani do'kon botining kanaliga yuboradi."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    client_id = str(body.get("clientId") or "").strip()
    order = body.get("order") or {}
    if not client_id:
        return web.json_response({"ok": False, "error": "clientId kerak"}, status=400)
    db = load_store_db()
    cfg = db.get(client_id)
    if not cfg:
        return web.json_response({"ok": False, "error": "Bot not connected"}, status=404)
    channel = cfg.get("channel")
    if not channel:
        return web.json_response({"ok": False, "error": "Kanal ulanmagan"}, status=409)

    bot, is_temp = await _store_bot_for(client_id, cfg)
    try:
        await bot.send_message(channel, format_store_order(cfg, order), parse_mode=None)
        cfg["sentCount"] = int(cfg.get("sentCount") or 0) + 1
        db = load_store_db()
        db[client_id] = cfg
        save_store_db(db)
        return web.json_response({"ok": True, "sentCount": cfg["sentCount"]})
    except TelegramAPIError as e:
        log.error("store order send error: %s", e)
        return web.json_response({"ok": False, "error": str(e)}, status=500)
    finally:
        if is_temp:
            try:
                await bot.session.close()
            except Exception:
                pass


async def handle_store_broadcast(request: web.Request) -> web.Response:
    """POST /store-bot/broadcast — do'kon botining barcha mijozlariga ommaviy xabar."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    client_id = str(body.get("clientId") or "").strip()
    text = str(body.get("text") or "").strip()
    if not client_id or not text:
        return web.json_response({"ok": False, "error": "clientId va text kerak"}, status=400)
    cfg = load_store_db().get(client_id)
    if not cfg:
        return web.json_response({"ok": False, "error": "Avval botni ulang"}, status=404)
    users = load_store_users().get(client_id, {})
    if not users:
        return web.json_response({"ok": True, "sent": 0, "failed": 0, "total": 0})

    bot, is_temp = await _store_bot_for(client_id, cfg)
    sent = failed = 0
    blocked = []
    try:
        for uid, u in list(users.items()):
            target = int(u.get("id", uid))
            try:
                await bot.send_message(target, text, parse_mode=None)
                sent += 1
            except TelegramRetryAfter as e:
                await asyncio.sleep(e.retry_after + 0.5)
                try:
                    await bot.send_message(target, text, parse_mode=None)
                    sent += 1
                except Exception:
                    failed += 1
            except TelegramForbiddenError:
                failed += 1
                blocked.append(uid)
            except Exception:
                failed += 1
            await asyncio.sleep(BROADCAST_DELAY)
    finally:
        if is_temp:
            try:
                await bot.session.close()
            except Exception:
                pass
    if blocked:
        data = load_store_users()
        bucket = data.get(client_id, {})
        for uid in blocked:
            bucket.pop(uid, None)
        save_store_users(data)
    return web.json_response({"ok": True, "sent": sent, "failed": failed, "total": len(users)})


@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        return web.Response(
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
                "Access-Control-Max-Age": "600",
            }
        )
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


def build_http_app(bot: Bot) -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app["bot"] = bot
    app.router.add_post(r"/orders/{bot_id:BOT-[A-Z0-9]+-[A-Z0-9]{5}}", handle_order)
    app.router.add_get("/bot/stats", handle_stats)
    app.router.add_post("/bot/broadcast", handle_broadcast)
    app.router.add_post("/store-bot/connect", handle_store_connect)
    app.router.add_post("/store-bot/disconnect", handle_store_disconnect)
    app.router.add_get("/store-bot/status", handle_store_status)
    app.router.add_post("/store-bot/set-channel", handle_store_set_channel)
    app.router.add_post("/store-bot/order", handle_store_order)
    app.router.add_post("/store-bot/broadcast", handle_store_broadcast)
    # OPTIONS preflight cors_middleware tomonidan to'g'ridan-to'g'ri javob beriladi (alohida route shart emas)
    return app


# ============ MAIN ============
async def main() -> None:
    if BOT_TOKEN.startswith("PUT_YOUR"):
        raise SystemExit("❌ BOT_TOKEN o'rnatilmagan. Avval BotFather'dan token oling.")

    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN))
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    # HTTP server (admin panel orderlari uchun)
    app = build_http_app(bot)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HTTP_HOST, HTTP_PORT)
    await site.start()
    log.info("✅ HTTP server: %s:%s (standart: localhost)", HTTP_HOST, HTTP_PORT)
    log.info("✅ HTTP endpoint: http://localhost:%s/orders/:botId", HTTP_PORT)
    log.info("✅ Bot statistika:  http://localhost:%s/bot/stats", HTTP_PORT)
    log.info("✅ Broadcast:       POST http://localhost:%s/bot/broadcast", HTTP_PORT)
    log.info("✅ Store botlar:    POST http://localhost:%s/store-bot/connect", HTTP_PORT)

    # Saqlangan do'kon botlarini (mijozga ko'rinadigan) tiklash
    await start_all_store_bots()
    log.info("✅ Telegram bot polling rejimida ishga tushdi")

    try:
        await dp.start_polling(bot, handle_signals=True)
    except Exception as e:
        # Buyurtma boti tokeni yaroqsiz bo'lsa ham — do'kon botlari va HTTP server ishlashda davom etsin
        log.error("⚠️ Buyurtma boti polling xatosi: %s — do'kon botlari ishlashda davom etadi", e)
        await asyncio.Event().wait()
    finally:
        for cid in list(store_runtime.keys()):
            await stop_store_bot(cid)
        await runner.cleanup()
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit) as e:
        log.info("Bot to'xtatildi: %s", e)
