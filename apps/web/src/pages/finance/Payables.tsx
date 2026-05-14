import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCode, Plus, Receipt, Sparkles } from 'lucide-react';
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

  const q = useQuery({
    queryKey: ['payables', active.orgSlug, active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: Payable[] }>('/payables');
      return res.data.data;
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
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Fatura
        </button>
      </header>

      {showForm && <PayableForm onClose={() => setShowForm(false)} />}

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">Bu tenant'ta henüz fatura yok.</p>
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
                    <span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
            <TextField label="Tutar *" value={amount} onChange={setAmount} placeholder="1234.50" />
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
