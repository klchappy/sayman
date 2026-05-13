"""Entegratör/Yazılım Hizmeti & Kontör views (Faz 9)."""
from datetime import timedelta
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import ValidationError
from django.db.models import Sum
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils import timezone
from django.views.generic import (
    CreateView, DetailView, FormView, ListView, TemplateView, UpdateView, View,
)

from apps.audit.models import AuditLog
from apps.finance.permissions import can_approve, can_write

from .forms import (
    ContractRenewForm, CreditPackageForm, CreditUsageUpdateForm,
    IntegratorDocumentUploadForm, ServiceContractForm, SoftwareServiceForm,
)
from .models import (
    ContractStatus, CreditPackage, CreditPackageStatus, ProviderType,
    ServiceContract, ServiceStatus, ServiceType, SoftwareService,
)
from .services.integrators import (
    archive_service, attach_integrator_document, cancel_contract,
    cancel_credit_package, cancel_service, create_contract,
    create_credit_package, create_payable_from_contract,
    create_payable_from_credit_package, create_service, renew_contract,
    restore_service, update_contract, update_credit_usage, update_service,
)


class WriteMixin(UserPassesTestMixin):
    raise_exception = True
    def test_func(self):
        return can_write(self.request.user)


class ApproveMixin(UserPassesTestMixin):
    """Renew / cancel için Muhasebe Müdürü+ rolü."""
    raise_exception = True
    def test_func(self):
        return can_approve(self.request.user)


# === List / Dashboard =====================================================

class ServiceListView(LoginRequiredMixin, TemplateView):
    template_name = "integrators/service_list.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        today = timezone.localdate()
        qs = SoftwareService.objects.filter(is_active=True)

        provider = self.request.GET.get("provider")
        stype = self.request.GET.get("service_type")
        status = self.request.GET.get("status")
        critical = self.request.GET.get("critical")
        if provider:
            qs = qs.filter(provider_type=provider)
        if stype:
            qs = qs.filter(service_type=stype)
        if status:
            qs = qs.filter(status=status)

        ctx["services"] = qs.select_related(
            "owner_company", "owner_person",
        ).order_by("provider_name", "title")[:200]

        active_qs = SoftwareService.objects.filter(
            is_active=True, status=ServiceStatus.ACTIVE
        )
        approaching_contracts = ServiceContract.objects.filter(
            is_active=True,
            status__in=[ContractStatus.ACTIVE, ContractStatus.APPROACHING],
        ).filter(
            renewal_date__gte=today,
            renewal_date__lte=today + timedelta(days=30),
        )
        critical_pkgs = CreditPackage.objects.filter(
            is_active=True,
            status__in=[CreditPackageStatus.CRITICAL, CreditPackageStatus.EXHAUSTED],
        )
        if critical:
            ctx["services"] = [s for s in ctx["services"]
                                if s.credit_packages.filter(
                                    is_active=True,
                                    status__in=[CreditPackageStatus.CRITICAL,
                                                CreditPackageStatus.EXHAUSTED]
                                ).exists()]
        this_year = today.year
        year_total = ServiceContract.objects.filter(
            is_active=True, start_date__year=this_year,
        ).aggregate(t=Sum("amount"))["t"] or Decimal("0")
        missing_contract = active_qs.filter(contracts__isnull=True).count()

        ctx["kpis"] = {
            "active_services": active_qs.count(),
            "approaching_contracts": approaching_contracts.count(),
            "critical_credits": critical_pkgs.count(),
            "this_year_total": year_total,
            "missing_contract": missing_contract,
            "needs_review": SoftwareService.objects.filter(
                is_active=True, status=ServiceStatus.NEEDS_REVIEW
            ).count(),
        }
        ctx["provider_choices"] = ProviderType.choices
        ctx["service_type_choices"] = ServiceType.choices
        ctx["status_choices"] = ServiceStatus.choices
        ctx["filter_values"] = {
            "provider": provider, "service_type": stype,
            "status": status, "critical": critical,
        }
        ctx["can_write"] = can_write(self.request.user)
        ctx["can_approve"] = can_approve(self.request.user)
        return ctx


# === Service CRUD ========================================================

class ServiceCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = SoftwareService
    form_class = SoftwareServiceForm
    template_name = "integrators/service_form.html"

    def form_valid(self, form):
        obj = create_service(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Hizmet oluşturuldu.")
        return HttpResponseRedirect(reverse("integrators:detail", kwargs={"pk": obj.pk}))


class ServiceDetailView(LoginRequiredMixin, DetailView):
    model = SoftwareService
    template_name = "integrators/service_detail.html"
    context_object_name = "service"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["contracts"] = self.object.contracts.filter(is_active=True).order_by("-renewal_date")
        ctx["credit_packages"] = self.object.credit_packages.filter(is_active=True).order_by("-purchase_date")
        ctx["documents"] = self.object.documents.filter(is_active=True).select_related("document")
        ctx["doc_form"] = IntegratorDocumentUploadForm()
        ctx["audit_recent"] = AuditLog.objects.filter(
            object_id=str(self.object.pk),
            content_type__app_label="integrators",
        ).select_related("actor").order_by("-created_at")[:8]
        ctx["can_write"] = can_write(self.request.user)
        ctx["can_approve"] = can_approve(self.request.user)
        return ctx


class ServiceUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = SoftwareService
    form_class = SoftwareServiceForm
    template_name = "integrators/service_form.html"

    def form_valid(self, form):
        try:
            update_service(service=self.object, user=self.request.user, **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Güncellendi.")
        return HttpResponseRedirect(reverse("integrators:detail", kwargs={"pk": self.object.pk}))


class ServiceArchiveView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        s = get_object_or_404(SoftwareService, pk=pk)
        archive_service(service=s, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Hizmet arşivlendi.")
        return HttpResponseRedirect(reverse("integrators:detail", kwargs={"pk": pk}))


class ServiceRestoreView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        s = get_object_or_404(SoftwareService, pk=pk)
        restore_service(service=s, user=request.user)
        messages.success(request, "Hizmet geri alındı.")
        return HttpResponseRedirect(reverse("integrators:detail", kwargs={"pk": pk}))


class ServiceCancelView(LoginRequiredMixin, ApproveMixin, View):
    def post(self, request, pk):
        s = get_object_or_404(SoftwareService, pk=pk)
        cancel_service(service=s, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Hizmet iptal edildi.")
        return HttpResponseRedirect(reverse("integrators:detail", kwargs={"pk": pk}))


# === Contract ============================================================

class ContractCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "integrators/contract_form.html"
    form_class = ServiceContractForm

    def dispatch(self, request, *args, **kwargs):
        self.service = get_object_or_404(SoftwareService, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["service"] = self.service
        return ctx

    def form_valid(self, form):
        try:
            obj = create_contract(service=self.service, user=self.request.user,
                                    **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Sözleşme oluşturuldu.")
        return HttpResponseRedirect(reverse("integrators:contract_detail", kwargs={"pk": obj.pk}))


class ContractDetailView(LoginRequiredMixin, DetailView):
    model = ServiceContract
    template_name = "integrators/contract_detail.html"
    context_object_name = "contract"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["doc_form"] = IntegratorDocumentUploadForm()
        ctx["documents"] = self.object.documents.filter(is_active=True).select_related("document")
        ctx["can_write"] = can_write(self.request.user)
        ctx["can_approve"] = can_approve(self.request.user)
        return ctx


class ContractUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = ServiceContract
    form_class = ServiceContractForm
    template_name = "integrators/contract_form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["service"] = self.object.service
        return ctx

    def form_valid(self, form):
        try:
            update_contract(contract=self.object, user=self.request.user,
                              **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Sözleşme güncellendi.")
        return HttpResponseRedirect(reverse("integrators:contract_detail", kwargs={"pk": self.object.pk}))


class ContractCancelView(LoginRequiredMixin, ApproveMixin, View):
    def post(self, request, pk):
        c = get_object_or_404(ServiceContract, pk=pk)
        cancel_contract(contract=c, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Sözleşme iptal.")
        return HttpResponseRedirect(reverse("integrators:contract_detail", kwargs={"pk": pk}))


class ContractRenewView(LoginRequiredMixin, ApproveMixin, FormView):
    template_name = "integrators/contract_renew.html"
    form_class = ContractRenewForm

    def dispatch(self, request, *args, **kwargs):
        self.old = get_object_or_404(ServiceContract, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["old"] = self.old
        return ctx

    def form_valid(self, form):
        try:
            new = renew_contract(old=self.old, user=self.request.user,
                                   **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Yeni sözleşme oluşturuldu.")
        return HttpResponseRedirect(reverse("integrators:contract_detail", kwargs={"pk": new.pk}))


class ContractCreatePayableView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        c = get_object_or_404(ServiceContract, pk=pk)
        try:
            payable, created = create_payable_from_contract(contract=c, user=request.user)
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
            return HttpResponseRedirect(reverse("integrators:contract_detail", kwargs={"pk": pk}))
        if created:
            messages.success(request, "PayableItem oluşturuldu.")
        else:
            messages.info(request, "Bu sözleşmeye bağlı PayableItem zaten var.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": payable.pk}))


# === Credit Package ======================================================

class CreditPackageCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "integrators/credit_package_form.html"
    form_class = CreditPackageForm

    def dispatch(self, request, *args, **kwargs):
        self.service = get_object_or_404(SoftwareService, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["service"] = self.service
        return ctx

    def form_valid(self, form):
        try:
            obj = create_credit_package(service=self.service, user=self.request.user,
                                          **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Kontör paketi oluşturuldu.")
        return HttpResponseRedirect(reverse("integrators:credit_detail", kwargs={"pk": obj.pk}))


class CreditPackageDetailView(LoginRequiredMixin, DetailView):
    model = CreditPackage
    template_name = "integrators/credit_package_detail.html"
    context_object_name = "package"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["doc_form"] = IntegratorDocumentUploadForm()
        ctx["documents"] = self.object.documents.filter(is_active=True).select_related("document")
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class CreditPackageUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = CreditPackage
    form_class = CreditPackageForm
    template_name = "integrators/credit_package_form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["service"] = self.object.service
        return ctx

    def form_valid(self, form):
        for k, v in form.cleaned_data.items():
            setattr(self.object, k, v)
        from .services.integrators import calculate_credit_status
        self.object.status = calculate_credit_status(self.object)
        self.object.updated_by = self.request.user
        self.object.save()
        messages.success(self.request, "Paket güncellendi.")
        return HttpResponseRedirect(reverse("integrators:credit_detail", kwargs={"pk": self.object.pk}))


class CreditUsageUpdateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "integrators/credit_usage_update.html"
    form_class = CreditUsageUpdateForm

    def dispatch(self, request, *args, **kwargs):
        self.package = get_object_or_404(CreditPackage, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["package"] = self.package
        return ctx

    def form_valid(self, form):
        try:
            update_credit_usage(
                package=self.package, user=self.request.user,
                remaining_credits=form.cleaned_data["remaining_credits"],
                notes=form.cleaned_data.get("notes") or "",
            )
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Kalan kontör güncellendi.")
        return HttpResponseRedirect(reverse("integrators:credit_detail",
                                             kwargs={"pk": self.package.pk}))


class CreditPackageCancelView(LoginRequiredMixin, ApproveMixin, View):
    def post(self, request, pk):
        p = get_object_or_404(CreditPackage, pk=pk)
        cancel_credit_package(package=p, user=request.user,
                                reason=request.POST.get("reason", ""))
        messages.warning(request, "Kontör paketi iptal.")
        return HttpResponseRedirect(reverse("integrators:credit_detail", kwargs={"pk": pk}))


class CreditPackageCreatePayableView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        p = get_object_or_404(CreditPackage, pk=pk)
        try:
            payable, created = create_payable_from_credit_package(package=p, user=request.user)
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
            return HttpResponseRedirect(reverse("integrators:credit_detail", kwargs={"pk": pk}))
        if created:
            messages.success(request, "PayableItem oluşturuldu.")
        else:
            messages.info(request, "Bu pakete bağlı PayableItem zaten var.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": payable.pk}))


# === Document ============================================================

class IntegratorDocumentUploadView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "integrators/document_upload.html"
    form_class = IntegratorDocumentUploadForm

    def dispatch(self, request, *args, **kwargs):
        self.service = None
        self.contract = None
        self.package = None
        if "contract_pk" in kwargs:
            self.contract = get_object_or_404(ServiceContract, pk=kwargs["contract_pk"])
            self.service = self.contract.service
        elif "credit_pk" in kwargs:
            self.package = get_object_or_404(CreditPackage, pk=kwargs["credit_pk"])
            self.service = self.package.service
        elif "pk" in kwargs:
            self.service = get_object_or_404(SoftwareService, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["service"] = self.service
        ctx["contract"] = self.contract
        ctx["package"] = self.package
        return ctx

    def form_valid(self, form):
        attach_integrator_document(
            user=self.request.user,
            document=form.cleaned_data["document"],
            document_role=form.cleaned_data["document_role"],
            service=self.service, contract=self.contract,
            credit_package=self.package,
        )
        messages.success(self.request, "Belge bağlandı.")
        if self.contract:
            return HttpResponseRedirect(reverse("integrators:contract_detail",
                                                 kwargs={"pk": self.contract.pk}))
        if self.package:
            return HttpResponseRedirect(reverse("integrators:credit_detail",
                                                 kwargs={"pk": self.package.pk}))
        return HttpResponseRedirect(reverse("integrators:detail",
                                             kwargs={"pk": self.service.pk}))
