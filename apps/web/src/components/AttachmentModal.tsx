/**
 * AttachmentModal — liste sayfalarında Paperclip butonuyla açılan attachment yöneticisi.
 * AttachmentBox'u modal içinde sunar; satır bazlı dosya yönetimi için.
 */
import { X } from 'lucide-react';
import { AttachmentBox } from './AttachmentBox';

interface Props {
  relatedTable:
    | 'payable_items'
    | 'guarantees'
    | 'subscriptions'
    | 'regular_payment_profiles'
    | 'official_payment_profiles';
  relatedId: string;
  title: string;
  onClose: () => void;
}

export function AttachmentModal({ relatedTable, relatedId, title, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-brand-100">
          <h3 className="font-semibold text-brand-900 truncate">{title}</h3>
          <button onClick={onClose} className="text-brand-500 hover:text-brand-900 p-1">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4">
          <AttachmentBox relatedTable={relatedTable} relatedId={relatedId} />
        </div>
      </div>
    </div>
  );
}
