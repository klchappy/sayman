"""Teminat Mektupları & Komisyon — Faz 8 views."""
from datetime import timedelta
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import ValidationError
from django.db.models import Q, Sum
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.views.generic import (
    CreateView, DetailView, FormView, ListView, TemplateView, UpdateView, View,
)

from apps.audit.models import AuditLog
from apps.finance.permissions import can_approve, can_write

from .forms import (
    GuaranteeCommissionPeriodForm, GuaranteeDocumentUploadForm,
    GuaranteeLetterForm, GuaranteeRenewForm, GuaranteeReturnForm,
)
from .models import (
    CommissionStatus, GuaranteeCommissionPeriod, GuaranteeLetter,
    GuaranteeStatus,
)
from .services.guarantees import (
    archive_guarantee, attach_guarantee_document, cancel_commission_period,
    cancel_guarantee, create_commission_period, create_guarantee,
    create_payable_from_commission, generate_commission_periods,
    renew_guarantee, restore_guarantee, return_guarantee, update_guarantee,
)


class WriteMixin(UserPassesTestMixin):
    raise_exception = True
    def test_func(self):
        return can_write(self.request.user)


class ApproveMixin(UserPassesTestMixin):
    """Return / renew / cancel için Muhasebe Müdürü+ rolü."""
    raise_exception = True
    def test_func(self):
        return can_approve(self.request.user)


# === Dashboard / List =====================================================

class GuaranteeListView(LoginRequiredMixin, TemplateView):
    template_name = "guarantees/guarantee_list.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        today = timezone.localdate()
        qs = GuaranteeLetter.objects.filter(is_active=True)

        # Filtreler
        bank_id = self.request.GET.get("bank")
        inst_id = self.request.GET.get("institution")
        period = self.request.GET.get("period")
        status = self.request.GET.get("status")
        if bank_id:
            qs = qs.filter(bank_id=bank_id)
        if inst_id:
            qs = qs.filter(beneficiary_institution_id=inst_id)
        if period:
            qs = qs.filter(commission_period=period)
        if status:
            qs = qs.filter(status=status)

        ctx["guarantees"] = qs.select_related(
            "bank", "beneficiary_institution", "owner_company", "owner_person",
        ).order_by("-issue_date")[:200]

        active_qs = GuaranteeLetter.objects.filter(
            is_active=True, status__in=[GuaranteeStatus.ACTIVE, GuaranteeStatus.APPROACHING]
        )
        ctx["kpis"] = {
            "active_count": active_qs.count(),
            "total_amount": active_qs.aggregate(t=Sum("amount"))["t"] or Decimal("0"),
            "this_month_commission": GuaranteeCommissionPeriod.objects.filter(
                is_active=True, due_date__year=today.year,
                due_date__month=today.month,
            ).aggregate(t=Sum("commission_amount"))["t"] or Decimal("0"),
            "overdue_commission": GuaranteeCommissionPeriod.objects.filter(
                is_active=True, due_date__lt=today,
                status__in=[CommissionStatus.PENDING, CommissionStatus.LINKED,
                            CommissionStatus.OVERDUE],
            ).count(),
            "returning": GuaranteeLetter.objects.filter(
                is_active=True, status=GuaranteeStatus.APPROACHING
            ).count(),
            "needs_review": GuaranteeLetter.objects.filter(
                is_active=True, status=GuaranteeStatus.NEEDS_REVIEW
            ).count(),
        }

        from apps.parties.models import Bank, Institution
        ctx["banks"] = Bank.objects.all().order_by("name")
        ctx["institutions"] = Institution.objects.all().order_by("name")
        ctx["filter_values"] = {
            "bank": bank_id, "institution": inst_id,
            "period": period, "status": status,
        }
        ctx["status_choices"] = GuaranteeStatus.choices
        ctx["period_choices"] = GuaranteeLetter._meta.get_field("commission_period").choices
        ctx["can_write"] = can_write(self.request.user)
        ctx["can_approve"] = can_approve(self.request.user)
        return ctx


# === Guarantee CRUD ======================================================

class GuaranteeCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = GuaranteeLetter
    form_class = GuaranteeLetterForm
    template_name = "guarantees/guarantee_form.html"

    def form_valid(self, form):
        obj = create_guarantee(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Teminat mektubu oluşturuldu.")
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": obj.pk}))


class GuaranteeDetailView(LoginRequiredMixin, DetailView):
    model = GuaranteeLetter
    template_name = "guarantees/guarantee_detail.html"
    context_object_name = "guarantee"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["periods"] = self.object.commission_periods.filter(is_active=True).order_by("-due_date")
        ctx["documents"] = self.object.documents.filter(is_active=True).select_related("document")
        ctx["doc_form"] = GuaranteeDocumentUploadForm()
        ctx["return_form"] = GuaranteeReturnForm()
        ctx["audit_recent"] = AuditLog.objects.filter(
            object_id=str(self.object.pk),
            content_type__app_label="guarantees",
        ).select_related("actor").order_by("-created_at")[:8]
        ctx["can_write"] = can_write(self.request.user)
        ctx["can_approve"] = can_approve(self.request.user)
        return ctx


class GuaranteeUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = GuaranteeLetter
    form_class = GuaranteeLetterForm
    template_name = "guarantees/guarantee_form.html"

    def form_valid(self, form):
        try:
            update_guarantee(guarantee=self.object, user=self.request.user, **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Güncellendi.")
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": self.object.pk}))


class GuaranteeArchiveView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        g = get_object_or_404(GuaranteeLetter, pk=pk)
        archive_guarantee(guarantee=g, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Teminat arşivlendi.")
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": pk}))


class GuaranteeRestoreView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        g = get_object_or_404(GuaranteeLetter, pk=pk)
        restore_guarantee(guarantee=g, user=request.user)
        messages.success(request, "Teminat geri alındı.")
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": pk}))


class GuaranteeCancelView(LoginRequiredMixin, ApproveMixin, View):
    def post(self, request, pk):
        g = get_object_or_404(GuaranteeLetter, pk=pk)
        cancel_guarantee(guarantee=g, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Teminat iptal edildi.")
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": pk}))


class GuaranteeReturnView(LoginRequiredMixin, ApproveMixin, View):
    template_name = "guarantees/guarantee_return.html"

    def get(self, request, pk):
        g = get_object_or_404(GuaranteeLetter, pk=pk)
        from django.shortcuts import render
        return render(request, self.template_name, {
            "guarantee": g, "form": GuaranteeReturnForm(),
        })

    def post(self, request, pk):
        g = get_object_or_404(GuaranteeLetter, pk=pk)
        form = GuaranteeReturnForm(request.POST)
        if not form.is_valid():
            messages.error(request, "Form geçersiz.")
            return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": pk}))
        try:
            return_guarantee(
                guarantee=g, user=request.user,
                returned_at=form.cleaned_data["returned_at"],
                notes=form.cleaned_data.get("notes") or "",
            )
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
            return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": pk}))
        messages.success(request, "Teminat iade işaretlendi.")
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": pk}))


class GuaranteeRenewView(LoginRequiredMixin, ApproveMixin, FormView):
    template_name = "guarantees/guarantee_renew.html"
    form_class = GuaranteeRenewForm

    def dispatch(self, request, *args, **kwargs):
        self.old = get_object_or_404(GuaranteeLetter, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["old"] = self.old
        return ctx

    def form_valid(self, form):
        try:
            new = renew_guarantee(old=self.old, user=self.request.user, **form.cleaned_data)
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Yeni mektup oluşturuldu.")
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": new.pk}))


# === Commission Period ====================================================

class CommissionPeriodCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "guarantees/commission_period_form.html"
    form_class = GuaranteeCommissionPeriodForm

    def dispatch(self, request, *args, **kwargs):
        self.guarantee = get_object_or_404(GuaranteeLetter, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["guarantee"] = self.guarantee
        return ctx

    def form_valid(self, form):
        cd = form.cleaned_data
        try:
            obj = create_commission_period(
                guarantee=self.guarantee, user=self.request.user,
                period_label=cd["period_label"], due_date=cd["due_date"],
                commission_amount=cd.get("commission_amount"),
                notes=cd.get("notes") or "",
                source=cd.get("source") or "MANUAL",
            )
        except ValidationError as e:
            messages.error(self.request, "; ".join(e.messages))
            return self.form_invalid(form)
        messages.success(self.request, "Komisyon dönemi oluşturuldu.")
        return HttpResponseRedirect(reverse("guarantees:period_detail", kwargs={"pk": obj.pk}))


class CommissionPeriodDetailView(LoginRequiredMixin, DetailView):
    model = GuaranteeCommissionPeriod
    template_name = "guarantees/commission_period_detail.html"
    context_object_name = "period"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["doc_form"] = GuaranteeDocumentUploadForm()
        ctx["documents"] = self.object.documents.filter(is_active=True).select_related("document")
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class CommissionPeriodUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = GuaranteeCommissionPeriod
    form_class = GuaranteeCommissionPeriodForm
    template_name = "guarantees/commission_period_form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["guarantee"] = self.object.guarantee
        return ctx

    def form_valid(self, form):
        for k, v in form.cleaned_data.items():
            setattr(self.object, k, v)
        self.object.updated_by = self.request.user
        self.object.save()
        messages.success(self.request, "Komisyon dönemi güncellendi.")
        return HttpResponseRedirect(reverse("guarantees:period_detail", kwargs={"pk": self.object.pk}))


class CommissionPeriodCancelView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        cp = get_object_or_404(GuaranteeCommissionPeriod, pk=pk)
        cancel_commission_period(period=cp, user=request.user, reason=request.POST.get("reason", ""))
        messages.warning(request, "Komisyon dönemi iptal edildi.")
        return HttpResponseRedirect(reverse("guarantees:period_detail", kwargs={"pk": pk}))


class CommissionPeriodCreatePayableView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        cp = get_object_or_404(GuaranteeCommissionPeriod, pk=pk)
        try:
            payable, created = create_payable_from_commission(period=cp, user=request.user)
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
            return HttpResponseRedirect(reverse("guarantees:period_detail", kwargs={"pk": pk}))
        if created:
            messages.success(request, "PayableItem oluşturuldu.")
        else:
            messages.info(request, "Bu döneme bağlı PayableItem zaten var.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": payable.pk}))


class GuaranteeGeneratePeriodsView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        g = get_object_or_404(GuaranteeLetter, pk=pk)
        try:
            created = generate_commission_periods(guarantee=g, user=request.user, months=12)
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
            return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": pk}))
        if created:
            messages.success(request, f"{len(created)} komisyon dönemi yaratıldı.")
        else:
            messages.info(request, "Yeni dönem yaratılmadı (mevcut etiketler atlandı).")
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": pk}))


# === Document =============================================================

class GuaranteeDocumentUploadView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "guarantees/guarantee_document_upload.html"
    form_class = GuaranteeDocumentUploadForm

    def dispatch(self, request, *args, **kwargs):
        self.guarantee = None
        self.period = None
        if "period_pk" in kwargs:
            self.period = get_object_or_404(GuaranteeCommissionPeriod, pk=kwargs["period_pk"])
            self.guarantee = self.period.guarantee
        elif "pk" in kwargs:
            self.guarantee = get_object_or_404(GuaranteeLetter, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["guarantee"] = self.guarantee
        ctx["period"] = self.period
        return ctx

    def form_valid(self, form):
        attach_guarantee_document(
            user=self.request.user,
            document=form.cleaned_data["document"],
            document_role=form.cleaned_data["document_role"],
            guarantee=self.guarantee, commission_period=self.period,
        )
        messages.success(self.request, "Belge bağlandı.")
        if self.period:
            return HttpResponseRedirect(reverse("guarantees:period_detail", kwargs={"pk": self.period.pk}))
        return HttpResponseRedirect(reverse("guarantees:detail", kwargs={"pk": self.guarantee.pk}))
