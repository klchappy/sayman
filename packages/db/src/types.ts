/**
 * Sayman DB — tip yardımcıları.
 *
 * Tablo $inferSelect / $inferInsert tipleri `schema/` altındaki dosyalarda
 * tanımlı; buradan re-export edilir (ileride genel tipler de eklenir).
 */
export type OrgSettings = {
  /** Tutar eşiklerini override (varsayılan @sayman/shared PAYMENT_THRESHOLDS) */
  thresholds?: {
    dekontRequired?: number;
    doubleApproval?: number;
  };
  /** UI tema/locale override */
  locale?: string;
  /** Telegram bot config (super_admin) */
  telegram?: {
    mode: 'dry_run' | 'test' | 'live';
    chatId?: string;
  };
};

export type TenantSettings = {
  /** Tenant'a özel UI overrides */
  uiOverrides?: Record<string, unknown>;
  /** Aktif modülleri override etmek için (yoksa SECTOR_DEFAULT_MODULES uygulanır) */
  forceModules?: string[];
};

/** share_scope alanı: master data'nın hangi tenant'larda görüneceği */
export type ShareScope =
  /** Tüm tenant'larda görünür */
  | '*'
  /** Sadece bu tenant slug'larında görünür */
  | string[];
