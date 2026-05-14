/**
 * /v1/search?q=... — Global full-text search (GIN tsvector + ts_rank).
 *
 * Strateji:
 *   - to_tsvector('simple', f_unaccent(...)) @@ websearch_to_tsquery('simple', q)
 *   - GIN expression index ile O(log n) lookup
 *   - ts_rank ile alaka skoru → en alakalı önce
 *   - Tek-token kullanıcı girişlerinde prefix match (`:*` operator)
 *
 * Tarar:
 *   persons / companies / properties (org-scope)
 *   payable_items / subscriptions / guarantees / subsidiaries (tenant-scope)
 *   banks / institutions (org-scope)
 *
 * Çıktı: kategorize + ranked, kategori başına max 5.
 */
import { desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, searchHistory } from '@sayman/db';
import { requireAuth } from '../middleware/auth';
import { requireOrg } from '../lib/helpers';

const LIMIT_PER_CATEGORY = 5;

export const searchRouter = Router();

/** Kullanıcı girişini tsquery'ye dönüştür: tek kelime → prefix, çoklu → AND */
function buildTsQuery(input: string): string {
  // Türkçe karakterleri de simple'a uygun şekilde unaccent (server-side)
  const tokens = input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')) // alphanumeric only
    .filter((t) => t.length >= 1);
  if (tokens.length === 0) return '';
  // Son token'a :* (prefix), öncekiler tam token
  const ts = tokens.map((t, i) => (i === tokens.length - 1 ? `${t}:*` : t)).join(' & ');
  return ts;
}

