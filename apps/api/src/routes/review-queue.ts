/**
 * /v1/review-queue — Otomatik yaratılmış master data kayıtları için doğrulama queue'su.
 *
 *   GET    /v1/review-queue                       → tüm bekleyen kayıtlar (companies + persons)
 *   GET    /v1/review-queue/summary               → kategori bazlı sayılar
 *   POST   /v1/review-queue/:type/:id/approve     → onayla (needs_review=false)
 *   PATCH  /v1/review-queue/:type/:id             → düzenle (tax_number, name ekle)
 *   POST   /v1/review-queue/:type/:id/merge       → başka bir kayıtla birleştir
 *
 * Smart import ya da ERP sync sırasında otomatik oluşturulan kayıtlar burada gösterilir.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { companies, getDb, payableItems, persons } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const reviewQueueRouter = Router();

reviewQueueRouter.get(
  '/review-queue/summary',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [cnt] = await db
        .select({
          companies: sql<string>`(SELECT COUNT(*) FROM companies WHERE organization_id = ${req.activeOrgId!}::uuid AND needs_review = true AND is_active = true)`,
          persons: sql<string>`(SELECT COUNT(*) FROM persons WHERE organization_id = ${req.activeOrgId!}::uuid AND needs_review = true AND is_active = true)`,
        })
        .from(companies)
        .limit(1);
      res.json({
        data: {
          companies: Number(cnt?.companies ?? 0),
          persons: Number(cnt?.persons ?? 0),
          total: Number(cnt?.companies ?? 0) + Number(cnt?.persons ?? 0),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reviewQueueRouter.get('/review-queue', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const typeFilter = String(req.query.type ?? '');

    let companyRows: any[] = [];
    let personRows: any[] = [];

    if (!typeFilter || typeFilter === 'companies') {
      companyRows = await db.execute(sql`
        SELECT
          c.id, c.name, c.short_name, c.tax_number, c.registry_number,
          c.auto_created_source, c.auto_created_at, c.needs_review,
          (SELECT COUNT(*) FROM payable_items WHERE company_id = c.id) AS usage_count,
          (SELECT MIN(issue_date) FROM payable_items WHERE company_id = c.id) AS first_usage,
          (SELECT MAX(issue_date) FROM payable_items WHERE company_id = c.id) AS last_usage,
          (SELECT COALESCE(SUM(amount::numeric), 0) FROM payable_items WHERE company_id = c.id) AS total_volume
        FROM companies c
        WHERE c.organization_id = ${req.activeOrgId!}::uuid
          AND c.needs_review = true
          AND c.is_active = true
        ORDER BY c.auto_created_at DESC NULLS LAST
        LIMIT 200
      `).then((r) => (r.rows ?? r) as any[]);
    }

    if (!typeFilter || typeFilter === 'persons') {
      personRows = await db.execute(sql`
        SELECT
          p.id, p.full_name, p.national_id, p.phone,
          p.auto_created_source, p.auto_created_at, p.needs_review
        FROM persons p
        WHERE p.organization_id = ${req.activeOrgId!}::uuid
          AND p.needs_review = true
          AND p.is_active = true
        ORDER BY p.auto_created_at DESC NULLS LAST
        LIMIT 200
      `).then((r) => (r.rows ?? r) as any[]);
    }

    res.json({
      data: {
        companies: companyRows.map((c) => ({
          type: 'company',
          id: String(c.id),
          name: String(c.name),
          short_name: c.short_name,
          tax_number: c.tax_number,
          registry_number: c.registry_number,
          source: c.auto_created_source,
          created_at: c.auto_created_at,
          usage_count: Number(c.usage_count ?? 0),
          first_usage: c.first_usage,
          last_usage: c.last_usage,
          total_volume: Number(c.total_volume ?? 0),
        })),
        persons: personRows.map((p) => ({
          type: 'person',
          id: String(p.id),
          full_name: String(p.full_name),
          national_id: p.national_id,
          phone: p.phone,
          source: p.auto_created_source,
          created_at: p.auto_created_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

reviewQueueRouter.post(
  '/review-queue/:type/:id/approve',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const type = String(req.params.type ?? '');
      const id = String(req.params.id ?? '');
      const db = getDb();

      if (type === 'company') {
        const [row] = await db
          .update(companies)
          .set({
            needs_review: false,
            reviewed_at: new Date(),
            reviewed_by: req.authUser?.id ?? null,
            updated_at: new Date(),
          })
          .where(
            and(eq(companies.id, id), eq(companies.organization_id, req.activeOrgId!)),
          )
          .returning({ id: companies.id });
        if (!row) throw new HttpError(404, 'Şirket bulunamadı');
      } else if (type === 'person') {
        const [row] = await db
          .update(persons)
          .set({
            needs_review: false,
            reviewed_at: new Date(),
            reviewed_by: req.authUser?.id ?? null,
            updated_at: new Date(),
          })
          .where(and(eq(persons.id, id), eq(persons.organization_id, req.activeOrgId!)))
          .returning({ id: persons.id });
        if (!row) throw new HttpError(404, 'Şahıs bulunamadı');
      } else {
        throw new HttpError(400, 'Tip company veya person olmalı');
      }

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'review_queue.approve',
        target_type: type === 'company' ? 'companies' : 'persons',
        target_id: id,
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

const patchCompanySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  short_name: z.string().max(120).optional().nullable(),
  tax_number: z.string().max(20).optional().nullable(),
  registry_number: z.string().max(50).optional().nullable(),
});

reviewQueueRouter.patch(
  '/review-queue/company/:id',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const body = patchCompanySchema.parse(req.body);
      const db = getDb();
      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (body.name) patch.name = body.name;
      if (body.short_name !== undefined) patch.short_name = body.short_name;
      if (body.tax_number !== undefined)
        patch.tax_number = body.tax_number ? body.tax_number.replace(/[^0-9]/g, '') : null;
      if (body.registry_number !== undefined) patch.registry_number = body.registry_number;

      const [row] = await db
        .update(companies)
        .set(patch)
        .where(
          and(
            eq(companies.id, String(req.params.id ?? '')),
            eq(companies.organization_id, req.activeOrgId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Şirket bulunamadı');
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Merge — bu kaydı target_id ile birleştir.
 * payable_items.company_id'leri target'a taşı, sonra bu kaydı sil.
 */
