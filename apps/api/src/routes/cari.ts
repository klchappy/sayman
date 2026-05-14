/**
 * /v1/cari/* — Cari (müşteri/tedarikçi) hesap ve ekstre okuma.
 *
 *   GET /v1/cari                     → cari listesi (tenant scope, filter: type, search)
 *   GET /v1/cari/:id                 → tek cari detayı + son hareketler
 *   GET /v1/cari/:id/movements       → cari ekstre tam liste (paginated)
 *   GET /v1/cari/:id/movements.xlsx  → Excel export
 *
 * Bu endpoint READ-ONLY — veri ERP'den /v1/erp/connections/:id/sync ile gelir.
 */
import { and, asc, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import * as XLSX from 'xlsx';
import { cariAccounts, cariMovements, erpConnections, getDb } from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const cariRouter = Router();

cariRouter.get('/cari', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions: any[] = [eq(cariAccounts.tenant_id, req.activeTenantId!)];
    if (req.query.type && req.query.type !== 'all') {
      conditions.push(eq(cariAccounts.account_type, String(req.query.type)));
    }
    if (req.query.search) {
      const s = `%${String(req.query.search)}%`;
      conditions.push(
        sql`(${cariAccounts.name} ILIKE ${s} OR ${cariAccounts.code} ILIKE ${s} OR ${cariAccounts.tax_id} ILIKE ${s})`,
      );
    }

    const rows = await db
      .select({
        id: cariAccounts.id,
        code: cariAccounts.code,
        name: cariAccounts.name,
        account_type: cariAccounts.account_type,
        tax_id: cariAccounts.tax_id,
        phone: cariAccounts.phone,
        email: cariAccounts.email,
        balance: cariAccounts.balance,
        currency: cariAccounts.currency,
        connection_id: cariAccounts.connection_id,
        last_synced_at: cariAccounts.last_synced_at,
      })
      .from(cariAccounts)
      .where(and(...conditions))
      .orderBy(asc(cariAccounts.name))
      .limit(500);

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

cariRouter.get('/cari/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [cari] = await db
      .select()
      .from(cariAccounts)
      .where(
        and(
          eq(cariAccounts.id, String(req.params.id ?? '')),
          eq(cariAccounts.tenant_id, req.activeTenantId!),
        ),
      );
    if (!cari) throw new HttpError(404, 'Cari bulunamadı');

    const [conn] = await db
      .select({ id: erpConnections.id, name: erpConnections.name, provider: erpConnections.provider })
      .from(erpConnections)
      .where(eq(erpConnections.id, cari.connection_id));

    const recentMovements = await db
      .select()
      .from(cariMovements)
      .where(eq(cariMovements.cari_account_id, cari.id))
      .orderBy(desc(cariMovements.movement_date), desc(cariMovements.created_at))
      .limit(20);

    // Toplam borç/alacak
    const [agg] = await db
      .select({
        total_debit: sql<string>`COALESCE(SUM(${cariMovements.debit}::numeric), 0)`,
        total_credit: sql<string>`COALESCE(SUM(${cariMovements.credit}::numeric), 0)`,
        movement_count: sql<string>`COUNT(*)`,
        last_movement_date: sql<string>`MAX(${cariMovements.movement_date})`,
      })
      .from(cariMovements)
      .where(eq(cariMovements.cari_account_id, cari.id));

    res.json({
      data: {
        cari,
        connection: conn ?? null,
        stats: {
          total_debit: Number(agg?.total_debit ?? 0),
          total_credit: Number(agg?.total_credit ?? 0),
          movement_count: Number(agg?.movement_count ?? 0),
          last_movement_date: agg?.last_movement_date ?? null,
        },
        recent_movements: recentMovements,
      },
    });
  } catch (err) {
    next(err);
  }
});

cariRouter.get('/cari/:id/movements', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [cari] = await db
      .select({ id: cariAccounts.id })
      .from(cariAccounts)
      .where(
        and(
          eq(cariAccounts.id, String(req.params.id ?? '')),
          eq(cariAccounts.tenant_id, req.activeTenantId!),
        ),
      );
    if (!cari) throw new HttpError(404, 'Cari bulunamadı');

    const limit = Math.min(Number(req.query.limit ?? 200), 1000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const conditions: any[] = [eq(cariMovements.cari_account_id, cari.id)];
    if (req.query.from) conditions.push(gte(cariMovements.movement_date, String(req.query.from)));
    if (req.query.to) conditions.push(lte(cariMovements.movement_date, String(req.query.to)));

    const rows = await db
      .select()
      .from(cariMovements)
      .where(and(...conditions))
      .orderBy(asc(cariMovements.movement_date), asc(cariMovements.created_at))
      .limit(limit)
      .offset(offset);

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

cariRouter.get(
  '/cari/:id/movements.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [cari] = await db
        .select()
        .from(cariAccounts)
        .where(
          and(
            eq(cariAccounts.id, String(req.params.id ?? '')),
            eq(cariAccounts.tenant_id, req.activeTenantId!),
          ),
        );
      if (!cari) throw new HttpError(404, 'Cari bulunamadı');

      const rows = await db
        .select()
        .from(cariMovements)
        .where(eq(cariMovements.cari_account_id, cari.id))
        .orderBy(asc(cariMovements.movement_date), asc(cariMovements.created_at))
        .limit(10_000);

      // Yürüyen bakiye hesapla
      let running = 0;
      const formatted = rows.map((r) => {
        running += Number(r.debit) - Number(r.credit);
        return {
          Tarih: r.movement_date,
          'Belge No': r.document_no ?? '',
          Tip: r.document_type ?? '',
          Açıklama: r.description ?? '',
          'Borç': Number(r.debit),
          'Alacak': Number(r.credit),
          'Yürüyen Bakiye': Math.round(running * 100) / 100,
          'Para Birimi': r.currency,
        };
      });

      const headerInfo = [
        ['Cari Adı', cari.name],
        ['Cari Kodu', cari.code ?? '-'],
        ['Vergi No', cari.tax_id ?? '-'],
        ['Güncel Bakiye', Number(cari.balance)],
        ['Toplam Hareket', rows.length],
        ['Rapor Tarihi', new Date().toISOString().slice(0, 10)],
      ];

      const wb = XLSX.utils.book_new();
      const wsHeader = XLSX.utils.aoa_to_sheet(headerInfo);
      XLSX.utils.book_append_sheet(wb, wsHeader, 'Cari Bilgi');
      const wsMovements = XLSX.utils.json_to_sheet(formatted);
      XLSX.utils.book_append_sheet(wb, wsMovements, 'Ekstre');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const safeName = cari.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cari-ekstre-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      );
      res.send(buf);
    } catch (err) {
      next(err);
    }
  },
);
