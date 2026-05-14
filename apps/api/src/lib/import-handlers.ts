/**
 * Import handlers — CSV/JSON bulk insert için resource-bazlı validators.
 *
 * Her resource için:
 *   schema: zod (row başına)
 *   scope: 'org' | 'tenant' (hangi context gerekli)
 *   insert: row'u DB'ye yaz (org_id/tenant_id otomatik enjekte)
 *
 * Genel akış: import endpoint zod validate eder, geçersiz satırları errors listesinde döndürür,
 * dry_run=false ise transaction ile insert eder.
 */
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { suggestCategory } from '@sayman/shared';
import {
  banks,
  companies,
  guarantees,
  getDb,
  institutions,
  payableItems,
  persons,
  properties,
  regularPaymentProfiles,
  subscriptions,
} from '@sayman/db';

const shareScopeSchema = z.union([z.literal('*'), z.array(z.string().min(1)).min(1)]).default('*');

// --- persons ----------------------------------------------------------------

const personsRowSchema = z.object({
  full_name: z.string().min(2).max(200),
  national_id: z.string().max(11).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  family_group: z.string().max(64).optional().nullable(),
  share_scope: shareScopeSchema,
});

// --- companies --------------------------------------------------------------

const companiesRowSchema = z.object({
  name: z.string().min(2).max(200),
  short_name: z.string().max(64).optional().nullable(),
  tax_number: z.string().max(32).optional().nullable(),
  registry_number: z.string().max(64).optional().nullable(),
  share_scope: shareScopeSchema,
});

// --- properties --------------------------------------------------------------

const propertiesRowSchema = z.object({
  name: z.string().min(2).max(200),
  property_type: z.string().max(64).optional().nullable(),
  municipality: z.string().max(128).optional().nullable(),
  registry_number: z.string().max(64).optional().nullable(),
  site_unit_code: z.string().max(32).optional().nullable(),
  share_scope: shareScopeSchema,
});

// --- payables (tenant-scope) ------------------------------------------------

