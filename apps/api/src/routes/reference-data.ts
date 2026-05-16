/**
 * /v1/reference/* — Sistem-geneli referans veri (Türkiye bankaları, kurumlar, devlet).
 *
 * Read-only — tüm authenticated kullanıcılar erişebilir, sadece super_admin
 * değiştirebilir (manuel migration veya ileride admin UI).
 *
 *   GET /v1/reference/banks                 → tüm bankalar
 *   GET /v1/reference/banks?sector=state    → filter (state/commercial/participation/development/foreign)
 *   GET /v1/reference/banks?search=ziraat   → ad arama
 *   GET /v1/reference/institutions          → tüm resmi kurumlar
 *   GET /v1/reference/institutions?category=tax → kategori filter
 *   GET /v1/reference/government-agencies   → tüm bakanlıklar
 */
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import {
  getDb,
  referenceBanks,
  referenceGovernmentAgencies,
  referenceInstitutions,
} from '@sayman/db';
import { requireAuth } from '../middleware/auth';

export const referenceDataRouter = Router();

// ---- BANKS ----

referenceDataRouter.get('/reference/banks', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions = [eq(referenceBanks.is_active, true)];

    if (req.query.sector) {
      conditions.push(eq(referenceBanks.sector, String(req.query.sector)));
    }
    if (req.query.is_participation === '1' || req.query.is_participation === 'true') {
      conditions.push(eq(referenceBanks.is_participation, true));
    }
    if (req.query.is_state === '1' || req.query.is_state === 'true') {
      conditions.push(eq(referenceBanks.is_state_bank, true));
    }
    if (req.query.search) {
      const s = `%${String(req.query.search)}%`;
      conditions.push(
        or(
          ilike(referenceBanks.name, s),
          ilike(referenceBanks.short_name, s),
          ilike(referenceBanks.eft_code, s),
          ilike(referenceBanks.swift_code, s),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(referenceBanks)
      .where(and(...conditions))
      .orderBy(asc(referenceBanks.sort_order), asc(referenceBanks.short_name))
      .limit(500);

    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

referenceDataRouter.get('/reference/banks/:id', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(referenceBanks)
      .where(eq(referenceBanks.id, String(req.params.id ?? '')));
    if (!row) {
      res.status(404).json({ error: 'Banka bulunamadı' });
      return;
    }
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// ---- INSTITUTIONS (resmi kurumlar — SGK, GİB, oda, vs.) ----

referenceDataRouter.get('/reference/institutions', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions = [eq(referenceInstitutions.is_active, true)];

    if (req.query.category) {
      conditions.push(eq(referenceInstitutions.category, String(req.query.category)));
    }
    if (req.query.search) {
      const s = `%${String(req.query.search)}%`;
      conditions.push(
        or(
          ilike(referenceInstitutions.name, s),
          ilike(referenceInstitutions.short_name, s),
          ilike(referenceInstitutions.code, s),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(referenceInstitutions)
      .where(and(...conditions))
      .orderBy(asc(referenceInstitutions.sort_order), asc(referenceInstitutions.short_name))
      .limit(500);

    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// ---- GOVERNMENT AGENCIES (bakanlıklar, başkanlıklar) ----

referenceDataRouter.get('/reference/government-agencies', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions = [eq(referenceGovernmentAgencies.is_active, true)];

    if (req.query.type) {
      conditions.push(eq(referenceGovernmentAgencies.agency_type, String(req.query.type)));
    }
    if (req.query.search) {
      const s = `%${String(req.query.search)}%`;
      conditions.push(
        or(
          ilike(referenceGovernmentAgencies.name, s),
          ilike(referenceGovernmentAgencies.short_name, s),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(referenceGovernmentAgencies)
      .where(and(...conditions))
      .orderBy(
        asc(referenceGovernmentAgencies.sort_order),
        asc(referenceGovernmentAgencies.short_name),
      )
      .limit(500);

    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// Summary: tüm referans veri sayıları (sidebar badge vs.)
referenceDataRouter.get('/reference/summary', requireAuth, async (_req, res, next) => {
  try {
    const db = getDb();
    const [banks, institutions, government] = await Promise.all([
      db.select({ n: sql<string>`COUNT(*)` }).from(referenceBanks).where(eq(referenceBanks.is_active, true)),
      db
        .select({ n: sql<string>`COUNT(*)` })
        .from(referenceInstitutions)
        .where(eq(referenceInstitutions.is_active, true)),
      db
        .select({ n: sql<string>`COUNT(*)` })
        .from(referenceGovernmentAgencies)
        .where(eq(referenceGovernmentAgencies.is_active, true)),
    ]);

    res.json({
      data: {
        banks: Number(banks[0]?.n ?? 0),
        institutions: Number(institutions[0]?.n ?? 0),
        government_agencies: Number(government[0]?.n ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});
