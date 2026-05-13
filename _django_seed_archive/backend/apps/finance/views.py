from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.db.models import Q, Sum
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.views.generic import (
    CreateView,
    DetailView,
    FormView,
    ListView,
    TemplateView,
    UpdateView,
    View,
)

from apps.audit.services import audit_log
from apps.documents.models import Document, DocumentSource, DocumentType

from .forms import (
    MarkPaidForm,
    PayableDocumentUploadForm,
    PayableItemForm,
    PaymentRejectForm,
)
from .models import (
    DocumentRole,
    PayableDocument,
    PayableItem,
    PayableStatus,
    PaymentTransaction,
    TransactionStatus,
)
from .permissions import can_approve, can_write
from .services.payments import (
    PaymentRuleError,
    approve_payment_transaction,
    archive_payable,
    attach_document,
    create_payable,
    mark_paid,
    reject_payment_transaction,
    restore_payable,
    update_payable,
)


# === MIXIN'LER ==============================================================

class WritePermMixin(UserPassesTestMixin):
    raise_exception = True
    def test_func(self):
        return can_write(self.request.user)


class ApprovePermMixin(UserPassesTestMixin):
    raise_exception = True
    def test_func(self):
        return can_approve(self.request.user)


# === LIST + KPI =============================================================

class PayableListView(LoginRequiredMixin, ListView):
    model = PayableItem
    template_name = "finance/payable_list.html"
    context_object_name = "payables"
    paginate_by = 30

    def get_queryset(self):
        qs = PayableItem.objects.select_related("company", "person", "institution", "bank")
        # archived filter
        if self.request.GET.get("archived") == "1":
            qs = qs.filter(is_active=False)
        else:
            qs = qs.filter(is_active=True)

        status = self.request.GET.get("status")
        if status:
            qs = qs.filter(status=status)
        method = self.request.GET.get("method")
        if method:
            qs = qs.filter(payment_method=method)
        owner_type = self.request.GET.get("owner_type")
        if owner_type:
            qs = qs.filter(owner_type=owner_type)
        q = self.request.GET.get("q")
        if q:
            qs = qs.filter(
                Q(title__icontains=q) | Q(invoice_number__icontains=q)
                | Q(supplier_name__icontains=q) | Q(subscription_reference__icontains=q)
            )
        return qs.order_by("due_date", "-created_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        today = timezone.localdate()
        active = PayableItem.objects.filter(is_active=True).exclude(
            status__in=[PayableStatus.CANCELLED, PayableStatus.PAID, PayableStatus.ARCHIVED]
        )
        # KPI'lar
        bugun = active.filter(due_date=today)
        yaklasan = active.filter(due_date__gt=today, due_date__lte=today + timezone.timedelta(days=7))
        gecikmis = active.filter(due_date__lt=today)
        ay_basla = today.replace(day=1)
        ay_kayitlar = PayableItem.objects.filter(is_active=True, due_date__gte=ay_basla, due_date__lte=today)

        ctx["kpis"] = {
            "bugun_sayi": bugun.count(),
            "bugun_tutar": bugun.aggregate(t=Sum("amount"))["t"] or Decimal("0"),
            "yaklasan_sayi": yaklasan.count(),
            "yaklasan_tutar": yaklasan.aggregate(t=Sum("amount"))["t"] or Decimal("0"),
            "gecikmis_sayi": gecikmis.count(),
            "gecikmis_tutar": gecikmis.aggregate(t=Sum("amount"))["t"] or Decimal("0"),
            "eksik_dekont": _missing_receipt_count(),
            "ay_toplam": PayableItem.objects.filter(
                is_active=True, due_date__year=today.year, due_date__month=today.month
            ).aggregate(t=Sum("amount"))["t"] or Decimal("0"),
            "ay_odenen": PayableItem.objects.filter(
                is_active=True, due_date__year=today.year, due_date__month=today.month
            ).aggregate(t=Sum("amount_paid"))["t"] or Decimal("0"),
        }
        ctx["status_choices"] = PayableStatus.choices
        ctx["filter_status"] = self.request.GET.get("status", "")
        ctx["filter_q"] = self.request.GET.get("q", "")
        return ctx


def _missing_receipt_count() -> int:
    """Receipt zorunlu olup eklenmemiş aktif kayıtlar."""
    return PayableItem.objects.filter(
        is_active=True, requires_receipt=True,
    ).exclude(documents__document_role=DocumentRole.RECEIPT).count()


# === CRUD ==================================================================

class PayableCreateView(LoginRequiredMixin, WritePermMixin, CreateView):
    model = PayableItem
    form_class = PayableItemForm
    template_name = "finance/payable_form.html"

    def form_valid(self, form):
        instance = create_payable(
            user=self.request.user,
            **form.cleaned_data,
        )
        messages.success(self.request, "Fatura/Ödeme kaydı oluşturuldu.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": instance.pk}))


