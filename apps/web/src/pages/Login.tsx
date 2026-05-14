import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';

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

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-full grid place-items-center px-6">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Supabase yapılandırılmamış</h1>
          <p className="text-sm text-brand-600">
            <code className="font-mono">VITE_SUPABASE_URL</code> ve{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> env değişkenleri eksik.
            Production'da Coolify'da Build Arguments olarak set edilmelidir.
          </p>
        </div>
      </div>
    );
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
      </div>
    </div>
  );
}
