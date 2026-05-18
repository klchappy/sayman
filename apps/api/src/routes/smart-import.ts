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
import { and, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import JSZip from 'jszip';
import multer from 'multer';
import { createExtractorFromData } from 'node-unrar-js';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import {
  getDb,
  payableItems,
  tenants,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { resolveOrCreateCompany } from '../lib/auto-create-party';
import { logger } from '../config/logger';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { IMPORT_HANDLERS, type ImportConfig } from '../lib/import-handlers';
import {
  cachePreview,
  getCachedPreview,
  hashBuffer,
  invalidatePreview,
} from '../lib/preview-cache';
import { parseUblXml, type ParsedInvoice } from './efatura-helpers';

/** Smart Import preview→commit cache'lenen dosya verisi */
interface CachedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

/**
 * Recipient tax_number → org içindeki tenant'a route et.
 * Eşleşme varsa o tenant'ı dön, yoksa null. Tenant_id otomatik atanırsa
 * tenant_assigned_by='auto_recipient_match', uyumsuzsa active tenant + needs_review=true.
 */
async function resolveTenantByRecipient(
  orgId: string,
  recipientTaxNumber: string | null | undefined,
  activeTenantId: string,
): Promise<{ tenantId: string; isAutoMatched: boolean; mismatch: boolean }> {
  if (!recipientTaxNumber) {
    return { tenantId: activeTenantId, isAutoMatched: false, mismatch: false };
  }
  const cleaned = recipientTaxNumber.replace(/[^0-9]/g, '');
  if (cleaned.length < 10) {
    return { tenantId: activeTenantId, isAutoMatched: false, mismatch: false };
  }
  const db = getDb();
  const [match] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(
        eq(tenants.organization_id, orgId),
        eq(tenants.tax_number, cleaned),
        eq(tenants.is_active, true),
      ),
    )
    .limit(1);
  if (match) {
    return {
      tenantId: match.id,
      isAutoMatched: true,
      mismatch: match.id !== activeTenantId,
    };
  }
  return { tenantId: activeTenantId, isAutoMatched: false, mismatch: false };
}

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

/**
 * Türkçe header → kanonik İngilizce isim eşlemesi.
 * Header_HINTS sadece İngilizce sütun isimlerini bilir; kullanıcı Excel'inde
 * "Ad, Tutar, Vergi No" yazdıysa otomatik tespit çalışmaz. Bu map ile
 * önce header'ları normalize ediyoruz, sonra HEADER_HINTS'e bakıyoruz.
 *
 * Hem normalize ediyoruz hem orijinal Türkçe versiyonu set'e koruyoruz —
 * row-level zod validation'da kullanıcı hem 'ad' hem 'name' yazsa zod
 * 'name' bekliyor; bu yüzden detection'da normalize, ama insert'te
 * canonicalize edilmiş row gönderilmeli. Detection için yeter.
 */
const TR_HEADER_ALIASES: Record<string, string> = {
  // ortak
  'ad': 'name',
  'isim': 'name',
  'adi': 'name',
  'ad_soyad': 'full_name',
  'adsoyad': 'full_name',
  'tam_ad': 'full_name',
  'unvan': 'name',
  'vergi_no': 'tax_number',
  'vkn': 'tax_number',
  'tckn': 'national_id',
  'tc_kimlik': 'national_id',
  'tc_no': 'national_id',
  'kimlik_no': 'national_id',
  'tutar': 'amount',
  'tutari': 'amount',
  'miktar': 'amount',
  'fiyat': 'amount',
  'aciklama': 'title',
  'baslik': 'title',
  'fatura_no': 'invoice_number',
  'fatura_numarasi': 'invoice_number',
  'son_odeme': 'due_date',
  'son_odeme_tarihi': 'due_date',
  'vade': 'due_date',
  'vade_tarihi': 'due_date',
  'duzenleme_tarihi': 'issue_date',
  'kategori': 'category',
  'tedarikci': 'supplier_name',
  'tedarikci_adi': 'supplier_name',
  'telefon': 'phone',
  'gsm': 'phone',
  'cep': 'phone',
  'kisa_ad': 'short_name',
  'sicil_no': 'registry_number',
  'tapu_no': 'registry_number',
  'mulk_tipi': 'property_type',
  'gayrimenkul_tipi': 'property_type',
  'belediye': 'municipality',
  'paket_adi': 'package_name',
  'abone_no': 'subscription_no',
  'aylik_tutar': 'monthly_amount',
  'baslangic': 'start_date',
  'baslangic_tarihi': 'start_date',
  'bitis': 'end_date',
  'bitis_tarihi': 'end_date',
  'tip': 'kind',
  'tur': 'kind',
  'lehdar': 'beneficiary_name',
  'lehdar_adi': 'beneficiary_name',
  'teminat_no': 'letter_no',
  'mektup_no': 'letter_no',
  'odeme_gunu': 'payment_day',
  'aile_grubu': 'family_group',
};

function normalizeHeader(h: string): string {
  // Lowercase + Türkçe karakterleri ASCII'ye çevir + boşluk/tire → underscore
  const lower = h
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  return TR_HEADER_ALIASES[lower] ?? lower;
}

function detectResource(headers: string[]): string | null {
  const normalized = headers.map(normalizeHeader);
  const headerSet = new Set(normalized);
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

/** Header bazlı row'u kanonik isimlere normalize et (zod validation için). */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeHeader(k)] = v;
  }
  return out;
}

