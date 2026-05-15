/**
 * send-collection-reminders cron — günde bir, 10:00 TR.
 *
 * Her aktif tenant için:
 *   1. days_after_due'a göre vade geçmiş sales_invoices'ları bul
 *   2. her aktif rule × eşleşen invoice için bir gönderim üret
 *   3. dedupe_key ile aynı gün iki kere gönderilmez
 *   4. email/whatsapp/telegram seçimine göre yolla
 *
 * customer_email/customer_phone şu an metadata'da yok — basit MVP'de
 * sadece email ve WhatsApp default'a yollar (Telegram chat_id bilinmiyor).
 *
 * customer'ın iletişim bilgisi yoksa skip.
 */
import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
  collectionReminderRules,
  collectionReminderRuns,
  getDb,
  salesInvoices,
  tenants,
} from '@sayman/db';
import { logger } from '../config/logger';
import { sendEmail } from '../lib/email';
import { sendWhatsAppMessage } from '../lib/whatsapp';

export interface CollectionReminderResult {
  rules_checked: number;
  invoices_eligible: number;
  sent: number;
  failed: number;
  skipped: number;
}

function renderTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : `{{${key}}}`,
  );
}

export async function runSendCollectionReminders(): Promise<CollectionReminderResult> {
  const result: CollectionReminderResult = {
    rules_checked: 0,
    invoices_eligible: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const db = getDb();
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  // Tüm aktif tenant + aktif kurallar
  const allTenants = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.is_active, true));

  for (const t of allTenants) {
    const rules = await db
      .select()
      .from(collectionReminderRules)
      .where(
        and(
          eq(collectionReminderRules.tenant_id, t.id),
          eq(collectionReminderRules.is_active, true),
        ),
      );

    for (const rule of rules) {
      result.rules_checked++;
      const days = Number(rule.days_after_due);
      const minAmount = Number(rule.min_amount);

      // Bu kural için "vadesi N gün önce geçmiş + henüz tahsil edilmemiş" faturalar
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - days);
      const targetISO = targetDate.toISOString().slice(0, 10);

      const eligible = await db
        .select()
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.tenant_id, t.id),
            eq(salesInvoices.is_active, true),
            sql`${salesInvoices.status} NOT IN ('paid', 'cancelled')`,
            sql`${salesInvoices.due_date} <= ${targetISO}`,
            sql`${salesInvoices.amount}::numeric - ${salesInvoices.paid_amount}::numeric >= ${minAmount}`,
          ),
        );

      for (const inv of eligible) {
        result.invoices_eligible++;

        // Müşteri iletişim bilgisi metadata'dan veya customer_name'den
        const customerEmail =
          (inv.metadata && typeof inv.metadata === 'object' && (inv.metadata as any).customer_email) ||
          null;
        const customerPhone =
          (inv.metadata && typeof inv.metadata === 'object' && (inv.metadata as any).customer_phone) ||
          null;

        let recipient: string | null = null;
        if (rule.channel === 'email') recipient = customerEmail;
        else if (rule.channel === 'whatsapp') recipient = customerPhone;

        if (!recipient) {
          result.skipped++;
          continue;
        }

        const overdueAmount = Number(inv.amount) - Number(inv.paid_amount);
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(inv.due_date ?? today).getTime()) / 86_400_000,
        );

        const vars = {
          customer: inv.customer_name ?? 'müşterimiz',
          amount: overdueAmount.toLocaleString('tr-TR', {
            style: 'currency',
            currency: 'TRY',
          }),
          due_date: inv.due_date ?? '-',
          days_overdue: daysOverdue,
          invoice_no: inv.invoice_number ?? '-',
        };

        const renderedSubject = rule.subject ? renderTemplate(rule.subject, vars) : 'Vadesi geçen fatura hatırlatması';
        const renderedBody = renderTemplate(rule.body, vars);

        // Dedupe: rule + invoice + gün (aynı kural aynı fatura için günde bir)
        const dedupeKey = crypto
          .createHash('sha256')
          .update(`${rule.id}:${inv.id}:${todayISO}`)
          .digest('hex')
          .slice(0, 32);

        try {
          let status: 'sent' | 'failed' | 'skipped' = 'failed';
          let errorMessage: string | null = null;
          let deliveryId: string | null = null;

          if (rule.channel === 'email') {
            const r = await sendEmail({
              to: recipient,
              subject: renderedSubject,
              html: `<p style="font-family:system-ui;line-height:1.5">${renderedBody.replace(/\n/g, '<br>')}</p>`,
              text: renderedBody,
              tag: 'collection-reminder',
            });
            if (r.delivered === 'email') {
              status = 'sent';
              deliveryId = r.message_id ?? null;
            } else {
              status = 'skipped';
              errorMessage = 'Email gateway yapılandırılmamış';
            }
          } else if (rule.channel === 'whatsapp') {
            const r = await sendWhatsAppMessage({ to: recipient, text: renderedBody });
            if (r.delivered === 'sent') {
              status = 'sent';
              deliveryId = r.message_id ?? null;
            } else if (r.delivered === 'no_gateway') {
              status = 'skipped';
              errorMessage = 'WhatsApp yapılandırılmamış';
            } else {
              status = 'failed';
              errorMessage = r.error ?? 'unknown';
            }
          }

          await db
            .insert(collectionReminderRuns)
            .values({
              tenant_id: t.id,
              rule_id: rule.id,
              sales_invoice_id: inv.id,
              channel: rule.channel,
              status,
              error_message: errorMessage,
              dedupe_key: dedupeKey,
              rendered_body: renderedBody.slice(0, 4000),
              delivery_id: deliveryId,
            })
            .onConflictDoNothing({ target: collectionReminderRuns.dedupe_key });

          if (status === 'sent') result.sent++;
          else if (status === 'skipped') result.skipped++;
          else result.failed++;
        } catch (err) {
          logger.error({ err, ruleId: rule.id, invoiceId: inv.id }, 'collection reminder failed');
          result.failed++;
        }
      }
    }
  }

  logger.info(result, 'send-collection-reminders completed');
  return result;
}
