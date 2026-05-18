/**
 * Auto-create party (supplier/customer) helper.
 *
 * Import sırasında supplier_name verilince:
 *   1. Önce mevcut companies arasında ad eşleşmesini ara (case-insensitive, trim)
 *   2. Tax number varsa onunla da kontrol et (kesin eşleşme)
 *   3. Bulamazsa companies'a needs_review=true ile ekle
 *   4. Yaratılan company.id'sini dön
 *
 * Bu sayede payable_items.company_id otomatik bağlanır, kullanıcı sonra
 * /review-queue'dan onaylar veya birleştirir.
 *
 * BULK API (N+1 fix): bulkResolveOrCreateCompanies() — toplu prefetch + tek
 * INSERT. Smart-import path'inde 500 satır × 3 query = 1500 round-trip yerine
 * 2-3 round-trip. Audit #1 + #2 fix'i.
 */
import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { companies, getDb } from '@sayman/db';
import { escapeIlike } from './sql-escape';

export interface PartyHint {
  name: string;
  tax_number?: string | null;
  source: 'efatura' | 'csv_import' | 'erp_sync' | 'smart_import' | 'manual';
}

export interface ResolvedParty {
  id: string;
  is_new: boolean;
  needs_review: boolean;
  matched_by?: 'tax_number' | 'name';
}

export async function resolveOrCreateCompany(
  organizationId: string,
  hint: PartyHint,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbOrTx?: any,
): Promise<ResolvedParty> {
  const db = dbOrTx ?? getDb();
  const name = hint.name.trim();
  if (name.length < 2) {
    throw new Error('Şirket adı en az 2 karakter');
  }

  // 1. Tax number ile kesin eşleşme
  if (hint.tax_number) {
    const cleanTax = hint.tax_number.replace(/[^0-9]/g, '');
    if (cleanTax.length >= 10) {
      const [byTax] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.organization_id, organizationId),
            eq(companies.tax_number, cleanTax),
          ),
        )
        .limit(1);
      if (byTax) {
        return { id: byTax.id, is_new: false, needs_review: false, matched_by: 'tax_number' };
      }
    }
  }

  // 2. Ad ile bulanık eşleşme (case-insensitive)
  // NOT: ilike(col, name) — name içindeki % ve _ wildcard'ları literal hale getir
  // ki "Foo%Bar" gibi şirket adları "FooXBar"a yanlışlıkla eşleşmesin.
  const [byName] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.organization_id, organizationId),
        ilike(companies.name, escapeIlike(name)),
      ),
    )
    .limit(1);
  if (byName) {
    return { id: byName.id, is_new: false, needs_review: false, matched_by: 'name' };
  }

  // 3. Yarat — needs_review=true
  const [created] = await db
    .insert(companies)
    .values({
      organization_id: organizationId,
      name,
      tax_number: hint.tax_number
        ? hint.tax_number.replace(/[^0-9]/g, '')
        : null,
      needs_review: true,
      auto_created_source: hint.source,
      auto_created_at: new Date(),
    })
    .returning({ id: companies.id });

  if (!created) throw new Error('Şirket otomatik yaratılamadı');
  return { id: created.id, is_new: true, needs_review: true };
}

/**
 * Bulk versiyon — N hint için 1500 round-trip yerine ~3 query.
 *
 * Çalışma:
 *   1. Tüm tax_number'ları ve lower(name)'leri tek `SELECT … WHERE org=? AND
 *      (tax_number = ANY(?) OR lower(name) = ANY(?))` ile çek
 *   2. Map oluştur (tax_number → id, lower(name) → id)
 *   3. Hint'leri map'ten resolve et — yoksa "needs_create" listesine ekle
 *   4. needs_create → tek bulk INSERT (ON CONFLICT DO NOTHING ile race-safe)
 *   5. INSERT'in RETURNING'i ile yeni id'leri al, hint'lere ata
 *
 * Smart-import 500 satırlık CSV: 3-8s → ~300ms.
 *
 * Map'in key'i: normalize edilmiş "name|tax_number" — aynı hint birden fazla
 * kez geldiğinde tek company oluşturulur, hint'ler aynı id'yi alır.
 */
