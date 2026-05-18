/**
 * /v1/exports — Liste sayfaları için Excel/CSV dışa aktarım.
 *
 * Generic endpoint: GET /v1/exports/:resource.xlsx
 * Resource'lar:
 *   - payables       : tenant scope, fatura listesi
 *   - sales-invoices : tenant scope, satış faturaları
 *   - companies      : org scope, şirketler
 *   - persons        : org scope, şahıslar
 *   - employees      : tenant scope, personel
 *   - guarantees     : tenant scope, teminat mektupları
 *   - subscriptions  : tenant scope, abonelikler
 *   - regular-payments: tenant scope, düzenli ödemeler
 *
 * Aynı filtreler list endpoint'inden alınır (search, status, vd).
 * Tenant scope endpoint'ler aktif tenant gerektirir.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import * as XLSX from 'xlsx';
import {
  companies,
  employees,
  getDb,
  guarantees,
  payableItems,
  persons,
  regularPaymentProfiles,
  salesInvoices,
  subscriptions,
} from '@sayman/db';
import { HttpError, requireOrg, requireTenant, shareScopeWhereSQL } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const exportsRouter = Router();

function sendXlsx(res: any, wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ===== PAYABLES =====
exportsRouter.get(
  '/exports/payables.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          id: payableItems.id,
          title: payableItems.title,
          invoice_number: payableItems.invoice_number,
          supplier_name: payableItems.supplier_name,
          amount: payableItems.amount,
          paid_amount: payableItems.paid_amount,
          currency: payableItems.currency,
          issue_date: payableItems.issue_date,
          due_date: payableItems.due_date,
          status: payableItems.status,
          category: payableItems.category,
          needs_review: payableItems.needs_review,
        })
        .from(payableItems)
        .where(
          and(
            eq(payableItems.tenant_id, req.activeTenantId!),
            eq(payableItems.is_active, true),
          ),
        )
        .orderBy(desc(payableItems.due_date), desc(payableItems.created_at))
        .limit(5000);

      const formatted = rows.map((r) => ({
        'Başlık': r.title,
        'Fatura No': r.invoice_number ?? '',
        'Tedarikçi': r.supplier_name ?? '',
        'Tutar': Number(r.amount),
        'Ödenen': Number(r.paid_amount),
        'Para': r.currency,
        'Fatura Tarihi': r.issue_date ?? '',
        'Vade': r.due_date ?? '',
        'Durum': r.status,
        'Kategori': r.category ?? '',
        'Onay Bekliyor': r.needs_review ? 'EVET' : '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted), 'Faturalar');
      sendXlsx(res, wb, `faturalar-${dateStamp()}.xlsx`);
    } catch (err) {
      next(err);
    }
  },
);

// ===== SALES INVOICES =====
exportsRouter.get(
  '/exports/sales-invoices.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.tenant_id, req.activeTenantId!),
            eq(salesInvoices.is_active, true),
          ),
        )
        .orderBy(desc(salesInvoices.due_date), desc(salesInvoices.created_at))
        .limit(5000);

      const formatted = rows.map((r) => ({
        'Başlık': r.title,
        'Fatura No': r.invoice_number ?? '',
        'Müşteri': r.customer_name ?? '',
        'Tutar': Number(r.amount),
        'Tahsilat': Number(r.paid_amount),
        'Para': r.currency,
        'Fatura Tarihi': r.issue_date ?? '',
        'Vade': r.due_date ?? '',
        'Durum': r.status,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted), 'Satış Faturaları');
      sendXlsx(res, wb, `satis-faturalari-${dateStamp()}.xlsx`);
    } catch (err) {
      next(err);
    }
  },
);

// ===== COMPANIES (org scope + share_scope) =====
exportsRouter.get(
  '/exports/companies.xlsx',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      let where = and(
        eq(companies.organization_id, req.activeOrgId!),
        eq(companies.is_active, true),
      );
      if (req.saymanContext?.tenantSlug && req.saymanContext?.tenantId) {
        where = and(where, shareScopeWhereSQL(req.saymanContext.tenantSlug)) as typeof where;
      }
      const rows = await db
        .select()
        .from(companies)
        .where(where)
        .orderBy(companies.name)
        .limit(5000);

      const formatted = rows.map((r) => ({
        'Ad': r.name,
        'Kısa Ad': r.short_name ?? '',
        'Vergi No': r.tax_number ?? '',
        'Sicil No': r.registry_number ?? '',
        'Onay Bekliyor': r.needs_review ? 'EVET' : '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted), 'Şirketler');
      sendXlsx(res, wb, `sirketler-${dateStamp()}.xlsx`);
    } catch (err) {
      next(err);
    }
  },
);

// ===== PERSONS =====
exportsRouter.get(
  '/exports/persons.xlsx',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      let where = and(
        eq(persons.organization_id, req.activeOrgId!),
        eq(persons.is_active, true),
      );
      if (req.saymanContext?.tenantSlug && req.saymanContext?.tenantId) {
        where = and(where, shareScopeWhereSQL(req.saymanContext.tenantSlug)) as typeof where;
      }
      const rows = await db.select().from(persons).where(where).orderBy(persons.full_name).limit(5000);

      const formatted = rows.map((r) => ({
        'Ad Soyad': r.full_name,
        'TC Kimlik': r.national_id ?? '',
        'Telefon': r.phone ?? '',
        'Aile Grubu': r.family_group ?? '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted), 'Şahıslar');
      sendXlsx(res, wb, `sahislar-${dateStamp()}.xlsx`);
    } catch (err) {
      next(err);
    }
  },
);

// ===== EMPLOYEES =====
exportsRouter.get(
  '/exports/employees.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(employees)
        .where(
          and(eq(employees.tenant_id, req.activeTenantId!), eq(employees.is_active, true)),
        )
        .orderBy(employees.full_name)
        .limit(5000);

      const formatted = rows.map((r) => ({
        'Ad Soyad': r.full_name,
        'TC Kimlik': r.tc_kimlik_no ?? '',
        'İşe Başlama': r.hire_date,
        'Pozisyon': r.position ?? '',
        'Departman': r.department ?? '',
        'Brüt Maaş': Number(r.gross_salary),
        'Medeni Durum': r.marital_status,
        'Çocuk': Number(r.kids_count),
        'Email': r.email ?? '',
        'Telefon': r.phone ?? '',
        'Durum': r.status,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted), 'Personel');
      sendXlsx(res, wb, `personel-${dateStamp()}.xlsx`);
    } catch (err) {
      next(err);
    }
  },
);

// ===== GUARANTEES =====
exportsRouter.get(
  '/exports/guarantees.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(guarantees)
        .where(
          and(eq(guarantees.tenant_id, req.activeTenantId!), eq(guarantees.is_active, true)),
        )
        .orderBy(desc(guarantees.expiry_date))
        .limit(5000);

      const formatted = rows.map((r) => ({
        'Lehdar': r.beneficiary_name,
        'Mektup No': r.letter_no ?? '',
        'Tutar': Number(r.amount),
        'Para': r.currency,
        'Veriliş': r.issue_date ?? '',
        'Vade': r.expiry_date ?? '',
        'Durum': r.status,
        'Komisyon Oranı': r.commission_rate ?? '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted), 'Teminat Mektupları');
      sendXlsx(res, wb, `teminat-mektuplari-${dateStamp()}.xlsx`);
    } catch (err) {
      next(err);
    }
  },
);

// ===== SUBSCRIPTIONS =====
exportsRouter.get(
  '/exports/subscriptions.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(subscriptions)
        .where(
          and(eq(subscriptions.tenant_id, req.activeTenantId!), eq(subscriptions.is_active, true)),
        )
        .orderBy(desc(subscriptions.commitment_end_date))
        .limit(5000);

      const formatted = rows.map((r) => ({
        'Paket': r.package_name,
        'Aylık Tutar': Number(r.monthly_amount),
        'Para': r.currency,
        'Başlama': r.start_date ?? '',
        'Taahhüt Bitiş': r.commitment_end_date ?? '',
        'Durum': r.status,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted), 'Abonelikler');
      sendXlsx(res, wb, `abonelikler-${dateStamp()}.xlsx`);
    } catch (err) {
      next(err);
    }
  },
);

// ===== REGULAR PAYMENTS =====
exportsRouter.get(
  '/exports/regular-payments.xlsx',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(regularPaymentProfiles)
        .where(
          and(
            eq(regularPaymentProfiles.tenant_id, req.activeTenantId!),
            eq(regularPaymentProfiles.is_active, true),
          ),
        )
        .orderBy(desc(regularPaymentProfiles.created_at))
        .limit(5000);

      const formatted = rows.map((r) => ({
        'Tür': r.kind,
        'Başlık': r.title,
        'Aylık Tutar': Number(r.monthly_amount),
        'Para': r.currency,
        'Ödeme Günü': Number(r.payment_day),
        'Başlama': r.start_date ?? '',
        'Bitiş': r.end_date ?? '',
        'Yıllık Artış %': r.annual_increase_rate ?? '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatted), 'Düzenli Ödemeler');
      sendXlsx(res, wb, `duzenli-odemeler-${dateStamp()}.xlsx`);
    } catch (err) {
      next(err);
    }
  },
);
