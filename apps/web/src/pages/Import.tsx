import { AlertCircle, CheckCircle2, FileUp, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Dropzone } from '../components/Dropzone';
import { ImportAnimation, type ImportStage } from '../components/ImportAnimation';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export function ImportPage() {
  const me = useAuth((s) => s.me);
  const active = useAuth((s) => s.active);
  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canImport = ['super_admin', 'organization_admin', 'yonetici', 'muhasebeci'].includes(role ?? '');

  if (!canImport) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-red-700 font-medium">Yetkin yok</p>
          <p className="text-sm text-brand-500 mt-1">
            Import için super_admin / organization_admin / yonetici / muhasebeci rolü gerekli.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Akıllı Yükleme</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <FileUp className="size-6" />
          Import Center
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Dosyayı sürükle — Sayman dosya tipini otomatik tespit edip içeriğini doğru tabloya kaydeder
          (e-Fatura XML / ZIP / CSV / XLSX). Tedarikçi yoksa otomatik açılır.
        </p>
      </header>

      <SmartImportSection />
    </div>
  );
}


// --- Smart Import Section (preview + commit) --------------------------------

interface SmartPreview {
  type: string;
  action: 'preview' | 'imported' | 'skipped_duplicate';
  filename: string;
  parsed?: any;
  hint?: string;
  format?: string;
  row_count?: number;
  headers?: string[];
  detected_resource?: string | null;
  valid_count?: number;
  invalid_count?: number;
  preview_rows?: unknown[];
  errors?: Array<{ row: number; error: string; data?: unknown }>;
  xml_count?: number;
  other_count?: number;
  xml_files?: Array<{ name: string }>;
  other_files?: Array<{ name: string; ext: string }>;
  batch_limit?: number;
  will_truncate?: boolean;
  mime?: string;
  size_bytes?: number;
  /** Preview→commit hash key — commit'te dosyayı tekrar göndermek yerine bu key yeterli */
  cache_key?: string;
}

interface SmartImportResult {
  type: string;
  action: 'imported' | 'skipped_duplicate';
  filename: string;
  message: string;
  parsed?: any;
  payable?: { id: string; title: string };
  supplier_resolution?: {
    id: string;
    is_new: boolean;
    needs_review: boolean;
    matched_by?: string;
  } | null;
  /** Fatura hangi tenant'a yazıldı (auto-routing nedeniyle aktiften farklı olabilir) */
  tenant_routing?: {
    tenantId: string;
    isAutoMatched: boolean;
    mismatch: boolean;
  };
  resource?: string;
  inserted?: number;
  inserted_ids?: string[];
  new_suppliers?: number;
  invalid_count?: number;
  errors?: Array<{ row: number; error: string }>;
  success?: number;
  duplicates?: number;
  failed?: number;
  xml_count?: number;
  processed?: number;
  truncated?: boolean;
  truncated_count?: number;
  results?: Array<{
    file: string;
    ok: boolean;
    invoice_number?: string;
    payable_id?: string;
    supplier_new?: boolean;
    error?: string;
  }>;
}

