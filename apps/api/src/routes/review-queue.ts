/**
 * /v1/review-queue — Otomatik yaratılmış kayıtlar için doğrulama queue'su.
 *
 *   GET    /v1/review-queue                          → tüm bekleyen (companies + persons + payables + sales_invoices)
 *   GET    /v1/review-queue/summary                  → kategori bazlı sayılar
 *   POST   /v1/review-queue/:type/:id/approve        → onayla (needs_review=false)
 *   DELETE /v1/review-queue/:type/:id                → reddet (hard delete)
 *   PATCH  /v1/review-queue/company/:id              → düzenle (tax_number, name ekle)
 *   POST   /v1/review-queue/company/:id/merge        → başka bir şirketle birleştir
 *
 * type değerleri: 'company' | 'person' | 'payable' | 'sales_invoice'
 *
 * Smart import / efatura / inbound webhook gibi otomatik akışlar bu queue'yu doldurur.
 * Onaylanan kayıt normal listede görünür; reddedilen DB'den tamamen silinir.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { companies, getDb, payableItems, persons, salesInvoices, tenants } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg, requireTenant, requireTenantOrAggregate } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const reviewQueueRouter = Router();

const payableNeedsReviewSql = sql`
  (
    pi.needs_review = true
    OR (
      pi.needs_review = false
      AND pi.reviewed_at IS NULL
      AND c.needs_review = true
      AND (
        pi.auto_created_source LIKE 'smart_import%'
        OR pi.auto_created_source LIKE 'efatura%'
      )
    )
  )
`;

reviewQueueRouter.get(
  '/review-queue/summary',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const orgId = req.activeOrgId!;
      const tenantId = req.activeTenantId ?? null;

      // scope: 'tenant' (default, sadece aktif tenant) veya 'org' (tüm org'daki tenant'lar)
      // Smart Import alıcı VKN'ye göre faturayı başka tenant'a route edebilir; bu yüzden
      // kullanıcı org-wide görünüm açabilmeli ki fatura "yokmuş" gibi görünmesin.
      const scope = String(req.query.scope ?? 'tenant');
      const orgWide = scope === 'org';

      // Tenant filtre SQL parçaları — summary subquery'lerinde alias'ı açık tut.
      const tenantFilterPayable = orgWide
        ? sql`pi.tenant_id IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid AND is_active = true)`
        : tenantId
          ? sql`pi.tenant_id = ${tenantId}::uuid`
          : sql`false`;
      const tenantFilterSales = orgWide
        ? sql`tenant_id IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid AND is_active = true)`
        : tenantId
          ? sql`tenant_id = ${tenantId}::uuid`
          : sql`false`;

      const [cnt] = await db
        .select({
          companies: sql<string>`(SELECT COUNT(*) FROM companies WHERE organization_id = ${orgId}::uuid AND needs_review = true AND is_active = true)`,
          persons: sql<string>`(SELECT COUNT(*) FROM persons WHERE organization_id = ${orgId}::uuid AND needs_review = true AND is_active = true)`,
          payables: sql<string>`(
            SELECT COUNT(*)
            FROM payable_items pi
            LEFT JOIN companies c ON c.id = pi.company_id
            WHERE ${tenantFilterPayable}
              AND pi.is_active = true
              AND ${payableNeedsReviewSql}
          )`,
          sales_invoices: sql<string>`(SELECT COUNT(*) FROM sales_invoices WHERE ${tenantFilterSales} AND needs_review = true AND is_active = true)`,
        })
        .from(companies)
        .limit(1);

      const companyCount = Number(cnt?.companies ?? 0);
      const personCount = Number(cnt?.persons ?? 0);
      const payableCount = Number(cnt?.payables ?? 0);
      const salesCount = Number(cnt?.sales_invoices ?? 0);

      res.json({
        data: {
          scope: orgWide ? 'org' : 'tenant',
          companies: companyCount,
          persons: personCount,
          payables: payableCount,
          sales_invoices: salesCount,
          total: companyCount + personCount + payableCount + salesCount,
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
    const rawTypeFilter = String(req.query.type ?? '');
    const typeFilter =
      rawTypeFilter === 'payable'
        ? 'payables'
        : rawTypeFilter === 'sales_invoice'
          ? 'sales_invoices'
          : rawTypeFilter === 'company'
            ? 'companies'
            : rawTypeFilter === 'person'
              ? 'persons'
              : rawTypeFilter;
    const orgId = req.activeOrgId!;
    const tenantId = req.activeTenantId ?? null;
    // scope=org → org'daki tüm tenant'larda ara (Smart Import auto-routing
    // başka tenant'a yazmış olabilir, kullanıcı kayıp fatura sanmasın)
    const scope = String(req.query.scope ?? 'tenant');
    const orgWide = scope === 'org';

    let companyRows: any[] = [];
    let personRows: any[] = [];
    let payableRows: any[] = [];
    let salesRows: any[] = [];

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
        WHERE c.organization_id = ${orgId}::uuid
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
        WHERE p.organization_id = ${orgId}::uuid
          AND p.needs_review = true
          AND p.is_active = true
        ORDER BY p.auto_created_at DESC NULLS LAST
        LIMIT 200
      `).then((r) => (r.rows ?? r) as any[]);
    }

    const tenantFilterPayable = orgWide
      ? sql`pi.tenant_id IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid AND is_active = true)`
      : tenantId
        ? sql`pi.tenant_id = ${tenantId}::uuid`
        : sql`false`;
    const tenantFilterSales = orgWide
      ? sql`si.tenant_id IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid AND is_active = true)`
      : tenantId
        ? sql`si.tenant_id = ${tenantId}::uuid`
        : sql`false`;

    if (!typeFilter || typeFilter === 'payables') {
      payableRows = await db.execute(sql`
        SELECT
          pi.id, pi.title, pi.invoice_number, pi.supplier_name, pi.company_id,
          pi.issue_date, pi.due_date, pi.amount, pi.currency, pi.category,
          pi.auto_created_source, pi.created_at, pi.tenant_id,
          t.name AS tenant_name, t.slug AS tenant_slug,
          c.name AS supplier_company_name
        FROM payable_items pi
        LEFT JOIN companies c ON c.id = pi.company_id
        LEFT JOIN tenants t ON t.id = pi.tenant_id
        WHERE ${tenantFilterPayable}
          AND pi.is_active = true
          AND ${payableNeedsReviewSql}
        ORDER BY pi.created_at DESC
        LIMIT 200
      `).then((r) => (r.rows ?? r) as any[]);
    }

    if (!typeFilter || typeFilter === 'sales_invoices') {
      salesRows = await db.execute(sql`
        SELECT
          si.id, si.title, si.invoice_number, si.customer_name,
          si.customer_company_id, si.customer_person_id,
          si.issue_date, si.due_date, si.amount, si.currency,
          si.auto_created_source, si.created_at, si.tenant_id,
          t.name AS tenant_name, t.slug AS tenant_slug,
          c.name AS customer_company_name,
          p.full_name AS customer_person_name
        FROM sales_invoices si
        LEFT JOIN companies c ON c.id = si.customer_company_id
        LEFT JOIN persons p ON p.id = si.customer_person_id
        LEFT JOIN tenants t ON t.id = si.tenant_id
        WHERE ${tenantFilterSales}
          AND si.needs_review = true
          AND si.is_active = true
        ORDER BY si.created_at DESC
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
        payables: payableRows.map((pi) => ({
          type: 'payable',
          id: String(pi.id),
          title: String(pi.title),
          invoice_number: pi.invoice_number,
          supplier_name: pi.supplier_company_name ?? pi.supplier_name ?? null,
          company_id: pi.company_id,
          issue_date: pi.issue_date,
          due_date: pi.due_date,
          amount: pi.amount,
          currency: pi.currency,
          category: pi.category,
          source: pi.auto_created_source,
          created_at: pi.created_at,
          tenant_id: pi.tenant_id,
          tenant_name: pi.tenant_name,
          tenant_slug: pi.tenant_slug,
        })),
        sales_invoices: salesRows.map((si) => ({
          type: 'sales_invoice',
          id: String(si.id),
          title: String(si.title),
          invoice_number: si.invoice_number,
          customer_name:
            si.customer_company_name ?? si.customer_person_name ?? si.customer_name ?? null,
          customer_company_id: si.customer_company_id,
          customer_person_id: si.customer_person_id,
          issue_date: si.issue_date,
          due_date: si.due_date,
          amount: si.amount,
          currency: si.currency,
          source: si.auto_created_source,
          created_at: si.created_at,
          tenant_id: si.tenant_id,
          tenant_name: si.tenant_name,
          tenant_slug: si.tenant_slug,
        })),
        scope: orgWide ? 'org' : 'tenant',
        active_tenant_id: tenantId,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Onayla — needs_review=false ile kalıcı kayda dönüştür */
