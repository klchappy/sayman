/**
 * /v1/pdf/payable/:id, /v1/pdf/guarantee/:id — PDF export.
 *
 * pdfkit ile sunucu-side PDF üretimi. Bir kaynak (payable veya guarantee)
 * için tek sayfalık özet PDF + Sayman branding.
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
import { requireAuth } from '../middleware/auth';

export const pdfRouter = Router();

const BRAND_COLOR = '#0a2540';
const ACCENT = '#3b82f6';

function fmtTRY(v: string | number | null | undefined): string {
  if (v == null) return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, tenantName: string) {
  doc.fillColor(BRAND_COLOR).fontSize(20).text('Sayman', 50, 50);
  doc.fillColor('#6b7280').fontSize(10).text('Muhasebe Operasyon', 50, 75);
  doc.fillColor(BRAND_COLOR).fontSize(16).text(title, 50, 110);
  doc.fillColor('#9ca3af').fontSize(10).text(tenantName, 50, 130);
  doc.moveTo(50, 155).lineTo(545, 155).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.y = 175;
}

function drawKV(doc: PDFKit.PDFDocument, key: string, val: string, y?: number) {
  if (y !== undefined) doc.y = y;
  const startY = doc.y;
  doc.fillColor('#6b7280').fontSize(10).text(key, 50, startY, { width: 150 });
  doc.fillColor(BRAND_COLOR).fontSize(11).text(val, 200, startY, { width: 345 });
  doc.y = startY + 20;
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const y = doc.page.height - 70;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
  doc
    .fillColor('#9ca3af')
    .fontSize(8)
    .text(
      `Sayman — Muhasebe Operasyon Platformu  ·  Oluşturulma: ${new Date().toLocaleString('tr-TR')}`,
      50,
      y + 10,
      { width: 495, align: 'center' },
    );
}

// --- Payable PDF ----------------------------------------------------------

pdfRouter.get('/pdf/payable/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select({
        payable: payableItems,
        tenant_name: tenants.name,
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

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    drawHeader(doc, 'Fatura Özeti', row.tenant_name);

    drawKV(doc, 'Başlık', p.title);
    drawKV(doc, 'Fatura No', p.invoice_number ?? '-');
    drawKV(doc, 'Dönem', p.period_label ?? '-');
    drawKV(doc, 'Tedarikçi', row.company_name ?? p.supplier_name ?? '-');
    if (row.subsidiary_name) drawKV(doc, 'Yan Şirket', row.subsidiary_name);
    drawKV(doc, 'Düzenleme', p.issue_date ?? '-');
    drawKV(doc, 'Vade', p.due_date ?? '-');

    doc.y += 20;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    doc.y += 15;

    drawKV(doc, 'Tutar', fmtTRY(p.amount));
    drawKV(doc, 'Ödenen', fmtTRY(p.paid_amount));
    drawKV(doc, 'Kalan', fmtTRY(Number(p.amount) - Number(p.paid_amount)));
    drawKV(doc, 'Durum', p.status);

    if (p.notes) {
      doc.y += 20;
      doc.fillColor('#6b7280').fontSize(10).text('Notlar', 50, doc.y);
      doc.y += 15;
      doc.fillColor(BRAND_COLOR).fontSize(10).text(p.notes, 50, doc.y, { width: 495 });
    }

    drawFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});

// --- Guarantee PDF --------------------------------------------------------

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

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    drawHeader(doc, 'Teminat Mektubu Özeti', row.tenant_name);

    drawKV(doc, 'Lehdar', g.beneficiary_name);
    drawKV(doc, 'Mektup No', g.letter_no ?? '-');
    drawKV(doc, 'Banka', row.bank_name ?? '-');
    drawKV(doc, 'Düzenleyen Şirket', row.issuer_name ?? '-');
    if (row.subsidiary_name) drawKV(doc, 'Yan Şirket', row.subsidiary_name);

    doc.y += 20;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    doc.y += 15;

    drawKV(doc, 'Tutar', fmtTRY(g.amount));
    drawKV(doc, 'Düzenleme Tarihi', g.issue_date ?? '-');
    drawKV(doc, 'Vade Tarihi', g.expiry_date ?? '-');
    drawKV(doc, 'Komisyon Oranı', g.commission_rate ? `%${g.commission_rate}` : '-');
    drawKV(doc, 'Komisyon Periyodu', `${g.commission_frequency_months ?? 3} ay`);
    drawKV(doc, 'Durum', g.status);

    if (g.notes) {
      doc.y += 20;
      doc.fillColor('#6b7280').fontSize(10).text('Notlar', 50, doc.y);
      doc.y += 15;
      doc.fillColor(BRAND_COLOR).fontSize(10).text(g.notes, 50, doc.y, { width: 495 });
    }

    drawFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});
