/**
 * /v1/support/tickets — Destek talepleri.
 *
 *   GET    /v1/support/tickets              → kullanıcının kendi org'unda görebildiği
 *   POST   /v1/support/tickets              → manuel talep aç (auth gerekli)
 *   POST   /v1/support/tickets/auto-error   → otomatik hata kaydı (auth opsiyonel)
 *   GET    /v1/support/tickets/:id          → tek detay (sahibi veya admin)
 *   PATCH  /v1/support/tickets/:id          → status değiştir (admin) veya kendi açıklama ekle
 *   DELETE /v1/support/tickets/:id          → soft (status=closed) — admin
 *
 * Otomatik akış:
 *   - Frontend ErrorBoundary crash'inde POST /auto-error → category='auto_error'
 *   - Backend errorHandler 500 hatasında req.user'a göre auto open
 *   - Admin /destek/admin sayfasında tüm açık ticket'lara bakar
 */
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, supportTickets, tenants, users } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { consumeRateLimit } from '../lib/rate-limit';
import { requireAuth } from '../middleware/auth';

export const supportRouter = Router();

const ADMIN_ROLES = new Set(['super_admin', 'organization_admin']);

const CATEGORIES = ['bug', 'feature_request', 'question', 'auto_error'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

// --- POST /support/tickets (manuel açma) -----------------------------------

const createSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(5000).optional().nullable(),
  category: z.enum(CATEGORIES).default('question'),
  priority: z.enum(PRIORITIES).default('normal'),
  tenant_id: z.string().uuid().optional().nullable(),
});

supportRouter.post('/support/tickets', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(supportTickets)
      .values({
        organization_id: req.activeOrgId!,
        tenant_id: body.tenant_id ?? (req.activeTenantId || null),
        user_id: req.authUser?.id ?? null,
        title: body.title,
        description: body.description ?? null,
        category: body.category,
        priority: body.priority,
        status: 'open',
      })
      .returning();
    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'support.ticket.create',
      target_type: 'support_tickets',
      target_id: row?.id,
      details: { category: body.category, priority: body.priority },
    });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

// --- POST /support/tickets/auto-error (frontend ErrorBoundary için) --------

const autoErrorSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(5000).optional().nullable(),
  error_context: z
    .object({
      url: z.string().max(2000).optional(),
      stack: z.string().max(20000).optional(),
      user_agent: z.string().max(500).optional(),
      http_status: z.number().int().optional(),
      route_path: z.string().max(500).optional(),
      component_stack: z.string().max(20000).optional(),
      error_name: z.string().max(255).optional(),
      tenant_slug: z.string().max(64).optional(),
    })
    .partial()
    .optional(),
});

supportRouter.post(
  '/support/tickets/auto-error',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      // Rate limit — bir hata loop'a girip 1000 ticket açmasın
      const userKey = req.authUser?.id ?? 'anon';
      await consumeRateLimit({ identifier: `auto-error:${userKey}`, limit: 10, window_seconds: 300 });

      const body = autoErrorSchema.parse(req.body);
      const db = getDb();

      // De-duplication: son 1 saat içinde aynı user + aynı title varsa yeni
      // ticket açma; mevcut error_context'e append yap.
      const recentTitle = body.title.slice(0, 200);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existingArr = req.authUser?.id
        ? await db
            .select({ id: supportTickets.id, error_context: supportTickets.error_context })
            .from(supportTickets)
            .where(
              and(
                eq(supportTickets.organization_id, req.activeOrgId!),
                eq(supportTickets.user_id, req.authUser.id),
                eq(supportTickets.category, 'auto_error'),
                eq(supportTickets.title, recentTitle),
              ),
            )
            .orderBy(desc(supportTickets.created_at))
            .limit(1)
        : [];

      const existing = existingArr[0];
      if (existing && existing.id) {
        // 1 saat içinde aynı hata → mevcut ticket'a tekrar geldi notu ekle
        const prevCtx = (existing.error_context as Record<string, unknown> | null) ?? {};
        const occurrences = Number(prevCtx.occurrences ?? 1) + 1;
        await db
          .update(supportTickets)
          .set({
            error_context: { ...prevCtx, occurrences, last_seen_at: new Date().toISOString() },
            updated_at: new Date(),
          })
          .where(eq(supportTickets.id, existing.id));
        res.status(200).json({ data: { id: existing.id, deduplicated: true, occurrences } });
        return;
      }

      const [row] = await db
        .insert(supportTickets)
        .values({
          organization_id: req.activeOrgId!,
          tenant_id: req.activeTenantId || null,
          user_id: req.authUser?.id ?? null,
          title: recentTitle,
          description: body.description ?? null,
          category: 'auto_error',
          priority: 'normal',
          status: 'open',
          error_context: {
            ...(body.error_context ?? {}),
            occurrences: 1,
            first_seen_at: new Date().toISOString(),
            user_agent: body.error_context?.user_agent ?? req.headers['user-agent'] ?? null,
          },
        })
        .returning();
      void oneHourAgo;
      res.status(201).json({ data: { id: row?.id, deduplicated: false } });
    } catch (err) {
      next(err);
    }
  },
);

