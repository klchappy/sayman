-- Çek ve senet (bono) takibi
CREATE TABLE IF NOT EXISTS checks_and_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'check',
  direction text NOT NULL,
  document_no text,
  drawer_name text,
  beneficiary_name text,
  bank_id uuid REFERENCES banks(id) ON DELETE SET NULL,
  bank_branch text,
  bank_account_no text,
  amount numeric(18, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  issue_date date,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'portfolio',
  portfolio_no text,
  related_payable_id uuid REFERENCES payable_items(id) ON DELETE SET NULL,
  related_sales_invoice_id uuid REFERENCES sales_invoices(id) ON DELETE SET NULL,
  deposited_at date,
  cashed_at date,
  returned_at date,
  return_reason text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checks_tenant ON checks_and_notes(tenant_id, direction, status);
CREATE INDEX IF NOT EXISTS idx_checks_due ON checks_and_notes(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_checks_payable ON checks_and_notes(related_payable_id);
CREATE INDEX IF NOT EXISTS idx_checks_sales ON checks_and_notes(related_sales_invoice_id);

-- Tahsilat hatırlatma kuralları + gönderilen mesaj logları
CREATE TABLE IF NOT EXISTS collection_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  days_after_due numeric(5) NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  subject text,
  body text NOT NULL,
  min_amount numeric(15, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collection_rules_tenant
  ON collection_reminder_rules(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS collection_reminder_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES collection_reminder_rules(id) ON DELETE CASCADE,
  sales_invoice_id uuid NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL,
  error_message text,
  dedupe_key text NOT NULL,
  rendered_body text,
  delivery_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_collection_reminder_dedup
  ON collection_reminder_runs(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_collection_reminders_invoice
  ON collection_reminder_runs(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_collection_reminders_tenant
  ON collection_reminder_runs(tenant_id, sent_at);
