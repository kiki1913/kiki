# KIKI push-worker

Self-hosted Supabase (Uztelecom VPS, Docker) uchun FCM push yuboruvchi mustaqil
Python xizmati. Maxsus API server yoki Edge Functions kerak emas — worker
Postgres'ga to'g'ridan-to'g'ri ulanadi.

## Nima qiladi
- **Broadcast**: `notifications` jadvaliga INSERT bo'lganda (admin panel yozadi)
  Postgres `LISTEN/NOTIFY` orqali ushlab, barcha qurilma tokenlariga push yuboradi,
  har bir foydalanuvchi uchun `user_notifications` yozuvini qo'shadi va
  `notifications.processed = true` qiladi.
- **Order delivered**: buyurtmalar KV (`app_state.lume_orders` JSONB) da saqlangani
  uchun har `POLL_INTERVAL_SECONDS` da polling qiladi; `status = 'done'` va hali
  push yuborilmagan (`pushed_orders` da yo'q) buyurtma egasiga push yuboradi va
  `pushed_orders` ga belgilaydi (takror yuborilmasligi uchun).
- Eskirgan/yaroqsiz tokenlarni `user_push_tokens` dan avtomatik o'chiradi.

> **Arxitektura eslatmasi:** alohida `orders` jadvali yo'q (KV model), shu sabab
> `orders.push_sent` o'rniga `pushed_orders` dedupe jadvali ishlatiladi va order
> tomoni trigger emas, polling bilan ishlaydi. Broadcast tomoni esa LISTEN/NOTIFY.

## 1. Ma'lumotlar bazasi
Migration `kikiadmin/supabase/migrations/20260904000000_push_notifications.sql`
faylida. Uni bazaga qo'llang (VPS'da):

```bash
# Docker konteyner nomi o'zingizniki bilan almashtiring (masalan supabase-db):
docker exec -i supabase-db psql -U postgres -d postgres \
  < 20260904000000_push_notifications.sql
```

## 2. Postgres'ga ulanish (DATABASE_URL)
Ikki variant:
- **Bir xil Docker network**: worker'ni Postgres bilan bir network'da ishga tushirib,
  host sifatida konteyner nomini bering (`postgresql://postgres:PAROL@supabase-db:5432/postgres`).
- **Localhost port**: DB portini VPS'ning 127.0.0.1 ига oching va
  `postgresql://postgres:PAROL@127.0.0.1:5432/postgres` ishlating.
  (Portni tashqi internetga ochmang — faqat localhost.)

## 3. O'rnatish (VPS)
```bash
cd ~
git clone <repo> || true          # yoki fayllarni ~/push-worker/ ga ko'chiring
cd ~/push-worker

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
nano .env                          # DATABASE_URL, FIREBASE_CREDENTIALS ni to'ldiring
```

Firebase **Service Account** JSON'ini oling: Firebase Console → Project Settings →
Service accounts → *Generate new private key*. Faylni serverga qo'ying (masalan
`~/push-worker/service-account.json`) va `.env` dagi `FIREBASE_CREDENTIALS` ga yo'lni yozing.
**Bu fayl va `.env` gitga qo'shilMAYDI** (`.gitignore` da bor).

Qo'lda sinov:
```bash
source .venv/bin/activate
python worker.py     # loglar chiqishini kuzating (Ctrl+C bilan to'xtatish)
```

## 4. systemd xizmati
```bash
sudo cp push-worker.service /etc/systemd/system/push-worker.service
sudo nano /etc/systemd/system/push-worker.service   # YOUR_USER va yo'llarni to'g'irlang
sudo systemctl daemon-reload
sudo systemctl enable --now push-worker
sudo systemctl status push-worker
journalctl -u push-worker -f        # jonli loglar
```

## 5. Tekshirish
1. **Order delivered**: bazada bitta buyurtma statusini qo'lda `done` qiling
   (app_state.lume_orders ichida) → ~POLL_INTERVAL ичida push kelishi kerak.
2. **Broadcast**: `insert into notifications (title, body) values ('Test','Salom');`
   → worker darhol LISTEN orqali ushlab, barcha tokenlarga push yuboradi.
3. **Auto-restart**: `sudo systemctl restart push-worker` yoki `sudo reboot` —
   `systemctl status push-worker` yana `active (running)` bo'lishi kerak.
