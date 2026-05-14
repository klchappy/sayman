import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  category: string;
  priority: 'info' | 'warning' | 'critical';
  action_url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

const PRIORITY_BADGE = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-700',
};

const CATEGORY_LABEL: Record<string, string> = {
  payable_due: 'Fatura Vade',
  task_assigned: 'Görev Atandı',
  task_due: 'Görev Vade',
  system: 'Sistem',
  security: 'Güvenlik',
  audit: 'Denetim',
};

export function NotificationsPage() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const q = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const res = await api.get<{ data: Notification[]; unread_count: number }>(
        `/notifications${unreadOnly ? '?unread=true' : ''}`,
      );
      return res.data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Bildirim Merkezi</p>
          <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
            <Bell className="size-6" />
            Bildirimler
            {q.data && q.data.unread_count > 0 && (
              <span className="text-sm bg-red-500 text-white rounded-full px-2 py-0.5">
                {q.data.unread_count}
              </span>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              unreadOnly
                ? 'bg-brand-900 text-white'
                : 'bg-white border border-brand-200 text-brand-700'
            }`}
          >
            {unreadOnly ? 'Okunmadı' : 'Tümü'}
          </button>
          {q.data && q.data.unread_count > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-brand-600 hover:underline"
            >
              Tümünü okundu işaretle
            </button>
          )}
        </div>
      </header>

      <div className="card">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.data.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">Bildirim yok.</p>
        )}
        <ul className="divide-y divide-brand-100">
          {q.data?.data.map((n) => (
            <li
              key={n.id}
              className={`py-3 flex items-start gap-3 ${
                n.dismissed_at ? 'opacity-40' : ''
              } ${!n.read_at ? 'bg-brand-50/40 -mx-5 px-5' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${PRIORITY_BADGE[n.priority]}`}>
                    {CATEGORY_LABEL[n.category] ?? n.category}
                  </span>
                  <p className="font-medium text-brand-900">{n.title}</p>
                  {!n.read_at && <span className="size-2 rounded-full bg-blue-500" />}
                </div>
                {n.body && <p className="text-sm text-brand-600 mt-0.5">{n.body}</p>}
                <p className="text-xs text-brand-400 mt-1">
                  {new Date(n.created_at).toLocaleString('tr-TR')}
                </p>
                {n.action_url && (
                  <a
                    href={n.action_url}
                    className="text-xs text-brand-700 hover:underline mt-1 inline-block"
                  >
                    Detay →
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {!n.read_at && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="text-brand-400 hover:text-brand-700"
                    title="Okundu işaretle"
                  >
                    <Check className="size-4" />
                  </button>
                )}
                {!n.dismissed_at && (
                  <button
                    onClick={() => dismiss.mutate(n.id)}
                    className="text-brand-400 hover:text-red-600"
                    title="Kapat"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
