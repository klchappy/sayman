/**
 * /inbound-webhooks — Gelen webhook endpoint yönetimi.
 *
 * Damga/n8n/Zapier gibi araçların Sayman'a POST yapması için endpoint oluşturma:
 *   - Slug + secret (HMAC-SHA256) tek bir kez gösterilir
 *   - Event type: payable_create | invoice_xml | generic
 *   - Olay log: gönderilen payload + işleme sonucu görülebilir
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Eye,
  Plus,
  Trash2,
  Webhook,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

interface InboundEndpoint {
  id: string;
  name: string;
  slug: string;
  event_type: 'payable_create' | 'invoice_xml' | 'generic';
  tenant_id: string | null;
  is_active: boolean;
  last_called_at: string | null;
  call_count: number;
  created_at: string;
}

interface EndpointEvent {
  id: string;
  endpoint_id: string;
  payload: unknown;
  status: 'received' | 'processed' | 'error';
  created_record_id: string | null;
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  payable_create: 'Fatura oluştur',
  invoice_xml: 'e-Fatura UBL XML',
  generic: 'Genel (sadece log)',
};

export function InboundWebhooksPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<InboundEndpoint['event_type']>('payable_create');
  const [revealed, setRevealed] = useState<{ id: string; secret: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['inbound-endpoints'],
    queryFn: async () =>
      (await api.get<{ data: InboundEndpoint[] }>('/inbound-endpoints')).data.data,
  });

  const events = useQuery({
    queryKey: ['inbound-events', selected],
    enabled: !!selected,
    queryFn: async () => {
      const res = await api.get<{ data: EndpointEvent[] }>(`/inbound-endpoints/${selected}/events`);
      return res.data.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: InboundEndpoint & { url: string }; secret: string }>(
        '/inbound-endpoints',
        { name: newName, event_type: newType },
      );
      return res.data;
    },
    onSuccess: (data) => {
      setRevealed({ id: data.data.id, secret: data.secret, url: data.data.url });
      setNewName('');
      qc.invalidateQueries({ queryKey: ['inbound-endpoints'] });
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/inbound-endpoints/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbound-endpoints'] }),
  });

  function copy(s: string, key: string) {
    navigator.clipboard.writeText(s);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Entegrasyonlar</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <Webhook className="size-6" />
          Gelen Webhooks (Inbound)
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Damga, n8n, Zapier gibi sistemler Sayman'a fatura veya event gönderebilir. Her endpoint
          için ayrı slug + HMAC-SHA256 secret üretilir.
        </p>
      </header>

      {/* Yeni endpoint oluşturma */}
      <div className="card mb-6">
        <h2 className="font-semibold text-brand-900 mb-3 flex items-center gap-2">
          <Plus className="size-5" />
          Yeni Endpoint
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Endpoint adı (örn. 'Damga Personel')"
            className="rounded-lg border border-brand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as InboundEndpoint['event_type'])}
            className="rounded-lg border border-brand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="payable_create">Fatura oluştur (JSON)</option>
            <option value="invoice_xml">e-Fatura UBL XML</option>
            <option value="generic">Genel (sadece log)</option>
          </select>
          <button
            onClick={() => {
              setError(null);
              if (newName.length < 2) {
                setError('Ad en az 2 karakter olmalı');
                return;
              }
              create.mutate();
            }}
            disabled={create.isPending}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-1"
          >
            <Plus className="size-4" />
            Oluştur
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Secret reveal (sadece bir kez) */}
      {revealed && (
        <div className="card mb-6 bg-emerald-50 border-emerald-200">
          <h3 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            Endpoint oluşturuldu — bu değerleri kopyala
          </h3>
          <p className="text-xs text-emerald-800 mb-3">
            Secret bir daha gösterilmeyecek. Damga/n8n tarafına yapıştır + güvenli bir yere not al.
          </p>
          <div className="space-y-2 font-mono text-xs">
            <CopyRow
              label="POST URL"
              value={`${window.location.origin.replace(/sayman\./, 'api.sayman.')}${revealed.url}`}
              copyKey="url"
              copied={copied === 'url'}
              onCopy={(v) => copy(v, 'url')}
            />
            <CopyRow
              label="Secret"
              value={revealed.secret}
              copyKey="secret"
              copied={copied === 'secret'}
              onCopy={(v) => copy(v, 'secret')}
            />
            <CopyRow
              label="Header"
              value={`x-sayman-inbound-signature: sha256=<HMAC>`}
              copyKey="header"
              copied={copied === 'header'}
              onCopy={(v) => copy(v, 'header')}
            />
          </div>
          <button
            onClick={() => setRevealed(null)}
            className="mt-3 text-sm text-emerald-900 underline"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Endpoint listesi */}
      <div className="card mb-6">
        <h2 className="font-semibold text-brand-900 mb-3">Endpoint Listesi</h2>
        {list.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
        {list.data?.length === 0 && (
          <p className="text-sm text-brand-500 italic">Henüz endpoint yok.</p>
        )}
        {list.data && list.data.length > 0 && (
          <div className="divide-y divide-brand-100">
            {list.data.map((ep) => (
              <div
                key={ep.id}
                className="py-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-brand-900">{ep.name}</p>
                  <p className="text-xs text-brand-500 font-mono">/v1/inbound/{ep.slug}</p>
                  <p className="text-[10px] text-brand-400 mt-0.5">
                    {EVENT_TYPE_LABEL[ep.event_type]} · {ep.call_count} çağrı
                    {ep.last_called_at && ` · son: ${new Date(ep.last_called_at).toLocaleString('tr-TR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelected(ep.id === selected ? null : ep.id)}
                    className="text-xs text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded flex items-center gap-1"
                  >
                    <Eye className="size-3" />
                    {selected === ep.id ? 'Gizle' : 'Eventler'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`"${ep.name}" silinsin mi?`)) remove.mutate(ep.id);
                    }}
                    className="text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded flex items-center gap-1"
                  >
                    <Trash2 className="size-3" />
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event log */}
      {selected && (
        <div className="card">
          <h2 className="font-semibold text-brand-900 mb-3">Son 50 Event</h2>
          {events.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
          {events.data?.length === 0 && (
            <p className="text-sm text-brand-500 italic">Henüz event yok.</p>
          )}
          {events.data && events.data.length > 0 && (
            <div className="space-y-2">
              {events.data.map((ev) => (
                <details
                  key={ev.id}
                  className={`border rounded-lg p-3 ${
                    ev.status === 'error'
                      ? 'border-red-200 bg-red-50'
                      : ev.status === 'processed'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-brand-200'
                  }`}
                >
                  <summary className="cursor-pointer flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      {ev.status === 'error' ? (
                        <AlertCircle className="size-4 text-red-600" />
                      ) : (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      )}
                      <span className="font-medium">{ev.status}</span>
                      <span className="text-xs text-brand-500 font-mono">
                        {new Date(ev.received_at).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    {ev.created_record_id && (
                      <span className="text-xs text-emerald-700">
                        → kayıt {ev.created_record_id.slice(0, 8)}
                      </span>
                    )}
                  </summary>
                  {ev.error_message && (
                    <p className="text-xs text-red-700 mt-2 bg-white p-2 rounded">
                      {ev.error_message}
                    </p>
                  )}
                  <pre className="text-[10px] mt-2 overflow-x-auto bg-white p-2 rounded max-h-48 font-mono">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: boolean;
  onCopy: (s: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-emerald-700 w-16">{label}</span>
      <code className="flex-1 truncate text-emerald-900">{value}</code>
      <button
        onClick={() => onCopy(value)}
        className="text-emerald-700 hover:bg-emerald-100 p-1 rounded"
        aria-label="Kopyala"
      >
        {copied ? <ClipboardCheck className="size-3.5" /> : <Clipboard className="size-3.5" />}
      </button>
    </div>
  );
}
