/**
 * /v1/smart-import — Akıllı dosya yönlendirici (preview + commit).
 *
 *   POST /v1/smart-import          → preview (dry-run)
 *   POST /v1/smart-import?commit=true → preview + gerçek import + auto-create supplier
 *
 * Tek bir dosya yüklenir (CSV/XLSX/XML/ZIP/PDF/Image). İki adım:
 *   1. Preview: tip tespit + ilk N satır + valid/invalid sayısı
 *   2. Commit: gerçek import (XML → payable, CSV → bulk, ZIP → XML toplu)
 *
 * Otomatik supplier yaratımı: import sırasında supplier_name varsa companies'a
 * needs_review=true ile eklenir; payable.company_id otomatik bağlanır.
 */
import { parse as parseCsv } from 'csv-parse/sync';
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import JSZip from 'jszip';
import multer from 'multer';
import * as XLSX from 'xlsx';
import {
  getDb,
  payableItems,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { resolveOrCreateCompany } from '../lib/auto-create-party';
import { logger } from '../config/logger';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { IMPORT_HANDLERS, type ImportConfig } from '../lib/import-handlers';
import { parseUblXml } from './efatura-helpers';

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

const HEADER_HINTS: Array<{ resource: string; required: string[]; score: number }> = [
  { resource: 'payables', required: ['title', 'amount'], score: 100 },
  { resource: 'guarantees', required: ['beneficiary_name', 'amount'], score: 100 },
  { resource: 'subscriptions', required: ['package_name'], score: 80 },
  { resource: 'companies', required: ['name', 'tax_number'], score: 80 },
  { resource: 'persons', required: ['full_name'], score: 70 },
  { resource: 'properties', required: ['name', 'property_type'], score: 70 },
  { resource: 'regular-payments', required: ['kind', 'monthly_amount'], score: 90 },
];

function detectResource(headers: string[]): string | null {
  const headerSet = new Set(headers.map((h) => h.toLowerCase()));
  let best: { resource: string; score: number } | null = null;
  for (const hint of HEADER_HINTS) {
    if (hint.required.every((h) => headerSet.has(h))) {
      if (!best || hint.score > best.score) {
        best = { resource: hint.resource, score: hint.score };
      }
    }
  }
  return best?.resource ?? null;
}

export const smartImportRouter = Router();

smartImportRouter.post(
  '/smart-import',
  requireAuth,
  requireTenant,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, 'Dosya gerekli (field: file)', 'NO_FILE');
      const f = req.file;
      const name = f.originalname.toLowerCase();
      const commit = req.query.commit === 'true' || req.body?.commit === 'true';
      const tenantId = req.activeTenantId!;
      const orgId = req.activeOrgId!;

      // ===== XML — UBL e-Fatura =====
      if (name.endsWith('.xml')) {
        const xml = f.buffer.toString('utf-8');
        let parsed;
        try {
          parsed = parseUblXml(xml);
        } catch (err) {
          throw new HttpError(400, `XML parse hatası: ${(err as Error).message}`, 'XML_PARSE');
        }

        if (!commit) {
          res.json({
            data: {
              type: 'efatura_xml',
              action: 'preview',
              parsed,
              filename: f.originalname,
              hint: 'Önizleme. "İçeriye Aktar" butonu ile gerçek import başlatılır.',
            },
          });
          return;
        }

        // Commit mode — auto-create supplier + payable yarat
        if (!parsed.invoice_number) {
          throw new HttpError(400, 'Fatura numarası bulunamadı', 'INVALID_INVOICE');
        }

        // Aynı invoice_number var mı (idempotent)
        const db = getDb();
        const [existing] = await db
          .select({ id: payableItems.id, title: payableItems.title })
          .from(payableItems)
          .where(
            and(
              eq(payableItems.tenant_id, tenantId),
              eq(payableItems.invoice_number, parsed.invoice_number),
            ),
          )
          .limit(1);

        let supplierResolution = null;
        if (parsed.supplier_name) {
          try {
            supplierResolution = await resolveOrCreateCompany(orgId, {
              name: parsed.supplier_name,
              tax_number: parsed.supplier_tax_number,
              source: 'efatura',
            });
          } catch (err) {
            logger.warn({ err }, 'auto-create supplier failed');
          }
        }

        if (existing) {
          res.json({
            data: {
              type: 'efatura_xml',
              action: 'skipped_duplicate',
              filename: f.originalname,
              parsed,
              payable_id: existing.id,
              supplier_resolution: supplierResolution,
              message: `"${parsed.invoice_number}" zaten kayıtlı (${existing.title}). Yeniden eklenmedi.`,
            },
          });
          return;
        }

        const [created] = await db
          .insert(payableItems)
          .values({
            tenant_id: tenantId,
            owner_type: 'company',
            company_id: supplierResolution?.id ?? null,
            title: `e-Fatura: ${parsed.supplier_name ?? parsed.invoice_number}`,
            category: 'e-fatura',
            invoice_number: parsed.invoice_number,
            supplier_name: parsed.supplier_name,
            issue_date: parsed.issue_date,
            due_date: parsed.due_date,
            amount: parsed.amount,
            currency: parsed.currency,
            status: 'pending',
            notes: parsed.notes,
            metadata: {
              source: 'smart_import',
              filename: f.originalname,
              supplier_tax_number: parsed.supplier_tax_number,
            },
            created_by: req.authUser?.id ?? null,
          })
          .returning({ id: payableItems.id, title: payableItems.title });

        await auditFromRequest(req, {
          organization_id: orgId,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'smart_import.efatura',
          target_type: 'payable_items',
          target_id: created?.id,
          details: { filename: f.originalname, invoice_number: parsed.invoice_number },
        });

        res.json({
          data: {
            type: 'efatura_xml',
            action: 'imported',
            filename: f.originalname,
            parsed,
            payable: created,
            supplier_resolution: supplierResolution,
            message: supplierResolution?.is_new
              ? `Fatura içeriye aktarıldı. Yeni tedarikçi "${parsed.supplier_name}" otomatik oluşturuldu (doğrulama bekliyor).`
              : `Fatura içeriye aktarıldı${supplierResolution?.matched_by ? ` (mevcut tedarikçiye bağlandı)` : ''}.`,
          },
        });
        return;
      }

      // ===== ZIP =====
      if (name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(f.buffer);
        const xmlFiles: Array<{ name: string; content: string }> = [];
        const otherFiles: Array<{ name: string; ext: string }> = [];

        const promises: Promise<void>[] = [];
        zip.forEach((relPath, entry) => {
          if (entry.dir) return;
          const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
          if (ext === 'xml') {
            promises.push(
              entry.async('text').then((content) => {
                xmlFiles.push({ name: relPath, content });
              }),
            );
          } else {
            otherFiles.push({ name: relPath, ext });
          }
        });
        await Promise.all(promises);

        if (!commit) {
          res.json({
            data: {
              type: 'zip',
              action: 'preview',
              filename: f.originalname,
              xml_count: xmlFiles.length,
              other_count: otherFiles.length,
              xml_files: xmlFiles.slice(0, 50).map((x) => ({ name: x.name })),
              other_files: otherFiles.slice(0, 50),
              hint: `${xmlFiles.length} adet e-Fatura XML bulundu. "İçeriye Aktar" ile hepsi yüklenecek.`,
            },
          });
          return;
        }

        // Commit — her XML için import + auto-create
        const db = getDb();
        const results: Array<{
          file: string;
          ok: boolean;
          invoice_number?: string;
          payable_id?: string;
          supplier_new?: boolean;
          error?: string;
        }> = [];

        for (const xf of xmlFiles.slice(0, 100)) {
          try {
            const parsed = parseUblXml(xf.content);
            if (!parsed.invoice_number) {
              results.push({ file: xf.name, ok: false, error: 'invoice_number bulunamadı' });
              continue;
            }

            const [existing] = await db
              .select({ id: payableItems.id })
              .from(payableItems)
              .where(
                and(
                  eq(payableItems.tenant_id, tenantId),
                  eq(payableItems.invoice_number, parsed.invoice_number),
                ),
              )
              .limit(1);
            if (existing) {
              results.push({
                file: xf.name,
                ok: true,
                invoice_number: parsed.invoice_number,
                error: 'duplicate (skipped)',
              });
              continue;
            }

            let supplier = null;
            if (parsed.supplier_name) {
              try {
                supplier = await resolveOrCreateCompany(orgId, {
                  name: parsed.supplier_name,
                  tax_number: parsed.supplier_tax_number,
                  source: 'efatura',
                });
              } catch {}
            }

            const [created] = await db
              .insert(payableItems)
              .values({
                tenant_id: tenantId,
                owner_type: 'company',
                company_id: supplier?.id ?? null,
                title: `e-Fatura: ${parsed.supplier_name ?? parsed.invoice_number}`,
                category: 'e-fatura',
                invoice_number: parsed.invoice_number,
                supplier_name: parsed.supplier_name,
                issue_date: parsed.issue_date,
                due_date: parsed.due_date,
                amount: parsed.amount,
                currency: parsed.currency,
                status: 'pending',
                notes: parsed.notes,
                metadata: {
                  source: 'smart_import_zip',
                  zip_filename: f.originalname,
                  xml_filename: xf.name,
                },
                created_by: req.authUser?.id ?? null,
              })
              .returning({ id: payableItems.id });

            results.push({
              file: xf.name,
              ok: true,
              invoice_number: parsed.invoice_number,
              payable_id: created?.id,
              supplier_new: supplier?.is_new ?? false,
            });
          } catch (err) {
            results.push({ file: xf.name, ok: false, error: (err as Error).message.slice(0, 150) });
          }
        }

        const success = results.filter((r) => r.ok && !r.error).length;
        const duplicates = results.filter((r) => r.ok && r.error === 'duplicate (skipped)').length;
        const failed = results.filter((r) => !r.ok).length;
        const newSuppliers = results.filter((r) => r.supplier_new).length;

        await auditFromRequest(req, {
          organization_id: orgId,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'smart_import.zip',
          details: {
            filename: f.originalname,
            total: xmlFiles.length,
            success,
            duplicates,
            failed,
            new_suppliers: newSuppliers,
          },
        });

        res.json({
          data: {
            type: 'zip',
            action: 'imported',
            filename: f.originalname,
            xml_count: xmlFiles.length,
            success,
            duplicates,
            failed,
            new_suppliers: newSuppliers,
            results: results.slice(0, 200),
            message: `${success} fatura içeriye aktarıldı, ${duplicates} mükerrer atlandı, ${failed} hata${newSuppliers > 0 ? `, ${newSuppliers} yeni tedarikçi oluşturuldu` : ''}.`,
          },
        });
        return;
      }

      // ===== CSV / XLSX =====
      if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
        let rows: Record<string, unknown>[] = [];
        let headers: string[] = [];

        if (name.endsWith('.csv')) {
          const txt = f.buffer.toString('utf-8');
          try {
            rows = parseCsv(txt, {
              columns: true,
              skip_empty_lines: true,
              trim: true,
              relax_quotes: true,
            }) as Record<string, unknown>[];
            const firstLine = txt.split(/\r?\n/)[0] ?? '';
            headers = firstLine.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
          } catch (e) {
            throw new HttpError(400, `CSV parse: ${(e as Error).message}`, 'CSV_PARSE');
          }
        } else {
          try {
            const wb = XLSX.read(f.buffer, { type: 'buffer' });
            const sheetName = wb.SheetNames[0]!;
            const ws = wb.Sheets[sheetName]!;
            rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
              defval: null,
              raw: false,
            });
            if (rows.length > 0) {
              headers = Object.keys(rows[0] as Record<string, unknown>);
            }
          } catch (e) {
            throw new HttpError(400, `XLSX parse: ${(e as Error).message}`, 'XLSX_PARSE');
          }
        }

        const detected = detectResource(headers);

        if (!detected) {
          res.json({
            data: {
              type: 'tabular',
              action: 'preview',
              filename: f.originalname,
              format: name.endsWith('.csv') ? 'csv' : 'xlsx',
              row_count: rows.length,
              headers,
              detected_resource: null,
              preview_rows: rows.slice(0, 5),
              hint: 'Tip otomatik tespit edilemedi. "CSV / XLSX Toplu" sekmesinden resource elle seç.',
            },
          });
          return;
        }

        const handler = IMPORT_HANDLERS[detected] as ImportConfig;
        const validatedRows: any[] = [];
        const errors: Array<{ row: number; error: string; data?: unknown }> = [];
        for (let i = 0; i < rows.length; i++) {
          const result = handler.schema.safeParse(rows[i]);
          if (result.success) {
            validatedRows.push(result.data);
          } else {
            errors.push({
              row: i + 1,
              error: result.error.issues
                .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
                .join(', '),
              data: rows[i],
            });
          }
        }

        if (!commit) {
          res.json({
            data: {
              type: 'tabular',
              action: 'preview',
              filename: f.originalname,
              format: name.endsWith('.csv') ? 'csv' : 'xlsx',
              row_count: rows.length,
              headers,
              detected_resource: detected,
              valid_count: validatedRows.length,
              invalid_count: errors.length,
              preview_rows: validatedRows.slice(0, 5),
              errors: errors.slice(0, 20),
              hint: `${detected} olarak tespit edildi. ${validatedRows.length} satır geçerli. "İçeriye Aktar" tıkla.`,
            },
          });
          return;
        }

        // Commit — bulk insert with auto-create supplier for payables
        if (validatedRows.length === 0) {
          throw new HttpError(400, 'Geçerli satır yok, import yapılamaz', 'NO_VALID');
        }

        // Sadece payables resource için auto-create supplier
        let newSuppliers = 0;
        if (detected === 'payables') {
          for (const row of validatedRows) {
            const r = row as Record<string, unknown>;
            const supplierName = r.supplier_name as string | null;
            if (supplierName && typeof supplierName === 'string') {
              try {
                const sup = await resolveOrCreateCompany(orgId, {
                  name: supplierName,
                  tax_number: null,
                  source: 'csv_import',
                });
                if (sup.is_new) newSuppliers++;
                (row as any).company_id = sup.id;
              } catch (err) {
                logger.warn({ err }, 'csv import auto-supplier failed');
              }
            }
          }
        }

        // Insert
        const insertedIds = await handler.insert(validatedRows, {
          orgId,
          tenantId: handler.scope === 'tenant' ? tenantId : undefined,
        });

        await auditFromRequest(req, {
          organization_id: orgId,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'smart_import.tabular',
          details: {
            filename: f.originalname,
            resource: detected,
            inserted: insertedIds.length,
            new_suppliers: newSuppliers,
          },
        });

        res.json({
          data: {
            type: 'tabular',
            action: 'imported',
            filename: f.originalname,
            resource: detected,
            row_count: rows.length,
            valid_count: validatedRows.length,
            invalid_count: errors.length,
            inserted: insertedIds.length,
            inserted_ids: insertedIds,
            new_suppliers: newSuppliers,
            errors: errors.slice(0, 20),
            message: `${insertedIds.length} kayıt eklendi${errors.length > 0 ? `, ${errors.length} hatalı satır atlandı` : ''}${newSuppliers > 0 ? `, ${newSuppliers} yeni tedarikçi (doğrulama bekliyor)` : ''}.`,
          },
        });
        return;
      }

      // ===== PDF / Image =====
      if (
        name.endsWith('.pdf') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp')
      ) {
        res.json({
          data: {
            type: 'document',
            action: 'preview',
            filename: f.originalname,
            mime: f.mimetype,
            size_bytes: f.size,
            hint:
              'PDF/görsel dosyalar fatura/teminat gibi bir kayda eklenmeli. ' +
              'Önce ilgili fatura/teminat kaydını oluştur, sonra detayında "Ek dosya" alanından yükle. ' +
              'OCR için /ocr sayfasını kullanabilirsin.',
          },
        });
        return;
      }

      throw new HttpError(415, `Desteklenmeyen dosya tipi: ${name}`, 'UNSUPPORTED');
    } catch (err) {
      next(err);
    }
  },
);
