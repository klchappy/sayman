import os

from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.views.generic import DetailView, ListView, View

from apps.audit.services import audit_log

from .models import Document
from .permissions import can_download_document


class DocumentListView(LoginRequiredMixin, ListView):
    model = Document
    template_name = "documents/list.html"
    context_object_name = "documents"
    paginate_by = 50
    ordering = ["-uploaded_at"]


class DocumentDetailView(LoginRequiredMixin, DetailView):
    model = Document
    template_name = "documents/detail.html"
    context_object_name = "document"


class DocumentDownloadView(LoginRequiredMixin, View):
    """
    Yetki kontrollü download — Faz 15 sertleştirildi.

    Object-level permission: `apps.documents.permissions.can_download_document`.
    İlerleyen sürümlerde nginx X-Accel-Redirect ile servis edilebilir; şu an
    Django `FileResponse` üzerinden stream edilir.
    """

    def get(self, request, pk):
        doc = get_object_or_404(Document, pk=pk)
        if not doc.file:
            raise Http404("Dosya yok")

        # Faz 15 B4: object-level permission
        if not can_download_document(request.user, doc):
            audit_log(
                actor=request.user, action="VIEW",
                summary=(
                    f"İndirme reddedildi: doc#{doc.pk} {doc.original_filename}"
                )[:255],
                metadata={"document_id": doc.pk, "result": "DENIED"},
                request=request,
            )
            raise PermissionDenied("Bu belgeye erişiminiz yok.")

        audit_log(
            actor=request.user, action="VIEW", obj=doc,
            summary=f"İndirme: {doc.original_filename}",
            request=request,
        )
        # FileField storage path
        try:
            f = doc.file.open("rb")
        except FileNotFoundError as exc:
            raise Http404("Dosya bulunamadı") from exc

        response = FileResponse(f, as_attachment=True, filename=doc.original_filename or os.path.basename(doc.file.name))
        return response
