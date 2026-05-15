/**
 * Maaş bordrosu — personel + aylık bordro çalışmaları + satır kalemleri.
 *
 *   employees: personel listesi
 *   payroll_runs: bir ay için bordro çalışması (toplam tutarlar)
 *   payroll_items: bir personelin o aydaki bordro detayı
 *
 * Türkiye SGK + gelir vergisi + AGİ + damga vergisi hesabı.
 * Oranlar payroll-calc.ts'de güncel tutulur.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { subsidiaries } from './subsidiaries';
import { tenants } from './tenants';
import { users } from './users';

export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subsidiary_id: uuid('subsidiary_id').references(() => subsidiaries.id, {
      onDelete: 'set null',
    }),
    full_name: text('full_name').notNull(),
    /** T.C. kimlik no (11 haneli) */
    tc_kimlik_no: text('tc_kimlik_no'),
    /** SGK sicil no */
    sgk_no: text('sgk_no'),
    /** İşe başlama tarihi */
    hire_date: date('hire_date').notNull(),
    /** İşten ayrılma tarihi (varsa) */
    termination_date: date('termination_date'),
    /** Aylık brüt maaş */
    gross_salary: numeric('gross_salary', { precision: 15, scale: 2 }).notNull(),
    /** 'single' | 'married' */
    marital_status: text('marital_status').notNull().default('single'),
    /** AGİ için çocuk sayısı (0-N) */
    kids_count: numeric('kids_count', { precision: 2 }).default('0').notNull(),
    /** Eşin çalışıp çalışmadığı (AGİ etkiler) */
    spouse_working: boolean('spouse_working').default(false).notNull(),
    /** Engellilik derecesi (0|1|2|3) — gelir vergisi indirimi */
    disability_degree: numeric('disability_degree', { precision: 1 }).default('0').notNull(),
    /** 'active' | 'inactive' | 'left' */
    status: text('status').notNull().default('active'),
    department: text('department'),
    position: text('position'),
    iban: text('iban'),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    metadata: jsonb('metadata').default({}).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_employees_tenant').on(table.tenant_id, table.status),
  }),
);

export const payrollRuns = pgTable(
  'payroll_runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** YYYY-MM */
    period: text('period').notNull(),
    /** 'draft' | 'approved' | 'paid' | 'cancelled' */
    status: text('status').notNull().default('draft'),
    /** Toplamlar (cache amaçlı, items'dan re-hesaplanabilir) */
    total_gross: numeric('total_gross', { precision: 18, scale: 2 }).default('0').notNull(),
    total_net: numeric('total_net', { precision: 18, scale: 2 }).default('0').notNull(),
    total_sgk: numeric('total_sgk', { precision: 18, scale: 2 }).default('0').notNull(),
    total_tax: numeric('total_tax', { precision: 18, scale: 2 }).default('0').notNull(),
    total_employer_cost: numeric('total_employer_cost', { precision: 18, scale: 2 })
      .default('0')
      .notNull(),
    employee_count: numeric('employee_count', { precision: 5 }).default('0').notNull(),
    approved_by: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approved_at: timestamp('approved_at', { withTimezone: true }),
    paid_at: timestamp('paid_at', { withTimezone: true }),
    notes: text('notes'),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantPeriodIdx: index('idx_payroll_runs_tenant').on(table.tenant_id, table.period),
    uq: uniqueIndex('uq_payroll_runs_tenant_period').on(table.tenant_id, table.period),
  }),
);

export const payrollItems = pgTable(
  'payroll_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    run_id: uuid('run_id')
      .notNull()
      .references(() => payrollRuns.id, { onDelete: 'cascade' }),
    employee_id: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    /** İşçi tarafı */
    gross: numeric('gross', { precision: 15, scale: 2 }).notNull(),
    sgk_employee: numeric('sgk_employee', { precision: 15, scale: 2 }).default('0').notNull(),
    unemployment_employee: numeric('unemployment_employee', { precision: 15, scale: 2 })
      .default('0')
      .notNull(),
    income_tax: numeric('income_tax', { precision: 15, scale: 2 }).default('0').notNull(),
    stamp_tax: numeric('stamp_tax', { precision: 15, scale: 2 }).default('0').notNull(),
    agi: numeric('agi', { precision: 15, scale: 2 }).default('0').notNull(),
    /** Bonus/prim, kesinti gibi ek manuel kalemler */
    additions: numeric('additions', { precision: 15, scale: 2 }).default('0').notNull(),
    deductions: numeric('deductions', { precision: 15, scale: 2 }).default('0').notNull(),
    /** Net = gross - sgk - işsizlik - gv - damga + agi + additions - deductions */
    net: numeric('net', { precision: 15, scale: 2 }).notNull(),
    /** İşveren tarafı */
    sgk_employer: numeric('sgk_employer', { precision: 15, scale: 2 }).default('0').notNull(),
    unemployment_employer: numeric('unemployment_employer', { precision: 15, scale: 2 })
      .default('0')
      .notNull(),
    /** Toplam maliyet: gross + sgk_employer + işsizlik_işveren */
    total_employer_cost: numeric('total_employer_cost', { precision: 15, scale: 2 })
      .default('0')
      .notNull(),
    breakdown: jsonb('breakdown').default({}).notNull(),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index('idx_payroll_items_run').on(table.run_id),
    employeeIdx: index('idx_payroll_items_employee').on(table.employee_id),
    runEmpUq: uniqueIndex('uq_payroll_items_run_employee').on(table.run_id, table.employee_id),
  }),
);

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type NewPayrollRun = typeof payrollRuns.$inferInsert;
export type PayrollItem = typeof payrollItems.$inferSelect;
export type NewPayrollItem = typeof payrollItems.$inferInsert;
