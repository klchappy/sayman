/**
 * /inbox — Eylem-odaklı "bugün ne yapmam gerek" paneli.
 *
 * Dashboard'dan farkı: Sayman'ı her sabah açan kullanıcının
 * NET bir eylem listesi görmesidir. KPI değil — yapılacak işler.
 */
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CheckSquare,
  Clock,
  Inbox,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface InboxData {
  total_action_count: number;
  sections: {
    overdue_invoices: Array<{
      id: string;
      title: string;
      amount: string;
      due_date: string | null;
      supplier_name: string | null;
    }>;
    approaching_invoices: Array<{
      id: string;
      title: string;
      amount: string;
      due_date: string | null;
      supplier_name: string | null;
    }>;
    expiring_guarantees: Array<{
      id: string;
      beneficiary_name: string;
      letter_no: string;
      amount: string;
      expiry_date: string;
    }>;
    assigned_tasks: Array<{
      id: string;
      title: string;
      due_date: string | null;
      priority: string;
      status: string;
    }>;
    unread_anomalies: Array<{
      id: string;
      title: string;
      body: string;
      priority: string;
      action_url: string | null;
      created_at: string;
    }>;
  };
}

import { fmtTRYShort as fmtTRY } from '../lib/formatting';

export function InboxPage() {
  const me = useAuth((s) => s.me);
  const q = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => {
      const res = await api.get<{ data: InboxData }>('/inbox');
      return res.data.data;
    },
    refetchInterval: 60_000,
  });

  const greeting = getGreeting();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Inbox</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <Inbox className="size-6" />
          {greeting}, {me?.user.full_name?.split(' ')[0] ?? 'kullanıcı'}
        </h1>
        {q.data && (
          <p className="text-sm text-brand-500 mt-1">
            {q.data.total_action_count === 0
              ? 'Bugün acil bir iş görünmüyor — temiz başlangıç ☕'
              : `Bugün senin için ${q.data.total_action_count} eylem var. Aşağıdan başla.`}
          </p>
        )}
      </header>

      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}

      {q.data && (
        <div className="space-y-6">
          {/* Geciken faturalar */}
          {q.data.sections.overdue_invoices.length > 0 && (
            <Section
              title="🚨 Geciken Faturalar"
              count={q.data.sections.overdue_invoices.length}
              color="red"
              link="/payables"
            >
              <ul className="divide-y divide-red-100">
                {q.data.sections.overdue_invoices.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/payables/${p.id}`}
                        className="font-medium text-brand-900 hover:text-red-700"
                      >
                        {p.title}
                      </Link>
                      <p className="text-xs text-brand-500">
                        Vade: {p.due_date ?? '-'} {p.supplier_name && `· ${p.supplier_name}`}
                      </p>
                    </div>
                    <p className="font-mono text-red-700 font-semibold">{fmtTRY(p.amount)}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Yaklaşan faturalar */}
          {q.data.sections.approaching_invoices.length > 0 && (
            <Section
              title="⏰ Yaklaşan Faturalar (7 gün)"
              count={q.data.sections.approaching_invoices.length}
              color="amber"
              link="/payables"
            >
              <ul className="divide-y divide-amber-100">
                {q.data.sections.approaching_invoices.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/payables/${p.id}`}
                        className="font-medium text-brand-900 hover:text-amber-700"
                      >
                        {p.title}
                      </Link>
                      <p className="text-xs text-brand-500">
                        Vade: {p.due_date ?? '-'} {p.supplier_name && `· ${p.supplier_name}`}
                      </p>
                    </div>
                    <p className="font-mono text-amber-700 font-semibold">{fmtTRY(p.amount)}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Anomaliler */}
          {q.data.sections.unread_anomalies.length > 0 && (
            <Section
              title="⚠️ İncelenmemiş Anomaliler"
              count={q.data.sections.unread_anomalies.length}
              color="purple"
              link="/notifications"
            >
              <ul className="space-y-2">
                {q.data.sections.unread_anomalies.map((n) => (
                  <li key={n.id} className="bg-purple-50/50 rounded p-2.5">
                    <div className="flex items-start gap-2">
                      <Sparkles className="size-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-brand-900">{n.title}</p>
                        <p className="text-xs text-brand-700 mt-0.5">{n.body}</p>
                        {n.action_url && (
                          <Link
                            to={n.action_url}
                            className="text-xs text-purple-700 hover:text-purple-900 mt-1 inline-block"
                          >
                            İncele →
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Teminat dolanlar */}
          {q.data.sections.expiring_guarantees.length > 0 && (
            <Section
              title="🛡️ 30 Gün İçinde Dolacak Teminat Mektupları"
              count={q.data.sections.expiring_guarantees.length}
              color="amber"
              link="/guarantees"
              icon={<ShieldCheck className="size-4" />}
            >
              <ul className="divide-y divide-amber-100">
                {q.data.sections.expiring_guarantees.map((g) => (
                  <li key={g.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-brand-900">{g.beneficiary_name}</p>
                      <p className="text-xs text-brand-500 font-mono">
                        #{g.letter_no} · Vade: {g.expiry_date}
                      </p>
                    </div>
                    <p className="font-mono text-amber-700">{fmtTRY(g.amount)}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Görevler */}
          {q.data.sections.assigned_tasks.length > 0 && (
            <Section
              title="✓ Sana Atanmış Görevler"
              count={q.data.sections.assigned_tasks.length}
              color="blue"
              link="/tasks"
              icon={<CheckSquare className="size-4" />}
            >
              <ul className="divide-y divide-blue-100">
                {q.data.sections.assigned_tasks.map((t) => (
                  <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/tasks"
                        className="font-medium text-brand-900 hover:text-blue-700"
                      >
                        {t.title}
                      </Link>
                      <p className="text-xs text-brand-500">
                        Vade: {t.due_date ?? '-'} ·{' '}
                        <span
                          className={
                            t.priority === 'urgent'
                              ? 'text-red-600 font-medium'
                              : t.priority === 'high'
                                ? 'text-amber-600'
                                : ''
                          }
                        >
                          {t.priority}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Boş durum */}
          {q.data.total_action_count === 0 && (
            <div className="card text-center py-12 bg-emerald-50 border-emerald-200">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-emerald-900 font-medium">Tüm işler kontrol altında!</p>
              <p className="text-sm text-emerald-700 mt-1">
                Geciken fatura, yaklaşan vade, açık görev veya işlenmemiş anomali yok.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi öğleden sonra';
  return 'İyi akşamlar';
}

function Section({
  title,
  count,
  color,
  link,
  children,
  icon,
}: {
  title: string;
  count: number;
  color: 'red' | 'amber' | 'purple' | 'blue';
  link: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const borderClass = {
    red: 'border-red-200 bg-red-50/30',
    amber: 'border-amber-200 bg-amber-50/30',
    purple: 'border-purple-200 bg-purple-50/30',
    blue: 'border-blue-200 bg-blue-50/30',
  }[color];
  const badgeClass = {
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    blue: 'bg-blue-100 text-blue-700',
  }[color];
  return (
    <section className={`card ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-brand-900 flex items-center gap-2">
          {icon}
          {title}
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>{count}</span>
        </h2>
        <Link to={link} className="text-xs text-brand-600 hover:text-brand-900">
          Tümü →
        </Link>
      </div>
      {children}
    </section>
  );
}
