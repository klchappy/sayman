"""Parties master CRUD — Faz 2 minimal generic views.

Delete butonu YOK; archive/restore Anayasa Madde 3.8 gereği.
"""
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.generic import (
    CreateView,
    DetailView,
    ListView,
    TemplateView,
    UpdateView,
    View,
)

from apps.audit.services import audit_log

from .models import Bank, Company, Institution, Person, PropertyAsset

MASTER_REGISTRY = [
    ("companies", Company, "Şirketler", ["name", "short_name", "tax_number"]),
    ("persons", Person, "Şahıslar", ["full_name", "short_name"]),
    ("properties", PropertyAsset, "Mülkler", ["name", "owner_type", "address"]),
    ("banks", Bank, "Bankalar", ["name"]),
    ("institutions", Institution, "Kurumlar", ["name", "institution_type"]),
]
MODEL_BY_SLUG = {slug: (model, name, fields) for slug, model, name, fields in MASTER_REGISTRY}


class MasterIndexView(LoginRequiredMixin, TemplateView):
    template_name = "parties/index.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["registry"] = [
            {
                "slug": slug,
                "name": name,
                "active": model.objects.filter(is_active=True).count(),
                "archived": model.objects.filter(is_active=False).count(),
            }
            for slug, model, name, _ in MASTER_REGISTRY
        ]
        return ctx


class MasterListView(LoginRequiredMixin, ListView):
    template_name = "parties/list.html"
    context_object_name = "object_list"
    paginate_by = 25

    def get_queryset(self):
        slug = self.kwargs["slug"]
        if slug not in MODEL_BY_SLUG:
            from django.http import Http404
            raise Http404(f"Bilinmeyen master: {slug}")
        model, _, _ = MODEL_BY_SLUG[slug]
        qs = model.objects.all()
        only_archived = self.request.GET.get("archived") == "1"
        return qs.filter(is_active=not only_archived).order_by("-updated_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        slug = self.kwargs["slug"]
        model, name, fields = MODEL_BY_SLUG[slug]
        ctx["slug"] = slug
        ctx["master_name"] = name
        ctx["fields"] = fields
        ctx["only_archived"] = self.request.GET.get("archived") == "1"
        return ctx


class _MasterMixin:
    template_name = "parties/form.html"

    def dispatch(self, request, *args, **kwargs):
        slug = kwargs["slug"]
        if slug not in MODEL_BY_SLUG:
            from django.http import Http404
            raise Http404(f"Bilinmeyen master: {slug}")
        self.model_cls, self.master_name, self.master_fields = MODEL_BY_SLUG[slug]
        self.master_slug = slug
        self.fields = self.master_fields + ["notes"]
        return super().dispatch(request, *args, **kwargs)

    @property
    def model(self):
        return self.model_cls

    def get_success_url(self):
        return reverse("parties:list", kwargs={"slug": self.master_slug})

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["slug"] = self.master_slug
        ctx["master_name"] = self.master_name
        return ctx


class MasterCreateView(_MasterMixin, LoginRequiredMixin, CreateView):
    def form_valid(self, form):
        form.instance.created_by = None  # core.BaseModel'de yok; faz 4+ User FK eklenecek
        response = super().form_valid(form)
        audit_log(
            actor=self.request.user,
            action="CREATE",
            obj=self.object,
            summary=f"{self.master_name} oluşturuldu: {self.object}",
            request=self.request,
        )
        messages.success(self.request, f"{self.master_name} kaydı oluşturuldu.")
        return response


class MasterDetailView(_MasterMixin, LoginRequiredMixin, DetailView):
    template_name = "parties/detail.html"


class MasterUpdateView(_MasterMixin, LoginRequiredMixin, UpdateView):
    def form_valid(self, form):
        response = super().form_valid(form)
        audit_log(
            actor=self.request.user,
            action="UPDATE",
            obj=self.object,
            summary=f"{self.master_name} güncellendi: {self.object}",
            metadata={"changed_fields": form.changed_data},
            request=self.request,
        )
        messages.success(self.request, "Kayıt güncellendi.")
        return response


class MasterArchiveView(_MasterMixin, LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        obj = get_object_or_404(self.model_cls, pk=kwargs["pk"])
        if obj.is_active:
            obj.archive(actor=request.user, reason=request.POST.get("reason", ""))
            audit_log(
                actor=request.user,
                action="ARCHIVE",
                obj=obj,
                summary=f"{self.master_name} pasifleştirildi: {obj}",
                request=request,
            )
            messages.warning(request, f"{self.master_name} kaydı pasifleştirildi.")
        else:
            obj.restore(actor=request.user)
            audit_log(
                actor=request.user,
                action="RESTORE",
                obj=obj,
                summary=f"{self.master_name} geri alındı: {obj}",
                request=request,
            )
            messages.success(request, f"{self.master_name} kaydı aktif edildi.")
        return HttpResponseRedirect(reverse("parties:detail", kwargs={"slug": self.master_slug, "pk": obj.pk}))
