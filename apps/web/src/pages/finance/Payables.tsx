import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  FileCode,
  FileSpreadsheet,
  Plus,
  Receipt,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  OWNER_TYPES,
  PAYMENT_METHODS,
  type PayableStatus,
} from '@sayman/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useSubsidiaries } from '../../lib/use-subsidiaries';

interface Payable {
  id: string;
  title: string;
  invoice_number: string | null;
  period_label: string | null;
  due_date: string | null;
  amount: string;
  paid_amount: string;
  currency: string;
  status: PayableStatus;
}

interface SemanticHit {
  id: string;
  title: string;
  amount: string;
  due_date: string | null;
  status: PayableStatus;
  supplier_name: string | null;
  category: string | null;
  similarity: number;
}

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

const STATUS_LABEL: Record<PayableStatus, string> = {
  draft: 'Taslak',
  pending: 'Bekliyor',
  approaching: 'Yaklaşıyor',
  overdue: 'Geciken',
  partial_paid: 'Kısmi',
  paid: 'Ödendi',
  cancelled: 'İptal',
  archived: 'Arşiv',
  needs_review: 'Kontrol',
  waiting_approval: 'Onay Bek.',
};
const STATUS_BADGE: Record<PayableStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  partial_paid: 'bg-amber-100 text-amber-700',
  pending: 'bg-blue-100 text-blue-700',
  approaching: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  draft: 'bg-brand-100 text-brand-700',
  cancelled: 'bg-brand-100 text-brand-500',
  archived: 'bg-brand-100 text-brand-500',
  needs_review: 'bg-amber-100 text-amber-700',
  waiting_approval: 'bg-blue-100 text-blue-700',
};