// --- GET /support/tickets --------------------------------------------------

supportRouter.get('/support/tickets', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const orgId = req.activeOrgId!;
    const isAdmin = ADMIN_ROLES.has(req.effectiveRole ?? '');
    const statusFilter = req.query.status ? String(req.query.status) : null;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    const conditions = [eq(supportTickets.organization_id, orgId)];
    if (statusFilter && (STATUSES as readonly string[]).includes(statusFilter)) {
      conditions.push(eq(supportTickets.status, statusFilter));
    }
    // Normal kullanıcı sadece kendi ticket'larını görür
    if (!isAdmin && req.authUser?.id) {
      conditions.push(eq(supportTickets.user_id, req.authUser.id));
    }

    const rows = await db
      .select({
        id: supportTickets.id,
        title: supportTickets.title,
        category: supportTickets.category,
        priority: supportTickets.priority,
        status: supportTickets.status,
        tenant_id: supportTickets.tenant_id,
        tenant_name: tenants.name,
        user_id: supportTickets.user_id,
        user_name: users.full_name,
        user_email: users.email,
        created_at: supportTickets.created_at,
        updated_at: supportTickets.updated_at,
        resolved_at: supportTickets.resolved_at,
        error_context: supportTickets.error_context,
        // Liste view'de description ve internal_notes yer kaplar; detail endpoint'te döner
      })
      .from(supportTickets)
      .leftJoin(tenants, eq(tenants.id, supportTickets.tenant_id))
      .leftJoin(users, eq(users.id, supportTickets.user_id))
      .where(and(...conditions))
      .orderBy(desc(supportTickets.created_at))
      .limit(limit);

    res.json({ data: rows, is_admin_view: isAdmin });
  } catch (err) {
    next(err);
  }
});

// --- Org-wide summary (badge için) -----------------------------------------
// Static routes must be registered before /support/tickets/:id.
supportRouter.get(
  '/support/tickets/summary',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const isAdmin = ADMIN_ROLES.has(req.effectiveRole ?? '');
      const conditions = [
        eq(supportTickets.organization_id, req.activeOrgId!),
        inArray(supportTickets.status, ['open', 'in_progress']),
      ];
      if (!isAdmin && req.authUser?.id) {
        conditions.push(
          or(
            eq(supportTickets.user_id, req.authUser.id),
            // user_id null = anonim auto_error; kullanıcı herkesinkini görmesin
          )!,
        );
      }
      const rows = await db
        .select({ id: supportTickets.id })
        .from(supportTickets)
        .where(and(...conditions));
      res.json({ data: { open_count: rows.length, is_admin_view: isAdmin } });
    } catch (err) {
      next(err);
    }
  },
);

// --- GET /support/tickets/:id ----------------------------------------------

supportRouter.get('/support/tickets/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const id = String(req.params.id ?? '');
    const isAdmin = ADMIN_ROLES.has(req.effectiveRole ?? '');

    const conditions = [
      eq(supportTickets.id, id),
      eq(supportTickets.organization_id, req.activeOrgId!),
    ];
    if (!isAdmin && req.authUser?.id) {
      conditions.push(eq(supportTickets.user_id, req.authUser.id));
    }

    const [row] = await db
      .select()
      .from(supportTickets)
      .where(and(...conditions));
    if (!row) throw new HttpError(404, 'Talep bulunamadı');

    // Normal kullanıcı internal_notes göremez
    const payload = isAdmin ? row : { ...row, internal_notes: null };
    res.json({ data: payload });
  } catch (err) {
    next(err);
  }
});

// --- PATCH /support/tickets/:id (admin) ------------------------------------

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  internal_notes: z.string().max(20000).optional().nullable(),
});

supportRouter.patch(
  '/support/tickets/:id',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const isAdmin = ADMIN_ROLES.has(req.effectiveRole ?? '');
      if (!isAdmin) throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');

      const id = String(req.params.id ?? '');
      const body = patchSchema.parse(req.body);
      const db = getDb();

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (body.status !== undefined) updates.status = body.status;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.internal_notes !== undefined) updates.internal_notes = body.internal_notes;
      if (body.status === 'resolved' || body.status === 'closed') {
        updates.resolved_at = new Date();
        updates.resolved_by = req.authUser?.id ?? null;
      }

      const [row] = await db
        .update(supportTickets)
        .set(updates)
        .where(
          and(
            eq(supportTickets.id, id),
            eq(supportTickets.organization_id, req.activeOrgId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Talep bulunamadı');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'support.ticket.update',
        target_type: 'support_tickets',
        target_id: id,
        details: { status: body.status, priority: body.priority },
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

