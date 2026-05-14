/**
 * /onboarding — yeni org açıldıktan sonra 4 adımlık kurulum sihirbazı.
 *
 *   Adım 1: Tenant (sektör) seç + slug
 *   Adım 2: İlk fatura ekle (örnek veriden hızlı seçim de var)
 *   Adım 3: İlk ödemeyi yap (önceki adımdaki faturaya)
 *   Adım 4: Diğer kullanıcı davet et (opsiyonel)
 *
 * Her adım atlayabilir/geçilebilir. Final ekranı tebrik + dashboard'a yönlendirir.
 * State sadece browser memory'sinde tutulur — UI demosu.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  Check,
  Mail,
  Receipt,
  Rocket,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTORS, type Sector } from '@sayman/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface OnboardingState {
  step: number;
  tenant_slug?: string;
  tenant_sector?: Sector;
  payable_id?: string;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const [state, setState] = useState<OnboardingState>({ step: 1 });

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-2">Sayman'a hoş geldin</p>
          <h1 className="text-3xl font-bold text-brand-900">
            {me?.user.full_name?.split(' ')[0] ?? 'Merhaba'}, 4 hızlı adımda başlayalım
          </h1>
          <p className="text-brand-600 mt-2 text-sm">
            Yaklaşık 2 dakika. İstediğin adımı atlayabilirsin.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  state.step > s
                    ? 'bg-emerald-500'
                    : state.step === s
                      ? 'bg-brand-900'
                      : 'bg-brand-100'
                }`}
              />
              <p
                className={`text-[10px] text-center mt-1 ${
                  state.step >= s ? 'text-brand-900 font-medium' : 'text-brand-400'
                }`}
              >
                {['Tenant', 'Fatura', 'Ödeme', 'Davet'][s - 1]}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {state.step === 1 && <Step1 state={state} setState={setState} />}
          {state.step === 2 && <Step2 state={state} setState={setState} />}
          {state.step === 3 && <Step3 state={state} setState={setState} />}
          {state.step === 4 && <Step4 onFinish={() => navigate('/inbox')} />}
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/inbox')}
            className="text-sm text-brand-500 hover:text-brand-900"
          >
            Atla → direkt panele git
          </button>
        </div>
      </div>
    </div>
  );
}

function Step1({
  state,
  setState,
}: {
  state: OnboardingState;
  setState: (s: OnboardingState) => void;
}) {
  const active = useAuth((s) => s.active);
  const [name, setName] = useState('');
  const [sector, setSector] = useState<Sector>('diger');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
      await api.post('/tenants', {
        organization_id: active.orgSlug,
        name,
        slug,
        sector,
      });
      return slug;
    },
    onSuccess: (slug) => {
      setState({ ...state, step: 2, tenant_slug: slug, tenant_sector: sector });
    },
    onError: (e) => {
      const err = e as { response?: { data?: { message?: string; error?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  return (
    <>
      <h2 className="font-semibold text-brand-900 text-lg mb-1 flex items-center gap-2">
        <Building2 className="size-5" />
        Adım 1 / 4: Tenant Oluştur
      </h2>
      <p className="text-sm text-brand-500 mb-4">
        Tenant = senin işkolun. "Avukatlık Bürosu", "Ana Holding", "Sigorta Acentesi" gibi. Her
        tenant kendi verisini ayrı tutar.
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-brand-500">Tenant adı</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. ABC Avukatlık Ofisi"
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-brand-500">Sektör</span>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as Sector)}
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={() => setState({ ...state, step: 2 })}
          className="text-sm text-brand-500 hover:text-brand-900 px-3 py-2"
        >
          Atla
        </button>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || name.length < 2}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? 'Oluşturuluyor…' : 'Oluştur ve devam et'}
          <ArrowRight className="size-3" />
        </button>
      </div>
    </>
  );
}

function Step2({
  state,
  setState,
}: {
  state: OnboardingState;
  setState: (s: OnboardingState) => void;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { id: string } }>('/payables', {
        title,
        amount,
        currency: 'TRY',
        owner_type: 'company',
      });
      return res.data.data.id;
    },
    onSuccess: (id) => setState({ ...state, step: 3, payable_id: id }),
    onError: (e) =>
      setError(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (e as Error).message,
      ),
  });

  return (
    <>
      <h2 className="font-semibold text-brand-900 text-lg mb-1 flex items-center gap-2">
        <Receipt className="size-5" />
        Adım 2 / 4: İlk Fatura
      </h2>
      <p className="text-sm text-brand-500 mb-4">
        Örnek bir fatura ekleyelim ki ödeme akışını görebilesin. İstersen sonra silebilirsin.
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-brand-500">Fatura adı</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. Türk Telekom Şubat 2026"
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-brand-500">Tutar (TL)</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Örn. 350"
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={() => setState({ ...state, step: 3 })}
          className="text-sm text-brand-500 hover:text-brand-900 px-3 py-2"
        >
          Atla
        </button>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || title.length < 2 || !amount}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? 'Kaydediliyor…' : 'Fatura oluştur'}
          <ArrowRight className="size-3" />
        </button>
      </div>
    </>
  );
}

function Step3({
  state,
  setState,
}: {
  state: OnboardingState;
  setState: (s: OnboardingState) => void;
}) {
  const [paid, setPaid] = useState(false);
  const create = useMutation({
    mutationFn: async () => {
      if (!state.payable_id) throw new Error('Fatura yok');
      await api.post('/payments', {
        payable_id: state.payable_id,
        paid_at: new Date().toISOString().slice(0, 10),
        amount: '100',
        method: 'havale',
      });
    },
    onSuccess: () => {
      setPaid(true);
      setTimeout(() => setState({ ...state, step: 4 }), 800);
    },
  });

  return (
    <>
      <h2 className="font-semibold text-brand-900 text-lg mb-1 flex items-center gap-2">
        <Wallet className="size-5" />
        Adım 3 / 4: İlk Ödeme
      </h2>
      <p className="text-sm text-brand-500 mb-4">
        Az önce oluşturduğun faturaya örnek bir kısmi ödeme ekleyelim (100 TL).
      </p>
      {paid ? (
        <div className="text-center py-6">
          <Check className="size-12 text-emerald-500 mx-auto mb-2" />
          <p className="text-emerald-900 font-medium">Ödeme kaydedildi.</p>
        </div>
      ) : (
        <button
          onClick={() => create.mutate()}
          disabled={!state.payable_id || create.isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? 'Kaydediliyor…' : 'Örnek ödemeyi kaydet (100 TL)'}
        </button>
      )}
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={() => setState({ ...state, step: 4 })}
          className="text-sm text-brand-500 hover:text-brand-900 px-3 py-2"
        >
          Atla
        </button>
      </div>
    </>
  );
}

function Step4({ onFinish }: { onFinish: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const queryClient = useQueryClient();
  const invite = useMutation({
    mutationFn: async () => {
      await api.post('/invitations', { email, role: 'organization_admin' });
    },
    onSuccess: () => {
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  return (
    <>
      <h2 className="font-semibold text-brand-900 text-lg mb-1 flex items-center gap-2">
        <Mail className="size-5" />
        Adım 4 / 4: Ekip Üyesi Davet Et (Opsiyonel)
      </h2>
      <p className="text-sm text-brand-500 mb-4">
        Sayman'ı tek başına kullanmana gerek yok. Muhasebeci, yönetici veya bir asistan davet et.
      </p>
      {sent ? (
        <div className="text-center py-6">
          <Check className="size-12 text-emerald-500 mx-auto mb-2" />
          <p className="text-emerald-900 font-medium">Davet yollandı.</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@sirket.com"
            className="flex-1 rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={() => invite.mutate()}
            disabled={!email.includes('@') || invite.isPending}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
          >
            {invite.isPending ? '…' : 'Davet Yolla'}
          </button>
        </div>
      )}
      <div className="flex justify-center mt-8">
        <button
          onClick={onFinish}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg text-sm flex items-center gap-2 font-medium"
        >
          <Rocket className="size-4" />
          Tamam, Sayman'a başla
        </button>
      </div>
    </>
  );
}
