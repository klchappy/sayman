/**
 * fetch-fx-rates cron job — daily 16:00 TR (TCMB kapanış kurları sonrası).
 *
 * TCMB Indicative Exchange Rates XML:
 *   https://www.tcmb.gov.tr/kurlar/today.xml — bugünün kurları
 *   https://www.tcmb.gov.tr/kurlar/YYYYMM/DDMMYYYY.xml — geçmiş tarih
 *
 * Cumartesi/Pazar/resmi tatil: TCMB kur yayınlamaz → 404 alırsak skip.
 */
import { XMLParser } from 'fast-xml-parser';
import { eq } from 'drizzle-orm';
import { fxRates, getDb } from '@sayman/db';
import { logger } from '../config/logger';

const TRACKED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'RUB', 'AUD', 'CAD'];
const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

interface FetchResult {
  fetched: number;
  upserted: number;
  fx_date: string | null;
  error?: string;
}

export async function runFetchFxRates(): Promise<FetchResult> {
  try {
    const res = await fetch(TCMB_URL, {
      headers: { 'User-Agent': 'sayman/0.1 (+https://sayman.deploi.net)' },
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'TCMB XML fetch failed (weekend/holiday?)');
      return { fetched: 0, upserted: 0, fx_date: null, error: `HTTP ${res.status}` };
    }
    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    });
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const tarihDate = (parsed.Tarih_Date ?? parsed.tarihDate) as Record<string, unknown> | undefined;
    if (!tarihDate) {
      return { fetched: 0, upserted: 0, fx_date: null, error: 'XML root missing Tarih_Date' };
    }

    // TCMB XML: <Tarih_Date Tarih="14.05.2026" Date="05/14/2026" ...>
    const dateAttr = String(tarihDate['@_Date'] ?? ''); // MM/DD/YYYY
    const [mm, dd, yyyy] = dateAttr.split('/');
    const fxDate = yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : new Date().toISOString().slice(0, 10);

    const currencyEntries = (tarihDate.Currency as Array<Record<string, unknown>>) ?? [];

    const db = getDb();
    let upserted = 0;

    for (const entry of currencyEntries) {
      const code = String(entry['@_CurrencyCode'] ?? '').toUpperCase();
      if (!TRACKED_CURRENCIES.includes(code)) continue;

      const unit = Number(entry.Unit ?? 1);
      const banknoteSelling = entry.BanknoteSelling ? Number(entry.BanknoteSelling) / unit : null;
      const forexBuying = entry.ForexBuying ? Number(entry.ForexBuying) / unit : null;
      const forexSelling = entry.ForexSelling ? Number(entry.ForexSelling) / unit : null;

      if (!banknoteSelling && !forexSelling) continue;

      const rateValue = banknoteSelling ?? forexSelling!;

      // upsert
      await db
        .insert(fxRates)
        .values({
          currency: code,
          fx_date: fxDate,
          rate_try: rateValue.toFixed(6),
          forex_buying: forexBuying?.toFixed(6) ?? null,
          forex_selling: forexSelling?.toFixed(6) ?? null,
          source: 'tcmb',
        })
        .onConflictDoUpdate({
          target: [fxRates.fx_date, fxRates.currency],
          set: {
            rate_try: rateValue.toFixed(6),
            forex_buying: forexBuying?.toFixed(6) ?? null,
            forex_selling: forexSelling?.toFixed(6) ?? null,
          },
        });
      upserted++;
    }

    logger.info({ fx_date: fxDate, upserted }, 'TCMB FX rates fetched');
    return { fetched: currencyEntries.length, upserted, fx_date: fxDate };
  } catch (err) {
    logger.error({ err }, 'fetch-fx-rates failed');
    return {
      fetched: 0,
      upserted: 0,
      fx_date: null,
      error: (err as Error).message,
    };
  }
}
