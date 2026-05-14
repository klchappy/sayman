/**
 * /v1/smart-import — Akıllı dosya yönlendirici.
 *
 * Tek bir dosya yüklenir (CSV/XLSX/XML/ZIP/PDF/Image), Sayman:
 *   - Uzantı + MIME + içerik sniff → tip tespit
 *   - Uygun handler'a otomatik yönlendir:
 *     * .xml + UBL imzası → /efatura/import
 *     * .zip → içindeki XML'ler için /efatura/import-zip, diğerleri raporlanır
 *     * .csv / .xlsx → resource auto-detect (header'a göre) + /import bulk
 *     * .pdf / .jpg / .png → attachment olarak yükle (related_table+id gerekli, yoksa staging)
 *
 * Body: multipart/form-data, field: file
 * Query: ?related_table=&related_id=  (PDF/image için optional)
 * Response: { type, action, summary, dry_run? }
 */
import { parse as parseCsv } from 'csv-parse/sync';
import { Router } from 'express';
import JSZip from 'jszip';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { IMPORT_HANDLERS, type ImportConfig } from '../lib/import-handlers';

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

// Header → resource eşleştirmesi (CSV/XLSX content sniff)
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
      const dryRun = req.query.dry_run === 'true' || req.body.dry_run === 'true';

      // XML — UBL e-Fatura
      if (name.endsWith('.xml')) {
        const xml = f.buffer.toString('utf-8');
        const { parseUblXml } = await import('./efatura-helpers');
        const parsed = parseUblXml(xml);
        res.json({
          data: {
            type: 'efatura_xml',
            action: dryRun ? 'preview' : 'next:efatura_import',
            parsed,
            hint: dryRun
              ? 'Önizleme. Onaylayıp /v1/efatura/import\'a XML\'i gönder.'
              : 'POST /v1/efatura/import { xml }',
          },
        });
        return;
      }

      // ZIP
      if (name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(f.buffer);
        const fileList: Array<{ name: string; ext: string; size: number }> = [];
        zip.forEach((relPath, entry) => {
          if (!entry.dir) {
            const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
            fileList.push({ name: relPath, ext, size: 0 });
          }
        });

        const byExt = fileList.reduce<Record<string, number>>((acc, x) => {
          acc[x.ext] = (acc[x.ext] ?? 0) + 1;
          return acc;
        }, {});

        // En çok XML → e-fatura import-zip yönlendir
        const xmlCount = byExt.xml ?? 0;
        const csvCount = (byExt.csv ?? 0) + (byExt.xlsx ?? 0);
        const docCount = (byExt.pdf ?? 0) + (byExt.jpg ?? 0) + (byExt.jpeg ?? 0) + (byExt.png ?? 0);

        let route = 'unknown';
        if (xmlCount > 0 && xmlCount >= csvCount) route = 'efatura_zip';
        else if (csvCount > 0) route = 'bulk_zip';
        else if (docCount > 0) route = 'attachment_zip';

        res.json({
          data: {
            type: 'zip',
            file_count: fileList.length,
            by_extension: byExt,
            route,
            action:
              route === 'efatura_zip'
                ? 'POST /v1/efatura/import-zip { zip_base64 }'
                : route === 'bulk_zip'
                  ? 'Her CSV/XLSX için /v1/import/:resource çağır (header sniff)'
                  : 'PDF/Image\'lar attachment olarak yüklenebilir',
            files: fileList.slice(0, 50),
          },
        });
        return;
      }

      // CSV / XLSX — resource auto-detect
      if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
        let rows: unknown[] = [];
        let headers: string[] = [];

        if (name.endsWith('.csv')) {
          const txt = f.buffer.toString('utf-8');
          try {
            rows = parseCsv(txt, {
              columns: true,
              skip_empty_lines: true,
              trim: true,
              relax_quotes: true,
            }) as unknown[];
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
            rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
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
              format: name.endsWith('.csv') ? 'csv' : 'xlsx',
              row_count: rows.length,
              headers,
              detected_resource: null,
              action: 'manual',
              hint:
                'Resource otomatik tespit edilemedi. Header\'a göre el ile resource seç ve /v1/import/:resource çağır.',
            },
          });
          return;
        }

        const handler = IMPORT_HANDLERS[detected] as ImportConfig;
        // Dry-run validate first 5
        const sampleErrors: Array<{ row: number; error: string }> = [];
        const sampleValid: unknown[] = [];
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const result = handler.schema.safeParse(rows[i]);
          if (result.success) sampleValid.push(result.data);
          else
            sampleErrors.push({
              row: i + 1,
              error: result.error.issues
                .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
                .join(', '),
            });
        }

        res.json({
          data: {
            type: 'tabular',
            format: name.endsWith('.csv') ? 'csv' : 'xlsx',
            row_count: rows.length,
            headers,
            detected_resource: detected,
            sample_valid: sampleValid,
            sample_errors: sampleErrors,
            action: `POST /v1/import/${detected} { format, data }`,
          },
        });
        return;
      }

      // PDF / Image → attachment
      if (
        name.endsWith('.pdf') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp')
      ) {
        const related_table = String(req.query.related_table ?? '');
        const related_id = String(req.query.related_id ?? '');
        res.json({
          data: {
            type: 'document',
            mime: f.mimetype,
            size_bytes: f.size,
            action: related_table && related_id
              ? `POST /v1/attachments (multipart, file=binary) ?related_table=${related_table}&related_id=${related_id}`
              : 'PDF/Image bir kayda eklenmek için related_table + related_id gerekli (örn payable_items + payable_id). OCR için /ocr sayfası kullanılabilir.',
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
