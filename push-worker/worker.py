#!/usr/bin/env python3
"""
KIKI push-worker — self-hosted Supabase (Uztelecom VPS) uchun FCM push xizmati.

Yagona yo'l: har qanday push `notifications` jadvaliga qator qo'shilishidan
boshlanadi. Trigger `pg_notify('new_notification')` yuboradi, worker uni ushlab
push jo'natadi va `user_notifications` ni to'ldiradi (ilova ichidagi ro'yxat uchun).
target_user_id NULL = broadcast (barchaga), to'ldirilgan = faqat o'sha userga.

Ikki manba shu jadvalga yozadi:
  1) BROADCAST — admin panel `notifications` ga to'g'ridan-to'g'ri INSERT qiladi
     (target_user_id = NULL).
  2) ORDER STATUS — buyurtmalar KV (`app_state.lume_orders` JSONB) da bo'lgani
     uchun worker har POLL_INTERVAL soniyada polling qiladi: status NOTIFY_STATUSES
     ichida bo'lsa va oldingi push'dan farq qilsa (order_notification_state),
     targeted notifications qatori qo'shadi. Shu tariqa HAR bir holat o'zgarishi
     (plane → arrived → way → done) uchun bitta push ketadi, takror emas.

Postgres'ga TO'G'RIDAN-TO'G'RI (asyncpg) ulanadi va RLS'ni chetlab o'tadi.
"""

import asyncio
import json
import logging
import os
import signal
from typing import Iterable

import asyncpg
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, messaging

load_dotenv()

# ----------------------------- Konfiguratsiya --------------------------------
DATABASE_URL = os.environ["DATABASE_URL"]  # postgresql://user:pass@host:port/db
FIREBASE_CREDENTIALS = os.environ["FIREBASE_CREDENTIALS"]  # service account .json yo'li
APP_NAME = os.getenv("APP_NAME", "lume")
ORDERS_KEY = os.getenv("ORDERS_KEY", "lume_orders")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "8"))
CHANNEL_ID = os.getenv("ANDROID_CHANNEL_ID", "kiki_default")

# Push yuboriladigan buyurtma holatlari (status kodlari — ilova bilan bir xil).
# 'collecting' (Yig'ilmoqda) — boshlang'ich holat, push YUBORILMAYDI.
NOTIFY_STATUSES = [
    s.strip()
    for s in os.getenv("NOTIFY_STATUSES", "plane,arrived,way,done").split(",")
    if s.strip()
]

# Har bir status uchun push matni (title, body). .env dan alohida to'ldirish
# shart emas — bu yerda o'zbekcha standart matnlar. "done" uchun eski
# DELIVERED_TITLE/BODY o'zgaruvchilari ham hisobga olinadi (moslik uchun).
STATUS_MESSAGES = {
    "plane": (
        "Buyurtmangiz yo'lga chiqdi ✈️",
        "Buyurtmangiz samolyotda, tez orada yetib keladi.",
    ),
    "arrived": (
        "Buyurtmangiz Toshkentga yetib keldi 📍",
        "Buyurtmangiz Toshkentga yetib keldi.",
    ),
    "way": (
        "Buyurtmangiz yo'lda 🚚",
        "Buyurtmangiz filialga yo'lda.",
    ),
    "done": (
        os.getenv("DELIVERED_TITLE", "Buyurtmangiz yetib keldi 🎉"),
        os.getenv(
            "DELIVERED_BODY",
            "Buyurtmangiz BTS filialiga yetib keldi. Olib ketishingiz mumkin.",
        ),
    ),
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("push-worker")

# --------------------------- Firebase Admin SDK ------------------------------
firebase_admin.initialize_app(credentials.Certificate(FIREBASE_CREDENTIALS))


# ----------------------------- FCM yuborish ----------------------------------
def _android_config() -> messaging.AndroidConfig:
    return messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(channel_id=CHANNEL_ID),
    )


