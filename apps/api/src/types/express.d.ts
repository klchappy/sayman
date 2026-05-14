/**
 * Global Express Request augmentation — tüm middleware'lerden gelen alanları
 * tek yerde topla. tsconfig.json `include` ile bu dosya otomatik bulunur.
 */
import type { User } from '@sayman/db';

declare global {
  namespace Express {
    interface Request {
      /** auth middleware */
      authUser?: User;
      authUserId?: string;

      /** tenant-context middleware */
      saymanContext?: {
        orgSlug: string | null;
        tenantSlug: string | null;
        organizationId: string | null;
        tenantId: string | null;
      };

      /** requireOrg / requireTenant guards */
      activeOrgId?: string;
      activeOrgSlug?: string;
      activeTenantId?: string;
      activeTenantSlug?: string;
      effectiveRole?: string;
    }
  }
}

export {};