searchRouter.get('/search', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.json({ data: { query: q, results: [], ms: 0 } });
      return;
    }
    const tsq = buildTsQuery(q);
    if (!tsq) {
      res.json({ data: { query: q, results: [], ms: 0 } });
      return;
    }

    const start = Date.now();
    const db = getDb();
    const orgId = req.activeOrgId!;
    const tenantId = req.saymanContext?.tenantId ?? null;

    const results: Array<{
      category: string;
      label: string;
      icon: string;
      items: Array<{
        id: string;
        title: string;
        subtitle?: string;
        url: string;
        rank: number;
      }>;
    }> = [];

    // --- Persons (org) ---
    const persons = await db.execute(sql`
      SELECT id, full_name, national_id,
        ts_rank(
          to_tsvector('simple',
            coalesce(f_unaccent(full_name), '') || ' ' ||
            coalesce(national_id, '') || ' ' ||
            coalesce(phone, '')),
          to_tsquery('simple', ${tsq})
        ) AS rank
      FROM persons
      WHERE organization_id = ${orgId} AND is_active = true
        AND to_tsvector('simple',
              coalesce(f_unaccent(full_name), '') || ' ' ||
              coalesce(national_id, '') || ' ' ||
              coalesce(phone, ''))
            @@ to_tsquery('simple', ${tsq})
      ORDER BY rank DESC
      LIMIT ${LIMIT_PER_CATEGORY}
    `);
    const personRows = (persons.rows ?? persons) as Array<Record<string, unknown>>;
    if (personRows.length > 0) {
      results.push({
        category: 'persons',
        label: 'Şahıslar',
        icon: 'UserCircle',
        items: personRows.map((p) => ({
          id: String(p.id),
          title: String(p.full_name),
          subtitle: p.national_id ? String(p.national_id) : undefined,
          url: '/master-data/persons',
          rank: Number(p.rank ?? 0),
        })),
      });
    }

    // --- Companies (org) ---
    const companies = await db.execute(sql`
      SELECT id, name, tax_number,
        ts_rank(
          to_tsvector('simple',
            coalesce(f_unaccent(name), '') || ' ' ||
            coalesce(f_unaccent(short_name), '') || ' ' ||
            coalesce(tax_number, '')),
          to_tsquery('simple', ${tsq})
        ) AS rank
      FROM companies
      WHERE organization_id = ${orgId} AND is_active = true
        AND to_tsvector('simple',
              coalesce(f_unaccent(name), '') || ' ' ||
              coalesce(f_unaccent(short_name), '') || ' ' ||
              coalesce(tax_number, ''))
            @@ to_tsquery('simple', ${tsq})
      ORDER BY rank DESC
      LIMIT ${LIMIT_PER_CATEGORY}
    `);
    const companyRows = (companies.rows ?? companies) as Array<Record<string, unknown>>;
    if (companyRows.length > 0) {
      results.push({
        category: 'companies',
        label: 'Şirketler',
        icon: 'Building2',
        items: companyRows.map((c) => ({
          id: String(c.id),
          title: String(c.name),
          subtitle: c.tax_number ? String(c.tax_number) : undefined,
          url: '/master-data/companies',
          rank: Number(c.rank ?? 0),
        })),
      });
    }

    // --- Properties (org) ---
    const properties = await db.execute(sql`
      SELECT id, name, municipality,
        ts_rank(
          to_tsvector('simple',
            coalesce(f_unaccent(name), '') || ' ' ||
            coalesce(f_unaccent(municipality), '') || ' ' ||
            coalesce(registry_number, '')),
          to_tsquery('simple', ${tsq})
        ) AS rank
      FROM properties
      WHERE organization_id = ${orgId} AND is_active = true
        AND to_tsvector('simple',
              coalesce(f_unaccent(name), '') || ' ' ||
              coalesce(f_unaccent(municipality), '') || ' ' ||
              coalesce(registry_number, ''))
            @@ to_tsquery('simple', ${tsq})
      ORDER BY rank DESC
      LIMIT ${LIMIT_PER_CATEGORY}
    `);
    const propertyRows = (properties.rows ?? properties) as Array<Record<string, unknown>>;
    if (propertyRows.length > 0) {
      results.push({
        category: 'properties',
        label: 'Mülkler',
        icon: 'Home',
        items: propertyRows.map((p) => ({
          id: String(p.id),
          title: String(p.name),
          subtitle: p.municipality ? String(p.municipality) : undefined,
          url: '/master-data/properties',
          rank: Number(p.rank ?? 0),
        })),
      });
    }

    // Tenant-scope tarama (tenant context yoksa atla)
    if (tenantId) {
      // --- Payables ---
      const payables = await db.execute(sql`
        SELECT id, title, invoice_number, amount,
          ts_rank(
            to_tsvector('simple',
              coalesce(f_unaccent(title), '') || ' ' ||
              coalesce(invoice_number, '') || ' ' ||
              coalesce(f_unaccent(supplier_name), '') || ' ' ||
              coalesce(f_unaccent(notes), '')),
            to_tsquery('simple', ${tsq})
          ) AS rank
        FROM payable_items
        WHERE tenant_id = ${tenantId} AND is_active = true
          AND to_tsvector('simple',
                coalesce(f_unaccent(title), '') || ' ' ||
                coalesce(invoice_number, '') || ' ' ||
                coalesce(f_unaccent(supplier_name), '') || ' ' ||
                coalesce(f_unaccent(notes), ''))
              @@ to_tsquery('simple', ${tsq})
        ORDER BY rank DESC
        LIMIT ${LIMIT_PER_CATEGORY}
      `);
      const payRows = (payables.rows ?? payables) as Array<Record<string, unknown>>;
      if (payRows.length > 0) {
        results.push({
          category: 'payables',
          label: 'Faturalar',
          icon: 'Receipt',
          items: payRows.map((p) => ({
            id: String(p.id),
            title: String(p.title),
            subtitle: `${p.invoice_number ?? '-'} · ${p.amount} TL`,
            url: `/payables/${p.id}`,
            rank: Number(p.rank ?? 0),
          })),
        });
      }

      // --- Subscriptions ---
      const subscriptions = await db.execute(sql`
        SELECT id, package_name, subscription_no,
          ts_rank(
            to_tsvector('simple',
              coalesce(f_unaccent(package_name), '') || ' ' ||
              coalesce(subscription_no, '') || ' ' ||
              coalesce(f_unaccent(notes), '')),
            to_tsquery('simple', ${tsq})
          ) AS rank
        FROM subscriptions
        WHERE tenant_id = ${tenantId} AND is_active = true
          AND to_tsvector('simple',
                coalesce(f_unaccent(package_name), '') || ' ' ||
                coalesce(subscription_no, '') || ' ' ||
                coalesce(f_unaccent(notes), ''))
              @@ to_tsquery('simple', ${tsq})
        ORDER BY rank DESC
        LIMIT ${LIMIT_PER_CATEGORY}
      `);
      const subRows = (subscriptions.rows ?? subscriptions) as Array<Record<string, unknown>>;
      if (subRows.length > 0) {
        results.push({
          category: 'subscriptions',
          label: 'Abonelikler',
          icon: 'Repeat',
          items: subRows.map((s) => ({
            id: String(s.id),
            title: String(s.package_name ?? 'Abonelik'),
            subtitle: s.subscription_no ? String(s.subscription_no) : undefined,
            url: '/subscriptions',
            rank: Number(s.rank ?? 0),
          })),
        });
      }

      // --- Guarantees ---
      const guarantees = await db.execute(sql`
        SELECT id, beneficiary_name, letter_no,
          ts_rank(
            to_tsvector('simple',
              coalesce(f_unaccent(beneficiary_name), '') || ' ' ||
              coalesce(letter_no, '') || ' ' ||
              coalesce(f_unaccent(notes), '')),
            to_tsquery('simple', ${tsq})
          ) AS rank
        FROM guarantees
        WHERE tenant_id = ${tenantId} AND is_active = true
          AND to_tsvector('simple',
                coalesce(f_unaccent(beneficiary_name), '') || ' ' ||
                coalesce(letter_no, '') || ' ' ||
                coalesce(f_unaccent(notes), ''))
              @@ to_tsquery('simple', ${tsq})
        ORDER BY rank DESC
        LIMIT ${LIMIT_PER_CATEGORY}
      `);
      const gRows = (guarantees.rows ?? guarantees) as Array<Record<string, unknown>>;
      if (gRows.length > 0) {
        results.push({
          category: 'guarantees',
          label: 'Teminat Mektupları',
          icon: 'ShieldCheck',
          items: gRows.map((g) => ({
            id: String(g.id),
            title: String(g.beneficiary_name),
            subtitle: g.letter_no ? String(g.letter_no) : undefined,
            url: '/guarantees',
            rank: Number(g.rank ?? 0),
          })),
        });
      }

      // --- Subsidiaries ---
      const subsidiaries = await db.execute(sql`
        SELECT id, name, code,
          ts_rank(
            to_tsvector('simple',
              coalesce(f_unaccent(name), '') || ' ' ||
              coalesce(code, '') || ' ' ||
              coalesce(f_unaccent(description), '')),
            to_tsquery('simple', ${tsq})
          ) AS rank
        FROM subsidiaries
        WHERE tenant_id = ${tenantId} AND is_active = true
          AND to_tsvector('simple',
                coalesce(f_unaccent(name), '') || ' ' ||
                coalesce(code, '') || ' ' ||
                coalesce(f_unaccent(description), ''))
              @@ to_tsquery('simple', ${tsq})
        ORDER BY rank DESC
        LIMIT ${LIMIT_PER_CATEGORY}
      `);
      const subsRows = (subsidiaries.rows ?? subsidiaries) as Array<Record<string, unknown>>;
      if (subsRows.length > 0) {
        results.push({
          category: 'subsidiaries',
          label: 'Yan Şirketler',
          icon: 'Network',
          items: subsRows.map((s) => ({
            id: String(s.id),
            title: String(s.name),
            subtitle: s.code ? String(s.code) : undefined,
            url: '/subsidiaries',
            rank: Number(s.rank ?? 0),
          })),
        });
      }
    }

    const ms = Date.now() - start;

    // History — fire-and-forget
    const totalResults = results.reduce((s, r) => s + r.items.length, 0);
    db
      .insert(searchHistory)
      .values({
        user_id: req.authUser!.id,
        query: q,
        tenant_id: tenantId,
        result_count: totalResults,
        duration_ms: ms,
      })
      .catch(() => undefined);

    res.json({ data: { query: q, results, ms } });
  } catch (err) {
    next(err);
  }
});

