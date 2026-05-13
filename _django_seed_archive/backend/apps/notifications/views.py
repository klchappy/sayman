from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST
from django.views.generic import ListView, TemplateView, View

from apps.finance.permissions import can_approve, can_write

from .forms import (NotificationDryRunForm, NotificationLogFilterForm,
                     NotificationPreferenceForm, NotificationRuleForm,
                     TelegramTestSimulationForm)
from .models import (NotificationCategory, NotificationLog,
                     NotificationPreference, NotificationRule,
                     NotificationStatus)
from .services import (cancel_notification, dry_run_categories,
                        mark_notification_ready,
                        run_notification_dry_run,
                        simulate_telegram_message,
                        suppress_notification)


class _CanWriteMixin(UserPassesTestMixin):
    raise_exception = True

    def test_func(self):
        return can_write(self.request.user)


class _CanApproveMixin(UserPassesTestMixin):
    raise_exception = True

    def test_func(self):
        return self.request.user.is_superuser or can_approve(self.request.user)


# --- Dashboard ---


class NotificationDashboardView(LoginRequiredMixin, TemplateView):
    template_name = "notifications/dashboard.html"

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        logs = NotificationLog.objects.order_by("-created_at")
        ctx["recent_logs"] = logs[:10]
        ctx["total"] = logs.count()
        ctx["dry_run_count"] = logs.filter(status=NotificationStatus.DRY_RUN).count()
        ctx["suppressed_count"] = logs.filter(status=NotificationStatus.SUPPRESSED).count()
        ctx["failed_count"] = logs.filter(status=NotificationStatus.FAILED).count()
        ctx["critical_count"] = logs.filter(severity="CRITICAL",
                                              status__in=[NotificationStatus.DRY_RUN,
                                                           NotificationStatus.READY]).count()
        ctx["rules"] = NotificationRule.objects.filter(is_active=True)[:20]
        ctx["real_send_open"] = False
        return ctx


# --- Legacy log list (tutuldu) ---


class NotificationListView(LoginRequiredMixin, ListView):
    model = NotificationLog
    template_name = "notifications/list.html"
    context_object_name = "notifications"
    paginate_by = 50
    ordering = ["-created_at"]


# --- Rules ---


class RuleListView(LoginRequiredMixin, ListView):
    template_name = "notifications/rule_list.html"
    context_object_name = "rules"
    queryset = NotificationRule.objects.all().order_by("category", "code")


class RuleCreateView(LoginRequiredMixin, _CanWriteMixin, View):
    def get(self, request):
        return render(request, "notifications/rule_form.html",
                      {"form": NotificationRuleForm()})

    def post(self, request):
        form = NotificationRuleForm(request.POST)
        if not form.is_valid():
            return render(request, "notifications/rule_form.html", {"form": form})
        rule = form.save(commit=False)
        rule.created_by = request.user
        rule.save()
        from apps.audit.services import audit_log
        audit_log(actor=request.user, action="CREATE", obj=rule,
                  summary=f"Rule oluşturuldu: {rule.code}", request=request)
        return redirect(reverse("notifications:rule_detail", args=[rule.pk]))


class RuleDetailView(LoginRequiredMixin, TemplateView):
    template_name = "notifications/rule_detail.html"

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        ctx["rule"] = get_object_or_404(NotificationRule, pk=self.kwargs["pk"])
        return ctx


class RuleEditView(LoginRequiredMixin, _CanWriteMixin, View):
    def get(self, request, pk):
        rule = get_object_or_404(NotificationRule, pk=pk)
        return render(request, "notifications/rule_form.html",
                      {"form": NotificationRuleForm(instance=rule), "object": rule})

    def post(self, request, pk):
        rule = get_object_or_404(NotificationRule, pk=pk)
        form = NotificationRuleForm(request.POST, instance=rule)
        if not form.is_valid():
            return render(request, "notifications/rule_form.html",
                          {"form": form, "object": rule})
        form.save()
        from apps.audit.services import audit_log
        audit_log(actor=request.user, action="UPDATE", obj=rule,
                  summary=f"Rule güncellendi: {rule.code}", request=request)
        return redirect(reverse("notifications:rule_detail", args=[rule.pk]))


# --- Logs ---


class LogListView(LoginRequiredMixin, ListView):
    template_name = "notifications/log_list.html"
    context_object_name = "logs"
    paginate_by = 50

    def get_queryset(self):
        qs = NotificationLog.objects.all().order_by("-created_at")
        cat = self.request.GET.get("category")
        st = self.request.GET.get("status")
        if cat:
            qs = qs.filter(category=cat)
        if st:
            qs = qs.filter(status=st)
        return qs


