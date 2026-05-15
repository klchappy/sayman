-- Bütçe modülü
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category text NOT NULL,
  period_kind text NOT NULL DEFAULT 'monthly',
  period text NOT NULL,
  planned_amount numeric(15, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  alert_threshold_pct numeric(5, 2) NOT NULL DEFAULT 80,
  alerted_at timestamptz,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budgets_tenant ON budgets(tenant_id, period);
CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_tenant_category_period
  ON budgets(tenant_id, category, period);

-- Customer portal tokenleri
CREATE TABLE IF NOT EXISTS customer_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cari_account_id uuid NOT NULL REFERENCES cari_accounts(id) ON DELETE CASCADE,
  token text NOT NULL,
  label text,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  access_count numeric(10) NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  last_accessed_ip text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_portal_cari ON customer_portal_tokens(cari_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_portal_token ON customer_portal_tokens(token);