const payablesRowSchema = z.object({
  title: z.string().min(2).max(255),
  category: z.string().max(64).optional().nullable(),
  invoice_number: z.string().max(64).optional().nullable(),
  period_label: z.string().max(16).optional().nullable(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  currency: z.string().length(3).default('TRY'),
  due_date: z.string().date().optional().nullable(),
  owner_type: z.enum(['company', 'person', 'family', 'other']).default('company'),
  subsidiary_id: z.string().uuid().optional().nullable(),
  supplier_name: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// --- subscriptions (tenant-scope) -------------------------------------------

const subscriptionsRowSchema = z.object({
  package_name: z.string().min(2).max(255),
  subscription_no: z.string().max(64).optional().nullable(),
  owner_type: z.enum(['company', 'person', 'family', 'other']).default('company'),
  subsidiary_id: z.string().uuid().optional().nullable(),
  monthly_amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional().nullable(),
  start_date: z.string().date().optional().nullable(),
  commitment_end_date: z.string().date().optional().nullable(),
  auto_payment: z
    .preprocess((v) => (typeof v === 'string' ? v.toLowerCase() === 'true' || v === '1' : v), z.boolean())
    .default(false),
  notes: z.string().optional().nullable(),
});

// --- regular_payments (tenant-scope) ----------------------------------------

const regularPaymentsRowSchema = z.object({
  kind: z.enum(['rent', 'maintenance', 'subscription', 'lease', 'other']).default('rent'),
  title: z.string().min(2).max(255),
  monthly_amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  payment_day: z.coerce.number().int().min(1).max(31).default(1),
  start_date: z.string().date().optional().nullable(),
  end_date: z.string().date().optional().nullable(),
  annual_increase_rate: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// --- guarantees (tenant-scope) ----------------------------------------------

const guaranteesRowSchema = z.object({
  beneficiary_name: z.string().min(2).max(255),
  /** Banka adı (master'da varsa otomatik bank_id eşleşir) */
  bank_name: z.string().max(255).optional().nullable(),
  letter_no: z.string().max(64).optional().nullable(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  currency: z.string().length(3).default('TRY'),
  issue_date: z.string().date().optional().nullable(),
  expiry_date: z.string().date().optional().nullable(),
  commission_rate: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional().nullable(),
  commission_frequency_months: z.coerce.number().int().min(1).max(12).default(3),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Auto-match: bir isim alanı veriliyorsa (supplier_name, company_name, vb.)
 * org içindeki companies/persons/institutions/banks'tan case-insensitive
 * ad eşleşmesi ile id bulup row'a otomatik ekler.
 *
 * Eşleşme bulunamazsa "match_missing" listesine eklenir, row yine de insert edilir
 * (sadece raw text alanlar dolu kalır).
 */
async function matchCompanyByName(
  orgId: string,
  name: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.organization_id, orgId),
        eq(companies.is_active, true),
        or(ilike(companies.name, name), ilike(companies.short_name, name)),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

async function matchPersonByName(orgId: string, name: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(
      and(
        eq(persons.organization_id, orgId),
        eq(persons.is_active, true),
        ilike(persons.full_name, name),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

async function matchInstitutionByName(orgId: string, name: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(
      and(
        eq(institutions.organization_id, orgId),
        eq(institutions.is_active, true),
        ilike(institutions.name, name),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

async function matchBankByName(orgId: string, name: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: banks.id })
    .from(banks)
    .where(
      and(
        eq(banks.organization_id, orgId),
        eq(banks.is_active, true),
        or(ilike(banks.name, name), ilike(banks.short_code, name)),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export type ImportScope = 'org' | 'tenant';

export interface ImportConfig {
  scope: ImportScope;
  schema: z.ZodType;
  description: string;
  /** dry_run=false → bu fonksiyon insert eder */
  insert: (rows: any[], ctx: { orgId: string; tenantId?: string }) => Promise<string[]>;
}

export const IMPORT_HANDLERS: Record<string, ImportConfig> = {
  persons: {
    scope: 'org',
    schema: personsRowSchema,
    description: 'Şahıs master data (org-scope, share_scope ile tenant filtrelenir)',
    insert: async (rows, { orgId }) => {
      const db = getDb();
      const inserted = await db
        .insert(persons)
        .values(rows.map((r) => ({ organization_id: orgId, ...r })))
        .returning({ id: persons.id });
      return inserted.map((x) => x.id);
    },
  },
  companies: {
    scope: 'org',
    schema: companiesRowSchema,
    description: 'Şirket master data (org-scope)',
    insert: async (rows, { orgId }) => {
      const db = getDb();
      const inserted = await db
        .insert(companies)
        .values(rows.map((r) => ({ organization_id: orgId, ...r })))
        .returning({ id: companies.id });
      return inserted.map((x) => x.id);
    },
  },
  properties: {
    scope: 'org',
    schema: propertiesRowSchema,
    description: 'Mülk master data (org-scope)',
    insert: async (rows, { orgId }) => {
      const db = getDb();
      const inserted = await db
        .insert(properties)
        .values(rows.map((r) => ({ organization_id: orgId, ...r })))
        .returning({ id: properties.id });
      return inserted.map((x) => x.id);
    },
  },
  payables: {
    scope: 'tenant',
    schema: payablesRowSchema,
    description: 'Fatura/borç kayıtları (tenant-scope) — supplier_name otomatik şirketle eşleşir',
    insert: async (rows, { orgId, tenantId }) => {
      const db = getDb();
      if (!tenantId) throw new Error('tenant context required');
      // Auto-match: supplier_name → company_id + auto-categorize
      const matched = await Promise.all(
        rows.map(async (r) => {
          let company_id = r.company_id ?? null;
          if (!company_id && r.supplier_name) {
            company_id = await matchCompanyByName(orgId, r.supplier_name);
          }
          // Auto-categorize
          let category = r.category ?? null;
          if (!category) {
            const sug = suggestCategory(r.title, r.supplier_name, r.notes);
            if (sug && sug.confidence >= 0.3) category = sug.category;
          }
          return { ...r, company_id, category };
        }),
      );
      const inserted = await db
        .insert(payableItems)
        .values(matched.map((r) => ({ tenant_id: tenantId, ...r })))
        .returning({ id: payableItems.id });
      return inserted.map((x) => x.id);
    },
  },
  subscriptions: {
    scope: 'tenant',
    schema: subscriptionsRowSchema,
    description: 'Abonelik & taahhüt (tenant-scope) — institution/company otomatik eşleşir',
    insert: async (rows, { orgId, tenantId }) => {
      const db = getDb();
      if (!tenantId) throw new Error('tenant context required');
      // Auto-match: package_name içerebileceği institution adı (TT, CK, vb.)
      const matched = await Promise.all(
        rows.map(async (r) => {
          let institution_id: string | null = null;
          if (r.package_name) {
            institution_id = await matchInstitutionByName(orgId, r.package_name);
            if (!institution_id) {
              // Paket içinde ilk kelime de denenebilir (örn. "Türk Telekom Fiber" → "Türk Telekom")
              const firstWord = r.package_name.split(' ').slice(0, 2).join(' ');
              if (firstWord !== r.package_name) {
                institution_id = await matchInstitutionByName(orgId, firstWord);
              }
            }
          }
          return { ...r, institution_id };
        }),
      );
      const inserted = await db
        .insert(subscriptions)
        .values(matched.map((r) => ({ tenant_id: tenantId, ...r })))
        .returning({ id: subscriptions.id });
      return inserted.map((x) => x.id);
    },
  },
  'regular-payments': {
    scope: 'tenant',
    schema: regularPaymentsRowSchema,
    description: 'Kira/leasing/bakım sözleşmeleri (tenant-scope)',
    insert: async (rows, { tenantId }) => {
      const db = getDb();
      if (!tenantId) throw new Error('tenant context required');
      const inserted = await db
        .insert(regularPaymentProfiles)
        .values(rows.map((r) => ({ tenant_id: tenantId, ...r })))
        .returning({ id: regularPaymentProfiles.id });
      return inserted.map((x) => x.id);
    },
  },
  guarantees: {
    scope: 'tenant',
    schema: guaranteesRowSchema,
    description: 'Teminat mektupları (tenant-scope) — beneficiary/bank otomatik eşleşir',
    insert: async (rows, { orgId, tenantId }) => {
      const db = getDb();
      if (!tenantId) throw new Error('tenant context required');
      const matched = await Promise.all(
        rows.map(async (r) => {
          // beneficiary_name → issuer_company_id (kendi şirket olduğu varsayım) veya bırak
          // bank_name → bank_id
          let bank_id: string | null = null;
          if (r.bank_name) {
            bank_id = await matchBankByName(orgId, r.bank_name);
          }
          const { bank_name: _bn, ...rest } = r;
          return { ...rest, bank_id };
        }),
      );
      const inserted = await db
        .insert(guarantees)
        .values(matched.map((r) => ({ tenant_id: tenantId, ...r })))
        .returning({ id: guarantees.id });
      return inserted.map((x) => x.id);
    },
  },
};

export const IMPORT_RESOURCES = Object.keys(IMPORT_HANDLERS);