def _send_sync(tokens: list[str], title: str, body: str, data: dict | None):
    """Bloklovchi FCM chaqiruvi — executor ichida ishlatiladi.
    Qaytaradi: (muvaffaqiyatlar soni, o'chirilishi kerak bo'lgan tokenlar ro'yxati)."""
    if not tokens:
        return 0, []
    messages = [
        messaging.Message(
            token=t,
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            android=_android_config(),
        )
        for t in tokens
    ]
    resp = messaging.send_each(messages)
    invalid: list[str] = []
    for tok, r in zip(tokens, resp.responses):
        if r.success:
            continue
        exc = r.exception
        if isinstance(exc, (messaging.UnregisteredError, messaging.SenderIdMismatchError)):
            invalid.append(tok)
        elif exc is not None and "registration-token-not-registered" in str(exc).lower():
            invalid.append(tok)
        else:
            log.warning("FCM yuborishda xato (token=%s...): %s", tok[:12], exc)
    return resp.success_count, invalid


async def send_to_tokens(pool, tokens: list[str], title: str, body: str, data=None) -> int:
    loop = asyncio.get_running_loop()
    ok, invalid = await loop.run_in_executor(None, _send_sync, tokens, title, body, data)
    if invalid:
        await _clear_tokens(pool, invalid)
    return ok


async def _clear_tokens(pool, tokens: Iterable[str]):
    # Eskirgan/yaroqsiz tokenni NULL qilamiz — qatorni O'CHIRMAYMIZ, chunki
    # foydalanuvchi baribir "tanilgan" bo'lib qolishi va ilova ichidagi
    # bildirishnomalarni (user_notifications) olishda davom etishi kerak.
    toks = list(tokens)
    if not toks:
        return
    async with pool.acquire() as con:
        await con.execute(
            "update user_push_tokens set token = null where token = any($1::text[])",
            toks,
        )
    log.info("Tozalandi (eskirgan) tokenlar: %d", len(toks))


# --------------- Bildirishnomani yuborish (LISTEN/NOTIFY yagona yo'l) ---------
# Har qanday notifications qatori (admin broadcast YOKI order-status) shu yerdan
# o'tadi: target_user_id NULL bo'lsa barchaga, to'ldirilgan bo'lsa faqat o'sha userga.
async def process_notification(pool, notif_id: int):
    async with pool.acquire() as con:
        # Atomik "claim" — processed=false bo'lsagina biz olamiz (ikki marta yuborilmasin).
        row = await con.fetchrow(
            "update notifications set processed = true "
            "where id = $1 and processed = false "
            "returning title, body, type, target_user_id",
            notif_id,
        )
        if row is None:
            log.info("notification #%s allaqachon ishlangan yoki topilmadi", notif_id)
            return
        target = row["target_user_id"]
        if target:
            # Faqat bitta foydalanuvchi.
            token_rows = await con.fetch(
                "select user_id, token from user_push_tokens where user_id = $1",
                target,
            )
            user_ids = {target}
        else:
            # Broadcast — barcha foydalanuvchilar.
            token_rows = await con.fetch("select user_id, token from user_push_tokens")
            user_ids = {r["user_id"] for r in token_rows}

    # Ilova ichida ko'rinishi uchun user_notifications HAR DOIM yoziladi
    # (token bo'lmasa ham — foydalanuvchi ro'yxatda ko'radi).
    if user_ids:
        async with pool.acquire() as con:
            await con.executemany(
                "insert into user_notifications (user_id, notification_id) "
                "values ($1, $2) on conflict do nothing",
                [(uid, notif_id) for uid in user_ids],
            )

    # token NULL bo'lgan foydalanuvchilar (push ruxsatsiz) chetlab o'tiladi —
    # ular user_notifications orqali ilova ichida ko'radi (push emas).
    tokens = [r["token"] for r in token_rows if r["token"]]
    if not tokens:
        log.info("notification #%s: push token yo'q (target=%s) — ro'yxatga yozildi",
                 notif_id, target or "broadcast")
        return

    ok = await send_to_tokens(
        pool, tokens, row["title"], row["body"],
        data={"type": row["type"], "notification_id": notif_id},
    )
    log.info("Notif #%s (%s) yuborildi: %d/%d token",
             notif_id, target or "broadcast", ok, len(tokens))


