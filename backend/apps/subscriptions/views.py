from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.generic import (CreateView, DetailView, FormView, ListView,
                                  UpdateView, View)

from apps.finance.permissions import can_write

from .forms import (SubscriptionCommitmentForm, SubscriptionForm,
                    SubscriptionPeriodChargeForm)
from .models import (CommitmentStatus, Subscription, SubscriptionCommitment,
                     SubscriptionPeriodCharge)
from .services.subscriptions import (add_commitment, archive_subscription,
                                     create_payable_from_subscription_charge,
                                     create_period_charge, create_subscription,
                                     restore_subscription, update_subscription)


class WriteMixin(UserPassesTestMixin):
    raise_exception = True
    def test_func(self):
        return can_write(self.request.user)


class SubscriptionListView(LoginRequiredMixin, ListView):
    model = Subscription
    template_name = "subscriptions/subscription_list.html"
    context_object_name = "subscriptions"
    paginate_by = 30

    def get_queryset(self):
        qs = Subscription.objects.select_related("company", "person", "institution")
        return qs.filter(is_active=True).order_by("-created_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        # Yaklaşan taahhütler (60 gün içinde)
        from django.utils import timezone
        today = timezone.localdate()
        ctx["approaching_commitments"] = SubscriptionCommitment.objects.filter(
            is_active=True, status=CommitmentStatus.APPROACHING,
            end_date__gte=today,
        ).select_related("subscription").order_by("end_date")[:10]
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class SubscriptionCreateView(LoginRequiredMixin, WriteMixin, CreateView):
    model = Subscription
    form_class = SubscriptionForm
    template_name = "subscriptions/subscription_form.html"

    def form_valid(self, form):
        obj = create_subscription(user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Abonelik oluşturuldu.")
        return HttpResponseRedirect(reverse("subscriptions:detail", kwargs={"pk": obj.pk}))


class SubscriptionDetailView(LoginRequiredMixin, DetailView):
    model = Subscription
    template_name = "subscriptions/subscription_detail.html"
    context_object_name = "subscription"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["commitments"] = self.object.commitments.order_by("end_date")
        ctx["charges"] = self.object.period_charges.select_related("payable").order_by("-due_date")[:50]
        ctx["can_write"] = can_write(self.request.user)
        return ctx


class SubscriptionUpdateView(LoginRequiredMixin, WriteMixin, UpdateView):
    model = Subscription
    form_class = SubscriptionForm
    template_name = "subscriptions/subscription_form.html"

    def form_valid(self, form):
        update_subscription(subscription=self.object, user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Güncellendi.")
        return HttpResponseRedirect(reverse("subscriptions:detail", kwargs={"pk": self.object.pk}))


class SubscriptionArchiveView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        sub = get_object_or_404(Subscription, pk=pk)
        if sub.is_active:
            archive_subscription(subscription=sub, user=request.user, reason=request.POST.get("reason", ""))
            messages.warning(request, "Pasifleştirildi.")
        else:
            restore_subscription(subscription=sub, user=request.user)
            messages.success(request, "Aktif edildi.")
        return HttpResponseRedirect(reverse("subscriptions:detail", kwargs={"pk": pk}))


class CommitmentCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "subscriptions/commitment_form.html"
    form_class = SubscriptionCommitmentForm

    def dispatch(self, request, *args, **kwargs):
        self.subscription = get_object_or_404(Subscription, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["subscription"] = self.subscription
        return ctx

    def form_valid(self, form):
        add_commitment(subscription=self.subscription, user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Taahhüt eklendi.")
        return HttpResponseRedirect(reverse("subscriptions:detail", kwargs={"pk": self.subscription.pk}))


class PeriodChargeCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "subscriptions/charge_form.html"
    form_class = SubscriptionPeriodChargeForm

    def dispatch(self, request, *args, **kwargs):
        self.subscription = get_object_or_404(Subscription, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["subscription"] = self.subscription
        return ctx

    def form_valid(self, form):
        create_period_charge(subscription=self.subscription, user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Dönem ücret kaydı eklendi.")
        return HttpResponseRedirect(reverse("subscriptions:detail", kwargs={"pk": self.subscription.pk}))


class ChargeCreatePayableView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        charge = get_object_or_404(SubscriptionPeriodCharge, pk=pk)
        payable, created = create_payable_from_subscription_charge(charge=charge, user=request.user)
        if created:
            messages.success(request, "PayableItem oluşturuldu.")
        else:
            messages.info(request, "Bu döneme bağlı PayableItem zaten var.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": payable.pk}))
