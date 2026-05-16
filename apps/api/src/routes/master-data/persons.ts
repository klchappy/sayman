/**
 * /v1/persons — Şahıs (Person) CRUD.
 * Master data → organization-scope; tenant'larda görünürlük share_scope ile.
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, persons, type Person } from '@sayman/db';
import { requireAuth } from '../../middleware/auth';
import { auditFromRequest } from '../../lib/audit';
import { HttpError, requireOrg, requireTenant, shareScopeWhereSQL } from '../../lib/helpers';

const shareScopeSchema = z.union([z.literal('*'), z.array(z.string().min(1)).min(1)]);

const createSchema = z.object({
  full_name: z.string().min(2).max(200),
  national_id: z.string().max(11).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  family_group: z.string().max(64).optional().nullable(),
  share_scope: shareScopeSchema.default('*'),
});

const updateSchema = createSchema.partial();

export const personsRouter = Router();

// LIST — eğer tenant context varsa share_scope filtresi, yoksa tüm organization
personsRouter.get('/persons', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    let where: ReturnType<typeof eq> | ReturnType<typeof and> = and(
      eq(persons.organization_id, req.activeOrgId!),
      eq(persons.is_active, true),
    )!;

    // Tenant context'i varsa share_scope filtresi ekle
    if (req.saymanContext?.tenantSlug && req.saymanContext?.tenantId) {
      where = and(where, shareScopeWhereSQL(req.saymanContext.tenantSlug)) as typeof where;
    }
    const rows = await db.select().from(persons).where(where).orderBy(desc(persons.created_at));
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// CREATE
personsRouter.post('/persons', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(persons)
      .values({
        organization_id: req.activeOrgId!,
        full_name: body.full_name,
        national_id: body.national_id ?? null,
        phone: body.phone ?? null,
        family_group: body.family_group ?? null,
        share_scope: body.share_scope,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'person.create',
      target_type: 'persons',
      target_id: row?.id ?? null,
      details: {
        full_name: body.full_name,
        national_id: body.national_id ?? null,
        share_scope: body.share_scope,
      },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

// GET single
personsRouter.get('/persons/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(persons)
      .where(
        and(
          eq(persons.id, String(req.params.id ?? '')),
          eq(persons.organization_id, req.activeOrgId!),
          eq(persons.is_active, true),
        ),
      );
    if (!row) throw new HttpError(404, 'Şahıs bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// UPDATE
personsRouter.patch('/persons/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(persons)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(persons.id, String(req.params.id ?? '')), eq(persons.organization_id, req.activeOrgId!)))
      .returning();
    if (!row) throw new HttpError(404, 'Şahıs bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'person.update',
      target_type: 'persons',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { patch: body },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE → soft delete (is_active=false)
personsRouter.delete('/persons/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(persons)
      .set({ is_active: false, updated_at: new Date() })
      .where(and(eq(persons.id, String(req.params.id ?? '')), eq(persons.organization_id, req.activeOrgId!)))
      .returning();
    if (!row) throw new HttpError(404, 'Şahıs bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'person.delete',
      target_type: 'persons',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { soft_delete: true },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
