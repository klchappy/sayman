/**
 * /review-queue — Smart import / e-Fatura / inbound webhook ile otomatik yaratılan
 * kayıtların doğrulama sayfası.
 *
 * 4 tip: companies, persons, payables (alacak faturalar), sales_invoices (kestiğimiz)
 * Her kayıt için: onayla (kalsın) veya reddet (DB'den sil).
 * Şirket kayıtları için: düzenle, birleştir, birleştir + sil seçenekleri de var.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Edit3,
  FileText,
  Loader2,
  Merge,
  Receipt,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

interface OrgTenant {
  id: string;
  slug: string;
  name: string;
  sector: string;
  tax_number: string | null;
}

interface ReviewCompany {
  type: 'company';
  id: string;
  name: string;
  short_name: string | null;
  tax_number: string | null;
  registry_number: string | null;
  source: string | null;
  created_at: string | null;
  usage_count: number;
  first_usage: string | null;
  last_usage: string | null;
  total_volume: number;
}

interface ReviewPerson {
  type: 'person';
  id: string;
  full_name: string;
  national_id: string | null;
  phone: string | null;
  source: string | null;
  created_at: string | null;
}

interface ReviewPayable {
  type: 'payable';
  id: string;
  title: string;
  invoice_number: string | null;
  supplier_name: string | null;
  company_id: string | null;
  issue_date: string | null;
  due_date: string | null;
  amount: string;
  currency: string;
  category: string | null;
  source: string | null;
  created_at: string | null;
}

interface ReviewSalesInvoice {
  type: 'sales_invoice';
  id: string;
  title: string;
  invoice_number: string | null;
  customer_name: string | null;
  customer_company_id: string | null;
  customer_person_id: string | null;
  issue_date: string | null;
  due_date: string | null;
  amount: string;
  currency: string;
  source: string | null;
  created_at: string | null;
}

interface ReviewQueueData {
  companies: ReviewCompany[];
  persons: ReviewPerson[];
  payables: ReviewPayable[];
  sales_invoices: ReviewSalesInvoice[];
}

function fmtTRY(v: number | string) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);
}

const SOURCE_LABEL: Record<string, string> = {
  efatura: 'e-Fatura',
  efatura_auto_routed: 'e-Fatura (otomatik route)',
  efatura_ubl: 'e-Fatura UBL',
  csv_import: 'CSV Import',
  smart_import: 'Akıllı Yükleme',
  smart_import_zip: 'ZIP Akıllı Yükleme',
  smart_import_zip_auto_routed: 'ZIP (otomatik route)',
  smart_import_rar: 'RAR Akıllı Yükleme',
  smart_import_rar_auto_routed: 'RAR (otomatik route)',
  inbound_webhook: 'Webhook',
  inbound_webhook_xml: 'Webhook XML',
  erp_sync: 'ERP Senkron',
  manual: 'Manuel',
};

type Tab = 'payables' | 'sales_invoices' | 'companies' | 'persons';

export function ReviewQueuePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('payables');

  const q = useQuery({
    queryKey: ['review-queue'],
    queryFn: async () => {
      const res = await api.get<{ data: ReviewQueueData }>('/review-queue');
      return res.data.data;
    },
  });

  const approve = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) =>
      api.post(`/review-queue/${type}/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  });

  const reject = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) =>
      api.delete(`/review-queue/${type}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  });

  const counts = {
    payables: q.data?.payables.length ?? 0,
    sales_invoices: q.data?.sales_invoices.length ?? 0,
    companies: q.data?.companies.length ?? 0,
    persons: q.data?.persons.length ?? 0,
  };
  const total = counts.payables + counts.sales_invoices + counts.companies + counts.persons;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Doğrulama</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <AlertTriangle className="size-6 text-amber-600" />
          Onay Bekleyenler
          {total > 0 && (
            <span className="text-base bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded">
              {total}
            </span>
          )}
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Akıllı yükleme, e-Fatura import veya inbound webhook ile otomatik yaratılan kayıtlar.
          <strong className="text-brand-700 dark:text-slate-300"> Onayla</strong> → kayıt aktif olur ve
          ilgili şirketin verisine işlenir. <strong className="text-red-600">Reddet</strong> → kayıt DB'den
          tamamen silinir, hiçbir yerde görünmez.
        </p>
      </header>

      <div className="flex border-b border-brand-100 dark:border-slate-800 mb-4 flex-wrap">
        <TabBtn
          icon={<Receipt className="size-4" />}
          label="Gelen Faturalar"
          active={tab === 'payables'}
          count={counts.payables}
          onClick={() => setTab('payables')}
        />
        <TabBtn
          icon={<FileText className="size-4" />}
          label="Satış Faturaları"
          active={tab === 'sales_invoices'}
          count={counts.sales_invoices}
          onClick={() => setTab('sales_invoices')}
        />
        <TabBtn
          icon={<Building2 className="size-4" />}
          label="Şirketler"
          active={tab === 'companies'}
          count={counts.companies}
          onClick={() => setTab('companies')}
        />
        <TabBtn
          icon={<User className="size-4" />}
          label="Şahıslar"
          active={tab === 'persons'}
          count={counts.persons}
          onClick={() => setTab('persons')}
        />
      </div>

      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}

      {tab === 'payables' && (
        <Section
          empty={!q.data || q.data.payables.length === 0}
          emptyMsg="Bekleyen gelen faturası yok."
          emptyHint="Akıllı yükleme veya e-Fatura ile gelen faturalar burada listelenir."
        >
          {q.data?.payables.map((p) => (
            <PayableReviewCard
              key={p.id}
              item={p}
              onApprove={() => approve.mutate({ type: 'payable', id: p.id })}
              onReject={() => reject.mutate({ type: 'payable', id: p.id })}
              busy={approve.isPending || reject.isPending}
            />
          ))}
        </Section>
      )}

      {tab === 'sales_invoices' && (
        <Section
          empty={!q.data || q.data.sales_invoices.length === 0}
          emptyMsg="Bekleyen satış faturası yok."
          emptyHint="Otomatik akışla yaratılan kestiğimiz faturalar burada listelenir."
        >
          {q.data?.sales_invoices.map((s) => (
            <SalesInvoiceReviewCard
              key={s.id}
              item={s}
              onApprove={() => approve.mutate({ type: 'sales_invoice', id: s.id })}
              onReject={() => reject.mutate({ type: 'sales_invoice', id: s.id })}
              busy={approve.isPending || reject.isPending}
            />
          ))}
        </Section>
      )}

      {tab === 'companies' && (
        <Section
          empty={!q.data || q.data.companies.length === 0}
          emptyMsg="Bekleyen şirket doğrulaması yok."
          emptyHint="Akıllı yükleme veya ERP sync ile otomatik yaratılan tedarikçiler burada görünür."
        >
          {q.data?.companies.map((c) => (
            <CompanyReviewCard
              key={c.id}
              company={c}
              onApprove={() => approve.mutate({ type: 'company', id: c.id })}
              onReject={() => reject.mutate({ type: 'company', id: c.id })}
              busy={approve.isPending || reject.isPending}
            />
          ))}
        </Section>
      )}

      {tab === 'persons' && (
        <Section
          empty={!q.data || q.data.persons.length === 0}
          emptyMsg="Bekleyen şahıs doğrulaması yok."
        >
          {q.data?.persons.map((p) => (
            <PersonReviewCard
              key={p.id}
              person={p}
              onApprove={() => approve.mutate({ type: 'person', id: p.id })}
              onReject={() => reject.mutate({ type: 'person', id: p.id })}
              busy={approve.isPending || reject.isPending}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function TabBtn({
  icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 flex items-center gap-2 ${
        active
          ? 'border-brand-900 dark:border-brand-300 text-brand-900 dark:text-slate-100 font-medium'
          : 'border-transparent text-brand-500 hover:text-brand-700'
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 rounded">
          {count}
        </span>
      )}
    </button>
  );
}

function Section({
  empty,
  emptyMsg,
  emptyHint,
  children,
}: {
  empty: boolean;
  emptyMsg: string;
  emptyHint?: string;
  children: React.ReactNode;
}) {
  if (empty) {
    return (
      <div className="card text-center py-12">
        <CheckCircle2 className="size-12 mx-auto text-emerald-500 mb-2" />
        <p className="text-brand-700 dark:text-slate-300 font-medium">{emptyMsg}</p>
        {emptyHint && (
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">{emptyHint}</p>
        )}
      </div>
    );
  }
  return <div className="space-y-2">{children}</div>;
}

function ApproveRejectButtons({
  onApprove,
  onReject,
  busy,
  rejectConfirm,
}: {
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
  rejectConfirm: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          if (confirm(rejectConfirm)) onReject();
        }}
        disabled={busy}
        className="text-xs bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-50"
      >
        <Trash2 className="size-3" />
        Reddet
      </button>
      <button
        onClick={onApprove}
        disabled={busy}
        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-50"
      >
        <CheckCircle2 className="size-3" />
        Onayla
      </button>
    </div>
  );
}

function PayableReviewCard({
  item,
  onApprove,
  onReject,
  busy,
}: {
  item: ReviewPayable;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Receipt className="size-4 text-brand-500" />
            <h3 className="font-semibold text-brand-900 dark:text-slate-100">{item.title}</h3>
            {item.invoice_number && (
              <span className="text-[10px] font-mono bg-brand-100 dark:bg-slate-800 text-brand-700 dark:text-slate-300 px-2 py-0.5 rounded">
                #{item.invoice_number}
              </span>
            )}
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
              {SOURCE_LABEL[item.source ?? ''] ?? item.source ?? 'auto'}
            </span>
          </div>
          {item.supplier_name && (
            <p className="text-sm text-brand-700 dark:text-slate-300">
              Tedarikçi: <strong>{item.supplier_name}</strong>
            </p>
          )}
          <div className="grid sm:grid-cols-4 gap-3 mt-2 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-brand-400">Tutar</p>
              <p className="font-mono text-brand-900 dark:text-slate-100">
                {fmtTRY(item.amount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-brand-400">Kategori</p>
              <p>{item.category ?? '-'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-brand-400">Düzenleme</p>
              <p>{item.issue_date ?? '-'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-brand-400">Vade</p>
              <p>{item.due_date ?? '-'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded flex items-center gap-1"
          >
            <Edit3 className="size-3" />
            {editing ? 'Kapat' : 'Düzenle'}
          </button>
          <ApproveRejectButtons
            onApprove={onApprove}
            onReject={onReject}
            busy={busy}
            rejectConfirm={`"${item.title}" faturası kalıcı olarak silinecek. Devam edilsin mi?`}
          />
        </div>
      </div>
      {editing && <PayableEditForm item={item} onClose={() => setEditing(false)} />}
    </div>
  );
}

function validateAmount(s: string): string | null {
  if (!s || !s.trim()) return 'Tutar zorunlu';
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return 'Geçerli bir tutar gir (örn 1500.50)';
  const n = Number(s);
  if (!isFinite(n)) return 'Tutar geçersiz';
  if (n === 0) return 'Tutar 0 olamaz';
  if (Math.abs(n) > 1e12) return 'Tutar çok büyük';
  return null;
}

function validateDate(s: string): string | null {
  if (!s) return null; // Opsiyonel
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'Tarih YYYY-MM-DD formatında olmalı';
  const t = Date.parse(s);
  if (isNaN(t)) return 'Geçersiz tarih';
  return null;
}

function PayableEditForm({
  item,
  onClose,
}: {
  item: ReviewPayable;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(item.title);
  const [supplierName, setSupplierName] = useState(item.supplier_name ?? '');
  const [amount, setAmount] = useState(String(item.amount));
  const [issueDate, setIssueDate] = useState(item.issue_date ?? '');
  const [dueDate, setDueDate] = useState(item.due_date ?? '');
  const [category, setCategory] = useState(item.category ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(item.invoice_number ?? '');
  const [targetTenantId, setTargetTenantId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleErr = title.trim().length < 2 ? 'Başlık en az 2 karakter' : null;
  const amountErr = validateAmount(amount);
  const issueDateErr = validateDate(issueDate);
  const dueDateErr = validateDate(dueDate);
  const dateOrderErr =
    issueDate && dueDate && !issueDateErr && !dueDateErr && dueDate < issueDate
      ? 'Vade tarihi düzenleme tarihinden önce olamaz'
      : null;
  const formInvalid =
    !!titleErr || !!amountErr || !!issueDateErr || !!dueDateErr || !!dateOrderErr;

  const orgTenants = useQuery({
    queryKey: ['review-queue-org-tenants'],
    queryFn: async () => {
      const res = await api.get<{ data: OrgTenant[] }>('/review-queue/org-tenants');
      return res.data.data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title,
        invoice_number: invoiceNumber || null,
        supplier_name: supplierName || null,
        amount,
        issue_date: issueDate || null,
        due_date: dueDate || null,
        category: category || null,
      };
      if (targetTenantId) body.target_tenant_id = targetTenantId;
      await api.patch(`/review-queue/payable/${item.id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      onClose();
    },
    onError: (err) => {
      const e = err as { response?: { data?: { error?: string; code?: string } }; message?: string };
      setSubmitError(e.response?.data?.error ?? e.message ?? 'Kaydedilemedi');
    },
  });

  return (
    <div className="mt-3 pt-3 border-t border-brand-100 dark:border-slate-800">
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <Field label="Başlık">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full"
          />
        </Field>
        <Field label="Fatura No">
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="input w-full font-mono"
          />
        </Field>
        <Field label="Tedarikçi Adı">
          <input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="input w-full"
          />
        </Field>
        <Field label="Tutar">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input w-full font-mono"
            placeholder="0.00"
          />
        </Field>
        <Field label="Düzenleme Tarihi">
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="input w-full"
          />
        </Field>
        <Field label="Vade Tarihi">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input w-full"
          />
        </Field>
        <Field label="Kategori">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input w-full"
          />
        </Field>
        <Field label="Doğru Şirkete Taşı (yanlış atanmışsa)">
          <select
            value={targetTenantId ?? ''}
            onChange={(e) => setTargetTenantId(e.target.value || null)}
            className="input w-full"
          >
            <option value="">— Bu şirkette kalsın —</option>
            {orgTenants.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.tax_number ? ` · VKN ${t.tax_number}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {targetTenantId && (
        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 rounded flex items-center gap-2">
          <ArrowRight className="size-3" />
          Bu fatura kaydedildiğinde seçilen şirkete taşınacak ve aktif tenant'tan kaybolacak.
          Audit log'a "tenant_corrected" olarak kaydedilir.
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs text-brand-500 hover:text-brand-900 px-3 py-1.5 rounded"
        >
          <X className="size-3 inline" /> İptal
        </button>
        <button
          onClick={() => {
            setSubmitError(null);
            save.mutate();
          }}
          disabled={save.isPending || formInvalid}
          title={formInvalid ? 'Form hatalı, kontrol et' : ''}
          className="text-xs bg-brand-900 hover:bg-brand-700 text-white px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-60"
        >
          {save.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3" />
          )}
          Kaydet
        </button>
      </div>
      {(titleErr || amountErr || issueDateErr || dueDateErr || dateOrderErr || submitError) && (
        <ul className="mt-2 text-xs text-red-600 dark:text-red-400 space-y-0.5">
          {titleErr && <li>• {titleErr}</li>}
          {amountErr && <li>• Tutar: {amountErr}</li>}
          {issueDateErr && <li>• Düzenleme tarihi: {issueDateErr}</li>}
          {dueDateErr && <li>• Vade tarihi: {dueDateErr}</li>}
          {dateOrderErr && <li>• {dateOrderErr}</li>}
          {submitError && <li>• Kayıt: {submitError}</li>}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-brand-400 mb-1">{label}</p>
      {children}
    </div>
  );
}

function SalesInvoiceReviewCard({
  item,
  onApprove,
  onReject,
  busy,
}: {
  item: ReviewSalesInvoice;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <FileText className="size-4 text-brand-500" />
            <h3 className="font-semibold text-brand-900 dark:text-slate-100">{item.title}</h3>
            {item.invoice_number && (
              <span className="text-[10px] font-mono bg-brand-100 dark:bg-slate-800 text-brand-700 dark:text-slate-300 px-2 py-0.5 rounded">
                #{item.invoice_number}
              </span>
            )}
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
              {SOURCE_LABEL[item.source ?? ''] ?? item.source ?? 'auto'}
            </span>
          </div>
          {item.customer_name && (
            <p className="text-sm text-brand-700 dark:text-slate-300">
              Müşteri: <strong>{item.customer_name}</strong>
            </p>
          )}
          <div className="grid sm:grid-cols-3 gap-3 mt-2 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-brand-400">Tutar</p>
              <p className="font-mono">{fmtTRY(item.amount)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-brand-400">Düzenleme</p>
              <p>{item.issue_date ?? '-'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-brand-400">Vade</p>
              <p>{item.due_date ?? '-'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded flex items-center gap-1"
          >
            <Edit3 className="size-3" />
            {editing ? 'Kapat' : 'Düzenle'}
          </button>
          <ApproveRejectButtons
            onApprove={onApprove}
            onReject={onReject}
            busy={busy}
            rejectConfirm={`"${item.title}" satış faturası kalıcı olarak silinecek. Devam edilsin mi?`}
          />
        </div>
      </div>
      {editing && <SalesInvoiceEditForm item={item} onClose={() => setEditing(false)} />}
    </div>
  );
}

function SalesInvoiceEditForm({
  item,
  onClose,
}: {
  item: ReviewSalesInvoice;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(item.title);
  const [customerName, setCustomerName] = useState(item.customer_name ?? '');
  const [amount, setAmount] = useState(String(item.amount));
  const [issueDate, setIssueDate] = useState(item.issue_date ?? '');
  const [dueDate, setDueDate] = useState(item.due_date ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(item.invoice_number ?? '');
  const [targetTenantId, setTargetTenantId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleErr = title.trim().length < 2 ? 'Başlık en az 2 karakter' : null;
  const amountErr = validateAmount(amount);
  const issueDateErr = validateDate(issueDate);
  const dueDateErr = validateDate(dueDate);
  const dateOrderErr =
    issueDate && dueDate && !issueDateErr && !dueDateErr && dueDate < issueDate
      ? 'Vade tarihi düzenleme tarihinden önce olamaz'
      : null;
  const formInvalid =
    !!titleErr || !!amountErr || !!issueDateErr || !!dueDateErr || !!dateOrderErr;

  const orgTenants = useQuery({
    queryKey: ['review-queue-org-tenants'],
    queryFn: async () => {
      const res = await api.get<{ data: OrgTenant[] }>('/review-queue/org-tenants');
      return res.data.data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title,
        invoice_number: invoiceNumber || null,
        customer_name: customerName || null,
        amount,
        issue_date: issueDate || null,
        due_date: dueDate || null,
      };
      if (targetTenantId) body.target_tenant_id = targetTenantId;
      await api.patch(`/review-queue/sales_invoice/${item.id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      onClose();
    },
    onError: (err) => {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setSubmitError(e.response?.data?.error ?? e.message ?? 'Kaydedilemedi');
    },
  });

  return (
    <div className="mt-3 pt-3 border-t border-brand-100 dark:border-slate-800">
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <Field label="Başlık">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full" />
        </Field>
        <Field label="Fatura No">
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="input w-full font-mono"
          />
        </Field>
        <Field label="Müşteri Adı">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="input w-full"
          />
        </Field>
        <Field label="Tutar">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} className="input w-full font-mono" />
        </Field>
        <Field label="Düzenleme Tarihi">
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input w-full" />
        </Field>
        <Field label="Vade Tarihi">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input w-full" />
        </Field>
        <Field label="Doğru Şirkete Taşı">
          <select
            value={targetTenantId ?? ''}
            onChange={(e) => setTargetTenantId(e.target.value || null)}
            className="input w-full"
          >
            <option value="">— Bu şirkette kalsın —</option>
            {orgTenants.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.tax_number ? ` · VKN ${t.tax_number}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {targetTenantId && (
        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 rounded flex items-center gap-2">
          <ArrowRight className="size-3" />
          Bu fatura kaydedildiğinde seçilen şirkete taşınacak. Audit log'a "tenant_corrected"
          olarak kaydedilir.
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-brand-500 hover:text-brand-900 px-3 py-1.5 rounded">
          <X className="size-3 inline" /> İptal
        </button>
        <button
          onClick={() => {
            setSubmitError(null);
            save.mutate();
          }}
          disabled={save.isPending || formInvalid}
          title={formInvalid ? 'Form hatalı, kontrol et' : ''}
          className="text-xs bg-brand-900 hover:bg-brand-700 text-white px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
          Kaydet
        </button>
      </div>
      {(titleErr || amountErr || issueDateErr || dueDateErr || dateOrderErr || submitError) && (
        <ul className="mt-2 text-xs text-red-600 dark:text-red-400 space-y-0.5">
          {titleErr && <li>• {titleErr}</li>}
          {amountErr && <li>• Tutar: {amountErr}</li>}
          {issueDateErr && <li>• Düzenleme tarihi: {issueDateErr}</li>}
          {dueDateErr && <li>• Vade tarihi: {dueDateErr}</li>}
          {dateOrderErr && <li>• {dateOrderErr}</li>}
          {submitError && <li>• Kayıt: {submitError}</li>}
        </ul>
      )}
    </div>
  );
}

function CompanyReviewCard({
  company,
  onApprove,
  onReject,
  busy,
}: {
  company: ReviewCompany;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);

  const [name, setName] = useState(company.name);
  const [shortName, setShortName] = useState(company.short_name ?? '');
  const [taxNumber, setTaxNumber] = useState(company.tax_number ?? '');
  const [registryNumber, setRegistryNumber] = useState(company.registry_number ?? '');

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/review-queue/company/${company.id}`, {
        name,
        short_name: shortName || null,
        tax_number: taxNumber || null,
        registry_number: registryNumber || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      setEditing(false);
    },
  });

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="size-4 text-brand-500" />
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-semibold text-base rounded border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1"
              />
            ) : (
              <h3 className="font-semibold text-brand-900 dark:text-slate-100">{company.name}</h3>
            )}
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
              {SOURCE_LABEL[company.source ?? ''] ?? company.source ?? 'auto'}
            </span>
          </div>
          {company.created_at && (
            <p className="text-[10px] text-brand-400">
              Oluşturuldu: {new Date(company.created_at).toLocaleString('tr-TR')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!editing && !merging && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded flex items-center gap-1"
              >
                <Edit3 className="size-3" />
                Düzenle
              </button>
              <button
                onClick={() => setMerging(true)}
                className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded flex items-center gap-1"
                title="Mevcut bir şirketle birleştir"
              >
                <Merge className="size-3" />
                Birleştir
              </button>
              <ApproveRejectButtons
                onApprove={onApprove}
                onReject={onReject}
                busy={busy}
                rejectConfirm={`"${company.name}" şirketi ve ${company.usage_count} fatura referansı kalıcı olarak silinecek. Devam edilsin mi?`}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-400">VKN</p>
          {editing ? (
            <input
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="Vergi no"
              className="mt-1 w-full rounded border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 text-xs font-mono"
            />
          ) : (
            <p className="font-mono">{company.tax_number ?? '-'}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-400">Kısa Ad</p>
          {editing ? (
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Kısaltma"
              className="mt-1 w-full rounded border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 text-xs"
            />
          ) : (
            <p>{company.short_name ?? '-'}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-400">Sicil No</p>
          {editing ? (
            <input
              value={registryNumber}
              onChange={(e) => setRegistryNumber(e.target.value)}
              placeholder="Sicil"
              className="mt-1 w-full rounded border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 text-xs font-mono"
            />
          ) : (
            <p className="font-mono">{company.registry_number ?? '-'}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-400">Kullanım</p>
          <p className="font-mono">
            {company.usage_count} fatura · {fmtTRY(company.total_volume)}
          </p>
        </div>
      </div>

      {company.usage_count > 0 && (
        <p className="text-[10px] text-brand-500 dark:text-slate-400 italic mb-2">
          İlk: {company.first_usage ?? '-'} · Son: {company.last_usage ?? '-'}
        </p>
      )}

      {editing && (
        <div className="flex justify-end gap-2 pt-2 border-t border-brand-100 dark:border-slate-800">
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-brand-500 hover:text-brand-900 px-3 py-1.5 rounded"
          >
            <X className="size-3 inline" /> İptal
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="text-xs bg-brand-900 hover:bg-brand-700 text-white px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
            Kaydet
          </button>
        </div>
      )}

      {merging && <MergeForm companyId={company.id} onClose={() => setMerging(false)} />}
    </div>
  );
}

function MergeForm({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const candidates = useQuery({
    queryKey: ['merge-candidates', search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const res = await api.get<{
        data: Array<{ id: string; name: string; tax_number: string | null }>;
      }>(`/master-data/companies?search=${encodeURIComponent(search)}`);
      return res.data.data.filter((c) => c.id !== companyId).slice(0, 5);
    },
  });

  const merge = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      await api.post(`/review-queue/company/${companyId}/merge`, { target_id: selectedId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      onClose();
    },
  });

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 mt-2 border border-blue-200 dark:border-blue-800">
      <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
        Birleştirilecek hedef şirketi seç. Bu kayıt silinecek (sadece bu tenant'taki referanslar
        taşınır), faturalar hedefe taşınacak.
      </p>
      <div className="flex items-center gap-2 mb-2">
        <Search className="size-3 text-blue-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hedef şirket ara..."
          className="flex-1 rounded border border-blue-200 dark:border-blue-800 dark:bg-slate-800 px-2 py-1 text-xs"
        />
      </div>
      {candidates.data && candidates.data.length > 0 && (
        <ul className="space-y-1 mb-2">
          {candidates.data.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-2 py-1 rounded">
                <input
                  type="radio"
                  name="merge-target"
                  checked={selectedId === c.id}
                  onChange={() => setSelectedId(c.id)}
                />
                <span className="flex-1">{c.name}</span>
                {c.tax_number && <span className="font-mono text-blue-700">{c.tax_number}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs text-brand-500 hover:text-brand-900 px-3 py-1 rounded"
        >
          İptal
        </button>
        <button
          onClick={() => merge.mutate()}
          disabled={!selectedId || merge.isPending}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50"
        >
          {merge.isPending ? 'Birleştiriliyor…' : 'Birleştir'}
        </button>
      </div>
    </div>
  );
}

function PersonReviewCard({
  person,
  onApprove,
  onReject,
  busy,
}: {
  person: ReviewPerson;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <User className="size-4 text-brand-500" />
          <h3 className="font-semibold text-brand-900 dark:text-slate-100">{person.full_name}</h3>
          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
            {SOURCE_LABEL[person.source ?? ''] ?? 'auto'}
          </span>
        </div>
        <ApproveRejectButtons
          onApprove={onApprove}
          onReject={onReject}
          busy={busy}
          rejectConfirm={`"${person.full_name}" şahsı kalıcı olarak silinecek. Devam edilsin mi?`}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mt-2 text-xs">
        <div>
          <span className="text-brand-400">TC:</span>{' '}
          <span className="font-mono">{person.national_id ?? '-'}</span>
        </div>
        <div>
          <span className="text-brand-400">Telefon:</span> {person.phone ?? '-'}
        </div>
      </div>
    </div>
  );
}
