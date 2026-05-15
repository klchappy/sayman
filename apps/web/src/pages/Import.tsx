import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, FileCode, FileUp, Sparkles, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { Dropzone } from '../components/Dropzone';
import { ImportAnimation, type ImportStage } from '../components/ImportAnimation';
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
  mime?: string;
  size_bytes?: number;
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
  resource?: string;
  inserted?: number;
  inserted_ids?: string[];
  new_suppliers?: number;
  invalid_count?: number;
  errors?: Array<{ row: number; error: string }>;
  success?: number;
  duplicates?: number;
  failed?: number;
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
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ data: SmartImportResult }>('/smart-import?commit=true', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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
  return (
    <div className="card">
      <h3 className="font-medium mb-3 text-brand-900 dark:text-slate-100">ZIP İçeriği</h3>
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
          <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
              📋 Fatura otomatik yaratıldı, onay bekliyor. Tek tek onaylayabilir / düzenleyebilirsin.
            </p>
            <a
              href="/review-queue"
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
