/**
 * Email gateway — Resend wrapper + graceful fallback.
 *
 * Env yoksa:
 *   - sendEmail() → log + return { delivered: 'fallback_link' }
 *   - Caller (users.ts, password-reset.ts) action_link'i UI'a göster
 *
 * Env varsa (RESEND_API_KEY + EMAIL_FROM):
 *   - Resend API'sine POST + return { delivered: 'email', message_id }
 *
 * Domain: sayman.deploi.net (Cloudflare DNS) + Resend verify.
 * Templates inline HTML — komplekleşince ayrı dosyaya çıkar.
 */
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getIntegrationCredentials } from './integration-credentials';

export const isEmailConfigured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tag?: string;
  /** Org-default + tenant-override credential lookup için. Yoksa env fallback. */
  ctx?: { organizationId?: string | null; tenantId?: string | null };
}

export interface SendEmailResult {
  delivered: 'email' | 'fallback_link';
  message_id?: string;
}

async function resolveResendCreds(
  ctx?: SendEmailParams['ctx'],
): Promise<{ api_key: string; email_from: string } | null> {
  if (ctx?.organizationId) {
    const r = await getIntegrationCredentials(
      {
        organizationId: ctx.organizationId,
        tenantId: ctx.tenantId,
        integrationKey: 'resend',
      },
      { api_key: env.RESEND_API_KEY ?? '', email_from: env.EMAIL_FROM ?? '' },
    );
    if (r.credentials.api_key && r.credentials.email_from) {
      return { api_key: r.credentials.api_key, email_from: r.credentials.email_from };
    }
  }
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return { api_key: env.RESEND_API_KEY, email_from: env.EMAIL_FROM };
  }
  return null;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const creds = await resolveResendCreds(params.ctx);
  if (!creds) {
    logger.warn(
      { to: params.to, subject: params.subject, tag: params.tag },
      'Email gateway not configured (resend credentials yok) — fallback mode',
    );
    return { delivered: 'fallback_link' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: creds.email_from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        tags: params.tag ? [{ name: 'category', value: params.tag }] : undefined,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(
        { status: res.status, body: errorText, to: params.to },
        'Resend send failed',
      );
      return { delivered: 'fallback_link' };
    }

    const data = (await res.json()) as { id?: string };
    return { delivered: 'email', message_id: data.id };
  } catch (err) {
    logger.error({ err, to: params.to }, 'Resend network error');
    return { delivered: 'fallback_link' };
  }
}

// ============================================================================
// TEMPLATES
// ============================================================================

const BRAND_COLOR = '#0a2540';

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:32px auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;background:${BRAND_COLOR};color:#fff;border-radius:10px;line-height:48px;font-size:18px;font-weight:600;">Sy</div>
      <h1 style="margin:12px 0 0;color:${BRAND_COLOR};font-size:18px;">Sayman</h1>
    </div>
    ${body}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
      Sayman — Muhasebe Operasyon Platformu<br>
      Bu mail otomatik gönderildi; cevap vermenize gerek yok.
    </p>
  </div>
</body>
</html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function button(label: string, url: string): string {
  return `<a href="${escape(url)}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">${escape(label)}</a>`;
}

// --- Invite mail -----------------------------------------------------------

export interface InviteEmailParams {
  to: string;
  inviterName?: string | null;
  orgName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresAt: Date;
}

export function sendInviteEmail(p: InviteEmailParams): Promise<SendEmailResult> {
  const expiresStr = p.expiresAt.toLocaleString('tr-TR');
  const body = `
    <h2 style="color:${BRAND_COLOR};margin-top:0;">Sayman'a Davet Edildin</h2>
    <p>Merhaba,</p>
    <p>
      <strong>${escape(p.orgName)}</strong> seni Sayman'a
      <strong>${escape(p.roleLabel)}</strong> olarak davet etti.
    </p>
    <p style="text-align:center;margin:32px 0;">${button('Daveti Kabul Et', p.acceptUrl)}</p>
    <p style="color:#6b7280;font-size:13px;">
      Buton çalışmıyorsa şu linki tarayıcına yapıştır:<br>
      <a href="${escape(p.acceptUrl)}" style="color:${BRAND_COLOR};word-break:break-all;">${escape(p.acceptUrl)}</a>
    </p>
    <p style="color:#9ca3af;font-size:12px;">
      Davet süresi: <strong>${escape(expiresStr)}</strong>
    </p>`;

  return sendEmail({
    to: p.to,
    subject: `${p.orgName} seni Sayman'a davet etti`,
    html: wrapHtml('Sayman Daveti', body),
    text: `${p.orgName} seni Sayman'a ${p.roleLabel} olarak davet etti.\n\nDavet linki: ${p.acceptUrl}\n\nSüre: ${expiresStr}`,
    tag: 'invite',
  });
}

// --- Password reset mail ---------------------------------------------------

export interface PasswordResetEmailParams {
  to: string;
  resetUrl: string;
  expiresAt: Date;
}

export function sendPasswordResetEmail(p: PasswordResetEmailParams): Promise<SendEmailResult> {
  const expiresStr = p.expiresAt.toLocaleString('tr-TR');
  const body = `
    <h2 style="color:${BRAND_COLOR};margin-top:0;">Şifre Sıfırlama</h2>
    <p>Şifre sıfırlama talebin alındı.</p>
    <p style="text-align:center;margin:32px 0;">${button('Yeni Şifre Belirle', p.resetUrl)}</p>
    <p style="color:#6b7280;font-size:13px;">
      Buton çalışmıyorsa şu linki tarayıcına yapıştır:<br>
      <a href="${escape(p.resetUrl)}" style="color:${BRAND_COLOR};word-break:break-all;">${escape(p.resetUrl)}</a>
    </p>
    <p style="color:#9ca3af;font-size:12px;">
      Link süresi: <strong>${escape(expiresStr)}</strong> — sonra link geçersizleşir.<br>
      Bu maili sen istemediysen yok say; şifren güvende.
    </p>`;

  return sendEmail({
    to: p.to,
    subject: 'Sayman — Şifre Sıfırlama',
    html: wrapHtml('Şifre Sıfırlama', body),
    text: `Sayman şifre sıfırlama: ${p.resetUrl}\n\nSüre: ${expiresStr}`,
    tag: 'password_reset',
  });
}

// --- Generic notification mail ---------------------------------------------

export interface NotificationEmailParams {
  to: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function sendNotificationEmail(p: NotificationEmailParams): Promise<SendEmailResult> {
  const html = `
    <h2 style="color:${BRAND_COLOR};margin-top:0;">${escape(p.title)}</h2>
    <div style="white-space:pre-line;color:#374151;line-height:1.6;">${escape(p.body)}</div>
    ${
      p.actionUrl
        ? `<p style="text-align:center;margin:32px 0;">${button(p.actionLabel ?? 'Görüntüle', p.actionUrl)}</p>`
        : ''
    }`;

  return sendEmail({
    to: p.to,
    subject: `Sayman — ${p.title}`,
    html: wrapHtml(p.title, html),
    text: p.body + (p.actionUrl ? `\n\n${p.actionUrl}` : ''),
    tag: 'notification',
  });
}
