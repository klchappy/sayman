import { pgEnum } from 'drizzle-orm/pg-core';

// --- Plan / Sektör / Rol (shared package'taki const'larla eşleşir) ---------

export const planEnum = pgEnum('plan', ['trial', 'basic', 'pro', 'enterprise']);

export const sectorEnum = pgEnum('sector', [
  'tekstil',
  'enerji',
  'insaat',
  'gayrimenkul',
  'kisisel',
  'sanayi',
  'hukuk',
  'diger',
]);

export const roleEnum = pgEnum('role', [
  'super_admin',
  'yonetici',
  'muhasebe_muduru',
  'muhasebeci',
  'personel',
  'goruntuleyici',
]);

/** UserTenantOverride.value — Role + 'deny' (tenant erişimini iptal et) */
export const tenantOverrideValueEnum = pgEnum('tenant_override_value', [
  'super_admin',
  'yonetici',
  'muhasebe_muduru',
  'muhasebeci',
  'personel',
  'goruntuleyici',
  'deny',
]);

// --- Fatura / Ödeme --------------------------------------------------------

export const ownerTypeEnum = pgEnum('owner_type', ['company', 'person', 'family', 'other']);

export const payableStatusEnum = pgEnum('payable_status', [
  'draft',
  'pending',
  'approaching',
  'overdue',
  'partial_paid',
  'paid',
  'cancelled',
  'archived',
  'needs_review',
  'waiting_approval',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'auto',
  'eft',
  'havale',
  'credit_card',
  'cash',
  'elden',
  'other',
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'cancelled',
]);

// --- Audit -----------------------------------------------------------------

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'archive',
  'restore',
  'login',
  'logout',
  'import',
  'export',
  'permission_change',
]);
