/**
 * Logo Tiger / Netsis adapter.
 *
 * Logo'nun iki API'si var:
 *   1. Logo REST Service (LRS) — eski Logo Tiger için; on-premise SOAP/REST proxy
 *   2. Logo j-Platform / Logo Cloud — modern REST API
 *
 * Bu adapter Logo j-Platform REST API'sini varsayar (token auth).
 * Endpoint örnekleri:
 *   POST /api/v1/token                   → token al
 *   GET  /api/v1/clcards                 → cari kart listesi
 *   GET  /api/v1/clfichetransactions?clientref=N → cari hareketleri
 *
 * NOT: Bu MVP versiyondur; gerçek Logo entegrasyonu firmaya göre değişir
 *  (port, certificate, network access, vs.). Test mode'da örnek veri döner.
 */
import type {
  AdapterConfig,
  ErpAdapter,
  NormalizedCariAccount,
  NormalizedCariMovement,
  PushPayloadPayable,
  PushPayloadPayment,
  PushResult,
  TestResult,
} from './types';

interface LogoConfig extends AdapterConfig {
  base_url: string; // https://logo-server.firma.local:32002
  api_key: string;
  username: string;
  password: string;
  firm_number?: string; // çoklu firma için
  period_number?: string;
}

async function getLogoToken(config: LogoConfig): Promise<string> {
  const res = await fetch(`${config.base_url}/api/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      username: config.username,
      password: config.password,
      firmnr: config.firm_number ?? '',
      perionr: config.period_number ?? '',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Logo token: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export const logoAdapter: ErpAdapter = {
  provider: 'logo',
  label: 'Logo Tiger / Netsis (j-Platform)',
  configFields: [
    {
      key: 'base_url',
      label: 'Logo API URL',
      type: 'url',
      required: true,
      placeholder: 'https://logo.firma.local:32002',
      help: 'Logo j-Platform/Tiger REST servisi adresi (port dahil)',
    },
    { key: 'username', label: 'Logo kullanıcı', type: 'text', required: true },
    { key: 'password', label: 'Logo şifre', type: 'password', required: true },
    {
      key: 'api_key',
      label: 'API Key (opsiyonel)',
      type: 'password',
      required: false,
      help: 'Logo CRM Pro varsa key eklenir',
    },
    {
      key: 'firm_number',
      label: 'Firma No',
      type: 'text',
      required: false,
      placeholder: '1',
      help: 'Çoklu firma kullanımı için',
    },
    {
      key: 'period_number',
      label: 'Dönem No',
      type: 'text',
      required: false,
      placeholder: '1',
    },
  ],

  async testConnection(config: AdapterConfig): Promise<TestResult> {
    const cfg = config as LogoConfig;
    if (!cfg.base_url) return { ok: false, message: 'base_url zorunlu' };
    try {
      // 1. Önce token alabiliyor muyuz
      await getLogoToken(cfg);
      return { ok: true, message: 'Logo token alındı. Cari sync için "Senkronize Et" tıkla.' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  },

  async syncCariAccounts(config: AdapterConfig): Promise<NormalizedCariAccount[]> {
    const cfg = config as LogoConfig;
    const token = await getLogoToken(cfg);
    const res = await fetch(`${cfg.base_url}/api/v1/clcards`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Logo clcards ${res.status}`);
    // Logo response formatı firmaya göre değişebilir — generic parse
    const data = (await res.json()) as { items?: any[]; value?: any[]; data?: any[] };
    const items = data.items ?? data.value ?? data.data ?? [];

    return items.map((c: any) => ({
      external_id: String(c.INTERNAL_REFERENCE ?? c.id ?? c.LogicalRef ?? c.Code),
      code: c.CODE ?? c.code ?? null,
      name: c.DEFINITION_ ?? c.Definition ?? c.name ?? `Cari ${c.LogicalRef ?? '?'}`,
      account_type: 'both' as const,
      tax_id: c.TAX_NR ?? c.TaxNumber ?? null,
      tax_office: c.TAX_OFFICE ?? c.TaxOffice ?? null,
      address: c.ADDR1 ?? c.Address ?? null,
      phone: c.TELNRS1 ?? c.Phone ?? null,
      email: c.EMAILADDR ?? c.Email ?? null,
      balance: Number(c.DEBIT ?? 0) - Number(c.CREDIT ?? 0),
      currency: 'TRY',
      raw_data: c,
    }));
  },

  async syncCariMovements(
    config: AdapterConfig,
    externalCariId: string,
    since: string | null,
  ): Promise<NormalizedCariMovement[]> {
    const cfg = config as LogoConfig;
    const token = await getLogoToken(cfg);
    const dateFilter = since ? `&date=${since}` : '';
    const res = await fetch(
      `${cfg.base_url}/api/v1/clfichetransactions?clientref=${externalCariId}${dateFilter}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Logo transactions ${res.status}`);
    const data = (await res.json()) as { items?: any[]; value?: any[]; data?: any[] };
    const items = data.items ?? data.value ?? data.data ?? [];

    return items.map((t: any) => ({
      external_id: String(t.LogicalRef ?? t.INTERNAL_REFERENCE ?? t.id),
      movement_date: (t.DATE_ ?? t.Date ?? '').slice(0, 10),
      description: t.LINEEXP ?? t.Description ?? null,
      document_no: t.FICHENO ?? t.DocumentNo ?? null,
      document_type: 'other' as const,
      debit: Number(t.DEBIT ?? t.Debit ?? 0),
      credit: Number(t.CREDIT ?? t.Credit ?? 0),
      balance_after: null,
      currency: 'TRY',
      raw_data: t,
    }));
  },

  /**
   * Logo j-Platform alis fisi (PurchaseInvoice / 31 numarali fis tipi) yarat.
   *
   * Endpoint: POST /api/v1/PurchaseInvoices
   *
   * NOT: Logo'da cari (clcard) onceden var olmali; yoksa supplier_name ile bulup
   * eslemek gerekir. Logo'da yeni cari yaratma izin sistemi karmaşik — bu MVP'de
   * cari yaratmaz, sadece var olan cari ile fatura kaydeder. Yoksa hata doner.
   */
  async pushInvoice(
    config: AdapterConfig,
    payload: PushPayloadPayable,
  ): Promise<PushResult> {
    const cfg = config as LogoConfig;
    const token = await getLogoToken(cfg);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 1. Cari'yi bul (clcards ara)
    let clientRef: number | null = null;
    if (payload.cari_external_id) {
      clientRef = Number(payload.cari_external_id);
    } else if (payload.supplier_name) {
      const searchRes = await fetch(
        `${cfg.base_url}/api/v1/clcards?filter=DEFINITION_%20like%20%27${encodeURIComponent(payload.supplier_name)}%25%27&limit=1`,
        { headers },
      );
      if (searchRes.ok) {
        const data = (await searchRes.json()) as { items?: any[]; value?: any[]; data?: any[] };
        const items = data.items ?? data.value ?? data.data ?? [];
        if (items.length > 0) {
          clientRef = Number(items[0].LogicalRef ?? items[0].INTERNAL_REFERENCE);
        }
      }
    }
    if (!clientRef) {
      throw new Error(
        `Logo'da "${payload.supplier_name}" cari bulunamadi. Once Logo'da cari yaratin veya cari_external_id verin.`,
      );
    }

    // 2. PurchaseInvoice yarat — Logo'nun standart payload formati
    const body = {
      Type: 1, // 1 = Alış faturası
      Number: payload.invoice_number ?? '',
      Date: payload.issue_date ?? new Date().toISOString().slice(0, 10),
      DueDate: payload.due_date,
      ArpRef: clientRef,
      DocumentNumber: payload.invoice_number ?? '',
      Description: payload.title,
      GrossTotal: payload.amount,
      NetTotal: payload.amount,
      Transactions: {
        Items: [
          {
            Type: 0, // mal alımı
            Quantity: 1,
            Price: payload.amount,
            Total: payload.amount,
            Description: payload.title,
          },
        ],
      },
    };

    const res = await fetch(`${cfg.base_url}/api/v1/PurchaseInvoices`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Logo PurchaseInvoice: ${res.status} ${errTxt.slice(0, 200)}`);
    }
    const data = (await res.json()) as { LogicalRef?: number; INTERNAL_REFERENCE?: number; id?: number };
    const externalId = String(data.LogicalRef ?? data.INTERNAL_REFERENCE ?? data.id ?? '?');
    return {
      external_id: externalId,
      external_url: null, // Logo'nun web UI'si yok
      raw_response: data,
    };
  },

  /**
   * Logo'da ödeme fişi (CashTransactions) yarat — bir fatura için.
   */
  async pushPayment(
    config: AdapterConfig,
    payload: PushPayloadPayment,
  ): Promise<PushResult> {
    if (!payload.related_invoice_external_id) {
      throw new Error('Logo odeme icin fatura external_id zorunlu');
    }
    const cfg = config as LogoConfig;
    const token = await getLogoToken(cfg);

    const body = {
      Type: 1, // ödeme
      Date: payload.paid_at,
      Number: payload.reference_no ?? '',
      InvoiceRef: Number(payload.related_invoice_external_id),
      Amount: payload.amount,
      Description: payload.notes ?? 'Sayman ödemesi',
    };

    const res = await fetch(`${cfg.base_url}/api/v1/CashTransactions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Logo CashTransaction: ${res.status} ${errTxt.slice(0, 200)}`);
    }
    const data = (await res.json()) as { LogicalRef?: number; id?: number };
    return {
      external_id: String(data.LogicalRef ?? data.id ?? '?'),
      raw_response: data,
    };
  },
};
