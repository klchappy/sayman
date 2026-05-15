-- Fatura (payable + sales invoice) bazlı review queue
-- Auto-import edilen faturalar needs_review=true ile yaratılır,
-- kullanıcı tek tek onaylayabilir (needs_review=false) veya reddedebilir (DELETE).

ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS auto_created_source text;
ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE payable_items ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS auto_created_source text;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payable_review
  ON payable_items(tenant_id, needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_review
  ON sales_invoices(tenant_id, needs_review) WHERE needs_review = true;
