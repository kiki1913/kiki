-- app_state: admin panel (cloud.js) va Flutter ilova (cloud.dart) uchun
-- umumiy kalit-qiymat (KV) jadvali. app='lume', client_id=STORE_CLIENT.
create table if not exists app_state (
  app text not null,
  client_id text not null,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (app, client_id, key)
);

alter table app_state enable row level security;

-- Ilova auth ishlatmaydi (anon key bilan ochiq do'kon), shuning uchun anon rolga
-- to'liq CRUD ruxsatini beramiz, lekin FAQAT shu jadvalga (boshqa jadvallarga emas):
create policy "anon full access on app_state"
  on app_state for all
  to anon
  using (true)
  with check (true);
