# KIKI push-worker

Self-hosted Supabase (Uztelecom VPS, Docker) uchun FCM push yuboruvchi mustaqil
Python xizmati. Maxsus API server yoki Edge Functions kerak emas — worker
Postgres'ga to'g'ridan-to'g'ri ulanadi.

## Nima qiladi
Hamma push bitta yo'ldan o'tadi: `notifications` jadvaliga qator qo'shilsa,
trigger `LISTEN/NOTIFY` orqali worker'ni uyg'otadi, worker push jo'natadi va
`user_notifications` ni to'ldiradi (ilova ichidagi ro'yxat uchun), so'ng
`processed = true` qiladi.
- `target_user_id = NULL` → **broadcast** (barcha qurilmalarga).
- `target_user_id = <uid>` → **faqat o'sha foydalanuvchiga**.

Ikki manba shu jadvalga yozadi:
- **Admin broadcast**: admin panel `notifications` ga to'g'ridan-to'g'ri INSERT qiladi.
- **Order status**: buyurtmalar KV (`app_state.lume_orders` JSONB) da bo'lgani uchun
  worker har `POLL_INTERVAL_SECONDS` da polling qiladi. Status `NOTIFY_STATUSES`
  (standart: `plane,arrived,way,done`) ichida bo'lsa VA oldingi push'dan farq qilsa
  (`order_notification_state`), targeted notifications qatori qo'shadi. Shu tariqa
  **har bir holat o'zgarishi** (Samalyotda → Toshkentga yetib keldi → Yo'lda →
  Yetkazib berildi) uchun bitta push ketadi, bir xil status takrorlanmaydi.
  `collecting` (Yig'ilmoqda) — boshlang'ich, push yo'q.
- Eskirgan/yaroqsiz tokenlarni `user_push_tokens` dan avtomatik o'chiradi.

> **Arxitektura eslatmasi:** alohida `orders` jadvali yo'q (KV model), shu sabab
> order tomoni trigger emas, polling bilan ishlaydi va takrorlanmaslik uchun
> `order_notification_state (order_id, last_status)` jadvali ishlatiladi.

## 1. Ma'lumotlar bazasi
Migratsiyalar `kikiadmin/supabase/migrations/` da. IKKALASINI ham tartib bilan
qo'llang (VPS'da):

```bash
# Docker konteyner nomi o'zingizniki bilan almashtiring (masalan supabase-db):
docker exec -i supabase-db psql -U postgres -d postgres \
  < 20260904000000_push_notifications.sql
docker exec -i supabase-db psql -U postgres -d postgres \
  < 20260904010000_order_status_notifications.sql   # target_user_id + order_notification_state
```
Migratsiyadan so'ng PostgREST yangi ustunni (target_user_id) ko'rishi uchun schema
keshini yangilang: `docker exec -i supabase-db psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"`

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
1. **Order status**: bazada bitta buyurtma statusini qo'lda `plane` (keyin `way`) qiling
   (app_state.lume_orders ichida) → ~POLL_INTERVAL ичida push kelishi kerak.
2. **Broadcast**: `insert into notifications (title, body) values ('Test','Salom');`
   → worker darhol LISTEN orqali ushlab, barcha tokenlarga push yuboradi.
3. **Auto-restart**: `sudo systemctl restart push-worker` yoki `sudo reboot` —
   `systemctl status push-worker` yana `active (running)` bo'lishi kerak.
