/**
 * /v1/archive — Soft-deleted kayıtların listelenmesi (admin görünümü).
 *
 *   GET /v1/archive?entity=<key>     → entity için soft-deleted kayıtlar
 *   GET /v1/archive/summary           → entity başına silinmiş kayıt sayısı
 *
 * Auth: super_admin / organization_admin / yonetici
 * Tenant scope: aggregate-aware (admin "Tüm Şirketler"'de tüm tenant'lar)
 *
 * NOT: Restore endpoint'leri her route'un altında (örn POST /payables/:id/restore).
 * Bu sadece "silinmiş kayıtları göster" listesi.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import {
  checksAndNotes,
  companies,
  employees,
  fixedAssets,
  getDb,
  payableItems,
  persons,
  salesInvoices,
  tenants,
} from '@sayman/db';
import { HttpError, requireOrg, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { LIST_LIMITS, listMeta } from '../lib/list-meta';
import { requireAuth } from '../middleware/auth';

export const archiveRouter = Router();

const ARCHIVE_ROLES = new Set(['super_admin', 'organization_admin', 'yonetici']);

const SUPPORTED_ENTITIES = [
  'payable',
  'sales_invoice',
  'employee',
  'check',
  'fixed_asset',
  'company',
  'person',
] as const;
type EntityKey = (typeof SUPPORTED_ENTITIES)[number];

// Entity → tablo + display alanları map'i
const ENTITY_CONFIG: Record<EntityKey, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  scope: 'tenant' | 'org';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  displayFields: (t: any) => Record<string, unknown>;
}> = {
  payable: {
    table: payableItems,
    scope: 'tenant',
    displayFields: (t) => ({
      id: t.id,
      tenant_id: t.tenant_id,
      title: t.title,
      supplier_name: t.supplier_name,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      updated_at: t.updated_at,
    }),
  },
  sales_invoice: {
    table: salesInvoices,
    scope: 'tenant',
    displayFields: (t) => ({
      id: t.id,
      tenant_id: t.tenant_id,
      title: t.title,
      customer_name: t.customer_name,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      updated_at: t.updated_at,
    }),
  },
  employee: {
    table: employees,
    scope: 'tenant',
    displayFields: (t) => ({
      id: t.id,
      tenant_id: t.tenant_id,
      full_name: t.full_name,
      department: t.department,
      position: t.position,
      status: t.status,
      updated_at: t.updated_at,
    }),
  },
  check: {
    table: checksAndNotes,
    scope: 'tenant',
    displayFields: (t) => ({
      id: t.id,
      tenant_id: t.tenant_id,
      check_number: t.check_number,
      direction: t.direction,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      updated_at: t.updated_at,
    }),
  },
  fixed_asset: {
    table: fixedAssets,
    scope: 'tenant',
    displayFields: (t) => ({
      id: t.id,
      tenant_id: t.tenant_id,
      name: t.name,
      category: t.category,
      purchase_cost: t.purchase_cost,
      status: t.status,
      updated_at: t.updated_at,
    }),
  },
  company: {
    table: companies,
    scope: 'org',
    displayFields: (t) => ({
      id: t.id,
      organization_id: t.organization_id,
      name: t.name,
      tax_number: t.tax_number,
      updated_at: t.updated_at,
    }),
  },
  person: {
    table: persons,
    scope: 'org',
    displayFields: (t) => ({
      id: t.id,
      organization_id: t.organization_id,
      full_name: t.full_name,
      tc_kimlik_no: t.tc_kimlik_no,
      updated_at: t.updated_at,
    }),
  },
};

// GET /v1/archive?entity=<key> — soft-deleted kayıtları listele
archiveRouter.get('/archive', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    if (!ARCHIVE_ROLES.has(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Arşiv görüntüleme yetkisi yok', 'FORBIDDEN');
    }
    const entityParam = String(req.query.entity ?? '');
    if (!SUPPORTED_ENTITIES.includes(entityParam as EntityKey)) {
      throw new HttpError(
        400,
        `entity parametresi gerekli, desteklenenler: ${SUPPORTED_ENTITIES.join(', ')}`,
        'INVALID_ENTITY',
      );
    }
    const cfg = ENTITY_CONFIG[entityParam as EntityKey];
    const db = getDb();

    const scopeWhere =
      cfg.scope === 'tenant'
        ? tenantScope(req, cfg.table.tenant_id)
        : eq(cfg.table.organization_id, req.activeOrgId!);

    const where = and(scopeWhere, eq(cfg.table.is_active, false));

    // Tenant scope ise tenant_name join
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: Array<Record<string, unknown>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = cfg.displayFields(cfg.table) as any;
    if (cfg.scope === 'tenant') {
      rows = (await db
        .select({ ...cols, tenant_name: tenants.name })
        .from(cfg.table)
        .leftJoin(tenants, eq(tenants.id, cfg.table.tenant_id))
        .where(where)
        .orderBy(desc(cfg.table.updated_at))
        .limit(LIST_LIMITS.medium)) as Array<Record<string, unknown>>;
    } else {
      rows = (await db
        .select(cols)
        .from(cfg.table)
        .where(where)
        .orderBy(desc(cfg.table.updated_at))
        .limit(LIST_LIMITS.medium)) as Array<Record<string, unknown>>;
    }

    res.json({
      data: rows,
      ...listMeta(rows, rows.length, LIST_LIMITS.medium),
      entity: entityParam,
    });
  } catch (err) {
    next(err);
  }
});

// GET /v1/archive/summary — entity başına soft-deleted kayıt sayısı (rozet için)
archiveRouter.get('/archive/summary', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!ARCHIVE_ROLES.has(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Arşiv görüntüleme yetkisi yok', 'FORBIDDEN');
    }
    const db = getDb();
    const orgId = req.activeOrgId!;

    const counts: Record<string, number> = {};
    for (const entity of SUPPORTED_ENTITIES) {
      const cfg = ENTITY_CONFIG[entity];
      const where =
        cfg.scope === 'tenant'
          ? sql`is_active = false AND tenant_id IN (SELECT id FROM tenants WHERE organization_id = ${orgId}::uuid)`
          : sql`is_active = false AND organization_id = ${orgId}::uuid`;
      const [c] = await db
        .select({ n: sql<string>`COUNT(*)` })
        .from(cfg.table)
        .where(where);
      counts[entity] = Number(c?.n ?? 0);
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({ data: { ...counts, total } });
  } catch (err) {
    next(err);
  }
});
