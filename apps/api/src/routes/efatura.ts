/**
 * /v1/efatura — Türkiye GİB e-fatura / e-arşiv UBL-TR 1.2 XML import.
 *
 *   POST /v1/efatura/parse        → XML body, dry-run preview döner (insert yok)
 *   POST /v1/efatura/import       → XML body, payable_items'a insert + opsiyonel attachment
 *
 * UBL-TR mapping (xmlns: cbc=CommonBasicComponents, cac=CommonAggregateComponents):
 *   Invoice/cbc:ID                                          → invoice_number
 *   Invoice/cbc:IssueDate                                    → issue_date
 *   Invoice/cbc:DueDate                                      → due_date
 *   Invoice/cbc:DocumentCurrencyCode                         → currency
 *   Invoice/cac:LegalMonetaryTotal/cbc:PayableAmount         → amount
 *   Invoice/cac:AccountingSupplierParty/cac:Party/...PartyName/cbc:Name → supplier_name
 *   Invoice/cac:Note (varsa)                                 → notes
 *   Invoice/cbc:ProfileID                                    → category (TICARIFATURA, EARSIVFATURA)
 *
 * Tek seferde tek invoice'i destekler (UBL-TR standardı: 1 dosya = 1 invoice).
 */
import JSZip from 'jszip';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, payableItems } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { requirePerm } from '../middleware/permission';
import { parseUblXml } from './efatura-helpers';

const bodySchema = z.object({
  /** UBL-TR XML metin */
  xml: z.string().min(50),
  /** dry_run ise insert yok, sadece preview döner */
  dry_run: z.boolean().default(false),
  /** Opsiyonel: hangi subsidiary'e ait */
  subsidiary_id: z.string().uuid().optional().nullable(),
  /** Opsiyonel: company master data'da hangi şirkete bağlanacak */
  company_id: z.string().uuid().optional().nullable(),
});

export const efaturaRouter = Router();

// PARSE — preview only
efaturaRouter.post(
  '/efatura/parse',
  requireAuth,
  requireTenant,
  requirePerm('finance.read'),
  async (req, res, next) => {
    try {
      const body = bodySchema.parse(req.body);
      const parsed = parseUblXml(body.xml);
      res.json({ data: { parsed } });
    } catch (err) {
      next(err);
    }
  },
);

// IMPORT — parse + insert payable_items
efaturaRouter.post(
  '/efatura/import',
  requireAuth,
  requireTenant,
  requirePerm('finance.write'),
  async (req, res, next) => {
    try {
      const body = bodySchema.parse(req.body);
      const parsed = parseUblXml(body.xml);

      if (body.dry_run) {
        res.json({ data: { parsed, dry_run: true } });
        return;
      }

      const db = getDb();
      const [row] = await db
        .insert(payableItems)
        .values({
          tenant_id: req.activeTenantId!,
          title: `e-Fatura: ${parsed.supplier_name ?? parsed.invoice_number}`,
          category: parsed.profile_id === 'EARSIVFATURA' ? 'e-arşiv' : 'e-fatura',
          invoice_number: parsed.invoice_number,
          supplier_name: parsed.supplier_name,
          issue_date: parsed.issue_date,
          due_date: parsed.due_date,
          amount: parsed.amount,
          currency: parsed.currency,
          status: 'pending',
          owner_type: 'company',
          subsidiary_id: body.subsidiary_id ?? null,
          company_id: body.company_id ?? null,
          notes: parsed.notes,
          metadata: {
            source: 'efatura_ubl_import',
            supplier_tax_number: parsed.supplier_tax_number,
            profile_id: parsed.profile_id,
          },
          needs_review: true,
          auto_created_source: 'efatura_ubl',
        })
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'efatura.import',
        target_type: 'payable_items',
        target_id: row?.id,
        details: {
          invoice_number: parsed.invoice_number,
          supplier: parsed.supplier_name,
          amount: parsed.amount,
        },
      });

      res.status(201).json({ data: { parsed, payable: row } });
    } catch (err) {
      next(err);
    }
  },
);

