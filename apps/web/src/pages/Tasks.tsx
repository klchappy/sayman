import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'new' | 'in_progress' | 'waiting' | 'postponed' | 'done' | 'cancelled';
  due_date: string | null;
  completed_at: string | null;
  is_active: boolean;
  created_at: string;
}

const PRIORITY_BADGE: Record<Task['priority'], string> = {
  low: 'bg-brand-100 text-brand-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<Task['status'], string> = {
  new: 'Yeni',
  in_progress: 'Devam ediyor',
  waiting: 'Bekliyor',
  postponed: 'Ertelendi',
  done: 'Tamamlandı',
  cancelled: 'İptal',
};

const STATUS_BADGE: Record<Task['status'], string> = {
  new: 'bg-brand-100 text-brand-700',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting: 'bg-amber-100 text-amber-700',
  postponed: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-brand-100 text-brand-500',
};

export function TasksPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'mine' | 'open'>('open');
  const [showForm, setShowForm] = useState(false);

  const q = useQuery({
    queryKey: ['tasks', active.orgSlug, active.tenantSlug, active.aggregate, filter],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'mine') params.set('mine', 'true');
      const res = await api.get<{ data: Task[] }>(`/tasks?${params}`);
      // Frontend filter: 'open' = done dışı
      const all = res.data.data;
      if (filter === 'open') return all.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
      return all;
    },
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; status: Task['status'] }) =>
      api.patch(`/tasks/${input.id}`, { status: input.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  if (!active.tenantSlug && !active.aggregate) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşeden bir şirket seç veya "Tüm Şirketler" seç.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
            {active.orgSlug} / {active.tenantSlug}
          </p>
          <h1 className="text-2xl font-semibold text-brand-900">Görevler</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Görev
        </button>
      </header>

      <div className="flex gap-2 mb-4 text-sm items-center flex-wrap">
        {(['open', 'mine', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg ${
              filter === f
                ? 'bg-brand-900 text-white'
                : 'bg-white border border-brand-200 text-brand-700 hover:bg-brand-50'
            }`}
          >
            {f === 'open' ? 'Açık' : f === 'mine' ? 'Bana Atananlar' : 'Tümü'}
          </button>
        ))}
        {filter === 'open' && (
          <span className="text-xs text-brand-500 dark:text-slate-400 ml-2">
            (tamamlanan ve iptal edilen görevler gizli)
          </span>
        )}
      </div>

      {showForm && <TaskForm onClose={() => setShowForm(false)} />}

      <div className="card">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <EmptyState
            entityLabel="görev"
            hasActiveFilter={filter !== 'all'}
            filterDescription={
              filter === 'open'
                ? "Açık görev yok. Tamamlanan/iptal edilenleri görmek için 'Tümü' filtresine geç."
                : 'Sana atanmış görev yok.'
            }
            onClearFilter={() => setFilter('all')}
          />
        )}
        <ul className="divide-y divide-brand-100">
          {q.data?.map((t) => (
            <li key={t.id} className="py-3 flex items-start gap-3">
              <button
                onClick={() =>
                  update.mutate({
                    id: t.id,
                    status: t.status === 'done' ? 'new' : 'done',
                  })
                }
                className="mt-0.5 text-brand-400 hover:text-brand-700"
              >
                {t.status === 'done' ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Circle className="size-5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${t.status === 'done' ? 'line-through text-brand-400' : 'text-brand-900'}`}>
                  {t.title}
                </p>
                {t.description && (
                  <p className="text-xs text-brand-500 mt-0.5">{t.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                  {t.due_date && (
                    <span className="text-xs text-brand-500 flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(t.due_date).toLocaleString('tr-TR', { dateStyle: 'short' })}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm(`"${t.title}" iptal edilsin mi?`)) del.mutate(t.id);
                }}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('normal');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      api.post('/tasks', {
        title,
        description: description || null,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">Yeni Görev</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Başlık *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Açıklama</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-brand-500">Öncelik</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task['priority'])}
                className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base bg-white"
              >
                <option value="low">Düşük</option>
                <option value="normal">Normal</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-brand-500">Vade</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!title) return setError('Başlık zorunlu');
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
