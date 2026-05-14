/**
 * /erp — ERP (muhasebe yazılımı) bağlantı yönetimi.
 *
 * Akış:
 *   1. Provider seç (Paraşüt, Logo, Manuel)
 *   2. Adapter config field'larını doldur
 *   3. Test → token deneme
 *   4. Kaydet → sync_interval_hours bekle (default 1)
 *   5. Sync (manuel veya cron)
 *   6. Sync log + cari sayfasında veri
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface ProviderInfo {
  provider: string;
  label: string;
  config_fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'select';
    required: boolean;
    placeholder?: string;
    help?: string;
  }>;
}

interface Connection {
  id: string;
  provider: string;
  name: string;
  tenant_id: string | null;
  public_config: Record<string, unknown>;
  status: 'active' | 'paused' | 'error';
  sync_interval_hours: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  sync_count: string;
  created_at: string;
}

interface SyncLog {
  id: string;
  entity_type: string;
  trigger: string;
  status: string;
  records_pulled: string;
  duration_ms: string | null;
  error_message: string | null;
  details: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
}

export function ErpConnectionsPage() {
  const qc = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);

  const providers = useQuery({
    queryKey: ['erp-providers'],
    queryFn: async () => {
      const res = await api.get<{ data: ProviderInfo[] }>('/erp/providers');
      return res.data.data;
    },
  });

  const connections = useQuery({
    queryKey: ['erp-connections'],
    queryFn: async () => {
      const res = await api.get<{ data: Connection[] }>('/erp/connections');
      return res.data.data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/erp/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp-connections'] }),
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Entegrasyonlar</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="size-6" />
            ERP Bağlantıları
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Paraşüt, Logo, Mikro gibi muhasebe yazılımlarınla iki yönlü bağlan:
            cari + ekstre otomatik gelir, Sayman'da oluşan fatura/ödeme oraya da yansır.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="size-4" />
          Yeni Bağlantı
        </button>
      </header>

      {showWizard && providers.data && (
        <ConnectionWizard
          providers={providers.data}
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['erp-connections'] });
            setShowWizard(false);
          }}
        />
      )}

      {connections.isLoading && (
        <p className="text-sm text-brand-500 dark:text-slate-400">Yükleniyor…</p>
      )}

      {connections.data && connections.data.length === 0 && !showWizard && (
        <div className="card text-center py-12">
          <Database className="size-12 mx-auto text-brand-300 mb-3" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            Henüz ERP bağlantısı yok.
          </p>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Bağlantı eklediğinde cari listesi, ekstre ve bakiyeler otomatik gelir.
          </p>
        </div>
      )}

      {connections.data && connections.data.length > 0 && (
        <div className="space-y-3">
          {connections.data.map((c) => (
            <ConnectionCard
              key={c.id}
              connection={c}
              onDelete={() => {
                if (confirm(`"${c.name}" bağlantısı silinsin mi? Cari verisi de silinecek.`)) {
                  remove.mutate(c.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionCard({
  connection,
  onDelete,
}: {
  connection: Connection;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const test = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { ok: boolean; message: string } }>(
        `/erp/connections/${connection.id}/test`,
      );
      return res.data.data;
    },
    onSuccess: (r) => setTestResult(`${r.ok ? '✓' : '✗'} ${r.message}`),
    onError: (e) => setTestResult(`✗ ${(e as Error).message}`),
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await api.post<{
        data: {
          status: string;
          cari_pulled: number;
          movements_pulled: number;
          invoices_pulled: number;
          duration_ms: number;
          errors: string[];
        };
      }>(`/erp/connections/${connection.id}/sync`);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp-connections'] }),
  });

  const logs = useQuery({
    queryKey: ['erp-logs', connection.id],
    enabled: showLogs,
    queryFn: async () => {
      const res = await api.get<{ data: SyncLog[] }>(`/erp/connections/${connection.id}/logs`);
      return res.data.data;
    },
  });

  const pushStats = useQuery({
    queryKey: ['erp-push-status', connection.id],
    queryFn: async () => {
      const res = await api.get<{
        data: { total: number; pushed: number; failed: number; pending: number };
      }>(`/erp/connections/${connection.id}/push-status`);
      return res.data.data;
    },
  });

  const bulkPush = useMutation({
    mutationFn: async () => {
      const res = await api.post<{
        data: { attempted: number; success: number; failed: number; errors: string[] };
      }>(`/erp/connections/${connection.id}/push-pending`, { limit: 50 });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-push-status', connection.id] });
    },
  });

  const statusColor =
    connection.status === 'active'
      ? 'text-emerald-700 bg-emerald-100'
      : connection.status === 'error'
        ? 'text-red-700 bg-red-100'
        : 'text-brand-500 bg-brand-100';

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-brand-900 dark:text-slate-100">{connection.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor}`}>
              {connection.status}
            </span>
            <span className="text-[10px] bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded">
              {connection.provider}
            </span>
          </div>
          {connection.last_sync_at ? (
            <p className="text-xs text-brand-500 dark:text-slate-400">
              Son sync: {new Date(connection.last_sync_at).toLocaleString('tr-TR')} ·{' '}
              {connection.last_sync_status === 'success' ? (
                <span className="text-emerald-700">başarılı</span>
              ) : connection.last_sync_status === 'error' ? (
                <span className="text-red-700">hata</span>
              ) : (
                <span className="text-amber-700">{connection.last_sync_status}</span>
              )}{' '}
              · toplam {connection.sync_count} sync
            </p>
          ) : (
            <p className="text-xs text-brand-500 italic">Henüz sync edilmedi.</p>
          )}
          {connection.last_sync_error && (
            <p className="text-xs text-red-600 mt-1 truncate" title={connection.last_sync_error}>
              ⚠ {connection.last_sync_error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => test.mutate()}
            disabled={test.isPending}
            className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-60"
          >
            {test.isPending ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            Test
          </button>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-60"
          >
            {sync.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Sync
          </button>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs text-brand-600 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded"
          >
            Logs
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1.5 rounded"
            aria-label="Sil"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {testResult && (
        <p
          className={`text-sm rounded p-2 mb-2 ${
            testResult.startsWith('✓')
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200'
          }`}
        >
          {testResult}
        </p>
      )}

      {sync.data && (
        <div className="bg-brand-50 dark:bg-slate-800 rounded p-2 text-xs mb-2">
          <p className="font-medium text-brand-900 dark:text-slate-100">
            ✓ Sync tamamlandı — {sync.data.cari_pulled} cari, {sync.data.movements_pulled} hareket
            {sync.data.invoices_pulled > 0 && `, ${sync.data.invoices_pulled} fatura`},{' '}
            {(sync.data.duration_ms / 1000).toFixed(1)} sn
          </p>
          {sync.data.errors.length > 0 && (
            <p className="text-amber-700 mt-1">
              {sync.data.errors.length} uyarı: {sync.data.errors[0]}
            </p>
          )}
        </div>
      )}

      {/* Push (Sayman → ERP) bölümü */}
      {pushStats.data && pushStats.data.total > 0 && (
        <div className="border-t border-brand-100 dark:border-slate-800 pt-3 mt-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-brand-500 dark:text-slate-400">
                <ArrowUpFromLine className="size-3" />
                Sayman → ERP:
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                {pushStats.data.pushed} gönderildi
              </span>
              {pushStats.data.pending > 0 && (
                <span className="text-amber-700 dark:text-amber-400">
                  {pushStats.data.pending} bekliyor
                </span>
              )}
              {pushStats.data.failed > 0 && (
                <span className="text-red-700 dark:text-red-400">
                  {pushStats.data.failed} hata
                </span>
              )}
            </div>
            {pushStats.data.pending + pushStats.data.failed > 0 && (
              <button
                onClick={() => bulkPush.mutate()}
                disabled={bulkPush.isPending}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-60"
              >
                {bulkPush.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Send className="size-3" />
                )}
                Bekleyenleri Gönder
              </button>
            )}
          </div>
          {bulkPush.data && (
            <p className="text-xs bg-blue-50 dark:bg-blue-900/20 rounded p-2 mt-2">
              ✓ {bulkPush.data.attempted} fatura işlendi — {bulkPush.data.success} başarılı,{' '}
              {bulkPush.data.failed} hata
              {bulkPush.data.errors.length > 0 && (
                <span className="block text-amber-700 mt-1">
                  Örnek hata: {bulkPush.data.errors[0]}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {showLogs && (
        <div className="border-t border-brand-100 dark:border-slate-800 pt-3 mt-2">
          <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400 mb-2">
            Son 50 Sync Log
          </p>
          {logs.data?.length === 0 && (
            <p className="text-xs text-brand-400 italic">Henüz log yok.</p>
          )}
          {logs.data && logs.data.length > 0 && (
            <ul className="space-y-1 max-h-60 overflow-y-auto">
              {logs.data.map((l) => (
                <li
                  key={l.id}
                  className="text-xs bg-brand-50/50 dark:bg-slate-800/50 rounded p-2 flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2">
                    {l.status === 'success' ? (
                      <CheckCircle2 className="size-3 text-emerald-600" />
                    ) : l.status === 'error' ? (
                      <AlertCircle className="size-3 text-red-600" />
                    ) : (
                      <Clock className="size-3 text-amber-600" />
                    )}
                    <span className="font-mono">{new Date(l.started_at).toLocaleString('tr-TR')}</span>
                  </span>
                  <span className="text-brand-600 dark:text-slate-400">
                    {l.trigger} · {l.records_pulled} kayıt ·{' '}
                    {l.duration_ms ? `${(Number(l.duration_ms) / 1000).toFixed(1)}sn` : '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionWizard({
  providers,
  onClose,
  onCreated,
}: {
  providers: ProviderInfo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [provider, setProvider] = useState(providers[0]?.provider ?? 'parasut');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const selected = providers.find((p) => p.provider === provider);

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { id: string } }>('/erp/connections', {
        provider,
        name,
        config,
      });
      return res.data.data;
    },
    onSuccess: () => onCreated(),
    onError: (e) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? (e as Error).message);
    },
  });

  return (
    <div className="card mb-6 border-brand-300 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Plus className="size-5" />
          Yeni ERP Bağlantısı
        </h2>
        <button
          onClick={onClose}
          className="text-sm text-brand-500 hover:text-brand-900 dark:text-slate-400"
        >
          Vazgeç
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400">
            Sağlayıcı
          </label>
          <div className="grid sm:grid-cols-3 gap-2 mt-2">
            {providers.map((p) => (
              <button
                key={p.provider}
                onClick={() => {
                  setProvider(p.provider);
                  setConfig({});
                }}
                className={`p-3 rounded-lg border text-left transition ${
                  provider === p.provider
                    ? 'border-brand-900 dark:border-brand-300 bg-brand-50 dark:bg-slate-800'
                    : 'border-brand-100 dark:border-slate-700 hover:border-brand-300 dark:hover:border-slate-600'
                }`}
              >
                <p className="font-medium text-brand-900 dark:text-slate-100 text-sm">
                  {p.label}
                </p>
                <p className="text-[10px] text-brand-500 dark:text-slate-400 mt-0.5 font-mono">
                  {p.provider}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400">
              Bağlantı adı
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. ABC Şirket Paraşüt"
              className="mt-1 w-full rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>
        </div>

        {selected && selected.config_fields.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-brand-100 dark:border-slate-800">
            <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400">
              {selected.label} Yapılandırma
            </p>
            {selected.config_fields.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </span>
                <input
                  type={f.type === 'password' ? 'password' : 'text'}
                  value={config[f.key] ?? ''}
                  onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="mt-1 w-full rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                {f.help && (
                  <p className="text-[10px] text-brand-400 dark:text-slate-500 mt-0.5">{f.help}</p>
                )}
              </label>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-2">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-brand-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800 rounded-lg"
          >
            İptal
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || name.length < 2}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Bağlantıyı Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
