/**
 * fx_rates — TCMB döviz kuru kayıtları (günlük).
 *
 * TCMB her gün ~15:30 TR yeni kurları yayınlar (kapanış kuru). Cron her gün
 * 16:00'da TCMB XML'i fetch eder, USD/EUR/GBP/CHF/JPY için satır oluşturur.
 *
 * fx_date + currency unique — aynı gün için 1 kayıt.
 * Sayman içinde fatura USD/EUR ise → bu tabloya bakarak TRY equivalent göster.
 */
import { sql } from 'drizzle-orm';
import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const fxRates = pgTable(
  'fx_rates',
  {
    /** "USD", "EUR", "GBP", "CHF", "JPY", "RUB" */
    currency: text('currency').notNull(),
    /** YYYY-MM-DD (TR yerel tarih) */
    fx_date: date('fx_date').notNull(),
    /** Banknote selling rate (TCMB BanknoteSelling) — TRY karşılığı */
    rate_try: numeric('rate_try', { precision: 15, scale: 6 }).notNull(),
    /** Forex buying / selling (alternatif) */
    forex_buying: numeric('forex_buying', { precision: 15, scale: 6 }),
    forex_selling: numeric('forex_selling', { precision: 15, scale: 6 }),
    /** Kaynak: "tcmb" | "manual" */
    source: text('source').notNull().default('tcmb'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: uniqueIndex('uq_fx_rates_date_currency').on(table.fx_date, table.currency),
    currencyIdx: index('idx_fx_rates_currency').on(table.currency, table.fx_date),
  }),
);

export type FxRate = typeof fxRates.$inferSelect;
export type NewFxRate = typeof fxRates.$inferInsert;
