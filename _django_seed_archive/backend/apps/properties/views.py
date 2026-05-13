"""Emlak Vergisi & Mülk Takip — Faz 7 views."""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import ValidationError
from django.db.models import Count, Q, Sum
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.views.generic import (
    CreateView, DetailView, FormView, ListView, TemplateView, UpdateView, View,
)

from apps.finance.permissions import can_write
from apps.parties.models import PropertyAsset

from .forms import (
    MarkSoldForm, MunicipalityForm, PropertyAssetForm,
    PropertyTaxDocumentUploadForm, PropertyTaxInstallmentForm,
    PropertyTaxYearForm,
)
from .models import (
    InstallmentStatus, Municipality, PropertyTaxInstallment, PropertyTaxYear,
    TaxYearStatus,
)
from .services.property_tax import (
    attach_tax_document, calculate_tax_year_totals, cancel_installment,
    cancel_property_tax_year, create_installment, create_municipality,
    create_payable_from_installment, create_property_asset,
    create_property_tax_year, generate_default_installments,
    mark_property_sold, update_property_asset, update_property_tax_year,
)


class WriteMixin(UserPassesTestMixin):
    raise_exception = True
    def test_func(self):
        return can_write(self.request.user)


# === Dashboard ============================================================

class PropertiesDashboardView(LoginRequiredMixin, TemplateView):
    template_name = "properties/dashboard.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        today = timezone.localdate()
        this_year = today.year

        ctx["assets_active"] = (
            PropertyAsset.objects.filter(is_active=True)
            .exclude(status__in=["SOLD", "PASSIVE"]).order_by("name")
        )
        ctx["assets_inactive"] = (
            PropertyAsset.objects.filter(is_active=True, status__in=["SOLD", "PASSIVE"])
            .order_by("name")
        )

        tax_years_qs = (
            PropertyTaxYear.objects.filter(is_active=True, tax_year=this_year)
            .select_related("property_asset", "municipality")
            .order_by("property_asset__name")
        )
        ctx["tax_years"] = tax_years_qs

        upcoming_window = today + timedelta(days=45)
        ctx["upcoming_installments"] = (
            PropertyTaxInstallment.objects.filter(
                is_active=True,
                due_date__gte=today, due_date__lte=upcoming_window,
                status__in=[InstallmentStatus.PENDING, InstallmentStatus.LINKED],
            ).select_related("tax_year__property_asset", "tax_year__municipality")
            .order_by("due_date")
        )
        ctx["overdue_installments"] = (
            PropertyTaxInstallment.objects.filter(
                is_active=True, due_date__lt=today,
                status__in=[InstallmentStatus.PENDING, InstallmentStatus.LINKED,
                            InstallmentStatus.OVERDUE],
            ).select_related("tax_year__property_asset")
            .order_by("due_date")
        )
        ctx["paid_no_receipt"] = (
            PropertyTaxInstallment.objects.filter(
                is_active=True, status=InstallmentStatus.PAID,
            ).annotate(doc_count=Count("documents"))
            .filter(doc_count=0)
            .select_related("tax_year__property_asset")[:30]
        )

        ctx["municipalities"] = Municipality.objects.filter(is_active=True).order_by("name")
        ctx["this_year"] = this_year
        ctx["can_write"] = can_write(self.request.user)
        return ctx


# === PropertyAsset =========================================================

class AssetCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = PropertyAsset
    form_class = PropertyAssetForm
    template_name = "properties/asset_form.html"

    def form_valid(self, form):
        obj = create_property_asset(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Mülk oluşturuldu.")
        return HttpResponseRedirect(reverse("properties:asset_detail", kwargs={"pk": obj.pk}))


class AssetDetailView(LoginRequiredMixin, DetailView):
    model = PropertyAsset
    template_name = "properties/asset_detail.html"
    context_object_name = "asset"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["tax_years"] = (
            self.object.tax_years.filter(is_active=True)
            .select_related("municipality").order_by("-tax_year")
        )
        ctx["mark_sold_form"] = MarkSoldForm()
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class AssetUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = PropertyAsset
    form_class = PropertyAssetForm
    template_name = "properties/asset_form.html"

    def form_valid(self, form):
        update_property_asset(asset=self.object, user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Güncellendi.")
        return HttpResponseRedirect(reverse("properties:asset_detail", kwargs={"pk": self.object.pk}))


class AssetMarkSoldView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        asset = get_object_or_404(PropertyAsset, pk=pk)
        form = MarkSoldForm(request.POST)
        if not form.is_valid():
            messages.error(request, "Tarih geçersiz.")
            return HttpResponseRedirect(reverse("properties:asset_detail", kwargs={"pk": pk}))
        mark_property_sold(
            asset=asset, user=request.user,
            sale_date=form.cleaned_data["sale_date"],
            buyer_name=form.cleaned_data["buyer_name"] or "",
        )
        messages.success(request, "Mülk satıldı olarak işaretlendi (tarihçe korunur).")
        return HttpResponseRedirect(reverse("properties:asset_detail", kwargs={"pk": pk}))


# === Municipality ==========================================================

class MunicipalityListView(LoginRequiredMixin, ListView):
    model = Municipality
    template_name = "properties/municipality_list.html"
    context_object_name = "municipalities"

    def get_queryset(self):
        return Municipality.objects.filter(is_active=True).order_by("name")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class MunicipalityCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = Municipality
    form_class = MunicipalityForm
    template_name = "properties/municipality_form.html"

    def form_valid(self, form):
        create_municipality(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Belediye eklendi.")
        return HttpResponseRedirect(reverse("properties:municipality_list"))


# === Tax Year ==============================================================

class TaxYearCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "properties/tax_year_form.html"
    form_class = PropertyTaxYearForm

    def form_valid(self, form):
        cd = form.cleaned_data
        try:
            obj = create_property_tax_year(
                user=self.request.user,
                property_asset=cd["property_asset"],
                tax_year=cd["tax_year"],
                municipality=cd.get("municipality"),
                total_accrual_amount=cd.get("total_accrual_amount") or Decimal("0"),
                notes=cd.get("notes") or "",
            )
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Vergi yılı oluşturuldu.")
        return HttpResponseRedirect(reverse("properties:tax_year_detail", kwargs={"pk": obj.pk}))


class TaxYearDetailView(LoginRequiredMixin, DetailView):
    model = PropertyTaxYear
    template_name = "properties/tax_year_detail.html"
    context_object_name = "tax_year"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["installments"] = self.object.installments.filter(is_active=True).order_by("installment_no")
        ctx["documents"] = self.object.documents.filter(is_active=True).select_related("document")
        ctx["doc_form"] = PropertyTaxDocumentUploadForm()
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class TaxYearUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = PropertyTaxYear
    form_class = PropertyTaxYearForm
    template_name = "properties/tax_year_form.html"

    def form_valid(self, form):
        try:
            update_property_tax_year(
                tax_year=self.object, user=self.request.user, **form.cleaned_data
            )
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Güncellendi.")
        return HttpResponseRedirect(reverse("properties:tax_year_detail", kwargs={"pk": self.object.pk}))


class TaxYearCancelView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        ty = get_object_or_404(PropertyTaxYear, pk=pk)
        cancel_property_tax_year(tax_year=ty, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Vergi yılı iptal edildi.")
        return HttpResponseRedirect(reverse("properties:tax_year_detail", kwargs={"pk": pk}))


class TaxYearGenerateInstallmentsView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        ty = get_object_or_404(PropertyTaxYear, pk=pk)
        created = generate_default_installments(tax_year=ty, user=request.user)
        if created:
            messages.success(request, f"{len(created)} taksit yaratıldı (1./2.).")
        else:
            messages.info(request, "Bu yıl için taksitler zaten var.")
        return HttpResponseRedirect(reverse("properties:tax_year_detail", kwargs={"pk": pk}))


# === Installment ===========================================================

class InstallmentCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "properties/installment_form.html"
    form_class = PropertyTaxInstallmentForm

    def dispatch(self, request, *args, **kwargs):
        self.tax_year = get_object_or_404(PropertyTaxYear, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["tax_year"] = self.tax_year
        return ctx

    def form_valid(self, form):
        cd = form.cleaned_data
        try:
            obj = create_installment(
                tax_year=self.tax_year, user=self.request.user,
                installment_no=cd["installment_no"],
                due_date=cd.get("due_date"),
                amount=cd.get("amount") or Decimal("0"),
                notes=cd.get("notes") or "",
            )
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Taksit oluşturuldu.")
        return HttpResponseRedirect(reverse("properties:installment_detail", kwargs={"pk": obj.pk}))


class InstallmentDetailView(LoginRequiredMixin, DetailView):
    model = PropertyTaxInstallment
    template_name = "properties/installment_detail.html"
    context_object_name = "installment"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["doc_form"] = PropertyTaxDocumentUploadForm()
        ctx["documents"] = self.object.documents.filter(is_active=True).select_related("document")
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class InstallmentUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = PropertyTaxInstallment
    form_class = PropertyTaxInstallmentForm
    template_name = "properties/installment_form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["tax_year"] = self.object.tax_year
        return ctx

    def form_valid(self, form):
        for k, v in form.cleaned_data.items():
            setattr(self.object, k, v)
        self.object.updated_by = self.request.user
        self.object.save()
        calculate_tax_year_totals(self.object.tax_year)
        messages.success(self.request, "Taksit güncellendi.")
        return HttpResponseRedirect(reverse("properties:installment_detail", kwargs={"pk": self.object.pk}))


class InstallmentCancelView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        inst = get_object_or_404(PropertyTaxInstallment, pk=pk)
        cancel_installment(installment=inst, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Taksit iptal edildi.")
        return HttpResponseRedirect(reverse("properties:installment_detail", kwargs={"pk": pk}))


class InstallmentCreatePayableView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        inst = get_object_or_404(PropertyTaxInstallment, pk=pk)
        try:
            payable, created = create_payable_from_installment(
                installment=inst, user=request.user,
            )
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
            return HttpResponseRedirect(reverse("properties:installment_detail", kwargs={"pk": pk}))
        if created:
            messages.success(request, "PayableItem oluşturuldu.")
        else:
            messages.info(request, "Bu taksite bağlı PayableItem zaten var.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": payable.pk}))


# === Document ==============================================================

class DocumentUploadView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "properties/document_upload.html"
    form_class = PropertyTaxDocumentUploadForm

    def dispatch(self, request, *args, **kwargs):
        self.installment = None
        self.tax_year = None
        if "inst_pk" in kwargs:
            self.installment = get_object_or_404(PropertyTaxInstallment, pk=kwargs["inst_pk"])
            self.tax_year = self.installment.tax_year
        elif "year_pk" in kwargs:
            self.tax_year = get_object_or_404(PropertyTaxYear, pk=kwargs["year_pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["installment"] = self.installment
        ctx["tax_year"] = self.tax_year
        return ctx

    def form_valid(self, form):
        attach_tax_document(
            user=self.request.user,
            document=form.cleaned_data["document"],
            document_role=form.cleaned_data["document_role"],
            tax_year=self.tax_year,
            installment=self.installment,
        )
        messages.success(self.request, "Belge bağlandı.")
        if self.installment:
            return HttpResponseRedirect(
                reverse("properties:installment_detail", kwargs={"pk": self.installment.pk})
            )
        return HttpResponseRedirect(
            reverse("properties:tax_year_detail", kwargs={"pk": self.tax_year.pk})
        )
