/**
 * ExportButton — Liste sayfaları için Excel/PDF download butonu.
 *
 * Backend /v1/exports/:resource.xlsx ve /v1/pdf/monthly-summary endpoint'lerine
 * Authorization header'ı ile fetch yapar, blob olarak download tetikler.
 *
 * Kullanım:
 *   <ExportButton resource="payables" label="Faturalar" />
 *   <ExportButton resource="sales-invoices" label="Satış Faturaları" />
 *   <ExportButton type="pdf-monthly" label="Aylık Özet PDF" />
 */
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

type ExportResource =
  | 'payables'
  | 'sales-invoices'
  | 'companies'
  | 'persons'
  | 'employees'
  | 'guarantees'
  | 'subscriptions'
  | 'regular-payments';

interface XlsxProps {
  type?: 'xlsx';
  resource: ExportResource;
  label: string;
  compact?: boolean;
}

interface PdfProps {
  type: 'pdf-monthly';
  period?: string; // YYYY-MM
  label: string;
  compact?: boolean;
}

type Props = XlsxProps | PdfProps;

export function ExportButton(props: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const url =
        props.type === 'pdf-monthly'
          ? `/pdf/monthly-summary${props.period ? `?period=${props.period}` : ''}`
          : `/exports/${props.resource}.xlsx`;

      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: props.type === 'pdf-monthly'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const fileName =
        props.type === 'pdf-monthly'
          ? `ozet-${props.period ?? new Date().toISOString().slice(0, 7)}.pdf`
          : `${props.resource}-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Export failed:', err);
      alert('İndirme başarısız oldu. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  const Icon = props.type === 'pdf-monthly' ? FileText : FileSpreadsheet;
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={
        props.compact
          ? 'inline-flex items-center gap-1 text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-2 py-1.5 rounded disabled:opacity-50'
          : 'inline-flex items-center gap-2 text-sm border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-50'
      }
      title={`${props.label} indir`}
    >
      {loading ? (
        <Loader2 className={props.compact ? 'size-3 animate-spin' : 'size-4 animate-spin'} />
      ) : (
        <Icon className={props.compact ? 'size-3' : 'size-4'} />
      )}
      {loading ? 'İndiriliyor…' : props.label}
    </button>
  );
}