export const smartImportRouter = Router();

smartImportRouter.post(
  '/smart-import',
  requireAuth,
  requireTenant,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const commit = req.query.commit === 'true' || req.body?.commit === 'true';
      const tenantId = req.activeTenantId!;
      const orgId = req.activeOrgId!;
      const userId = req.authUser?.id ?? '';

      // İki giriş yolu:
      //   1. req.file → multer'dan gelen yeni dosya (preview veya direkt commit)
      //   2. req.body.cache_key → preview yapılmış dosyanın hash'i (commit-only)
      //      Bu sayede 30 MB ZIP'i commit'te tekrar upload etmeye gerek yok.
      let f: CachedFile;
      let fileHash: string;
      // cache_key: SHA256 hex string (64 char). Zod ile şekil doğrulaması — saldırgan
      // rastgele string göndererek getCachedPreview'i sondajlayamaz.
      const cacheKeyParse = z
        .object({ cache_key: z.string().regex(/^[a-f0-9]{64}$/).optional() })
        .safeParse(req.body ?? {});
      const cacheKey = cacheKeyParse.success ? cacheKeyParse.data.cache_key : undefined;

      if (cacheKey) {
        const cached = getCachedPreview<CachedFile>(cacheKey, tenantId, userId);
        if (!cached) {
          throw new HttpError(
            410,
            'Önizleme süresi doldu veya bulunamadı. Lütfen dosyayı tekrar yükleyin.',
            'CACHE_EXPIRED',
          );
        }
        f = cached;
        fileHash = cacheKey;
      } else if (req.file) {
        f = {
          buffer: req.file.buffer,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
        };
        fileHash = hashBuffer(f.buffer);
      } else {
        throw new HttpError(400, 'Dosya gerekli (field: file) veya cache_key', 'NO_FILE');
      }
      const name = f.filename.toLowerCase();

      // Preview → cache'e koy, response'a cache_key ekle.
      // Yardımcı: response'u dön (cache_key dahil) ve cache'i invalidate et (commit ise).
      const wrapPreviewResponse = (data: Record<string, unknown>) => {
        // Sadece preview'de cache yaz. Commit'te zaten insert oldu → invalidate.
        if (!commit) {
          cachePreview<CachedFile>(fileHash, tenantId, userId, f);
          return { ...data, cache_key: fileHash };
        }
        invalidatePreview(fileHash);
        return data;
      };

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
            data: wrapPreviewResponse({
              type: 'efatura_xml',
              action: 'preview',
              parsed,
              filename: f.filename,
              hint: 'Önizleme. "İçeriye Aktar" butonu ile gerçek import başlatılır.',
            }),
          });
          return;
        }

        // Commit mode — auto-create supplier + payable yarat
        if (!parsed.invoice_number) {
          throw new HttpError(400, 'Fatura numarası bulunamadı', 'INVALID_INVOICE');
        }

        // Recipient tax_number'dan otomatik tenant route (yanlış tenant'a yazılmasın)
        const route = await resolveTenantByRecipient(
          orgId,
          parsed.recipient_tax_number,
          tenantId,
        );
        const targetTenantId = route.tenantId;

        // Aynı invoice_number var mı (idempotent) — target tenant kapsamında
        const db = getDb();
        const [existing] = await db
          .select({ id: payableItems.id, title: payableItems.title })
          .from(payableItems)
          .where(
            and(
              eq(payableItems.tenant_id, targetTenantId),
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
              filename: f.filename,
              parsed,
              payable_id: existing.id,
              supplier_resolution: supplierResolution,
              message: `"${parsed.invoice_number}" zaten kayıtlı (${existing.title}). Yeniden eklenmedi.`,
            },
          });
          return;
        }

        // Race-safe insert: DB-level UNIQUE (tenant_id, invoice_number) ile concurrent
        // import'larda iki kayıt yaratılmaz. 23505 = unique_violation
        let created: { id: string; title: string } | undefined;
        try {
          [created] = await db
            .insert(payableItems)
            .values({
              tenant_id: targetTenantId,
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
                filename: f.filename,
                supplier_tax_number: parsed.supplier_tax_number,
                recipient_tax_number: parsed.recipient_tax_number,
                recipient_name: parsed.recipient_name,
                tenant_routing: {
                  auto_matched: route.isAutoMatched,
                  mismatch_with_active: route.mismatch,
                  active_tenant_at_upload: tenantId,
                },
              },
              needs_review: true,
              auto_created_source: route.isAutoMatched
                ? 'efatura_auto_routed'
                : 'efatura',
              created_by: req.authUser?.id ?? null,
            })
            .returning({ id: payableItems.id, title: payableItems.title });
        } catch (e) {
          if ((e as { code?: string }).code === '23505') {
            // Concurrent upload won the race
            const [dup] = await db
              .select({ id: payableItems.id, title: payableItems.title })
              .from(payableItems)
              .where(
                and(
                  eq(payableItems.tenant_id, targetTenantId),
                  eq(payableItems.invoice_number, parsed.invoice_number),
                ),
              )
              .limit(1);
            if (dup) {
              res.json({
                data: {
                  type: 'efatura_xml',
                  action: 'skipped_duplicate',
                  filename: f.filename,
                  parsed,
                  payable_id: dup.id,
                  supplier_resolution: supplierResolution,
                  message: `"${parsed.invoice_number}" race condition'da yaratıldı, mevcut kayıt kullanılıyor (${dup.title}).`,
                },
              });
              return;
            }
          }
          throw e;
        }

        await auditFromRequest(req, {
          organization_id: orgId,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'smart_import.efatura',
          target_type: 'payable_items',
          target_id: created?.id,
          details: {
            filename: f.filename,
            invoice_number: parsed.invoice_number,
            target_tenant_id: targetTenantId,
            tenant_auto_matched: route.isAutoMatched,
            tenant_mismatch: route.mismatch,
          },
        });

        const routingMessage = route.isAutoMatched
          ? route.mismatch
            ? `Fatura, e-Fatura'daki alıcı VKN'sine eşleşen doğru tenant'a otomatik yönlendirildi (aktif tenant'tan farklı, onay bekliyor).`
            : `Fatura, alıcı VKN eşleştirmesi ile bu tenant'a route edildi.`
          : parsed.recipient_tax_number
            ? `Aktif tenant'a yazıldı (alıcı VKN ${parsed.recipient_tax_number} herhangi bir tenant'la eşleşmedi).`
            : `Aktif tenant'a yazıldı (e-Fatura'da alıcı VKN bulunamadı).`;

        res.json({
          data: {
            type: 'efatura_xml',
            action: 'imported',
            filename: f.filename,
            parsed,
            payable: created,
            supplier_resolution: supplierResolution,
            tenant_routing: route,
            message: `${routingMessage} ${
              supplierResolution?.is_new
                ? `Yeni tedarikçi "${parsed.supplier_name}" otomatik oluşturuldu (doğrulama bekliyor).`
                : supplierResolution?.matched_by
                  ? '(Mevcut tedarikçiye bağlandı.)'
                  : ''
            }`.trim(),
          },
        });
        return;
      }

      // ===== ZIP / RAR =====
      const isZip = name.endsWith('.zip');
      const isRar = name.endsWith('.rar');
      if (isZip || isRar) {
        const archiveType = isZip ? 'zip' : 'rar';
        const xmlFiles: Array<{ name: string; content: string }> = [];
        const otherFiles: Array<{ name: string; ext: string }> = [];

        // ZIP bomb / archive expansion protection
        const MAX_TOTAL_UNCOMPRESSED = 100 * 1024 * 1024; // 100 MB total
        const MAX_PER_FILE = 10 * 1024 * 1024; // 10 MB per file
        const ZIP_BATCH_LIMIT = 100;
        let totalUncompressed = 0;

        if (isZip) {
          const zip = await JSZip.loadAsync(f.buffer);

          // Enforce entry count limit before extraction
          let entryCount = 0;
          zip.forEach((_relPath, entry) => {
            if (!entry.dir) entryCount += 1;
          });
          if (entryCount > ZIP_BATCH_LIMIT * 10) {
            throw new HttpError(
              400,
              `Arşivde çok fazla dosya var (${entryCount}). En fazla ${ZIP_BATCH_LIMIT * 10} dosya işlenebilir.`,
              'ARCHIVE_TOO_MANY_FILES',
            );
          }

          // Pre-validate uncompressed sizes (JSZip exposes via internal _data)
          let preflightError: HttpError | null = null;
          zip.forEach((relPath, entry) => {
            if (entry.dir || preflightError) return;
            const internal = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
            const uncompressedSize = internal?.uncompressedSize ?? 0;
            if (uncompressedSize > MAX_PER_FILE) {
              preflightError = new HttpError(
                400,
                `Arşiv içindeki dosya çok büyük (${relPath}): ${uncompressedSize} bayt, sınır ${MAX_PER_FILE} bayt.`,
                'FILE_TOO_LARGE',
              );
              return;
            }
            totalUncompressed += uncompressedSize;
            if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
              preflightError = new HttpError(
                400,
                `Arşiv toplam uncompressed boyutu ${MAX_TOTAL_UNCOMPRESSED} bayt sınırını aştı.`,
                'ARCHIVE_TOO_LARGE',
              );
            }
          });
          if (preflightError) throw preflightError;

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
        } else {
          // RAR — node-unrar-js, pure JS
          try {
            // Copy Buffer into a fresh ArrayBuffer (Buffer.buffer may be SharedArrayBuffer)
            const rarData = new ArrayBuffer(f.buffer.byteLength);
            new Uint8Array(rarData).set(f.buffer);
            const extractor = await createExtractorFromData({ data: rarData });

            // Pre-validate uncompressed sizes via file list (no extraction yet)
            const listOnly = extractor.getFileList();
            const fileHeaders = [...listOnly.fileHeaders];
            if (fileHeaders.length > ZIP_BATCH_LIMIT * 10) {
              throw new HttpError(
                400,
                `Arşivde çok fazla dosya var (${fileHeaders.length}). En fazla ${ZIP_BATCH_LIMIT * 10} dosya işlenebilir.`,
                'ARCHIVE_TOO_MANY_FILES',
              );
            }
            for (const header of fileHeaders) {
              if (header.flags.directory) continue;
              const unpSize = header.unpSize ?? 0;
              if (unpSize > MAX_PER_FILE) {
                throw new HttpError(
                  400,
                  `Arşiv içindeki dosya çok büyük (${header.name}): ${unpSize} bayt, sınır ${MAX_PER_FILE} bayt.`,
                  'FILE_TOO_LARGE',
                );
              }
              totalUncompressed += unpSize;
              if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
                throw new HttpError(
                  400,
                  `Arşiv toplam uncompressed boyutu ${MAX_TOTAL_UNCOMPRESSED} bayt sınırını aştı.`,
                  'ARCHIVE_TOO_LARGE',
                );
              }
            }

            const list = extractor.extract({});
            const files = [...list.files];
            for (const file of files) {
              if (file.fileHeader.flags.directory) continue;
              const relPath = file.fileHeader.name;
              const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
              if (ext === 'xml' && file.extraction) {
                xmlFiles.push({
                  name: relPath,
                  content: Buffer.from(file.extraction).toString('utf-8'),
                });
              } else {
                otherFiles.push({ name: relPath, ext });
              }
            }
          } catch (err) {
            if (err instanceof HttpError) throw err;
            throw new HttpError(
              400,
              `RAR ayıklama hatası: ${(err as Error).message}`,
              'RAR_PARSE',
            );
          }
        }

        const willTruncate = xmlFiles.length > ZIP_BATCH_LIMIT;

        if (!commit) {
          res.json({
            data: wrapPreviewResponse({
              type: archiveType,
              action: 'preview',
              filename: f.filename,
              xml_count: xmlFiles.length,
              other_count: otherFiles.length,
              batch_limit: ZIP_BATCH_LIMIT,
              will_truncate: willTruncate,
              xml_files: xmlFiles.slice(0, 50).map((x) => ({ name: x.name })),
              other_files: otherFiles.slice(0, 50),
              hint: willTruncate
                ? `${xmlFiles.length} XML bulundu ancak tek seferde en fazla ${ZIP_BATCH_LIMIT} fatura işlenir. İlk ${ZIP_BATCH_LIMIT} aktarılacak, geri kalan ${xmlFiles.length - ZIP_BATCH_LIMIT} XML için yeni bir ZIP yükle.`
                : `${xmlFiles.length} adet e-Fatura XML bulundu. "İçeriye Aktar" ile hepsi yüklenecek.`,
            }),
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
          supplier_failed?: boolean;
          supplier_error?: string;
          error?: string;
        }> = [];

        for (const xf of xmlFiles.slice(0, ZIP_BATCH_LIMIT)) {
          try {
            const parsed: ParsedInvoice = parseUblXml(xf.content);
            if (!parsed.invoice_number) {
              results.push({ file: xf.name, ok: false, error: 'invoice_number bulunamadı' });
              continue;
            }

            const route = await resolveTenantByRecipient(
              orgId,
              parsed.recipient_tax_number,
              tenantId,
            );
            const targetTenantId = route.tenantId;

            const [existing] = await db
              .select({ id: payableItems.id })
              .from(payableItems)
              .where(
                and(
                  eq(payableItems.tenant_id, targetTenantId),
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
            let supplierFailedErr: string | null = null;
            if (parsed.supplier_name) {
              try {
                supplier = await resolveOrCreateCompany(orgId, {
                  name: parsed.supplier_name,
                  tax_number: parsed.supplier_tax_number,
                  source: 'efatura',
                });
              } catch (err) {
                // Eskiden bu hata sessizce yutuluyordu — kullanıcı tedarikçi eşleşmesinin
                // neden olmadığını göremiyordu.
                supplierFailedErr = err instanceof Error ? err.message : String(err);
              }
            }

            try {
              const [created] = await db
                .insert(payableItems)
                .values({
                  tenant_id: targetTenantId,
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
                    source: `smart_import_${archiveType}`,
                    archive_filename: f.filename,
                    xml_filename: xf.name,
                    recipient_tax_number: parsed.recipient_tax_number,
                    recipient_name: parsed.recipient_name,
                    tenant_routing: {
                      auto_matched: route.isAutoMatched,
                      mismatch_with_active: route.mismatch,
                      active_tenant_at_upload: tenantId,
                    },
                  },
                  needs_review: true,
                  auto_created_source: route.isAutoMatched
                    ? `smart_import_${archiveType}_auto_routed`
                    : `smart_import_${archiveType}`,
                  created_by: req.authUser?.id ?? null,
                })
                .returning({ id: payableItems.id });

              results.push({
                file: xf.name,
                ok: true,
                invoice_number: parsed.invoice_number,
                payable_id: created?.id,
                supplier_new: supplier?.is_new ?? false,
                ...(supplierFailedErr
                  ? { supplier_failed: true, supplier_error: supplierFailedErr }
                  : {}),
              });
            } catch (insertErr) {
              if ((insertErr as { code?: string }).code === '23505') {
                results.push({
                  file: xf.name,
                  ok: true,
                  invoice_number: parsed.invoice_number,
                  error: 'duplicate (race)',
                });
              } else {
                throw insertErr;
              }
            }
          } catch (err) {
            results.push({ file: xf.name, ok: false, error: (err as Error).message.slice(0, 150) });
          }
        }

        const success = results.filter((r) => r.ok && !r.error).length;
        const duplicates = results.filter((r) => r.ok && r.error === 'duplicate (skipped)').length;
        const failed = results.filter((r) => !r.ok).length;
        const newSuppliers = results.filter((r) => r.supplier_new).length;
        const createdPayableIds = results
          .map((r) => r.payable_id)
          .filter((id): id is string => Boolean(id));

        if (createdPayableIds.length > 0) {
          await db
            .update(payableItems)
            .set({ needs_review: true, updated_at: new Date() })
            .where(inArray(payableItems.id, createdPayableIds));
        }

        await auditFromRequest(req, {
          organization_id: orgId,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: `smart_import.${archiveType}`,
          details: {
            filename: f.filename,
            total: xmlFiles.length,
            success,
            duplicates,
            failed,
            new_suppliers: newSuppliers,
          },
        });

        const truncatedCount = Math.max(0, xmlFiles.length - ZIP_BATCH_LIMIT);
        const supplierFailedCount = results.filter((r) => r.supplier_failed).length;
        res.json({
          data: {
            type: archiveType,
            action: 'imported',
            filename: f.filename,
            xml_count: xmlFiles.length,
            processed: Math.min(xmlFiles.length, ZIP_BATCH_LIMIT),
            truncated: truncatedCount > 0,
            truncated_count: truncatedCount,
            success,
            duplicates,
            failed,
            new_suppliers: newSuppliers,
            supplier_failed: supplierFailedCount,
            results: results.slice(0, 200),
            message: truncatedCount > 0
              ? `${success} fatura aktarıldı, ${duplicates} mükerrer, ${failed} hata${newSuppliers > 0 ? `, ${newSuppliers} yeni tedarikçi` : ''}${supplierFailedCount > 0 ? `, ${supplierFailedCount} tedarikçi eşleştirilemedi` : ''}. UYARI: ${truncatedCount} XML işlenmedi (batch limiti ${ZIP_BATCH_LIMIT}). Geri kalanlar için yeni bir ZIP yükle.`
              : `${success} fatura aktarıldı, ${duplicates} mükerrer atlandı, ${failed} hata${newSuppliers > 0 ? `, ${newSuppliers} yeni tedarikçi oluşturuldu` : ''}${supplierFailedCount > 0 ? `, ${supplierFailedCount} tedarikçi eşleştirilemedi (kayıt yine de oluşturuldu)` : ''}.`,
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

        // Türkçe header desteği: row'ları kanonik (İngilizce) isimlerle normalize et
        rows = rows.map((r) => normalizeRow(r));

        const detected = detectResource(headers);

        if (!detected) {
          res.json({
            data: wrapPreviewResponse({
              type: 'tabular',
              action: 'preview',
              filename: f.filename,
              format: name.endsWith('.csv') ? 'csv' : 'xlsx',
              row_count: rows.length,
              headers,
              detected_resource: null,
              preview_rows: rows.slice(0, 5),
              hint: 'Tip otomatik tespit edilemedi. Header satırına en az 2 tanınan kolon ekleyin (ör. title+amount veya ad+vergi_no).',
            }),
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
            data: wrapPreviewResponse({
              type: 'tabular',
              action: 'preview',
              filename: f.filename,
              format: name.endsWith('.csv') ? 'csv' : 'xlsx',
              row_count: rows.length,
              headers,
              detected_resource: detected,
              valid_count: validatedRows.length,
              invalid_count: errors.length,
              preview_rows: validatedRows.slice(0, 5),
              errors: errors.slice(0, 20),
              hint: `${detected} olarak tespit edildi. ${validatedRows.length} satır geçerli. "İçeriye Aktar" tıkla.`,
            }),
          });
          return;
        }

        // Commit — bulk insert with auto-create supplier for payables
        if (validatedRows.length === 0) {
          throw new HttpError(400, 'Geçerli satır yok, import yapılamaz', 'NO_VALID');
        }

        // Auto-supplier + bulk insert artık tek transaction'da — kısmi
        // başarı (örn. yarıda supplier yaratıldı ama insert'e geçemedi)
        // olamaz, hep ya tamam ya hiç.
        // Smart Import payable kayıtlarını HER ZAMAN review queue'ya düşür —
        // XML path'ında olduğu gibi (tutarlılık). CSV bulk auto-import güvenilir
        // değildir; tek tek onaylanmalı. Kullanıcı isterse onay queue'sundan
        // toplu onaylar. Bu sayede 'CSV yüklediğim faturalar nerde?' kafa
        // karışıklığı da Onay Bekleyenler'e tek noktaya odaklanır.
        if (detected === 'payables') {
          for (const row of validatedRows) {
            (row as Record<string, unknown>).needs_review = true;
            (row as Record<string, unknown>).auto_created_source = 'smart_import_csv';
          }
        }

        // Auto-supplier + bulk insert artık tek transaction'da — kısmi
        // başarı (örn. yarıda supplier yaratıldı ama insert'e geçemedi)
        // olamaz, hep ya tamam ya hiç.
        const db = getDb();
        let newSuppliers = 0;
        const supplierFailures: Array<{ supplier_name: string; error: string }> = [];
        const insertFailures: Array<{ row_index: number; row: any; error: string }> = [];
        const insertedIds = await db.transaction(async (tx) => {
          if (detected === 'payables') {
            for (const row of validatedRows) {
              const r = row as Record<string, unknown>;
              const supplierName = r.supplier_name as string | null;
              if (supplierName && typeof supplierName === 'string') {
                try {
                  const sup = await resolveOrCreateCompany(
                    orgId,
                    { name: supplierName, tax_number: null, source: 'csv_import' },
                    tx,
                  );
                  if (sup.is_new) newSuppliers++;
                  (row as Record<string, unknown>).company_id = sup.id;
                } catch (err) {
                  // Önceden bu hata sessizce yutuluyordu, kullanıcı tedarikçi
                  // eşleşmesinin neden eksik olduğunu göremiyordu.
                  const msg = err instanceof Error ? err.message : String(err);
                  supplierFailures.push({ supplier_name: supplierName, error: msg });
                  logger.warn({ err, supplierName }, 'csv import auto-supplier failed');
                }
              }
            }
          }

          return handler.insert(validatedRows, {
            orgId,
            tenantId: handler.scope === 'tenant' ? tenantId : undefined,
            db: tx,
            failedRows: insertFailures,
          });
        });

        await auditFromRequest(req, {
          organization_id: orgId,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'smart_import.tabular',
          details: {
            filename: f.filename,
            resource: detected,
            inserted: insertedIds.length,
            new_suppliers: newSuppliers,
            supplier_failed: supplierFailures.length,
          },
        });

        res.json({
          data: {
            type: 'tabular',
            action: 'imported',
            filename: f.filename,
            resource: detected,
            row_count: rows.length,
            valid_count: validatedRows.length,
            invalid_count: errors.length,
            inserted: insertedIds.length,
            inserted_ids: insertedIds,
            new_suppliers: newSuppliers,
            supplier_failed: supplierFailures.length,
            supplier_failures: supplierFailures.slice(0, 20),
            // Bulk insert all-or-nothing'den row-by-row fallback'e geçti — başarısız
            // satırlar artık ayrı listede dönüyor (eskiden tüm batch fail eder, kullanıcı
            // hangi satırın patladığını göremezdi).
            insert_failed: insertFailures.length,
            insert_failures: insertFailures.slice(0, 20),
            errors: errors.slice(0, 20),
            message: `${insertedIds.length} kayıt eklendi${errors.length > 0 ? `, ${errors.length} doğrulamayı geçemedi` : ''}${insertFailures.length > 0 ? `, ${insertFailures.length} satır DB'ye yazılamadı` : ''}${newSuppliers > 0 ? `, ${newSuppliers} yeni tedarikçi (doğrulama bekliyor)` : ''}${supplierFailures.length > 0 ? `, ${supplierFailures.length} tedarikçi eşleştirilemedi` : ''}.`,
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
        // PDF/IMG için commit yolu yok — sadece bilgi dönüyoruz. Cache de yazmıyoruz.
        res.json({
          data: {
            type: 'document',
            action: 'preview',
            filename: f.filename,
            mime: f.mimetype,
            size_bytes: f.buffer.length,
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
