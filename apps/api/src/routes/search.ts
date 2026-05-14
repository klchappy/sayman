/**
 * /v1/search?q=... — Global arama (org+tenant scope).
 *
 * Endpoint:
 *   GET /v1/search?q=elektrik
 *
 * Tarar:
 *   - persons (org-scope) → ad, telefon, national_id
 *   - companies (org-scope) → name, tax_number
 *   - properties (org-scope) → name, municipality
 *   - payables (tenant-scope) → title, invoice_number
 *   - subscriptions (tenant-scope) → package_name, subscription_no
 *   - guarantees (tenant-scope) → beneficiary_name, letter_no
 *   - subsidiaries (tenant-scope) → name, code
 *
 * Çıktı: kategorize edilmiş, kısa (max 5 per kategori, total ~25).
 * Performans: ILIKE indexsiz ama küçük dataset için yeterli; pg_trgm + GIN ileride.
 */
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import {
  companies,
  getDb,
  guarantees,
  payableItems,
  persons,
  properties,
  subscriptions,
  subsidiaries,
} from '@sayman/db';
import { requireAuth } from '../middleware/auth';
import { requireOrg } from '../lib/helpers';

const LIMIT_PER_CATEGORY = 5;

export const searchRouter = Router();

searchRouter.get('/search', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.json({ data: { query: q, results: [] } });
      return;
    }
    const like = `%${q}%`;
    const db = getDb();
    const orgId = req.activeOrgId!;
    const tenantId = req.saymanContext?.tenantId ?? null;

    const results: Array<{
      category: string;
      label: string;
      icon: string;
      items: Array<{ id: string; title: string; subtitle?: string; url: string }>;
    }> = [];

    // --- Persons (org) ---
    const personRows = await db
      .select({ id: persons.id, full_name: persons.full_name, national_id: persons.national_id })
      .from(persons)
      .where(
        and(
          eq(persons.organization_id, orgId),
          eq(persons.is_active, true),
          or(ilike(persons.full_name, like), ilike(persons.national_id, like), ilike(persons.phone, like)),
        ),
      )
      .limit(LIMIT_PER_CATEGORY);
    if (personRows.length > 0) {
      results.push({
        category: 'persons',
        label: 'Şahıslar',
        icon: 'UserCircle',
        items: personRows.map((p) => ({
          id: p.id,
          title: p.full_name,
          subtitle: p.national_id ?? undefined,
          url: '/master-data/persons',
        })),
      });
    }

    // --- Companies (org) ---
    const companyRows = await db
      .select({ id: companies.id, name: companies.name, tax_number: companies.tax_number })
      .from(companies)
      .where(
        and(
          eq(companies.organization_id, orgId),
          eq(companies.is_active, true),
          or(ilike(companies.name, like), ilike(companies.tax_number, like)),
        ),
      )
      .limit(LIMIT_PER_CATEGORY);
    if (companyRows.length > 0) {
      results.push({
        category: 'companies',
        label: 'Şirketler',
        icon: 'Building2',
        items: companyRows.map((c) => ({
          id: c.id,
          title: c.name,
          subtitle: c.tax_number ?? undefined,
          url: '/master-data/companies',
        })),
      });
    }

    // --- Properties (org) ---
    const propertyRows = await db
      .select({ id: properties.id, name: properties.name, municipality: properties.municipality })
      .from(properties)
      .where(
        and(
          eq(properties.organization_id, orgId),
          eq(properties.is_active, true),
          or(ilike(properties.name, like), ilike(properties.municipality, like)),
        ),
      )
      .limit(LIMIT_PER_CATEGORY);
    if (propertyRows.length > 0) {
      results.push({
        category: 'properties',
        label: 'Mülkler',
        icon: 'Home',
        items: propertyRows.map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: p.municipality ?? undefined,
          url: '/master-data/properties',
        })),
      });
    }

    // Tenant-scope: tenant context yoksa atla
    if (tenantId) {
      // --- Payables ---
      const payableRows = await db
        .select({
          id: payableItems.id,
          title: payableItems.title,
          invoice_number: payableItems.invoice_number,
          amount: payableItems.amount,
        })
        .from(payableItems)
        .where(
          and(
            eq(payableItems.tenant_id, tenantId),
            eq(payableItems.is_active, true),
            or(ilike(payableItems.title, like), ilike(payableItems.invoice_number, like)),
          ),
        )
        .limit(LIMIT_PER_CATEGORY);
      if (payableRows.length > 0) {
        results.push({
          category: 'payables',
          label: 'Faturalar',
          icon: 'Receipt',
          items: payableRows.map((p) => ({
            id: p.id,
            title: p.title,
            subtitle: `${p.invoice_number ?? '-'} · ${p.amount} TL`,
            url: `/payables/${p.id}`,
          })),
        });
      }

      // --- Subscriptions ---
      const subRows = await db
        .select({
          id: subscriptions.id,
          package_name: subscriptions.package_name,
          subscription_no: subscriptions.subscription_no,
        })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.tenant_id, tenantId),
            eq(subscriptions.is_active, true),
            or(ilike(subscriptions.package_name, like), ilike(subscriptions.subscription_no, like)),
          ),
        )
        .limit(LIMIT_PER_CATEGORY);
      if (subRows.length > 0) {
        results.push({
          category: 'subscriptions',
          label: 'Abonelikler',
          icon: 'Repeat',
          items: subRows.map((s) => ({
            id: s.id,
            title: s.package_name ?? 'Abonelik',
            subtitle: s.subscription_no ?? undefined,
            url: '/subscriptions',
          })),
        });
      }

      // --- Guarantees ---
      const gRows = await db
        .select({
          id: guarantees.id,
          beneficiary_name: guarantees.beneficiary_name,
          letter_no: guarantees.letter_no,
        })
        .from(guarantees)
        .where(
          and(
            eq(guarantees.tenant_id, tenantId),
            eq(guarantees.is_active, true),
            or(ilike(guarantees.beneficiary_name, like), ilike(guarantees.letter_no, like)),
          ),
        )
        .limit(LIMIT_PER_CATEGORY);
      if (gRows.length > 0) {
        results.push({
          category: 'guarantees',
          label: 'Teminat Mektupları',
          icon: 'ShieldCheck',
          items: gRows.map((g) => ({
            id: g.id,
            title: g.beneficiary_name,
            subtitle: g.letter_no ?? undefined,
            url: '/guarantees',
          })),
        });
      }

      // --- Subsidiaries ---
      const subsRows = await db
        .select({ id: subsidiaries.id, name: subsidiaries.name, code: subsidiaries.code })
        .from(subsidiaries)
        .where(
          and(
            eq(subsidiaries.tenant_id, tenantId),
            eq(subsidiaries.is_active, true),
            or(ilike(subsidiaries.name, like), ilike(subsidiaries.code, like)),
          ),
        )
        .limit(LIMIT_PER_CATEGORY);
      if (subsRows.length > 0) {
        results.push({
          category: 'subsidiaries',
          label: 'Yan Şirketler',
          icon: 'Network',
          items: subsRows.map((s) => ({
            id: s.id,
            title: s.name,
            subtitle: s.code ?? undefined,
            url: '/subsidiaries',
          })),
        });
      }
    }

    res.json({ data: { query: q, results } });
  } catch (err) {
    next(err);
  }
});
