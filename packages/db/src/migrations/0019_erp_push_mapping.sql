-- payable_items'a ERP push mapping kolonları
ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS erp_connection_id uuid;
ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS erp_external_id text;
ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS erp_push_status text;
ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS erp_pushed_at timestamptz;
ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS erp_push_error text;

-- payment_transactions'a ERP push mapping kolonları
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS erp_connection_id uuid;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS erp_external_id text;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS erp_push_status text;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS erp_pushed_at timestamptz;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS erp_push_error text;

-- ERP push aramaları için index (kategoride bekleyenleri bulurken hızlı)
CREATE INDEX IF NOT EXISTS idx_payable_erp ON payable_items(erp_connection_id, erp_push_status);
CREATE INDEX IF NOT EXISTS idx_payment_erp ON payment_transactions(erp_connection_id, erp_push_status);
