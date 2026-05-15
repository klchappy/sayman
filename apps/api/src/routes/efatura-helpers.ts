/**
 * UBL-TR XML parser — efatura.ts ve smart-import.ts paylaşır.
 */
import { XMLParser } from 'fast-xml-parser';
import { HttpError } from '../lib/helpers';

export interface ParsedInvoice {
  invoice_number: string;
  issue_date: string | null;
  due_date: string | null;
  currency: string;
  amount: string;
  supplier_name: string | null;
  supplier_tax_number: string | null;
  /** Faturanın alıcısı (genelde kendi şirketimiz/tenant) */
  recipient_name: string | null;
  recipient_tax_number: string | null;
  profile_id: string | null;
  notes: string | null;
}

export function parseUblXml(xml: string): ParsedInvoice {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseAttributeValue: true,
    trimValues: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml);
  } catch (e) {
    throw new HttpError(400, `XML parse hatası: ${(e as Error).message}`, 'XML_PARSE');
  }

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

  const totals = inv.LegalMonetaryTotal ?? {};
  const payableRaw = totals.PayableAmount;
  let amount = '0';
  if (typeof payableRaw === 'object' && payableRaw !== null) {
    amount = String((payableRaw as Record<string, unknown>)['#text'] ?? payableRaw);
  } else if (payableRaw !== undefined) {
    amount = String(payableRaw);
  }
  amount = String(Number(amount).toFixed(2));

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

  // AccountingCustomerParty → bizim (recipient) tarafımız
  const customerParty = inv.AccountingCustomerParty?.Party ?? {};
  const customerNameNode = customerParty.PartyName?.Name;
  const recipientName =
    typeof customerNameNode === 'object' && customerNameNode !== null
      ? String((customerNameNode as Record<string, unknown>)['#text'] ?? '')
      : customerNameNode != null
        ? String(customerNameNode)
        : null;

  const custPartyIdent = customerParty.PartyIdentification;
  let recipientTax: string | null = null;
  if (Array.isArray(custPartyIdent)) {
    for (const p of custPartyIdent) {
      const idNode = (p as Record<string, unknown>)?.ID;
      if (typeof idNode === 'object' && idNode !== null) {
        const scheme = (idNode as Record<string, unknown>)['@_schemeID'];
        const val = (idNode as Record<string, unknown>)['#text'];
        if (scheme === 'VKN' || scheme === 'TCKN') {
          recipientTax = String(val ?? '');
          break;
        }
      }
    }
  } else if (typeof custPartyIdent === 'object' && custPartyIdent !== null) {
    const idNode = (custPartyIdent as Record<string, unknown>).ID;
    if (typeof idNode === 'object' && idNode !== null) {
      recipientTax = String((idNode as Record<string, unknown>)['#text'] ?? '');
    } else if (idNode != null) {
      recipientTax = String(idNode);
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
    recipient_name: recipientName?.trim() || null,
    recipient_tax_number: recipientTax?.trim() || null,
    profile_id: profileId,
    notes,
  };
}
