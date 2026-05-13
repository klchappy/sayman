"""Official Payments — BAĞKUR / SSK / BES / İTO / Vergi."""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class PaymentType(models.TextChoices):
    BAGKUR = "BAGKUR", "BAĞKUR"
    SSK = "SSK", "SSK"
    BES = "BES", "BES"
    ITO = "ITO", "İTO Aidatı"
    TAX = "TAX", "Vergi"
    MUNICIPAL = "MUNICIPAL", "Belediye"
    OTHER = "OTHER", "Diğer Resmi"


class OfficialPeriodType(models.TextChoices):
    MONTHLY = "MONTHLY", "Aylık"
    QUARTERLY = "QUARTERLY", "3 Aylık"
    SEMI_ANNUAL = "SEMI_ANNUAL", "6 Aylık"
    YEARLY = "YEARLY", "Yıllık"
    INSTALLMENT = "INSTALLMENT", "Taksit"
    CUSTOM = "CUSTOM", "Özel"


class OfficialProfileStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    PASSIVE = "PASSIVE", "Pasif"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class OfficialPeriodStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING = "PENDING", "Bekliyor"
    LINKED = "LINKED", "PayableItem Bağlı"
    PAID = "PAID", "Ödendi"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class OfficialPeriodSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    GENERATED = "GENERATED", "Toplu Üretildi"
    IMPORT_DRAFT = "IMPORT_DRAFT", "Import Draft"
    OTHER = "OTHER", "Diğer"


class OfficialPaymentProfile(BaseModel):
    OWNER_TYPES = [("COMPANY", "Şirket"), ("PERSON", "Şahıs"), ("FAMILY", "Aile"), ("OTHER", "Diğer")]
    owner_type = models.CharField(max_length=16, choices=OWNER_TYPES, default="PERSON")
    company = models.ForeignKey("parties.Company", null=True, blank=True, on_delete=models.SET_NULL, related_name="official_profiles")
    person = models.ForeignKey("parties.Person", null=True, blank=True, on_delete=models.SET_NULL, related_name="official_profiles")

    title = models.CharField(max_length=255)
    payment_type = models.CharField(max_length=16, choices=PaymentType.choices, db_index=True)
    institution = models.ForeignKey("parties.Institution", null=True, blank=True, on_delete=models.SET_NULL, related_name="official_profiles")
    reference_no = models.CharField(max_length=64, blank=True, default="", help_text="TC, Sicil, Vergi no, vs.")

    period_type = models.CharField(max_length=16, choices=OfficialPeriodType.choices, default=OfficialPeriodType.MONTHLY)
    default_due_day = models.IntegerField(null=True, blank=True)
    default_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="TRY")
    default_payment_method = models.CharField(max_length=16, default="EFT")
    default_bank = models.ForeignKey("parties.Bank", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    status = models.CharField(max_length=16, choices=OfficialProfileStatus.choices, default=OfficialProfileStatus.ACTIVE, db_index=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="official_profiles_created")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="official_profiles_updated")

    class Meta:
        verbose_name = "Resmi Ödeme Profili"
        verbose_name_plural = "Resmi Ödeme Profilleri"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def owner_label(self):
        if self.owner_type == "COMPANY" and self.company:
            return self.company.name
        if self.owner_type == "PERSON" and self.person:
            return self.person.full_name
        return self.get_owner_type_display()


class OfficialPaymentPeriod(BaseModel):
    profile = models.ForeignKey(OfficialPaymentProfile, on_delete=models.CASCADE, related_name="periods")
    period_label = models.CharField(max_length=32, blank=True, default="")
    installment_no = models.IntegerField(null=True, blank=True, help_text="Taksit no (örn. İTO 1/2)")
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    payable = models.ForeignKey("finance.PayableItem", null=True, blank=True, on_delete=models.SET_NULL, related_name="official_periods")
    status = models.CharField(max_length=16, choices=OfficialPeriodStatus.choices, default=OfficialPeriodStatus.PENDING, db_index=True)
    source = models.CharField(max_length=16, choices=OfficialPeriodSource.choices, default=OfficialPeriodSource.MANUAL)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="official_periods_created")

    class Meta:
        verbose_name = "Resmi Ödeme Dönemi"
        verbose_name_plural = "Resmi Ödeme Dönemleri"
        ordering = ["-due_date"]
        unique_together = [("profile", "period_label", "installment_no", "due_date")]

    def __str__(self):
        installment = f"#{self.installment_no} " if self.installment_no else ""
        return f"{self.profile} · {self.period_label} {installment}· {self.amount}"

    @property
    def owner_type(self):
        return self.profile.owner_type
    @property
    def company(self):
        return self.profile.company
    @property
    def person(self):
        return self.profile.person
    @property
    def currency(self):
        return self.profile.currency
