/**
 * /sirketler — Org içindeki tenant'ları (şirketleri) yönet.
 *
 * Yetki: super_admin, organization_admin, yonetici
 * Aksiyonlar:
 *   - Yeni şirket aç (Plus button → CreateTenantModal)
 *   - Şirket detayını düzenle (ad, sektör, VKN, modüller)
 *   - Aktif/Pasif toggle (soft delete)
 *   - Kalıcı sil (super_admin only — cascade tüm veriler!)
 *
 * Aktif tenant switcher'da görünür, pasif olan görünmez.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { SECTOR_LABELS, type Sector } from '@sayman/shared';
import { AuditHistoryButton } from '../components/AuditHistoryButton';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  sector: Sector;
  sector_label: string;
  tax_number: string | null;
  is_active: boolean;
  active_modules: string[];
  effective_modules: string[];
  created_at: string;
  updated_at: string;
}

const SECTOR_OPTIONS: Array<{ value: Sector; label: string }> = [
  { value: 'tekstil', label: 'Tekstil' },
  { value: 'enerji', label: 'Enerji' },
  { value: 'insaat', label: 'İnşaat' },
  { value: 'gayrimenkul', label: 'Gayrimenkul' },
  { value: 'kisisel', label: 'Kişisel / Aile' },
  { value: 'sanayi', label: 'Sanayi' },
  { value: 'hukuk', label: 'Hukuk Bürosu' },
  { value: 'diger', label: 'Diğer' },
];

export function TenantsManagementPage() {
  const me = useAuth((s) => s.me);
  const active = useAuth((s) => s.active);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const myRole = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canManage = ['super_admin', 'organization_admin', 'yonetici'].includes(myRole ?? '');
  const isSuperAdmin = myRole === 'super_admin';

  const q = useQuery({
    queryKey: ['tenants-management', active.orgSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: Tenant[] }>(`/tenants?org=${active.orgSlug}`);
      return res.data.data;
    },
  });

  if (!active.orgSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Organizasyon seçilmedi</p>
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <AlertTriangle className="size-8 text-amber-600 mx-auto mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">Yetki yok</p>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Şirket yönetimi için yönetici (yonetici / organization_admin / super_admin) yetkisi gerekli.
          </p>
        </div>
      </div>
    );
  }

  const activeTenants = (q.data ?? []).filter((t) => t.is_active);
  const inactiveTenants = (q.data ?? []).filter((t) => !t.is_active);

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Yönetim</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="size-7" />
            Şirketler
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Organizasyondaki tenant'ları (şirketleri) yönet. Her tenant kendi izole verisine sahiptir;
            aktif tenant TenantSwitcher dropdown'ında görünür.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Şirket
        </button>
      </header>

      {q.isLoading && (
        <div className="card text-center py-12 text-brand-500 dark:text-slate-400">
          Yükleniyor…
        </div>
      )}

      {/* Aktif şirketler */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-brand-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          Aktif Şirketler ({activeTenants.length})
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {activeTenants.map((t) => (
            <TenantCard
              key={t.id}
              tenant={t}
              editing={editingId === t.id}
              onEdit={() => setEditingId(t.id)}
              onCancelEdit={() => setEditingId(null)}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
          {activeTenants.length === 0 && q.data && (
            <p className="text-sm text-brand-500 col-span-2 text-center py-4">
              Henüz aktif şirket yok. "Yeni Şirket" ile başla.
            </p>
          )}
        </div>
      </section>

      {/* Pasif şirketler */}
      {inactiveTenants.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-brand-500 dark:text-slate-400 mb-3 flex items-center gap-2">
            <PowerOff className="size-4" />
            Pasif Şirketler ({inactiveTenants.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {inactiveTenants.map((t) => (
              <TenantCard
                key={t.id}
                tenant={t}
                editing={editingId === t.id}
                onEdit={() => setEditingId(t.id)}
                onCancelEdit={() => setEditingId(null)}
                isSuperAdmin={isSuperAdmin}
              />
            ))}
          </div>
        </section>
      )}

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function TenantCard({
  tenant,
  editing,
  onEdit,
  onCancelEdit,
  isSuperAdmin,
}: {
  tenant: Tenant;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  isSuperAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(tenant.name);
  const [sector, setSector] = useState<Sector>(tenant.sector);
  const [taxNumber, setTaxNumber] = useState(tenant.tax_number ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/tenants/${tenant.id}`, {
        name,
        sector,
        tax_number: taxNumber || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants-management'] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      onCancelEdit();
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e as Error).message);
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (tenant.is_active) {
        await api.delete(`/tenants/${tenant.id}`);
      } else {
        await api.post(`/tenants/${tenant.id}/reactivate`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants-management'] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const hardDelete = useMutation({
    mutationFn: async () => {
      await api.delete(`/tenants/${tenant.id}?hard=true`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants-management'] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e as Error).message ?? 'Silme başarısız');
    },
  });

  return (
    <div
      className={`relative bg-white dark:bg-slate-900 rounded-xl border overflow-hidden ${
        tenant.is_active
          ? 'border-brand-100 dark:border-slate-800'
          : 'border-brand-100 dark:border-slate-800 opacity-70'
      }`}
    >
      {/* Sol stripe — sektöre göre */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          tenant.is_active ? 'bg-gradient-to-b from-brand-500 to-brand-700' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      />

      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input font-semibold text-base w-full"
              />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-brand-900 dark:text-slate-100">
                  {tenant.name}
                </h3>
                <span className="text-[10px] font-mono bg-brand-100 dark:bg-slate-800 text-brand-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                  {tenant.slug}
                </span>
                {!tenant.is_active && (
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                    PASİF
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-brand-400">Sektör</p>
            {editing ? (
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value as Sector)}
                className="input w-full mt-1"
              >
                {SECTOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-brand-700 dark:text-slate-300">{tenant.sector_label}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-brand-400">VKN</p>
            {editing ? (
              <input
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="1234567890"
                className="input w-full mt-1 font-mono"
              />
            ) : (
              <p className="font-mono text-brand-700 dark:text-slate-300">
                {tenant.tax_number ?? <span className="text-brand-400 italic">-</span>}
              </p>
            )}
          </div>
        </div>

        <p className="text-[10px] text-brand-400 dark:text-slate-500 mb-3">
          {tenant.effective_modules.length} modül · Oluşturuldu:{' '}
          {new Date(tenant.created_at).toLocaleDateString('tr-TR')}
        </p>

        {error && (
          <div className="text-xs p-2 rounded bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 mb-3">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setError(null);
                  save.mutate();
                }}
                disabled={save.isPending}
                className="text-xs bg-brand-900 hover:bg-brand-700 text-white px-3 py-1.5 rounded inline-flex items-center gap-1"
              >
                {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                Kaydet
              </button>
              <button
                onClick={onCancelEdit}
                className="text-xs text-brand-500 hover:text-brand-900 px-3 py-1.5"
              >
                İptal
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded inline-flex items-center gap-1"
              >
                <Edit3 className="size-3" />
                Düzenle
              </button>

              <AuditHistoryButton
                targetTable="tenants"
                targetId={tenant.id}
                label="Geçmiş"
                compact={false}
              />

              <button
                onClick={() => {
                  const msg = tenant.is_active
                    ? `${tenant.name} PASİFLEŞTİRİLECEK. Veri silinmez, tenant switcher'da görünmez. Devam?`
                    : `${tenant.name} yeniden aktif edilecek. Devam?`;
                  if (confirm(msg)) toggle.mutate();
                }}
                disabled={toggle.isPending}
                className={`text-xs border px-3 py-1.5 rounded inline-flex items-center gap-1 ${
                  tenant.is_active
                    ? 'border-brand-200 dark:border-slate-700 text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800'
                    : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                }`}
              >
                {tenant.is_active ? <PowerOff className="size-3" /> : <Power className="size-3" />}
                {tenant.is_active ? 'Pasifleştir' : 'Aktif Et'}
              </button>

              {isSuperAdmin && !tenant.is_active && (
                <button
                  onClick={() => {
                    const msg = `⚠️ DİKKAT — KALICI SİLME\n\n${tenant.name} ve TÜM ilişkili veriler (faturalar, ödemeler, çekler, demirbaşlar vb.) DB'den geri dönüşsüz silinecek.\n\nDevam etmek için tenant adını yaz:`;
                    const confirmed = prompt(msg);
                    if (confirmed === tenant.name) {
                      hardDelete.mutate();
                    } else if (confirmed !== null) {
                      alert('İptal edildi — ad eşleşmedi.');
                    }
                  }}
                  disabled={hardDelete.isPending}
                  className="text-xs border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded inline-flex items-center gap-1 ml-auto"
                  title="Kalıcı sil (cascade)"
                >
                  <Trash2 className="size-3" />
                  Kalıcı Sil
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTenantModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [sector, setSector] = useState<Sector>('diger');
  const [taxNumber, setTaxNumber] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { name, sector };
      if (taxNumber.trim()) body.tax_number = taxNumber.trim();
      if (slug.trim()) body.slug = slug.trim();
      await api.post('/tenants', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants-management'] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      onClose();
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e as Error).message);
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="size-5" />
            Yeni Şirket Aç
          </h3>
          <button onClick={onClose} className="text-brand-500 hover:text-brand-900">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-brand-500 dark:text-slate-400 uppercase tracking-wide">
              Şirket Adı *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="KILIÇ TEKSTİL SAN. VE TİC. LTD. ŞTİ."
              className="input w-full mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-brand-500 dark:text-slate-400 uppercase tracking-wide">
              Sektör *
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value as Sector)}
              className="input w-full mt-1"
            >
              {SECTOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-brand-500 dark:text-slate-400 uppercase tracking-wide">
                VKN (opsiyonel)
              </label>
              <input
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="1234567890"
                className="input w-full mt-1 font-mono"
              />
              <p className="text-[10px] text-brand-400 dark:text-slate-500 mt-1">
                e-Fatura otomatik route için
              </p>
            </div>
            <div>
              <label className="text-xs text-brand-500 dark:text-slate-400 uppercase tracking-wide">
                Slug (opsiyonel)
              </label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="otomatik üretilir"
                className="input w-full mt-1 font-mono"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm p-3 rounded bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="text-xs text-brand-500 hover:text-brand-900 px-3 py-1.5"
            >
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (name.trim().length < 2) {
                  setError('Şirket adı en az 2 karakter olmalı');
                  return;
                }
                create.mutate();
              }}
              disabled={create.isPending}
              className="text-xs bg-brand-900 hover:bg-brand-700 disabled:opacity-50 text-white px-3 py-1.5 rounded flex items-center gap-1"
            >
              {create.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Şirket Aç
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
