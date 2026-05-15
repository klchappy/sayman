-- Demirbaş ve sabit kıymet
CREATE TABLE IF NOT EXISTS fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subsidiary_id uuid REFERENCES subsidiaries(id) ON DELETE SET NULL,
  code text,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  purchase_date date NOT NULL,
  purchase_cost numeric(18, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  useful_life_months numeric(5) NOT NULL,
  depreciation_method text NOT NULL DEFAULT 'linear',
  declining_rate_pct numeric(5, 2),
  salvage_value numeric(18, 2) NOT NULL DEFAULT 0,
  accumulated_depreciation numeric(18, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  disposed_at date,
  disposal_proceeds numeric(18, 2),
  location text,
  serial_no text,
  supplier_name text,
  related_payable_id uuid,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_tenant ON fixed_assets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON fixed_assets(category);

-- Aylık amortisman entry'leri
CREATE TABLE IF NOT EXISTS depreciation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  period text NOT NULL,
  depreciation_amount numeric(18, 2) NOT NULL,
  accumulated_depreciation numeric(18, 2) NOT NULL,
  book_value_after numeric(18, 2) NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_depreciation_asset ON depreciation_entries(asset_id, period);
CREATE UNIQUE INDEX IF NOT EXISTS uq_depreciation_asset_period
  ON depreciation_entries(asset_id, period);