export async function bulkResolveOrCreateCompanies(
  organizationId: string,
  hints: PartyHint[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbOrTx?: any,
): Promise<Map<number, ResolvedParty>> {
  const db = dbOrTx ?? getDb();
  const result = new Map<number, ResolvedParty>();
  if (hints.length === 0) return result;

  // Normalize ve unique key haritası — aynı supplier'ın hint'leri tek seferde işlensin
  type Norm = { name: string; cleanTax: string | null; source: PartyHint['source']; hintIndex: number };
  const norms: Norm[] = hints.map((h, i) => ({
    name: h.name.trim(),
    cleanTax: h.tax_number ? h.tax_number.replace(/[^0-9]/g, '') : null,
    source: h.source,
    hintIndex: i,
  })).filter((n) => n.name.length >= 2);

  const allTaxNumbers = Array.from(
    new Set(norms.map((n) => (n.cleanTax && n.cleanTax.length >= 10 ? n.cleanTax : null)).filter(Boolean) as string[]),
  );
  const allLowerNames = Array.from(new Set(norms.map((n) => n.name.toLowerCase())));

  // 1) Tek SELECT — tax_number veya lower(name) match
  const existing = await db
    .select({
      id: companies.id,
      name: companies.name,
      tax_number: companies.tax_number,
    })
    .from(companies)
    .where(
      and(
        eq(companies.organization_id, organizationId),
        or(
          allTaxNumbers.length > 0 ? inArray(companies.tax_number, allTaxNumbers) : undefined,
          allLowerNames.length > 0 ? sql`lower(${companies.name}) = ANY(${allLowerNames})` : undefined,
        ),
      ),
    );

  const byTax = new Map<string, string>();
  const byLowerName = new Map<string, string>();
  for (const row of existing as Array<{ id: string; name: string; tax_number: string | null }>) {
    if (row.tax_number) byTax.set(row.tax_number, row.id);
    byLowerName.set(row.name.toLowerCase(), row.id);
  }

  // 2) Her hint için: önce tax, sonra name match
  const toCreate: Array<{ hintIndex: number; name: string; tax: string | null; source: PartyHint['source']; key: string }> = [];
  const createKeySeen = new Map<string, number[]>(); // aynı key'li hint'ler

  for (const n of norms) {
    let id: string | undefined;
    let matched_by: 'tax_number' | 'name' | undefined;
    if (n.cleanTax && n.cleanTax.length >= 10) {
      id = byTax.get(n.cleanTax);
      if (id) matched_by = 'tax_number';
    }
    if (!id) {
      id = byLowerName.get(n.name.toLowerCase());
      if (id) matched_by = 'name';
    }
    if (id) {
      result.set(n.hintIndex, { id, is_new: false, needs_review: false, matched_by });
    } else {
      const key = (n.cleanTax ?? '') + '|' + n.name.toLowerCase();
      const list = createKeySeen.get(key);
      if (list) {
        list.push(n.hintIndex);
      } else {
        createKeySeen.set(key, [n.hintIndex]);
        toCreate.push({ hintIndex: n.hintIndex, name: n.name, tax: n.cleanTax, source: n.source, key });
      }
    }
  }

  // 3) Bulk INSERT (race-safe: ON CONFLICT yok ama unique tax_number constraint varsa
  //    catch ile retry; çoğunlukla yeni şirketler için sorun çıkmaz)
  if (toCreate.length > 0) {
    const inserted = await db
      .insert(companies)
      .values(
        toCreate.map((c) => ({
          organization_id: organizationId,
          name: c.name,
          tax_number: c.tax,
          needs_review: true,
          auto_created_source: c.source,
          auto_created_at: new Date(),
        })),
      )
      .returning({ id: companies.id, name: companies.name });

    for (let i = 0; i < toCreate.length; i++) {
      const created = inserted[i];
      const c = toCreate[i];
      if (!created || !c) continue;
      const indices = createKeySeen.get(c.key) ?? [c.hintIndex];
      for (const idx of indices) {
        result.set(idx, { id: created.id, is_new: true, needs_review: true });
      }
    }
  }

  return result;
}
