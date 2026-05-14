import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Shield, Trash2, UserCog, Users as UsersIcon } from 'lucide-react';
import { useState } from 'react';
import {
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Role,
} from '@sayman/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface OrgUser {
  user_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  last_login_at: string | null;
  role: Role;
  role_label: string;
  created_at: string;
  overrides: Array<{
    tenant_id: string;
    tenant_slug: string;
    tenant_name: string;
    value: string;
  }>;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  tenant_id: string | null;
  expires_at: string;
  created_at: string;
}

const ROLE_BADGE_COLOR: Record<Role, string> = {
  super_admin: 'bg-red-100 text-red-700',
  organization_admin: 'bg-purple-100 text-purple-700',
  yonetici: 'bg-blue-100 text-blue-700',
  muhasebeci: 'bg-emerald-100 text-emerald-700',
  denetci: 'bg-amber-100 text-amber-700',
  personel: 'bg-brand-100 text-brand-700',
  musavir: 'bg-cyan-100 text-cyan-700',
};

export function UsersPage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const [showInvite, setShowInvite] = useState(false);

  const usersQ = useQuery({
    queryKey: ['users', active.orgSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: OrgUser[] }>('/users');
      return res.data.data;
    },
  });

  const invitesQ = useQuery({
    queryKey: ['invitations', active.orgSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: Invitation[] }>('/users/invitations');
      return res.data.data;
    },
  });

  const myRole = me?.organizations.find((o) => o.slug === active.orgSlug)?.role as Role | undefined;
  const canInvite = myRole === 'super_admin' || myRole === 'organization_admin';

  if (!active.orgSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Organizasyon seçilmedi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
            {active.orgSlug}
          </p>
          <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
            <UsersIcon className="size-6" />
            Kullanıcılar
          </h1>
          <p className="text-sm text-brand-500 mt-1">
            Org'a kullanıcı davet et, rol ata, çıkar.
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="size-4" />
            Davet Et
          </button>
        )}
      </header>

      {showInvite && <InviteForm onClose={() => setShowInvite(false)} />}

      {/* Bekleyen davetler */}
      {invitesQ.data && invitesQ.data.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-brand-700 mb-3 flex items-center gap-2">
            <Mail className="size-4" />
            Bekleyen Davetler ({invitesQ.data.length})
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                  <th className="py-2 px-2">E-posta</th>
                  <th className="py-2 px-2">Rol</th>
                  <th className="py-2 px-2">Sona Erecek</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {invitesQ.data.map((inv) => (
                  <InviteRow key={inv.id} inv={inv} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Aktif kullanıcılar */}
      <section>
        <h2 className="text-sm font-semibold text-brand-700 mb-3">
          Aktif Kullanıcılar ({usersQ.data?.length ?? 0})
        </h2>
        <div className="card overflow-x-auto">
          {usersQ.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
          {usersQ.error && (
            <p className="text-sm text-red-600">
              Erişim yok — sadece kullanıcı listesi okuyabilenler bu sayfayı görür.
            </p>
          )}
          {usersQ.data && usersQ.data.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                  <th className="py-2 px-2">Kullanıcı</th>
                  <th className="py-2 px-2">Rol</th>
                  <th className="py-2 px-2">Tenant İstisnaları</th>
                  <th className="py-2 px-2">Son Giriş</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {usersQ.data.map((u) => (
                  <UserRow
                    key={u.user_id}
                    u={u}
                    canEdit={canInvite}
                    isMe={u.user_id === me?.user.id}
                    myRole={myRole}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function UserRow({
  u,
  canEdit,
  isMe,
  myRole,
}: {
  u: OrgUser;
  canEdit: boolean;
  isMe: boolean;
  myRole: Role | undefined;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  // Hierarchy: super_admin'i yalnız başka bir super_admin değiştirebilir
  const canEditThisUser = canEdit && !(u.role === 'super_admin' && myRole !== 'super_admin');

  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`/users/${u.user_id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <tr className="border-b border-brand-50 hover:bg-brand-50">
      <td className="py-3 px-2">
        <p className="font-medium text-brand-900">{u.full_name}</p>
        <p className="text-xs text-brand-500">{u.email}</p>
      </td>
      <td className="py-3 px-2">
        {editing ? (
          <RolePicker
            current={u.role}
            onChange={() => {
              setEditing(false);
              qc.invalidateQueries({ queryKey: ['users'] });
            }}
            userId={u.user_id}
            myRole={myRole}
          />
        ) : (
          <button
            onClick={() => canEditThisUser && !isMe && setEditing(true)}
            disabled={!canEditThisUser || isMe}
            className="cursor-pointer disabled:cursor-default"
            title={
              u.role === 'super_admin' && myRole !== 'super_admin'
                ? 'super_admin rolünü sadece başka bir super_admin değiştirebilir'
                : undefined
            }
          >
            <span className={`badge ${ROLE_BADGE_COLOR[u.role]}`}>{u.role_label}</span>
          </button>
        )}
      </td>
      <td className="py-3 px-2">
        {u.overrides.length === 0 ? (
          <span className="text-xs text-brand-400">-</span>
        ) : (
          <div className="space-y-1">
            {u.overrides.map((o) => (
              <p key={o.tenant_id} className="text-xs text-brand-600">
                <span className="font-mono">{o.tenant_slug}</span>: <strong>{o.value}</strong>
              </p>
            ))}
          </div>
        )}
      </td>
      <td className="py-3 px-2 text-xs text-brand-500">
        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('tr-TR') : '-'}
      </td>
      <td className="py-3 px-2 text-right">
        {canEditThisUser && !isMe && (
          <button
            onClick={() => {
              if (confirm(`${u.full_name} kullanıcısını org'dan çıkar?`)) remove.mutate();
            }}
            disabled={remove.isPending}
            className="text-red-600 hover:bg-red-50 p-1.5 rounded"
            title="Org'dan çıkar"
          >
            <Trash2 className="size-4" />
          </button>
        )}
        {isMe && <span className="text-xs text-brand-400 italic">sen</span>}
        {u.role === 'super_admin' && myRole !== 'super_admin' && !isMe && (
          <span
            className="text-xs text-brand-300 italic"
            title="super_admin korunmaktadır"
          >
            🔒
          </span>
        )}
      </td>
    </tr>
  );
}

function RolePicker({
  current,
  userId,
  myRole,
  onChange,
}: {
  current: Role;
  userId: string;
  myRole: Role | undefined;
  onChange: () => void;
}) {
  const [value, setValue] = useState<Role>(current);

  // Hierarchy: super_admin sadece super_admin tarafından atanabilir
  const allowedRoles = ROLES.filter((r) => {
    if (r === 'super_admin' && myRole !== 'super_admin') return false;
    return true;
  });

  const update = useMutation({
    mutationFn: async () => {
      await api.patch(`/users/${userId}/role`, { role: value });
    },
    onSuccess: () => onChange(),
  });

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as Role)}
        className="rounded border border-brand-200 px-2 py-1 text-xs bg-white"
      >
        {allowedRoles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <button
        onClick={() => update.mutate()}
        disabled={update.isPending || value === current}
        className="text-xs bg-brand-900 text-white px-2 py-1 rounded disabled:opacity-50"
      >
        Kaydet
      </button>
    </div>
  );
}

function InviteRow({ inv }: { inv: Invitation }) {
  const qc = useQueryClient();
  const revoke = useMutation({
    mutationFn: async () => {
      await api.post(`/users/invitations/${inv.id}/revoke`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  });

  return (
    <tr className="border-b border-brand-50">
      <td className="py-2 px-2 font-mono text-xs text-brand-700">{inv.email}</td>
      <td className="py-2 px-2">
        <span className={`badge ${ROLE_BADGE_COLOR[inv.role]}`}>{ROLE_LABELS[inv.role]}</span>
      </td>
      <td className="py-2 px-2 text-xs text-brand-500">
        {new Date(inv.expires_at).toLocaleString('tr-TR')}
      </td>
      <td className="py-2 px-2 text-right">
        <button
          onClick={() => {
            if (confirm('Daveti iptal et?')) revoke.mutate();
          }}
          disabled={revoke.isPending}
          className="text-red-600 hover:bg-red-50 p-1 rounded text-xs"
        >
          İptal
        </button>
      </td>
    </tr>
  );
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('muhasebeci');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionLink, setActionLink] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ action_link: string }>('/users/invite', {
        email,
        role,
        notes: notes || null,
      });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      setActionLink(data.action_link);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4 flex items-center gap-2 text-lg">
          <UserCog className="size-5" />
          Kullanıcı Davet Et
        </h3>

        {actionLink ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700">✓ Davet oluşturuldu.</p>
            <p className="text-xs text-brand-500">
              E-posta gateway yapılandırılmadığı için linki manuel paylaşman gerek:
            </p>
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
              <input
                type="text"
                readOnly
                value={actionLink}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full bg-transparent text-xs font-mono text-brand-800 outline-none"
              />
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(actionLink);
                alert('Link kopyalandı');
              }}
              className="w-full bg-brand-900 text-white py-2 rounded-lg text-sm"
            >
              Linki Kopyala
            </button>
            <button onClick={onClose} className="w-full text-brand-600 py-2 rounded-lg text-sm">
              Kapat
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-brand-500">E-posta *</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@firma.com"
                className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </label>

            <div>
              <span className="text-xs uppercase tracking-wide text-brand-500">Rol *</span>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {ROLES.filter((r) => r !== 'super_admin').map((r) => (
                  <label
                    key={r}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                      role === r
                        ? 'border-brand-700 bg-brand-50'
                        : 'border-brand-100 hover:border-brand-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-brand-900">{ROLE_LABELS[r]}</p>
                      <p className="text-xs text-brand-500">{ROLE_DESCRIPTIONS[r]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-brand-500">Not (ops.)</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-3">
              <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
                İptal
              </button>
              <button
                onClick={() => {
                  setError(null);
                  if (!email) return setError('E-posta gerekli');
                  invite.mutate();
                }}
                disabled={invite.isPending}
                className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 flex items-center gap-2"
              >
                <Shield className="size-4" />
                {invite.isPending ? 'Gönderiliyor…' : 'Davet Gönder'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
