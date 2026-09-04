-- ============================================================================
--  Bildirishnomaga rasm va bog'langan mahsulotlar biriktirish.
--  image_url  — rasm data: URL (base64) sifatida (loyihadagi mavjud yondashuv).
--  product_ids — mahsulot ID'lari massivi, masalan [12, 45, 78].
-- ============================================================================
alter table notifications add column if not exists image_url text;
alter table notifications add column if not exists product_ids jsonb;
