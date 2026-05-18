-- Performance audit (B) — eksik index'ler.
-- Tüm index'ler IF NOT EXISTS, partial veya composite — sık query path'lerini
-- index seek'e döndürüyor, full scan'i siliyor.
--
-- Tahmini etki:
-- - /payables list 350ms → 30ms
-- - /sales-invoices list 200ms → 25ms
-- - dashboard cashflow 250ms → 25ms
-- - inbox 80ms → 12ms
-- - review-queue summary 350ms → 40ms
-- - auto-create company (import path) 50ms/row → 1ms/row
-- - push-failures 180ms → 8ms

-- #6 companies tax_number + lower(name) — auto-create-party.ts equality lookup
CREATE INDEX IF NOT EXISTS idx_companies_tax_number_org
  ON companies(organization_id, tax_number)
  WHERE tax_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_name_ci
  ON companies(organization_id, lower(name));

-- #7 payable_items list cursor: ORDER BY due_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_payable_tenant_due_created
  ON payable_items(tenant_id, due_date DESC NULLS LAST, created_at DESC);

-- #8 sales_invoices list cursor
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created
  ON sales_invoices(tenant_id, created_at DESC);

-- #9 payment_transactions dashboard cashflow
CREATE INDEX IF NOT EXISTS idx_payment_tenant_paid_at
  ON payment_transactions(tenant_id, paid_at DESC);

-- #10 notifications unread partial
CREATE INDEX IF NOT EXISTS idx_notif_unread_recent
  ON notifications(user_id, category, created_at DESC)
  WHERE read_at IS NULL;

-- #11 payable_items ERP push failures partial
CREATE INDEX IF NOT EXISTS idx_payable_push_failed
  ON payable_items(tenant_id, updated_at DESC)
  WHERE erp_push_status = 'failed';

-- #15 Review queue summary partial indexes (4 entity)
CREATE INDEX IF NOT EXISTS idx_payable_review_pending
  ON payable_items(tenant_id, created_at DESC)
  WHERE needs_review = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_sales_review_pending
  ON sales_invoices(tenant_id, created_at DESC)
  WHERE needs_review = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_companies_review_pending
  ON companies(organization_id, created_at DESC)
  WHERE needs_review = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_persons_review_pending
  ON persons(organization_id, created_at DESC)
  WHERE needs_review = true AND is_active = true;

-- BONUS: audit log target lookup (activity-timeline endpoint)
CREATE INDEX IF NOT EXISTS idx_audit_target
  ON audit_log(target_table, target_id);
