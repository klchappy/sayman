/**
 * /v1/reports — Sektörel rapor PDF üreteçleri.
 *
 *   GET /v1/reports/monthly-summary?month=YYYY-MM   → ay kapanış özeti
 *   GET /v1/reports/guarantees-summary              → aktif teminat listesi
 *   GET /v1/reports/cashflow?months=6                → son N ay nakit akışı
 *
 * pdfkit ile A4. Auth: requireTenant + finance.read permission.
 */
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import {
  getDb,
  guarantees,
  officialPaymentPeriods,
  payableItems,
  paymentTransactions,
  regularPaymentPeriods,
  subscriptions,
  tenants,
} from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { requirePerm } from '../middleware/permission';

const BRAND_COLOR = '#0a2540';

function fmtTRY(v: string | number | null | undefined): string {
  if (v == null) return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fillColor(BRAND_COLOR).fontSize(20).text('Sayman', 50, 50);
  doc.fillColor('#6b7280').fontSize(10).text('Muhasebe Operasyon Raporu', 50, 75);
  doc.fillColor(BRAND_COLOR).fontSize(16).text(title, 50, 110);
  doc.fillColor('#9ca3af').fontSize(10).text(subtitle, 50, 130);
  doc.moveTo(50, 155).lineTo(545, 155).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.y = 175;
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const y = doc.page.height - 60;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
  doc
    .fillColor('#9ca3af')
    .fontSize(8)
    .text(
      `Sayman — Otomatik üretilen rapor · ${new Date().toLocaleString('tr-TR')}`,
      50,
      y + 10,
      { width: 495, align: 'center' },
    );
}

function tableRow(
  doc: PDFKit.PDFDocument,
  cells: Array<{ text: string; x: number; w: number; align?: 'left' | 'right' }>,
  y: number,
  isHeader = false,
) {
  doc
    .fillColor(isHeader ? '#6b7280' : BRAND_COLOR)
    .fontSize(isHeader ? 9 : 10);
  for (const c of cells) {
    doc.text(c.text, c.x, y, { width: c.w, align: c.align ?? 'left' });
  }
}

export const reportsRouter = Router();

// --- Aylık özet ---

reportsRouter.get(
  '/reports/monthly-summary',
  requireAuth,
  requireTenant,
  requirePerm('finance.read'),
  async (req, res, next) => {
    try {
      const monthStr = String(req.query.month ?? new Date().toISOString().slice(0, 7));
      const [year, month] = monthStr.split('-').map(Number);
      if (!year || !month) throw new HttpError(400, 'month=YYYY-MM gerekli', 'BAD_MONTH');

      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 0));
      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      const db = getDb();
      const tid = req.activeTenantId!;

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid));
      if (!tenant) throw new HttpError(404, 'Tenant bulunamadı');

      const [payRollup] = await db
        .select({
          count: sql<string>`COUNT(*)`,
          total: sql<string>`COALESCE(SUM(${payableItems.amount}), 0)`,
          paid: sql<string>`COALESCE(SUM(${payableItems.paid_amount}), 0)`,
        })
        .from(payableItems)
        .where(
          and(
            eq(payableItems.tenant_id, tid),
            eq(payableItems.is_active, true),
            gte(payableItems.due_date, startStr),
            lte(payableItems.due_date, endStr),
          ),
        );

      const [paymentRollup] = await db
        .select({ count: sql<string>`COUNT(*)`, sum: sql<string>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.tenant_id, tid),
            gte(paymentTransactions.paid_at, startStr),
            lte(paymentTransactions.paid_at, endStr),
          ),
        );

      const filename = `aylik-ozet-${monthStr}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      doc.pipe(res);

      drawHeader(doc, `${monthStr} Aylık Özet`, tenant.name);

      const total = Number(payRollup?.total ?? 0);
      const paid = Number(payRollup?.paid ?? 0);
      const paymentSum = Number(paymentRollup?.sum ?? 0);

      doc.y = 190;
      [
        ['Vadesi bu ay olan fatura sayısı', String(payRollup?.count ?? 0)],
        ['Toplam tutar', fmtTRY(total)],
        ['Ödenen', fmtTRY(paid)],
        ['Açık bakiye', fmtTRY(total - paid)],
        ['Bu ay yapılan ödeme sayısı', String(paymentRollup?.count ?? 0)],
        ['Bu ay ödeme toplamı', fmtTRY(paymentSum)],
      ].forEach(([k, v]) => {
        const y = doc.y;
        doc.fillColor('#6b7280').fontSize(10).text(k, 50, y, { width: 350 });
        doc.fillColor(BRAND_COLOR).fontSize(11).text(v, 400, y, { width: 145, align: 'right' });
        doc.y = y + 20;
      });

      drawFooter(doc);
      doc.end();
    } catch (err) {
      next(err);
    }
  },
);

// --- Aktif Teminat Listesi ---

reportsRouter.get(
  '/reports/guarantees-summary',
  requireAuth,
  requireTenant,
  requirePerm('finance.read'),
  async (req, res, next) => {
    try {
      const db = getDb();
      const tid = req.activeTenantId!;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid));
      if (!tenant) throw new HttpError(404, 'Tenant bulunamadı');

      const rows = await db
        .select()
        .from(guarantees)
        .where(
          and(
            eq(guarantees.tenant_id, tid),
            eq(guarantees.is_active, true),
            eq(guarantees.status, 'active'),
          ),
        )
        .orderBy(guarantees.expiry_date);

      const filename = `teminat-ozet-${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      doc.pipe(res);

      drawHeader(doc, 'Aktif Teminat Mektupları', `${tenant.name} · ${rows.length} aktif`);

      doc.y = 180;
      tableRow(
        doc,
        [
          { text: 'Lehdar', x: 50, w: 180 },
          { text: 'Mektup No', x: 235, w: 80 },
          { text: 'Tutar', x: 320, w: 80, align: 'right' },
          { text: 'Vade', x: 405, w: 70 },
          { text: 'Komisyon', x: 480, w: 65 },
        ],
        doc.y,
        true,
      );
      doc.moveTo(50, doc.y + 15).lineTo(545, doc.y + 15).strokeColor('#e5e7eb').stroke();
      doc.y += 20;

      let total = 0;
      for (const g of rows) {
        if (doc.y > 720) {
          doc.addPage();
          doc.y = 60;
        }
        const y = doc.y;
        tableRow(
          doc,
          [
            { text: g.beneficiary_name.slice(0, 30), x: 50, w: 180 },
            { text: g.letter_no ?? '-', x: 235, w: 80 },
            { text: fmtTRY(g.amount), x: 320, w: 80, align: 'right' },
            { text: g.expiry_date ?? '-', x: 405, w: 70 },
            { text: g.commission_rate ? `%${g.commission_rate}/${g.commission_frequency_months}ay` : '-', x: 480, w: 65 },
          ],
          y,
        );
        doc.y = y + 18;
        total += Number(g.amount);
      }

      doc.y += 10;
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
      doc.y += 10;
      doc
        .fillColor(BRAND_COLOR)
        .fontSize(11)
        .text(`Toplam: ${fmtTRY(total)}`, 320, doc.y, { width: 220, align: 'right' });

      drawFooter(doc);
      doc.end();
    } catch (err) {
      next(err);
    }
  },
);
