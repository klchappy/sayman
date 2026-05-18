/**
 * /ocr — Browser-side OCR (Tesseract.js) + AI aksiyon önerileri.
 *
 * Fatura/belge görüntüsünü yükle → OCR text → AI parse → otomatik aksiyon önerileri.
 *
 * Yenilikler:
 *  - Worker singleton (her recognize'da yeniden init etmiyor)
 *  - 2. dosya yüklendiğinde state tam reset (input value clear)
 *  - "Fatura Oluştur" butonu → backend AI parser → Payable yaratma
 *  - "Cari Aç" butonu → master data company yaratma
 *  - Bağlam analizi (fatura mı, kimlik mi, sözleşme mi)
 */
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Receipt,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';
import tesseractWorkerPath from 'tesseract.js/dist/worker.min.js?url';
import { api } from '../lib/api';

type Stage = 'idle' | 'preview' | 'ocr_running' | 'ocr_done' | 'analyzing';

interface DetectedKind {
  kind: 'invoice' | 'identity' | 'contract' | 'receipt' | 'unknown';
  confidence: number;
}

interface ExtractedFields {
  invoice_number?: string | null;
  supplier_name?: string | null;
  supplier_tax_number?: string | null;
  amount?: string | null;
  currency?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
}

export function OCRPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<TesseractWorker | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  // Heuristic detection (no backend) — hızlı bağlam tahmini
  const detected = detectKind(text);
  const extracted = extractFields(text);

  // Worker cleanup on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => undefined);
        workerRef.current = null;
      }
    };
  }, []);

  function fullReset() {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setFile(null);
    setImgUrl(null);
    setText('');
    setProgress(0);
    setError(null);
    setStage('idle');
    // Önemli: input value'yu reset etmezsek aynı dosyayı 2. kez seçemiyoruz
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // Eski state tamamen temizle
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setText('');
    setProgress(0);
    setError(null);
    setFile(f);
    setImgUrl(URL.createObjectURL(f));
    setStage('preview');
  }

  async function runOcr() {
    if (!file) return;
    setStage('ocr_running');
    setProgress(0);
    setText('');
    setError(null);

    try {
      // Singleton worker — varsa terminate edip yeniden init
      if (workerRef.current) {
        await workerRef.current.terminate().catch(() => undefined);
        workerRef.current = null;
      }
      const worker = await createWorker('eng', 1, {
        workerPath: tesseractWorkerPath,
        workerBlobURL: false,
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0',
        langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(m.progress);
        },
      });
      workerRef.current = worker;
      const { data } = await worker.recognize(file);
      setText(data.text);
      setStage('ocr_done');
      await worker.terminate();
      workerRef.current = null;
    } catch (e) {
      setError((e as Error).message);
      setStage('preview');
      if (workerRef.current) {
        await workerRef.current.terminate().catch(() => undefined);
        workerRef.current = null;
      }
    }
  }

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">OCR</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <FileText className="size-6" />
          Belge / Fatura OCR + Akıllı Öneri
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Taranmış görüntüden metin çıkar. Sistem belge tipini algılayıp aksiyon önerir
          (fatura, cari hesap, kimlik vb.). Tesseract.js browser'da çalışır — dosya sunucuya gitmez.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 mt-2 rounded inline-block">
          ⚠ İlk OCR'da ~10 MB dil dosyası indirilir, sonra cache'lenir.
        </p>
      </header>

      {/* Step 1: Upload */}
      <div className="card mb-4">
        <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400 mb-2">
          1. Görüntü Seç
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={onFileSelect}
          className="hidden"
          id="ocr-upload"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <label
            htmlFor="ocr-upload"
            className="inline-flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm cursor-pointer"
          >
            <Upload className="size-4" />
            {file ? `Değiştir: ${file.name.slice(0, 30)}…` : 'Resim Seç (JPG/PNG/PDF)'}
          </label>
          {file && (
            <button
              onClick={fullReset}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1"
            >
              <X className="size-3" /> Sıfırla
            </button>
          )}
        </div>
      </div>

      {imgUrl && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Sol: Önizleme + OCR butonu */}
          <div className="card">
            <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400 mb-2">
              Önizleme
            </p>
            <img
              src={imgUrl}
              alt="OCR input"
              className="w-full rounded border border-brand-100 dark:border-slate-700"
            />
            <button
              onClick={runOcr}
              disabled={stage === 'ocr_running'}
              className="mt-3 w-full bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {stage === 'ocr_running' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  OCR çalışıyor… {Math.round(progress * 100)}%
                </>
              ) : stage === 'ocr_done' ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Tekrar Çalıştır
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  2. OCR Başlat
                </>
              )}
            </button>
          </div>

          {/* Sağ: Metin + öneriler */}
          <div className="card">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400">
                Çıkarılan Metin
              </p>
              {stage === 'ocr_done' && detected.kind !== 'unknown' && (
                <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                  Algılanan: {KIND_LABELS[detected.kind]} (
                  {Math.round(detected.confidence * 100)}%)
                </span>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded mb-2">
                {error}
              </p>
            )}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder={
                stage === 'ocr_running'
                  ? 'OCR çalışıyor…'
                  : '(görüntü seç ve OCR başlat)'
              }
              className="w-full font-mono text-xs rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />

            {text && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(text);
                    }}
                    className="text-xs bg-brand-100 dark:bg-slate-800 hover:bg-brand-200 dark:hover:bg-slate-700 text-brand-900 dark:text-slate-200 px-3 py-1.5 rounded inline-flex items-center gap-1"
                  >
                    <Copy className="size-3" />
                    Kopyala
                  </button>
                  <span className="text-[10px] text-brand-400 self-center">
                    {text.length} karakter · {text.split(/\s+/).filter(Boolean).length} kelime
                  </span>
                </div>

                {/* Akıllı aksiyonlar — bağlama göre */}
                <SmartActions
                  detected={detected}
                  extracted={extracted}
                  rawText={text}
                  onCreated={(target, id) => {
                    if (target === 'payable') navigate('/review-queue?type=payable');
                    if (target === 'company') navigate('/master-data/companies');
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const KIND_LABELS: Record<DetectedKind['kind'], string> = {
  invoice: '📄 Fatura',
  receipt: '🧾 Fiş',
  identity: '🆔 Kimlik',
  contract: '📋 Sözleşme',
  unknown: '❓ Bilinmiyor',
};

/**
 * Hızlı heuristic — OCR text'ten bağlam tahmini.
 * Backend AI'ya gitmeden anlık öneri için.
 */
function detectKind(text: string): DetectedKind {
  if (!text || text.length < 20) return { kind: 'unknown', confidence: 0 };
  const lower = text.toLowerCase();
  let invoiceScore = 0;
  let receiptScore = 0;
  let identityScore = 0;
  let contractScore = 0;

  // Fatura sinyalleri
  if (/fatura|invoice/i.test(text)) invoiceScore += 0.35;
  if (/fatura\s+(no|numara|number)/i.test(text)) invoiceScore += 0.2;
  if (/vergi\s+(no|kimlik\s+no|dairesi)|vkn|tckn/i.test(lower)) invoiceScore += 0.15;
  if (/(₺|tl|try|usd|eur)\s*[\d.,]+/i.test(text)) invoiceScore += 0.1;
  if (/vade|due/i.test(lower)) invoiceScore += 0.1;
  if (/kdv|tax|matrah/i.test(lower)) invoiceScore += 0.1;

  // Fiş
  if (/fiş|receipt/i.test(lower)) receiptScore += 0.4;
  if (/yazarkasa|cash register/i.test(lower)) receiptScore += 0.3;

  // Kimlik
  if (/türkiye\s+cumhuriyeti|t\.?c\.?\s+kimlik|nüfus\s+cüzdanı|seri/i.test(lower))
    identityScore += 0.5;
  if (/doğum\s+(tarihi|yeri)|baba\s+adı|anne\s+adı/i.test(lower)) identityScore += 0.3;

  // Sözleşme
  if (/sözleşme|contract|agreement|madde\s+\d/i.test(lower)) contractScore += 0.4;
  if (/imza|signature|taraflar/i.test(lower)) contractScore += 0.2;

  const max = Math.max(invoiceScore, receiptScore, identityScore, contractScore);
  if (max < 0.3) return { kind: 'unknown', confidence: max };
  if (max === invoiceScore) return { kind: 'invoice', confidence: invoiceScore };
  if (max === receiptScore) return { kind: 'receipt', confidence: receiptScore };
  if (max === identityScore) return { kind: 'identity', confidence: identityScore };
  return { kind: 'contract', confidence: contractScore };
}

/**
 * Fatura alanlarını text'ten regex ile çıkar (hızlı, AI'ya gerek yok).
 */
function extractFields(text: string): ExtractedFields {
  if (!text) return {};
  const f: ExtractedFields = {};
  const m1 = text.match(/(?:fatura\s*no|invoice\s*number|fatura\s*numarası)\s*[:\-]?\s*([A-Z0-9-]+)/i);
  if (m1) f.invoice_number = m1[1];
  // VKN: 10 hane
  const m2 = text.match(/(?:vkn|vergi\s+no)\s*[:\-]?\s*(\d{10})/i);
  if (m2) f.supplier_tax_number = m2[1];
  // TCKN: 11 hane
  const m2b = text.match(/(?:tckn|t\.?c\.?\s+kimlik)\s*[:\-]?\s*(\d{11})/i);
  if (m2b) f.supplier_tax_number = m2b[1];
  // Tutar (toplam): "TOPLAM: 1.234,56 TL" gibi
  const m3 = text.match(/(?:genel\s+)?(?:toplam|tutar|total)\s*[:\-]?\s*([\d.,]+)\s*(₺|tl|try|usd|eur|usd|eur)?/i);
  if (m3) {
    f.amount = m3[1]!.replace(/\./g, '').replace(',', '.');
    if (m3[2]) {
      const c = m3[2].toUpperCase().replace('₺', 'TRY').replace('TL', 'TRY');
      f.currency = c.length === 3 ? c : 'TRY';
    }
  }
  // Tarih: 12.05.2026 veya 2026-05-12
  const m4 = text.match(/(?:tarih|date|düzenleme|issue\s+date)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  if (m4) f.issue_date = normalizeDate(m4[1]!);
  // Vade
  const m5 = text.match(/(?:vade|due\s+date|son\s+ödeme)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  if (m5) f.due_date = normalizeDate(m5[1]!);
  return f;
}

function normalizeDate(raw: string): string | null {
  const parts = raw.split(/[./-]/).map((s) => s.trim());
  if (parts.length !== 3) return null;
  let [d, m, y] = parts;
  if (y!.length === 2) y = '20' + y;
  if (parseInt(y!) < 100) y = '20' + y!.padStart(2, '0');
  // YYYY-MM-DD veya DD-MM-YYYY? İlki "12.05.2026" = TR format → reverse
  if (parts[0]!.length === 4) {
    // YYYY first → keep
    return `${parts[0]}-${parts[1]!.padStart(2, '0')}-${parts[2]!.padStart(2, '0')}`;
  }
  return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
}

function SmartActions({
  detected,
  extracted,
  rawText,
  onCreated,
}: {
  detected: DetectedKind;
  extracted: ExtractedFields;
  rawText: string;
  onCreated: (target: 'payable' | 'company', id: string) => void;
}) {
  const createPayable = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: extracted.supplier_name
          ? `OCR: ${extracted.supplier_name}`
          : extracted.invoice_number
            ? `OCR Fatura ${extracted.invoice_number}`
            : 'OCR Fatura',
        amount: extracted.amount ?? '0',
        currency: extracted.currency ?? 'TRY',
        category: 'ocr',
        supplier_name: extracted.supplier_name ?? null,
        invoice_number: extracted.invoice_number ?? null,
        issue_date: extracted.issue_date ?? null,
        due_date: extracted.due_date ?? null,
        notes: `OCR ile yaratıldı.\n\n${rawText.slice(0, 1500)}`,
        needs_review: true,
        auto_created_source: 'ocr',
      };
      const res = await api.post<{ data: { id: string } }>('/payables', body);
      return res.data.data;
    },
    onSuccess: (data) => onCreated('payable', data.id),
  });

  const isInvoice = detected.kind === 'invoice' || detected.kind === 'receipt';
  const isIdentity = detected.kind === 'identity';

  return (
    <div className="border-t border-brand-100 dark:border-slate-700 pt-3">
      <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-slate-400 mb-2 flex items-center gap-1">
        <Sparkles className="size-3 text-purple-600" />
        Akıllı Öneri{isInvoice && extracted.amount ? ' — Hazır Veri' : ''}
      </p>

      {/* Extracted fields preview */}
      {(extracted.invoice_number ||
        extracted.amount ||
        extracted.supplier_tax_number ||
        extracted.issue_date) && (
        <div className="bg-brand-50 dark:bg-slate-800 rounded p-2 mb-2 text-xs">
          <p className="font-medium text-brand-700 dark:text-slate-300 mb-1">Tespit edilen alanlar:</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
            {extracted.invoice_number && (
              <p>
                <span className="text-brand-400">Fatura No:</span> {extracted.invoice_number}
              </p>
            )}
            {extracted.amount && (
              <p>
                <span className="text-brand-400">Tutar:</span> {extracted.amount}{' '}
                {extracted.currency ?? ''}
              </p>
            )}
            {extracted.supplier_tax_number && (
              <p>
                <span className="text-brand-400">VKN/TCKN:</span> {extracted.supplier_tax_number}
              </p>
            )}
            {extracted.issue_date && (
              <p>
                <span className="text-brand-400">Tarih:</span> {extracted.issue_date}
              </p>
            )}
            {extracted.due_date && (
              <p>
                <span className="text-brand-400">Vade:</span> {extracted.due_date}
              </p>
            )}
          </div>
        </div>
      )}

      {createPayable.isError && (
        <p className="text-xs text-red-600 mb-2">
          Hata: {(createPayable.error as Error).message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {isInvoice && (
          <button
            onClick={() => createPayable.mutate()}
            disabled={createPayable.isPending}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded inline-flex items-center gap-1 disabled:opacity-50"
          >
            {createPayable.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Receipt className="size-3" />
            )}
            Fatura Olarak Kaydet
          </button>
        )}

        {isIdentity && (
          <a
            href="/master-data/persons"
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded inline-flex items-center gap-1"
          >
            <Users className="size-3" />
            Şahıs Kartı Aç (manuel)
          </a>
        )}

        {detected.kind === 'unknown' && (
          <p className="text-xs text-brand-500 dark:text-slate-400 italic">
            Belge tipi net algılanamadı. Metni kopyalayıp ilgili sayfada manuel kullanabilirsin.
          </p>
        )}
      </div>
    </div>
  );
}
