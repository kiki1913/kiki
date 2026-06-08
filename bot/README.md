# BiznesOnline Telegram Bot — Python (aiogram)

Buyurtmalarni Telegram kanaliga yuboruvchi bot. **aiogram v3** asosida yozilgan.

## O'rnatish

1. **BotFather'dan token oling:**
   - Telegram'da [@BotFather](https://t.me/BotFather) ga yozing
   - `/newbot` → bot nomi → username → **token** ni saqlang

2. **Token'ni o'rnating:**
   ```bash
   export BOT_TOKEN="123456:ABC-DEF..."
   ```
   yoki `bot.py` ichida `BOT_TOKEN` ni to'g'ridan-to'g'ri yozing.

3. **Bog'liqliklarni o'rnating va ishga tushiring:**
   ```bash
   cd bot
   python3 -m venv .venv
   source .venv/bin/activate          # Linux/Mac
   # .venv\Scripts\activate           # Windows
   pip install -r requirements.txt
   python3 bot.py
   ```

## Ishlash jarayoni

1. Foydalanuvchi botga `/start` yuboradi
2. Bot **Bot ID** ni so'raydi (admin paneldan nusxalanadi)
3. Bot **kanal username/ID** ni so'raydi (masalan `@mening_kanalim`)
4. Foydalanuvchi botni kanalga **admin** sifatida qo'shadi
5. Bot kanalga "✅ Muvaffaqiyatli ulandi" yuboradi
6. Admin paneldan yangi buyurtma kelganda — bot uni kanalga yuboradi

## HTTP API

Admin panel buyurtmalarni quyidagi endpoint orqali yuboradi:

```
POST http://localhost:3344/orders/BOT-CL001-X7K9P
Content-Type: application/json

{
  "order": {
    "id": "TB-1001",
    "userName": "Sardor",
    "phone": "+998 90 123 45 67",
    "address": "Toshkent, Chilonzor",
    "items": [
      { "name": "Burger", "qty": 2, "price": 35000 }
    ],
    "total": 70000
  }
}
```

## Bot foydalanuvchilari va Broadcast (yangi)

Bot bilan muloqot qilgan **har bir foydalanuvchi** avtomatik ravishda `bot-users.json` ga
yoziladi (id, ism, username, qo'shilgan/oxirgi faollik vaqti). Bu broadcast va statistika uchun ishlatiladi.

### Statistika — admin panel uchun

```
GET http://localhost:3344/bot/stats
→ { "ok": true, "total": 42, "active": 30, "connections": 2, "users": [ ... ] }
```
- `total` — botni ishga tushirgan jami odamlar
- `active` — oxirgi 7 kunda yozganlar
- `connections` — ulangan do'kon kanallari soni

### Broadcast — barcha foydalanuvchilarga xabar

**1) Admin paneldan** (Sayt admin → *Telegram → Bot* bo'limi):
```
POST http://localhost:3344/bot/broadcast
Content-Type: application/json

{ "text": "Assalomu alaykum! Yangiliklar..." }
→ { "ok": true, "sent": 40, "failed": 2, "total": 42 }
```

**2) Telegram orqali** — admin botga yozadi:
```
/broadcast Assalomu alaykum! Yangiliklar...
```
Admin = **faqat** `ADMIN_IDS` da ko'rsatilgan Telegram ID lar. (Ulangan do'kon egalari avtomatik admin EMAS.)
`ADMIN_IDS` bo'sh bo'lsa, `/broadcast` ishlamaydi va bot sizning ID'ingizni ko'rsatadi — uni env'ga qo'shing.

### Sozlamalar (env)

| O'zgaruvchi | Tavsif | Default |
|---|---|---|
| `BOT_TOKEN` | BotFather token | (kod ichida) |
| `HOST` | HTTP server interfeysi. Standart — faqat localhost. Internetga ochish uchun `0.0.0.0` | `127.0.0.1` |
| `PORT` | HTTP server porti | `3344` |
| `ADMIN_IDS` | Telegram `/broadcast` uchun admin user ID lar (vergul bilan). Misol: `ADMIN_IDS=6797754291` | bo'sh |
| `ADMIN_TOKEN` | `POST /bot/broadcast` himoyasi (`X-Admin-Token` header). Bo'sh = localhost uchun ochiq | bo'sh |
| `BROADCAST_DELAY` | Xabarlar orasidagi pauza (Telegram rate-limit, ~20 msg/s) | `0.05` s |

