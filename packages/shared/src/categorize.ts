/**
 * Akıllı kategorizasyon — fatura/abonelik başlığından kategori öner.
 *
 * Rule-based: TR + İngilizce anahtar kelimeler → category enum.
 * "Türk Telekom 200 Fiber" → 'telekom'
 * "İSKİ Su Faturası Mart 2026" → 'su'
 * "BAĞKUR prim Şubat" → 'bagkur'
 *
 * Output: PAYABLE_CATEGORIES'ten en olası eşleşme + confidence score.
 * Birden fazla eşleşme varsa en uzun kelime kazanır.
 */

export const PAYABLE_CATEGORIES = [
  'elektrik',
  'su',
  'dogalgaz',
  'telekom',
  'internet',
  'mobil',
  'tv_uydu',
  'kira',
  'aidat',
  'bagkur',
  'ssk',
  'bes',
  'ito',
  'kgk',
  'vergi',
  'kdv',
  'mtv',
  'sigorta',
  'yakit',
  'lojistik',
  'sarf',
  'donanim',
  'yazilim_lisans',
  'danismanlik',
  'avukatlik',
  'muhasebe',
  'maas',
  'banka_komisyon',
  'kredi',
  'teminat_komisyon',
  'kira_artisi',
  'reklam',
  'egitim',
  'seyahat',
  'temizlik',
  'guvenlik',
  'bakim_onarim',
  'diger',
] as const;

