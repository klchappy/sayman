-- Sales invoices: alacak (gelir) tarafı
CREATE TABLE IF NOT EXISTS sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subsidiary_id uuid REFERENCES subsidiaries(id) ON DELETE SET NULL,
  customer_type text NOT NULL DEFAULT 'company',
  customer_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  customer_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  customer_name text,
  title text NOT NULL,
  invoice_number text,
  issue_date date,
  due_date date,
  amount numeric(15, 2) NOT NULL,
  paid_amount numeric(15, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'sent',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  erp_connection_id uuid,
  erp_external_id text,
  erp_push_status text,
  erp_pushed_at timestamptz,
  erp_push_error text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_due ON sales_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales_invoices(customer_company_id);
CREATE INDEX IF NOT EXISTS idx_sales_erp ON sales_invoices(erp_connection_id, erp_push_status);

-- Tax calendar: Türkiye'ye özgü vergi takvimi
CREATE TABLE IF NOT EXISTS tax_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  period text NOT NULL,
  due_date date NOT NULL,
  estimated_amount numeric(15, 2),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_calendar_tenant_due ON tax_calendar_events(tenant_id, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_calendar_kind_period
  ON tax_calendar_events(tenant_id, kind, period);

-- Stock items: ERP'den çekilen ürün stoğu
CREATE TABLE IF NOT EXISTS stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  code text,
  name text NOT NULL,
  unit text,
  quantity numeric(18, 3) NOT NULL DEFAULT 0,
  purchase_price numeric(18, 2),
  sale_price numeric(18, 2),
  currency text NOT NULL DEFAULT 'TRY',
  critical_threshold numeric(18, 3),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_tenant ON stock_items(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_external ON stock_items(connection_id, external_id);
CREATE INDEX IF NOT EXISTS idx_stock_name ON stock_items(name);
