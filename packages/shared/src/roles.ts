/**
 * Sayman — rol enum + permission matrisi.
 *
 * İki seviyeli yetki:
 *   • Organization-level (varsayılan rol — UserOrganizationRole)
 *   • Tenant-level override (istisna — UserTenantOverride)
 *
 * Eski set (Django seed'i): super_admin, yonetici, muhasebe_muduru, muhasebeci,
 * personel, goruntuleyici. Yeni 7-rollü set kullanıcı tarafından onaylandı.
 * Migration mapping:
 *   muhasebe_muduru → organization_admin
 *   goruntuleyici  → denetci
 */
import { z } from 'zod';

export const ROLES = [
  'super_admin',
  'organization_admin',
  'yonetici',
  'muhasebeci',
  'denetci',
  'personel',
  'musavir',
] as const;

export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Süper Admin',
  organization_admin: 'Organizasyon Yöneticisi',
  yonetici: 'Tenant Yöneticisi',
  muhasebeci: 'Muhasebeci',
  denetci: 'Denetçi',
  personel: 'Personel',
  musavir: 'Müşavir / Avukat',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: 'Sistem yöneticisi — tüm org/tenant erişimi (genelde sadece platform sahibi)',
  organization_admin: 'Holding tepe yöneticisi — tüm tenant\'ları yönetir, kullanıcı davet eder',
  yonetici: 'Tenant yöneticisi — fatura/ödeme/sözleşme onayı, master-data ekleme/silme',
  muhasebeci: 'Mali işlem girişi — fatura/ödeme/abonelik ekler, silemez; onaylı kaydı değiştiremez',
  denetci: 'Salt-okur + audit log — her şeyi görür, hiçbir şey yazamaz',
  personel: 'Kendi görevleri + bildirimler — finans verisi görmez',
  musavir: 'Dış müşavir/avukat — atanan tenant\'larda salt-okur (finance + master-data)',
};

/**
 * Tenant override için ek durum: erişim tamamen iptal.
 * Normal Role'lerin yanında 'deny' özel değeri override'da kullanılabilir.
 */
export const TENANT_OVERRIDE_VALUES = [...ROLES, 'deny'] as const;
export type TenantOverrideValue = (typeof TENANT_OVERRIDE_VALUES)[number];
export const tenantOverrideSchema = z.enum(TENANT_OVERRIDE_VALUES);

// ============================================================================
// PERMISSION MATRIX
// ============================================================================

export const PERMISSIONS = [
  // Kullanıcı yönetimi
  'users.read',
  'users.invite',
  'users.update_role',
  'users.remove',

  // Tenant yönetimi
  'tenants.create',
  'tenants.update',
  'tenants.delete',

  // Finance (fatura + ödeme)
  'finance.read',
  'finance.write',
  'finance.delete',

  // Master data (persons/companies/properties/banks/institutions)
  'master_data.read',
  'master_data.write',
  'master_data.delete',

  // Yinelenen ödeme modülleri (subscriptions/regular/official/guarantees)
  'recurring.read',
  'recurring.write',
  'recurring.delete',

  // Audit + güvenlik
  'audit.read',
  'security.manage',

  // Tasks + bildirimler
  'tasks.read',
  'tasks.assign',
  'tasks.execute',
  'notifications.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Rol başına izin set'i. roleCan(role, perm) bu set'i sorgular.
 *
 * Kural seti:
 *   - super_admin & organization_admin: tüm yetkiler
 *   - yonetici: tenant içinde tam okuma + finance/master/recurring/tasks yazma (silme dahil)
 *   - muhasebeci: finance/master/recurring write (delete YOK), tasks execute
 *   - denetci: SALT-OKUR (audit dahil)
 *   - personel: sadece tasks + notifications (finans okumaz!)
 *   - musavir: salt-okur (finance + master + recurring + tasks/audit YOK)
 */
const ALL_PERMS = new Set<Permission>(PERMISSIONS);

const READ_ONLY_FINANCE_MASTER_RECURRING = new Set<Permission>([
  'finance.read',
  'master_data.read',
  'recurring.read',
]);

export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  super_admin: ALL_PERMS,
  organization_admin: ALL_PERMS,

  yonetici: new Set<Permission>([
    'users.read',
    'tenants.update',
    'finance.read',
    'finance.write',
    'finance.delete',
    'master_data.read',
    'master_data.write',
    'master_data.delete',
    'recurring.read',
    'recurring.write',
    'recurring.delete',
    'tasks.read',
    'tasks.assign',
    'tasks.execute',
    'notifications.read',
    'audit.read',
  ]),

  muhasebeci: new Set<Permission>([
    'users.read',
    'finance.read',
    'finance.write',
    'master_data.read',
    'master_data.write',
    'recurring.read',
    'recurring.write',
    'tasks.read',
    'tasks.execute',
    'notifications.read',
  ]),

  denetci: new Set<Permission>([
    'users.read',
    'finance.read',
    'master_data.read',
    'recurring.read',
    'tasks.read',
    'notifications.read',
    'audit.read',
  ]),

  personel: new Set<Permission>([
    'tasks.read',
    'tasks.execute',
    'notifications.read',
  ]),

  musavir: new Set<Permission>([
    ...READ_ONLY_FINANCE_MASTER_RECURRING,
    'tasks.read',
    'notifications.read',
  ]),
};

/**
 * Helper: bir rolün spesifik bir izne sahip olup olmadığı.
 * Backend middleware ve frontend UI guard'larda kullanılır.
 */
export function roleCan(role: Role | string | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  const set = ROLE_PERMISSIONS[role as Role];
  return set ? set.has(perm) : false;
}

/**
 * UI'de rolün hangi izinlere sahip olduğunu listele.
 */
export function listPermissions(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? new Set())];
}
