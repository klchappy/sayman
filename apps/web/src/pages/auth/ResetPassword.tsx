import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { setLocalToken } from '../../lib/local-auth';

interface VerifyResponse {
  ok: boolean;
  email?: string;
  reason?: 'expired' | 'used' | 'not_found';
}
interface ResetResponse {
  ok: boolean;
  access_token: string;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const refreshMe = useAuth((s) => s.refreshMe);
  const [verifying, setVerifying] = useState(true);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyResult({ ok: false, reason: 'not_found' });
      return;
    }
    api
      .post<VerifyResponse>('/auth/reset-password/verify', { token })
      .then((r) => setVerifyResult(r.data))
      .catch(() => setVerifyResult({ ok: false, reason: 'not_found' }))
      .finally(() => setVerifying(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // double-click guard
    setError(null);
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Şifre min 8 karakter olmalı, büyük/küçük harf + rakam içermeli');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<ResetResponse>('/auth/reset-password', { token, password });
      setLocalToken(res.data.access_token);
      await refreshMe();
      navigate('/', { replace: true });
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return <div className="p-8 text-brand-500 text-center">Token doğrulanıyor…</div>;
  }

  if (!verifyResult?.ok) {
    return (
      <div className="min-h-full grid place-items-center px-6">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold text-red-700 mb-2">Token geçersiz</h1>
          <p className="text-sm text-brand-500 mb-4">
            {verifyResult?.reason === 'expired' && 'Bu link süresi geçti.'}
            {verifyResult?.reason === 'used' && 'Bu link zaten kullanıldı.'}
            {verifyResult?.reason === 'not_found' && 'Geçersiz link.'}
          </p>
          <Link to="/auth/forgot-password" className="text-brand-700 hover:underline text-sm">
            Yeni link iste →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full grid place-items-center px-6 py-10">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-semibold text-brand-900 mb-2">Yeni Şifre Belirle</h1>
        <p className="text-sm text-brand-500 mb-6">{verifyResult.email}</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Yeni Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Şifre Tekrar</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-900 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-60"
          >
            {loading ? 'Kaydediliyor…' : 'Şifreyi Belirle + Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
