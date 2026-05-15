import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Code, Key, Monitor, Send, Shield, Smartphone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

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

// --- Telegram --------------------------------------------------------------

interface TelegramStatus {
  configured: boolean;
  bot_username: string | null;
  bot_name: string | null;
  my_chat_id: string | null;
  start_url: string | null;
}

function TelegramSection() {
  const qc = useQueryClient();
  const [chatIdInput, setChatIdInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['telegram-status'],
    queryFn: async () => (await api.get<{ data: TelegramStatus }>('/users/me/telegram')).data.data,
  });

  const link = useMutation({
    mutationFn: async () => api.post('/users/me/telegram/chat-id', { chat_id: chatIdInput }),
    onSuccess: () => {
      setChatIdInput('');
      qc.invalidateQueries({ queryKey: ['telegram-status'] });
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  const unlink = useMutation({
    mutationFn: async () => api.delete('/users/me/telegram/chat-id'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telegram-status'] }),
  });

  const sendTest = useMutation({
    mutationFn: async () => (await api.post<{ data: { delivered: string } }>('/users/me/telegram/test')).data.data,
    onSuccess: (data) => {
      setTestResult(`Sonuç: ${data.delivered}`);
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  if (!status.data) {
    return (
      <div className="card">
        <p className="text-brand-500 text-sm">Yükleniyor…</p>
      </div>
    );
  }

  const s = status.data;

  return (
    <div className="card">
      <h2 className="font-semibold text-brand-900 mb-4 flex items-center gap-2">
        <Send className="size-5" />
        Telegram Bildirimleri
      </h2>

      {!s.configured && (
        <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg mb-4">
          Telegram bot henüz yapılandırılmadı (TELEGRAM_BOT_TOKEN env eksik).
          Yapılandırıldığında bildirimler otomatik gelecek.
        </p>
      )}

      {s.configured && !s.my_chat_id && (
        <div className="space-y-3">
          <p className="text-sm text-brand-700">
            Yaklaşan vade, fatura ve onay uyarılarını Telegram'da almak için bot'a bağlan:
          </p>
          <ol className="text-sm text-brand-600 list-decimal list-inside space-y-1">
            <li>
              {s.bot_username && (
                <>
                  Bot'a tıkla:{' '}
                  <a
                    href={`https://t.me/${s.bot_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-900 underline font-medium"
                  >
                    @{s.bot_username}
                  </a>
                </>
              )}
            </li>
            <li>Botla sohbete <code className="bg-brand-50 px-1 rounded">/start</code> gönder</li>
            <li>
              Bot sana 5-10 haneli bir <strong>chat_id</strong> verecek (örnek: <code>123456789</code>)
            </li>
            <li>O chat_id'yi aşağıdaki kutuya yapıştır</li>
          </ol>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              placeholder="Telegram chat_id (örn: 123456789)"
              value={chatIdInput}
              onChange={(e) => setChatIdInput(e.target.value)}
              className="flex-1 rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              onClick={() => {
                setError(null);
                if (!chatIdInput) return setError('chat_id gerekli');
                link.mutate();
              }}
              disabled={link.isPending}
              className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              Bağla
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {s.configured && s.my_chat_id && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-sm text-emerald-800">
              ✓ Telegram bağlı — chat_id:{' '}
              <code className="font-mono">{s.my_chat_id.slice(0, 4)}***{s.my_chat_id.slice(-2)}</code>
            </p>
            {s.bot_username && (
              <p className="text-xs text-emerald-600 mt-1">
                Bot: <a href={`https://t.me/${s.bot_username}`} target="_blank" rel="noopener noreferrer" className="underline">@{s.bot_username}</a>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTestResult(null);
                setError(null);
                sendTest.mutate();
              }}
              disabled={sendTest.isPending}
              className="bg-brand-200 hover:bg-brand-300 text-brand-900 px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {sendTest.isPending ? 'Gönderiliyor…' : 'Test Mesajı Gönder'}
            </button>
            <button
              onClick={() => {
                if (confirm('Telegram bağlantısı kaldırılsın mı?')) unlink.mutate();
              }}
              disabled={unlink.isPending}
              className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm"
            >
              Bağlantıyı Kaldır
            </button>
          </div>
          {testResult && <p className="text-sm text-emerald-700">{testResult}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

// --- API Tokens --------------------------------------------------------------

interface ApiToken {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  revoked_at: string | null;
  created_at: string;
}

function ApiTokensSection() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['api-tokens'],
    queryFn: async () => (await api.get<{ data: ApiToken[] }>('/api-tokens')).data.data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post<{ data: ApiToken; token: string }>('/api-tokens', { name: newName })).data,
    onSuccess: (data) => {
      setRevealedToken(data.token);
      setNewName('');
      qc.invalidateQueries({ queryKey: ['api-tokens'] });
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => api.delete(`/api-tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-tokens'] }),
  });

  return (
    <div className="card">
      <h2 className="font-semibold text-brand-900 mb-4 flex items-center gap-2">
        <Code className="size-5" />
        API Token'ları (programmatic erişim)
      </h2>
      <p className="text-sm text-brand-500 mb-4">
        Diğer programların Sayman API'sine erişmesi için token oluştur. Token sadece bir kez gösterilir,
        sonra DB'de hash olarak saklanır. <code className="font-mono bg-brand-50 px-1 rounded">Bearer st_...</code> formatı.
      </p>

      {revealedToken && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-amber-800 mb-2">
            ⚠️ Token bir kez gösterilir — hemen kopyala!
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={revealedToken}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 font-mono text-xs px-2 py-1 bg-white rounded border border-amber-300"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(revealedToken);
                alert('Kopyalandı');
              }}
              className="px-3 py-1 bg-brand-900 text-white rounded text-xs"
            >
              Kopyala
            </button>
            <button
              onClick={() => setRevealedToken(null)}
              className="px-3 py-1 text-brand-600 rounded text-xs"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Token adı (örn: Damga entegrasyonu)"
          className="flex-1 rounded-lg border border-brand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          onClick={() => {
            setError(null);
            if (!newName) return setError('Ad gerekli');
            create.mutate();
          }}
          disabled={create.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
        >
          {create.isPending ? 'Üretiliyor…' : 'Yeni Token Üret'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {list.data && list.data.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
              <th className="py-2">Ad</th>
              <th className="py-2">Prefix</th>
              <th className="py-2">Son Kullanım</th>
              <th className="py-2">Durum</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((t) => (
              <tr key={t.id} className="border-b border-brand-50">
                <td className="py-2 font-medium text-brand-900">{t.name}</td>
                <td className="py-2 font-mono text-xs text-brand-600">{t.token_prefix}...</td>
                <td className="py-2 text-xs text-brand-500">
                  {t.last_used_at ? new Date(t.last_used_at).toLocaleString('tr-TR') : '-'}
                </td>
                <td className="py-2">
                  {t.revoked_at ? (
                    <span className="badge bg-red-100 text-red-700">İptal</span>
                  ) : t.expires_at && new Date(t.expires_at) < new Date() ? (
                    <span className="badge bg-amber-100 text-amber-700">Süresi doldu</span>
                  ) : (
                    <span className="badge bg-emerald-100 text-emerald-700">Aktif</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {!t.revoked_at && (
                    <button
                      onClick={() => {
                        if (confirm(`"${t.name}" token'ı iptal edilsin mi?`)) revoke.mutate(t.id);
                      }}
                      className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                      title="İptal et"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface PushDevice {
  id: string;
  platform: 'ios' | 'android' | 'web';
  app_version: string | null;
  last_seen_at: string | null;
  created_at: string;
}

function PushDevicesSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['push-tokens'],
    queryFn: async () => (await api.get<{ data: PushDevice[] }>('/push/tokens')).data,
  });
  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/push/tokens/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-tokens'] }),
  });

  const platformLabel: Record<string, string> = {
    ios: 'iOS',
    android: 'Android',
    web: 'Web',
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-brand-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Smartphone className="size-5" />
        Push Bildirim Cihazları
      </h2>
      {q.data?.data.length === 0 && (
        <p className="text-sm text-brand-500 dark:text-slate-400">
          Kayıtlı cihaz yok. Mobil uygulamayı ilk açtığında otomatik kaydedilir.
        </p>
      )}
      <ul className="divide-y divide-brand-100 dark:divide-slate-700">
        {q.data?.data.map((d) => (
          <li key={d.id} className="py-3 flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium text-brand-900 dark:text-slate-100">
                {platformLabel[d.platform] ?? d.platform}
                {d.app_version && (
                  <span className="ml-2 text-xs text-brand-500 dark:text-slate-400">
                    v{d.app_version}
                  </span>
                )}
              </p>
              <p className="text-xs text-brand-500 dark:text-slate-400">
                {d.last_seen_at
                  ? `Son: ${new Date(d.last_seen_at).toLocaleString('tr-TR')}`
                  : `Kayıt: ${new Date(d.created_at).toLocaleString('tr-TR')}`}
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm('Cihaz çıkarılsın mı?')) del.mutate(d.id);
              }}
              className="text-red-500 hover:text-red-700"
              title="Çıkar"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CRON_JOBS: { name: string; label: string; description: string }[] = [
  { name: 'generate-periods', label: 'Dönem Üret', description: 'Subscription/regular payment dönemleri' },
  { name: 'send-reminders', label: 'Hatırlatma', description: 'Vade yaklaşan ödemeler' },
  { name: 'update-statuses', label: 'Durum Güncelle', description: 'Süresi geçen ödemeleri overdue yap' },
  { name: 'fetch-fx-rates', label: 'Döviz Kuru', description: 'TCMB döviz kurlarını çek' },
  { name: 'deliver-webhooks', label: 'Webhook Gönder', description: 'Bekleyen webhook teslimleri' },
  { name: 'detect-anomalies', label: 'Anomali Tespiti', description: 'Şüpheli işlem analizi' },
  { name: 'generate-ai-summary', label: 'AI Özet', description: 'Aylık AI raporu' },
  { name: 'embed-payables', label: 'Semantic Embed', description: 'Eksik embeddingleri üret' },
  { name: 'sync-erp-connections', label: 'ERP Senkron', description: 'Aktif ERP bağlantılarını çek' },
  { name: 'generate-tax-calendar', label: 'Vergi Takvimi', description: 'Gelecek dönemleri oluştur' },
  { name: 'budget-alerts', label: 'Bütçe Uyarı', description: 'Bütçe aşımı bildirimleri' },
  { name: 'check-due-alerts', label: 'Çek Vade Uyarı', description: 'Vadesi yaklaşan çek/senet' },
  { name: 'send-collection-reminders', label: 'Tahsilat Hatırlatma', description: 'Bekleyen tahsilatlar' },
  { name: 'run-depreciation', label: 'Amortisman', description: 'Aylık amortisman hesabı' },
];

function CronJobsSection() {
  const [output, setOutput] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async (job: string) =>
      (await api.post<{ data: { job: string; result: unknown; duration_ms: number } }>(
        `/jobs/run-now/${job}`,
      )).data.data,
  });

  const handleRun = async (job: string) => {
    setRunning(job);
    try {
      const res = await run.mutateAsync(job);
      setOutput((prev) => ({
        ...prev,
        [job]: `OK (${res.duration_ms}ms) - ${JSON.stringify(res.result)}`,
      }));
    } catch (e) {
      setOutput((prev) => ({
        ...prev,
        [job]: `HATA: ${(e as Error).message}`,
      }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="card border-2 border-red-200 dark:border-red-900/50">
      <h2 className="font-semibold text-brand-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        <AlertCircle className="size-5 text-red-500" />
        Cron Manuel Tetik (super_admin)
      </h2>
      <p className="text-xs text-brand-500 dark:text-slate-400 mb-4">
        Production'da 3 cron schedule otomatik çalışır. Buradan elle tetiklemek operasyonel debug içindir.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {CRON_JOBS.map((j) => (
          <div
            key={j.name}
            className="border border-brand-100 dark:border-slate-700 rounded-lg p-3 flex items-start justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-900 dark:text-slate-100">{j.label}</p>
              <p className="text-xs text-brand-500 dark:text-slate-400 truncate">{j.description}</p>
              {output[j.name] && (
                <p
                  className={`text-xs mt-1 font-mono break-all ${
                    output[j.name]!.startsWith('HATA') ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {output[j.name]}
                </p>
              )}
            </div>
            <button
              onClick={() => handleRun(j.name)}
              disabled={running === j.name}
              className="text-xs px-2 py-1 rounded bg-brand-900 hover:bg-brand-700 disabled:opacity-50 text-white shrink-0"
            >
              {running === j.name ? '…' : 'Çalıştır'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SecurityPage() {
  const me = useAuth((s) => s.me);
  const isSuperAdmin = me?.organizations.some((o) => o.role === 'super_admin') ?? false;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Güvenlik</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100">Hesap Güvenliği</h1>
      </header>

      <TwoFASection />
      <TelegramSection />
      <ApiTokensSection />
      <SessionsSection />
      <PushDevicesSection />
      <KvkkSection />
      {isSuperAdmin && <CronJobsSection />}

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
