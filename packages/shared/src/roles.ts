/**
 * Sayman — rol enum'ları.
 *
 * İki seviyeli yetki:
 *   • Organization-level (varsayılan rol — Faz B'de UserOrganizationRole)
 *   • Tenant-level override (istisna — UserTenantOverride)
 *
 * Eşleştirme: Django seed'inden 6 rol (PROJECT_ANAYASA Madde 4.1)
 */
import { z } from 'zod';

export const ROLES = [
  'super_admin',
  'yonetici',
  'muhasebe_muduru',
  'muhasebeci',
  'personel',
  'goruntuleyici',
] as const;

export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Süper Admin',
  yonetici: 'Yönetici',
  muhasebe_muduru: 'Muhasebe Müdürü',
  muhasebeci: 'Muhasebeci',
  personel: 'Personel',
  goruntuleyici: 'Görüntüleyici',
};

/**
 * Tenant override için ek durum: erişim tamamen iptal (Ayşe Hukuk'a girmesin).
 * Normal Role'lerin yanında 'deny' özel değeri tenant override'da kullanılabilir.
 */
export const TENANT_OVERRIDE_VALUES = [...ROLES, 'deny'] as const;
export type TenantOverrideValue = (typeof TENANT_OVERRIDE_VALUES)[number];