class LogDetailView(LoginRequiredMixin, TemplateView):
    template_name = "notifications/log_detail.html"

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        ctx["log"] = get_object_or_404(NotificationLog, pk=self.kwargs["pk"])
        ctx["sim"] = simulate_telegram_message(ctx["log"])
        return ctx


# --- Dry-run ---


class DryRunView(LoginRequiredMixin, _CanApproveMixin, View):
    def get(self, request):
        return render(request, "notifications/dry_run.html", {
            "form": NotificationDryRunForm(),
            "categories": dry_run_categories(),
        })

    def post(self, request):
        form = NotificationDryRunForm(request.POST)
        if not form.is_valid():
            return render(request, "notifications/dry_run.html", {"form": form})
        cd = form.cleaned_data
        try:
            result = run_notification_dry_run(
                category=cd.get("category") or None,
                days=cd.get("days") or 7,
                user=request.user, request=request,
            )
        except PermissionDenied:
            return HttpResponseForbidden("Dry-run yetkisi yok.")
        return render(request, "notifications/dry_run_result.html",
                      {"result": result})


# --- Log actions ---


@login_required
@require_POST
def log_suppress(request, pk):
    log = get_object_or_404(NotificationLog, pk=pk)
    try:
        suppress_notification(log=log, user=request.user, request=request,
                                reason=request.POST.get("reason", ""))
    except PermissionDenied:
        return HttpResponseForbidden()
    return redirect(reverse("notifications:log_detail", args=[log.pk]))


@login_required
@require_POST
def log_cancel(request, pk):
    log = get_object_or_404(NotificationLog, pk=pk)
    try:
        cancel_notification(log=log, user=request.user, request=request)
    except PermissionDenied:
        return HttpResponseForbidden()
    return redirect(reverse("notifications:log_detail", args=[log.pk]))


@login_required
@require_POST
def log_ready(request, pk):
    log = get_object_or_404(NotificationLog, pk=pk)
    try:
        mark_notification_ready(log=log, user=request.user, request=request)
    except PermissionDenied:
        return HttpResponseForbidden()
    return redirect(reverse("notifications:log_detail", args=[log.pk]))


# --- Telegram test simulation (NO real send) ---


class TelegramTestView(LoginRequiredMixin, _CanApproveMixin, View):
    def get(self, request):
        return render(request, "notifications/telegram_test.html", {
            "form": TelegramTestSimulationForm(),
            "real_send_open": False,
        })

    def post(self, request):
        form = TelegramTestSimulationForm(request.POST)
        if not form.is_valid():
            return render(request, "notifications/telegram_test.html",
                          {"form": form, "real_send_open": False})
        cd = form.cleaned_data
        # Tek seferlik in-memory log objesi — gerçek gönderim YOK.
        # NotificationLog'a yazıyoruz ki simulation izi denetlenebilsin.
        from .services import create_notification_log
        from .models import NotificationCategory, NotificationChannel, NotificationSeverity
        log = create_notification_log(
            category=NotificationCategory.SYSTEM,
            severity=NotificationSeverity.INFO,
            channel=NotificationChannel.TELEGRAM,
            title=cd["title"], message=cd.get("message", ""),
            target_chat_id=cd.get("target_chat_id", ""),
            dry_run=True, real_send_allowed=False,
            actor=request.user, request=request,
        )
        sim = simulate_telegram_message(log)
        return render(request, "notifications/telegram_test.html", {
            "form": form, "sim": sim, "log": log,
            "real_send_open": False,
        })


# --- Preferences ---


class PreferencesView(LoginRequiredMixin, View):
    def get(self, request):
        prefs = NotificationPreference.objects.filter(user=request.user)
        return render(request, "notifications/preferences.html",
                      {"prefs": prefs, "form": NotificationPreferenceForm()})

    def post(self, request):
        form = NotificationPreferenceForm(request.POST)
        if not form.is_valid():
            prefs = NotificationPreference.objects.filter(user=request.user)
            return render(request, "notifications/preferences.html",
                          {"prefs": prefs, "form": form})
        cd = form.cleaned_data
        pref, _ = NotificationPreference.objects.update_or_create(
            user=request.user, category=cd["category"],
            defaults={
                "dashboard_enabled": cd["dashboard_enabled"],
                "telegram_enabled": cd["telegram_enabled"],
                "email_enabled": cd["email_enabled"],
                "muted": cd["muted"],
            },
        )
        return redirect(reverse("notifications:preferences"))
