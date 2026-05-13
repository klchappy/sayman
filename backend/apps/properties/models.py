"""
Emlak Vergisi & Mülk Takip — Faz 7 Manual MVP.

Anayasa Madde 1.5 (izolasyon), 3.4 (onaysız domain commit yok),
3.5 (audit), 3.8 (soft-delete), 3.16 (yyyy long-format).

Sınırsız genişleme: Mülk hardcode YOK. Yeni mülk UI'dan eklenebilir,
satılan mülk SOLD/PASSIVE olabilir, geçmiş yıl/taksit kayıtları korunur.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


# === ENUMs ================================================================

class TaxYearStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING = "PENDING", "Bekliyor"
    PARTIAL_PAID = "PARTIAL_PAID", "Kısmi Ödendi"
    PAID = "PAID", "Ödendi"
    OVERDUE = "OVERDUE", "Geciken"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class TaxYearSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    IMPORT_DRAFT = "IMPORT_DRAFT", "Import Draft"
    OTHER = "OTHER", "Diğer"


class InstallmentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING = "PENDING", "Bekliyor"
    LINKED = "LINKED", "PayableItem Bağlı"
    PAID = "PAID", "Ödendi"
    OVERDUE = "OVERDUE", "Geciken"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class TaxDocumentRole(models.TextChoices):
    DEBT_STATEMENT = "DEBT_STATEMENT", "Borç Dökümü"
    RECEIPT = "RECEIPT", "Makbuz"
    PAYMENT_PROOF = "PAYMENT_PROOF", "Ödeme Dekontu"
    MUNICIPAL_NOTICE = "MUNICIPAL_NOTICE", "Belediye Yazısı"
    OTHER = "OTHER", "Diğer"


# === MODELS ===============================================================

class Municipality(BaseModel):
    """Belediye master/referans kaydı."""

    name = models.CharField(max_length=128, verbose_name="Belediye Adı")
    province = models.CharField(max_length=64, blank=True, default="", verbose_name="İl")
    district = models.CharField(max_length=64, blank=True, default="", verbose_name="İlçe")
    website = models.URLField(blank=True, default="", verbose_name="Web Sitesi")

    class Meta:
        verbose_name = "Belediye"
        verbose_name_plural = "Belediyeler"
        ordering = ["name"]
        unique_together = [("name", "province", "district")]

    def __str__(self):
        return f"{self.name}{' / ' + self.district if self.district else ''}"


class PropertyTaxYear(BaseModel):
    """Bir mülkün belirli yıl için emlak vergisi takip kaydı."""

    property_asset = models.ForeignKey(
        "parties.PropertyAsset", on_delete=models.PROTECT,
        related_name="tax_years", verbose_name="Mülk",
    )
    municipality = models.ForeignKey(
        Municipality, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="tax_years",
        verbose_name="Belediye",
    )
    tax_year = models.IntegerField(verbose_name="Yıl")

    total_accrual_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0"),
        verbose_name="Tahakkuk Toplam",
    )
    total_paid_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0"),
        verbose_name="Ödenen",
    )
    remaining_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0"),
        verbose_name="Kalan",
    )

    status = models.CharField(
        max_length=16, choices=TaxYearStatus.choices, default=TaxYearStatus.PENDING,
        db_index=True, verbose_name="Durum",
    )
    source = models.CharField(
        max_length=16, choices=TaxYearSource.choices, default=TaxYearSource.MANUAL,
        verbose_name="Kaynak",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notlar")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="property_tax_years_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="property_tax_years_updated",
    )

    class Meta:
        verbose_name = "Emlak Vergisi Yılı"
        verbose_name_plural = "Emlak Vergisi Yılları"
        ordering = ["-tax_year", "property_asset__name"]
        unique_together = [("property_asset", "tax_year")]
        indexes = [
            models.Index(fields=["tax_year"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.property_asset.name} · {self.tax_year}"


class PropertyTaxInstallment(BaseModel):
    """Yıllık emlak vergisinin taksit kaydı (1./2. taksit veya tek)."""

    tax_year = models.ForeignKey(
        PropertyTaxYear, on_delete=models.CASCADE,
        related_name="installments", verbose_name="Yıl",
    )
    installment_no = models.IntegerField(
        verbose_name="Taksit No",
        help_text="1 = Mayıs, 2 = Kasım, 0 = Tek/Diğer",
    )
    due_date = models.DateField(verbose_name="Son Ödeme")
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Tutar")

    payable = models.OneToOneField(
        "finance.PayableItem", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="tax_installment",
        verbose_name="Bağlı PayableItem",
    )
    status = models.CharField(
        max_length=16, choices=InstallmentStatus.choices,
        default=InstallmentStatus.PENDING, db_index=True, verbose_name="Durum",
    )
    payment_date = models.DateField(null=True, blank=True, verbose_name="Ödeme Tarihi")
    notes = models.TextField(blank=True, default="", verbose_name="Notlar")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="tax_installments_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="tax_installments_updated",
    )

    class Meta:
        verbose_name = "Emlak Vergisi Taksiti"
        verbose_name_plural = "Emlak Vergisi Taksitleri"
        ordering = ["-tax_year__tax_year", "installment_no"]
        unique_together = [("tax_year", "installment_no")]

    def __str__(self):
        return f"{self.tax_year} · {self.installment_no}. taksit · {self.amount}"

    # --- period_link helper alanları (PayableItem için) ---
    @property
    def owner_type(self) -> str:
        pa = self.tax_year.property_asset
        if pa.owner_type == "COMPANY":
            return "COMPANY"
        if pa.owner_type == "PERSON":
            return "PERSON"
        return "OTHER"
    @property
    def company(self):
        return self.tax_year.property_asset.owner_company
    @property
    def person(self):
        return self.tax_year.property_asset.owner_person
    @property
    def currency(self) -> str:
        return "TRY"


class PropertyTaxDocument(BaseModel):
    """Borç dökümü, makbuz, dekont, belediye yazısı."""

    tax_year = models.ForeignKey(
        PropertyTaxYear, null=True, blank=True,
        on_delete=models.CASCADE, related_name="documents",
    )
    installment = models.ForeignKey(
        PropertyTaxInstallment, null=True, blank=True,
        on_delete=models.CASCADE, related_name="documents",
    )
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT,
        related_name="property_tax_links",
    )
    document_role = models.CharField(
        max_length=24, choices=TaxDocumentRole.choices,
        default=TaxDocumentRole.OTHER,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="property_tax_docs_uploaded",
    )

    class Meta:
        verbose_name = "Emlak Vergisi Belgesi"
        verbose_name_plural = "Emlak Vergisi Belgeleri"
        ordering = ["-created_at"]
        unique_together = [("tax_year", "installment", "document", "document_role")]

    def __str__(self):
        ref = self.installment or self.tax_year
        return f"{ref} · {self.get_document_role_display()}"
