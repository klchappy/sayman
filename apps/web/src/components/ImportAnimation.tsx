/**
 * ImportAnimation — Sayman tarzı yükleme/işlem animasyonu.
 *
 * 4 aşama: uploading → analyzing → importing → success
 * Her aşamada farklı görsel; dosya ikonu yukarı doğru hareket eder,
 * parçacıklar uçar, son aşamada onay tik.
 */
import {
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';

export type ImportStage = 'idle' | 'uploading' | 'analyzing' | 'importing' | 'success';

const STAGE_LABEL: Record<ImportStage, string> = {
  idle: '',
  uploading: 'Dosya yükleniyor…',
  analyzing: 'İçerik analiz ediliyor…',
  importing: 'Sisteme aktarılıyor…',
  success: 'Tamamlandı',
};

const STAGE_HINT: Record<ImportStage, string> = {
  idle: '',
  uploading: 'Sayman dosyayı alıyor',
  analyzing: 'Tip tespit, alan eşleştirme, doğrulama',
  importing: 'Veritabanına kayıt + otomatik tedarikçi açılması',
  success: 'Veriler başarıyla içeriye aktarıldı',
};

export function ImportAnimation({
  stage,
  filename,
}: {
  stage: ImportStage;
  filename?: string;
}) {
  if (stage === 'idle') return null;

  return (
    <div className="card mt-4 bg-gradient-to-br from-brand-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 border-blue-200 dark:border-blue-800 relative overflow-hidden">
      {/* Arka plan parçacıkları */}
      <div className="absolute inset-0 pointer-events-none">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`absolute size-1.5 rounded-full bg-blue-400/40 dark:bg-blue-500/30 ${
              stage === 'success' ? 'animate-pulse-slow' : 'animate-float'
            }`}
            style={{
              left: `${10 + i * 16}%`,
              top: `${20 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      <div className="relative flex items-center gap-4">
        {/* Animasyonlu ikon */}
        <div className="relative flex-shrink-0">
          {stage === 'uploading' && (
            <div className="size-16 rounded-full bg-blue-500 text-white grid place-items-center animate-bounce-slow">
              <Upload className="size-8" />
            </div>
          )}
          {stage === 'analyzing' && (
            <div className="relative size-16 rounded-full bg-purple-500 text-white grid place-items-center">
              <Sparkles className="size-8 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-4 border-purple-300/40 animate-ping" />
            </div>
          )}
          {stage === 'importing' && (
            <div className="size-16 rounded-full bg-amber-500 text-white grid place-items-center">
              <Database className="size-8" />
              <Loader2 className="absolute size-16 animate-spin text-amber-300/60" />
            </div>
          )}
          {stage === 'success' && (
            <div className="size-16 rounded-full bg-emerald-500 text-white grid place-items-center animate-scale-in">
              <CheckCircle2 className="size-8" />
            </div>
          )}
        </div>

        {/* Metin */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brand-900 dark:text-slate-100 text-base mb-0.5">
            {STAGE_LABEL[stage]}
          </p>
          <p className="text-xs text-brand-500 dark:text-slate-400">{STAGE_HINT[stage]}</p>
          {filename && (
            <p className="text-[10px] font-mono text-brand-400 dark:text-slate-500 mt-1 flex items-center gap-1">
              <FileText className="size-3" />
              {filename}
            </p>
          )}
        </div>

        {/* Spinner sağda */}
        {stage !== 'success' && (
          <Loader2 className="size-5 text-brand-400 animate-spin flex-shrink-0" />
        )}
      </div>

      {/* İlerleme çubuğu */}
      <div className="relative mt-3 h-1 bg-brand-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            stage === 'uploading'
              ? 'w-1/4 bg-blue-500'
              : stage === 'analyzing'
                ? 'w-2/4 bg-purple-500'
                : stage === 'importing'
                  ? 'w-3/4 bg-amber-500'
                  : 'w-full bg-emerald-500'
          }`}
        />
      </div>

      {/* Stage'lerin nokta göstergesi */}
      <div className="relative flex items-center justify-between mt-3 px-1 text-[10px]">
        {(['uploading', 'analyzing', 'importing', 'success'] as ImportStage[]).map((s, i) => {
          const stageOrder = ['uploading', 'analyzing', 'importing', 'success'];
          const currentIdx = stageOrder.indexOf(stage);
          const idx = stageOrder.indexOf(s);
          const done = idx < currentIdx || stage === 'success';
          const current = s === stage;
          return (
            <div key={s} className="flex flex-col items-center gap-1">
              <div
                className={`size-2.5 rounded-full transition-all ${
                  done
                    ? 'bg-emerald-500'
                    : current
                      ? 'bg-blue-500 ring-4 ring-blue-200 dark:ring-blue-900/50'
                      : 'bg-brand-200 dark:bg-slate-700'
                }`}
              />
              <span
                className={
                  current
                    ? 'text-brand-900 dark:text-slate-100 font-medium'
                    : done
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-brand-400 dark:text-slate-500'
                }
              >
                {STAGE_LABEL[s].replace('…', '').replace('Tamamlandı', 'Tamam')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