export type PayableCategory = (typeof PAYABLE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<PayableCategory, string> = {
  elektrik: 'Elektrik',
  su: 'Su',
  dogalgaz: 'Doğalgaz',
  telekom: 'Telekom',
  internet: 'İnternet',
  mobil: 'Mobil',
  tv_uydu: 'TV / Uydu',
  kira: 'Kira',
  aidat: 'Aidat',
  bagkur: 'BAĞKUR',
  ssk: 'SSK',
  bes: 'BES',
  ito: 'İTO',
  kgk: 'KGK',
  vergi: 'Vergi',
  kdv: 'KDV',
  mtv: 'MTV',
  sigorta: 'Sigorta',
  yakit: 'Yakıt',
  lojistik: 'Lojistik',
  sarf: 'Sarf Malzeme',
  donanim: 'Donanım',
  yazilim_lisans: 'Yazılım Lisansı',
  danismanlik: 'Danışmanlık',
  avukatlik: 'Avukatlık',
  muhasebe: 'Muhasebe',
  maas: 'Maaş',
  banka_komisyon: 'Banka Komisyonu',
  kredi: 'Kredi',
  teminat_komisyon: 'Teminat Komisyonu',
  kira_artisi: 'Kira Artışı',
  reklam: 'Reklam',
  egitim: 'Eğitim',
  seyahat: 'Seyahat',
  temizlik: 'Temizlik',
  guvenlik: 'Güvenlik',
  bakim_onarim: 'Bakım & Onarım',
  diger: 'Diğer',
};

/**
 * Kategori → anahtar kelime listesi. Eşleşme case-insensitive + Türkçe diacritic-aware.
 * Sıralama: en spesifikten en genele.
 */
const CATEGORY_KEYWORDS: Record<PayableCategory, string[]> = {
  elektrik: ['elektrik', 'cedaş', 'cedas', 'bedaş', 'bedas', 'edaş', 'edas', 'aedaş', 'aedas', 'enerjisa', 'kw saat', 'kwh'],
  su: ['iski', 'iSKi', 'i̇ski', 'aski', 'aSKi', 'su faturası', 'su faturasi', 'su bedeli', 'kanalizasyon'],
  dogalgaz: ['doğalgaz', 'dogalgaz', 'iGDAŞ', 'igdas', 'i̇gdaş', 'palgaz', 'bursagaz', 'aksa gaz', 'enerya'],
  telekom: ['türk telekom', 'turk telekom', 'turknet', 'türknet', 'tt mobil'],
  internet: ['fiber', 'adsl', 'vdsl', 'internet', 'wifi', 'broadband'],
  mobil: ['vodafone', 'turkcell', 'türkcell', 'tcell', 'mobil hat', 'mobil paket', 'gsm'],
  tv_uydu: ['digitürk', 'digiturk', 'd-smart', 'dsmart', 'tivibu', 'beIN', 'bein connect', 'kabloTV', 'uydu yayın'],
  kira: ['kira bedeli', 'aylık kira', 'kira ödeme', 'rent', 'leasing kira'],
  aidat: ['aidat', 'site aidat', 'yönetim aidat', 'apartman aidat'],
  bagkur: ['bağkur', 'bagkur', 'bağ-kur', '4b', 'BAĞKUR prim'],
  ssk: ['ssk', 'sgk prim', '4a', 'sosyal güvenlik'],
  bes: ['bes', 'bireysel emeklilik', 'oyak emeklilik', 'agesa', 'allianz emek'],
  ito: ['ito', 'İTO aidat', 'oda aidatı', 'oda kayıt'],
  kgk: ['kgk', 'kredi garanti fonu'],
  vergi: ['gelir vergisi', 'kurumlar vergisi', 'beyanname'],
  kdv: ['kdv', 'KDV beyan'],
  mtv: ['mtv', 'motorlu taşıt'],
  sigorta: ['sigorta', 'kasko', 'trafik sigortası', 'sağlık sigortası', 'dask', 'sompo', 'allianz sigorta', 'axa'],
  yakit: ['benzin', 'mazot', 'motorin', 'lpg', 'shell', 'opet', 'petrol ofisi', 'bp', 'total'],
  lojistik: ['kargo', 'aras', 'yurtiçi kargo', 'mng kargo', 'ptt kargo', 'ups', 'dhl', 'fedex', 'nakliye'],
  sarf: ['kırtasiye', 'ofis malzeme', 'sarf', 'kağıt', 'toner'],
  donanim: ['donanım', 'bilgisayar', 'laptop', 'monitör', 'klavye', 'mouse', 'sunucu'],
  yazilim_lisans: ['lisans', 'license', 'subscription', 'office 365', 'adobe', 'jetbrains', 'github', 'aws', 'azure', 'gcp', 'figma', 'notion', 'slack'],
  danismanlik: ['danışmanlık', 'consulting', 'advisory'],
  avukatlik: ['avukatlık', 'avukat ücret', 'hukuk müşaviri'],
  muhasebe: ['mali müşavir', 'mali musavir', 'smm', 'serbest muhasebeci', 'ymm'],
  maas: ['maaş', 'maas', 'ücret bordro', 'payroll'],
  banka_komisyon: ['banka komisyonu', 'havale ücreti', 'eft ücreti', 'hesap işletim'],
  kredi: ['kredi taksit', 'kredi ödeme', 'kkb', 'kredi faiz'],
  teminat_komisyon: ['teminat komisyon', 'mektup komisyon'],
  kira_artisi: ['kira artış', 'tüfe kira'],
  reklam: ['reklam', 'google ads', 'meta ads', 'facebook ads', 'instagram ads', 'tiktok ads', 'youtube ads', 'sponsor'],
  egitim: ['eğitim', 'kurs', 'seminer', 'konferans katılım'],
  seyahat: ['uçak bileti', 'otobüs bileti', 'otel', 'konaklama', 'aralık trip'],
  temizlik: ['temizlik', 'cleaning', 'temizlik hizmeti'],
  guvenlik: ['güvenlik', 'security hizmet'],
  bakim_onarim: ['bakım', 'onarım', 'tamir', 'servis', 'periyodik bakım'],
  diger: [],
};

/**
 * Türkçe karakterleri normalize (lowercase + diacritic strip).
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export interface CategorySuggestion {
  category: PayableCategory;
  confidence: number; // 0..1
  matched_keyword: string;
}

/**
 * Başlık + opsiyonel ek alan (supplier_name, notes) üzerinden kategori öner.
 * Birden fazla aday varsa: en uzun kelime + en fazla token eşleşmesi kazanır.
 */
export function suggestCategory(
  title: string,
  ...extras: (string | null | undefined)[]
): CategorySuggestion | null {
  const text = normalize([title, ...extras].filter(Boolean).join(' '));
  if (!text) return null;

  let best: CategorySuggestion | null = null;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<[
    PayableCategory,
    string[],
  ]>) {
    for (const kw of keywords) {
      const nkw = normalize(kw);
      if (text.includes(nkw)) {
        const confidence = Math.min(1, nkw.length / 12); // uzun keyword → yüksek confidence
        if (!best || confidence > best.confidence) {
          best = { category: cat, confidence, matched_keyword: kw };
        }
      }
    }
  }
  return best;
}
