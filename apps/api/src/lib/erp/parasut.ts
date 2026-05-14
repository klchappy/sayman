/**
 * Paraşüt adapter — REST API (OAuth2 password grant).
 *
 * API: https://api.parasut.com/
 * Docs: https://apidocs.parasut.com/
 *
 * Config alanları:
 *   client_id, client_secret  → Paraşüt'te uygulama oluşturulduğunda alınır
 *   username, password        → Paraşüt hesap bilgileri
 *   company_id                → /v1/{company_id}/contacts gibi path'lerde kullanılır
 *
 * Endpoint örnekleri:
 *   GET /v4/{company_id}/contacts                   → tüm cariler (paginated)
 *   GET /v4/{company_id}/contacts/{id}              → tek cari
 *   GET /v4/{company_id}/contacts/{id}/transactions → cari ekstresi
 *
 * Token OAuth2 password grant ile alınır, 7200s TTL.
 */
import type {
  AdapterConfig,
  ErpAdapter,
  NormalizedCariAccount,
  NormalizedCariMovement,
  TestResult,
} from './types';

const PARASUT_BASE = 'https://api.parasut.com';
const PAGE_SIZE = 50;

interface ParasutConfig extends AdapterConfig {
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
  company_id: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

interface ParasutListResponse<T> {
  data: T[];
  meta?: {
    total_count?: number;
    total_pages?: number;
    current_page?: number;
  };
}

interface ParasutContact {
  id: string;
  attributes: {
    name: string;
    short_name?: string;
    account_type: string;
    contact_type?: string;
    email?: string;
    phone?: string;
    address?: string;
    tax_office?: string;
    tax_number?: string;
    balance?: string;
    trl_balance?: string;
    [k: string]: unknown;
  };
}

interface ParasutTransaction {
  id: string;
  attributes: {
    description?: string;
    debit_currency?: string;
    debit_amount?: string;
    credit_currency?: string;
    credit_amount?: string;
    date?: string;
    transaction_kind?: string;
    transaction_id?: string;
    [k: string]: unknown;
  };
}

async function getToken(config: ParasutConfig): Promise<string> {
  const res = await fetch(`${PARASUT_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      client_id: config.client_id,
      client_secret: config.client_secret,
      username: config.username,
      password: config.password,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Paraşüt token alınamadı: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

function classifyAccountType(s?: string): 'customer' | 'supplier' | 'both' {
  if (!s) return 'both';
  const l = s.toLowerCase();
  if (l.includes('customer') || l.includes('musteri') || l.includes('müşteri')) return 'customer';
  if (l.includes('supplier') || l.includes('tedarikci') || l.includes('tedarikçi')) return 'supplier';
  return 'both';
}

function classifyDocType(
  kind?: string,
): NormalizedCariMovement['document_type'] {
  if (!kind) return 'other';
  const l = kind.toLowerCase();
  if (l.includes('sales_invoice') || l.includes('purchase_bill') || l.includes('invoice'))
    return 'invoice';
  if (l.includes('payment') || l.includes('collection') || l.includes('odeme'))
    return 'payment';
  if (l.includes('check') || l.includes('cek')) return 'check';
  if (l.includes('promissory') || l.includes('senet') || l.includes('note')) return 'note';
  if (l.includes('opening')) return 'opening_balance';
  return 'other';
}

export const parasutAdapter: ErpAdapter = {
  provider: 'parasut',
  label: 'Paraşüt',
  configFields: [
    {
      key: 'client_id',
      label: 'Client ID',
      type: 'text',
      required: true,
      help: 'Paraşüt → Ayarlar → Uygulamalar → yeni uygulama oluştur',
    },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    { key: 'username', label: 'Paraşüt e-posta', type: 'text', required: true },
    { key: 'password', label: 'Paraşüt şifre', type: 'password', required: true },
    {
      key: 'company_id',
      label: 'Şirket ID',
      type: 'text',
      required: true,
      help: 'Paraşüt URL\'sinde görünür: app.parasut.com/{COMPANY_ID}/dashboard',
    },
  ],

  async testConnection(config: AdapterConfig): Promise<TestResult> {
    try {
      const token = await getToken(config as ParasutConfig);
      const res = await fetch(
        `${PARASUT_BASE}/v4/${(config as ParasutConfig).company_id}/contacts?page[size]=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        return { ok: false, message: `API hatası: ${res.status}` };
      }
      const data = (await res.json()) as ParasutListResponse<ParasutContact>;
      return {
        ok: true,
        message: 'Bağlantı başarılı.',
        details: { contacts_count: data.meta?.total_count ?? '?' },
      };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  },

  async syncCariAccounts(config: AdapterConfig): Promise<NormalizedCariAccount[]> {
    const cfg = config as ParasutConfig;
    const token = await getToken(cfg);
    const all: NormalizedCariAccount[] = [];
    let page = 1;
    while (true) {
      const res = await fetch(
        `${PARASUT_BASE}/v4/${cfg.company_id}/contacts?page[size]=${PAGE_SIZE}&page[number]=${page}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Paraşüt contacts ${res.status}`);
      const data = (await res.json()) as ParasutListResponse<ParasutContact>;
      for (const c of data.data) {
        all.push({
          external_id: c.id,
          code: null,
          name: c.attributes.name || c.attributes.short_name || `Cari ${c.id}`,
          account_type: classifyAccountType(c.attributes.account_type),
          tax_id: c.attributes.tax_number ?? null,
          tax_office: c.attributes.tax_office ?? null,
          address: c.attributes.address ?? null,
          phone: c.attributes.phone ?? null,
          email: c.attributes.email ?? null,
          balance: Number(c.attributes.trl_balance ?? c.attributes.balance ?? 0),
          currency: 'TRY',
          raw_data: c.attributes,
        });
      }
      if (!data.meta?.total_pages || page >= data.meta.total_pages) break;
      page++;
      if (page > 100) break; // safety
    }
    return all;
  },

  async syncCariMovements(
    config: AdapterConfig,
    externalCariId: string,
    since: string | null,
  ): Promise<NormalizedCariMovement[]> {
    const cfg = config as ParasutConfig;
    const token = await getToken(cfg);
    const sinceFilter = since ? `&filter[date_after]=${since}` : '';
    const all: NormalizedCariMovement[] = [];
    let page = 1;
    while (true) {
      const res = await fetch(
        `${PARASUT_BASE}/v4/${cfg.company_id}/contacts/${externalCariId}/transactions?page[size]=${PAGE_SIZE}&page[number]=${page}${sinceFilter}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        if (res.status === 404) break;
        throw new Error(`Paraşüt transactions ${res.status}`);
      }
      const data = (await res.json()) as ParasutListResponse<ParasutTransaction>;
      for (const t of data.data) {
        const debit = Number(t.attributes.debit_amount ?? 0);
        const credit = Number(t.attributes.credit_amount ?? 0);
        all.push({
          external_id: `${externalCariId}:${t.id}`,
          movement_date: (t.attributes.date ?? '').slice(0, 10),
          description: t.attributes.description ?? null,
          document_no: t.attributes.transaction_id ?? null,
          document_type: classifyDocType(t.attributes.transaction_kind),
          debit,
          credit,
          balance_after: null,
          currency: t.attributes.debit_currency ?? t.attributes.credit_currency ?? 'TRY',
          raw_data: t.attributes,
        });
      }
      if (!data.meta?.total_pages || page >= data.meta.total_pages) break;
      page++;
      if (page > 100) break;
    }
    return all;
  },
};