// --- BULK ZIP import (içinde N XML) -----------------------------------------

const zipSchema = z.object({
  /** ZIP içeriği base64 */
  zip_base64: z.string().min(50),
  dry_run: z.boolean().default(false),
  subsidiary_id: z.string().uuid().optional().nullable(),
});

efaturaRouter.post(
  '/efatura/import-zip',
  requireAuth,
  requireTenant,
  requirePerm('finance.write'),
  async (req, res, next) => {
    try {
      const body = zipSchema.parse(req.body);
      const zipBuf = Buffer.from(body.zip_base64, 'base64');

      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(zipBuf);
      } catch (e) {
        throw new HttpError(400, `ZIP açılamadı: ${(e as Error).message}`, 'ZIP_PARSE');
      }

      const xmlFiles: Array<{ name: string; content: string }> = [];
      const tasks: Array<Promise<void>> = [];
      zip.forEach((relPath, entry) => {
        if (!entry.dir && /\.xml$/i.test(relPath)) {
          tasks.push(
            entry.async('string').then((content) => {
              xmlFiles.push({ name: relPath, content });
            }),
          );
        }
      });
      await Promise.all(tasks);

      if (xmlFiles.length === 0) {
        throw new HttpError(400, 'ZIP içinde XML dosyası yok', 'EMPTY_ZIP');
      }
      if (xmlFiles.length > 100) {
        throw new HttpError(400, `Maks 100 XML / ZIP. Gönderilen: ${xmlFiles.length}`, 'TOO_LARGE');
      }

      const results: Array<{
        file: string;
        ok: boolean;
        invoice_number?: string;
        amount?: string;
        supplier?: string | null;
        payable_id?: string;
        error?: string;
      }> = [];

      const db = getDb();
      for (const file of xmlFiles) {
        try {
          const parsed = parseUblXml(file.content);
          if (body.dry_run) {
            results.push({
              file: file.name,
              ok: true,
              invoice_number: parsed.invoice_number,
              amount: parsed.amount,
              supplier: parsed.supplier_name,
            });
          } else {
            const [row] = await db
              .insert(payableItems)
              .values({
                tenant_id: req.activeTenantId!,
                title: `e-Fatura: ${parsed.supplier_name ?? parsed.invoice_number}`,
                category: parsed.profile_id === 'EARSIVFATURA' ? 'e-arşiv' : 'e-fatura',
                invoice_number: parsed.invoice_number,
                supplier_name: parsed.supplier_name,
                issue_date: parsed.issue_date,
                due_date: parsed.due_date,
                amount: parsed.amount,
                currency: parsed.currency,
                status: 'pending',
                owner_type: 'company',
                subsidiary_id: body.subsidiary_id ?? null,
                notes: parsed.notes,
                metadata: {
                  source: 'efatura_zip_import',
                  zip_file: file.name,
                  supplier_tax_number: parsed.supplier_tax_number,
                  profile_id: parsed.profile_id,
                },
                needs_review: true,
                auto_created_source: 'efatura_ubl',
              })
              .returning({ id: payableItems.id });
            results.push({
              file: file.name,
              ok: true,
              invoice_number: parsed.invoice_number,
              amount: parsed.amount,
              supplier: parsed.supplier_name,
              payable_id: row?.id,
            });
          }
        } catch (e) {
          results.push({ file: file.name, ok: false, error: (e as Error).message });
        }
      }

      if (!body.dry_run) {
        await auditFromRequest(req, {
          organization_id: req.activeOrgId!,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'efatura.import_zip',
          details: {
            total: xmlFiles.length,
            success: results.filter((r) => r.ok).length,
            failed: results.filter((r) => !r.ok).length,
          },
        });
      }

      res.json({
        data: {
          total: xmlFiles.length,
          success: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          dry_run: body.dry_run,
          results,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
