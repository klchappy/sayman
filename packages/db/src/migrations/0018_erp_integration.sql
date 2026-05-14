CREATE TABLE IF NOT EXISTS erp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  config_encrypted text NOT NULL,
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  sync_interval_hours numeric(4, 1) NOT NULL DEFAULT 1,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  sync_count numeric(10) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erp_connections_org ON erp_connections(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_erp_connections_tenant ON erp_connections(tenant_id);

CREATE TABLE IF NOT EXISTS erp_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  records_pulled numeric(10) NOT NULL DEFAULT 0,
  records_pushed numeric(10) NOT NULL DEFAULT 0,
  records_failed numeric(10) NOT NULL DEFAULT 0,
  duration_ms numeric(10),
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_connection ON erp_sync_logs(connection_id, started_at);

CREATE TABLE IF NOT EXISTS cari_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  code text,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'both',
  tax_id text,
  tax_office text,
  address text,
  phone text,
  email text,
  balance numeric(18, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cari_accounts_tenant ON cari_accounts(tenant_id, account_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cari_accounts_external ON cari_accounts(connection_id, external_id);
CREATE INDEX IF NOT EXISTS idx_cari_accounts_name ON cari_accounts(name);

CREATE TABLE IF NOT EXISTS cari_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  cari_account_id uuid NOT NULL REFERENCES cari_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  movement_date date NOT NULL,
  description text,
  document_no text,
  document_type text,
  debit numeric(18, 2) NOT NULL DEFAULT 0,
  credit numeric(18, 2) NOT NULL DEFAULT 0,
  balance_after numeric(18, 2),
  currency text NOT NULL DEFAULT 'TRY',
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cari_movements_account ON cari_movements(cari_account_id, movement_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cari_movements_external ON cari_movements(connection_id, external_id);
CREATE INDEX IF NOT EXISTS idx_cari_movements_tenant_date ON cari_movements(tenant_id, movement_date);
