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

export interface PushPayloadPayable {
  /** Sayman payable id (debugging için) */
  payable_id: string;
  /** Tedarikçi cari adı — eşleştirme için */
  supplier_name?: string | null;
  /** Eğer cari hesap zaten eşleşmişse */
  cari_external_id?: string | null;
  title: string;
  invoice_number?: string | null;
  amount: number;
  currency: string;
  issue_date?: string | null;
  due_date?: string | null;
  category?: string | null;
  notes?: string | null;
}

export interface PushPayloadPayment {
  payment_id: string;
  /** Hangi ERP faturasına bağlanacak (Sayman'da push edilmişse external_id var) */
  related_invoice_external_id?: string | null;
  paid_at: string;
  amount: number;
  currency: string;
  method?: string | null;
  reference_no?: string | null;
  notes?: string | null;
}

export interface PushResult {
  external_id: string;
  external_url?: string | null;
  raw_response?: unknown;
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

  /** Push: Sayman payable'ı ERP'ye fatura/alış faturası olarak yarat */
  pushInvoice?(
    config: AdapterConfig,
    payload: PushPayloadPayable,
    ctx: AdapterContext,
  ): Promise<PushResult>;

  /** Push: Sayman ödeme transaction'ı ERP'ye tahsilat/ödeme olarak yarat */
  pushPayment?(
    config: AdapterConfig,
    payload: PushPayloadPayment,
    ctx: AdapterContext,
  ): Promise<PushResult>;
}
