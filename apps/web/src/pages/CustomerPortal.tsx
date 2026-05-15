/**
 * /cari/:id/portal-tokens — Cari müşteri portali token yönetimi (auth gerekli).
 * /portal/:token              — Public sayfa: müşteri kendi ekstresini görür.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface PortalToken {
  id: string;
  label: string | null;
  expires_at: string;
  is_active: boolean;
  revoked_at: string | null;
  access_count: string;
  last_accessed_at: string | null;
  last_accessed_ip: string | null;
  created_at: string;
}

interface PortalData {
  cari: {
    id: string;
    name: string;
    code: string | null;
    tax_id: string | null;
    tax_office: string | null;
    balance: string;
    currency: string;
  };
  movements: Array<{
    id: string;
    movement_date: string;
    description: string | null;
    document_no: string | null;
    debit: string;
    credit: string;
    currency: string;
  }>;
  token_label: string | null;
  expires_at: string;
}

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

// ---- MANAGEMENT PAGE (auth required) ----

export function CariPortalTokensPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const list = useQuery({
    queryKey: ['portal-tokens', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<{ data: PortalToken[] }>(`/cari/${id}/portal-tokens`);
      return res.data.data;
    },
  });

  const revoke = useMutation({
    mutationFn: async (tokenId: string) =>
      api.post(`/cari/portal-tokens/${tokenId}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-tokens', id] }),
  });

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        to={`/cari/${id}`}
        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-900 dark:text-slate-400 mb-4"
      >
        ← Cari detayı
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Public Link</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Globe className="size-6" />
            Müşteri Portali
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Müşteriye token'lı bir link gönder; cari ekstresini auth gerektirmeden görüntülesin.
            Süresi dolunca otomatik kapanır, sen istediğin zaman iptal edebilirsin.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setCreatedToken(null);
          }}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="size-4" />
          Yeni Link
        </button>
      </header>

      {showForm && (
        <NewTokenForm
          cariId={id!}
          onClose={() => setShowForm(false)}
          onCreated={(t) => {
            setCreatedToken(t);
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['portal-tokens', id] });
          }}
        />
      )}

      {createdToken && (
        <div className="card mb-4 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <h3 className="font-medium text-emerald-900 dark:text-emerald-200 mb-2 flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            Link oluşturuldu — kopyala ve müşteriye gönder
          </h3>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 mb-2">
            Token sadece bir kez gösterilir.
          </p>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded p-2 font-mono text-xs">
            <code className="flex-1 truncate text-emerald-900 dark:text-emerald-200">
              {window.location.origin}/portal/{createdToken}
            </code>
            <button
              onClick={() => copyLink(`${window.location.origin}/portal/${createdToken}`)}
              className="p-1 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded"
            >
              {copied ? <ClipboardCheck className="size-4" /> : <Clipboard className="size-4" />}
            </button>
          </div>
          <button
            onClick={() => setCreatedToken(null)}
            className="mt-2 text-xs text-emerald-900 dark:text-emerald-300 underline"
          >
            Kapat
          </button>
        </div>
      )}

      <div className="card p-0">
        {list.isLoading && <p className="p-4 text-sm text-brand-500">Yükleniyor…</p>}
        {list.data?.length === 0 && (
          <div className="text-center py-12">
            <Globe className="size-12 mx-auto text-brand-300 mb-2" />
            <p className="text-brand-700 dark:text-slate-300 font-medium">
              Henüz portal linki yok.
            </p>
          </div>
        )}
        {list.data && list.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                <th className="py-2.5 px-3">Etiket</th>
                <th className="py-2.5 px-3">Bitiş</th>
                <th className="py-2.5 px-3 text-right">Erişim</th>
                <th className="py-2.5 px-3">Son Erişim</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((t) => {
                const expired = new Date(t.expires_at) < new Date();
                const active = t.is_active && !t.revoked_at && !expired;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-brand-50 dark:border-slate-800/50"
                  >
                    <td className="py-2 px-3">{t.label ?? '(etiketsiz)'}</td>
                    <td className="py-2 px-3 font-mono text-xs">
                      {new Date(t.expires_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="py-2 px-3 text-right">{Number(t.access_count)}</td>
                    <td className="py-2 px-3 text-xs text-brand-500">
                      {t.last_accessed_at
                        ? new Date(t.last_accessed_at).toLocaleString('tr-TR')
                        : 'Hiç'}
                    </td>
                    <td className="py-2 px-3">
                      {active ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 rounded">
                          Aktif
                        </span>
                      ) : t.revoked_at ? (
                        <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded">
                          İptal
                        </span>
                      ) : (
                        <span className="text-xs bg-brand-100 text-brand-500 dark:bg-slate-800 px-2 py-0.5 rounded">
                          Süresi Doldu
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {active && (
                        <button
                          onClick={() => {
                            if (confirm('Bu link iptal edilsin mi? Müşteri erişemeyecek.'))
                              revoke.mutate(t.id);
                          }}
                          className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"
                        >
                          İptal
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewTokenForm({
  cariId,
  onClose,
  onCreated,
}: {
  cariId: string;
  onClose: () => void;
  onCreated: (token: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(90);

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { id: string }; token: string }>(
        `/cari/${cariId}/portal-tokens`,
        { label: label || null, expires_in_days: days },
      );
      return res.data.token;
    },
    onSuccess: (token) => onCreated(token),
  });

  return (
    <div className="card mb-4 border-brand-300 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-brand-900 dark:text-slate-100">Yeni Portal Linki</h3>
        <button
          onClick={onClose}
          className="text-brand-500 hover:text-brand-900 dark:text-slate-400"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etiket (örn. Müşteri Mart 2026 Mutabakat)"
          className="w-full rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <label className="text-xs text-brand-500 dark:text-slate-400 block">
          Geçerlilik süresi: <strong>{days} gün</strong>
          <input
            type="range"
            min={7}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full mt-1"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onClose}
          className="text-sm text-brand-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800 px-3 py-2 rounded"
        >
          İptal
        </button>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Oluştur
        </button>
      </div>
    </div>
  );
}

// ---- PUBLIC PORTAL PAGE (auth-less) ----

export function PublicPortalPage() {
  const { token } = useParams<{ token: string }>();

  const q = useQuery<PortalData | { error: string }>({
    queryKey: ['public-portal', token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      try {
        const res = await api.get<{ data: PortalData }>(`/portal/${token}`);
        return res.data.data;
      } catch (e) {
        const err = e as { response?: { data?: { message?: string } } };
        return { error: err.response?.data?.message ?? 'Link geçersiz veya süresi dolmuş' };
      }
    },
  });

  if (q.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-brand-500">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!q.data || 'error' in q.data) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="max-w-md card text-center">
          <AlertCircle className="size-12 text-red-500 mx-auto mb-2" />
          <h1 className="text-xl font-semibold text-brand-900 dark:text-slate-100">
            Erişim Reddedildi
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            {q.data && 'error' in q.data ? q.data.error : 'Bilinmeyen hata'}
          </p>
          <p className="text-xs text-brand-400 mt-3">
            Cari sahibi yeni bir bağlantı göndermeli.
          </p>
        </div>
      </div>
    );
  }

  const { cari, movements, token_label, expires_at } = q.data;

  // Yürüyen bakiye
  let running = 0;
  const enriched = movements
    .slice()
    .reverse()
    .map((m) => {
      running += Number(m.debit) - Number(m.credit);
      return { ...m, running };
    })
    .reverse();

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-slate-950 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 card bg-gradient-to-br from-brand-900 to-brand-700 dark:from-slate-800 dark:to-slate-700 text-white">
          <p className="text-xs uppercase tracking-wider text-brand-200 mb-1">
            Cari Ekstre
          </p>
          <h1 className="text-2xl font-semibold">{cari.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-brand-200 flex-wrap">
            {cari.code && <span className="font-mono">{cari.code}</span>}
            {cari.tax_id && <span className="font-mono">VN: {cari.tax_id}</span>}
            {cari.tax_office && <span>{cari.tax_office} V.D.</span>}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-brand-300 uppercase tracking-wider">Güncel Bakiye</p>
              <p className="text-3xl font-semibold font-mono">{fmtTRY(cari.balance)}</p>
            </div>
            <p className="text-xs text-brand-300">
              Bu link {new Date(expires_at).toLocaleDateString('tr-TR')} tarihine kadar geçerli
            </p>
          </div>
        </header>

        {token_label && (
          <p className="text-sm text-brand-500 dark:text-slate-400 mb-4 italic">
            {token_label}
          </p>
        )}

        <div className="card p-0 overflow-x-auto">
          <div className="px-4 py-3 border-b border-brand-100 dark:border-slate-800">
            <h2 className="font-semibold text-brand-900 dark:text-slate-100">
              Son 100 Hareket
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800 bg-brand-50/50 dark:bg-slate-800/30">
                <th className="py-2 px-3">Tarih</th>
                <th className="py-2 px-3">Belge</th>
                <th className="py-2 px-3">Açıklama</th>
                <th className="py-2 px-3 text-right">Borç</th>
                <th className="py-2 px-3 text-right">Alacak</th>
                <th className="py-2 px-3 text-right">Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-brand-50 dark:border-slate-800/50"
                >
                  <td className="py-2 px-3 font-mono text-xs">{m.movement_date}</td>
                  <td className="py-2 px-3 font-mono text-xs">{m.document_no ?? '-'}</td>
                  <td className="py-2 px-3 text-brand-700 dark:text-slate-300">
                    {m.description ?? '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    {Number(m.debit) > 0 ? fmtTRY(m.debit) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-red-700 dark:text-red-400">
                    {Number(m.credit) > 0 ? fmtTRY(m.credit) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-medium">
                    {fmtTRY(m.running)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-brand-400 dark:text-slate-500 mt-6 text-center">
          Bu sayfa Sayman tarafından oluşturulmuştur · sayman.deploi.net
        </p>
      </div>
    </div>
  );
}
