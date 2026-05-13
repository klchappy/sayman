"""
Teminat Mektupları & Komisyon — Faz 8 Manual MVP.

Anayasa Madde 1.5 (izolasyon), 3.4 (onaysız domain commit yok),
3.5 (audit), 3.8 (soft-delete), 3.16 (yyyy long-format).

Sınırsız genişleme: gerçek mektup hardcode YOK; iade/yenileme/iptal
lifecycle UI'dan yönetilebilir; geçmiş komisyon kayıtları korunur.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


# === ENUMs ================================================================

class GuaranteeType(models.TextChoices):
    PHYSICAL = "PHYSICAL", "Fiziki"
    ELECTRONIC = "ELECTRONIC", "Elektronik"
    OTHER = "OTHER", "Diğer"


class CommissionPeriodKind(models.TextChoices):
    MONTHLY = "MONTHLY", "Aylık"
    QUARTERLY = "QUARTERLY", "3 Aylık"
    SEMI_ANNUAL = "SEMI_ANNUAL", "6 Aylık"
    YEARLY = "YEARLY", "Yıllık"
    ONE_TIME = "ONE_TIME", "Tek Seferlik"
    CUSTOM = "CUSTOM", "Özel"


class GuaranteeStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    APPROACHING = "APPROACHING", "Yaklaşan Vade"
    EXPIRED = "EXPIRED", "Süresi Doldu"
    RETURNED = "RETURNED", "İade"
    RENEWED = "RENEWED", "Yenilendi"
    CANCELLED = "CANCELLED", "İptal"
    PASSIVE = "PASSIVE", "Pasif"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class CommissionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING = "PENDING", "Bekliyor"
    LINKED = "LINKED", "PayableItem Bağlı"
    PAID = "PAID", "Ödendi"
    OVERDUE = "OVERDUE", "Geciken"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class CommissionSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    GENERATED = "GENERATED", "Üretildi"
    IMPORT_DRAFT = "IMPORT_DRAFT", "Import Draft"
    OTHER = "OTHER", "Diğer"


class GuaranteeDocumentRole(models.TextChoices):
    GUARANTEE_LETTER = "GUARANTEE_LETTER", "Teminat Mektubu"
    COMMISSION_RECEIPT = "COMMISSION_RECEIPT", "Komisyon Dekontu"
    RETURN_LETTER = "RETURN_LETTER", "İade Yazısı"
    RENEWAL_DOCUMENT = "RENEWAL_DOCUMENT", "Yenileme Belgesi"
    BANK_NOTICE = "BANK_NOTICE", "Banka Yazısı"
    OTHER = "OTHER", "Diğer"


# === MODELS ===============================================================

class GuaranteeLetter(BaseModel):
    """Banka teminat mektubu kartı."""

    owner_company = models.ForeignKey(
        "parties.Company", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guarantee_letters",
        verbose_name="Şirket",
    )
    owner_person = models.ForeignKey(
        "parties.Person", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guarantee_letters",
        verbose_name="Şahıs",
    )
    bank = models.ForeignKey(
        "parties.Bank", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guarantee_letters",
        verbose_name="Banka",
    )
    beneficiary_institution = models.ForeignKey(
        "parties.Institution", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guarantee_letters",
        verbose_name="Lehdar Kurum",
    )

    letter_no = models.CharField(max_length=64, db_index=True, verbose_name="Mektup No")
    title = models.CharField(max_length=255, verbose_name="Başlık")
    guarantee_type = models.CharField(
        max_length=16, choices=GuaranteeType.choices, default=GuaranteeType.PHYSICAL,
        verbose_name="Tip",
    )
    purpose = models.CharField(max_length=255, blank=True, default="", verbose_name="Amaç")
    facility_label = models.CharField(
        max_length=128, blank=True, default="", verbose_name="Limit/Facility",
    )

    issue_date = models.DateField(null=True, blank=True, verbose_name="Düzenlenme")
    expiry_date = models.DateField(null=True, blank=True, db_index=True, verbose_name="Vade")

    amount = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Tutar")
    currency = models.CharField(max_length=8, default="TRY", verbose_name="Para Birimi")

    commission_rate = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
        verbose_name="Komisyon Oranı (%)",
    )
    commission_period = models.CharField(
        max_length=16, choices=CommissionPeriodKind.choices,
        default=CommissionPeriodKind.QUARTERLY, verbose_name="Komisyon Periyodu",
    )

    status = models.CharField(
        max_length=16, choices=GuaranteeStatus.choices,
        default=GuaranteeStatus.ACTIVE, db_index=True, verbose_name="Durum",
    )
    renewed_from = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="renewed_to_set", verbose_name="Eski Mektup",
    )
    renewed_to = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="renewed_from_set", verbose_name="Yeni Mektup",
    )
    returned_at = models.DateField(null=True, blank=True, verbose_name="İade Tarihi")
    cancelled_at = models.DateField(null=True, blank=True, verbose_name="İptal Tarihi")
    notes = models.TextField(blank=True, default="", verbose_name="Notlar")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guarantees_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guarantees_updated",
    )

    class Meta:
        verbose_name = "Teminat Mektubu"
        verbose_name_plural = "Teminat Mektupları"
        ordering = ["-issue_date", "letter_no"]
        constraints = [
            models.UniqueConstraint(
                fields=["bank", "letter_no"],
                condition=models.Q(letter_no__gt=""),
                name="uniq_bank_letterno_when_set",
            ),
        ]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["expiry_date"]),
        ]

    def __str__(self):
        return f"{self.letter_no} · {self.title}"

    # period_link helper alanları (PayableItem için)
    @property
    def owner_type(self) -> str:
        if self.owner_company_id:
            return "COMPANY"
        if self.owner_person_id:
            return "PERSON"
        return "OTHER"

    @property
    def company(self):
        return self.owner_company

    @property
    def person(self):
        return self.owner_person


class GuaranteeCommissionPeriod(BaseModel):
    """Teminat mektubunun komisyon ödeme dönemi."""

    guarantee = models.ForeignKey(
        GuaranteeLetter, on_delete=models.CASCADE,
        related_name="commission_periods", verbose_name="Teminat",
    )
    period_label = models.CharField(max_length=32, verbose_name="Dönem Etiketi",
                                    help_text="Örn. 2025-Q2 veya 2025-04")
    due_date = models.DateField(verbose_name="Son Ödeme")
    commission_amount = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="Komisyon Tutarı",
    )

    payable = models.OneToOneField(
        "finance.PayableItem", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guarantee_commission",
        verbose_name="Bağlı PayableItem",
    )
    status = models.CharField(
        max_length=16, choices=CommissionStatus.choices,
        default=CommissionStatus.PENDING, db_index=True, verbose_name="Durum",
    )
    source = models.CharField(
        max_length=16, choices=CommissionSource.choices,
        default=CommissionSource.MANUAL, verbose_name="Kaynak",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notlar")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="commission_periods_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="commission_periods_updated",
    )

    class Meta:
        verbose_name = "Komisyon Dönemi"
        verbose_name_plural = "Komisyon Dönemleri"
        ordering = ["-due_date"]
        unique_together = [("guarantee", "period_label")]
        indexes = [models.Index(fields=["due_date"])]

    def __str__(self):
        return f"{self.guarantee.letter_no} · {self.period_label}"

    # period_link helper alanları
    @property
    def owner_type(self) -> str:
        return self.guarantee.owner_type

    @property
    def company(self):
        return self.guarantee.owner_company

    @property
    def person(self):
        return self.guarantee.owner_person

    @property
    def amount(self):
        return self.commission_amount

    @property
    def currency(self) -> str:
        return self.guarantee.currency or "TRY"


class GuaranteeDocument(BaseModel):
    """Teminat PDF, komisyon dekontu, iade yazısı, yenileme belgesi."""

    guarantee = models.ForeignKey(
        GuaranteeLetter, null=True, blank=True,
        on_delete=models.CASCADE, related_name="documents",
    )
    commission_period = models.ForeignKey(
        GuaranteeCommissionPeriod, null=True, blank=True,
        on_delete=models.CASCADE, related_name="documents",
    )
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT,
        related_name="guarantee_links",
    )
    document_role = models.CharField(
        max_length=24, choices=GuaranteeDocumentRole.choices,
        default=GuaranteeDocumentRole.OTHER,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guarantee_docs_uploaded",
    )

    class Meta:
        verbose_name = "Teminat Belgesi"
        verbose_name_plural = "Teminat Belgeleri"
        ordering = ["-created_at"]
        unique_together = [("guarantee", "commission_period", "document", "document_role")]

    def __str__(self):
        ref = self.commission_period or self.guarantee
        return f"{ref} · {self.get_document_role_display()}"
