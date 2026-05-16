/**
 * /destek — Destek talepleri sayfası.
 *
 * Normal kullanıcı: kendi açtığı talepleri görür + yeni manuel talep açabilir.
 * Admin (super_admin / organization_admin): org'daki tüm talepleri görür,
 *   status değiştirebilir, internal_notes ekleyebilir.
 *
 * Otomatik 'auto_error' talepleri ErrorBoundary (frontend crash) ve
 * errorHandler (backend 500) tarafından otomatik açılır — burada listelenirler.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  HeadphonesIcon,
  HelpCircle,
  Lightbulb,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface SupportTicket {
  id: string;
  title: string;
  category: 'bug' | 'feature_request' | 'question' | 'auto_error';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  tenant_id: string | null;
  tenant_name: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  error_context: {
    url?: string;
    route_path?: string;
    error_name?: string;
    stack?: string;
    occurrences?: number;
    source?: string;
  } | null;
}

const CATEGORY_LABEL: Record<SupportTicket['category'], string> = {
  bug: 'Hata Bildirimi',
  feature_request: 'Özellik İsteği',
  question: 'Soru',
  auto_error: 'Otomatik Hata',
};

const CATEGORY_ICON: Record<SupportTicket['category'], typeof Bug> = {
  bug: Bug,
  feature_request: Lightbulb,
  question: HelpCircle,
  auto_error: AlertCircle,
};

const STATUS_LABEL: Record<SupportTicket['status'], string> = {
  open: 'Açık',
  in_progress: 'İşlemde',
  resolved: 'Çözüldü',
  closed: 'Kapalı',
};

const STATUS_BADGE: Record<SupportTicket['status'], string> = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

const PRIORITY_LABEL: Record<SupportTicket['priority'], string> = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
  urgent: 'Acil',
};

export function SupportPage() {
  const qc = useQueryClient();
  const me = useAuth((s) => s.me);
  const active = useAuth((s) => s.active);
  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const isAdmin = role === 'super_admin' || role === 'organization_admin';

  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'open' | 'all'>('open');

  const q = useQuery({
    queryKey: ['support-tickets', active.orgSlug, tab],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const status = tab === 'open' ? 'open' : '';
      const res = await api.get<{ data: SupportTicket[]; is_admin_view: boolean }>(
        `/support/tickets${status ? `?status=${status}` : ''}`,
      );
      return res.data;
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Destek</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <HeadphonesIcon className="size-6" />
            Destek Talepleri
            {isAdmin && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                Admin
              </span>
            )}
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Sorun bildirimi, özellik isteği veya soru için talep aç.
            <strong className="text-brand-700 dark:text-slate-300"> Otomatik Hata</strong> kategorisindeki
            talepler, sistem hatalarında otomatik açılır.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="size-4" />
          Yeni Talep
        </button>
      </header>

      {/* Tab filter */}
      <div className="flex gap-2 mb-4 border-b border-brand-100 dark:border-slate-800">
        <button
          onClick={() => setTab('open')}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            tab === 'open'
              ? 'border-brand-900 text-brand-900 dark:text-slate-100 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          Açık Talepler
        </button>
        <button
          onClick={() => setTab('all')}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            tab === 'all'
              ? 'border-brand-900 text-brand-900 dark:text-slate-100 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          Tümü
        </button>
      </div>

      {showForm && <CreateTicketModal onClose={() => setShowForm(false)} />}

      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
      {q.data && q.data.data.length === 0 && (
        <div className="card text-center py-12">
          <CheckCircle2 className="size-10 mx-auto text-emerald-500 mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">Açık talep yok</p>
          <p className="text-xs text-brand-500 dark:text-slate-400 mt-1">
            Sistem hatasız çalışıyor. İhtiyaç olursa yeni talep aç.
          </p>
        </div>
      )}
      {q.data && q.data.data.length > 0 && (
        <div className="space-y-2">
          {q.data.data.map((t) => (
            <TicketRow key={t.id} ticket={t} isAdmin={isAdmin} onChange={() =>
              qc.invalidateQueries({ queryKey: ['support-tickets'] })
            } />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  isAdmin,
  onChange,
}: {
  ticket: SupportTicket;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICON[ticket.category];

  const patch = useMutation({
    mutationFn: async (body: { status?: SupportTicket['status']; priority?: SupportTicket['priority'] }) =>
      api.patch(`/support/tickets/${ticket.id}`, body),
    onSuccess: onChange,
  });

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 size-9 rounded-lg grid place-items-center ${
            ticket.category === 'auto_error'
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
              : ticket.category === 'bug'
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
                : ticket.category === 'feature_request'
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
          }`}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_BADGE[ticket.status]}`}>
              {STATUS_LABEL[ticket.status]}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-brand-400">
              {CATEGORY_LABEL[ticket.category]}
            </span>
            {ticket.priority === 'urgent' && (
              <span className="text-[10px] uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded">
                ACİL
              </span>
            )}
            {ticket.tenant_name && (
              <span className="text-[10px] uppercase tracking-wide bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                {ticket.tenant_name}
              </span>
            )}
            {ticket.error_context?.occurrences && ticket.error_context.occurrences > 1 && (
              <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded">
                {ticket.error_context.occurrences}× tekrar
              </span>
            )}
          </div>
          <h3 className="font-medium text-brand-900 dark:text-slate-100 truncate">{ticket.title}</h3>
          <div className="flex items-center gap-3 text-xs text-brand-500 dark:text-slate-400 mt-1">
            {ticket.user_name && <span>👤 {ticket.user_name}</span>}
            <span>{new Date(ticket.created_at).toLocaleString('tr-TR')}</span>
            {ticket.error_context?.route_path && (
              <span className="font-mono">{ticket.error_context.route_path}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <button
              onClick={() => patch.mutate({ status: 'resolved' })}
              disabled={patch.isPending}
              className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              Çözüldü
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs px-2 py-1 rounded border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800"
          >
            {expanded ? 'Kapat' : 'Detay'}
          </button>
        </div>
      </div>

      {expanded && ticket.error_context && (
        <details className="mt-3 ml-12">
          <summary className="cursor-pointer text-xs text-brand-500 dark:text-slate-400">
            Hata bağlamı
          </summary>
          <pre className="mt-2 text-[10px] font-mono bg-brand-50 dark:bg-slate-800 p-2 rounded overflow-x-auto max-h-60">
            {JSON.stringify(ticket.error_context, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('question');
  const [priority, setPriority] = useState<SupportTicket['priority']>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (title.trim().length < 3) {
      setError('Başlık en az 3 karakter olmalı');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/support/tickets', {
        title: title.trim(),
        description: description.trim() || null,
        category,
        priority,
      });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? (err as Error).message ?? 'Hata');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full shadow-xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-brand-100 dark:border-slate-800">
          <h3 className="font-semibold text-brand-900 dark:text-slate-100">Yeni Destek Talebi</h3>
          <button type="button" onClick={onClose} className="text-brand-500 hover:text-brand-900 p-1">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-brand-500 mb-1">
              Başlık
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={255}
              className="w-full px-3 py-2 border border-brand-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-brand-900 dark:text-slate-100"
              placeholder="Kısa özet..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-brand-500 mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportTicket['category'])}
                className="w-full px-3 py-2 border border-brand-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-brand-900 dark:text-slate-100"
              >
                <option value="question">Soru</option>
                <option value="bug">Hata Bildirimi</option>
                <option value="feature_request">Özellik İsteği</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-brand-500 mb-1">
                Öncelik
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SupportTicket['priority'])}
                className="w-full px-3 py-2 border border-brand-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-brand-900 dark:text-slate-100"
              >
                <option value="low">{PRIORITY_LABEL.low}</option>
                <option value="normal">{PRIORITY_LABEL.normal}</option>
                <option value="high">{PRIORITY_LABEL.high}</option>
                <option value="urgent">{PRIORITY_LABEL.urgent}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-brand-500 mb-1">
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={5000}
              className="w-full px-3 py-2 border border-brand-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-brand-900 dark:text-slate-100"
              placeholder="Detayları, hata mesajını veya istediğin özelliği yaz..."
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-brand-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-md"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm bg-brand-900 hover:bg-brand-700 text-white rounded-md flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="size-4" />
            {submitting ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
      </form>
    </div>
  );
}