function SmartImportSection() {
  const active = useAuth((s) => s.active);
  const isAdmin = useAuth((s) => s.isAdmin());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SmartPreview | null>(null);
  const [imported, setImported] = useState<SmartImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ImportStage>('idle');

  function reset() {
    setFile(null);
    setPreview(null);
    setImported(null);
    setError(null);
    setStage('idle');
  }

  async function onFile(picked: File) {
    setFile(picked);
    setPreview(null);
    setImported(null);
    setError(null);
    setStage('uploading');
    try {
      const fd = new FormData();
      fd.append('file', picked);
      // Kısa görsel pause — kullanıcı stage transition'ı görsün
      await new Promise((r) => setTimeout(r, 400));
      setStage('analyzing');
      const res = await api.post<{ data: SmartPreview }>('/smart-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data.data);
      setStage('idle');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
      setStage('idle');
    }
  }

  async function commitImport() {
    if (!file) return;
    setError(null);
    setStage('importing');
    try {
      // Preview'den dönen cache_key ile commit yapılırsa dosya tekrar yüklenmez.
      // Cache expire ettiyse (5 dk TTL) backend 410 döner → file ile retry et.
      const cacheKey = preview?.cache_key;
      const post = async (useCache: boolean) => {
        if (useCache && cacheKey) {
          return api.post<{ data: SmartImportResult }>('/smart-import?commit=true', {
            cache_key: cacheKey,
          });
        }
        const fd = new FormData();
        fd.append('file', file);
        return api.post<{ data: SmartImportResult }>('/smart-import?commit=true', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      };

      let res;
      try {
        res = await post(true);
      } catch (e) {
        const err = e as { response?: { status?: number; data?: { code?: string } } };
        if (err.response?.status === 410 || err.response?.data?.code === 'CACHE_EXPIRED') {
          // Cache TTL doldu → dosyayı tekrar yükle
          res = await post(false);
        } else {
          throw e;
        }
      }

      setStage('success');
      await new Promise((r) => setTimeout(r, 700));
      setImported(res.data.data);
      setPreview(null);
      setStage('idle');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
      setStage('idle');
    }
  }

  // Adminler için tenant bypass — ProtectedRoute zaten ilk tenant'ı otomatik seçiyor
  // ama hala seçilmediyse adminlere "yükleniyor" göster, normal kullanıcıya uyarı
  if (!active.tenantSlug && !isAdmin) {
    return (
      <div className="card text-center">
        <p className="text-amber-700 text-sm">Tenant seçilmedi. Üst köşeden bir tenant seç.</p>
      </div>
    );
  }
  if (!active.tenantSlug && isAdmin) {
    return (
      <div className="card text-center">
        <p className="text-brand-500 text-sm">Tenant yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2 mb-1">
          <Sparkles className="size-5" />
          Akıllı Yükleme — Önizle ve İçeriye Aktar
        </h2>
        <p className="text-sm text-brand-500 dark:text-slate-400">
          Dosya at → Sayman analiz edip önizleme verir → onayladığında ilgili yere kayıt eder.
          Sistemde olmayan tedarikçi varsa otomatik oluşturulur ve "doğrulama" listesine düşer.
        </p>
      </div>

      {!file && !imported && stage === 'idle' && (
        <Dropzone
          accept=".csv,.xlsx,.xls,.xml,.zip,.pdf,.jpg,.jpeg,.png,.webp"
          label="Dosya sürükle bırak veya seç (CSV/XLSX/XML/ZIP/PDF/IMG)"
          hint="Maks 30 MB · XML/ZIP→e-Fatura · CSV/XLSX→fatura/cari/abone vs. · tedarikçi yoksa otomatik açılır"
          onFile={onFile}
        />
      )}

      {file && (preview || imported) && stage === 'idle' && (
        <div className="flex items-center justify-between bg-brand-50 dark:bg-slate-800 rounded-lg p-3 mb-3">
          <span className="text-sm">
            📎 <strong>{file.name}</strong>{' '}
            <span className="text-brand-500 dark:text-slate-400">
              ({Math.round(file.size / 1024)} KB)
            </span>
          </span>
          <button
            onClick={reset}
            className="text-xs text-red-600 hover:underline flex items-center gap-1"
          >
            <X className="size-3" />
            Temizle
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Yükleme / analiz / aktarma animasyonu */}
      <ImportAnimation stage={stage} filename={file?.name} />

      {preview && !imported && stage === 'idle' && (
        <PreviewPanel preview={preview} onCommit={commitImport} committing={false} />
      )}

      {imported && stage === 'idle' && <ImportResultPanel result={imported} onAgain={reset} />}
    </div>
  );
}

function PreviewPanel({
  preview,
  onCommit,
  committing,
}: {
  preview: SmartPreview;
  onCommit: () => void;
  committing: boolean;
}) {
  let canCommit = false;
  let summary = '';

  if (preview.type === 'efatura_xml' && preview.parsed) {
    canCommit = true;
    summary = `e-Fatura tespit edildi · ${preview.parsed.invoice_number} · ${preview.parsed.amount} ${preview.parsed.currency ?? 'TRY'}`;
  } else if (preview.type === 'zip') {
    canCommit = (preview.xml_count ?? 0) > 0;
    summary = `ZIP içinde ${preview.xml_count ?? 0} e-Fatura XML bulundu`;
  } else if (preview.type === 'tabular' && preview.detected_resource) {
    canCommit = (preview.valid_count ?? 0) > 0;
    summary = `${preview.detected_resource} tespit edildi · ${preview.valid_count}/${preview.row_count} satır geçerli`;
  } else if (preview.type === 'tabular') {
    summary = 'Tablo formatı tespit edildi ama tipi belirlenemedi. Resource\'u elle "CSV/XLSX Toplu" sekmesinden seç.';
  } else if (preview.type === 'document') {
    summary = 'PDF/görsel dosya. Bu sekmeden değil, ilgili fatura/teminat detayına eklenmelidir.';
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="card bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2">
          <Sparkles className="size-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-blue-900 dark:text-blue-200">{summary}</p>
            {preview.hint && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{preview.hint}</p>
            )}
          </div>
        </div>
      </div>

      {preview.type === 'efatura_xml' && preview.parsed && (
        <EfaturaPreview parsed={preview.parsed} />
      )}
      {preview.type === 'tabular' && <TabularPreview preview={preview} />}
      {preview.type === 'zip' && <ZipPreview preview={preview} />}

      {canCommit && (
        <div className="flex items-center gap-2 sticky bottom-2 bg-white dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg p-3 shadow-lg">
          <button
            onClick={onCommit}
            disabled={committing}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {committing ? (
              <>
                <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                İçeriye Aktarılıyor…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                İçeriye Aktar (Onayla ve Kaydet)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function EfaturaPreview({ parsed }: { parsed: any }) {
  return (
    <div className="card">
      <h3 className="font-medium mb-3 text-brand-900 dark:text-slate-100">Fatura Detayı</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-brand-500 dark:text-slate-400">Fatura No</dt>
        <dd className="font-mono font-semibold">{parsed.invoice_number}</dd>
        <dt className="text-brand-500 dark:text-slate-400">Düzenleme</dt>
        <dd className="font-mono">{parsed.issue_date ?? '-'}</dd>
        <dt className="text-brand-500 dark:text-slate-400">Vade</dt>
        <dd className="font-mono">{parsed.due_date ?? '-'}</dd>
        <dt className="text-brand-500 dark:text-slate-400">Tedarikçi</dt>
        <dd className="font-medium">{parsed.supplier_name ?? '-'}</dd>
        <dt className="text-brand-500 dark:text-slate-400">VKN/TCKN</dt>
        <dd className="font-mono">{parsed.supplier_tax_number ?? '-'}</dd>
        <dt className="text-brand-500 dark:text-slate-400">Tutar</dt>
        <dd className="font-mono font-semibold text-lg text-emerald-700 dark:text-emerald-400">
          {Number(parsed.amount).toLocaleString('tr-TR', {
            style: 'currency',
            currency: parsed.currency ?? 'TRY',
          })}
        </dd>
        {parsed.profile_id && (
          <>
            <dt className="text-brand-500 dark:text-slate-400">Profil</dt>
            <dd className="font-mono text-xs">{parsed.profile_id}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function TabularPreview({ preview }: { preview: SmartPreview }) {
  return (
    <div className="card">
      <h3 className="font-medium mb-3 text-brand-900 dark:text-slate-100">Tablo Analizi</h3>
      <div className="grid sm:grid-cols-4 gap-3 mb-3 text-sm">
        <div>
          <span className="text-[10px] text-brand-400 uppercase">Format</span>
          <p className="font-mono">{preview.format}</p>
        </div>
        <div>
          <span className="text-[10px] text-brand-400 uppercase">Toplam</span>
          <p className="font-mono font-semibold">{preview.row_count}</p>
        </div>
        <div>
          <span className="text-[10px] text-brand-400 uppercase">Geçerli</span>
          <p className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
            {preview.valid_count}
          </p>
        </div>
        <div>
          <span className="text-[10px] text-brand-400 uppercase">Hatalı</span>
          <p
            className={`font-mono font-semibold ${
              (preview.invalid_count ?? 0) > 0 ? 'text-red-600' : 'text-brand-500'
            }`}
          >
            {preview.invalid_count}
          </p>
        </div>
      </div>
      {preview.detected_resource ? (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-2 text-xs text-emerald-800 dark:text-emerald-300">
          ✓ Resource tespit edildi:{' '}
          <strong className="font-mono">{preview.detected_resource}</strong>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-2 text-xs text-amber-800 dark:text-amber-300">
          ⚠ Resource otomatik tespit edilemedi. "CSV/XLSX Toplu" sekmesinden manuel seç.
        </div>
      )}
      {preview.headers && preview.headers.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-brand-600 dark:text-slate-400 cursor-pointer">
            Header'lar ({preview.headers.length})
          </summary>
          <div className="flex flex-wrap gap-1 mt-2">
            {preview.headers.map((h, i) => (
              <span
                key={i}
                className="text-[10px] font-mono bg-brand-50 dark:bg-slate-800 px-1.5 py-0.5 rounded"
              >
                {h}
              </span>
            ))}
          </div>
        </details>
      )}
      {preview.preview_rows && preview.preview_rows.length > 0 && (
        <details className="mt-2" open>
          <summary className="text-xs text-brand-600 dark:text-slate-400 cursor-pointer">
            İlk {preview.preview_rows.length} satır önizleme
          </summary>
          <pre className="text-[10px] font-mono bg-brand-50 dark:bg-slate-800 p-2 rounded mt-2 overflow-x-auto max-h-40">
            {JSON.stringify(preview.preview_rows, null, 2)}
          </pre>
        </details>
      )}
      {preview.errors && preview.errors.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-red-600 cursor-pointer">
            Hatalar ({preview.errors.length})
          </summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {preview.errors.slice(0, 20).map((e, i) => (
              <li key={i} className="text-[10px] bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
                <strong>Satır {e.row}:</strong> {e.error}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ZipPreview({ preview }: { preview: SmartPreview }) {
  const limit = preview.batch_limit ?? 100;
  const willTruncate = preview.will_truncate ?? false;
  return (
    <div className="card">
      <h3 className="font-medium mb-3 text-brand-900 dark:text-slate-100">ZIP İçeriği</h3>
      {willTruncate && (
        <div className="mb-3 p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <AlertCircle className="size-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Bu ZIP'te <strong>{preview.xml_count}</strong> XML var, fakat tek seferde en fazla{' '}
            <strong>{limit}</strong> fatura işlenir. İlk {limit} aktarılacak, geri kalan{' '}
            <strong>{(preview.xml_count ?? 0) - limit}</strong> XML işlenmeyecek. Eksik kalanları
            ayrı bir ZIP olarak tekrar yükle.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
        <div>
          <span className="text-[10px] text-brand-400 uppercase">e-Fatura XML</span>
          <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
            {preview.xml_count}
          </p>
        </div>
        <div>
          <span className="text-[10px] text-brand-400 uppercase">Diğer dosya</span>
          <p className="font-mono text-brand-500">{preview.other_count}</p>
        </div>
      </div>
      {preview.xml_files && preview.xml_files.length > 0 && (
        <details>
          <summary className="text-xs text-brand-600 dark:text-slate-400 cursor-pointer">
            XML dosyaları (ilk 50)
          </summary>
          <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
            {preview.xml_files.map((f, i) => (
              <li key={i} className="text-[10px] font-mono text-brand-700 dark:text-slate-300">
                📄 {f.name}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ImportResultPanel({
  result,
  onAgain,
}: {
  result: SmartImportResult;
  onAgain: () => void;
}) {
  return (
    <div className="mt-3 card bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
      <h3 className="font-semibold flex items-center gap-2 mb-2 text-brand-900 dark:text-slate-100">
        <CheckCircle2 className="size-5 text-emerald-600" />
        {result.action === 'skipped_duplicate' ? 'Zaten Kayıtlı' : 'İçeriye Aktarıldı'}
      </h3>
      <p className="text-sm text-brand-700 dark:text-slate-300 mb-2">{result.message}</p>

      {result.type === 'efatura_xml' && result.payable && (
        <div className="bg-white dark:bg-slate-900 rounded p-3 mb-2 text-sm space-y-2">
          <p className="font-medium text-brand-900 dark:text-slate-100">{result.payable.title}</p>
          {result.tenant_routing?.mismatch && (
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
              <p className="text-xs text-amber-900 dark:text-amber-200 font-medium mb-1">
                ⚠️ Fatura BAŞKA bir tenant'a yazıldı
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                e-Fatura'daki alıcı VKN'si, şu an aktif tenant'tan farklı bir tenant'la eşleşti.
                Fatura doğru tenant'a route edildi — listede görmek için üst köşeden o tenant'a
                geç veya{' '}
                <a href="/review-queue?scope=org" className="underline font-medium">
                  Onay Bekleyenler → Tüm Tenants
                </a>{' '}
                görünümünü kullan.
              </p>
            </div>
          )}
          <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
              📋 Fatura otomatik yaratıldı, onay bekliyor. Faturalar listesinde DEĞİL,{' '}
              <strong>Onay Bekleyenler</strong> sayfasında. Onayladıktan sonra Faturalar
              listesinde görünür.
            </p>
            <a
              href={result.tenant_routing?.mismatch ? '/review-queue?scope=org' : '/review-queue'}
              className="inline-flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium"
            >
              Onay Bekleyenler'e Git →
            </a>
          </div>
          {result.supplier_resolution?.is_new && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠ Yeni tedarikçi şirket de oluşturuldu (review queue'da)
            </p>
          )}
        </div>
      )}

      {result.type === 'tabular' && (
        <div className="bg-white dark:bg-slate-900 rounded p-3 text-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-brand-400 uppercase">Resource</p>
              <p className="font-mono">{result.resource}</p>
            </div>
            <div>
              <p className="text-[10px] text-brand-400 uppercase">Eklendi</p>
              <p className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                {result.inserted}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-brand-400 uppercase">Atlandı</p>
              <p className="font-mono text-amber-700">{result.invalid_count ?? 0}</p>
            </div>
          </div>
          {(result.new_suppliers ?? 0) > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
              ⚠ {result.new_suppliers} yeni tedarikçi otomatik oluşturuldu.{' '}
              <a href="/review-queue" className="underline font-medium">
                Doğrula →
              </a>
            </p>
          )}
        </div>
      )}

      {(result.type === 'zip' || result.type === 'rar') && (
        <div className="bg-white dark:bg-slate-900 rounded p-3 text-sm">
          {result.truncated && (
            <div className="mb-3 p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
              <AlertCircle className="size-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                UYARI: ZIP'te <strong>{result.xml_count}</strong> XML vardı, ilk{' '}
                <strong>{result.processed}</strong> işlendi.{' '}
                <strong>{result.truncated_count}</strong> XML batch limiti nedeniyle işlenmedi —
                geri kalanlar için yeni bir ZIP yükle.
              </p>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <p className="text-brand-400 uppercase">Toplam</p>
              <p className="font-mono font-semibold">
                {(result.success ?? 0) + (result.duplicates ?? 0) + (result.failed ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-emerald-600 uppercase">Eklendi</p>
              <p className="font-mono font-semibold text-emerald-700">{result.success}</p>
            </div>
            <div>
              <p className="text-amber-600 uppercase">Mükerrer</p>
              <p className="font-mono text-amber-700">{result.duplicates}</p>
            </div>
            <div>
              <p className="text-red-600 uppercase">Hata</p>
              <p className="font-mono text-red-700">{result.failed}</p>
            </div>
          </div>

          {/* Kritik bilgi: eklenen faturalar review queue'da bekliyor */}
          {(result.success ?? 0) > 0 && (
            <div className="mt-3 p-3 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-300 font-medium mb-2">
                📋 {result.success} fatura içeriye alındı ve <strong>Onay Bekleyenler</strong> sayfasına düştü.
                Otomatik yaratıldığı için tek tek onaylanmalı.
              </p>
              <a
                href="/review-queue"
                className="inline-flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium"
              >
                Onay Bekleyenler'e Git →
              </a>
            </div>
          )}

          {(result.new_suppliers ?? 0) > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              ⚠ {result.new_suppliers} yeni tedarikçi şirket otomatik oluşturuldu (review queue'da)
            </p>
          )}
          {result.results && (
            <details className="mt-3">
              <summary className="cursor-pointer text-brand-600 dark:text-slate-400">
                Detay (her dosya)
              </summary>
              <ul className="mt-2 space-y-0.5 text-[10px] max-h-60 overflow-y-auto">
                {result.results.map((r, i) => (
                  <li
                    key={i}
                    className={`px-2 py-1 rounded ${
                      r.ok && !r.error
                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                        : r.ok && r.error
                          ? 'bg-amber-50 dark:bg-amber-900/20'
                          : 'bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    {r.ok && !r.error ? '✓' : r.ok ? '⊙' : '✗'} <strong>{r.file}</strong>
                    {r.invoice_number && <> — {r.invoice_number}</>}
                    {r.error && <span className="text-red-600"> — {r.error}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <button
        onClick={onAgain}
        className="mt-3 text-sm text-brand-700 dark:text-slate-300 hover:underline"
      >
        ↺ Yeni dosya yükle
      </button>
    </div>
  );
}

