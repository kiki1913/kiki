-- ============================================================================
--  user_push_tokens: har bir "tanilgan" foydalanuvchi qator sifatida saqlanadi —
--  push token bor-yo'qligidan qat'i nazar. Shu tufayli broadcast bildirishnoma
--  push ruxsatini bermagan (yoki iOS simulyatorda token ololmagan) foydalanuvchiga
--  ham ilova ichida (user_notifications) yetib boradi.
--
--  O'zgarish: identifikator endi `token` emas, `user_id` (bir foydalanuvchi = bir
--  qator). `token` NULL bo'lishi mumkin (ruxsatsiz foydalanuvchi). Token kelsa,
--  o'sha qator yangilanadi.
-- ============================================================================

-- 1) token endi majburiy emas.
alter table user_push_tokens alter column token drop not null;

-- 2) Bir foydalanuvchi uchun bitta qator qoldiramiz (eng yangi updated_at,
--    teng bo'lsa token bor qatorni afzal ko'ramiz) — unique constraint qo'yishdan oldin.
delete from user_push_tokens t
using user_push_tokens t2
where t.user_id = t2.user_id
  and (
    t.updated_at < t2.updated_at
    or (t.updated_at = t2.updated_at and t.token is null and t2.token is not null)
    or (t.updated_at = t2.updated_at and (t.token is null) = (t2.token is null) and t.ctid < t2.ctid)
  );

-- 3) Eski birlamchi kalit (token) o'rniga user_id ni birlamchi kalit qilamiz.
alter table user_push_tokens drop constraint if exists user_push_tokens_pkey;
alter table user_push_tokens add constraint user_push_tokens_pkey primary key (user_id);

-- user_id uchun alohida indeks endi ortiqcha (PK indeks bor).
drop index if exists idx_user_push_tokens_user;

-- Bir nechta qurilmani qo'llab-quvvatlash uchun token bo'yicha ham tezkor qidiruv
-- (eskirgan tokenni tozalash uchun) — ixtiyoriy, lekin foydali.
create index if not exists idx_user_push_tokens_token
  on user_push_tokens (token) where token is not null;
