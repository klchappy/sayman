from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import ValidationError
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.generic import (
    CreateView, DetailView, FormView, ListView, TemplateView, UpdateView, View,
)

from apps.finance.permissions import can_write

from .forms import (
    AidatDifferenceForm, MarkSoldForm, SiteDocumentForm, StatementDocumentUploadForm,
    StatementForm, UnitForm,
)
from .models import (
    PruvaAidatDifference, PruvaSiteDocument, PruvaStatement, PruvaUnit,
    UnitStatus,
)
from .services.pruva import (
    archive_unit, attach_site_document, attach_statement_document,
    cancel_aidat_difference, cancel_statement, create_aidat_difference,
    create_payable_from_statement, create_statement, create_unit,
    mark_unit_sold, restore_unit, update_statement, update_unit,
)


class WriteMixin(UserPassesTestMixin):
    raise_exception = True
    def test_func(self):
        return can_write(self.request.user)


# === Dashboard ============================================================

class PruvaDashboardView(LoginRequiredMixin, TemplateView):
    template_name = "pruva/dashboard.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["units"] = PruvaUnit.objects.filter(is_active=True).order_by("code")
        ctx["recent_statements"] = (
            PruvaStatement.objects.filter(is_active=True)
            .select_related("unit", "payable")
            .order_by("-year", "-month")[:30]
        )
        ctx["open_diffs"] = PruvaAidatDifference.objects.filter(
            is_active=True, status="OPEN"
        ).select_related("unit", "person")[:20]
        ctx["site_docs"] = PruvaSiteDocument.objects.filter(is_active=True).order_by("-year")[:10]
        ctx["can_write"] = can_write(self.request.user)
        return ctx


# === Unit =================================================================

class UnitCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = PruvaUnit
    form_class = UnitForm
    template_name = "pruva/unit_form.html"

    def form_valid(self, form):
        obj = create_unit(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Daire oluşturuldu.")
        return HttpResponseRedirect(reverse("pruva:unit_detail", kwargs={"pk": obj.pk}))


class UnitDetailView(LoginRequiredMixin, DetailView):
    model = PruvaUnit
    template_name = "pruva/unit_detail.html"
    context_object_name = "unit"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["statements"] = self.object.statements.select_related("payable").order_by("-year", "-month")[:60]
        ctx["differences"] = self.object.aidat_differences.order_by("-date")[:30]
        ctx["mark_sold_form"] = MarkSoldForm()
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class UnitUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = PruvaUnit
    form_class = UnitForm
    template_name = "pruva/unit_form.html"

    def form_valid(self, form):
        update_unit(unit=self.object, user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Güncellendi.")
        return HttpResponseRedirect(reverse("pruva:unit_detail", kwargs={"pk": self.object.pk}))


class UnitArchiveView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        u = get_object_or_404(PruvaUnit, pk=pk)
        if u.is_active:
            archive_unit(unit=u, user=request.user, reason=request.POST.get("reason", ""))
            messages.warning(request, "Daire pasifleştirildi.")
        else:
            restore_unit(unit=u, user=request.user)
            messages.success(request, "Daire aktif edildi.")
        return HttpResponseRedirect(reverse("pruva:unit_detail", kwargs={"pk": pk}))


class UnitMarkSoldView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        u = get_object_or_404(PruvaUnit, pk=pk)
        form = MarkSoldForm(request.POST)
        if not form.is_valid():
            messages.error(request, "Tarih geçersiz.")
            return HttpResponseRedirect(reverse("pruva:unit_detail", kwargs={"pk": pk}))
        mark_unit_sold(
            unit=u, user=request.user,
            sale_date=form.cleaned_data["sale_date"],
            buyer_name=form.cleaned_data["buyer_name"] or "",
        )
        messages.success(request, "Daire 'Satıldı' olarak işaretlendi (tarihçe korunur).")
        return HttpResponseRedirect(reverse("pruva:unit_detail", kwargs={"pk": pk}))


# === Statement ============================================================

class StatementCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "pruva/statement_form.html"
    form_class = StatementForm

    def dispatch(self, request, *args, **kwargs):
        self.unit = get_object_or_404(PruvaUnit, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["unit"] = self.unit
        return ctx

    def form_valid(self, form):
        try:
            obj = create_statement(unit=self.unit, user=self.request.user, **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Ekstre oluşturuldu.")
        return HttpResponseRedirect(reverse("pruva:statement_detail", kwargs={"pk": obj.pk}))


class StatementDetailView(LoginRequiredMixin, DetailView):
    model = PruvaStatement
    template_name = "pruva/statement_detail.html"
    context_object_name = "statement"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["doc_form"] = StatementDocumentUploadForm()
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class StatementUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = PruvaStatement
    form_class = StatementForm
    template_name = "pruva/statement_form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["unit"] = self.object.unit
        return ctx

    def form_valid(self, form):
        try:
            update_statement(statement=self.object, user=self.request.user, **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Güncellendi.")
        return HttpResponseRedirect(reverse("pruva:statement_detail", kwargs={"pk": self.object.pk}))


class StatementCancelView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        s = get_object_or_404(PruvaStatement, pk=pk)
        cancel_statement(statement=s, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Ekstre iptal edildi.")
        return HttpResponseRedirect(reverse("pruva:statement_detail", kwargs={"pk": pk}))


class StatementCreatePayableView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        s = get_object_or_404(PruvaStatement, pk=pk)
        try:
            payable, created = create_payable_from_statement(statement=s, user=request.user)
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
            return HttpResponseRedirect(reverse("pruva:statement_detail", kwargs={"pk": pk}))
        if created:
            messages.success(request, "PayableItem oluşturuldu.")
        else:
            messages.info(request, "Bu ekstreye bağlı PayableItem zaten var.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": payable.pk}))


class StatementDocumentUploadView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "pruva/statement_document_upload.html"
    form_class = StatementDocumentUploadForm

    def dispatch(self, request, *args, **kwargs):
        self.statement = get_object_or_404(PruvaStatement, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["statement"] = self.statement
        return ctx

    def form_valid(self, form):
        attach_statement_document(
            statement=self.statement, user=self.request.user,
            document=form.cleaned_data["document"],
            document_role=form.cleaned_data["document_role"],
        )
        messages.success(self.request, "Belge bağlandı.")
        return HttpResponseRedirect(reverse("pruva:statement_detail",
                                            kwargs={"pk": self.statement.pk}))


# === Aidat Difference =====================================================

class AidatDifferenceListView(LoginRequiredMixin, ListView):
    model = PruvaAidatDifference
    template_name = "pruva/aidat_difference_list.html"
    context_object_name = "differences"
    paginate_by = 30

    def get_queryset(self):
        return (
            PruvaAidatDifference.objects.filter(is_active=True)
            .select_related("unit", "person", "company").order_by("-date")
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class AidatDifferenceCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = PruvaAidatDifference
    form_class = AidatDifferenceForm
    template_name = "pruva/aidat_difference_form.html"

    def form_valid(self, form):
        create_aidat_difference(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Aidat farkı eklendi.")
        return HttpResponseRedirect(reverse("pruva:aidat_difference_list"))


class AidatDifferenceCancelView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        d = get_object_or_404(PruvaAidatDifference, pk=pk)
        cancel_aidat_difference(diff=d, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Kayıt iptal edildi.")
        return HttpResponseRedirect(reverse("pruva:aidat_difference_list"))


# === Site Document ========================================================

class SiteDocumentListView(LoginRequiredMixin, ListView):
    model = PruvaSiteDocument
    template_name = "pruva/site_document_list.html"
    context_object_name = "site_documents"
    paginate_by = 30

    def get_queryset(self):
        return PruvaSiteDocument.objects.filter(is_active=True).select_related("document", "related_unit").order_by("-year", "-created_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class SiteDocumentCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = PruvaSiteDocument
    form_class = SiteDocumentForm
    template_name = "pruva/site_document_form.html"

    def form_valid(self, form):
        attach_site_document(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Site belgesi eklendi.")
        return HttpResponseRedirect(reverse("pruva:site_document_list"))
