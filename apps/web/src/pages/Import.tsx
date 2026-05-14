import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, FileCode, FileUp, Sparkles, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { Dropzone } from '../components/Dropzone';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ResourceInfo {
  resource: string;
  scope: 'org' | 'tenant';
  description: string;
}

interface DryRunResult {
  resource: string;
  dry_run: true;
  total: number;
  valid: number;
  invalid: number;
  errors: Array<{ row: number; error: string; data?: unknown }>;
  preview: unknown[];
}

interface ConfirmResult {
  resource: string;
  dry_run: false;
  total: number;
  inserted: number;
  invalid: number;
  errors: Array<{ row: number; error: string; data?: unknown }>;
  inserted_ids: string[];
}

const SAMPLE_CSV: Record<string, string> = {
  persons: 'full_name,national_id,phone,family_group\nKaan Kılıç,12345678901,5551234567,kilic\nAyşe Yılmaz,98765432109,,',
  companies: 'name,short_name,tax_number,registry_number\nKılıç İnşaat A.Ş.,KIA,1234567890,SC-001\nDeneme Ltd.,DEN,9876543210,',
  properties: 'name,property_type,municipality,registry_number\nAcıbadem Daire 5,Daire,Üsküdar,A-12345\nKadıköy Ofis,İşyeri,Kadıköy,B-99999',
  payables:
    'title,amount,due_date,owner_type,supplier_name\nElektrik Faturası,1234.50,2026-06-15,company,Boğaziçi Elektrik\nİnternet,299.90,2026-06-01,company,Türk Telekom',
  subscriptions:
    'package_name,subscription_no,monthly_amount,start_date,commitment_end_date,auto_payment\nFiber 100,TT-12345,299.90,2026-01-15,2027-01-15,true',
  'regular-payments':
    'kind,title,monthly_amount,payment_day,start_date,annual_increase_rate\nrent,Beşiktaş Daire 3+1,15000,5,2026-01-01,25.00',
  guarantees:
    'beneficiary_name,letter_no,amount,issue_date,expiry_date,commission_rate,commission_frequency_months\nABC İnşaat A.Ş.,TM-2026-001,100000,2026-01-15,2027-01-15,2.50,3',
};

