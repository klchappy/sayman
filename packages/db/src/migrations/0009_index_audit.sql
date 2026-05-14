-- ============================================================================
-- Migration 0009 — DB index audit (sik kullanilan filter/sort kolonlari)
-- Mevcut indexlere ek olarak performans icin:
-- ============================================================================

-- Notifications: kullanici uzerinde okunmamis count icin partial index
CREATE INDEX IF NOT EXISTS "idx_notif_user_unread"
  ON "notifications" ("user_id", "created_at" DESC)
  WHERE "read_at" IS NULL AND "dismissed_at" IS NULL;
--> statement-breakpoint

-- Audit log: actor + tarih sirali listeleme
CREATE INDEX IF NOT EXISTS "idx_audit_actor_time"
  ON "audit_log" ("actor_id", "created_at" DESC);
--> statement-breakpoint

-- Audit log: org + action filtreleme
CREATE INDEX IF NOT EXISTS "idx_audit_org_action"
  ON "audit_log" ("organization_id", "action", "created_at" DESC);
--> statement-breakpoint

-- Payables: tenant + due_date (vade yaklaşanlar/geciken sorgu)
CREATE INDEX IF NOT EXISTS "idx_payable_tenant_due"
  ON "payable_items" ("tenant_id", "due_date")
  WHERE "is_active" = true;
--> statement-breakpoint

-- Payables: status filtreleme (overdue/approaching sweep)
CREATE INDEX IF NOT EXISTS "idx_payable_status"
  ON "payable_items" ("tenant_id", "status")
  WHERE "is_active" = true;
--> statement-breakpoint

-- Payment transactions: paid_at sirali rapor
CREATE INDEX IF NOT EXISTS "idx_payment_tx_paid"
  ON "payment_transactions" ("tenant_id", "paid_at" DESC);
--> statement-breakpoint

-- Subscriptions: commitment_end_date (T-60/T-30/T-7 reminder taramasi)
CREATE INDEX IF NOT EXISTS "idx_subs_commitment_active"
  ON "subscriptions" ("commitment_end_date")
  WHERE "is_active" = true AND "status" = 'active';
--> statement-breakpoint

-- Guarantees: expiry_date (T-60/T-30/T-7 + status sweep)
CREATE INDEX IF NOT EXISTS "idx_guarantee_expiry_active"
  ON "guarantees" ("expiry_date")
  WHERE "is_active" = true AND "status" = 'active';
--> statement-breakpoint

-- Regular payment periods: due_date status filter
CREATE INDEX IF NOT EXISTS "idx_rp_periods_due_status"
  ON "regular_payment_periods" ("due_date", "status");
--> statement-breakpoint

-- Official payment periods: due_date status filter
CREATE INDEX IF NOT EXISTS "idx_op_periods_due_status"
  ON "official_payment_periods" ("due_date", "status");
--> statement-breakpoint

-- Attachments: hizli liste (related lookup zaten var, ek olarak tenant)
CREATE INDEX IF NOT EXISTS "idx_attachments_tenant_created"
  ON "attachments" ("tenant_id", "created_at" DESC);
--> statement-breakpoint

-- Api tokens: hash lookup zaten unique; last_used_at sort icin
CREATE INDEX IF NOT EXISTS "idx_api_tokens_account_active"
  ON "api_tokens" ("account_id", "last_used_at" DESC)
  WHERE "revoked_at" IS NULL;
--> statement-breakpoint

-- Subsidiaries: parent traversal optimizasyonu
CREATE INDEX IF NOT EXISTS "idx_subsidiaries_active"
  ON "subsidiaries" ("tenant_id")
  WHERE "is_active" = true;