async def listen_broadcasts(pool):
    """Alohida ulanish ochib 'new_notification' kanalini tinglaydi (auto-reconnect)."""
    while True:
        con = None
        try:
            con = await asyncpg.connect(DATABASE_URL)
            queue: asyncio.Queue[int] = asyncio.Queue()

            def _on_notify(_c, _pid, _channel, payload):
                try:
                    queue.put_nowait(int(payload))
                except ValueError:
                    log.warning("noto'g'ri notify payload: %r", payload)

            await con.add_listener("new_notification", _on_notify)
            log.info("LISTEN new_notification — ulandi")

            # Ishga tushishda o'tkazib yuborilgan (processed=false) larni qayta ishlaymiz.
            missed = await con.fetch(
                "select id from notifications where processed = false order by id"
            )
            for m in missed:
                await process_notification(pool, m["id"])

            while True:
                nid = await queue.get()
                await process_notification(pool, nid)
        except (asyncpg.PostgresError, OSError) as e:
            log.error("LISTEN ulanishi uzildi: %s — 5s dan keyin qayta urinish", e)
            await asyncio.sleep(5)
        finally:
            if con is not None:
                try:
                    await con.close()
                except Exception:
                    pass


# --------------------------- Orders polling (KV) -----------------------------
async def poll_orders(pool):
    while True:
        try:
            await _scan_orders_once(pool)
        except Exception:
            log.exception("orders polling xatosi")
        await asyncio.sleep(POLL_INTERVAL)


async def _scan_orders_once(pool):
    async with pool.acquire() as con:
        rows = await con.fetch(
            "select client_id, value from app_state where app = $1 and key = $2",
            APP_NAME, ORDERS_KEY,
        )
    for row in rows:
        value = row["value"]
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                continue
        if not isinstance(value, list):
            continue
        for order in value:
            if not isinstance(order, dict):
                continue
            status = str(order.get("status") or "")
            if status not in NOTIFY_STATUSES:
                continue
            oid = str(order.get("id") or "")
            uid = str(order.get("uid") or "")
            if not oid or not uid:
                continue
            await _maybe_notify_order(pool, oid, uid, status)


async def _maybe_notify_order(pool, order_id: str, user_id: str, status: str):
    """Status o'zgargan bo'lsa — notifications'ga qator qo'shadi (trigger orqali
    push + user_notifications ketadi) va order_notification_state'ni yangilaydi.
    Bir xil status uchun takror push yubormaydi."""
    title, body = STATUS_MESSAGES.get(
        status, ("Buyurtma holati yangilandi", "Buyurtmangiz holati o'zgardi.")
    )
    async with pool.acquire() as con:
        async with con.transaction():
            # Oxirgi yuborilgan status shu bilan bir xil bo'lsa — o'tkazib yuboramiz.
            prev = await con.fetchval(
                "select last_status from order_notification_state "
                "where order_id = $1 for update",
                order_id,
            )
            if prev == status:
                return
            # notifications'ga targeted qator — trigger 'new_notification' yuboradi,
            # process_notification esa push + user_notifications bilan shug'ullanadi.
            await con.execute(
                "insert into notifications (title, body, type, order_id, target_user_id) "
                "values ($1, $2, 'order_status', $3, $4)",
                title, body, order_id, user_id,
            )
            await con.execute(
                "insert into order_notification_state (order_id, last_status, notified_at) "
                "values ($1, $2, now()) "
                "on conflict (order_id) do update set last_status = excluded.last_status, "
                "notified_at = now()",
                order_id, status,
            )
    log.info("Order %s status '%s' — bildirishnoma yaratildi (user=%s)",
             order_id, status, user_id)


# --------------------------------- Main --------------------------------------
async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    log.info("Postgres pool tayyor. APP=%s, ORDERS_KEY=%s, POLL=%ss",
             APP_NAME, ORDERS_KEY, POLL_INTERVAL)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass

    tasks = [
        asyncio.create_task(listen_broadcasts(pool)),
        asyncio.create_task(poll_orders(pool)),
    ]
    await stop.wait()
    log.info("To'xtatilmoqda...")
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
