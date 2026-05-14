/**
 * ERP adapter ortak tipler.
 *
 * Her muhasebe/ERP yazılımı kendi API'siyle gelir. Bu interface'i implemente
 * eden adapter, sayman'ın "standart" cari/movement/invoice formatına dönüştürür.
 */

export interface AdapterConfig {
  [key: string]: unknown;
}

export interface AdapterContext {
  tenantId: string;
  connectionId: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface NormalizedCariAccount {
  external_id: string;
  code?: string | null;
  name: string;
  account_type: 'customer' | 'supplier' | 'both';
  tax_id?: string | null;
  tax_office?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  balance: number;
  currency: string;
  raw_data?: Record<string, unknown>;
}

export interface NormalizedCariMovement {
  external_id: string;
  movement_date: string; // YYYY-MM-DD
  description?: string | null;
  document_no?: string | null;
  document_type?: 'invoice' | 'payment' | 'check' | 'note' | 'opening_balance' | 'other' | null;
  debit: number;
  credit: number;
  balance_after?: number | null;
  currency: string;
  raw_data?: Record<string, unknown>;
}

export interface ErpAdapter {
  /** Provider identifier */
  readonly provider: string;
  /** UI'de gösterilecek isim */
  readonly label: string;
  /** Hangi config alanları gerekli (form field metadata) */
  readonly configFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'select';
    required: boolean;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    help?: string;
  }>;

  /** Bağlantı testi — credentials doğru mu? */
  testConnection(config: AdapterConfig): Promise<TestResult>;

  /** Tüm cari hesapları çek */
  syncCariAccounts(
    config: AdapterConfig,
    ctx: AdapterContext,
  ): Promise<NormalizedCariAccount[]>;

  /** Tek bir cari için hareketleri çek (since: ISO date) */
  syncCariMovements(
    config: AdapterConfig,
    externalCariId: string,
    since: string | null,
    ctx: AdapterContext,
  ): Promise<NormalizedCariMovement[]>;
}
