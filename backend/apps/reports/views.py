"""Reports views — Faz 12 MVP."""
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import FileResponse, Http404, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST
from django.views.generic import ListView, TemplateView, View

from apps.finance.permissions import can_approve, can_write

from .forms import ReportRunForm, ReportTemplateForm
from .models import ReportFormat, ReportRun, ReportTemplate, ReportType
from .services import (
    can_run_report,
    cancel_report_run,
    create_report_template,
    get_available_report_types,
    get_recent_exports,
    get_report_definition,
    preview_report,
    run_export,
    update_report_template,
)


class WriteMixin(UserPassesTestMixin):
    raise_exception = True

    def test_func(self):
        return can_write(self.request.user)


class ReportCenterView(LoginRequiredMixin, TemplateView):
    template_name = "reports/report_center.html"

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        ctx["available"] = get_available_report_types(self.request.user)
        ctx["recent_runs"] = get_recent_exports(self.request.user, limit=10)
        ctx["templates"] = ReportTemplate.objects.filter(is_active=True)[:20]
        return ctx


# Templates


class TemplateListView(LoginRequiredMixin, ListView):
    template_name = "reports/template_list.html"
    context_object_name = "templates_list"
    queryset = ReportTemplate.objects.filter(is_active=True).order_by("-updated_at")


class TemplateCreateView(LoginRequiredMixin, WriteMixin, View):
    def get(self, request):
        return render(request, "reports/template_form.html", {"form": ReportTemplateForm()})

    def post(self, request):
        form = ReportTemplateForm(request.POST)
        if not form.is_valid():
            return render(request, "reports/template_form.html", {"form": form})
        cd = form.cleaned_data
        try:
            t = create_report_template(
                name=cd["name"], slug=cd["slug"],
                report_type=cd["report_type"], user=request.user,
                description=cd.get("description", ""),
                default_format=cd.get("default_format", ReportFormat.XLSX),
                request=request,
            )
        except (PermissionDenied, ValidationError) as e:
            form.add_error(None, str(e))
            return render(request, "reports/template_form.html", {"form": form})
        return redirect(reverse("reports:template_detail", args=[t.pk]))


class TemplateDetailView(LoginRequiredMixin, TemplateView):
    template_name = "reports/template_detail.html"

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        ctx["template"] = get_object_or_404(ReportTemplate, pk=self.kwargs["pk"])
        return ctx


class TemplateEditView(LoginRequiredMixin, WriteMixin, View):
    def get(self, request, pk):
        t = get_object_or_404(ReportTemplate, pk=pk)
        return render(request, "reports/template_form.html",
                      {"form": ReportTemplateForm(instance=t), "object": t})

    def post(self, request, pk):
        t = get_object_or_404(ReportTemplate, pk=pk)
        form = ReportTemplateForm(request.POST, instance=t)
        if not form.is_valid():
            return render(request, "reports/template_form.html", {"form": form, "object": t})
        update_report_template(template=t, user=request.user, request=request, **form.cleaned_data)
        return redirect(reverse("reports:template_detail", args=[t.pk]))


# Preview / Export


class PreviewView(LoginRequiredMixin, View):
    def get(self, request):
        rt = request.GET.get("report_type") or ReportType.PAYABLES
        if not can_run_report(request.user, rt):
            return HttpResponseForbidden("Bu raporu görüntüleme yetkiniz yok.")
        filters = {k: v for k, v in request.GET.items() if k not in ("report_type", "fmt")}
        try:
            preview = preview_report(rt, filters, request.user, limit=50)
        except (PermissionDenied, ValidationError) as e:
            return HttpResponseForbidden(str(e))
        return render(request, "reports/report_preview.html", {
            "preview": preview,
            "report_type": rt,
            "filters": filters,
        })


class ExportView(LoginRequiredMixin, View):
    def get(self, request):
        return render(request, "reports/export_form.html", {
            "available": get_available_report_types(request.user),
            "form": ReportRunForm(),
        })

    def post(self, request):
        form = ReportRunForm(request.POST)
        if not form.is_valid():
            return render(request, "reports/export_form.html", {"form": form})
        cd = form.cleaned_data
        rt = cd["report_type"]
        if not can_run_report(request.user, rt):
            return HttpResponseForbidden("Export yetkiniz yok.")
        filters = {}
        if cd.get("mode"):
            filters["mode"] = cd["mode"]
        if cd.get("days"):
            filters["days"] = cd["days"]
        run = run_export(
            report_type=rt, filters=filters, fmt=cd["fmt"],
            user=request.user, request=request,
        )
        return redirect(reverse("reports:run_detail", args=[run.pk]))


# History


class RunListView(LoginRequiredMixin, ListView):
    template_name = "reports/export_history.html"
    context_object_name = "runs"

    def get_queryset(self):
        qs = ReportRun.objects.filter(is_active=True)
        if not (self.request.user.is_superuser or can_approve(self.request.user)):
            qs = qs.filter(created_by=self.request.user)
        return qs.order_by("-created_at")[:200]


class RunDetailView(LoginRequiredMixin, TemplateView):
    template_name = "reports/export_detail.html"

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        run = get_object_or_404(ReportRun, pk=self.kwargs["pk"])
        if not (
            self.request.user.is_superuser
            or can_approve(self.request.user)
            or run.created_by_id == self.request.user.id
        ):
            raise PermissionDenied("Bu çalıştırmayı görüntüleyemezsiniz.")
        ctx["run"] = run
        return ctx


@login_required
def run_download(request, pk):
    run = get_object_or_404(ReportRun, pk=pk)
    if not (
        request.user.is_superuser
        or can_approve(request.user)
        or run.created_by_id == request.user.id
    ):
        return HttpResponseForbidden("İndirme yetkiniz yok.")
    if not run.output_file:
        raise Http404("Dosya yok.")
    return FileResponse(run.output_file.open("rb"), as_attachment=True,
                        filename=run.output_file.name.split("/")[-1])


@login_required
@require_POST
def run_cancel(request, pk):
    run = get_object_or_404(ReportRun, pk=pk)
    try:
        cancel_report_run(run=run, user=request.user, request=request)
    except PermissionDenied:
        return HttpResponseForbidden()
    return redirect(reverse("reports:run_detail", args=[run.pk]))
