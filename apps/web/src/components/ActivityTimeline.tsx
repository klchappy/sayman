/**
 * ActivityTimeline — herhangi bir kayıt için audit + payment timeline.
 *
 * Kullanım: <ActivityTimeline targetType="payable_items" targetId="..." />
 */
import { useQuery } from '@tanstack/react-query';
import { Activity, Check, Edit, Plus, Trash2, Wallet } from 'lucide-react';
import { api } from '../lib/api';

interface TimelineEvent {
  id: string;
  kind: 'audit' | 'payment' | 'creation';
  timestamp: string;
  title: string;
  description?: string;
  actor_email?: string | null;
  details?: Record<string, unknown>;
}

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  creation: Plus,
  audit: Edit,
  payment: Wallet,
};

const KIND_COLOR: Record<string, string> = {
  creation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  audit: 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-slate-300',
  payment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
};

function ActionIcon({ action }: { action: string }) {
  const upper = action.toUpperCase();
  for (const [key, Icon] of Object.entries(ACTION_ICON)) {
    if (upper.includes(key)) return <Icon className="size-3" />;
  }
  return <Check className="size-3" />;
}

export function ActivityTimeline({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  const q = useQuery({
    queryKey: ['activity', targetType, targetId],
    queryFn: async () => {
      const res = await api.get<{ data: TimelineEvent[] }>(`/activity/${targetType}/${targetId}`);
      return res.data.data;
    },
  });

  if (q.isLoading) return <p className="text-sm text-brand-500">Yükleniyor…</p>;

  if (!q.data || q.data.length === 0) {
    return (
      <div className="text-sm text-brand-500 dark:text-slate-400 text-center py-4">
        Henüz aktivite kaydı yok.
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-brand-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        <Activity className="size-4" />
        Aktivite Akışı
      </h3>
      <div className="relative">
        {/* Dikey çizgi */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-brand-100 dark:bg-slate-800" />
        <ul className="space-y-3">
          {q.data.map((event) => {
            const KindIcon = KIND_ICON[event.kind] ?? Activity;
            return (
              <li key={event.id} className="flex items-start gap-3 relative">
                <div
                  className={`relative z-10 size-6 grid place-items-center rounded-full ${KIND_COLOR[event.kind] ?? KIND_COLOR.audit}`}
                >
                  {event.kind === 'audit' ? (
                    <ActionIcon action={event.title} />
                  ) : (
                    <KindIcon className="size-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-brand-900 dark:text-slate-100">
                      {event.title}
                    </p>
                    <span className="text-[10px] text-brand-400 font-mono">
                      {new Date(event.timestamp).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-xs text-brand-600 dark:text-slate-400 mt-0.5">
                      {event.description}
                    </p>
                  )}
                  {event.actor_email && (
                    <p className="text-[10px] text-brand-400 mt-0.5">
                      {event.actor_email}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