// --- Recent (kullanıcının son aramaları) ---
searchRouter.get('/search/recent', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    // Distinct query, son N
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (query) query, created_at, result_count
      FROM search_history
      WHERE user_id = ${req.authUser!.id}
      ORDER BY query, created_at DESC
      LIMIT 10
    `);
    const list = ((rows.rows ?? rows) as Array<Record<string, unknown>>).slice(0, 10);
    res.json({
      data: list.map((r) => ({
        query: String(r.query),
        last_used: r.created_at,
        result_count: Number(r.result_count ?? 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// --- Top (org içinde en popüler aramalar — analytics) ---
searchRouter.get('/search/top', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const tenantId = req.saymanContext?.tenantId ?? null;
    const rows = await db.execute(sql`
      SELECT query, COUNT(*)::int AS uses, MAX(created_at) AS last_used
      FROM search_history
      WHERE (${tenantId}::uuid IS NULL OR tenant_id = ${tenantId}::uuid)
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY query
      ORDER BY uses DESC, last_used DESC
      LIMIT 10
    `);
    res.json({
      data: ((rows.rows ?? rows) as Array<Record<string, unknown>>).map((r) => ({
        query: String(r.query),
        uses: Number(r.uses ?? 0),
        last_used: r.last_used,
      })),
    });
  } catch (err) {
    next(err);
  }
});
