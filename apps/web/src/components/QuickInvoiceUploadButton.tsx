/**
 * QuickInvoiceUploadButton — sayfa içinden direkt fatura yükleme.
 *
 * Payables, SalesInvoices, Cari detay vb. sayfalardan kullanılır.
 * Tıklayınca dosya picker açar, smart-import endpoint'ine POST eder, sonuçta
 * "Onay Bekleyenler'e Git" mesajı + link.
 *
 * Desteklenen formatlar: XML (UBL e-Fatura) · ZIP · RAR · CSV · XLSX · PDF (görüntü olarak)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface SmartImportResp {
  data: {
    type: string;
    action: string;
    message: string;
    payable?: { id: string; title: string };
    success?: number;
    duplicates?: number;
    failed?: number;
    new_suppliers?: number;
    xml_count?: number;
    // Yeni alanlar (audit #9 + #12 sonrası):
    insert_failed?: number;
    insert_failures?: Array<{ row_index: number; row: any; error: string }>;
    supplier_failed?: number;
    supplier_failures?: Array<{ supplier_name: string; error: string }>;
  };
}

export function QuickInvoiceUploadButton({
  label = 'Dosya Yükle',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showResult, setShowResult] = useState<SmartImportResp['data'] | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<SmartImportResp>('/smart-import?commit=true', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setShowResult(data);
      // İlgili listeleri tazele
      qc.invalidateQueries({ queryKey: ['payables'] });
      qc.invalidateQueries({ queryKey: ['sales-invoices'] });
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      qc.invalidateQueries({ queryKey: ['review-queue-summary-shell'] });
      qc.invalidateQueries({ queryKey: ['review-queue-summary-banner'] });
      qc.invalidateQueries({ queryKey: ['review-queue-summary-empty'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['sales-summary'] });
      qc.invalidateQueries({ queryKey: ['payable-summary'] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['cari-list'] });
      qc.invalidateQueries({ queryKey: ['cari-summary'] });
      qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  function pick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    upload.mutate(f);
    e.target.value = ''; // aynı dosya tekrar yüklenebilsin
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.zip,.rar,.csv,.xlsx,.pdf,image/*"
        onChange={onChange}
        className="hidden"
      />
      <button
        onClick={pick}
        disabled={upload.isPending}
        className={
          compact
            ? 'inline-flex items-center gap-1 text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-2 py-1.5 rounded disabled:opacity-50'
            : 'inline-flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg disabled:opacity-50'
        }
      >
        {upload.isPending ? (
          <Loader2 className={compact ? 'size-3 animate-spin' : 'size-4 animate-spin'} />
        ) : (
          <FileUp className={compact ? 'size-3' : 'size-4'} />
        )}
        {upload.isPending ? 'Yükleniyor…' : label}
      </button>

      {showResult && (
        <UploadResultToast result={showResult} onClose={() => setShowResult(null)} />
      )}
    </>
  );
}

function UploadResultToast({
  result,
  onClose,
}: {
  result: SmartImportResp['data'];
  onClose: () => void;
}) {
  const isZipOrRar = result.type === 'zip' || result.type === 'rar';
  const isXml = result.type === 'efatura_xml';
  const hasNew = (result.success ?? 0) > 0 || isXml;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-brand-200 dark:border-slate-700 p-4 animate-scale-in"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <h4 className="font-semibold text-brand-900 dark:text-slate-100 text-sm">
            Yükleme Tamamlandı
          </h4>
        </div>
        <button onClick={onClose} className="text-brand-500 hover:text-brand-900">
          <X className="size-4" />
        </button>
      </div>

      <p className="text-xs text-brand-600 dark:text-slate-400 mb-3">{result.message}</p>

      {isZipOrRar && (
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-1.5">
            <p className="text-emerald-600 uppercase">Eklendi</p>
            <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
              {result.success ?? 0}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-1.5">
            <p className="text-amber-600 uppercase">Mükerrer</p>
            <p className="font-mono text-amber-700 dark:text-amber-300">
              {result.duplicates ?? 0}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded p-1.5">
            <p className="text-red-600 uppercase">Hata</p>
            <p className="font-mono text-red-700 dark:text-red-300">{result.failed ?? 0}</p>
          </div>
        </div>
      )}

      {hasNew && (
        <div className="text-[11px] bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2 mb-3 text-blue-800 dark:text-blue-300">
          📋 Yüklenen kayıtlar otomatik yaratıldı, <strong>Onay Bekleyenler</strong> sayfasında
          tek tek onaylanmalı.
        </div>
      )}

      {/* Insert failures detayı (audit #9) */}
      {(result.insert_failed ?? 0) > 0 && (
        <FailuresAccordion
          title={`${result.insert_failed} satır DB'ye yazılamadı`}
          tone="red"
          items={(result.insert_failures ?? []).map((f) => ({
            label: `Satır ${f.row_index + 1}`,
            detail: f.error,
          }))}
        />
      )}

      {/* Supplier auto-create failures (audit #12) */}
      {(result.supplier_failed ?? 0) > 0 && (
        <FailuresAccordion
          title={`${result.supplier_failed} tedarikçi eşleştirilemedi`}
          tone="amber"
          subtitle="Faturalar kaydedildi ancak company_id boş. Onay Bekleyenler'de manuel bağlanabilir."
          items={(result.supplier_failures ?? []).map((f) => ({
            label: f.supplier_name,
            detail: f.error,
          }))}
        />
      )}

      <div className="flex gap-2">
        <Link
          to="/review-queue?type=payable&scope=org"
          className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-center font-medium"
          onClick={onClose}
        >
          Onay Bekleyenler →
        </Link>
        <button
          onClick={onClose}
          className="text-xs text-brand-500 hover:text-brand-900 px-3 py-1.5 rounded border border-brand-200 dark:border-slate-700"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

/**
 * Genişletilebilir hata listesi — smart-import sırasında oluşan kısmi
 * başarısızlıkları (insert failures, supplier auto-create failures) detaylı
 * gösterir. Default kapalı, "Detay göster" ile açılır.
 */
function FailuresAccordion({
  title,
  subtitle,
  tone,
  items,
}: {
  title: string;
  subtitle?: string;
  tone: 'red' | 'amber';
  items: Array<{ label: string; detail: string }>;
}) {
  const [open, setOpen] = useState(false);
  const colors =
    tone === 'red'
      ? {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-300',
          icon: '❌',
        }
      : {
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          border: 'border-amber-200 dark:border-amber-800',
          text: 'text-amber-800 dark:text-amber-300',
          icon: '⚠️',
        };

  return (
    <div className={`text-[11px] ${colors.bg} border ${colors.border} rounded p-2 mb-3 ${colors.text}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="font-medium">
          {colors.icon} {title}
        </span>
        <span className="text-[10px] underline">{open ? 'Gizle' : 'Detay göster'}</span>
      </button>
      {subtitle && <p className="text-[10px] mt-1 opacity-80">{subtitle}</p>}
      {open && items.length > 0 && (
        <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
          {items.slice(0, 20).map((it, i) => (
            <li key={i} className="border-t border-current/10 pt-1">
              <p className="font-medium font-mono">{it.label}</p>
              <p className="opacity-90 break-words">{it.detail}</p>
            </li>
          ))}
          {items.length > 20 && (
            <li className="text-[10px] italic opacity-70 pt-1">
              ... ve {items.length - 20} daha (toplam {items.length})
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
