from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.generic import (CreateView, DetailView, FormView, ListView,
                                  UpdateView, View)

from apps.finance.permissions import can_write

from .forms import (GenerateOfficialPeriodsForm, OfficialPeriodForm,
                    OfficialProfileForm)
from .models import OfficialPaymentPeriod, OfficialPaymentProfile
from .services.official_payments import (
    archive_profile, create_payable_from_official_period, create_period,
    create_profile, generate_periods, restore_profile, update_profile,
)


class WriteMixin(UserPassesTestMixin):
    raise_exception = True
    def test_func(self):
        return can_write(self.request.user)


class ProfileListView(LoginRequiredMixin, ListView):
    model = OfficialPaymentProfile
    template_name = "official_payments/profile_list.html"
    context_object_name = "profiles"
    paginate_by = 30

    def get_queryset(self):
        return OfficialPaymentProfile.objects.filter(is_active=True).order_by("-created_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class ProfileCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = OfficialPaymentProfile
    form_class = OfficialProfileForm
    template_name = "official_payments/profile_form.html"

    def form_valid(self, form):
        obj = create_profile(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Resmi ödeme profili oluşturuldu.")
        return HttpResponseRedirect(reverse("official_payments:detail", kwargs={"pk": obj.pk}))


class ProfileDetailView(LoginRequiredMixin, DetailView):
    model = OfficialPaymentProfile
    template_name = "official_payments/profile_detail.html"
    context_object_name = "profile"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["periods"] = self.object.periods.select_related("payable").order_by("-due_date")[:60]
        ctx["generate_form"] = GenerateOfficialPeriodsForm()
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class ProfileUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = OfficialPaymentProfile
    form_class = OfficialProfileForm
    template_name = "official_payments/profile_form.html"

    def form_valid(self, form):
        update_profile(profile=self.object, user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Güncellendi.")
        return HttpResponseRedirect(reverse("official_payments:detail", kwargs={"pk": self.object.pk}))


class ProfileArchiveView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        p = get_object_or_404(OfficialPaymentProfile, pk=pk)
        if p.is_active:
            archive_profile(profile=p, user=request.user, reason=request.POST.get("reason", ""))
            messages.warning(request, "Pasifleştirildi.")
        else:
            restore_profile(profile=p, user=request.user)
            messages.success(request, "Aktif edildi.")
        return HttpResponseRedirect(reverse("official_payments:detail", kwargs={"pk": pk}))


class PeriodCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "official_payments/period_form.html"
    form_class = OfficialPeriodForm

    def dispatch(self, request, *args, **kwargs):
        self.profile = get_object_or_404(OfficialPaymentProfile, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["profile"] = self.profile
        return ctx

    def form_valid(self, form):
        create_period(profile=self.profile, user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Resmi ödeme dönemi eklendi.")
        return HttpResponseRedirect(reverse("official_payments:detail", kwargs={"pk": self.profile.pk}))


class GeneratePeriodsView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        profile = get_object_or_404(OfficialPaymentProfile, pk=pk)
        form = GenerateOfficialPeriodsForm(request.POST)
        if not form.is_valid():
            messages.error(request, "Geçersiz yıl.")
            return HttpResponseRedirect(reverse("official_payments:detail", kwargs={"pk": pk}))
        try:
            created = generate_periods(profile=profile, user=request.user, year=form.cleaned_data["year"])
            messages.success(request, f"{len(created)} dönem üretildi.")
        except ValueError as e:
            messages.error(request, str(e))
        return HttpResponseRedirect(reverse("official_payments:detail", kwargs={"pk": pk}))


class PeriodCreatePayableView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        period = get_object_or_404(OfficialPaymentPeriod, pk=pk)
        payable, created = create_payable_from_official_period(period=period, user=request.user)
        if created:
            messages.success(request, "PayableItem oluşturuldu.")
        else:
            messages.info(request, "Bu döneme bağlı PayableItem zaten var.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": payable.pk}))