> 🔒 Standart holatda HTTP server **faqat localhost** (`127.0.0.1`) da ishlaydi — admin panel shu
> mashinada ochiladi. Botni boshqa mashinadan/internetdan ishlatmoqchi bo'lsangiz: `HOST=0.0.0.0`
> qiling **va** albatta `ADMIN_TOKEN` o'rnating (admin panelda Sozlamalar → "Bot admin token").
>
> Broadcast oddiy matn sifatida yuboriladi (Markdown talqin qilinmaydi), shuning uchun `*`, `_`
> kabi belgilar xabarni buzmaydi.

## Do'kon boti — yagona bot (har ilova admin panelida)

Har bir do'kon egasi **o'z ilovasining admin paneli → "Telegram Bot"** bo'limidan **o'z**
Telegram bot tokenini ulaydi. Shu **bitta bot** hamma narsani qiladi:

1. **Mijozni kutib olish** — mijoz `/start` yozsa, bot xush kelibsiz xabari va **2 tugma** yuboradi:
   - 🛍 **Ilovani ochish** → do'konning web-ilovasi
   - 🧾 **Buyurtma berish** → ilovaning buyurtma sahifasi (`...?order=1`)
2. **Buyurtma kanali** — bot kanalga admin qilinadi; yangi buyurtmalar shu kanalga yuboriladi.
3. **Broadcast** — botga yozgan barcha mijozlarga ommaviy xabar.

Har bir do'kon `clientId` (aslida `<client>__<ilova>`, masalan `CL001__fastfood`) bo'yicha
ajratiladi. Bir nechta do'kon bir vaqtda o'z botlarini ishlatishi mumkin — har biri alohida
token bilan bir xil server ichida polling qiladi. Konfiguratsiya `store-bots.json` ga,
foydalanuvchilar `store-bot-users.json` ga saqlanadi; server qayta yoqilganda avtomatik tiklanadi.

> ⚠️ Telegram inline tugmalar **ommaviy `https://` manzil** talab qiladi (localhost/`file://`
> ishlamaydi). "Ilova manzili (URL)" maydoniga do'kon haqiqatan joylashgan manzilni kiriting.

### HTTP API (ilova admin panelidan chaqiriladi)

```
POST /store-bot/connect       { clientId, token, shopName, appUrl, orderUrl, welcomeText, btnApp, btnOrder }
                              → { ok, username }           # token get_me bilan tekshiriladi
POST /store-bot/set-channel   { clientId, channel }        → { ok, channel }   # bot kanalda admin ekani tekshiriladi
POST /store-bot/set-channel   { clientId, clear: true }    → { ok, channel:null }   # kanalni uzish
POST /store-bot/order         { clientId, order }          → { ok, sentCount }  # buyurtmani kanalga yuboradi
POST /store-bot/broadcast     { clientId, text }           → { ok, sent, failed, total }
POST /store-bot/disconnect    { clientId }                 → { ok }
GET  /store-bot/status?clientId=...   → { ok, connected, username, channel, channelConnected, sentCount, userCount }
```

`connect` token yaroqsiz bo'lsa **400**, internet bo'lmasa **502** qaytaradi. Bitta token bir
nechta do'konda yoki buyurtma boti tokeni sifatida ishlatilsa — rad etiladi (**409**).
Mijozlar tomonida buyurtma berilganda ilova `script.js` ham `POST /store-bot/order` yuboradi.

## Bot komandalar

- `/start` — Ulanishni boshlash
- `/status` — Joriy ulanish holati
- `/disconnect` — Botni uzish
- `/broadcast <matn>` — (admin) barcha foydalanuvchilarga xabar yuborish
- `/help` — Yordam

## Texnik xususiyatlar

- **Framework:** aiogram v3 (async)
- **HTTP server:** aiohttp (aiogram bilan birga)
- **Database:** fayl asosida `bot-db.json` (buyurtma boti) + `store-bots.json` (do'kon botlari)
- **State machine:** FSM (Connect.awaiting_id → Connect.awaiting_channel → connected)
- **Ko'p-bot:** do'kon botlari har biri alohida `Dispatcher` + `asyncio.Task` da polling qiladi
- **CORS:** ruxsat berilgan (admin paneldan brauzer fetch'i uchun)
