/**
 * Permission middleware — requireAuth + requireOrg sonrası izin kontrolü.
 *
 * Kullanım:
 *   router.post('/users/invite',
 *     requireAuth, requireOrg, requirePerm('users.invite'), handler);
 *
 * effectiveRole, requireOrg veya requireTenant tarafından set edilir.
 */
import type { NextFunction, Request, Response } from 'express';
import { roleCan, type Permission, type Role } from '@sayman/shared';
import { HttpError } from '../lib/helpers';

export function requirePerm(perm: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.effectiveRole as Role | undefined;
    if (!role) {
      next(new HttpError(403, 'Rol resolved değil — requireOrg/requireTenant öncesinde mi?', 'NO_ROLE'));
      return;
    }
    if (!roleCan(role, perm)) {
      next(new HttpError(403, `Bu işlem için yetkin yok (${perm})`, 'PERMISSION_DENIED'));
      return;
    }
    next();
  };
}
