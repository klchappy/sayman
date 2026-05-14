-- ============================================================================
-- Migration 0012 — Full-text search GIN expression indexes
--
-- Strateji: ALTER TABLE ile sütun eklemiyoruz (schema kararlı kalsın).
-- Bunun yerine to_tsvector('simple', ...) ifadesi üzerinde GIN index.
-- Sorgu tarafı aynı ifadeyi kullanırsa planner GIN'i kullanır.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint

-- unaccent IMMUTABLE wrapper (index expression için zorunlu)
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_persons_fts"
  ON "persons" USING gin (
    to_tsvector('simple',
      coalesce(f_unaccent(full_name), '') || ' ' ||
      coalesce(national_id, '') || ' ' ||
      coalesce(phone, '')
    )
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_companies_fts"
  ON "companies" USING gin (
    to_tsvector('simple',
      coalesce(f_unaccent(name), '') || ' ' ||
      coalesce(f_unaccent(short_name), '') || ' ' ||
      coalesce(tax_number, '')
    )
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_properties_fts"
  ON "properties" USING gin (
    to_tsvector('simple',
      coalesce(f_unaccent(name), '') || ' ' ||
      coalesce(f_unaccent(municipality), '') || ' ' ||
      coalesce(registry_number, '')
    )
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_payables_fts"
  ON "payable_items" USING gin (
    to_tsvector('simple',
      coalesce(f_unaccent(title), '') || ' ' ||
      coalesce(invoice_number, '') || ' ' ||
      coalesce(f_unaccent(supplier_name), '') || ' ' ||
      coalesce(f_unaccent(notes), '')
    )
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_subscriptions_fts"
  ON "subscriptions" USING gin (
    to_tsvector('simple',
      coalesce(f_unaccent(package_name), '') || ' ' ||
      coalesce(subscription_no, '') || ' ' ||
      coalesce(f_unaccent(notes), '')
    )
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_guarantees_fts"
  ON "guarantees" USING gin (
    to_tsvector('simple',
      coalesce(f_unaccent(beneficiary_name), '') || ' ' ||
      coalesce(letter_no, '') || ' ' ||
      coalesce(f_unaccent(notes), '')
    )
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_subsidiaries_fts"
  ON "subsidiaries" USING gin (
    to_tsvector('simple',
      coalesce(f_unaccent(name), '') || ' ' ||
      coalesce(code, '') || ' ' ||
      coalesce(f_unaccent(description), '')
    )
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_banks_fts"
  ON "banks" USING gin (
    to_tsvector('simple', coalesce(f_unaccent(name), '') || ' ' || coalesce(short_code, ''))
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_institutions_fts"
  ON "institutions" USING gin (
    to_tsvector('simple',
      coalesce(f_unaccent(name), '') || ' ' ||
      coalesce(institution_type, '')
    )
  );
