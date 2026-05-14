/**
 * /tax-calendar — Türk vergi takvimi.
 *
 * Otomatik üretilen ve manuel eklenen vergi/beyanname tarihlerini gösterir.
 * Tamamlandıkça işaretlenir, geciken otomatik late olur (cron olmasa da görsel).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface TaxEvent {
  id: string;
  kind: string;
  label: string;
  period: string;
  due_date: string;
  estimated_amount: string | null;
  status: 'pending' | 'submitted' | 'paid' | 'late' | 'cancelled';
  notes: string | null;
  completed_at: string | null;
}

const KIND_LABEL: Record<string, string> = {
  kdv: 'KDV',
  muhtasar: 'Muhtasar',
  gecici_vergi: 'Geçici Vergi',
  kurumlar_vergisi: 'Kurumlar Vergisi',
  mtv: 'MTV',
  bagkur: 'BAĞ-KUR',
  sgk: 'SGK',
  damga: 'Damga',
  custom: 'Özel',
};

const KIND_COLOR: Record<string, string> = {
  kdv: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  muhtasar: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  gecici_vergi: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  kurumlar_vergisi: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  mtv: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  bagkur: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  sgk: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  damga: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  custom: 'bg-brand-100 text-brand-800 dark:bg-slate-800 dark:text-slate-300',
};

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

function daysUntil(due: string): number {
  const d = new Date(due);
  const now = new Date();
  return Math.floor((d.getTime() - now.getTime()) / 86_400_000);
}

export function TaxCalendarPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['tax-calendar', active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: TaxEvent[] }>('/tax-calendar?upcoming=true');
      return res.data.data;
    },
  });

  const regen = useMutation({
    mutationFn: async () => api.post('/tax-calendar/regenerate'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-calendar'] }),
  });

  const complete = useMutation({
    mutationFn: async (id: string) => api.post(`/tax-calendar/${id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-calendar'] }),
  });

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
        </div>
      </div>
    );
  }

  // Grupla: bu hafta, bu ay, sonraki ay
  const grouped: Record<string, TaxEvent[]> = { 'Bu hafta (<=7 gün)': [], 'Bu ay (<=30 gün)': [], 'Sonraki ay+': [] };
  for (const e of q.data ?? []) {
    const d = daysUntil(e.due_date);
    if (d <= 7) grouped['Bu hafta (<=7 gün)']!.push(e);
    else if (d <= 30) grouped['Bu ay (<=30 gün)']!.push(e);
    else grouped['Sonraki ay+']!.push(e);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Türkiye Vergi</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays className="size-6" />
            Vergi Takvimi
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            KDV, Muhtasar, Geçici Vergi, MTV, SGK, BAĞ-KUR, Damga, Kurumlar Vergisi son tarihleri.
            Otomatik üretilir, manuel ekleyebilirsin.
          </p>
        </div>
        <button
          onClick={() => regen.mutate()}
          disabled={regen.isPending}
          className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-2 rounded flex items-center gap-1"
        >
          {regen.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Yeniden Üret
        </button>
      </header>

      {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}

      {q.data && q.data.length === 0 && (
        <div className="card text-center py-12">
          <CalendarDays className="size-12 mx-auto text-brand-300 mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            Vergi takvimi henüz oluşturulmamış.
          </p>
          <button
            onClick={() => regen.mutate()}
            className="mt-3 bg-brand-900 text-white px-4 py-2 rounded-lg text-sm"
          >
            Şimdi Oluştur
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([groupName, events]) => {
        if (events.length === 0) return null;
        return (
          <section key={groupName} className="mb-6">
            <h2 className="text-xs uppercase tracking-wider text-brand-500 dark:text-slate-400 mb-2">
              {groupName} · {events.length}
            </h2>
            <div className="space-y-2">
              {events.map((e) => {
                const d = daysUntil(e.due_date);
                const isImminent = d <= 7;
                return (
                  <div
                    key={e.id}
                    className={`card flex items-center justify-between gap-3 flex-wrap ${
                      isImminent
                        ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-800'
                        : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded ${KIND_COLOR[e.kind] ?? KIND_COLOR.custom}`}
                        >
                          {KIND_LABEL[e.kind] ?? e.kind}
                        </span>
                        <span className="text-xs text-brand-500 dark:text-slate-400 font-mono">
                          {e.period}
                        </span>
                      </div>
                      <p className="font-medium text-brand-900 dark:text-slate-100">{e.label}</p>
                      <p className="text-xs text-brand-500 dark:text-slate-400 mt-0.5">
                        Son tarih: <strong className="font-mono">{e.due_date}</strong> ·{' '}
                        <span
                          className={
                            d <= 3
                              ? 'text-red-600 font-medium'
                              : d <= 7
                                ? 'text-amber-700'
                                : ''
                          }
                        >
                          {d > 0 ? `${d} gün kaldı` : d === 0 ? 'BUGÜN' : `${Math.abs(d)} gün geçti`}
                        </span>
                      </p>
                    </div>
                    {e.estimated_amount && (
                      <p className="font-mono text-sm text-brand-700 dark:text-slate-300">
                        {fmtTRY(e.estimated_amount)}
                      </p>
                    )}
                    <button
                      onClick={() => complete.mutate(e.id)}
                      disabled={complete.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1 disabled:opacity-60"
                    >
                      <Check className="size-3" />
                      Tamamlandı
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
