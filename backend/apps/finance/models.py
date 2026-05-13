"""
Finance modelleri — Fatura/Ödeme MVP (manual-first).

PHASE1_DATA_MODEL_PLAN.md B.1-B.3 uyarlanmış MVP versiyonu.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


# === ENUM'LAR ==============================================================

class OwnerType(models.TextChoices):
    COMPANY = "COMPANY", "Şirket"
    PERSON = "PERSON", "Şahıs"
    FAMILY = "FAMILY", "Aile"
    OTHER = "OTHER", "Diğer"


class PayableStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING = "PENDING", "Bekliyor"
    APPROACHING = "APPROACHING", "Yaklaşıyor"
    OVERDUE = "OVERDUE", "Geciken"
    PARTIAL_PAID = "PARTIAL_PAID", "Kısmi Ödendi"
    PAID = "PAID", "Ödendi"
    CANCELLED = "CANCELLED", "İptal"
    ARCHIVED = "ARCHIVED", "Arşiv"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"
    WAITING_APPROVAL = "WAITING_APPROVAL", "Onay Bekliyor"


class PaymentMethod(models.TextChoices):
    AUTO = "AUTO", "Otomatik Talimat"
    EFT = "EFT", "EFT"
    HAVALE = "HAVALE", "Havale"
    CREDIT_CARD = "CREDIT_CARD", "Kredi Kartı"
    CASH = "CASH", "Nakit"
    ELDEN = "ELDEN", "Elden"
    OTHER = "OTHER", "Diğer"


class PayableSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    IMPORT_DRAFT = "IMPORT_DRAFT", "Import Draft"
    PDF = "PDF", "PDF"
    EXCEL = "EXCEL", "Excel"
    OTHER = "OTHER", "Diğer"


class TransactionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Onay Bekliyor"
    APPROVED = "APPROVED", "Onaylı"
    REJECTED = "REJECTED", "Reddedildi"
    CANCELLED = "CANCELLED", "İptal"


class DocumentRole(models.TextChoices):
    INVOICE = "INVOICE", "Fatura"
    RECEIPT = "RECEIPT", "Dekont"
    CONTRACT = "CONTRACT", "Sözleşme"
    STATEMENT = "STATEMENT", "Ekstre"
    OTHER = "OTHER", "Diğer"


# === MODELLER ==============================================================

class PayableItem(BaseModel):
    """Takip edilen borç/fatura/ödeme kalemi."""

    owner_type = models.CharField(
        max_length=16, choices=OwnerType.choices, default=OwnerType.COMPANY,
        verbose_name="Sahip Tipi",
    )
    company = models.ForeignKey(
        "parties.Company", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payables",
    )
    person = models.ForeignKey(
        "parties.Person", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payables",
    )

    title = models.CharField(max_length=255, verbose_name="Başlık")
    category = models.CharField(max_length=64, blank=True, default="", verbose_name="Kategori")

    institution = models.ForeignKey(
        "parties.Institution", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payables", verbose_name="Kurum",
    )
    supplier_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Tedarikçi")
    invoice_number = models.CharField(max_length=128, blank=True, default="", verbose_name="Fatura No")
    subscription_reference = models.CharField(max_length=128, blank=True, default="", verbose_name="Abonelik / Hesap No")
    period_label = models.CharField(max_length=32, blank=True, default="", verbose_name="Dönem (örn. 2026-05)")

    issue_date = models.DateField(null=True, blank=True, verbose_name="Fatura Tarihi")
    due_date = models.DateField(verbose_name="Son Ödeme")

    currency = models.CharField(max_length=8, default="TRY")
    amount = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Tutar")
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"), verbose_name="Ödenen")

    status = models.CharField(
        max_length=24, choices=PayableStatus.choices, default=PayableStatus.PENDING,
        db_index=True, verbose_name="Durum",
    )
    payment_method = models.CharField(
        max_length=16, choices=PaymentMethod.choices, default=PaymentMethod.EFT,
        verbose_name="Ödeme Yöntemi",
    )
    bank = models.ForeignKey(
        "parties.Bank", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payables", verbose_name="Banka",
    )

    source = models.CharField(
        max_length=16, choices=PayableSource.choices, default=PayableSource.MANUAL,
        verbose_name="Kaynak",
    )

    requires_receipt = models.BooleanField(default=False, verbose_name="Dekont Zorunlu")
    requires_double_approval = models.BooleanField(default=False, verbose_name="Çift Onay Zorunlu")

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payables_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payables_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payables_updated",
    )

    class Meta:
        verbose_name = "Fatura / Ödeme Kalemi"
        verbose_name_plural = "Fatura / Ödeme Kalemleri"
        ordering = ["-due_date", "-created_at"]
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["owner_type", "company", "person"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.due_date:%d.%m.%Y})"

    # --- Computed properties -----------------------------------------------

    @property
    def remaining_amount(self) -> Decimal:
        return (self.amount or Decimal("0")) - (self.amount_paid or Decimal("0"))

    @property
    def has_receipt(self) -> bool:
        return self.documents.filter(document_role=DocumentRole.RECEIPT).exists()

    @property
    def is_overdue(self) -> bool:
        from django.utils import timezone
        if self.status in (PayableStatus.PAID, PayableStatus.CANCELLED, PayableStatus.ARCHIVED):
            return False
        return self.due_date < timezone.localdate()

    @property
    def owner_label(self) -> str:
        if self.owner_type == OwnerType.COMPANY and self.company:
            return self.company.name
        if self.owner_type == OwnerType.PERSON and self.person:
            return self.person.full_name
        return self.get_owner_type_display()


class PaymentTransaction(BaseModel):
    """Bir PayableItem için tek ödeme hareketi (kısmi veya tam)."""

    payable = models.ForeignKey(
        PayableItem, on_delete=models.CASCADE, related_name="transactions",
    )
    payment_date = models.DateField(verbose_name="Ödeme Tarihi")
    amount = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Tutar")
    payment_method = models.CharField(
        max_length=16, choices=PaymentMethod.choices, default=PaymentMethod.EFT,
    )
    bank = models.ForeignKey(
        "parties.Bank", null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    status = models.CharField(
        max_length=24, choices=TransactionStatus.choices, default=TransactionStatus.APPROVED,
        db_index=True,
    )
    receipt_document = models.ForeignKey(
        "documents.Document", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payment_transactions",
    )
    note = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payment_transactions_created",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payment_transactions_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Ödeme Hareketi"
        verbose_name_plural = "Ödeme Hareketleri"
        ordering = ["-payment_date", "-created_at"]

    def __str__(self):
        return f"{self.payable.title} · {self.amount} ({self.payment_date:%d.%m.%Y})"


class PayableDocument(BaseModel):
    """PayableItem ↔ Document M2M ara tablosu (rol bilgisiyle)."""

    payable = models.ForeignKey(
        PayableItem, on_delete=models.CASCADE, related_name="documents",
    )
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT, related_name="payable_links",
    )
    document_role = models.CharField(
        max_length=16, choices=DocumentRole.choices, default=DocumentRole.INVOICE,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payable_documents_uploaded",
    )

    class Meta:
        verbose_name = "Fatura / Ödeme Belgesi"
        verbose_name_plural = "Fatura / Ödeme Belgeleri"
        ordering = ["-created_at"]
        unique_together = [("payable", "document", "document_role")]

    def __str__(self):
        return f"{self.payable} / {self.get_document_role_display()}"
