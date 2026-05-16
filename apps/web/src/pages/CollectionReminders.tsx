/**
 * /collection-reminders — Geciken alacaklılara otomatik mesaj kuralları.
 *
 * Tipik kullanım:
 *   - Kural 1: "3 gün geçince nazik hatırlatma" (email, hafif ton)
 *   - Kural 2: "10 gün geçince ikinci hatırlatma" (email, orta ton)
 *   - Kural 3: "30 gün geçince son uyarı" (email + WhatsApp)
 *
 * Mesajda placeholder'lar: {{customer}}, {{amount}}, {{due_date}},
 * {{days_overdue}}, {{invoice_no}}
 *
 * Cron her gün 10:00 TR çalışır. Aynı kural × aynı fatura aynı gün 1 kez.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ReminderRule {
  id: string;
  name: string;
  days_after_due: string;
  channel: 'email' | 'whatsapp' | 'telegram';
  subject: string | null;
  body: string;
  min_amount: string;
  is_active: boolean;
}

interface ReminderRun {
  id: string;
  rule_id: string;
  sales_invoice_id: string;
  channel: string;
  status: 'sent' | 'failed' | 'skipped';
  error_message: string | null;
  sent_at: string;
}

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  whatsapp: MessageSquare,
  telegram: Send,
};

const CHANNEL_LABEL: Record<string, string> = {
  email: 'E-posta',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

const DEFAULT_BODY = `Sayın {{customer}},

{{invoice_no}} numaralı faturanızın vadesi {{due_date}} idi ve {{days_overdue}} gün geçti.
Bakiye: {{amount}}

En kısa sürede ödemeniz için ricamızdır.

Saygılarımızla`;

export function CollectionRemindersPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const list = useQuery({
    queryKey: ['collection-rules', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: ReminderRule[] }>('/collection-reminder-rules');
      return res.data.data;
    },
  });

  const recentRuns = useQuery({
    queryKey: ['collection-runs', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: ReminderRun[] }>('/collection-reminder-runs');
      return res.data.data.slice(0, 30);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/collection-reminder-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-rules'] }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/collection-reminder-rules/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-rules'] }),
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
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Otomasyon</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Send className="size-6" />
            Tahsilat Hatırlatma
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Geciken alacaklılara otomatik mesaj. Her gün 10:00'da çalışır. Müşteri e-posta /
            telefon bilgisi sales_invoices metadata'sında olmalı.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="size-4" />
          Yeni Kural
        </button>
      </header>

      {showForm && <RuleForm onClose={() => setShowForm(false)} />}

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-brand-500 dark:text-slate-400 mb-2">
          Aktif Kurallar
        </h2>
        {list.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
        {list.data && list.data.length === 0 && (
          <div className="card text-center py-8">
            <Send className="size-10 mx-auto text-brand-300 mb-2" />
            <p className="text-brand-700 dark:text-slate-300 font-medium">
              Henüz tahsilat kuralı yok.
            </p>
            <p className="text-xs text-brand-500 mt-1">
              Önerilen başlangıç: 3 gün / 10 gün / 30 gün e-posta kuralları.
            </p>
          </div>
        )}
        {list.data && list.data.length > 0 && (
          <div className="space-y-2">
            {list.data
              .slice()
              .sort((a, b) => Number(a.days_after_due) - Number(b.days_after_due))
              .map((r) => {
                const Icon = CHANNEL_ICON[r.channel] ?? Mail;
                return (
                  <div key={r.id} className="card">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-brand-500" />
                        <h3 className="font-semibold text-brand-900 dark:text-slate-100">
                          {r.name}
                        </h3>
                        <span className="text-xs bg-brand-50 dark:bg-slate-800 text-brand-700 dark:text-slate-300 px-2 py-0.5 rounded">
                          {Number(r.days_after_due)} gün sonra · {CHANNEL_LABEL[r.channel]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={r.is_active}
                            onChange={(e) =>
                              toggleActive.mutate({ id: r.id, is_active: e.target.checked })
                            }
                          />
                          Aktif
                        </label>
                        <button
                          onClick={() => {
                            if (confirm(`"${r.name}" kuralı silinsin mi?`)) remove.mutate(r.id);
                          }}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                    {r.subject && (
                      <p className="text-sm font-medium text-brand-700 dark:text-slate-300">
                        Konu: {r.subject}
                      </p>
                    )}
                    <pre className="text-xs text-brand-600 dark:text-slate-400 mt-1 whitespace-pre-wrap font-sans bg-brand-50/50 dark:bg-slate-800/50 rounded p-2">
                      {r.body}
                    </pre>
                    {Number(r.min_amount) > 0 && (
                      <p className="text-[10px] text-brand-400 mt-2">
                        Minimum tutar: {Number(r.min_amount).toLocaleString('tr-TR')} TL
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {recentRuns.data && recentRuns.data.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-brand-500 dark:text-slate-400 mb-2">
            Son 30 Gönderim
          </h2>
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                  <th className="py-2 px-3">Tarih</th>
                  <th className="py-2 px-3">Kanal</th>
                  <th className="py-2 px-3">Durum</th>
                  <th className="py-2 px-3">Hata</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.data.map((run) => (
                  <tr key={run.id} className="border-b border-brand-50 dark:border-slate-800/50">
                    <td className="py-2 px-3 font-mono text-xs">
                      {new Date(run.sent_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="py-2 px-3">{CHANNEL_LABEL[run.channel] ?? run.channel}</td>
                    <td className="py-2 px-3">
                      {run.status === 'sent' ? (
                        <span className="text-xs text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          Gönderildi
                        </span>
                      ) : run.status === 'skipped' ? (
                        <span className="text-xs text-amber-700">Atlandı</span>
                      ) : (
                        <span className="text-xs text-red-700">Hata</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs text-red-600">{run.error_message ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function RuleForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [days, setDays] = useState(7);
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'telegram'>('email');
  const [subject, setSubject] = useState('Vadesi geçen faturanız hakkında');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [minAmount, setMinAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/collection-reminder-rules', {
        name,
        days_after_due: days,
        channel,
        subject: channel === 'email' ? subject : null,
        body,
        min_amount: minAmount,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-rules'] });
      onClose();
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="card mb-4 border-brand-300 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-brand-900 dark:text-slate-100">
          Yeni Hatırlatma Kuralı
        </h3>
        <button
          onClick={onClose}
          className="text-brand-500 hover:text-brand-900 dark:text-slate-400"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kural adı (örn: 3 gün hafif hatırlatma)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm sm:col-span-2"
        />
        <label className="text-xs text-brand-500 dark:text-slate-400">
          Vade geçince kaç gün sonra: <strong>{days} gün</strong>
          <input
            type="range"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full"
          />
        </label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as typeof channel)}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        >
          <option value="email">E-posta (Resend)</option>
          <option value="whatsapp">WhatsApp Business</option>
          <option value="telegram">Telegram</option>
        </select>
        {channel === 'email' && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="E-posta konusu"
            className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm sm:col-span-2"
          />
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Mesaj — placeholders: {{customer}}, {{amount}}, {{due_date}}, {{days_overdue}}, {{invoice_no}}"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm font-mono sm:col-span-2"
        />
        <label className="text-xs text-brand-500 dark:text-slate-400">
          Minimum tutar (TL) — bu altındakilere yollama
          <input
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <p className="text-[10px] text-brand-400 dark:text-slate-500 mt-2">
        Placeholders: <code>{'{{customer}}'}</code>, <code>{'{{amount}}'}</code>,{' '}
        <code>{'{{due_date}}'}</code>, <code>{'{{days_overdue}}'}</code>,{' '}
        <code>{'{{invoice_no}}'}</code>
      </p>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onClose}
          className="text-sm text-brand-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800 px-3 py-2 rounded"
        >
          İptal
        </button>
        <button
          onClick={() => {
            setError(null);
            if (name.length < 2) return setError('Ad zorunlu');
            if (body.length < 10) return setError('Mesaj zorunlu');
            create.mutate();
          }}
          disabled={create.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Kaydet
        </button>
      </div>
    </div>
  );
}
