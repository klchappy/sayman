/**
 * /v1/pdf/payable/:id, /v1/pdf/guarantee/:id — PDF export.
 *
 * Brand-tutarli A4 layout (lib/pdf-helpers.ts ortak yapı):
 *   - Mavi başlık bandı + logo + tenant adı
 *   - Title + subtitle
 *   - Key-value sections (alternating bg)
 *   - Footer + page number
 *   - AI-friendly metadata (PDF Info dict + gizli JSON annotation)
 */
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import {
  banks,
  companies,
  getDb,
  guarantees,
  payableItems,
  subsidiaries,
  tenants,
} from '@sayman/db';
import { HttpError, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import {
  drawKV,
  drawPdfFooter,
  drawPdfHeader,
  drawSectionTitle,
  fmtDate,
  fmtTRY,
  setAiMetadata,
} from '../lib/pdf-helpers';
import { requireAuth } from '../middleware/auth';

export const pdfRouter = Router();

pdfRouter.get('/pdf/payable/:id', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select({
        payable: payableItems,
        tenant_name: tenants.name,
        org_name: tenants.organization_id, // org_id; ad için ayrı join lazım, basitlik için tenant.name yeterli
        company_name: companies.name,
        subsidiary_name: subsidiaries.name,
      })
      .from(payableItems)
      .innerJoin(tenants, eq(tenants.id, payableItems.tenant_id))
      .leftJoin(companies, eq(companies.id, payableItems.company_id))
      .leftJoin(subsidiaries, eq(subsidiaries.id, payableItems.subsidiary_id))
      .where(
        and(
          eq(payableItems.id, String(req.params.id ?? '')),
          tenantScope(req, payableItems.tenant_id),
        ),
      );

    if (!row) throw new HttpError(404, 'Fatura bulunamadı', 'NOT_FOUND');

    const p = row.payable;
    const filename = `fatura-${p.invoice_number ?? p.id.slice(0, 8)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    doc.pipe(res);

    // AI metadata — pdf info + gizli JSON
    setAiMetadata(doc, {
      title: `Fatura ${p.invoice_number ?? p.id.slice(0, 8)}`,
      docType: 'payable',
      tenant: row.tenant_name,
      structured: {
        id: p.id,
        invoice_number: p.invoice_number,
        title: p.title,
        supplier_name: row.company_name ?? p.supplier_name,
        amount: p.amount,
        paid_amount: p.paid_amount,
        currency: p.currency,
        status: p.status,
        issue_date: p.issue_date,
        due_date: p.due_date,
        subsidiary: row.subsidiary_name,
      },
    });

    drawPdfHeader(doc, {
      title: 'Fatura',
      subtitle: p.invoice_number ? `No: ${p.invoice_number}` : undefined,
      tenantName: row.tenant_name,
    });

    drawSectionTitle(doc, 'Genel Bilgiler');
    drawKV(doc, 'Başlık', p.title);
    drawKV(doc, 'Fatura No', p.invoice_number ?? '-');
    drawKV(doc, 'Dönem', p.period_label ?? '-');
    drawKV(doc, 'Tedarikçi', row.company_name ?? p.supplier_name ?? '-');
    if (row.subsidiary_name) drawKV(doc, 'Yan Şirket', row.subsidiary_name);

    drawSectionTitle(doc, 'Tarihler');
    drawKV(doc, 'Düzenleme', fmtDate(p.issue_date));
    drawKV(doc, 'Vade', fmtDate(p.due_date));

    drawSectionTitle(doc, 'Tutarlar');
    drawKV(doc, 'Tutar', fmtTRY(p.amount), { bold: true });
    drawKV(doc, 'Ödenen', fmtTRY(p.paid_amount));
    drawKV(doc, 'Kalan', fmtTRY(Number(p.amount) - Number(p.paid_amount)), { bold: true });
    drawKV(doc, 'Durum', p.status);

    if (p.notes) {
      drawSectionTitle(doc, 'Notlar');
      doc.fillColor('#1f2937').fontSize(10).font('Helvetica').text(p.notes, 50, doc.y, {
        width: doc.page.width - 100,
      });
    }

    // Footer her sayfa için
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfFooter(doc, i + 1);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

pdfRouter.get('/pdf/guarantee/:id', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select({
        guarantee: guarantees,
        tenant_name: tenants.name,
        bank_name: banks.name,
        issuer_name: companies.name,
        subsidiary_name: subsidiaries.name,
      })
      .from(guarantees)
      .innerJoin(tenants, eq(tenants.id, guarantees.tenant_id))
      .leftJoin(banks, eq(banks.id, guarantees.bank_id))
      .leftJoin(companies, eq(companies.id, guarantees.issuer_company_id))
      .leftJoin(subsidiaries, eq(subsidiaries.id, guarantees.subsidiary_id))
      .where(
        and(
          eq(guarantees.id, String(req.params.id ?? '')),
          tenantScope(req, guarantees.tenant_id),
        ),
      );

    if (!row) throw new HttpError(404, 'Teminat bulunamadı', 'NOT_FOUND');

    const g = row.guarantee;
    const filename = `teminat-${g.letter_no ?? g.id.slice(0, 8)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    doc.pipe(res);

    setAiMetadata(doc, {
      title: `Teminat ${g.letter_no ?? g.id.slice(0, 8)}`,
      docType: 'guarantee',
      tenant: row.tenant_name,
      structured: {
        id: g.id,
        letter_no: g.letter_no,
        beneficiary: g.beneficiary_name,
        bank: row.bank_name,
        amount: g.amount,
        currency: g.currency,
        issue_date: g.issue_date,
        expiry_date: g.expiry_date,
        commission_rate: g.commission_rate,
        status: g.status,
      },
    });

    drawPdfHeader(doc, {
      title: 'Teminat Mektubu',
      subtitle: g.letter_no ? `No: ${g.letter_no}` : undefined,
      tenantName: row.tenant_name,
    });

    drawSectionTitle(doc, 'Taraflar');
    drawKV(doc, 'Lehdar', g.beneficiary_name, { bold: true });
    drawKV(doc, 'Banka', row.bank_name ?? '-');
    drawKV(doc, 'Düzenleyen Şirket', row.issuer_name ?? '-');
    if (row.subsidiary_name) drawKV(doc, 'Yan Şirket', row.subsidiary_name);

    drawSectionTitle(doc, 'Tutar & Vade');
    drawKV(doc, 'Tutar', `${fmtTRY(g.amount).replace('₺', '')} ${g.currency}`, { bold: true });
    drawKV(doc, 'Düzenleme Tarihi', fmtDate(g.issue_date));
    drawKV(doc, 'Vade Tarihi', fmtDate(g.expiry_date));

    drawSectionTitle(doc, 'Komisyon');
    drawKV(doc, 'Oran', g.commission_rate ? `%${g.commission_rate}` : '-');
    drawKV(doc, 'Periyot', `${g.commission_frequency_months ?? 3} ay`);
    drawKV(doc, 'Durum', g.status);

    if (g.notes) {
      drawSectionTitle(doc, 'Notlar');
      doc.fillColor('#1f2937').fontSize(10).font('Helvetica').text(g.notes, 50, doc.y, {
        width: doc.page.width - 100,
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPdfFooter(doc, i + 1);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

/**
 * /pdf/monthly-summary?period=YYYY-MM
 * Tenant'ın aylık özet raporu.
 */
pdfRouter.get('/pdf/monthly-summary', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const { sql } = await import('drizzle-orm');
    const period = String(req.query.period ?? new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new HttpError(400, 'period YYYY-MM formatında olmalı', 'INVALID_PERIOD');
    }
    const [year, month] = period.split('-').map(Number);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const db = getDb();
    const tenantId = req.activeTenantId;
    if (!tenantId) throw new HttpError(400, 'Tenant context gerekli');

    const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) throw new HttpError(404, 'Tenant bulunamadı');

    const monthlyPayables = await db.execute(sql`
      SELECT
        COUNT(*)::int AS count,
        COALESCE(SUM(amount::numeric), 0) AS total,
        COALESCE(SUM(paid_amount::numeric), 0) AS paid,
        COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue
      FROM payable_items
      WHERE tenant_id = ${tenantId}::uuid
        AND is_active = true
        AND needs_review = false
        AND issue_date >= ${monthStart}::date
        AND issue_date < ${nextMonth}::date
    `);
    const statsRow = ((monthlyPayables as { rows?: any[] }).rows ?? (monthlyPayables as any))[0] ?? { count: 0, total: 0, paid: 0, overdue: 0 };

    const topPayables = await db
      .select({
        title: payableItems.title,
        supplier_name: payableItems.supplier_name,
        amount: payableItems.amount,
        due_date: payableItems.due_date,
        status: payableItems.status,
      })
      .from(payableItems)
      .where(
        and(
          eq(payableItems.tenant_id, tenantId),
          eq(payableItems.is_active, true),
          eq(payableItems.needs_review, false),
          sql`${payableItems.issue_date} >= ${monthStart}::date`,
          sql`${payableItems.issue_date} < ${nextMonth}::date`,
        ),
      )
      .orderBy(sql`${payableItems.amount}::numeric DESC`)
      .limit(10);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ozet-${period}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    doc.pipe(res);

    setAiMetadata(doc, {
      title: `Aylık Özet ${period}`,
      docType: 'monthly_summary',
      tenant: tenant.name,
      structured: { period, count: Number(statsRow.count), total: Number(statsRow.total), paid: Number(statsRow.paid), overdue: Number(statsRow.overdue) },
    });

    drawPdfHeader(doc, { title: `Aylık Özet — ${period}`, tenantName: tenant.name });

    drawSectionTitle(doc, 'Özet Rakamlar');
    drawKV(doc, 'Fatura Sayısı', String(statsRow.count));
    drawKV(doc, 'Toplam Tutar', fmtTRY(statsRow.total));
    drawKV(doc, 'Ödenen', fmtTRY(statsRow.paid));
    drawKV(doc, 'Kalan', fmtTRY(Number(statsRow.total) - Number(statsRow.paid)));
    drawKV(doc, 'Geciken Fatura', String(statsRow.overdue));

    doc.moveDown(1);
    drawSectionTitle(doc, 'En Yüksek 10 Fatura');
    doc.fontSize(9);
    topPayables.forEach((p, i) => {
      const line = `${i + 1}. ${p.title.slice(0, 50)} — ${p.supplier_name ?? '-'} — ${fmtTRY(p.amount)} (${p.due_date ?? '-'}, ${p.status})`;
      doc.fillColor('#1f2937').text(line);
    });

    if (topPayables.length === 0) {
      doc.fillColor('#9ca3af').text('Bu dönemde fatura yok.');
    }

    drawPdfFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});
