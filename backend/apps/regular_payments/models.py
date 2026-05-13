"""Regular Payments — Kira/SMMM/İş Güvenliği/Domain/Hosting/Noter/K2/Hizmet."""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class RegularCategory(models.TextChoices):
    RENT = "RENT", "Kira"
    SMMM = "SMMM", "SMMM"
    OCCUPATIONAL_SAFETY = "OCCUPATIONAL_SAFETY", "İş Güvenliği"
    DOMAIN = "DOMAIN", "Domain"
    HOSTING = "HOSTING", "Hosting"
    NOTARY = "NOTARY", "Noter"
    K2 = "K2", "K2 Belgesi"
    SERVICE = "SERVICE", "Hizmet"
    OTHER = "OTHER", "Diğer"


class PeriodType(models.TextChoices):
    MONTHLY = "MONTHLY", "Aylık"
    QUARTERLY = "QUARTERLY", "3 Aylık"
    SEMI_ANNUAL = "SEMI_ANNUAL", "6 Aylık"
    YEARLY = "YEARLY", "Yıllık"
    ONE_TIME = "ONE_TIME", "Tek Sefer"
    CUSTOM = "CUSTOM", "Özel"


class ProfileStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    PASSIVE = "PASSIVE", "Pasif"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class PeriodStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING = "PENDING", "Bekliyor"
    LINKED = "LINKED", "PayableItem Bağlı"
    PAID = "PAID", "Ödendi"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class PeriodSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    GENERATED = "GENERATED", "Toplu Üretildi"
    IMPORT_DRAFT = "IMPORT_DRAFT", "Import Draft"
    OTHER = "OTHER", "Diğer"


class RegularPaymentProfile(BaseModel):
    OWNER_TYPES = [("COMPANY", "Şirket"), ("PERSON", "Şahıs"), ("FAMILY", "Aile"), ("OTHER", "Diğer")]
    owner_type = models.CharField(max_length=16, choices=OWNER_TYPES, default="COMPANY")
    company = models.ForeignKey("parties.Company", null=True, blank=True, on_delete=models.SET_NULL, related_name="regular_profiles")
    person = models.ForeignKey("parties.Person", null=True, blank=True, on_delete=models.SET_NULL, related_name="regular_profiles")

    title = models.CharField(max_length=255)
    category = models.CharField(max_length=24, choices=RegularCategory.choices, default=RegularCategory.OTHER, db_index=True)
    supplier_name = models.CharField(max_length=128, blank=True, default="")
    institution = models.ForeignKey("parties.Institution", null=True, blank=True, on_delete=models.SET_NULL, related_name="regular_profiles")

    period_type = models.CharField(max_length=16, choices=PeriodType.choices, default=PeriodType.MONTHLY)
    default_due_day = models.IntegerField(null=True, blank=True, help_text="Ayın N'i (1-31)")
    default_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="TRY")
    default_payment_method = models.CharField(max_length=16, default="EFT")
    default_bank = models.ForeignKey("parties.Bank", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=ProfileStatus.choices, default=ProfileStatus.ACTIVE, db_index=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="regular_profiles_created")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="regular_profiles_updated")

    class Meta:
        verbose_name = "Düzenli Ödeme Profili"
        verbose_name_plural = "Düzenli Ödeme Profilleri"
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


class RegularPaymentPeriod(BaseModel):
    profile = models.ForeignKey(RegularPaymentProfile, on_delete=models.CASCADE, related_name="periods")
    period_label = models.CharField(max_length=32, blank=True, default="")
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    payable = models.ForeignKey("finance.PayableItem", null=True, blank=True, on_delete=models.SET_NULL, related_name="regular_periods")
    status = models.CharField(max_length=16, choices=PeriodStatus.choices, default=PeriodStatus.PENDING, db_index=True)
    source = models.CharField(max_length=16, choices=PeriodSource.choices, default=PeriodSource.MANUAL)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="regular_periods_created")

    class Meta:
        verbose_name = "Düzenli Ödeme Dönemi"
        verbose_name_plural = "Düzenli Ödeme Dönemleri"
        ordering = ["-due_date"]
        unique_together = [("profile", "period_label", "due_date")]

    def __str__(self):
        return f"{self.profile} · {self.period_label} · {self.amount}"

    # PayableItem helper
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
