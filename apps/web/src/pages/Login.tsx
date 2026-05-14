import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const signIn = useAuth((s) => s.signIn);
  const loading = useAuth((s) => s.loading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
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
            <h1 className="text-xl font-semibold text-brand-900">Sayman</h1>
            <p className="text-xs text-brand-500">Giriş yapın</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">E-posta</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Parola</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-900 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn className="size-4" />
            {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-brand-100 text-center text-xs text-brand-500 space-y-1">
          <p>
            <a href="/auth/forgot-password" className="text-brand-700 hover:underline">
              Şifremi unuttum
            </a>
          </p>
          <p>
            Hesabın yok mu?{' '}
            <a href="/auth/sign-up-org" className="text-brand-700 hover:underline">
              Yeni organizasyon kayıt
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
