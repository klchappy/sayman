"""
Import workflow servisleri — PHASE1_IMPORT_ARCHITECTURE_PLAN.md.

Faz 3 kapsamı:
- create_import_batch / attach_source_file / parse_excel_to_drafts
- recalculate_batch_counts
- approve_draft_record / reject_draft_record / mark_manual_review
- cancel_batch
- commit_batch  → safe no-op (Faz 4'te domain commit eklenecek)
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.audit.services import audit_log

from ..models import (
    DraftRecordStatus,
    DraftSuggestedAction,
    ImportBatch,
    ImportBatchStatus,
    ImportDraftRecord,
    ImportLog,
    ImportLogLevel,
    ImportSourceFile,
    ImportSourceType,
    ImportTargetModule,
    ValidationStatus,
)


# === BATCH ==================================================================

def create_import_batch(
    *,
    user,
    source_type=ImportSourceType.EXCEL,
    target_module=ImportTargetModule.GENERIC,
    title: str = "",
    historical_data: bool = False,
    metadata: dict | None = None,
) -> ImportBatch:
    batch = ImportBatch.objects.create(
        title=title or "",
        source_type=source_type,
        target_module=target_module,
        status=ImportBatchStatus.DRAFT,
        created_by=user if (user and user.is_authenticated) else None,
        historical_data=historical_data,
        metadata=metadata or {},
    )
    ImportLog.objects.create(
        batch=batch, level=ImportLogLevel.INFO, code="BATCH_CREATED",
        message=f"Batch yaratıldı: {batch.batch_id}",
    )
    audit_log(actor=user, action="CREATE", obj=batch, summary=f"Import batch yaratıldı: {batch.short_id}")
    return batch


def attach_source_file(*, batch: ImportBatch, document, original_path: str = "") -> ImportSourceFile:
    sf = ImportSourceFile.objects.create(
        batch=batch, document=document, original_path=original_path,
    )
    ImportLog.objects.create(
        batch=batch, level=ImportLogLevel.INFO, code="FILE_ATTACHED",
        message=f"Kaynak dosya eklendi: {document.original_filename}",
        context={"document_id": document.pk, "sha256": document.sha256[:16]},
    )
    return sf


# === PARSE ==================================================================

@transaction.atomic
def parse_excel_to_drafts(*, batch: ImportBatch, document, user=None, max_rows: int | None = None):
    """Document.file → batch.draft_records doldur."""
    from .excel_parser import parse_workbook_to_drafts

    if not document.file:
        raise ValueError("Document.file yok")

    document.file.open("rb")
    try:
        result = parse_workbook_to_drafts(
            document.file, batch=batch, document=document, max_rows=max_rows,
        )
    finally:
        try:
            document.file.close()
        except Exception:
            pass

    batch.parsed_at = timezone.now()
    batch.status = ImportBatchStatus.PARSED
    batch.save(update_fields=["parsed_at", "status", "updated_at"])

    recalculate_batch_counts(batch)

    ImportLog.objects.create(
        batch=batch, level=ImportLogLevel.INFO, code="PARSED",
        message="Excel parse edildi",
        context=result,
    )
    audit_log(actor=user, action="UPDATE", obj=batch, summary=f"Excel parse: {result}",
              metadata=result)
    return result


# === COUNT RECALC ===========================================================

def recalculate_batch_counts(batch: ImportBatch) -> ImportBatch:
    qs = batch.draft_records.all()
    batch.row_count = qs.count()
    batch.ok_count = qs.filter(validation_status=ValidationStatus.OK).count()
    batch.warning_count = qs.filter(validation_status=ValidationStatus.WARNING).count()
    batch.error_count = qs.filter(validation_status=ValidationStatus.ERROR).count()
    batch.manual_review_count = qs.filter(validation_status=ValidationStatus.MANUAL_REVIEW).count()

    if batch.error_count > 0 or batch.manual_review_count > 0 or batch.warning_count > 0:
        if batch.status == ImportBatchStatus.PARSED:
            batch.status = ImportBatchStatus.NEEDS_REVIEW

    batch.save(update_fields=[
        "row_count", "ok_count", "warning_count", "error_count",
        "manual_review_count", "status", "updated_at",
    ])
    return batch


# === DRAFT AKSİYONLARI ======================================================

def approve_draft_record(*, draft: ImportDraftRecord, user) -> ImportDraftRecord:
    draft.status = DraftRecordStatus.APPROVED
    draft.save(update_fields=["status", "updated_at"])
    ImportLog.objects.create(
        batch=draft.batch, level=ImportLogLevel.INFO, code="DRAFT_APPROVED",
        message=f"Draft onaylandı: #{draft.source_row_number}",
        context={"draft_id": draft.pk},
    )
    audit_log(actor=user, action="UPDATE", obj=draft,
              summary=f"Draft onaylandı: #{draft.source_row_number} / {draft.display_title[:60]}")
    return draft


def reject_draft_record(*, draft: ImportDraftRecord, user, reason: str = "") -> ImportDraftRecord:
    draft.status = DraftRecordStatus.REJECTED
    draft.metadata = {**(draft.metadata or {}), "reject_reason": reason}
    draft.save(update_fields=["status", "metadata", "updated_at"])
    ImportLog.objects.create(
        batch=draft.batch, level=ImportLogLevel.WARNING, code="DRAFT_REJECTED",
        message=f"Draft reddedildi: #{draft.source_row_number}",
        context={"draft_id": draft.pk, "reason": reason},
    )
    audit_log(actor=user, action="UPDATE", obj=draft,
              summary=f"Draft reddedildi: #{draft.source_row_number}",
              metadata={"reject_reason": reason})
    return draft


def mark_manual_review(*, draft: ImportDraftRecord, user, message: str = "") -> ImportDraftRecord:
    draft.validation_status = ValidationStatus.MANUAL_REVIEW
    draft.suggested_action = DraftSuggestedAction.MANUAL_REVIEW
    if message:
        msgs = list(draft.validation_messages or [])
        msgs.append({"code": "MANUAL", "level": "WARNING", "msg": message})
        draft.validation_messages = msgs
    draft.save(update_fields=["validation_status", "suggested_action",
                              "validation_messages", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=draft,
              summary=f"Manuel inceleme işaretlendi: #{draft.source_row_number}")
    return draft


# === BATCH AKSİYONLARI ======================================================

def cancel_batch(*, batch: ImportBatch, user, reason: str = "") -> ImportBatch:
    batch.status = ImportBatchStatus.CANCELLED
    md = dict(batch.metadata or {})
    md["cancel_reason"] = reason
    batch.metadata = md
    batch.save(update_fields=["status", "metadata", "updated_at"])
    ImportLog.objects.create(
        batch=batch, level=ImportLogLevel.WARNING, code="BATCH_CANCELLED",
        message="Batch iptal edildi",
        context={"reason": reason},
    )
    audit_log(actor=user, action="ARCHIVE", obj=batch,
              summary=f"Import iptal: {batch.short_id}", metadata={"reason": reason})
    return batch


# === COMMIT (Faz 3: NO-OP) ==================================================

def commit_batch(*, batch: ImportBatch, user, only_ok: bool = False):
    """
    Faz 3 sınırı: GERÇEK COMMIT YOK.

    Bu fonksiyon yalnız audit + log yazar; domain kayıt üretmez.
    Faz 4'te `MODULE_COMMITTERS` dispatch eklenecek.

    Returns: dict — uyarı mesajı + count'lar.
    """
    ImportLog.objects.create(
        batch=batch, level=ImportLogLevel.WARNING, code="COMMIT_BLOCKED",
        message="Faz 3: gerçek commit yok. Domain kayıt yaratılmadı.",
        context={"only_ok": only_ok},
    )
    audit_log(actor=user, action="VIEW", obj=batch,
              summary="commit_batch çağrıldı (Faz 3 NO-OP)",
              metadata={"phase": 3, "domain_commit": False})
    return {
        "phase": 3,
        "domain_commit": False,
        "message": "Faz 3 sınırı: domain commit yok. Faz 4'te aktif olacak.",
        "draft_count": batch.row_count,
        "approved_count": batch.draft_records.filter(status=DraftRecordStatus.APPROVED).count(),
    }


# === ROLLBACK (Faz 3: NO-OP) ================================================

def rollback_batch(*, batch: ImportBatch, user):
    """Faz 3 placeholder. Faz 4'te 24 saat içinde geri alma."""
    ImportLog.objects.create(
        batch=batch, level=ImportLogLevel.INFO, code="ROLLBACK_NOOP",
        message="Faz 3: rollback no-op (commit henüz yok).",
    )
    return {"phase": 3, "rolled_back": False, "message": "Henüz commit yok, rollback gereksiz."}
