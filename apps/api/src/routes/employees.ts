/**
 * /v1/employees — Personel yönetimi.
 *
 *   GET    /v1/employees                → liste (active by default)
 *   POST   /v1/employees                → yeni personel
 *   GET    /v1/employees/:id            → tek detay
 *   PATCH  /v1/employees/:id            → düzenle
 *   DELETE /v1/employees/:id            → soft delete
 *   POST   /v1/employees/calculate      → brüt'ten net önizleme (kayıt değil)
 */
import { and, asc, desc, eq, getTableColumns } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { employees, getDb, tenants } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { calculatePayroll } from '../lib/payroll-calc';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { LIST_LIMITS, countTotal, listMeta } from '../lib/list-meta';
import { requireAuth } from '../middleware/auth';

export const employeesRouter = Router();

employeesRouter.get('/employees', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions: any[] = [
      tenantScope(req, employees.tenant_id),
      eq(employees.is_active, true),
    ];
    if (req.query.status) conditions.push(eq(employees.status, String(req.query.status)));
    const where = and(...conditions);

    const rows = await db
      .select({
        ...getTableColumns(employees),
        tenant_name: tenants.name,
      })
      .from(employees)
      .leftJoin(tenants, eq(tenants.id, employees.tenant_id))
      .where(where)
      .orderBy(asc(employees.full_name))
      .limit(LIST_LIMITS.large);
    const total = await countTotal(employees, where);
    res.json({ data: rows, ...listMeta(rows, total, LIST_LIMITS.large) });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  full_name: z.string().min(2).max(255),
  tc_kimlik_no: z.string().length(11).optional().nullable(),
  sgk_no: z.string().max(50).optional().nullable(),
  hire_date: z.string().min(8),
  gross_salary: z.union([z.string(), z.number()]).transform((v) => String(v)),
  marital_status: z.enum(['single', 'married']).default('single'),
  kids_count: z.number().int().min(0).max(10).default(0),
  spouse_working: z.boolean().default(false),
  disability_degree: z.number().int().min(0).max(3).default(0),
  department: z.string().max(120).optional().nullable(),
  position: z.string().max(120).optional().nullable(),
  iban: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
});

employeesRouter.post('/employees', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(employees)
      .values({
        tenant_id: req.activeTenantId!,
        full_name: body.full_name,
        tc_kimlik_no: body.tc_kimlik_no ?? null,
        sgk_no: body.sgk_no ?? null,
        hire_date: body.hire_date,
        gross_salary: body.gross_salary,
        marital_status: body.marital_status,
        kids_count: String(body.kids_count),
        spouse_working: body.spouse_working,
        disability_degree: String(body.disability_degree),
        department: body.department ?? null,
        position: body.position ?? null,
        iban: body.iban ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        notes: body.notes ?? null,
        created_by: req.authUser?.id ?? null,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'employee.create',
      target_type: 'employees',
      target_id: row?.id ?? null,
      details: {
        full_name: body.full_name,
        hire_date: body.hire_date,
        gross_salary: body.gross_salary,
        department: body.department ?? null,
        position: body.position ?? null,
      },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

employeesRouter.get('/employees/:id', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, String(req.params.id ?? '')),
          tenantScope(req, employees.tenant_id),
          eq(employees.is_active, true),
        ),
      );
    if (!row) throw new HttpError(404, 'Personel bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

employeesRouter.patch('/employees/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.partial().parse(req.body);
    const db = getDb();
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (body.full_name) patch.full_name = body.full_name;
    if (body.gross_salary != null) patch.gross_salary = body.gross_salary;
    if (body.marital_status) patch.marital_status = body.marital_status;
    if (body.kids_count != null) patch.kids_count = String(body.kids_count);
    if (body.spouse_working != null) patch.spouse_working = body.spouse_working;
    if (body.disability_degree != null) patch.disability_degree = String(body.disability_degree);
    if (body.department !== undefined) patch.department = body.department;
    if (body.position !== undefined) patch.position = body.position;
    if (body.iban !== undefined) patch.iban = body.iban;
    if (body.email !== undefined) patch.email = body.email;
    if (body.phone !== undefined) patch.phone = body.phone;
    if (body.sgk_no !== undefined) patch.sgk_no = body.sgk_no;
    if (body.tc_kimlik_no !== undefined) patch.tc_kimlik_no = body.tc_kimlik_no;
    if (body.hire_date !== undefined) patch.hire_date = body.hire_date;
    if (body.notes !== undefined) patch.notes = body.notes;

    const [row] = await db
      .update(employees)
      .set(patch)
      .where(
        and(
          eq(employees.id, String(req.params.id ?? '')),
          eq(employees.tenant_id, req.activeTenantId!),
          eq(employees.is_active, true),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Personel bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'employee.update',
      target_type: 'employees',
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
});

employeesRouter.delete('/employees/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(employees)
      .set({ is_active: false, status: 'left', updated_at: new Date() })
      .where(
        and(
          eq(employees.id, String(req.params.id ?? '')),
          eq(employees.tenant_id, req.activeTenantId!),
        ),
      )
      .returning({ id: employees.id });
    if (!row) throw new HttpError(404, 'Personel bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'employee.delete',
      target_type: 'employees',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { soft_delete: true, status: 'left' },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const calcSchema = z.object({
  gross_monthly: z.number().positive(),
  marital_status: z.enum(['single', 'married']).default('single'),
  kids_count: z.number().int().min(0).max(10).default(0),
  spouse_working: z.boolean().default(false),
});

employeesRouter.post('/employees/calculate', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = calcSchema.parse(req.body);
    const result = calculatePayroll(body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
