/**
 * Job helpers — DB lookup + notification + mail wiring.
 */
import crypto from 'node:crypto';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import {
  authAccounts,
  getDb,
  notifications,
  organizations,
  userOrganizationRoles,
  users,
} from '@sayman/db';
import { sendNotificationEmail } from '../lib/email';
import { buildNotificationMessage, sendTelegramMessage } from '../lib/telegram';
import { logger } from '../config/logger';

/**
 * Org'un admin/super_admin/yonetici kullanıcılarının email + telegram listesi.
 * Bildirim mailleri + Telegram mesajları bu kişilere gider.
 */
export async function getOrgAdmins(
  organizationId: string,
): Promise<
  Array<{ user_id: string; email: string; full_name: string; telegram_chat_id: string | null }>
> {
  const db = getDb();
  const rows = await db
    .select({
      user_id: users.id,
      email: users.email,
      full_name: users.full_name,
      telegram_chat_id: users.telegram_chat_id,
      role: userOrganizationRoles.role,
    })
    .from(userOrganizationRoles)
    .innerJoin(users, eq(users.id, userOrganizationRoles.user_id))
    .where(
      and(
        eq(userOrganizationRoles.organization_id, organizationId),
        inArray(userOrganizationRoles.role, ['super_admin', 'organization_admin', 'yonetici']),
        eq(users.is_active, true),
      ),
    );

  return rows.map((r) => ({
    user_id: r.user_id,
    email: r.email,
    full_name: r.full_name,
    telegram_chat_id: r.telegram_chat_id,
  }));
}

/**
 * Idempotent bildirim oluştur. dedupe_key zaten varsa atla, yoksa insert + mail at.
 */
export interface CreateNotifInput {
  organizationId: string;
  tenantId?: string | null;
  dedupeKey: string;
  title: string;
  body: string;
  category: 'payable_due' | 'task_assigned' | 'task_due' | 'system' | 'security' | 'audit';
  priority: 'info' | 'warning' | 'critical';
  relatedTable?: string;
  relatedId?: string;
  actionUrl?: string;
  /** Mail gonder (default true) */
  sendMail?: boolean;
}

export async function createNotificationForAdmins(input: CreateNotifInput): Promise<{
  created: number;
  skipped: number;
  mail_sent: number;
  telegram_sent: number;
}> {
  const db = getDb();
  const admins = await getOrgAdmins(input.organizationId);
  if (admins.length === 0) {
    logger.warn(
      { organizationId: input.organizationId, dedupeKey: input.dedupeKey },
      'createNotificationForAdmins: no admins found',
    );
    return { created: 0, skipped: 0, mail_sent: 0, telegram_sent: 0 };
  }

  let created = 0;
  let skipped = 0;
  let mail_sent = 0;
  let telegram_sent = 0;

  for (const admin of admins) {
    const userDedupeKey = `${input.dedupeKey}:${admin.user_id}`;
    try {
      const result = await db
        .insert(notifications)
        .values({
          user_id: admin.user_id,
          tenant_id: input.tenantId ?? null,
          title: input.title,
          body: input.body,
          category: input.category,
          priority: input.priority,
          related_table: input.relatedTable ?? null,
          related_id: input.relatedId ?? null,
          action_url: input.actionUrl ?? null,
          dedupe_key: userDedupeKey,
        })
        .onConflictDoNothing({ target: notifications.dedupe_key })
        .returning();

      if (result.length === 0) {
        skipped++;
        continue;
      }
      created++;

      if (input.sendMail !== false) {
        // E-posta
        const mailResult = await sendNotificationEmail({
          to: admin.email,
          title: input.title,
          body: input.body,
          actionUrl: input.actionUrl,
        });
        await db
          .update(notifications)
          .set({
            email_status: mailResult.delivered,
            email_sent_at: new Date(),
            email_message_id: mailResult.message_id ?? null,
          })
          .where(eq(notifications.id, result[0]!.id));
        if (mailResult.delivered === 'email') mail_sent++;
        else if (mailResult.delivered === 'failed') {
          logger.error(
            { to: admin.email, error: mailResult.error, notif_id: result[0]!.id },
            'notification email send failed (operational alert)',
          );
        }

        // Telegram (chat_id varsa)
        if (admin.telegram_chat_id) {
          const tgMessage = buildNotificationMessage({
            title: input.title,
            body: input.body,
            actionUrl: input.actionUrl,
          });
          const tgResult = await sendTelegramMessage({
            chatId: admin.telegram_chat_id,
            text: tgMessage,
          });
          await db
            .update(notifications)
            .set({
              telegram_mode: tgResult.delivered,
              telegram_sent_at: tgResult.delivered === 'sent' ? new Date() : null,
            })
            .where(eq(notifications.id, result[0]!.id));
          if (tgResult.delivered === 'sent') telegram_sent++;
        }
      }
    } catch (err) {
      logger.error({ err, dedupeKey: userDedupeKey }, 'createNotificationForAdmins failed');
    }
  }

  return { created, skipped, mail_sent, telegram_sent };
}

/**
 * YYYY-MM-DD formatında bugünün tarihi (UTC).
 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Bir tarihten N gün sonrasını YYYY-MM-DD olarak döndür.
 */
export function plusDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * YYYY-MM string'inden Date (ayın 1'i UTC).
 */
export function ymToDate(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
}

/**
 * Date → "YYYY-MM"
 */
export function dateToYM(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Bir ay ilerle.
 */
export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

export function sha256Short(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
}
