#!/usr/bin/env python3
"""
KIKI push-worker — self-hosted Supabase (Uztelecom VPS) uchun FCM push xizmati.

Ikki manba bilan ishlaydi:
  1) BROADCAST (admin xabari) — `notifications` jadvaliga INSERT bo'lganda
     Postgres LISTEN/NOTIFY ('new_notification') orqali deyarli real vaqtda.
  2) ORDER DELIVERED — buyurtmalar KV (`app_state.lume_orders` JSONB) da
     saqlangani uchun har POLL_INTERVAL soniyada polling: status='done' va
     hali push yuborilmagan (pushed_orders'da yo'q) buyurtmalarga push.

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
DELIVERED_STATUS = os.getenv("DELIVERED_STATUS", "done")  # ilovadagi "yetkazib berildi"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "8"))
CHANNEL_ID = os.getenv("ANDROID_CHANNEL_ID", "kiki_default")

DELIVERED_TITLE = os.getenv("DELIVERED_TITLE", "Buyurtmangiz yetib keldi 🎉")
DELIVERED_BODY = os.getenv(
    "DELIVERED_BODY", "Buyurtmangiz BTS filialiga yetib keldi. Olib ketishingiz mumkin."
)

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
        await _delete_tokens(pool, invalid)
    return ok


async def _delete_tokens(pool, tokens: Iterable[str]):
    toks = list(tokens)
    if not toks:
        return
    async with pool.acquire() as con:
        await con.execute("delete from user_push_tokens where token = any($1::text[])", toks)
    log.info("O'chirildi (eskirgan) tokenlar: %d", len(toks))


# ------------------------- Broadcast (LISTEN/NOTIFY) -------------------------
async def process_notification(pool, notif_id: int):
    async with pool.acquire() as con:
        # Atomik "claim" — processed=false bo'lsagina biz olamiz (ikki marta yuborilmasin).
        row = await con.fetchrow(
            "update notifications set processed = true "
            "where id = $1 and processed = false "
            "returning title, body, type",
            notif_id,
        )
        if row is None:
            log.info("notification #%s allaqachon ishlangan yoki topilmadi", notif_id)
            return
        # Barcha (user_id, token) juftliklari.
        token_rows = await con.fetch("select user_id, token from user_push_tokens")

    if not token_rows:
        log.info("notification #%s: token yo'q, faqat yozib qo'yildi", notif_id)
        return

    tokens = [r["token"] for r in token_rows]
    user_ids = {r["user_id"] for r in token_rows}

    ok = await send_to_tokens(
        pool, tokens, row["title"], row["body"],
        data={"type": row["type"], "notification_id": notif_id},
    )

    # Har bir foydalanuvchiga ilova ichida ko'rinishi uchun yozuv (agar yo'q bo'lsa).
    async with pool.acquire() as con:
        await con.executemany(
            "insert into user_notifications (user_id, notification_id) "
            "values ($1, $2) on conflict do nothing",
            [(uid, notif_id) for uid in user_ids],
        )
    log.info("Broadcast #%s yuborildi: %d/%d token", notif_id, ok, len(tokens))


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
            if str(order.get("status")) != DELIVERED_STATUS:
                continue
            oid = str(order.get("id") or "")
            uid = str(order.get("uid") or "")
            if not oid or not uid:
                continue
            await _maybe_push_order(pool, oid, uid)


async def _maybe_push_order(pool, order_id: str, user_id: str):
    async with pool.acquire() as con:
        # Atomik claim — birinchi bo'lib INSERT qilgan iteratsiya push yuboradi.
        claimed = await con.fetchrow(
            "insert into pushed_orders (order_id) values ($1) "
            "on conflict do nothing returning order_id",
            order_id,
        )
        if claimed is None:
            return  # allaqachon yuborilgan
        token_rows = await con.fetch(
            "select token from user_push_tokens where user_id = $1", user_id
        )
    tokens = [r["token"] for r in token_rows]
    if not tokens:
        log.info("order %s: %s uchun token yo'q (dedupe belgilandi)", order_id, user_id)
        return
    ok = await send_to_tokens(
        pool, tokens, DELIVERED_TITLE, DELIVERED_BODY,
        data={"type": "order", "order_id": order_id},
    )
    log.info("Order %s yetib keldi push: %d/%d token", order_id, ok, len(tokens))


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
