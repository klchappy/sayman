"""Subscriptions: Abonelik + Taahhüt + Dönemsel ücret."""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class ServiceType(models.TextChoices):
    INTERNET = "INTERNET", "İnternet"
    PHONE = "PHONE", "Telefon"
    GSM = "GSM", "GSM"
    ELECTRICITY = "ELECTRICITY", "Elektrik"
    NATURAL_GAS = "NATURAL_GAS", "Doğalgaz"
    WATER = "WATER", "Su"
    SOFTWARE = "SOFTWARE", "Yazılım"
    AIDAT = "AIDAT", "Aidat"
    OTHER = "OTHER", "Diğer"


class SubscriptionStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    PASSIVE = "PASSIVE", "Pasif"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class CommitmentStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    APPROACHING = "APPROACHING", "Yaklaşıyor"
    EXPIRED = "EXPIRED", "Süresi Doldu"
    RENEWED = "RENEWED", "Yenilendi"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class PeriodChargeStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING = "PENDING", "Bekliyor"
    LINKED = "LINKED", "PayableItem Bağlı"
    PAID = "PAID", "Ödendi"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class PeriodChargeSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    IMPORT_DRAFT = "IMPORT_DRAFT", "Import Draft"
    OTHER = "OTHER", "Diğer"


class Subscription(BaseModel):
    """Abonelik master kaydı."""

    OWNER_TYPES = [
        ("COMPANY", "Şirket"),
        ("PERSON", "Şahıs"),
        ("FAMILY", "Aile"),
        ("OTHER", "Diğer"),
    ]
    owner_type = models.CharField(max_length=16, choices=OWNER_TYPES, default="COMPANY")
    company = models.ForeignKey("parties.Company", null=True, blank=True, on_delete=models.SET_NULL, related_name="subscriptions")
    person = models.ForeignKey("parties.Person", null=True, blank=True, on_delete=models.SET_NULL, related_name="subscriptions")

    title = models.CharField(max_length=255)
    service_type = models.CharField(max_length=24, choices=ServiceType.choices, default=ServiceType.OTHER)
    institution = models.ForeignKey("parties.Institution", null=True, blank=True, on_delete=models.SET_NULL, related_name="subscriptions")
    provider_name = models.CharField(max_length=128, blank=True, default="")
    account_no = models.CharField(max_length=64, blank=True, default="", db_index=True)
    service_no = models.CharField(max_length=64, blank=True, default="")
    phone_no = models.CharField(max_length=32, blank=True, default="")
    location_label = models.CharField(max_length=128, blank=True, default="")
    address = models.TextField(blank=True, default="")

    default_payment_method = models.CharField(max_length=16, default="AUTO")
    default_bank = models.ForeignKey("parties.Bank", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    package_name = models.CharField(max_length=128, blank=True, default="")
    expected_monthly_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="TRY")
    status = models.CharField(max_length=16, choices=SubscriptionStatus.choices, default=SubscriptionStatus.ACTIVE, db_index=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="subscriptions_created")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="subscriptions_updated")

    class Meta:
        verbose_name = "Abonelik"
        verbose_name_plural = "Abonelikler"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "service_type"])]

    def __str__(self):
        return self.title

    @property
    def owner_label(self):
        if self.owner_type == "COMPANY" and self.company:
            return self.company.name
        if self.owner_type == "PERSON" and self.person:
            return self.person.full_name
        return self.get_owner_type_display()


class SubscriptionCommitment(BaseModel):
    """Taahhüt — başlangıç/bitiş + kampanya."""

    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="commitments")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField()
    campaign_name = models.CharField(max_length=128, blank=True, default="")
    committed_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    normal_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cancellation_fee = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    auto_renew = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=CommitmentStatus.choices, default=CommitmentStatus.ACTIVE, db_index=True)
    reminder_days = models.JSONField(default=list, blank=True)  # [60,30,15,7,1]

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="commitments_created")

    class Meta:
        verbose_name = "Taahhüt"
        verbose_name_plural = "Taahhütler"
        ordering = ["end_date"]

    def __str__(self):
        return f"{self.subscription} · biten {self.end_date}"


class SubscriptionPeriodCharge(BaseModel):
    """Abonelik dönemsel ücret kaydı (PayableItem'a bağlanabilir)."""

    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="period_charges")
    period_label = models.CharField(max_length=32, blank=True, default="")
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    payable = models.ForeignKey("finance.PayableItem", null=True, blank=True, on_delete=models.SET_NULL, related_name="subscription_charges")
    status = models.CharField(max_length=16, choices=PeriodChargeStatus.choices, default=PeriodChargeStatus.PENDING, db_index=True)
    source = models.CharField(max_length=16, choices=PeriodChargeSource.choices, default=PeriodChargeSource.MANUAL)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="subscription_charges_created")

    # Idempotency için doğal anahtar — aynı abonelik + period_label + due_date kombinasyonu
    class Meta:
        verbose_name = "Abonelik Dönemsel Ücret"
        verbose_name_plural = "Abonelik Dönemsel Ücretler"
        ordering = ["-due_date"]
        unique_together = [("subscription", "period_label", "due_date")]

    def __str__(self):
        return f"{self.subscription} · {self.period_label} · {self.amount}"

    # Owner geçişi (PayableItem oluştururken kullanılır)
    @property
    def owner_type(self):
        return self.subscription.owner_type

    @property
    def company(self):
        return self.subscription.company

    @property
    def person(self):
        return self.subscription.person

    @property
    def currency(self):
        return self.subscription.currency
