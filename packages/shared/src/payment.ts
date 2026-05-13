/**
 * Sayman — fatura/ödeme enum'ları (Django seed `apps.finance.models` karşılığı).
 */
import { z } from 'zod';

export const PAYABLE_STATUSES = [
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
] as const;
export type PayableStatus = (typeof PAYABLE_STATUSES)[number];
export const payableStatusSchema = z.enum(PAYABLE_STATUSES);

export const PAYMENT_METHODS = [
  'auto',
  'eft',
  'havale',
  'credit_card',
  'cash',
  'elden',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const OWNER_TYPES = ['company', 'person', 'family', 'other'] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];
export const ownerTypeSchema = z.enum(OWNER_TYPES);

export const TRANSACTION_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export const transactionStatusSchema = z.enum(TRANSACTION_STATUSES);

/**
 * Faz 4 onaylı tutar eşikleri (Django D-008/D-011/D-021 kararları).
 * Bu sabitler; tenants tablosunda override edilebilir (settings JSON).
 */
export const PAYMENT_THRESHOLDS = {
  /** Bu üstü dekont zorunlu */
  DEKONT_REQUIRED: 5_000,
  /** Bu üstü çift onay gerekli */
  DOUBLE_APPROVAL: 50_000,
} as const;
