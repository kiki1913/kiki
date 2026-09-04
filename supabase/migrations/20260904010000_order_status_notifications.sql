-- ============================================================================
--  Buyurtma holati (status) o'zgarishida push + ilova ichidagi bildirishnoma.
--
--  Yondashuv: hamma push bitta yo'ldan o'tadi — `notifications` jadvaliga qator
--  qo'shilsa, trigger `pg_notify('new_notification')` yuboradi, worker esa uni
--  ushlab push jo'natadi va `user_notifications` ni to'ldiradi. Buyurtma holati
--  o'zgarishlarini worker aynan shu jadvalga (target_user_id bilan) yozadi —
--  shu tufayli order-status va admin-broadcast bitta mexanizmda ishlaydi.
-- ============================================================================

-- target_user_id: NULL = broadcast (barcha foydalanuvchilarga),
--                 to'ldirilgan = faqat o'sha foydalanuvchiga.
alter table notifications add column if not exists target_user_id text;
create index if not exists idx_notifications_target
  on notifications (target_user_id);

-- Har bir buyurtma bo'yicha oxirgi push yuborilgan status. Status o'zgarsa
-- yangi push ketadi; bir xil status uchun takror push yuborilmaydi.
-- Faqat worker (postgres roli) yozadi — anon ruxsati berilmaydi.
create table if not exists order_notification_state (
  order_id    text primary key,
  last_status text not null,
  notified_at timestamptz not null default now()
);

alter table order_notification_state enable row level security;
-- (anon uchun policy YO'Q — faqat worker to'g'ridan-to'g'ri ulanib yozadi.)