const mergeSchema = z.object({
  target_id: z.string().uuid(),
});

reviewQueueRouter.post(
  '/review-queue/company/:id/merge',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const sourceId = String(req.params.id ?? '');
      const { target_id } = mergeSchema.parse(req.body);
      if (sourceId === target_id) throw new HttpError(400, 'Aynı kayıt birleştirilemez');

      const db = getDb();

      // Source ve target aynı orga ait mi?
      const [source] = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(
          and(eq(companies.id, sourceId), eq(companies.organization_id, req.activeOrgId!)),
        );
      const [target] = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(
          and(eq(companies.id, target_id), eq(companies.organization_id, req.activeOrgId!)),
        );
      if (!source || !target) throw new HttpError(404, 'Şirket bulunamadı');

      // payable_items.company_id'i taşı
      const moved = await db
        .update(payableItems)
        .set({ company_id: target.id, supplier_name: target.name, updated_at: new Date() })
        .where(eq(payableItems.company_id, sourceId))
        .returning({ id: payableItems.id });

      // Source'u sil
      await db.delete(companies).where(eq(companies.id, sourceId));

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'review_queue.merge',
        target_type: 'companies',
        target_id: target.id,
        details: { source_id: sourceId, source_name: source.name, moved_payables: moved.length },
      });

      res.json({ ok: true, moved_payables: moved.length });
    } catch (err) {
      next(err);
    }
  },
);
