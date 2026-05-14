/**
 * Dropzone — reusable drag-drop + click-to-pick file selector.
 * Visual states: idle, hover/dragging, dropped.
 */
import { File as FileIcon, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

interface Props {
  accept?: string;
  label?: string;
  hint?: string;
  multiple?: boolean;
  onFile: (file: File) => void;
  onFiles?: (files: File[]) => void;
  disabled?: boolean;
}

export function Dropzone({
  accept,
  label = 'Dosya sürükle bırak veya seç',
  hint,
  multiple,
  onFile,
  onFiles,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);
    if (multiple && onFiles) onFiles(files);
    else onFile(files[0]!);
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // child element'e gidiyorsa dragLeave tetiklenir; sadece dropzone'dan çıkışta sıfırla
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        disabled
          ? 'border-brand-100 bg-brand-50/40 cursor-not-allowed opacity-60'
          : dragOver
            ? 'border-brand-900 bg-brand-50 scale-[1.01] shadow-md'
            : 'border-brand-200 bg-white hover:border-brand-400 hover:bg-brand-50/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        <div
          className={`size-12 rounded-full flex items-center justify-center ${
            dragOver ? 'bg-brand-900 text-white' : 'bg-brand-100 text-brand-700'
          } transition-colors`}
        >
          {dragOver ? <FileIcon className="size-6" /> : <Upload className="size-6" />}
        </div>
        <p className="text-sm font-medium text-brand-900">
          {dragOver ? 'Bırak!' : label}
        </p>
        {hint && <p className="text-xs text-brand-500">{hint}</p>}
      </div>
    </div>
  );
}
