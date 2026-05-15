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
 */
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { companies, getDb } from '@sayman/db';

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
): Promise<ResolvedParty> {
  const db = getDb();
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
  const [byName] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.organization_id, organizationId),
        ilike(companies.name, name),
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