reviewQueueRouter.post(
  '/review-queue/:type/:id/approve',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const type = String(req.params.type ?? '');
      const id = String(req.params.id ?? '');
      const db = getDb();
      const orgId = req.activeOrgId!;
      const tenantId = req.activeTenantId ?? null;

      if (type === 'company') {
        // If an older importer linked invoices to a pending supplier but forgot to
        // mark the invoices themselves as review-pending, keep those invoices in
        // the review queue after the supplier is approved.
        await db
          .update(payableItems)
          .set({
            needs_review: true,
            updated_at: new Date(),
          })
          .where(sql`
            company_id = ${id}::uuid
            AND is_active = true
            AND needs_review = false
            AND reviewed_at IS NULL
            AND (
              auto_created_source LIKE 'smart_import%'
              OR auto_created_source LIKE 'efatura%'
            )
          `);

        const [row] = await db
          .update(companies)
          .set({
            needs_review: false,
            reviewed_at: new Date(),
            reviewed_by: req.authUser?.id ?? null,
            updated_at: new Date(),
          })
          .where(and(eq(companies.id, id), eq(companies.organization_id, orgId)))
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
          .where(and(eq(persons.id, id), eq(persons.organization_id, orgId)))
          .returning({ id: persons.id });
        if (!row) throw new HttpError(404, 'Şahıs bulunamadı');
      } else if (type === 'payable') {
        // Kaydın kendi tenant_id'sini DB'den oku, org üyeliği authorize et.
        // Bu sayede aggregate (Tüm Şirketler) mode'unda da onay/red yapılabilir.
        const [existing] = await db
          .select({ tenant_id: payableItems.tenant_id })
          .from(payableItems)
          .innerJoin(tenants, eq(tenants.id, payableItems.tenant_id))
          .where(and(eq(payableItems.id, id), eq(tenants.organization_id, orgId)));
        if (!existing) throw new HttpError(404, 'Fatura bulunamadı');
        const [row] = await db
          .update(payableItems)
          .set({
            needs_review: false,
            reviewed_at: new Date(),
            reviewed_by: req.authUser?.id ?? null,
            updated_at: new Date(),
          })
          .where(and(eq(payableItems.id, id), eq(payableItems.tenant_id, existing.tenant_id)))
          .returning({ id: payableItems.id });
        if (!row) throw new HttpError(404, 'Fatura bulunamadı');
      } else if (type === 'sales_invoice') {
        const [existing] = await db
          .select({ tenant_id: salesInvoices.tenant_id })
          .from(salesInvoices)
          .innerJoin(tenants, eq(tenants.id, salesInvoices.tenant_id))
          .where(and(eq(salesInvoices.id, id), eq(tenants.organization_id, orgId)));
        if (!existing) throw new HttpError(404, 'Satış faturası bulunamadı');
        const [row] = await db
          .update(salesInvoices)
          .set({
            needs_review: false,
            reviewed_at: new Date(),
            reviewed_by: req.authUser?.id ?? null,
            updated_at: new Date(),
          })
          .where(and(eq(salesInvoices.id, id), eq(salesInvoices.tenant_id, existing.tenant_id)))
          .returning({ id: salesInvoices.id });
        if (!row) throw new HttpError(404, 'Satış faturası bulunamadı');
      } else {
        throw new HttpError(400, 'Tip company | person | payable | sales_invoice olmalı');
      }

      await auditFromRequest(req, {
        organization_id: orgId,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'review_queue.approve',
        target_type:
          type === 'company'
            ? 'companies'
            : type === 'person'
            ? 'persons'
            : type === 'payable'
            ? 'payable_items'
            : 'sales_invoices',
        target_id: id,
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

/** Reddet — DB'den kalıcı sil (audit'e bırak) */
reviewQueueRouter.delete(
  '/review-queue/:type/:id',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const type = String(req.params.type ?? '');
      const id = String(req.params.id ?? '');
      const db = getDb();
      const orgId = req.activeOrgId!;
      const tenantId = req.activeTenantId ?? null;

      let deleted: { id: string } | undefined;

      if (type === 'company') {
        const [row] = await db
          .delete(companies)
          .where(
            and(
              eq(companies.id, id),
              eq(companies.organization_id, orgId),
              eq(companies.needs_review, true),
            ),
          )
          .returning({ id: companies.id });
        deleted = row;
      } else if (type === 'person') {
        const [row] = await db
          .delete(persons)
          .where(
            and(
              eq(persons.id, id),
              eq(persons.organization_id, orgId),
              eq(persons.needs_review, true),
            ),
          )
          .returning({ id: persons.id });
        deleted = row;
      } else if (type === 'payable') {
        // Kaydın tenant_id'sini DB'den oku + org üyeliği ile authorize
        // (aggregate mode'da req.activeTenantId null olabilir).
        const [existing] = await db
          .select({ tenant_id: payableItems.tenant_id })
          .from(payableItems)
          .innerJoin(tenants, eq(tenants.id, payableItems.tenant_id))
          .where(and(eq(payableItems.id, id), eq(tenants.organization_id, orgId)));
        if (!existing) throw new HttpError(404, 'Fatura bulunamadı');
        const [row] = await db
          .delete(payableItems)
          .where(
            and(
              eq(payableItems.id, id),
              eq(payableItems.tenant_id, existing.tenant_id),
              sql`(${payableItems.needs_review} = true OR (${payableItems.reviewed_at} IS NULL AND (${payableItems.auto_created_source} LIKE 'smart_import%' OR ${payableItems.auto_created_source} LIKE 'efatura%')))`,
            ),
          )
          .returning({ id: payableItems.id });
        deleted = row;
      } else if (type === 'sales_invoice') {
        const [existing] = await db
          .select({ tenant_id: salesInvoices.tenant_id })
          .from(salesInvoices)
          .innerJoin(tenants, eq(tenants.id, salesInvoices.tenant_id))
          .where(and(eq(salesInvoices.id, id), eq(tenants.organization_id, orgId)));
        if (!existing) throw new HttpError(404, 'Satış faturası bulunamadı');
        const [row] = await db
          .delete(salesInvoices)
          .where(
            and(
              eq(salesInvoices.id, id),
              eq(salesInvoices.tenant_id, existing.tenant_id),
              eq(salesInvoices.needs_review, true),
            ),
          )
          .returning({ id: salesInvoices.id });
        deleted = row;
      } else {
        throw new HttpError(400, 'Tip company | person | payable | sales_invoice olmalı');
      }

      if (!deleted) throw new HttpError(404, 'Kayıt bulunamadı veya zaten onaylanmış');

      await auditFromRequest(req, {
        organization_id: orgId,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'review_queue.reject',
        target_type:
          type === 'company'
            ? 'companies'
            : type === 'person'
            ? 'persons'
            : type === 'payable'
            ? 'payable_items'
            : 'sales_invoices',
        target_id: id,
        details: { hard_deleted: true },
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

/** Fatura düzenle — review sırasında tutar, vade, tedarikçi, kategori veya tenant değiştirilebilir */
const patchPayableSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  invoice_number: z.string().max(128).optional().nullable(),
  supplier_name: z.string().max(255).optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  issue_date: z.string().date().optional().nullable(),
  due_date: z.string().date().optional().nullable(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().length(3).optional(),
  category: z.string().max(64).optional().nullable(),
  notes: z.string().optional().nullable(),
  /** Doğru tenant'a taşı (aynı org içinde) */
  target_tenant_id: z.string().uuid().optional(),
});

reviewQueueRouter.patch(
  '/review-queue/payable/:id',
  requireAuth,
  requireOrg,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = patchPayableSchema.parse(req.body);
      const db = getDb();
      const orgId = req.activeOrgId!;
      const tenantId = req.activeTenantId!;
      const id = String(req.params.id ?? '');

      const [current] = await db
        .select()
        .from(payableItems)
        .where(and(eq(payableItems.id, id), eq(payableItems.tenant_id, tenantId)))
        .limit(1);
      if (!current) throw new HttpError(404, 'Fatura bulunamadı');

      // target_tenant_id verilmişse, o tenant kullanıcının org'una ait mi kontrol et
      let movingToTenantId: string | null = null;
      if (body.target_tenant_id && body.target_tenant_id !== tenantId) {
        const [target] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(
            and(
              eq(tenants.id, body.target_tenant_id),
              eq(tenants.organization_id, orgId),
              eq(tenants.is_active, true),
            ),
          )
          .limit(1);
        if (!target) throw new HttpError(404, 'Hedef şirket bulunamadı veya erişim yok');
        movingToTenantId = target.id;
      }

      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (body.title !== undefined) patch.title = body.title;
      if (body.invoice_number !== undefined) patch.invoice_number = body.invoice_number;
      if (body.supplier_name !== undefined) patch.supplier_name = body.supplier_name;
      if (body.company_id !== undefined) patch.company_id = body.company_id;
      if (body.issue_date !== undefined) patch.issue_date = body.issue_date;
      if (body.due_date !== undefined) patch.due_date = body.due_date;
      if (body.amount !== undefined) patch.amount = body.amount;
      if (body.currency !== undefined) patch.currency = body.currency;
      if (body.category !== undefined) patch.category = body.category;
      if (body.notes !== undefined) patch.notes = body.notes;
      if (movingToTenantId) {
        patch.tenant_id = movingToTenantId;
        // metadata'ya taşıma izini ekle
        const newMeta = {
          ...(current.metadata as Record<string, unknown> ?? {}),
          tenant_corrected: {
            from: tenantId,
            to: movingToTenantId,
            by: req.authUser?.id ?? null,
            at: new Date().toISOString(),
          },
        };
        patch.metadata = newMeta;
      }

      const [row] = await db
        .update(payableItems)
        .set(patch)
        .where(and(eq(payableItems.id, id), eq(payableItems.tenant_id, tenantId)))
        .returning();
      if (!row) throw new HttpError(404, 'Fatura güncellenemedi');

      await auditFromRequest(req, {
        organization_id: orgId,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: movingToTenantId
          ? 'review_queue.payable.move_tenant'
          : 'review_queue.payable.edit',
        target_type: 'payable_items',
        target_id: id,
        details: {
          patch,
          from_tenant: movingToTenantId ? tenantId : undefined,
          to_tenant: movingToTenantId ?? undefined,
        },
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/** Satış faturası düzenle — aynı pattern */
const patchSalesInvoiceSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  invoice_number: z.string().max(128).optional().nullable(),
  customer_name: z.string().max(255).optional().nullable(),
  customer_company_id: z.string().uuid().optional().nullable(),
  customer_person_id: z.string().uuid().optional().nullable(),
  issue_date: z.string().date().optional().nullable(),
  due_date: z.string().date().optional().nullable(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional().nullable(),
  target_tenant_id: z.string().uuid().optional(),
});

reviewQueueRouter.patch(
  '/review-queue/sales_invoice/:id',
  requireAuth,
  requireOrg,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = patchSalesInvoiceSchema.parse(req.body);
      const db = getDb();
      const orgId = req.activeOrgId!;
      const tenantId = req.activeTenantId!;
      const id = String(req.params.id ?? '');

      const [current] = await db
        .select()
        .from(salesInvoices)
        .where(and(eq(salesInvoices.id, id), eq(salesInvoices.tenant_id, tenantId)))
        .limit(1);
      if (!current) throw new HttpError(404, 'Satış faturası bulunamadı');

      let movingToTenantId: string | null = null;
      if (body.target_tenant_id && body.target_tenant_id !== tenantId) {
        const [target] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(
            and(
              eq(tenants.id, body.target_tenant_id),
              eq(tenants.organization_id, orgId),
              eq(tenants.is_active, true),
            ),
          )
          .limit(1);
        if (!target) throw new HttpError(404, 'Hedef şirket bulunamadı');
        movingToTenantId = target.id;
      }

      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (body.title !== undefined) patch.title = body.title;
      if (body.invoice_number !== undefined) patch.invoice_number = body.invoice_number;
      if (body.customer_name !== undefined) patch.customer_name = body.customer_name;
      if (body.customer_company_id !== undefined)
        patch.customer_company_id = body.customer_company_id;
      if (body.customer_person_id !== undefined)
        patch.customer_person_id = body.customer_person_id;
      if (body.issue_date !== undefined) patch.issue_date = body.issue_date;
      if (body.due_date !== undefined) patch.due_date = body.due_date;
      if (body.amount !== undefined) patch.amount = body.amount;
      if (body.currency !== undefined) patch.currency = body.currency;
      if (body.notes !== undefined) patch.notes = body.notes;
      if (movingToTenantId) {
        patch.tenant_id = movingToTenantId;
        const newMeta = {
          ...(current.metadata as Record<string, unknown> ?? {}),
          tenant_corrected: {
            from: tenantId,
            to: movingToTenantId,
            by: req.authUser?.id ?? null,
            at: new Date().toISOString(),
          },
        };
        patch.metadata = newMeta;
      }

      const [row] = await db
        .update(salesInvoices)
        .set(patch)
        .where(and(eq(salesInvoices.id, id), eq(salesInvoices.tenant_id, tenantId)))
        .returning();
      if (!row) throw new HttpError(404, 'Satış faturası güncellenemedi');

      await auditFromRequest(req, {
        organization_id: orgId,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: movingToTenantId
          ? 'review_queue.sales_invoice.move_tenant'
          : 'review_queue.sales_invoice.edit',
        target_type: 'sales_invoices',
        target_id: id,
        details: {
          patch,
          from_tenant: movingToTenantId ? tenantId : undefined,
          to_tenant: movingToTenantId ?? undefined,
        },
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

/** Org içindeki tenant listesi (review queue tenant-move için) */
reviewQueueRouter.get(
  '/review-queue/org-tenants',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          sector: tenants.sector,
          tax_number: tenants.tax_number,
        })
        .from(tenants)
        .where(
          and(
            eq(tenants.organization_id, req.activeOrgId!),
            eq(tenants.is_active, true),
          ),
        )
        .orderBy(tenants.name);
      res.json({ data: rows });
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
 * Sadece aktif tenant kapsamındaki payable_items.company_id'leri target'a taşı; sonra source şirketi sil.
 */
const mergeSchema = z.object({
  target_id: z.string().uuid(),
});

reviewQueueRouter.post(
  '/review-queue/company/:id/merge',
  requireAuth,
  requireOrg,
  requireTenant,
  async (req, res, next) => {
    try {
      const sourceId = String(req.params.id ?? '');
      const { target_id } = mergeSchema.parse(req.body);
      if (sourceId === target_id) throw new HttpError(400, 'Aynı kayıt birleştirilemez');

      const db = getDb();
      const orgId = req.activeOrgId!;
      const tenantId = req.activeTenantId!;

      const [source] = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(and(eq(companies.id, sourceId), eq(companies.organization_id, orgId)));
      const [target] = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(and(eq(companies.id, target_id), eq(companies.organization_id, orgId)));
      if (!source || !target) throw new HttpError(404, 'Şirket bulunamadı');

      // Merge atomik: payable taşı + remaining count + conditional delete
      // tek transaction'da yapılmalı. Aksi halde count ile delete arasında
      // başka bir process source company'e yeni payable yazabilir → orphan.
      const { moved, remainingCount } = await db.transaction(async (tx) => {
        const movedRows = await tx
          .update(payableItems)
          .set({ company_id: target.id, supplier_name: target.name, updated_at: new Date() })
          .where(
            and(
              eq(payableItems.company_id, sourceId),
              eq(payableItems.tenant_id, tenantId),
            ),
          )
          .returning({ id: payableItems.id });

        const [remaining] = await tx
          .select({ cnt: sql<string>`COUNT(*)` })
          .from(payableItems)
          .where(eq(payableItems.company_id, sourceId));
        const rc = Number(remaining?.cnt ?? 0);

        if (rc === 0) {
          await tx.delete(companies).where(eq(companies.id, sourceId));
        }
        return { moved: movedRows, remainingCount: rc };
      });

      await auditFromRequest(req, {
        organization_id: orgId,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'review_queue.merge',
        target_type: 'companies',
        target_id: target.id,
        details: {
          source_id: sourceId,
          source_name: source.name,
          moved_payables: moved.length,
          source_deleted: remainingCount === 0,
        },
      });

      res.json({
        ok: true,
        moved_payables: moved.length,
        source_deleted: remainingCount === 0,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ====== BULK APPROVE / REJECT ============================================
// Onay Bekleyenler sayfasında çoklu seçim + tek tıklama operasyonu.
// Body: { type: 'payable'|'sales_invoice'|'company'|'person', ids: string[] }
// Org-scope: kayıtların tenant_id'leri DB'den okunur, ayrıca aktif tenant
// seçimi zorunlu değildir (aggregate mode'da çalışır).

const bulkSchema = z.object({
  type: z.enum(['company', 'person', 'payable', 'sales_invoice']),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

reviewQueueRouter.post(
  '/review-queue/bulk-approve',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const body = bulkSchema.parse(req.body);
      const db = getDb();
      const orgId = req.activeOrgId!;
      const userId = req.authUser?.id ?? null;
      const now = new Date();

      let approved = 0;

      if (body.type === 'company') {
        const result = await db
          .update(companies)
          .set({ needs_review: false, reviewed_at: now, reviewed_by: userId, updated_at: now })
          .where(
            and(
              inArray(companies.id, body.ids),
              eq(companies.organization_id, orgId),
              eq(companies.needs_review, true),
            ),
          )
          .returning({ id: companies.id });
        approved = result.length;
      } else if (body.type === 'person') {
        const result = await db
          .update(persons)
          .set({ needs_review: false, reviewed_at: now, reviewed_by: userId, updated_at: now })
          .where(
            and(
              inArray(persons.id, body.ids),
              eq(persons.organization_id, orgId),
              eq(persons.needs_review, true),
            ),
          )
          .returning({ id: persons.id });
        approved = result.length;
      } else if (body.type === 'payable') {
        // Org'a ait tenant'ları için scope filter
        const result = await db
          .update(payableItems)
          .set({ needs_review: false, reviewed_at: now, reviewed_by: userId, updated_at: now })
          .where(
            and(
              inArray(payableItems.id, body.ids),
              sql`${payableItems.tenant_id} IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid)`,
              sql`(${payableItems.needs_review} = true OR (${payableItems.reviewed_at} IS NULL AND (${payableItems.auto_created_source} LIKE 'smart_import%' OR ${payableItems.auto_created_source} LIKE 'efatura%')))`,
            ),
          )
          .returning({ id: payableItems.id });
        approved = result.length;
      } else if (body.type === 'sales_invoice') {
        const result = await db
          .update(salesInvoices)
          .set({ needs_review: false, reviewed_at: now, reviewed_by: userId, updated_at: now })
          .where(
            and(
              inArray(salesInvoices.id, body.ids),
              sql`${salesInvoices.tenant_id} IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid)`,
              eq(salesInvoices.needs_review, true),
            ),
          )
          .returning({ id: salesInvoices.id });
        approved = result.length;
      }

      await auditFromRequest(req, {
        organization_id: orgId,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'review_queue.bulk_approve',
        target_type:
          body.type === 'payable'
            ? 'payable_items'
            : body.type === 'sales_invoice'
            ? 'sales_invoices'
            : body.type === 'company'
            ? 'companies'
            : 'persons',
        details: { requested: body.ids.length, approved },
      });

      res.json({ data: { approved, failed: body.ids.length - approved } });
    } catch (err) {
      next(err);
    }
  },
);

reviewQueueRouter.post(
  '/review-queue/bulk-reject',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const body = bulkSchema.parse(req.body);
      const db = getDb();
      const orgId = req.activeOrgId!;

      let deleted = 0;

      if (body.type === 'company') {
        const result = await db
          .delete(companies)
          .where(
            and(
              inArray(companies.id, body.ids),
              eq(companies.organization_id, orgId),
              eq(companies.needs_review, true),
            ),
          )
          .returning({ id: companies.id });
        deleted = result.length;
      } else if (body.type === 'person') {
        const result = await db
          .delete(persons)
          .where(
            and(
              inArray(persons.id, body.ids),
              eq(persons.organization_id, orgId),
              eq(persons.needs_review, true),
            ),
          )
          .returning({ id: persons.id });
        deleted = result.length;
      } else if (body.type === 'payable') {
        const result = await db
          .delete(payableItems)
          .where(
            and(
              inArray(payableItems.id, body.ids),
              sql`${payableItems.tenant_id} IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid)`,
              sql`(${payableItems.needs_review} = true OR (${payableItems.reviewed_at} IS NULL AND (${payableItems.auto_created_source} LIKE 'smart_import%' OR ${payableItems.auto_created_source} LIKE 'efatura%')))`,
            ),
          )
          .returning({ id: payableItems.id });
        deleted = result.length;
      } else if (body.type === 'sales_invoice') {
        const result = await db
          .delete(salesInvoices)
          .where(
            and(
              inArray(salesInvoices.id, body.ids),
              sql`${salesInvoices.tenant_id} IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid)`,
              eq(salesInvoices.needs_review, true),
            ),
          )
          .returning({ id: salesInvoices.id });
        deleted = result.length;
      }

      await auditFromRequest(req, {
        organization_id: orgId,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'review_queue.bulk_reject',
        target_type:
          body.type === 'payable'
            ? 'payable_items'
            : body.type === 'sales_invoice'
            ? 'sales_invoices'
            : body.type === 'company'
            ? 'companies'
            : 'persons',
        details: { requested: body.ids.length, deleted, hard_deleted: true },
      });

      res.json({ data: { deleted, failed: body.ids.length - deleted } });
    } catch (err) {
      next(err);
    }
  },
);
