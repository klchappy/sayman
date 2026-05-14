import { useMutation, useQuery } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROLE_LABELS, type Role } from '@sayman/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface InviteInfo {
  email: string;
  role: Role;
  role_label: string;
  org_name: string;
  org_slug: string;
  expires_at: string;
}

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const refreshMe = useAuth((s) => s.refreshMe);
  const setActive = useAuth((s) => s.setActive);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verifyQ = useQuery({
    queryKey: ['invitation-verify', token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const res = await api.get<{ data: InviteInfo }>(`/users/invitations/${token}/verify`);
      return res.data.data;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ access_token: string }>('/users/accept-invite', {
        token,
        full_name: fullName,
        password,
      });
      return res.data;
    },
    onSuccess: async (data) => {
      localStorage.setItem('sayman-local-token', data.access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
      await refreshMe();
      if (verifyQ.data) setActive({ orgSlug: verifyQ.data.org_slug, tenantSlug: null });
      navigate('/', { replace: true });
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  if (!token) return null;

  if (verifyQ.isLoading) {
    return (
      <div className="min-h-full grid place-items-center text-brand-500">
        Davet doğrulanıyor…
      </div>
    );
  }

  if (verifyQ.error) {
    const err = verifyQ.error as { response?: { data?: { error?: string } } };
    return (
      <div className="min-h-full grid place-items-center px-6">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold text-red-700 mb-2">Davet Geçersiz</h1>
          <p className="text-sm text-brand-600">
            {err.response?.data?.error ?? 'Davet linki süresi dolmuş veya geçersiz.'}
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 text-brand-700 underline text-sm"
          >
            Giriş sayfasına dön
          </button>
        </div>
      </div>
    );
  }

  const info = verifyQ.data!;

  return (
    <div className="min-h-full grid place-items-center px-6 py-10">
      <div className="card w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-12 rounded-xl bg-brand-900 text-white grid place-items-center text-xl font-semibold">
            Sy
          </div>
          <div>
            <h1 className="text-xl font-semibold text-brand-900">Sayman'a Hoş Geldin</h1>
            <p className="text-xs text-brand-500">{info.org_name} davet etti</p>
          </div>
        </div>

        <div className="mb-4 bg-brand-50 border border-brand-100 rounded-lg p-3 text-sm text-brand-700">
          <p>
            <span className="text-brand-500">E-posta:</span> <strong>{info.email}</strong>
          </p>
          <p>
            <span className="text-brand-500">Rol:</span> <strong>{info.role_label}</strong>
          </p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Adın Soyadın *</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">
              Şifre * (büyük/küçük/rakam, min 8)
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={() => {
              setError(null);
              if (!fullName) return setError('Ad soyad gerekli');
              if (!password || password.length < 8) return setError('Şifre en az 8 karakter');
              accept.mutate();
            }}
            disabled={accept.isPending}
            className="w-full bg-brand-900 hover:bg-brand-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn className="size-4" />
            {accept.isPending ? 'Hesap oluşturuluyor…' : 'Kabul Et + Giriş Yap'}
          </button>
        </div>
      </div>
    </div>
  );
}
