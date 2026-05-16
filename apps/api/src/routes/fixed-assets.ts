/**
 * /v1/fixed-assets — Demirbaş ve sabit kıymet.
 *
 *   GET    /v1/fixed-assets                → liste (filter: category, status)
 *   POST   /v1/fixed-assets                → yeni demirbaş
 *   GET    /v1/fixed-assets/:id            → tek detay + amortisman çizelgesi
 *   PATCH  /v1/fixed-assets/:id            → düzenle
 *   DELETE /v1/fixed-assets/:id            → soft delete
 *   POST   /v1/fixed-assets/:id/dispose    → satış/imha (status + tarihi + proceeds)
 *   GET    /v1/fixed-assets/:id/schedule   → ay-ay amortisman çizelgesi (preview)
 *   GET    /v1/fixed-assets/summary        → toplam değer + birikmiş + net + kategori dağılımı
 */
import { and, asc, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  depreciationEntries,
  fixedAssets,
  getDb,
  tenants,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { buildSchedule, calculateMonthlyDepreciation } from '../lib/depreciation';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { LIST_LIMITS, countTotal, listMeta } from '../lib/list-meta';
import { requireAuth } from '../middleware/auth';

export const fixedAssetsRouter = Router();

fixedAssetsRouter.get(
  '/fixed-assets/summary',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [s] = await db
        .select({
          total_cost: sql<string>`COALESCE(SUM(${fixedAssets.purchase_cost}::numeric) FILTER (WHERE ${fixedAssets.status} = 'active'), 0)`,
          total_accumulated: sql<string>`COALESCE(SUM(${fixedAssets.accumulated_depreciation}::numeric) FILTER (WHERE ${fixedAssets.status} = 'active'), 0)`,
          active_count: sql<string>`COUNT(*) FILTER (WHERE ${fixedAssets.status} = 'active')`,
          disposed_count: sql<string>`COUNT(*) FILTER (WHERE ${fixedAssets.status} != 'active')`,
        })
        .from(fixedAssets)
        .where(
          and(tenantScope(req, fixedAssets.tenant_id), eq(fixedAssets.is_active, true)),
        );

      // Kategori dağılımı (aggregate-aware)
      const tenantIdsForQuery = req.aggregateTenantIds ?? [req.activeTenantId!];
      const byCategory = await db.execute(sql`
        SELECT
          category,
          COUNT(*) AS count,
          SUM(purchase_cost::numeric) AS total_cost,
          SUM(accumulated_depreciation::numeric) AS total_accumulated
        FROM fixed_assets
        WHERE tenant_id = ANY(${tenantIdsForQuery}::uuid[])
          AND is_active = true
          AND status = 'active'
        GROUP BY category
        ORDER BY total_cost DESC
      `);

      const totalCost = Number(s?.total_cost ?? 0);
      const totalAccumulated = Number(s?.total_accumulated ?? 0);

      res.json({
        data: {
          total_cost: totalCost,
          total_accumulated_depreciation: totalAccumulated,
          net_book_value: totalCost - totalAccumulated,
          active_count: Number(s?.active_count ?? 0),
          disposed_count: Number(s?.disposed_count ?? 0),
          by_category: ((byCategory.rows ?? byCategory) as Array<Record<string, unknown>>).map(
            (r) => ({
              category: String(r.category),
              count: Number(r.count),
              total_cost: Number(r.total_cost),
              net_book_value: Number(r.total_cost) - Number(r.total_accumulated),
            }),
          ),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

fixedAssetsRouter.get('/fixed-assets', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions: any[] = [
      tenantScope(req, fixedAssets.tenant_id),
      eq(fixedAssets.is_active, true),
    ];
    if (req.query.category) conditions.push(eq(fixedAssets.category, String(req.query.category)));
    if (req.query.status) conditions.push(eq(fixedAssets.status, String(req.query.status)));

    const where = and(...conditions);
    const rows = await db
      .select({
        ...getTableColumns(fixedAssets),
        tenant_name: tenants.name,
      })
      .from(fixedAssets)
      .leftJoin(tenants, eq(tenants.id, fixedAssets.tenant_id))
      .where(where)
      .orderBy(desc(fixedAssets.purchase_date))
      .limit(LIST_LIMITS.large);

    // Net defter değeri ekle
    const enriched = rows.map((a) => ({
      ...a,
      net_book_value: Number(a.purchase_cost) - Number(a.accumulated_depreciation),
    }));

    const total = await countTotal(fixedAssets, where);
    res.json({ data: enriched, ...listMeta(enriched, total, LIST_LIMITS.large) });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(2).max(255),
  code: z.string().max(80).optional().nullable(),
  category: z
    .enum(['vehicle', 'equipment', 'building', 'furniture', 'electronics', 'other'])
    .default('other'),
  purchase_date: z.string().min(8),
  purchase_cost: z.union([z.string(), z.number()]).transform((v) => String(v)),
  currency: z.string().length(3).default('TRY'),
  useful_life_months: z.number().int().min(1).max(600),
  depreciation_method: z.enum(['linear', 'declining_balance']).default('linear'),
  declining_rate_pct: z.number().min(0).max(100).optional().nullable(),
  salvage_value: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .default('0'),
  location: z.string().max(255).optional().nullable(),
  serial_no: z.string().max(120).optional().nullable(),
  supplier_name: z.string().max(255).optional().nullable(),
  related_payable_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

fixedAssetsRouter.post('/fixed-assets', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(fixedAssets)
      .values({
        tenant_id: req.activeTenantId!,
        name: body.name,
        code: body.code ?? null,
        category: body.category,
        purchase_date: body.purchase_date,
        purchase_cost: body.purchase_cost,
        currency: body.currency,
        useful_life_months: String(body.useful_life_months),
        depreciation_method: body.depreciation_method,
        declining_rate_pct:
          body.declining_rate_pct != null ? String(body.declining_rate_pct) : null,
        salvage_value: body.salvage_value,
        location: body.location ?? null,
        serial_no: body.serial_no ?? null,
        supplier_name: body.supplier_name ?? null,
        related_payable_id: body.related_payable_id ?? null,
        notes: body.notes ?? null,
        created_by: req.authUser?.id ?? null,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'fixed_asset.create',
      target_type: 'fixed_assets',
      target_id: row?.id ?? null,
      details: {
        name: body.name,
        category: body.category,
        purchase_cost: body.purchase_cost,
        currency: body.currency,
      },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

fixedAssetsRouter.get(
  '/fixed-assets/:id',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .select()
        .from(fixedAssets)
        .where(
          and(
            eq(fixedAssets.id, String(req.params.id ?? '')),
            tenantScope(req, fixedAssets.tenant_id),
          ),
        );
      if (!row) throw new HttpError(404, 'Demirbaş bulunamadı');

      const entries = await db
        .select()
        .from(depreciationEntries)
        .where(eq(depreciationEntries.asset_id, row.id))
        .orderBy(asc(depreciationEntries.period));

      res.json({
        data: {
          ...row,
          net_book_value: Number(row.purchase_cost) - Number(row.accumulated_depreciation),
          depreciation_history: entries,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

fixedAssetsRouter.patch(
  '/fixed-assets/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = createSchema.partial().parse(req.body);
      const db = getDb();
      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (body.name) patch.name = body.name;
      if (body.code !== undefined) patch.code = body.code;
      if (body.category) patch.category = body.category;
      if (body.notes !== undefined) patch.notes = body.notes;
      if (body.location !== undefined) patch.location = body.location;
      if (body.salvage_value != null) patch.salvage_value = body.salvage_value;

      const [row] = await db
        .update(fixedAssets)
        .set(patch)
        .where(
          and(
            eq(fixedAssets.id, String(req.params.id ?? '')),
            eq(fixedAssets.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Demirbaş bulunamadı');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'fixed_asset.update',
        target_type: 'fixed_assets',
        target_id: row?.id ?? String(req.params.id ?? ''),
        details: {
          changed: Object.keys(patch).filter((k) => k !== 'updated_at'),
          patch,
        },
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

fixedAssetsRouter.delete(
  '/fixed-assets/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .update(fixedAssets)
        .set({ is_active: false, updated_at: new Date() })
        .where(
          and(
            eq(fixedAssets.id, String(req.params.id ?? '')),
            eq(fixedAssets.tenant_id, req.activeTenantId!),
          ),
        )
        .returning({ id: fixedAssets.id });
      if (!row) throw new HttpError(404, 'Demirbaş bulunamadı');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'fixed_asset.delete',
        target_type: 'fixed_assets',
        target_id: row?.id ?? String(req.params.id ?? ''),
        details: { soft_delete: true },
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

const disposeSchema = z.object({
  status: z.enum(['sold', 'disposed', 'written_off']),
  disposed_at: z.string().optional(),
  disposal_proceeds: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v == null ? null : String(v)))
    .optional(),
  notes: z.string().optional(),
});

fixedAssetsRouter.post(
  '/fixed-assets/:id/dispose',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = disposeSchema.parse(req.body);
      const db = getDb();
      const id = String(req.params.id ?? '');

      // Yalnız 'active' durumdaki demirbaş elden çıkarılabilir
      const [current] = await db
        .select({ status: fixedAssets.status })
        .from(fixedAssets)
        .where(and(eq(fixedAssets.id, id), eq(fixedAssets.tenant_id, req.activeTenantId!)));
      if (!current) throw new HttpError(404, 'Demirbaş bulunamadı');
      if (current.status !== 'active') {
        throw new HttpError(
          400,
          `Sadece aktif demirbaş elden çıkarılabilir — mevcut: ${current.status}`,
          'INVALID_TRANSITION',
        );
      }

      const [row] = await db
        .update(fixedAssets)
        .set({
          status: body.status,
          disposed_at: body.disposed_at ?? new Date().toISOString().slice(0, 10),
          disposal_proceeds: body.disposal_proceeds ?? null,
          notes: body.notes ?? null,
          updated_at: new Date(),
        })
        .where(
          and(eq(fixedAssets.id, id), eq(fixedAssets.tenant_id, req.activeTenantId!)),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Demirbaş bulunamadı');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'fixed_asset.dispose',
        target_type: 'fixed_assets',
        target_id: row?.id ?? String(req.params.id ?? ''),
        details: {
          new_status: body.status,
          disposal_proceeds: body.disposal_proceeds ?? null,
          disposed_at: body.disposed_at ?? null,
        },
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

fixedAssetsRouter.get(
  '/fixed-assets/:id/schedule',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [a] = await db
        .select()
        .from(fixedAssets)
        .where(
          and(
            eq(fixedAssets.id, String(req.params.id ?? '')),
            tenantScope(req, fixedAssets.tenant_id),
          ),
        );
      if (!a) throw new HttpError(404, 'Demirbaş bulunamadı');

      const monthly = calculateMonthlyDepreciation({
        purchase_cost: Number(a.purchase_cost),
        salvage_value: Number(a.salvage_value),
        useful_life_months: Number(a.useful_life_months),
        depreciation_method: a.depreciation_method,
        declining_rate_pct: a.declining_rate_pct ? Number(a.declining_rate_pct) : null,
        accumulated_depreciation: Number(a.accumulated_depreciation),
      });

      // Tam ömür çizelgesi
      const fullSchedule = buildSchedule(
        {
          purchase_cost: Number(a.purchase_cost),
          salvage_value: Number(a.salvage_value),
          useful_life_months: Number(a.useful_life_months),
          depreciation_method: a.depreciation_method,
          declining_rate_pct: a.declining_rate_pct ? Number(a.declining_rate_pct) : null,
          accumulated_depreciation: 0,
        },
        a.purchase_date,
        new Date(
          Date.now() + Number(a.useful_life_months) * 30 * 86_400_000,
        ),
      );

      res.json({
        data: {
          current_monthly_depreciation: Math.round(monthly * 100) / 100,
          full_schedule: fullSchedule,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
