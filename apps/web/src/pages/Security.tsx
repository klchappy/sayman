import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Key, Monitor, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

// --- 2FA --------------------------------------------------------------------

interface TwoFAStatus {
  enabled: boolean;
  enabled_at: string | null;
  recovery_codes_left: number;
  supabase_user?: boolean;
}

interface SetupResponse {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
}

function TwoFASection() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['2fa-status'],
    queryFn: async () => (await api.get<TwoFAStatus>('/security/2fa/status')).data,
  });

  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startSetup = useMutation({
    mutationFn: async () => (await api.post<SetupResponse>('/security/2fa/setup')).data,
    onSuccess: (data) => setSetupData(data),
    onError: (e) => setError(String((e as Error).message)),
  });

  const verifySetup = useMutation({
    mutationFn: async () =>
      (await api.post<{ recovery_codes: string[] }>('/security/2fa/verify', { code })).data,
    onSuccess: (data) => {
      setRecovery(data.recovery_codes);
      setSetupData(null);
      setCode('');
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  const disable = useMutation({
    mutationFn: async () =>
      (await api.post('/security/2fa/disable', { password: disablePassword })).data,
    onSuccess: () => {
      setDisablePassword('');
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  if (status.data?.supabase_user) {
    return (
      <div className="card">
        <h2 className="font-semibold text-brand-900 mb-2 flex items-center gap-2">
          <Shield className="size-5" />
          İki Faktörlü Kimlik Doğrulama
        </h2>
        <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
          2FA yalnız local hesaplarda kullanılır. Önce <a className="underline" href="/auth/forgot-password">şifrenizi yeniden belirleyin</a> → local hesaba geçin.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="font-semibold text-brand-900 mb-4 flex items-center gap-2">
        <Shield className="size-5" />
        İki Faktörlü Kimlik Doğrulama (2FA)
      </h2>

      {error && <p className="text-sm text-red-600 mb-3 bg-red-50 p-2 rounded">{error}</p>}

      {recovery && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded">
          <p className="font-medium text-emerald-900 mb-2">2FA aktif edildi! Recovery kodlarını kaydet:</p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-emerald-800 mb-2">
            {recovery.map((c) => (
              <li key={c} className="bg-white px-2 py-1 rounded border border-emerald-200">{c}</li>
            ))}
          </ul>
          <p className="text-xs text-emerald-700">Bu kodlar bir daha gösterilmeyecek. Güvenli bir yere kopyala.</p>
          <button
            onClick={() => setRecovery(null)}
            className="mt-2 text-sm text-emerald-900 underline"
          >
            Kaydettim, kapat
          </button>
        </div>
      )}

      {status.data?.enabled ? (
        <div>
          <p className="text-sm text-emerald-700 mb-1">
            ✓ Aktif ({status.data.recovery_codes_left} recovery kodu kaldı)
          </p>
          <p className="text-xs text-brand-500 mb-3">
            {status.data.enabled_at && new Date(status.data.enabled_at).toLocaleString('tr-TR')}
          </p>
          <div className="flex gap-2 items-end">
            <label className="flex-1">
              <span className="text-xs text-brand-500">Şifre (devre dışı bırakmak için)</span>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="mt-1 w-full rounded border border-brand-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={() => disable.mutate()}
              disabled={!disablePassword || disable.isPending}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm disabled:opacity-60"
            >
              Devre dışı bırak
            </button>
          </div>
        </div>
      ) : !setupData ? (
        <button
          onClick={() => startSetup.mutate()}
          disabled={startSetup.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
        >
          {startSetup.isPending ? 'Hazırlanıyor…' : 'Aktifleştir'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="p-3 bg-brand-50 rounded">
            <p className="text-xs text-brand-700 mb-2">1. Google Authenticator / 1Password ile QR kodu tara:</p>
            <img src={setupData.qr_data_url} alt="QR" className="w-48 h-48" />
            <p className="text-xs text-brand-500 font-mono mt-2 break-all">
              veya manuel: {setupData.secret}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-700 mb-1">2. Uygulamadaki 6 haneli kodu gir:</p>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-32 rounded border border-brand-200 px-3 py-2 text-lg font-mono text-center"
              placeholder="000000"
            />
          </div>
          <button
            onClick={() => verifySetup.mutate()}
            disabled={code.length !== 6 || verifySetup.isPending}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
          >
            {verifySetup.isPending ? 'Doğrulanıyor…' : 'Doğrula + Aktifleştir'}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Sessions ---------------------------------------------------------------

interface Session {
  id: string;
  jti: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

function SessionsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await api.get<{ data: Session[]; note?: string }>('/auth/sessions')).data,
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => (await api.post(`/auth/sessions/${id}/revoke`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
  const revokeOthers = useMutation({
    mutationFn: async () => (await api.post(`/auth/sessions/revoke-others`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-900 flex items-center gap-2">
          <Monitor className="size-5" />
          Aktif Oturumlar
        </h2>
        <button
          onClick={() => revokeOthers.mutate()}
          className="text-xs text-red-600 hover:underline"
        >
          Diğer hepsini kapat
        </button>
      </div>
      {q.data?.note && <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded mb-3">{q.data.note}</p>}
      {q.data?.data.length === 0 && <p className="text-sm text-brand-500">Aktif oturum yok.</p>}
      <ul className="divide-y divide-brand-100">
        {q.data?.data.map((s) => (
          <li key={s.id} className={`py-3 flex items-center justify-between ${s.revoked_at ? 'opacity-50' : ''}`}>
            <div className="text-sm">
              <p className="font-mono text-brand-900">{s.jti.slice(0, 8)}…</p>
              <p className="text-xs text-brand-500">
                {s.ip_address ?? '?'} ·{' '}
                {s.last_seen_at
                  ? `son: ${new Date(s.last_seen_at).toLocaleString('tr-TR')}`
                  : `başlangıç: ${new Date(s.issued_at).toLocaleString('tr-TR')}`}
              </p>
              {s.user_agent && <p className="text-xs text-brand-400 truncate max-w-md">{s.user_agent}</p>}
            </div>
            {!s.revoked_at && (
              <button
                onClick={() => revoke.mutate(s.id)}
                className="text-red-500 hover:text-red-700"
                title="Sonlandır"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- KVKK Export ------------------------------------------------------------

function KvkkSection() {
  const exportData = useMutation({
    mutationFn: async () => (await api.get('/security/kvkk/export')).data,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sayman-kvkk-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <div className="card">
      <h2 className="font-semibold text-brand-900 mb-2 flex items-center gap-2">
        <Key className="size-5" />
        KVKK Veri İhraç
      </h2>
      <p className="text-sm text-brand-500 mb-3">
        Tüm organization verisi tek bir JSON dosyası olarak indirilir. Şifre hash, TOTP secret,
        jti, IP gibi hassas alanlar dahil değildir.
      </p>
      <button
        onClick={() => exportData.mutate()}
        disabled={exportData.isPending}
        className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
      >
        {exportData.isPending ? 'Hazırlanıyor…' : 'JSON İndir'}
      </button>
    </div>
  );
}

// --- Main page --------------------------------------------------------------

export function SecurityPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Güvenlik</p>
        <h1 className="text-2xl font-semibold text-brand-900">Hesap Güvenliği</h1>
      </header>

      <TwoFASection />
      <SessionsSection />
      <KvkkSection />

      <div className="card bg-amber-50 border border-amber-200">
        <p className="text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5" />
          <span>
            <strong>KVKK Sil:</strong> "Beni unut" işlemi geri alınamaz. Sayman'da bir kullanıcının tüm
            verisini anonimleştirir, tüm oturumlarını kapatır. Sadece super_admin yapabilir.
          </span>
        </p>
      </div>
    </div>
  );
}
