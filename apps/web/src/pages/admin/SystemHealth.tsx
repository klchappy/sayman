/**
 * /admin/health — Sistem Sağlığı (super_admin)
 *
 * Cron job çalıştırma geçmişi, son hatalar, ERP push fail'leri ve
 * smart-import son sonuçları tek yerden görünür.
 *
 * Backend endpoint'leri:
 *   GET /v1/jobs/runs
 *   GET /v1/jobs/runs/summary
 *   POST /v1/jobs/run-now/:job
 *   GET /v1/erp/connections/:id/push-failures
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  Network,
  Play,
  RefreshCw,
  ServerCrash,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface JobRun {
  id: string;
  job_name: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  started_at: string;
  finished_at: string | null;
  duration_ms: string | null;
  result: Record<string, unknown>;
  error_message: string | null;
  hostname: string | null;
}

interface JobSummary {
  job_name: string;
  last_status: string;
  last_started_at: string;
  last_finished_at: string | null;
  last_duration_ms: string | null;
  last_error: string | null;
  fail_24h: number;
  runs_24h: number;
}

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  partial: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="size-3.5" />,
  failed: <XCircle className="size-3.5" />,
  partial: <AlertCircle className="size-3.5" />,
  running: <Loader2 className="size-3.5 animate-spin" />,
};

function timeAgo(iso: string | null): string {
  if (!iso) return '-';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return Math.floor(ms / 1000) + 's önce';
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + 'dk önce';
  if (ms < 86_400_000) return Math.floor(ms / 3_600_000) + 'sa önce';
  return Math.floor(ms / 86_400_000) + 'g önce';
}

export function SystemHealthPage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [jobFilter, setJobFilter] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Super-admin guard — non-super_admin için 403
  const isSuperAdmin = me?.organizations.some(
    (o) => o.slug === active.orgSlug && o.role === 'super_admin',
  );

  const summaryQ = useQuery({
    queryKey: ['jobs-runs-summary', active.orgSlug],
    enabled: !!active.orgSlug && !!isSuperAdmin,
    queryFn: async () => {
      const res = await api.get<{ data: JobSummary[] }>('/jobs/runs/summary');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const runsQ = useQuery({
    queryKey: ['jobs-runs', active.orgSlug, statusFilter, jobFilter],
    enabled: !!active.orgSlug && !!isSuperAdmin,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (jobFilter) params.set('job', jobFilter);
      const res = await api.get<{ data: JobRun[]; total: number; truncated: boolean }>(
        `/jobs/runs?${params}`,
      );
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const runNow = useMutation({
    mutationFn: async (job: string) =>
      api.post(`/jobs/run-now/${job}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs-runs'] });
      qc.invalidateQueries({ queryKey: ['jobs-runs-summary'] });
    },
  });

  if (!isSuperAdmin) {
    return (
      <div className="p-10 max-w-2xl mx-auto text-center">
        <div className="card">
          <p className="text-red-700 font-medium">Yetki yok</p>
          <p className="text-sm text-brand-500 mt-1">
            Sistem Sağlığı sayfası sadece super_admin rolü için erişilebilir.
          </p>
        </div>
      </div>
    );
  }

  const summary = summaryQ.data ?? [];
  const fail24hTotal = summary.reduce((a, s) => a + (s.fail_24h ?? 0), 0);
  const runs24hTotal = summary.reduce((a, s) => a + (s.runs_24h ?? 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Yönetici</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="size-6" />
            Sistem Sağlığı
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Cron job çalıştırma geçmişi, son hatalar, ERP push fail'leri ve sistem operasyonel
            durumu. Her 30 saniyede otomatik yenilenir.
          </p>
        </div>
        <button
          onClick={() => {
            qc.invalidateQueries({ queryKey: ['jobs-runs-summary'] });
            qc.invalidateQueries({ queryKey: ['jobs-runs'] });
          }}
          className="inline-flex items-center gap-2 text-sm bg-brand-50 hover:bg-brand-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-brand-700 dark:text-slate-200 px-3 py-1.5 rounded-lg"
        >
          <RefreshCw className="size-4" />
          Yenile
        </button>
      </header>

      {/* KPI cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          icon={<Database className="size-4 text-brand-300" />}
          label="Tanımlı Cron"
          value={String(summary.length)}
        />
        <Kpi
          icon={<Clock className="size-4 text-brand-300" />}
          label="Son 24s Çalışma"
          value={String(runs24hTotal)}
        />
        <Kpi
          icon={<ServerCrash className="size-4 text-red-400" />}
          label="Son 24s Hata"
          value={String(fail24hTotal)}
          highlight={fail24hTotal > 0 ? 'red' : undefined}
        />
        <Kpi
          icon={<CheckCircle2 className="size-4 text-emerald-400" />}
          label="Başarı Oranı (24s)"
          value={
            runs24hTotal === 0
              ? '-'
              : `${Math.round(((runs24hTotal - fail24hTotal) / runs24hTotal) * 100)}%`
          }
          highlight={fail24hTotal === 0 ? 'emerald' : undefined}
        />
      </div>

      {/* Job Summary */}
      <section className="card mb-6">
        <h2 className="font-semibold text-brand-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Activity className="size-5" />
          Cron Job Durumu
        </h2>
        {summaryQ.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
        {summary.length === 0 && !summaryQ.isLoading && (
          <p className="text-sm text-brand-500 py-4 text-center">
            Henüz cron çalıştırması kaydedilmemiş. Cron'lar zamanlarında çalışınca burada görünecek.
          </p>
        )}
        {summary.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                  <th className="py-2 px-2">Job</th>
                  <th className="py-2 px-2">Son Durum</th>
                  <th className="py-2 px-2">Son Çalışma</th>
                  <th className="py-2 px-2 text-right">Süre</th>
                  <th className="py-2 px-2 text-right">24s Çalışma</th>
                  <th className="py-2 px-2 text-right">24s Hata</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr
                    key={s.job_name}
                    className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-2 px-2 font-mono text-xs">{s.job_name}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${STATUS_BADGE[s.last_status] ?? STATUS_BADGE.completed}`}
                      >
                        {STATUS_ICON[s.last_status]}
                        {s.last_status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-brand-500" title={s.last_started_at}>
                      {timeAgo(s.last_started_at)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs">
                      {s.last_duration_ms ? s.last_duration_ms + 'ms' : '-'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{s.runs_24h}</td>
                    <td
                      className={`py-2 px-2 text-right font-mono font-semibold ${s.fail_24h > 0 ? 'text-red-600' : 'text-brand-400'}`}
                    >
                      {s.fail_24h}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => runNow.mutate(s.job_name)}
                        disabled={runNow.isPending}
                        title="Şimdi çalıştır"
                        className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900 dark:text-slate-300 dark:hover:text-slate-100 disabled:opacity-50"
                      >
                        {runNow.isPending && runNow.variables === s.job_name ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Play className="size-3" />
                        )}
                        Çalıştır
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent runs (filterable) */}
      <section className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="size-5" />
            Son Çalıştırmalar
          </h2>
          <div className="flex gap-2 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-brand-200 dark:border-slate-700 dark:bg-slate-800 rounded px-2 py-1"
            >
              <option value="">Tüm Durumlar</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
              <option value="partial">partial</option>
              <option value="running">running</option>
            </select>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="border border-brand-200 dark:border-slate-700 dark:bg-slate-800 rounded px-2 py-1"
            >
              <option value="">Tüm Job'lar</option>
              {summary.map((s) => (
                <option key={s.job_name} value={s.job_name}>
                  {s.job_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {runsQ.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
        {runsQ.data && runsQ.data.data.length === 0 && (
          <p className="text-sm text-brand-500 py-4 text-center">Filtreyle eşleşen çalıştırma yok.</p>
        )}
        {runsQ.data && runsQ.data.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                  <th className="py-2 px-2">Job</th>
                  <th className="py-2 px-2">Durum</th>
                  <th className="py-2 px-2">Başlangıç</th>
                  <th className="py-2 px-2 text-right">Süre</th>
                  <th className="py-2 px-2">Detay</th>
                </tr>
              </thead>
              <tbody>
                {runsQ.data.data.map((r) => {
                  const isExpanded = expandedRow === r.id;
                  return (
                    <>
                      <tr
                        key={r.id}
                        className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30 dark:hover:bg-slate-800/30 cursor-pointer"
                        onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      >
                        <td className="py-2 px-2 font-mono text-xs">{r.job_name}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${STATUS_BADGE[r.status] ?? STATUS_BADGE.completed}`}
                          >
                            {STATUS_ICON[r.status]}
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs text-brand-500" title={r.started_at}>
                          {timeAgo(r.started_at)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-xs">
                          {r.duration_ms ? r.duration_ms + 'ms' : '-'}
                        </td>
                        <td className="py-2 px-2 text-xs text-brand-500">
                          {r.error_message ? '⚠️ Hata var, tıkla' : 'Sonuç JSON, tıkla'}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={r.id + '-detail'} className="bg-brand-50/50 dark:bg-slate-800/50">
                          <td colSpan={5} className="py-3 px-3">
                            {r.error_message && (
                              <div className="mb-2">
                                <p className="text-xs uppercase tracking-wide text-red-600 mb-1">
                                  Hata Mesajı
                                </p>
                                <pre className="text-[11px] font-mono bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                  {r.error_message}
                                </pre>
                              </div>
                            )}
                            <p className="text-xs uppercase tracking-wide text-brand-500 mb-1">
                              Result JSON
                            </p>
                            <pre className="text-[11px] font-mono bg-white dark:bg-slate-900 p-2 rounded overflow-x-auto">
                              {JSON.stringify(r.result, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            {runsQ.data.truncated && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                ⚠️ Liste kesildi — {runsQ.data.data.length}/{runsQ.data.total} kayıt gösteriliyor.
                Filtrele.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ERP push failures */}
      <ErpPushFailuresSection />
    </div>
  );
}

interface ErpConnection {
  id: string;
  name: string;
  tenant_id: string | null;
  tenant_slug?: string;
}

function ErpPushFailuresSection() {
  const connectionsQ = useQuery({
    queryKey: ['admin-erp-connections'],
    queryFn: async () => {
      const res = await api.get<{ data: ErpConnection[] }>('/erp/connections');
      return res.data.data;
    },
  });

  const connections = connectionsQ.data ?? [];
  if (connections.length === 0) return null;

  return (
    <section className="card mt-6">
      <h2 className="font-semibold text-brand-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        <Network className="size-5" />
        ERP Push Hataları
      </h2>
      <p className="text-xs text-brand-500 dark:text-slate-400 mb-3">
        ERP'ye push edilemeyen faturalar bağlantı bazında listelenir.
      </p>
      <div className="space-y-4">
        {connections.map((c) => (
          <ErpFailuresList key={c.id} connection={c} />
        ))}
      </div>
    </section>
  );
}

interface FailureRow {
  id: string;
  title: string;
  invoice_number: string | null;
  supplier_name: string | null;
  amount: string;
  issue_date: string | null;
  erp_push_error: string | null;
  updated_at: string;
}

function ErpFailuresList({ connection }: { connection: ErpConnection }) {
  const [expanded, setExpanded] = useState(false);
  const q = useQuery({
    queryKey: ['erp-push-failures', connection.id, expanded],
    enabled: expanded,
    queryFn: async () => {
      const res = await api.get<{ data: FailureRow[]; count: number }>(
        `/erp/connections/${connection.id}/push-failures?limit=50`,
      );
      return res.data;
    },
  });

  return (
    <div className="border border-brand-100 dark:border-slate-800 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-brand-50/40 dark:hover:bg-slate-800/40 rounded-t-lg"
      >
        <span className="font-medium text-sm text-brand-900 dark:text-slate-100">
          {connection.name}
        </span>
        <span className="text-xs text-brand-500">
          {expanded ? 'Gizle' : 'Hataları Göster'}
        </span>
      </button>
      {expanded && (
        <div className="p-3 border-t border-brand-100 dark:border-slate-800">
          {q.isLoading && (
            <p className="text-sm text-brand-500 text-center py-2">Yükleniyor…</p>
          )}
          {q.data && q.data.count === 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-300 text-center py-2">
              ✓ Bu bağlantı için fail kalmamış
            </p>
          )}
          {q.data && q.data.count > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                  <th className="py-2 px-2">Fatura</th>
                  <th className="py-2 px-2">Tedarikçi</th>
                  <th className="py-2 px-2 text-right">Tutar</th>
                  <th className="py-2 px-2">Hata</th>
                  <th className="py-2 px-2">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-brand-50 dark:border-slate-800/50"
                  >
                    <td className="py-2 px-2">
                      <p className="font-medium text-xs">{f.title}</p>
                      <p className="text-[10px] text-brand-400">{f.invoice_number ?? '-'}</p>
                    </td>
                    <td className="py-2 px-2 text-xs">{f.supplier_name ?? '-'}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{f.amount}</td>
                    <td className="py-2 px-2 text-xs text-red-700 dark:text-red-300 max-w-[300px] truncate" title={f.erp_push_error ?? ''}>
                      {f.erp_push_error ?? '(detay yok)'}
                    </td>
                    <td className="py-2 px-2 text-xs text-brand-500">
                      {timeAgo(f.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: 'red' | 'emerald';
}) {
  const ring =
    highlight === 'red'
      ? 'ring-2 ring-red-200 dark:ring-red-900/50'
      : highlight === 'emerald'
        ? 'ring-2 ring-emerald-200 dark:ring-emerald-900/50'
        : '';
  return (
    <div className={`card ${ring}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-[10px] uppercase tracking-wide text-brand-500">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-brand-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