export function ImportPage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const [resource, setResource] = useState<string>('persons');
  const [csvText, setCsvText] = useState('');
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canImport = ['super_admin', 'organization_admin', 'yonetici', 'muhasebeci'].includes(role ?? '');

  const resourcesQ = useQuery({
    queryKey: ['import-resources'],
    queryFn: async () => {
      const res = await api.get<{ data: ResourceInfo[] }>('/import/resources');
      return res.data.data;
    },
  });

  const selectedResource = resourcesQ.data?.find((r) => r.resource === resource);
  const needsTenant = selectedResource?.scope === 'tenant';

  const [xlsxBase64, setXlsxBase64] = useState<string | null>(null);
  const [xlsxFilename, setXlsxFilename] = useState<string>('');

  function buildPayload(dryRun: boolean) {
    if (xlsxBase64) {
      return { format: 'xlsx', data: xlsxBase64, dry_run: dryRun };
    }
    return { format: 'csv', data: csvText, dry_run: dryRun };
  }

  const dryRun = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: DryRunResult }>(`/import/${resource}`, buildPayload(true));
      return res.data.data;
    },
    onSuccess: (data) => {
      setDryRunResult(data);
      setConfirmResult(null);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: ConfirmResult }>(`/import/${resource}`, buildPayload(false));
      return res.data.data;
    },
    onSuccess: (data) => {
      setConfirmResult(data);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  function readFile(file: File) {
    setXlsxFilename(file.name);
    setDryRunResult(null);
    setConfirmResult(null);
    setError(null);
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('sheet');
    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buf = ev.target?.result as ArrayBuffer | null;
        if (!buf) return;
        // ArrayBuffer → base64
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!);
        setXlsxBase64(btoa(bin));
        setCsvText('');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCsvText(String(ev.target?.result ?? ''));
        setXlsxBase64(null);
      };
      reader.readAsText(file);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function onDragDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function resetForm() {
    setCsvText('');
    setXlsxBase64(null);
    setXlsxFilename('');
    setDryRunResult(null);
    setConfirmResult(null);
    setError(null);
  }

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

  const [mode, setMode] = useState<'smart' | 'bulk' | 'efatura'>('smart');

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Toplu Yükleme</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <FileUp className="size-6" />
          Import Center
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Excel/CSV listelerini Sayman'a toplu yükle veya e-Fatura XML dosyasını içe aktar.
        </p>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-brand-100">
        <button
          onClick={() => setMode('smart')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px flex items-center gap-1.5 ${
            mode === 'smart'
              ? 'border-brand-900 text-brand-900 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          <Sparkles className="size-4" />
          Akıllı Yükleme
        </button>
        <button
          onClick={() => setMode('bulk')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px ${
            mode === 'bulk'
              ? 'border-brand-900 text-brand-900 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          📊 CSV / XLSX Toplu
        </button>
        <button
          onClick={() => setMode('efatura')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px ${
            mode === 'efatura'
              ? 'border-brand-900 text-brand-900 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          📄 e-Fatura XML
        </button>
      </div>

      {mode === 'smart' && <SmartImportSection />}
      {mode === 'efatura' && <EfaturaSection />}

      {mode === 'bulk' && (
        <>
      {/* Step 1: resource picker */}
      <div className="card mb-4">
        <label className="block mb-3">
          <span className="text-xs uppercase tracking-wide text-brand-500">1. Hangi resource?</span>
          <select
            value={resource}
            onChange={(e) => {
              setResource(e.target.value);
              setDryRunResult(null);
              setConfirmResult(null);
              setError(null);
            }}
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
          >
            {resourcesQ.data?.map((r) => (
              <option key={r.resource} value={r.resource}>
                {r.resource} — {r.description}
              </option>
            ))}
          </select>
        </label>
        {needsTenant && !active.tenantSlug && (
          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
            Bu resource tenant context gerektirir. Üst köşeden tenant seç.
          </p>
        )}
        {SAMPLE_CSV[resource] && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-brand-600 hover:text-brand-900">
              Örnek CSV göster (kopyala/değiştir)
            </summary>
            <pre className="bg-brand-50 p-2 rounded mt-1 text-xs font-mono overflow-x-auto">
              {SAMPLE_CSV[resource]}
            </pre>
          </details>
        )}
      </div>

      {/* Step 2: CSV upload */}
      <div className="card mb-4">
        <p className="text-xs uppercase tracking-wide text-brand-500 mb-2">2. CSV / XLSX yükle</p>
        <Dropzone
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          label="CSV veya XLSX sürükle bırak"
          hint="Header satırı zorunlu. Maks 500 satır."
          onFile={(f) => {
            const ev = { target: { files: [f] as unknown as FileList } } as unknown as React.ChangeEvent<HTMLInputElement>;
            onFileChange(ev);
          }}
        />
        {xlsxBase64 && (
          <div className="mt-3 flex items-center justify-between text-xs text-emerald-700">
            <span>📊 Excel yüklendi: <strong>{xlsxFilename}</strong> ({Math.round((xlsxBase64.length * 0.75) / 1024)} KB)</span>
            <button onClick={resetForm} className="text-red-600 hover:underline flex items-center gap-1">
              <X className="size-3" />
              Temizle
            </button>
          </div>
        )}
        {csvText && (
          <div className="mt-3 flex items-center justify-between text-xs text-brand-600">
            <span>{csvText.split('\n').length} satır (header dahil)</span>
            <button onClick={resetForm} className="text-red-600 hover:underline flex items-center gap-1">
              <X className="size-3" />
              Temizle
            </button>
          </div>
        )}
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          placeholder="Veya CSV'yi buraya yapıştır..."
          className="mt-3 w-full rounded-lg border border-brand-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Step 3: dry-run */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setError(null);
            dryRun.mutate();
          }}
          disabled={(!csvText && !xlsxBase64) || dryRun.isPending || (needsTenant && !active.tenantSlug)}
          className="flex-1 bg-brand-200 hover:bg-brand-300 text-brand-900 px-4 py-2.5 rounded-lg text-sm disabled:opacity-50"
        >
          {dryRun.isPending ? 'Doğrulanıyor…' : '3. Dry-Run (Önizleme)'}
        </button>
        {dryRunResult && dryRunResult.valid > 0 && (
          <button
            onClick={() => {
              setError(null);
              if (confirm.isPending) return;
              if (!window.confirm(`${dryRunResult.valid} kayıt eklenecek. Onaylıyor musun?`)) return;
              confirm.mutate();
            }}
            disabled={confirm.isPending}
            className="flex-1 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {confirm.isPending ? 'Yükleniyor…' : `4. Onayla ve Yükle (${dryRunResult.valid})`}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Dry-run result */}
      {dryRunResult && !confirmResult && (
        <div className="card">
          <h3 className="font-semibold text-brand-900 mb-3">Dry-Run Sonucu</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-brand-50 rounded p-2 text-center">
              <p className="text-xs text-brand-500">Toplam</p>
              <p className="text-xl font-semibold">{dryRunResult.total}</p>
            </div>
            <div className="bg-emerald-50 rounded p-2 text-center">
              <p className="text-xs text-emerald-700">Geçerli</p>
              <p className="text-xl font-semibold text-emerald-700">{dryRunResult.valid}</p>
            </div>
            <div className="bg-red-50 rounded p-2 text-center">
              <p className="text-xs text-red-700">Hatalı</p>
              <p className="text-xl font-semibold text-red-700">{dryRunResult.invalid}</p>
            </div>
          </div>
          {dryRunResult.errors.length > 0 && (
            <details className="mb-3" open>
              <summary className="cursor-pointer text-sm font-medium text-red-700">
                Hatalar ({dryRunResult.errors.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {dryRunResult.errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    <strong>Satır {e.row}:</strong> {e.error}
                  </li>
                ))}
                {dryRunResult.errors.length > 20 && (
                  <li className="text-xs text-brand-400 italic">
                    ...ve {dryRunResult.errors.length - 20} hata daha
                  </li>
                )}
              </ul>
            </details>
          )}
          {dryRunResult.preview.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                Önizleme (ilk 5)
              </summary>
              <pre className="text-xs font-mono bg-brand-50 p-2 rounded mt-2 overflow-x-auto">
                {JSON.stringify(dryRunResult.preview, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Confirm result */}
      {confirmResult && (
        <div className="card bg-emerald-50 border-emerald-200">
          <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            Yükleme Tamamlandı
          </h3>
          <p className="text-sm text-emerald-700 mb-2">
            <strong>{confirmResult.inserted}</strong> kayıt başarıyla eklendi.
          </p>
          {confirmResult.invalid > 0 && (
            <p className="text-sm text-amber-700">
              {confirmResult.invalid} satır geçersiz olduğu için atlandı.
            </p>
          )}
          <button onClick={resetForm} className="mt-3 text-sm text-brand-700 hover:underline">
            Yeni import başlat →
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// --- Smart Import Section (auto-route) --------------------------------------

interface SmartResult {
  type: string;
  action?: string;
  hint?: string;
  parsed?: any;
  file_count?: number;
  by_extension?: Record<string, number>;
  route?: string;
  files?: Array<{ name: string; ext: string }>;
  detected_resource?: string | null;
  row_count?: number;
  headers?: string[];
  sample_valid?: unknown[];
  sample_errors?: Array<{ row: number; error: string }>;
  format?: string;
  mime?: string;
  size_bytes?: number;
}

function SmartImportSection() {
  const active = useAuth((s) => s.active);
  const [result, setResult] = useState<SmartResult | null>(null);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    setFilename(file.name);
    setResult(null);
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ data: SmartResult }>('/smart-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // İkinci adım: yükle ve onayla (sadece e-fatura için şimdilik)
  async function confirmImport() {
    if (!result) return;
    setUploading(true);
    setError(null);
    try {
      if (result.type === 'efatura_xml' && result.parsed) {
        // XML body'i tekrar göndermek için tekrar okumamız gerekti — basitlik: kullanıcı XML'i yeniden yükledi varsayımı yerine
        // sadece bilgi göster:
        alert('e-Fatura preview yapıldı. Onaylamak için "e-Fatura XML" sekmesinden gerçek import yapın.');
      }
    } finally {
      setUploading(false);
    }
  }

  if (!active.tenantSlug) {
    return (
      <div className="card text-center">
        <p className="text-amber-700 text-sm">Tenant seçilmedi. Üst köşeden bir tenant seç.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="font-semibold text-brand-900 flex items-center gap-2 mb-1">
          <Sparkles className="size-5" />
          Akıllı Dosya Yönlendirme
        </h2>
        <p className="text-sm text-brand-500">
          CSV, XLSX, XML, ZIP, PDF, JPG — herhangi bir dosya at, Sayman tipi tespit edip uygun
          işleme yönlendirir (e-fatura parse, bulk import, attachment).
        </p>
      </div>

      <Dropzone
        accept=".csv,.xlsx,.xls,.xml,.zip,.pdf,.jpg,.jpeg,.png,.webp"
        label={uploading ? 'Yükleniyor…' : 'Dosya sürükle bırak veya seç (CSV/XLSX/XML/ZIP/PDF/IMG)'}
        hint="Maks 30 MB. ZIP içindeki tüm dosyalar analizi edilir."
        onFile={onFile}
        disabled={uploading}
      />

      {filename && !uploading && (
        <p className="text-xs text-brand-500 mt-2">Yüklenen: <strong>{filename}</strong></p>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          {/* Genel sonuç kartı */}
          <div className="bg-brand-50 rounded-lg p-4 border border-brand-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <strong className="text-brand-900">Tespit: {result.type}</strong>
            </div>
            {result.action && (
              <p className="text-xs text-brand-600 font-mono bg-white px-2 py-1 rounded">
                → {result.action}
              </p>
            )}
            {result.hint && <p className="text-sm text-brand-700 mt-2">{result.hint}</p>}
          </div>

          {/* e-Fatura preview */}
          {result.type === 'efatura_xml' && result.parsed && (
            <div className="card">
              <h3 className="font-medium mb-2">Fatura Bilgileri</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-brand-500">Fatura No</dt>
                <dd className="font-mono">{result.parsed.invoice_number}</dd>
                <dt className="text-brand-500">Düzenleme</dt>
                <dd>{result.parsed.issue_date ?? '-'}</dd>
                <dt className="text-brand-500">Vade</dt>
                <dd>{result.parsed.due_date ?? '-'}</dd>
                <dt className="text-brand-500">Tedarikçi</dt>
                <dd>{result.parsed.supplier_name ?? '-'}</dd>
                <dt className="text-brand-500">VKN/TCKN</dt>
                <dd className="font-mono">{result.parsed.supplier_tax_number ?? '-'}</dd>
                <dt className="text-brand-500">Tutar</dt>
                <dd className="font-mono font-semibold">
                  {result.parsed.amount} {result.parsed.currency}
                </dd>
              </dl>
              <button
                onClick={() => alert('Onaylamak için "e-Fatura XML" sekmesinden devam et.')}
                className="mt-3 text-xs text-brand-700 hover:underline"
              >
                → Onaylayıp payable_items'a kaydet
              </button>
            </div>
          )}

          {/* ZIP analiz */}
          {result.type === 'zip' && (
            <div className="card">
              <h3 className="font-medium mb-2">ZIP İçeriği</h3>
              <p className="text-sm text-brand-700 mb-2">
                <strong>{result.file_count}</strong> dosya, ana rota:{' '}
                <span className="font-mono bg-brand-50 px-2 py-0.5 rounded">{result.route}</span>
              </p>
              {result.by_extension && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(result.by_extension).map(([ext, n]) => (
                    <span
                      key={ext}
                      className="text-xs bg-brand-50 px-2 py-0.5 rounded text-brand-700 font-mono"
                    >
                      .{ext}: {n}
                    </span>
                  ))}
                </div>
              )}
              {result.files && result.files.length > 0 && (
                <details>
                  <summary className="text-xs text-brand-600 cursor-pointer">
                    Dosya listesi
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {result.files.map((f, i) => (
                      <li key={i} className="text-xs font-mono text-brand-700">
                        {f.name}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* CSV/XLSX detected */}
          {result.type === 'tabular' && (
            <div className="card">
              <h3 className="font-medium mb-2">Tablo Analizi</h3>
              <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                <div>
                  <span className="text-brand-500 text-xs">Format</span>
                  <p className="font-mono">{result.format}</p>
                </div>
                <div>
                  <span className="text-brand-500 text-xs">Satır</span>
                  <p className="font-mono">{result.row_count}</p>
                </div>
                <div>
                  <span className="text-brand-500 text-xs">Resource</span>
                  <p className="font-mono">
                    {result.detected_resource ? (
                      <span className="text-emerald-700">{result.detected_resource}</span>
                    ) : (
                      <span className="text-amber-700">tespit edilemedi</span>
                    )}
                  </p>
                </div>
              </div>
              {result.headers && (
                <div className="mb-2">
                  <p className="text-xs text-brand-500 mb-1">Header'lar:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.headers.map((h, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono bg-brand-50 px-1.5 py-0.5 rounded"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.detected_resource && (
                <p className="text-xs text-brand-600 mt-2">
                  → "CSV / XLSX Toplu" sekmesinden bu resource'u seç + dosyayı tekrar yükle.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- e-Fatura UBL XML Section -----------------------------------------------

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
}

interface ZipImportResult {
  total: number;
  success: number;
  failed: number;
  dry_run: boolean;
  results: Array<{
    file: string;
    ok: boolean;
    invoice_number?: string;
    amount?: string;
    supplier?: string | null;
    payable_id?: string;
    error?: string;
  }>;
}

function EfaturaSection() {
  const [xml, setXml] = useState('');
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);
  const [imported, setImported] = useState<{ payable: { id: string; title: string } } | null>(null);
  const [zipResult, setZipResult] = useState<ZipImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parse = async () => {
    setError(null);
    setImported(null);
    try {
      const res = await api.post<{ data: { parsed: ParsedInvoice } }>('/efatura/parse', { xml });
      setParsed(res.data.data.parsed);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    }
  };

  const importInv = async () => {
    setError(null);
    try {
      const res = await api.post<{ data: { parsed: ParsedInvoice; payable: { id: string; title: string } } }>(
        '/efatura/import',
        { xml, dry_run: false },
      );
      setImported({ payable: res.data.data.payable });
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    }
  };

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isZip = f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip';
    if (isZip) {
      // ZIP → base64 → import-zip endpoint
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const buf = ev.target?.result as ArrayBuffer | null;
          if (!buf) return;
          const bytes = new Uint8Array(buf);
          let bin = '';
          for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!);
          const b64 = btoa(bin);
          const res = await api.post<{ data: ZipImportResult }>('/efatura/import-zip', {
            zip_base64: b64,
            dry_run: false,
          });
          setZipResult(res.data.data);
          setXml('');
          setParsed(null);
          setImported(null);
          setError(null);
        } catch (e) {
          const err = e as { response?: { data?: { error?: string; message?: string } } };
          setError(
            err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message,
          );
        }
      };
      reader.readAsArrayBuffer(f);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setXml(String(ev.target?.result ?? ''));
      setParsed(null);
      setImported(null);
      setZipResult(null);
      setError(null);
    };
    reader.readAsText(f);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-brand-900 flex items-center gap-2">
          <FileCode className="size-5" />
          e-Fatura / e-Arşiv XML İçe Aktar
        </h2>
        <p className="text-xs text-brand-400">UBL-TR 1.2</p>
      </div>

      <p className="text-sm text-brand-600 mb-3">
        GİB'den indirilen <code className="font-mono bg-brand-50 px-1 rounded">.xml</code> dosyasını
        yükle. Sayman fatura no, tarih, tedarikçi, tutar bilgilerini otomatik çekip <strong>payable_items</strong>
        tablosuna kaydeder.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="file"
          accept=".xml,text/xml,application/xml,.zip,application/zip"
          onChange={onFileSelect}
          className="hidden"
          id="xml-upload"
        />
        <label
          htmlFor="xml-upload"
          className="inline-block bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm cursor-pointer"
        >
          <Upload className="inline size-4 mr-1" />
          XML / ZIP Seç
        </label>
        <button
          onClick={parse}
          disabled={!xml}
          className="bg-brand-200 hover:bg-brand-300 text-brand-900 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          Parse (Önizleme)
        </button>
      </div>
      <p className="text-xs text-brand-400 mb-3">
        ZIP yüklersen içindeki tüm XML'ler otomatik içe aktarılır (max 100 / ZIP).
      </p>

      <textarea
        value={xml}
        onChange={(e) => setXml(e.target.value)}
        rows={6}
        placeholder="Veya XML içeriğini buraya yapıştır..."
        className="w-full rounded-lg border border-brand-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
      />

      {error && (
        <p className="text-sm text-red-600 mt-3 flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}

      {parsed && !imported && (
        <div className="card bg-brand-50 mt-4">
          <h3 className="font-medium text-brand-900 mb-3">Fatura Önizleme</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-brand-500">Fatura No</dt>
            <dd className="font-mono">{parsed.invoice_number}</dd>
            <dt className="text-brand-500">Düzenleme</dt>
            <dd>{parsed.issue_date ?? '-'}</dd>
            <dt className="text-brand-500">Vade</dt>
            <dd>{parsed.due_date ?? '-'}</dd>
            <dt className="text-brand-500">Tedarikçi</dt>
            <dd>{parsed.supplier_name ?? '-'}</dd>
            <dt className="text-brand-500">VKN/TCKN</dt>
            <dd className="font-mono">{parsed.supplier_tax_number ?? '-'}</dd>
            <dt className="text-brand-500">Tutar</dt>
            <dd className="font-mono font-semibold">
              {parsed.amount} {parsed.currency}
            </dd>
            <dt className="text-brand-500">Profil</dt>
            <dd className="font-mono text-xs">{parsed.profile_id ?? '-'}</dd>
          </dl>
          <button
            onClick={() => {
              if (confirm(`"${parsed.invoice_number}" payable_items'a kaydedilsin mi?`)) importInv();
            }}
            className="mt-4 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Onayla ve İçe Aktar
          </button>
        </div>
      )}

      {imported && (
        <div className="card bg-emerald-50 border-emerald-200 mt-4">
          <p className="text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            ✓ Fatura içe aktarıldı: <strong>{imported.payable.title}</strong>
          </p>
          <a
            href={`/payables/${imported.payable.id}`}
            className="text-sm text-brand-700 hover:underline mt-2 inline-block"
          >
            Fatura detayına git →
          </a>
        </div>
      )}

      {zipResult && (
        <div className="card bg-emerald-50 border-emerald-200 mt-4">
          <h3 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            ZIP İçe Aktarım Tamamlandı
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center text-sm">
            <div className="bg-white rounded p-2">
              <p className="text-xs text-brand-500">Toplam</p>
              <p className="font-semibold">{zipResult.total}</p>
            </div>
            <div className="bg-white rounded p-2">
              <p className="text-xs text-emerald-600">Başarılı</p>
              <p className="font-semibold text-emerald-700">{zipResult.success}</p>
            </div>
            <div className="bg-white rounded p-2">
              <p className="text-xs text-red-600">Hatalı</p>
              <p className="font-semibold text-red-700">{zipResult.failed}</p>
            </div>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-brand-700">Detay (her dosya)</summary>
            <ul className="mt-2 space-y-1 text-xs max-h-60 overflow-y-auto">
              {zipResult.results.map((r, i) => (
                <li
                  key={i}
                  className={`px-2 py-1 rounded ${r.ok ? 'bg-emerald-50' : 'bg-red-50'}`}
                >
                  {r.ok ? '✓' : '✗'} <strong>{r.file}</strong>
                  {r.ok && r.invoice_number && (
                    <> — {r.invoice_number} / {r.supplier} / {r.amount}</>
                  )}
                  {!r.ok && r.error && <span className="text-red-600"> — {r.error}</span>}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
