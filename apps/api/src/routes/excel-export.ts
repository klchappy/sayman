/**
 * /v1/export — Excel (xlsx) çıktı endpoint'leri.
 *
 *   GET /v1/export/payables.xlsx?status=&from=&to=&category=
 *   GET /v1/export/payments.xlsx?from=&to=
 *   GET /v1/export/guarantees.xlsx?status=
 *
 * Filtreler query string'den okunur, tenant context içinde çalışır.
 * Maks 10000 satır (Excel performance + memory için).
 */
import { and, between, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import * as XLSX from 'xlsx';
import {
  getDb,
  guarantees,
  payableItems,
  paymentTransactions,
} from '@sayman/db';
import { CATEGORY_LABELS, type PayableCategory } from '@sayman/shared';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const excelExportRouter = Router();

const MAX_ROWS = 10_000;

function sendXlsx(res: any, filename: string, sheets: Array<{ name: string; rows: any[] }>) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

excelExportRouter.get(
  '/export/payables.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const conditions: any[] = [
        eq(payableItems.tenant_id, req.activeTenantId!),
        eq(payableItems.is_active, true),
      ];
      if (req.query.status) conditions.push(eq(payableItems.status, String(req.query.status) as any));
      if (req.query.category)
        conditions.push(eq(payableItems.category, String(req.query.category)));
      if (req.query.from && req.query.to) {
        conditions.push(
          between(payableItems.due_date, String(req.query.from), String(req.query.to)),
        );
      }

      const rows = await db
        .select()
        .from(payableItems)
        .where(and(...conditions))
        .orderBy(desc(payableItems.created_at))
        .limit(MAX_ROWS);

      const formatted = rows.map((r) => ({
        ID: r.id,
        Başlık: r.title,
        'Fatura No': r.invoice_number ?? '',
        Tedarikçi: r.supplier_name ?? '',
        Kategori: r.category
          ? (CATEGORY_LABELS[r.category as PayableCategory] ?? r.category)
          : '',
        'Düzenleme Tarihi': r.issue_date ?? '',
        'Vade Tarihi': r.due_date ?? '',
        Tutar: Number(r.amount),
        Ödenen: Number(r.paid_amount),
        Kalan: Number(r.amount) - Number(r.paid_amount),
        'Para Birimi': r.currency,
        Durum: r.status,
        Notlar: r.notes ?? '',
        'Oluşturma Tarihi': r.created_at?.toISOString().slice(0, 10) ?? '',
      }));

      sendXlsx(res, `faturalar-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: 'Faturalar', rows: formatted },
      ]);
    } catch (err) {
      next(err);
    }
  },
);

excelExportRouter.get(
  '/export/payments.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const conditions: any[] = [
        eq(paymentTransactions.tenant_id, req.activeTenantId!),
        eq(paymentTransactions.is_active, true),
      ];
      if (req.query.from && req.query.to) {
        conditions.push(
          between(paymentTransactions.paid_at, String(req.query.from), String(req.query.to)),
        );
      }

      const rows = await db.execute(sql`
        SELECT
          pt.id,
          pt.paid_at,
          pt.amount,
          pt.currency,
          pt.method,
          pt.reference_no,
          pt.status,
          pi.title AS payable_title,
          pi.supplier_name,
          pi.invoice_number,
          pt.created_at
        FROM payment_transactions pt
        LEFT JOIN payable_items pi ON pi.id = pt.payable_id
        WHERE pt.tenant_id = ${req.activeTenantId!}::uuid
          AND pt.is_active = true
        ORDER BY pt.paid_at DESC
        LIMIT ${MAX_ROWS}
      `);

      const list = (rows.rows ?? rows) as Array<Record<string, unknown>>;
      const formatted = list.map((r) => ({
        ID: String(r.id),
        'Ödeme Tarihi': r.paid_at,
        Fatura: r.payable_title ?? '',
        'Fatura No': r.invoice_number ?? '',
        Tedarikçi: r.supplier_name ?? '',
        Tutar: Number(r.amount),
        'Para Birimi': r.currency,
        Yöntem: r.method,
        Referans: r.reference_no ?? '',
        Durum: r.status,
        Oluşturulma: r.created_at,
      }));

      sendXlsx(res, `odemeler-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: 'Ödemeler', rows: formatted },
      ]);
    } catch (err) {
      next(err);
    }
  },
);

excelExportRouter.get(
  '/export/guarantees.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const conditions: any[] = [
        eq(guarantees.tenant_id, req.activeTenantId!),
        eq(guarantees.is_active, true),
      ];
      if (req.query.status) conditions.push(eq(guarantees.status, String(req.query.status) as any));

      const rows = await db
        .select()
        .from(guarantees)
        .where(and(...conditions))
        .orderBy(desc(guarantees.created_at))
        .limit(MAX_ROWS);

      const formatted = rows.map((r) => ({
        ID: r.id,
        'Lehtar': r.beneficiary_name,
        'Mektup No': r.letter_no ?? '',
        Tutar: Number(r.amount),
        'Para Birimi': r.currency,
        'Düzenleme Tarihi': r.issue_date ?? '',
        'Vade Tarihi': r.expiry_date,
        Durum: r.status,
        Notlar: r.notes ?? '',
        Oluşturulma: r.created_at?.toISOString().slice(0, 10) ?? '',
      }));

      sendXlsx(res, `teminat-mektuplari-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: 'Teminat Mektuplari', rows: formatted },
      ]);
    } catch (err) {
      next(err);
    }
  },
);
