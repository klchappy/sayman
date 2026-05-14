/**
 * PDF tasarım yardımcıları — pdfkit üzerine ortak header/footer/section/table.
 * AI-friendly: doc.info'ya structured metadata gömülür (Subject = JSON).
 */
import type PDFDocument from 'pdfkit';

export const PDF_BRAND = '#0a2540';
export const PDF_ACCENT = '#3b82f6';
export const PDF_MUTED = '#6b7280';
export const PDF_LIGHT = '#e5e7eb';
export const PDF_BG = '#f9fafb';

export function fmtTRY(v: string | number | null | undefined): string {
  if (v == null) return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  if (isNaN(n)) return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Tüm Sayman PDF'lerinde ortak header bandı.
 * Sol: Sayman logo (gradient), sağ: tenant + tarih.
 */
export function drawPdfHeader(
  doc: PDFKit.PDFDocument,
  opts: {
    title: string;
    subtitle?: string;
    tenantName?: string;
    docDate?: Date;
  },
) {
  // Top brand bar
  doc.rect(0, 0, doc.page.width, 90).fill(PDF_BRAND);

  // Logo: kare içinde "Sy" + ad
  doc
    .roundedRect(40, 25, 40, 40, 6)
    .fillColor('#ffffff')
    .fillOpacity(0.15)
    .fill();
  doc.fillOpacity(1).fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('Sy', 50, 35);

  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('Sayman', 90, 30);
  doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text('Muhasebe Operasyon', 90, 52);

  // Sağ üst: tenant + tarih
  if (opts.tenantName) {
    doc
      .fillColor('#ffffff')
      .fontSize(10)
      .font('Helvetica')
      .text(opts.tenantName, 0, 30, { width: doc.page.width - 40, align: 'right' });
  }
  doc
    .fillColor('#cbd5e1')
    .fontSize(9)
    .text(
      (opts.docDate ?? new Date()).toLocaleString('tr-TR'),
      0,
      52,
      { width: doc.page.width - 40, align: 'right' },
    );

  // Title bandı (beyaz arka plan üzerinde)
  doc
    .fillColor(PDF_BRAND)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(opts.title, 50, 110);

  if (opts.subtitle) {
    doc
      .fillColor(PDF_MUTED)
      .fontSize(11)
      .font('Helvetica')
      .text(opts.subtitle, 50, 138);
  }

  // İnce ayırıcı çizgi
  doc
    .moveTo(50, opts.subtitle ? 165 : 145)
    .lineTo(doc.page.width - 50, opts.subtitle ? 165 : 145)
    .strokeColor(PDF_LIGHT)
    .lineWidth(0.5)
    .stroke();

  doc.y = opts.subtitle ? 180 : 160;
}

export function drawPdfFooter(doc: PDFKit.PDFDocument, pageNumber = 1) {
  const y = doc.page.height - 50;
  doc
    .moveTo(50, y)
    .lineTo(doc.page.width - 50, y)
    .strokeColor(PDF_LIGHT)
    .lineWidth(0.5)
    .stroke();

  doc
    .fillColor(PDF_MUTED)
    .fontSize(8)
    .font('Helvetica')
    .text(
      'Sayman · sayman.deploi.net',
      50,
      y + 8,
      { width: 200, align: 'left' },
    );

  doc.text(`Sayfa ${pageNumber}`, doc.page.width - 100, y + 8, { width: 50, align: 'right' });

  doc.text(
    `Otomatik üretildi · ${new Date().toLocaleString('tr-TR')}`,
    0,
    y + 22,
    { width: doc.page.width, align: 'center' },
  );
}

/**
 * Key-value satır çizer (label sol, value sağ).
 */
export function drawKV(
  doc: PDFKit.PDFDocument,
  key: string,
  value: string,
  opts: { labelWidth?: number; bold?: boolean } = {},
) {
  const y = doc.y;
  doc
    .fillColor(PDF_MUTED)
    .fontSize(9)
    .font('Helvetica')
    .text(key.toUpperCase(), 50, y, { width: opts.labelWidth ?? 150 });
  doc
    .fillColor(PDF_BRAND)
    .fontSize(11)
    .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .text(value, (opts.labelWidth ?? 150) + 60, y, {
      width: doc.page.width - (opts.labelWidth ?? 150) - 110,
    });
  doc.y = y + 22;
}

/**
 * Section başlığı — alternating background + padding.
 */
export function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.y += 10;
  const y = doc.y;
  doc.rect(50, y - 4, doc.page.width - 100, 22).fill(PDF_BG);
  doc.fillColor(PDF_BRAND).fontSize(11).font('Helvetica-Bold').text(title, 60, y + 1);
  doc.y = y + 28;
}

/**
 * AI-friendly metadata: PDF Info dictionary'ye JSON özet göm.
 * Subject field'ı genelde 200 char limitsiz; JSON sıkıştırılmış olarak verilir.
 */
export function setAiMetadata(
  doc: PDFKit.PDFDocument,
  data: {
    title: string;
    docType: string;
    organization?: string;
    tenant?: string;
    structured: Record<string, unknown>;
  },
) {
  const info = doc.info;
  info.Title = data.title;
  info.Author = 'Sayman';
  info.Subject = data.docType;
  // Keywords: arama ipuçları (AI tarayıcılar için)
  const keywords = [
    'sayman',
    'sayman.deploi.net',
    data.docType,
    data.organization ?? '',
    data.tenant ?? '',
  ]
    .filter(Boolean)
    .join(', ');
  info.Keywords = keywords;
  // Producer
  info.Producer = 'Sayman PDF Engine 0.1';
  info.Creator = 'Sayman API';
  // CreationDate
  info.CreationDate = new Date();

  // AI-friendly JSON: gizli annotation olarak ek metin sayfaya görünmeden eklenir
  // PDFKit pdf-lib gibi annotation API'sini desteklemediği için
  // son sayfaya görünmez (renk = beyaz) JSON satırı bırakırız
  // (PDF parser tools text extractor JSON'u görür).
  const jsonStr = JSON.stringify({
    sayman_ai: true,
    doc_type: data.docType,
    organization: data.organization,
    tenant: data.tenant,
    generated_at: new Date().toISOString(),
    data: data.structured,
  });
  // Görünmez metin — son sayfaya beyaz renkte
  doc.save();
  doc
    .fillColor('#ffffff')
    .fontSize(1)
    .text(`<!--SAYMAN_AI_META:${jsonStr}-->`, 50, doc.page.height - 10);
  doc.restore();
}