export function PayablesPage() {
  const active = useAuth((s) => s.active);
  const [showForm, setShowForm] = useState(false);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticInput, setSemanticInput] = useState('');

  const q = useQuery({
    queryKey: ['payables', active.orgSlug, active.tenantSlug],
    enabled: !!active.tenantSlug && !semanticQuery,
    queryFn: async () => {
      const res = await api.get<{ data: Payable[] }>('/payables');
      return res.data.data;
    },
  });

  const semanticQ = useQuery<SemanticHit[] | { error: string }>({
    queryKey: ['payables-semantic', active.tenantSlug, semanticQuery],
    enabled: !!active.tenantSlug && !!semanticQuery,
    queryFn: async () => {
      try {
        const res = await api.get<{ data: SemanticHit[] }>(
          `/search/semantic?q=${encodeURIComponent(semanticQuery)}&limit=30`,
        );
        return res.data.data;
      } catch (e) {
        const err = e as { response?: { data?: { error?: string; message?: string } } };
        return {
          error:
            err.response?.data?.message ??
            err.response?.data?.error ??
            (e as Error).message,
        };
      }
    },
  });

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşedeki seçiciden bir sektör (tenant) seç.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
            {active.orgSlug} / {active.tenantSlug}
          </p>
          <h1 className="text-2xl font-semibold text-brand-900">Faturalar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const r = await api.get<Blob>('/export/payables.xlsx', { responseType: 'blob' });
              const url = URL.createObjectURL(r.data);
              const a = document.createElement('a');
              a.href = url;
              a.download = `faturalar-${new Date().toISOString().slice(0, 10)}.xlsx`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 border border-brand-200 hover:bg-brand-50 dark:hover:bg-slate-800 dark:border-slate-700 text-brand-700 dark:text-slate-300 px-3 py-2 rounded-lg text-sm"
            title="Excel olarak indir"
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="size-4" />
            Yeni Fatura
          </button>
        </div>
      </header>

      {showForm && <PayableForm onClose={() => setShowForm(false)} />}

      {/* Semantic search bar */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Brain className="size-4 text-purple-600" />
          <span className="text-xs font-medium text-purple-700 uppercase tracking-wide">
            Anlamsal Arama
          </span>
          <input
            type="text"
            value={semanticInput}
            onChange={(e) => setSemanticInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSemanticQuery(semanticInput.trim());
            }}
            placeholder='Örn: "internet faturası", "geçen ay yüksek olan", "kira ödemesi"'
            className="flex-1 min-w-[200px] rounded-lg border border-brand-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={() => setSemanticQuery(semanticInput.trim())}
            disabled={semanticInput.trim().length < 2}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
          >
            <Search className="size-3" />
            Ara
          </button>
          {semanticQuery && (
            <button
              onClick={() => {
                setSemanticQuery('');
                setSemanticInput('');
              }}
              className="text-xs text-brand-500 hover:text-brand-900 px-2 py-1.5 rounded flex items-center gap-1"
            >
              <X className="size-3" />
              Temizle
            </button>
          )}
        </div>
        {semanticQuery && Array.isArray(semanticQ.data) && (
          <p className="text-[10px] text-brand-400 mt-2">
            "{semanticQuery}" için {semanticQ.data.length} eşleşme · Voyage AI embeddings
          </p>
        )}
        {semanticQuery && semanticQ.data && !Array.isArray(semanticQ.data) && (
          <p className="text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded">
            ⚠️ {semanticQ.data.error} — VOYAGE_API_KEY .env'e eklenip API restart edilince aktif olur.
          </p>
        )}
      </div>

      <div className="card overflow-x-auto">
        {semanticQuery ? (
          <SemanticResults result={semanticQ.data} loading={semanticQ.isLoading} />
        ) : (
          <>
            {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
            {q.data?.length === 0 && (
              <p className="text-brand-500 text-sm py-6 text-center">
                Bu tenant'ta henüz fatura yok.
              </p>
            )}
            {q.data && q.data.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                    <th className="py-2 px-2">Başlık</th>
                    <th className="py-2 px-2">Fatura No</th>
                    <th className="py-2 px-2">Dönem</th>
                    <th className="py-2 px-2">Vade</th>
                    <th className="py-2 px-2 text-right">Tutar</th>
                    <th className="py-2 px-2 text-right">Ödenen</th>
                    <th className="py-2 px-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((p) => (
                    <tr key={p.id} className="border-b border-brand-50 hover:bg-brand-50">
                      <td className="py-2 px-2 font-medium text-brand-900 flex items-center gap-2">
                        <Receipt className="size-4 text-brand-400" />
                        <Link to={`/payables/${p.id}`} className="hover:text-brand-700">
                          {p.title}
                        </Link>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs text-brand-600">
                        {p.invoice_number ?? '-'}
                      </td>
                      <td className="py-2 px-2 text-brand-700">{p.period_label ?? '-'}</td>
                      <td className="py-2 px-2 text-brand-700">{p.due_date ?? '-'}</td>
                      <td className="py-2 px-2 font-mono text-right">{fmtTRY(p.amount)}</td>
                      <td className="py-2 px-2 font-mono text-right text-emerald-700">
                        {fmtTRY(p.paid_amount)}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`badge ${STATUS_BADGE[p.status]}`}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SemanticResults({
  result,
  loading,
}: {
  result: SemanticHit[] | { error: string } | undefined;
  loading: boolean;
}) {
  if (loading) return <p className="text-brand-500 text-sm py-6 text-center">Aranıyor…</p>;
  if (!result) return null;
  if (!Array.isArray(result)) {
    return (
      <p className="text-brand-500 text-sm py-6 text-center">
        Anlamsal arama şu an kullanılamıyor.
      </p>
    );
  }
  if (result.length === 0) {
    return (
      <p className="text-brand-500 text-sm py-6 text-center">
        Eşleşme bulunamadı. Daha kısa bir ifade dene.
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
          <th className="py-2 px-2">Başlık</th>
          <th className="py-2 px-2">Tedarikçi</th>
          <th className="py-2 px-2">Vade</th>
          <th className="py-2 px-2 text-right">Tutar</th>
          <th className="py-2 px-2 text-right">Benzerlik</th>
        </tr>
      </thead>
      <tbody>
        {result.map((h) => (
          <tr key={h.id} className="border-b border-brand-50 hover:bg-purple-50/30">
            <td className="py-2 px-2 font-medium text-brand-900">
              <Link to={`/payables/${h.id}`} className="hover:text-brand-700">
                {h.title}
              </Link>
              {h.category && (
                <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                  {h.category}
                </span>
              )}
            </td>
            <td className="py-2 px-2 text-brand-700">{h.supplier_name ?? '-'}</td>
            <td className="py-2 px-2 text-brand-700">{h.due_date ?? '-'}</td>
            <td className="py-2 px-2 font-mono text-right">{fmtTRY(h.amount)}</td>
            <td className="py-2 px-2 text-right">
              <span className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-mono">
                {(h.similarity * 100).toFixed(0)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PayableForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const subsidiariesQ = useSubsidiaries();
  const [title, setTitle] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [period, setPeriod] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [ownerType, setOwnerType] = useState<(typeof OWNER_TYPES)[number]>('company');
  const [expectedMethod, setExpectedMethod] = useState<(typeof PAYMENT_METHODS)[number] | ''>('');
  const [subsidiaryId, setSubsidiaryId] = useState('');
  const [autoFillStatus, setAutoFillStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // e-Fatura XML auto-fill
  async function onXmlSelected(file: File) {
    setAutoFillStatus('XML okunuyor…');
    setError(null);
    try {
      const xml = await file.text();
      const res = await api.post<{ data: { parsed: any } }>('/efatura/parse', { xml });
      const p = res.data.data.parsed;
      if (p.invoice_number) setInvoiceNo(p.invoice_number);
      if (p.supplier_name) {
        setSupplierName(p.supplier_name);
        setTitle(`${p.supplier_name} — Fatura`);
      }
      if (p.issue_date) setIssueDate(p.issue_date);
      if (p.due_date) setDueDate(p.due_date);
      if (p.amount) setAmount(p.amount);
      setAutoFillStatus(`✓ ${file.name} (${p.invoice_number}) form'a yüklendi`);
    } catch (e) {
      setAutoFillStatus(null);
      setError(`XML parse: ${(e as Error).message}`);
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/payables', {
        title,
        supplier_name: supplierName || null,
        invoice_number: invoiceNo || null,
        period_label: period || null,
        issue_date: issueDate || null,
        due_date: dueDate || null,
        amount,
        owner_type: ownerType,
        expected_method: expectedMethod || null,
        subsidiary_id: subsidiaryId || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payables'] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-brand-900 mb-4 flex items-center gap-2">
          <Receipt className="size-5" />
          Yeni Fatura
        </h3>

        {/* Auto-fill — e-Fatura XML */}
        <div className="mb-4 border border-dashed border-brand-200 rounded-lg p-3 bg-brand-50/50">
          <div className="flex items-center gap-2 text-xs text-brand-600 mb-2">
            <Sparkles className="size-3.5" />
            <strong>Otomatik doldur</strong> — e-Fatura UBL XML seç, alanlar otomatik dolar
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-brand-200 hover:border-brand-400 rounded text-xs cursor-pointer">
            <FileCode className="size-4" />
            <span>XML Seç</span>
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onXmlSelected(f);
              }}
              className="hidden"
            />
          </label>
          {autoFillStatus && (
            <p className="text-xs text-emerald-700 mt-2">{autoFillStatus}</p>
          )}
        </div>

        <div className="space-y-3">
          <TextField label="Başlık *" value={title} onChange={setTitle} placeholder="Elektrik Faturası" />
          <TextField label="Tedarikçi Adı" value={supplierName} onChange={setSupplierName} placeholder="Türk Telekom" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Fatura No" value={invoiceNo} onChange={setInvoiceNo} />
            <TextField label="Dönem" value={period} onChange={setPeriod} placeholder="2026-05" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Düzenleme" value={issueDate} onChange={setIssueDate} placeholder="2026-05-01" />
            <TextField label="Vade Tarihi" value={dueDate} onChange={setDueDate} placeholder="2026-05-30" />
            <VatField amount={amount} onChange={setAmount} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Sahip"
              value={ownerType}
              onChange={(v) => setOwnerType(v as typeof ownerType)}
              options={OWNER_TYPES.map((v) => ({ value: v, label: v }))}
            />
            <SelectField
              label="Beklenen Yöntem"
              value={expectedMethod}
              onChange={(v) => setExpectedMethod(v as typeof expectedMethod)}
              options={[{ value: '', label: '-' }, ...PAYMENT_METHODS.map((v) => ({ value: v, label: v }))]}
            />
          </div>
          {(subsidiariesQ.data?.length ?? 0) > 0 && (
            <SelectField
              label="Yan Şirket / Şube (ops.)"
              value={subsidiaryId}
              onChange={setSubsidiaryId}
              options={[
                { value: '', label: '— (tenant kökü)' },
                ...(subsidiariesQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!title) return setError('Başlık zorunlu');
                if (!amount || isNaN(Number(amount))) return setError('Geçerli bir tutar gir');
                create.mutate();
              }}
              disabled={create.isPending}
              className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {create.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VatField({
  amount,
  onChange,
}: {
  amount: string;
  onChange: (v: string) => void;
}) {
  const [vatRate, setVatRate] = useState(20);
  const num = Number(amount);
  const valid = !isNaN(num) && num > 0;
  const net = valid ? num / (1 + vatRate / 100) : 0;
  const vat = valid ? num - net : 0;

  function addVat() {
    if (!valid) return;
    onChange((num * (1 + vatRate / 100)).toFixed(2));
  }
  function stripVat() {
    if (!valid) return;
    onChange((num / (1 + vatRate / 100)).toFixed(2));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-brand-500">Tutar *</span>
        <div className="flex items-center gap-1">
          <select
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value))}
            className="text-[10px] bg-brand-50 dark:bg-slate-800 text-brand-700 dark:text-slate-300 px-1 py-0.5 rounded border border-brand-200 dark:border-slate-700"
            title="KDV oranı"
          >
            <option value="1">%1</option>
            <option value="10">%10</option>
            <option value="20">%20</option>
          </select>
          <button
            type="button"
            onClick={addVat}
            disabled={!valid}
            className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded disabled:opacity-40"
            title={`Tutara %${vatRate} KDV ekle`}
          >
            +KDV
          </button>
          <button
            type="button"
            onClick={stripVat}
            disabled={!valid}
            className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded disabled:opacity-40"
            title={`Tutardan %${vatRate} KDV düş`}
          >
            -KDV
          </button>
        </div>
      </div>
      <input
        type="text"
        value={amount}
        onChange={(e) => onChange(e.target.value)}
        placeholder="1234.50"
        className="mt-1 w-full rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      {valid && (
        <p className="text-[10px] text-brand-400 mt-1 font-mono">
          Net: {net.toFixed(2)} · KDV: {vat.toFixed(2)} · Brüt: {num.toFixed(2)}
        </p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-brand-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-brand-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
