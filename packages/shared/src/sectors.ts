/**
 * Sayman — sektör tanımları.
 *
 * Her tenant bir sektör altında çalışır. Sektör; UI menüsünü, aktif modülleri,
 * sektöre özel iş kurallarını belirler (Faz E'de runtime kullanılacak).
 */
import { z } from 'zod';

export const SECTORS = [
  'tekstil',
  'enerji',
  'insaat',
  'gayrimenkul',
  'kisisel',
  'sanayi',
  'hukuk',
  'diger',
] as const;

export type Sector = (typeof SECTORS)[number];

export const sectorSchema = z.enum(SECTORS);

export const SECTOR_LABELS: Record<Sector, string> = {
  tekstil: 'Tekstil',
  enerji: 'Enerji',
  insaat: 'İnşaat',
  gayrimenkul: 'Gayrimenkul',
  kisisel: 'Kişisel / Aile',
  sanayi: 'Sanayi',
  hukuk: 'Hukuk Bürosu',
  diger: 'Diğer',
};

/**
 * Sayman modül listesi (Django seed'inden taşınan).
 * Aktif modül seti her tenant için TenantConfig.activeModules JSON'da tutulur.
 */
export const MODULES = [
  'finance',
  'subscriptions',
  'regular_payments',
  'official_payments',
  'pruva',
  'properties',
  'guarantees',
  'integrators',
  'imports',
  'notifications',
  'tasks',
  'chat',
  'dashboard',
  'reports',
] as const;

export type Module = (typeof MODULES)[number];

/**
 * Sektör başına default açık modül seti. Yeni tenant kurulduğunda bu set
 * `tenants.active_modules` JSON'una yazılır; sonra editör'den değiştirilebilir.
 */
export const SECTOR_DEFAULT_MODULES: Record<Sector, readonly Module[]> = {
  tekstil: [
    'finance',
    'subscriptions',
    'regular_payments',
    'official_payments',
    'imports',
    'notifications',
    'tasks',
    'chat',
    'dashboard',
    'reports',
  ],
  enerji: [
    'finance',
    'subscriptions',
    'integrators',
    'official_payments',
    'imports',
    'notifications',
    'tasks',
    'chat',
    'dashboard',
    'reports',
  ],
  insaat: [
    'finance',
    'guarantees',
    'properties',
    'regular_payments',
    'official_payments',
    'imports',
    'notifications',
    'tasks',
    'chat',
    'dashboard',
    'reports',
  ],
  gayrimenkul: [
    'finance',
    'properties',
    'pruva',
    'subscriptions',
    'regular_payments',
    'imports',
    'notifications',
    'tasks',
    'chat',
    'dashboard',
    'reports',
  ],
  kisisel: [
    'finance',
    'subscriptions',
    'regular_payments',
    'properties',
    'official_payments',
    'imports',
    'notifications',
    'tasks',
    'dashboard',
    'reports',
  ],
  sanayi: [
    'finance',
    'subscriptions',
    'integrators',
    'official_payments',
    'imports',
    'notifications',
    'tasks',
    'chat',
    'dashboard',
    'reports',
  ],
  hukuk: [
    'finance',
    'regular_payments',
    'official_payments',
    'imports',
    'notifications',
    'tasks',
    'dashboard',
    'reports',
  ],
  diger: [
    'finance',
    'subscriptions',
    'regular_payments',
    'official_payments',
    'imports',
    'notifications',
    'tasks',
    'chat',
    'dashboard',
    'reports',
  ],
};
