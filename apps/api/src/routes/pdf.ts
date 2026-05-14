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
import { HttpError, requireTenant } from '../lib/helpers';
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

pdfRouter.get('/pdf/payable/:id', requireAuth, requireTenant, async (req, res, next) => {
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
          eq(payableItems.tenant_id, req.activeTenantId!),
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

pdfRouter.get('/pdf/guarantee/:id', requireAuth, requireTenant, async (req, res, next) => {
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
          eq(guarantees.tenant_id, req.activeTenantId!),
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
