/**
 * Audit log helper — request context'ten otomatik IP/UA + organization scope çek.
 *
 * Kullanım:
 *   await auditFromRequest(req, {
 *     action: 'auth.login',
 *     actor_user_id: user.id,
 *     actor_email: user.email,
 *     details: { method: 'password' },
 *   });
 */
import type { Request } from 'express';
import { getDb, auditLog } from '@sayman/db';
import { logger } from '../config/logger';

interface AuditInput {
  organization_id?: string | null;
  tenant_id?: string | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details?: Record<string, unknown>;
  module?: string;
}

function getIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0]?.trim() ?? null;
  return req.ip ?? null;
}

function getUa(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

export async function auditFromRequest(req: Request, input: AuditInput): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      organization_id: input.organization_id ?? req.activeOrgId ?? null,
      tenant_id: input.tenant_id ?? req.activeTenantId ?? null,
      actor_id: input.actor_user_id ?? req.authUserId ?? null,
      action: mapActionToEnum(input.action),
      module: input.module ?? extractModule(input.action),
      target_table: input.target_type ?? null,
      target_id: input.target_id ?? null,
      ip_address: getIp(req),
      user_agent: getUa(req),
      after_data: {
        action_label: input.action,
        actor_email: input.actor_email ?? null,
        ...(input.details ?? {}),
      },
    });
  } catch (err) {
    // Audit kaydı başarısız olursa endpoint başarısız olmamalı (best-effort)
    logger.warn({ err, action: input.action }, 'Audit log yazılamadı');
  }
}

/**
 * 'auth.login' gibi serbest action string'i şemada zorunlu auditActionEnum'a map et.
 * Bilinmeyen action'lar 'permission_change' altına gider (genel) ya da action label
 * after_data.action_label içinde tam olarak tutulur.
 */
function mapActionToEnum(action: string): 'create' | 'update' | 'delete' | 'archive' | 'restore' | 'login' | 'logout' | 'import' | 'export' | 'permission_change' {
  if (action === 'auth.login' || action.startsWith('auth.sign_in')) return 'login';
  if (action === 'auth.logout' || action.startsWith('auth.sign_out')) return 'logout';
  if (action.endsWith('.create') || action.endsWith('.created')) return 'create';
  if (action.endsWith('.update') || action.endsWith('.updated')) return 'update';
  if (action.endsWith('.delete') || action.endsWith('.deleted')) return 'delete';
  if (action.endsWith('.archive') || action.endsWith('.archived')) return 'archive';
  if (action.endsWith('.restore') || action.endsWith('.restored')) return 'restore';
  if (action.endsWith('.import') || action.startsWith('import.')) return 'import';
  if (action.endsWith('.export') || action.startsWith('export.')) return 'export';
  return 'permission_change';
}

function extractModule(action: string): string {
  return action.split('.')[0] ?? 'system';
}
