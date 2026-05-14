CREATE TABLE IF NOT EXISTS payment_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payable_id uuid NOT NULL REFERENCES payable_items(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  approver_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  amount numeric(18, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  method text NOT NULL,
  reference_no text,
  paid_at text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_approvals_tenant
  ON payment_approvals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_payable
  ON payment_approvals(payable_id);
