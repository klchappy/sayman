/**
 * /v1/payroll/runs/:run_id/items/:item_id/pdf — Maaş pusulası PDF.
 *
 * Profesyonel A4 layout: tenant logo (yer var), personel bilgileri, dönem,
 * brüt + kesintiler tablosu, net, IBAN, imza alanı.
 */
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { employees, getDb, payrollItems, payrollRuns, tenants } from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const payrollPdfRouter = Router();

function fmtTRY(v: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);
}

payrollPdfRouter.get(
  '/payroll/runs/:run_id/items/:item_id/pdf',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const runId = String(req.params.run_id ?? '');
      const itemId = String(req.params.item_id ?? '');

      const [run] = await db
        .select()
        .from(payrollRuns)
        .where(
          and(eq(payrollRuns.id, runId), eq(payrollRuns.tenant_id, req.activeTenantId!)),
        );
      if (!run) throw new HttpError(404, 'Bordro bulunamadı');

      const [item] = await db
        .select()
        .from(payrollItems)
        .where(and(eq(payrollItems.id, itemId), eq(payrollItems.run_id, runId)));
      if (!item) throw new HttpError(404, 'Bordro satırı bulunamadı');

      const [emp] = await db.select().from(employees).where(eq(employees.id, item.employee_id));
      if (!emp) throw new HttpError(404, 'Personel bulunamadı');

      const [tnt] = await db.select().from(tenants).where(eq(tenants.id, run.tenant_id));

      // PDF üret
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bordro-${emp.full_name.replace(/[^a-z0-9]/gi, '_')}-${run.period}.pdf"`,
      );
      doc.pipe(res);

      // Başlık
      doc.fontSize(18).fillColor('#0a2540').text('MAAŞ PUSULASI', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`${tnt?.name ?? '-'} · Dönem: ${run.period}`, { align: 'center' });
      doc.moveDown(1.5);

      // Personel bilgileri kutusu
      const startY = doc.y;
      doc.rect(50, startY, 495, 90).strokeColor('#e5e7eb').stroke();
      doc.fillColor('#374151').fontSize(10);

      const colLeft = 60;
      const colRight = 310;
      let y = startY + 12;

      doc.font('Helvetica-Bold').text('Personel:', colLeft, y);
      doc.font('Helvetica').text(emp.full_name, colLeft + 70, y);
      doc.font('Helvetica-Bold').text('TC Kimlik:', colRight, y);
      doc.font('Helvetica').text(emp.tc_kimlik_no ?? '-', colRight + 70, y);

      y += 18;
      doc.font('Helvetica-Bold').text('Pozisyon:', colLeft, y);
      doc.font('Helvetica').text(emp.position ?? '-', colLeft + 70, y);
      doc.font('Helvetica-Bold').text('SGK No:', colRight, y);
      doc.font('Helvetica').text(emp.sgk_no ?? '-', colRight + 70, y);

      y += 18;
      doc.font('Helvetica-Bold').text('İşe Giriş:', colLeft, y);
      doc.font('Helvetica').text(emp.hire_date, colLeft + 70, y);
      doc.font('Helvetica-Bold').text('Medeni Hal:', colRight, y);
      doc.font('Helvetica').text(
        emp.marital_status === 'married' ? `Evli (${emp.kids_count} çocuk)` : 'Bekar',
        colRight + 70,
        y,
      );

      y += 18;
      if (emp.iban) {
        doc.font('Helvetica-Bold').text('IBAN:', colLeft, y);
        doc.font('Helvetica').fontSize(9).text(emp.iban, colLeft + 70, y);
        doc.fontSize(10);
      }

      doc.y = startY + 100;
      doc.moveDown(1);

      // Hesap tablosu
      const tableTop = doc.y + 10;
      doc.fontSize(11).fillColor('#0a2540').font('Helvetica-Bold');
      doc.text('Maaş Hesaplama', 50, tableTop);
      doc.moveDown(0.5);

      const tableY = doc.y + 5;
      doc.fillColor('#374151').fontSize(10).font('Helvetica');

      function row(label: string, value: number, bold = false, color?: string) {
        if (bold) doc.font('Helvetica-Bold');
        else doc.font('Helvetica');
        if (color) doc.fillColor(color);
        else doc.fillColor('#374151');
        doc.text(label, 60, doc.y);
        doc.text(fmtTRY(value), 400, doc.y - 12, { width: 140, align: 'right' });
        doc.moveDown(0.5);
        doc.fillColor('#374151').font('Helvetica');
      }

      doc.y = tableY;
      row('Brüt Maaş', Number(item.gross), true);
      doc
        .strokeColor('#e5e7eb')
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(0.3);

      doc.fillColor('#dc2626');
      row('  SGK İşçi Payı (%14)', -Number(item.sgk_employee));
      row('  İşsizlik İşçi (%1)', -Number(item.unemployment_employee));
      row('  Gelir Vergisi', -Number(item.income_tax));
      row('  Damga Vergisi', -Number(item.stamp_tax));
      doc.fillColor('#059669');
      row('  AGİ (Asgari Geçim İndirimi)', +Number(item.agi));

      doc
        .strokeColor('#0a2540')
        .moveTo(50, doc.y + 4)
        .lineTo(545, doc.y + 4)
        .lineWidth(1.5)
        .stroke();
      doc.lineWidth(1);
      doc.moveDown(0.8);

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0a2540');
      doc.text('NET MAAŞ (ELE GEÇEN)', 60, doc.y);
      doc.text(fmtTRY(Number(item.net)), 400, doc.y - 16, {
        width: 140,
        align: 'right',
      });
      doc.moveDown(2);

      // İşveren maliyeti
      doc.fontSize(10).fillColor('#6b7280').font('Helvetica');
      doc.text('İşveren Maliyeti (bilgi):', 60);
      doc.moveDown(0.3);
      row('  SGK İşveren (%15.5)', Number(item.sgk_employer));
      row('  İşsizlik İşveren (%2)', Number(item.unemployment_employer));
      row('  TOPLAM İŞVEREN MALİYETİ', Number(item.total_employer_cost), true, '#d97706');

      doc.moveDown(2);

      // İmza alanları
      const sigY = doc.y;
      doc.fontSize(10).fillColor('#374151').font('Helvetica');
      doc.text('İşveren imzası', 80, sigY + 40);
      doc
        .strokeColor('#d1d5db')
        .moveTo(50, sigY + 35)
        .lineTo(250, sigY + 35)
        .stroke();
      doc.text('Personel imzası', 340, sigY + 40);
      doc
        .moveTo(310, sigY + 35)
        .lineTo(510, sigY + 35)
        .stroke();

      // Footer
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .font('Helvetica')
        .text(
          `${new Date().toLocaleString('tr-TR')} · Sayman tarafından üretildi · sayman.deploi.net`,
          50,
          780,
          { align: 'center', width: 495 },
        );

      doc.end();
    } catch (err) {
      next(err);
    }
  },
);
