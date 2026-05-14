/**
 * /ocr — Browser-side OCR (Tesseract.js).
 *
 * Fatura/belge görüntüsünü yükle → Tesseract Türkçe + İngilizce OCR → text çıkar.
 * Kullanıcı text'i kopyalayıp manual fatura form'una yapıştırabilir.
 *
 * Sunucu-side değil — Tesseract.js WebAssembly worker browser'da çalışır.
 * Avantaj: Dosyalar Sayman sunucusuna gitmez, gizlilik artar.
 * Dezavantaj: İlk yüklemede ~10MB lang data indirir, sonra cache'lenir.
 */
import { FileText, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { createWorker } from 'tesseract.js';

export function OCRPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setText('');
    setError(null);
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setImgUrl(URL.createObjectURL(f));
  }

  async function runOcr() {
    if (!file) return;
    setRunning(true);
    setProgress(0);
    setText('');
    setError(null);
    try {
      const worker = await createWorker(['tur', 'eng'], 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(m.progress);
        },
      });
      const { data } = await worker.recognize(file);
      setText(data.text);
      await worker.terminate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setFile(null);
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setImgUrl(null);
    setText('');
    setProgress(0);
    setError(null);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">OCR</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <FileText className="size-6" />
          Belge / Fatura OCR
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Taranmış fatura görüntüsünden metin çıkar. Tesseract.js (Türkçe+İngilizce) browser'da
          çalışır — dosya sunucuya gitmez.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 mt-2 rounded inline-block">
          ⚠️ İlk OCR'da ~10 MB dil dosyası indirilir, sonraki sayfa yüklemelerinde cache.
        </p>
      </header>

      <div className="card mb-4">
        <p className="text-xs uppercase tracking-wide text-brand-500 mb-2">1. Görüntü Seç</p>
        <input
          type="file"
          accept="image/*"
          onChange={onFileSelect}
          className="hidden"
          id="ocr-upload"
        />
        <label
          htmlFor="ocr-upload"
          className="inline-flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm cursor-pointer"
        >
          <Upload className="size-4" />
          {file ? `Değiştir (${file.name})` : 'Resim Seç (JPG/PNG)'}
        </label>
        {file && (
          <button
            onClick={reset}
            className="ml-2 text-red-600 hover:bg-red-50 p-2 rounded-lg text-sm"
          >
            <X className="inline size-3" /> Temizle
          </button>
        )}
      </div>

      {imgUrl && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <p className="text-xs uppercase tracking-wide text-brand-500 mb-2">Önizleme</p>
            <img
              src={imgUrl}
              alt="OCR input"
              className="w-full rounded border border-brand-100"
            />
            <button
              onClick={runOcr}
              disabled={running}
              className="mt-3 w-full bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {running ? `OCR çalışıyor… ${Math.round(progress * 100)}%` : '2. OCR Başlat'}
            </button>
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-wide text-brand-500 mb-2">
              Çıkarılan Metin
            </p>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded mb-2">{error}</p>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={20}
              placeholder={running ? 'OCR çalışıyor…' : '(henüz çıktı yok)'}
              className="w-full font-mono text-xs rounded-lg border border-brand-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {text && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(text);
                    alert('Metin kopyalandı');
                  }}
                  className="text-xs bg-brand-200 hover:bg-brand-300 text-brand-900 px-3 py-1.5 rounded"
                >
                  Kopyala
                </button>
                <span className="text-xs text-brand-400 self-center">
                  {text.length} karakter
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
