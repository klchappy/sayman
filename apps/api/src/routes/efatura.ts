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
import { XMLParser } from 'fast-xml-parser';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, payableItems } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { requirePerm } from '../middleware/permission';

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

interface ParsedInvoice {
  invoice_number: string;
  issue_date: string | null;
  due_date: string | null;
  currency: string;
  amount: string;
  supplier_name: string | null;
  supplier_tax_number: string | null;
  profile_id: string | null;
  notes: string | null;
  raw_total?: string;
  raw_tax?: string;
}

/**
 * UBL-TR Invoice XML'i parse et.
 */
function parseUblXml(xml: string): ParsedInvoice {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true, // cbc: cac: prefix'lerini kaldır
    parseAttributeValue: true,
    trimValues: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml);
  } catch (e) {
    throw new HttpError(400, `XML parse hatası: ${(e as Error).message}`, 'XML_PARSE');
  }

  // Root: <Invoice> veya <ApplicationResponse> içinde
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = (parsed as any).Invoice ?? (parsed as any).CreditNote;
  if (!inv) {
    throw new HttpError(400, 'Geçerli UBL Invoice/CreditNote bulunamadı', 'NOT_UBL');
  }

  const id = String(inv.ID ?? inv.id ?? '').trim();
  if (!id) throw new HttpError(400, 'cbc:ID bulunamadı', 'NO_ID');

  const issueDate = inv.IssueDate ? String(inv.IssueDate).trim() : null;
  const dueDate = inv.DueDate ? String(inv.DueDate).trim() : null;
  const currency = String(inv.DocumentCurrencyCode ?? 'TRY').trim().toUpperCase().slice(0, 3);
  const profileId = inv.ProfileID ? String(inv.ProfileID).trim() : null;

  // LegalMonetaryTotal/PayableAmount
  const totals = inv.LegalMonetaryTotal ?? {};
  const payableRaw = totals.PayableAmount;
  let amount = '0';
  if (typeof payableRaw === 'object' && payableRaw !== null) {
    amount = String((payableRaw as Record<string, unknown>)['#text'] ?? payableRaw);
  } else if (payableRaw !== undefined) {
    amount = String(payableRaw);
  }
  // Sayı normalize
  amount = String(Number(amount).toFixed(2));

  // AccountingSupplierParty
  const supplierParty = inv.AccountingSupplierParty?.Party ?? {};
  const supplierNameNode = supplierParty.PartyName?.Name;
  const supplierName =
    typeof supplierNameNode === 'object' && supplierNameNode !== null
      ? String((supplierNameNode as Record<string, unknown>)['#text'] ?? '')
      : supplierNameNode != null
        ? String(supplierNameNode)
        : null;

  const partyIdent = supplierParty.PartyIdentification;
  let supplierTax: string | null = null;
  if (Array.isArray(partyIdent)) {
    for (const p of partyIdent) {
      const idNode = (p as Record<string, unknown>)?.ID;
      if (typeof idNode === 'object' && idNode !== null) {
        const scheme = (idNode as Record<string, unknown>)['@_schemeID'];
        const val = (idNode as Record<string, unknown>)['#text'];
        if (scheme === 'VKN' || scheme === 'TCKN') {
          supplierTax = String(val ?? '');
          break;
        }
      }
    }
  } else if (typeof partyIdent === 'object' && partyIdent !== null) {
    const idNode = (partyIdent as Record<string, unknown>).ID;
    if (typeof idNode === 'object' && idNode !== null) {
      supplierTax = String((idNode as Record<string, unknown>)['#text'] ?? '');
    } else if (idNode != null) {
      supplierTax = String(idNode);
    }
  }

  let notes: string | null = null;
  if (inv.Note) {
    notes = Array.isArray(inv.Note) ? inv.Note.map(String).join('\n') : String(inv.Note);
  }

  return {
    invoice_number: id,
    issue_date: issueDate,
    due_date: dueDate,
    currency,
    amount,
    supplier_name: supplierName?.trim() || null,
    supplier_tax_number: supplierTax?.trim() || null,
    profile_id: profileId,
    notes,
  };
}

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
