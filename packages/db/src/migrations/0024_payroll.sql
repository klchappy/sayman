-- Personel + Maaş bordrosu
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subsidiary_id uuid REFERENCES subsidiaries(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  tc_kimlik_no text,
  sgk_no text,
  hire_date date NOT NULL,
  termination_date date,
  gross_salary numeric(15, 2) NOT NULL,
  marital_status text NOT NULL DEFAULT 'single',
  kids_count numeric(2) NOT NULL DEFAULT 0,
  spouse_working boolean NOT NULL DEFAULT false,
  disability_degree numeric(1) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  department text,
  position text,
  iban text,
  email text,
  phone text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id, status);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_gross numeric(18, 2) NOT NULL DEFAULT 0,
  total_net numeric(18, 2) NOT NULL DEFAULT 0,
  total_sgk numeric(18, 2) NOT NULL DEFAULT 0,
  total_tax numeric(18, 2) NOT NULL DEFAULT 0,
  total_employer_cost numeric(18, 2) NOT NULL DEFAULT 0,
  employee_count numeric(5) NOT NULL DEFAULT 0,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant ON payroll_runs(tenant_id, period);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_runs_tenant_period
  ON payroll_runs(tenant_id, period);

CREATE TABLE IF NOT EXISTS payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  gross numeric(15, 2) NOT NULL,
  sgk_employee numeric(15, 2) NOT NULL DEFAULT 0,
  unemployment_employee numeric(15, 2) NOT NULL DEFAULT 0,
  income_tax numeric(15, 2) NOT NULL DEFAULT 0,
  stamp_tax numeric(15, 2) NOT NULL DEFAULT 0,
  agi numeric(15, 2) NOT NULL DEFAULT 0,
  additions numeric(15, 2) NOT NULL DEFAULT 0,
  deductions numeric(15, 2) NOT NULL DEFAULT 0,
  net numeric(15, 2) NOT NULL,
  sgk_employer numeric(15, 2) NOT NULL DEFAULT 0,
  unemployment_employer numeric(15, 2) NOT NULL DEFAULT 0,
  total_employer_cost numeric(15, 2) NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_items(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_items_run_employee
  ON payroll_items(run_id, employee_id);
