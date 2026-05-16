import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, FileText, ImageIcon, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useConfirmBool } from './ConfirmDialog';

interface Attachment {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  description: string | null;
  created_at: string;
}

interface Props {
  relatedTable: 'payable_items' | 'guarantees' | 'subscriptions' | 'regular_payment_profiles' | 'official_payment_profiles';
  relatedId: string;
  /** Salt-okur ise upload + delete gizli */
  readOnly?: boolean;
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <ImageIcon className="size-4 text-blue-500" />;
  if (mime === 'application/pdf') return <FileText className="size-4 text-red-500" />;
  return <File className="size-4 text-brand-500" />;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentBox({ relatedTable, relatedId, readOnly }: Props) {
  const qc = useQueryClient();
  const confirmBool = useConfirmBool();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['attachments', relatedTable, relatedId],
    queryFn: async () => {
      const res = await api.get<{ data: Attachment[] }>(
        `/attachments?related_table=${relatedTable}&related_id=${relatedId}`,
      );
      return res.data.data;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('related_table', relatedTable);
      fd.append('related_id', relatedId);
      const res = await api.post('/attachments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', relatedTable, relatedId] });
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (e) => {
      setUploading(false);
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/attachments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', relatedTable, relatedId] }),
  });

  async function downloadAttachment(att: Attachment) {
    const res = await api.get<{ data: { url: string } }>(`/attachments/${att.id}/url`);
    const a = document.createElement('a');
    a.href = res.data.data.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-brand-900 flex items-center gap-2">
          <Paperclip className="size-5" />
          Eklentiler ({q.data?.length ?? 0})
        </h3>
        {!readOnly && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.xml,.csv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setError(null);
                  setUploading(true);
                  upload.mutate(f);
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 text-sm bg-brand-900 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
            >
              <Upload className="size-4" />
              {uploading ? 'Yükleniyor…' : 'Dosya Ekle'}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3 flex items-center gap-2">
          <X className="size-4" />
          {error}
        </p>
      )}

      {q.data && q.data.length === 0 && (
        <p className="text-sm text-brand-500 text-center py-4">Henüz eklenti yok.</p>
      )}

      {q.data && q.data.length > 0 && (
        <ul className="space-y-1">
          {q.data.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-brand-50 rounded-lg"
            >
              {fileIcon(att.mime_type)}
              <button
                onClick={() => downloadAttachment(att)}
                className="flex-1 text-left text-sm text-brand-700 hover:text-brand-900 truncate"
                title="İndir / Aç"
              >
                {att.file_name}
              </button>
              <span className="text-xs text-brand-400">{fmtSize(att.size_bytes)}</span>
              {!readOnly && (
                <button
                  onClick={async () => {
                    if (
                      await confirmBool({
                        title: 'Eklenti Sil',
                        message: `"${att.file_name}" silinsin mi?`,
                        variant: 'danger',
                        confirmLabel: 'Sil',
                      })
                    )
                      del.mutate(att.id);
                  }}
                  className="text-red-500 hover:bg-red-50 p-1 rounded"
                  title="Sil"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
