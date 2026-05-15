/**
 * ProvenanceBadge — bir kayıt için "nasıl yaratıldı" rozeti.
 *
 * - auto_created_source set, reviewed_by null → "🤖 Otomatik (onay bekliyor)" (ama bu zaten review queue'da)
 * - auto_created_source set + reviewed_by set + metadata.tenant_corrected → "✏️ Düzeltildi"
 * - auto_created_source set + reviewed_by set → "✅ Onaylandı (oto)"
 * - !auto_created_source, manuel → herhangi bir badge yok (normal manuel kayıt)
 */
import { Bot, CheckCheck, Edit3 } from 'lucide-react';

export interface ProvenanceItem {
  auto_created_source?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function ProvenanceBadge({ item }: { item: ProvenanceItem }) {
  const auto = !!item.auto_created_source;
  const reviewed = !!item.reviewed_by;
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const corrected = !!meta.tenant_corrected;

  if (auto && reviewed && corrected) {
    return (
      <span
        title="Otomatik yaratıldı, insan tarafından düzeltilip onaylandı"
        className="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
      >
        <Edit3 className="size-2.5" />
        Düzeltildi
      </span>
    );
  }
  if (auto && reviewed) {
    return (
      <span
        title="Otomatik yaratıldı, insan tarafından onaylandı"
        className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
      >
        <CheckCheck className="size-2.5" />
        Onaylandı (oto)
      </span>
    );
  }
  if (auto) {
    return (
      <span
        title="Otomatik yaratıldı, henüz onaylanmadı"
        className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
      >
        <Bot className="size-2.5" />
        Otomatik
      </span>
    );
  }
  return null;
}
