from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views.generic import DetailView, FormView, ListView, View

from apps.audit.services import audit_log
from apps.documents.models import Document, DocumentSource, DocumentType

from .forms import ImportUploadForm
from .models import (
    DraftRecordStatus,
    ImportBatch,
    ImportBatchStatus,
    ImportDraftRecord,
    ImportSourceType,
    ValidationStatus,
)
from .services.import_service import (
    approve_draft_record,
    cancel_batch,
    create_import_batch,
    mark_manual_review,
    parse_excel_to_drafts,
    recalculate_batch_counts,
    reject_draft_record,
)


class ImportListView(LoginRequiredMixin, ListView):
    model = ImportBatch
    template_name = "imports/list.html"
    context_object_name = "batches"
    paginate_by = 30
    ordering = ["-created_at"]

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["pending_review"] = ImportBatch.objects.filter(
            status__in=[ImportBatchStatus.PARSED, ImportBatchStatus.NEEDS_REVIEW]
        ).count()
        return ctx


class ImportNewView(LoginRequiredMixin, FormView):
    template_name = "imports/new.html"
    form_class = ImportUploadForm

    def form_valid(self, form):
        f = form.cleaned_data["file"]
        source_type = form.cleaned_data["source_type"]
        target_module = form.cleaned_data["target_module"]
        title = form.cleaned_data["title"]
        historical = form.cleaned_data["historical_data"]

        # 1) Document yarat (sha256 dedup)
        doc, created = Document.get_or_create_from_file(
            f,
            uploaded_by=self.request.user,
            document_type=DocumentType.IMPORT_SOURCE,
            source=DocumentSource.IMPORT,
            title=title or f.name,
        )
        if created:
            audit_log(actor=self.request.user, action="CREATE", obj=doc,
                      summary=f"Import kaynak yüklendi: {doc.original_filename}",
                      request=self.request)

        # 2) Batch yarat
        batch = create_import_batch(
            user=self.request.user,
            source_type=source_type,
            target_module=target_module,
            title=title or f.name,
            historical_data=historical,
            metadata={"document_id": doc.pk, "dedup_hit": not created},
        )

        # 3) Source file bağla
        from .services.import_service import attach_source_file
        attach_source_file(batch=batch, document=doc, original_path=f.name)

        # 4) Excel ise parse
        if source_type == ImportSourceType.EXCEL and (doc.extension or "").lower() in ("xlsx", "xlsm"):
            try:
                parse_excel_to_drafts(batch=batch, document=doc, user=self.request.user)
                messages.success(
                    self.request,
                    f"Import başarıyla parse edildi · {batch.row_count} satır draft.",
                )
            except Exception as exc:  # noqa: BLE001
                from .models import ImportLog, ImportLogLevel
                ImportLog.objects.create(
                    batch=batch, level=ImportLogLevel.ERROR, code="PARSE_FAILED",
                    message=str(exc)[:500],
                )
                batch.status = ImportBatchStatus.FAILED
                batch.save(update_fields=["status", "updated_at"])
                messages.error(self.request, f"Parse hatası: {exc}")
        else:
            messages.warning(
                self.request,
                f"Faz 3'te yalnızca Excel parse edilir; {source_type} kaynağı için draft yaratılmadı.",
            )

        return HttpResponseRedirect(reverse("imports:detail", kwargs={"batch_id": str(batch.batch_id)}))


class ImportDetailView(LoginRequiredMixin, DetailView):
    model = ImportBatch
    template_name = "imports/detail.html"
    context_object_name = "batch"
    slug_field = "batch_id"
    slug_url_kwarg = "batch_id"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["source_files"] = self.object.source_files.select_related("document").all()
        ctx["recent_logs"] = self.object.logs.all()[:20]
        return ctx


class ImportPreviewView(LoginRequiredMixin, DetailView):
    model = ImportBatch
    template_name = "imports/preview.html"
    context_object_name = "batch"
    slug_field = "batch_id"
    slug_url_kwarg = "batch_id"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        filter_param = self.request.GET.get("filter", "")
        qs = self.object.draft_records.select_related("source_file").all()
        if filter_param == "ok":
            qs = qs.filter(validation_status=ValidationStatus.OK)
        elif filter_param == "warning":
            qs = qs.filter(validation_status=ValidationStatus.WARNING)
        elif filter_param == "error":
            qs = qs.filter(validation_status=ValidationStatus.ERROR)
        elif filter_param == "manual":
            qs = qs.filter(validation_status=ValidationStatus.MANUAL_REVIEW)
        ctx["drafts"] = qs[:300]
        ctx["source_files"] = self.object.source_files.select_related("document").all()
        ctx["filter"] = filter_param
        return ctx


class DraftDetailView(LoginRequiredMixin, DetailView):
    model = ImportDraftRecord
    template_name = "imports/record_detail.html"
    context_object_name = "draft"
    pk_url_kwarg = "pk"

    def get_queryset(self):
        return ImportDraftRecord.objects.select_related("batch", "source_file__document").filter(
            batch__batch_id=self.kwargs["batch_id"],
        )


class _DraftActionView(LoginRequiredMixin, View):
    action: str = ""

    def post(self, request, batch_id, pk):
        draft = get_object_or_404(
            ImportDraftRecord.objects.filter(batch__batch_id=batch_id), pk=pk,
        )
        if self.action == "approve":
            approve_draft_record(draft=draft, user=request.user)
            messages.success(request, f"Satır #{draft.source_row_number} onaylandı.")
        elif self.action == "reject":
            reason = request.POST.get("reason", "")
            reject_draft_record(draft=draft, user=request.user, reason=reason)
            messages.warning(request, f"Satır #{draft.source_row_number} reddedildi.")
        elif self.action == "manual":
            mark_manual_review(draft=draft, user=request.user, message=request.POST.get("message", ""))
            messages.info(request, f"Satır #{draft.source_row_number} manuel incelemeye işaretlendi.")
        recalculate_batch_counts(draft.batch)
        return HttpResponseRedirect(
            reverse("imports:preview", kwargs={"batch_id": batch_id})
        )


class DraftApproveView(_DraftActionView):
    action = "approve"


class DraftRejectView(_DraftActionView):
    action = "reject"


class DraftManualReviewView(_DraftActionView):
    action = "manual"


class BatchCancelView(LoginRequiredMixin, View):
    def post(self, request, batch_id):
        batch = get_object_or_404(ImportBatch, batch_id=batch_id)
        cancel_batch(batch=batch, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, f"Import iptal edildi: {batch.short_id}")
        return HttpResponseRedirect(reverse("imports:detail", kwargs={"batch_id": str(batch.batch_id)}))
