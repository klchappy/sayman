import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { setLocalToken } from '../../lib/local-auth';

interface SignUpResponse {
  access_token: string;
  organization: { id: string; slug: string; name: string };
}

export function SignUpOrgPage() {
  const navigate = useNavigate();
  const refreshMe = useAuth((s) => s.refreshMe);
  const setActive = useAuth((s) => s.setActive);
  const [accountType, setAccountType] = useState<'company' | 'individual'>('company');
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acceptTerms || !acceptKvkk) {
      setError('Şartlar ve KVKK metnini onayla');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<SignUpResponse>('/auth/local/sign-up-org', {
        account_type: accountType,
        org_name: accountType === 'individual' ? fullName : orgName,
        full_name: fullName,
        email,
        password,
        accept_terms: true,
        accept_kvkk: true,
      });
      setLocalToken(res.data.access_token);
      // Active org seç (yeni yaratılan)
      setActive({ orgSlug: res.data.organization.slug, tenantSlug: null });
      await refreshMe();
      navigate('/', { replace: true });
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center px-6 py-10">
      <div className="card w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-12 rounded-xl bg-brand-900 text-white grid place-items-center text-xl font-semibold">
            Sy
          </div>
          <div>
            <h1 className="text-xl font-semibold text-brand-900">Sayman'a Kayıt</h1>
            <p className="text-xs text-brand-500">Yeni organizasyon oluştur</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <span className="text-xs uppercase tracking-wide text-brand-500">Hesap Türü</span>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setAccountType('company')}
                className={`flex-1 py-2 rounded-lg border text-sm ${
                  accountType === 'company'
                    ? 'border-brand-700 bg-brand-50 text-brand-900'
                    : 'border-brand-200 text-brand-500'
                }`}
              >
                Kurumsal
              </button>
              <button
                type="button"
                onClick={() => setAccountType('individual')}
                className={`flex-1 py-2 rounded-lg border text-sm ${
                  accountType === 'individual'
                    ? 'border-brand-700 bg-brand-50 text-brand-900'
                    : 'border-brand-200 text-brand-500'
                }`}
              >
                Bireysel
              </button>
            </div>
          </div>

          {accountType === 'company' && (
            <Field label="Şirket/Holding Adı *" value={orgName} onChange={setOrgName} required />
          )}
          <Field label="Adınız Soyadınız *" value={fullName} onChange={setFullName} required />
          <Field label="E-posta *" type="email" value={email} onChange={setEmail} required />
          <Field
            label="Şifre * (büyük/küçük/rakam, min 8)"
            type="password"
            value={password}
            onChange={setPassword}
            required
          />

          <label className="flex items-start gap-2 text-xs text-brand-600">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            Kullanım koşullarını okudum, onaylıyorum.
          </label>
          <label className="flex items-start gap-2 text-xs text-brand-600">
            <input
              type="checkbox"
              checked={acceptKvkk}
              onChange={(e) => setAcceptKvkk(e.target.checked)}
            />
            KVKK aydınlatma metnini okudum, kişisel verilerimin işlenmesini onaylıyorum.
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-900 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn className="size-4" />
            {loading ? 'Hesap oluşturuluyor…' : 'Kayıt Ol + Giriş'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-brand-500">
          Zaten hesabın var mı?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-brand-700 hover:underline"
          >
            Giriş yap
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-brand-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </label>
  );
}
