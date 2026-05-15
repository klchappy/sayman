/**
 * /review-queue — Smart import veya ERP sync sırasında otomatik oluşturulan
 * master data kayıtlarının doğrulama listesi.
 *
 * Kullanıcı görsel kontrol yapar, eksik bilgi ekler veya başka kayıtla birleştirir.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Merge,
  Search,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

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

function fmtTRY(v: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(v);
}

const SOURCE_LABEL: Record<string, string> = {
  efatura: 'e-Fatura',
  csv_import: 'CSV Import',
  smart_import: 'Akıllı Yükleme',
  erp_sync: 'ERP Senkron',
  manual: 'Manuel',
};

export function ReviewQueuePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'companies' | 'persons'>('companies');

  const q = useQuery({
    queryKey: ['review-queue'],
    queryFn: async () => {
      const res = await api.get<{
        data: { companies: ReviewCompany[]; persons: ReviewPerson[] };
      }>('/review-queue');
      return res.data.data;
    },
  });

  const approve = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) =>
      api.post(`/review-queue/${type}/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  });

  const counts = {
    companies: q.data?.companies.length ?? 0,
    persons: q.data?.persons.length ?? 0,
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Doğrulama</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <AlertTriangle className="size-6 text-amber-600" />
          Review Queue
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Akıllı yükleme, e-Fatura import veya ERP senkron sırasında otomatik oluşturulan kayıtlar.
          İncele, gerekirse tax_number/ad ekle, mevcut bir kayıtla birleştir veya direkt onayla.
        </p>
      </header>

      <div className="flex border-b border-brand-100 dark:border-slate-800 mb-4">
        <button
          onClick={() => setTab('companies')}
          className={`px-4 py-2 text-sm border-b-2 flex items-center gap-2 ${
            tab === 'companies'
              ? 'border-brand-900 dark:border-brand-300 text-brand-900 dark:text-slate-100 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          <Building2 className="size-4" />
          Şirketler
          {counts.companies > 0 && (
            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 rounded">
              {counts.companies}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('persons')}
          className={`px-4 py-2 text-sm border-b-2 flex items-center gap-2 ${
            tab === 'persons'
              ? 'border-brand-900 dark:border-brand-300 text-brand-900 dark:text-slate-100 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          <User className="size-4" />
          Şahıslar
          {counts.persons > 0 && (
            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 rounded">
              {counts.persons}
            </span>
          )}
        </button>
      </div>

      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}

      {tab === 'companies' && q.data && q.data.companies.length === 0 && (
        <div className="card text-center py-12">
          <CheckCircle2 className="size-12 mx-auto text-emerald-500 mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            Bekleyen şirket doğrulaması yok.
          </p>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Akıllı yükleme veya ERP sync ile otomatik yaratılan tedarikçiler burada görünür.
          </p>
        </div>
      )}

      {tab === 'companies' && q.data && q.data.companies.length > 0 && (
        <div className="space-y-2">
          {q.data.companies.map((c) => (
            <CompanyReviewCard
              key={c.id}
              company={c}
              onApprove={() => approve.mutate({ type: 'company', id: c.id })}
            />
          ))}
        </div>
      )}

      {tab === 'persons' && q.data && q.data.persons.length === 0 && (
        <div className="card text-center py-12">
          <CheckCircle2 className="size-12 mx-auto text-emerald-500 mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            Bekleyen şahıs doğrulaması yok.
          </p>
        </div>
      )}

      {tab === 'persons' && q.data && q.data.persons.length > 0 && (
        <div className="space-y-2">
          {q.data.persons.map((p) => (
            <PersonReviewCard
              key={p.id}
              person={p}
              onApprove={() => approve.mutate({ type: 'person', id: p.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyReviewCard({
  company,
  onApprove,
}: {
  company: ReviewCompany;
  onApprove: () => void;
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
        <div className="flex items-center gap-2">
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
              <button
                onClick={onApprove}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded flex items-center gap-1"
              >
                <CheckCircle2 className="size-3" />
                Onayla
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
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
            İptal
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
  const [debounced, setDebounced] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useState(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  });

  const candidates = useQuery({
    queryKey: ['merge-candidates', debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const res = await api.get<{ data: Array<{ id: string; name: string; tax_number: string | null }> }>(
        `/master-data/companies?search=${encodeURIComponent(debounced)}`,
      );
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
        Birleştirilecek hedef şirketi seç. Bu kayıt silinecek, faturalar hedefe taşınacak.
      </p>
      <div className="flex items-center gap-2 mb-2">
        <Search className="size-3 text-blue-600" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDebounced(e.target.value);
          }}
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
}: {
  person: ReviewPerson;
  onApprove: () => void;
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
        <button
          onClick={onApprove}
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded flex items-center gap-1"
        >
          <CheckCircle2 className="size-3" />
          Onayla
        </button>
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
