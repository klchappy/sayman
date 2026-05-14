import { Mail, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface ForgotResponse {
  ok: boolean;
  delivered?: 'sent' | 'link_generated' | 'fallback';
  action_link?: string;
  fallback_url?: string;
  message?: string;
}

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [method, setMethod] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [result, setResult] = useState<ForgotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await api.post<ForgotResponse>('/auth/forgot-password', {
        identifier,
        method,
      });
      setResult(res.data);
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
        <h1 className="text-xl font-semibold text-brand-900 mb-2">Şifremi Unuttum</h1>
        <p className="text-sm text-brand-500 mb-6">
          E-posta, telefon veya WhatsApp ile sıfırlama linki gönderelim.
        </p>

        {!result && (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-brand-500">
                E-posta / Kullanıcı adı / Telefon
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </label>

            <div>
              <span className="text-xs uppercase tracking-wide text-brand-500">Kanal</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['email', 'sms', 'whatsapp'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-2 rounded-lg border text-sm flex items-center justify-center gap-1 ${
                      method === m
                        ? 'border-brand-700 bg-brand-50 text-brand-900'
                        : 'border-brand-200 text-brand-500'
                    }`}
                  >
                    {m === 'email' ? <Mail className="size-3" /> : <Phone className="size-3" />}
                    {m === 'email' ? 'E-posta' : m === 'sms' ? 'SMS' : 'WhatsApp'}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-900 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-60"
            >
              {loading ? 'Gönderiliyor…' : 'Sıfırlama linki gönder'}
            </button>
          </form>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-brand-700">
              {result.message ?? 'Eğer kayıtlı bir hesap varsa, sıfırlama linki gönderildi.'}
            </p>
            {(result.action_link || result.fallback_url) && (
              <div className="text-xs bg-amber-50 border border-amber-200 rounded p-3">
                <p className="font-medium text-amber-800 mb-1">Gateway henüz yapılandırılmadı:</p>
                <p className="text-amber-700 mb-2">Linki manuel kullanabilirsin:</p>
                <a
                  href={result.action_link ?? result.fallback_url}
                  className="text-amber-900 underline break-all font-mono"
                >
                  {result.action_link ?? result.fallback_url}
                </a>
              </div>
            )}
            <button
              onClick={() => setResult(null)}
              className="text-xs text-brand-600 hover:underline"
            >
              Başka kanal dene →
            </button>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-brand-500">
          <Link to="/login" className="text-brand-700 hover:underline">
            ← Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  );
}