class PayableDetailView(LoginRequiredMixin, DetailView):
    model = PayableItem
    template_name = "finance/payable_detail.html"
    context_object_name = "payable"

    def get_queryset(self):
        return PayableItem.objects.select_related("company", "person", "institution", "bank") \
            .prefetch_related("documents__document", "transactions")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["payments"] = self.object.transactions.select_related("receipt_document", "bank").order_by("-payment_date")
        ctx["doc_links"] = self.object.documents.select_related("document").all()
        # Audit (bu kayda ait son 20)
        from apps.audit.models import AuditLog
        ctx["audit_logs"] = AuditLog.objects.filter(
            app_label="finance", model_name="payableitem", object_id=str(self.object.pk),
        )[:20]
        # Bağlı görevler
        from apps.tasks.models import Task
        ctx["related_tasks"] = Task.objects.filter(
            related_app="finance", related_model="payableitem",
            related_object_id=str(self.object.pk), is_active=True,
        )
        ctx["can_write"] = can_write(self.request.user)
        ctx["can_approve"] = can_approve(self.request.user)
        return ctx


class PayableUpdateView(LoginRequiredMixin, WritePermMixin, UpdateView):
    model = PayableItem
    form_class = PayableItemForm
    template_name = "finance/payable_form.html"

    def form_valid(self, form):
        update_payable(payable=self.object, user=self.request.user, **form.cleaned_data)
        messages.success(self.request, "Kayıt güncellendi.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": self.object.pk}))


class PayableArchiveView(LoginRequiredMixin, WritePermMixin, View):
    def post(self, request, pk):
        payable = get_object_or_404(PayableItem, pk=pk)
        if payable.is_active:
            archive_payable(payable=payable, user=request.user, reason=request.POST.get("reason", ""))
            messages.warning(request, "Kayıt pasifleştirildi.")
        else:
            restore_payable(payable=payable, user=request.user)
            messages.success(request, "Kayıt aktif edildi.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": pk}))


# === ÖDEME İŞARETLEME =====================================================

class MarkPaidView(LoginRequiredMixin, WritePermMixin, FormView):
    template_name = "finance/mark_paid.html"
    form_class = MarkPaidForm

    def dispatch(self, request, *args, **kwargs):
        self.payable = get_object_or_404(PayableItem, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_form_kwargs(self):
        kw = super().get_form_kwargs()
        kw["payable"] = self.payable
        return kw

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["payable"] = self.payable
        return ctx

    def form_valid(self, form):
        receipt_file = form.cleaned_data.get("receipt_file")
        receipt_doc = None
        if receipt_file:
            receipt_doc, _ = Document.get_or_create_from_file(
                receipt_file,
                uploaded_by=self.request.user,
                document_type=DocumentType.RECEIPT,
                source=DocumentSource.UPLOAD,
                title=f"Dekont · {self.payable.title}"[:255],
            )
            # Belgeyi PayableDocument olarak da bağla
            attach_document(
                payable=self.payable, document=receipt_doc,
                user=self.request.user, document_role=DocumentRole.RECEIPT,
            )

        try:
            from .services.payments import add_partial_payment
            add_partial_payment(
                payable=self.payable, user=self.request.user,
                amount=form.cleaned_data["amount"],
                payment_date=form.cleaned_data["payment_date"],
                payment_method=form.cleaned_data["payment_method"],
                bank=form.cleaned_data.get("bank"),
                receipt_document=receipt_doc,
                note=form.cleaned_data.get("note", ""),
            )
        except PaymentRuleError as exc:
            form.add_error(None, str(exc))
            return self.form_invalid(form)

        messages.success(self.request, "Ödeme kaydedildi.")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": self.payable.pk}))


# === BELGE EKLEME =========================================================

class PayableAddDocumentView(LoginRequiredMixin, WritePermMixin, FormView):
    template_name = "finance/document_upload.html"
    form_class = PayableDocumentUploadForm

    def dispatch(self, request, *args, **kwargs):
        self.payable = get_object_or_404(PayableItem, pk=kwargs["pk"])
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["payable"] = self.payable
        return ctx

    def form_valid(self, form):
        f = form.cleaned_data["file"]
        role = form.cleaned_data["document_role"]
        title = form.cleaned_data.get("title") or f.name
        doc_type = DocumentType.RECEIPT if role == DocumentRole.RECEIPT else DocumentType.INVOICE
        doc, _ = Document.get_or_create_from_file(
            f, uploaded_by=self.request.user,
            document_type=doc_type, source=DocumentSource.UPLOAD,
            title=title,
        )
        attach_document(payable=self.payable, document=doc, user=self.request.user, document_role=role)
        messages.success(self.request, f"Belge eklendi: {doc.original_filename}")
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": self.payable.pk}))


# === TRANSACTION ONAY/RED =================================================

class PaymentApproveView(LoginRequiredMixin, ApprovePermMixin, View):
    def post(self, request, pk):
        tx = get_object_or_404(PaymentTransaction, pk=pk)
        try:
            approve_payment_transaction(tx=tx, user=request.user)
            messages.success(request, "Ödeme onaylandı.")
        except PaymentRuleError as exc:
            messages.error(request, str(exc))
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": tx.payable.pk}))


class PaymentRejectView(LoginRequiredMixin, ApprovePermMixin, View):
    def post(self, request, pk):
        tx = get_object_or_404(PaymentTransaction, pk=pk)
        reason = request.POST.get("reason", "")
        try:
            reject_payment_transaction(tx=tx, user=request.user, reason=reason)
            messages.warning(request, "Ödeme reddedildi.")
        except PaymentRuleError as exc:
            messages.error(request, str(exc))
        return HttpResponseRedirect(reverse("finance:detail", kwargs={"pk": tx.payable.pk}))
