"""
Entegratör / Yazılım Hizmeti & Kontör — Faz 9 Manual MVP.

Anayasa Madde 1.5 (izolasyon), 3.4 (onaysız domain commit yok),
3.5 (audit), 3.8 (soft-delete), 3.16 (yyyy long-format).

Sınırsız genişleme: gerçek hizmet/sözleşme/kontör hardcode YOK;
provider_type ve service_type enum'larında OTHER vardır.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


# === ENUMs ================================================================

class ProviderType(models.TextChoices):
    ETA = "ETA", "ETA"
    PAPINET = "PAPINET", "Papinet"
    EDM = "EDM", "EDM"
    DIGITAL_PLANET = "DIGITAL_PLANET", "Digital Planet"
    OTHER = "OTHER", "Diğer"


class ServiceType(models.TextChoices):
    ACCOUNTING_SOFTWARE = "ACCOUNTING_SOFTWARE", "Muhasebe Yazılımı"
    E_INVOICE = "E_INVOICE", "e-Fatura"
    E_ARCHIVE = "E_ARCHIVE", "e-Arşiv"
    E_WAYBILL = "E_WAYBILL", "e-İrsaliye"
    E_LEDGER = "E_LEDGER", "e-Defter"
    DEFTER_SAKLAMA = "DEFTER_SAKLAMA", "Defter Saklama"
    CREDIT_PACKAGE = "CREDIT_PACKAGE", "Kontör Paketi"
    VERSION_RENEWAL = "VERSION_RENEWAL", "Versiyon Yenileme"
    OTHER = "OTHER", "Diğer"


class ServiceStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    PASSIVE = "PASSIVE", "Pasif"
    CANCELLED = "CANCELLED", "İptal"
    RENEWED = "RENEWED", "Yenilendi"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class ContractType(models.TextChoices):
    ANNUAL = "ANNUAL", "Yıllık"
    MONTHLY = "MONTHLY", "Aylık"
    ONE_TIME = "ONE_TIME", "Tek Seferlik"
    VERSION_RENEWAL = "VERSION_RENEWAL", "Versiyon Yenileme"
    DEFTER_SAKLAMA = "DEFTER_SAKLAMA", "Defter Saklama"
    TARIFF = "TARIFF", "Tarife"
    OTHER = "OTHER", "Diğer"


class ContractStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    ACTIVE = "ACTIVE", "Aktif"
    APPROACHING = "APPROACHING", "Yaklaşan Bitiş"
    EXPIRED = "EXPIRED", "Süresi Doldu"
    RENEWED = "RENEWED", "Yenilendi"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class CreditPackageStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    CRITICAL = "CRITICAL", "Kritik"
    EXHAUSTED = "EXHAUSTED", "Tükendi"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class IntegratorDocumentRole(models.TextChoices):
    CONTRACT = "CONTRACT", "Sözleşme"
    TARIFF = "TARIFF", "Tarife"
    INVOICE = "INVOICE", "Fatura"
    RECEIPT = "RECEIPT", "Dekont"
    CREDIT_PURCHASE = "CREDIT_PURCHASE", "Kontör Satın Alma"
    RENEWAL_DOCUMENT = "RENEWAL_DOCUMENT", "Yenileme Belgesi"
    OTHER = "OTHER", "Diğer"


# === MODELS ===============================================================

class SoftwareService(BaseModel):
    """ETA / Papinet / EDM / Digital Planet vb. yazılım veya entegratör hizmet kartı."""

    owner_company = models.ForeignKey(
        "parties.Company", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="software_services",
        verbose_name="Şirket",
    )
    owner_person = models.ForeignKey(
        "parties.Person", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="software_services",
        verbose_name="Şahıs",
    )

    provider_name = models.CharField(max_length=128, verbose_name="Sağlayıcı Adı")
    provider_type = models.CharField(
        max_length=24, choices=ProviderType.choices,
        default=ProviderType.OTHER, db_index=True, verbose_name="Sağlayıcı Tipi",
    )
    service_type = models.CharField(
        max_length=24, choices=ServiceType.choices,
        default=ServiceType.OTHER, db_index=True, verbose_name="Hizmet Tipi",
    )
    title = models.CharField(max_length=255, verbose_name="Başlık")
    customer_no = models.CharField(max_length=64, blank=True, default="",
                                    verbose_name="Müşteri No")
    account_no = models.CharField(max_length=64, blank=True, default="",
                                    verbose_name="Hesap No")

    status = models.CharField(
        max_length=16, choices=ServiceStatus.choices,
        default=ServiceStatus.ACTIVE, db_index=True, verbose_name="Durum",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notlar")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="software_services_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="software_services_updated",
    )

    class Meta:
        verbose_name = "Yazılım/Entegratör Hizmeti"
        verbose_name_plural = "Yazılım/Entegratör Hizmetleri"
        ordering = ["provider_name", "title"]
        indexes = [models.Index(fields=["status"]),
                   models.Index(fields=["provider_type", "service_type"])]

    def __str__(self):
        return f"{self.provider_name} · {self.title}"

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


class ServiceContract(BaseModel):
    """Yıllık sözleşme, versiyon yenileme, defter saklama, tarife."""

    service = models.ForeignKey(
        SoftwareService, on_delete=models.CASCADE,
        related_name="contracts", verbose_name="Hizmet",
    )
    contract_type = models.CharField(
        max_length=24, choices=ContractType.choices,
        default=ContractType.ANNUAL, verbose_name="Sözleşme Tipi",
    )
    title = models.CharField(max_length=255, verbose_name="Başlık")
    start_date = models.DateField(null=True, blank=True, verbose_name="Başlangıç")
    end_date = models.DateField(null=True, blank=True, db_index=True,
                                  verbose_name="Bitiş")
    renewal_date = models.DateField(null=True, blank=True, db_index=True,
                                      verbose_name="Yenileme")
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        verbose_name="Tutar",
    )
    currency = models.CharField(max_length=8, default="TRY",
                                  verbose_name="Para Birimi")
    payable = models.OneToOneField(
        "finance.PayableItem", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="integrator_contract",
        verbose_name="Bağlı PayableItem",
    )
    status = models.CharField(
        max_length=16, choices=ContractStatus.choices,
        default=ContractStatus.ACTIVE, db_index=True, verbose_name="Durum",
    )
    renewed_from = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="renewed_to_set", verbose_name="Eski Sözleşme",
    )
    renewed_to = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="renewed_from_set", verbose_name="Yeni Sözleşme",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notlar")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="integrator_contracts_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="integrator_contracts_updated",
    )

    class Meta:
        verbose_name = "Hizmet Sözleşmesi"
        verbose_name_plural = "Hizmet Sözleşmeleri"
        ordering = ["-renewal_date", "-end_date"]
        indexes = [models.Index(fields=["status"]),
                   models.Index(fields=["end_date"]),
                   models.Index(fields=["renewal_date"])]

    def __str__(self):
        return f"{self.service.provider_name} · {self.title}"

    # PayableItem helper
    @property
    def owner_type(self) -> str:
        return self.service.owner_type

    @property
    def company(self):
        return self.service.owner_company

    @property
    def person(self):
        return self.service.owner_person

    @property
    def due_date(self):
        from django.utils import timezone
        return self.renewal_date or self.end_date or timezone.localdate()


class CreditPackage(BaseModel):
    """E-fatura/e-arşiv/e-irsaliye kontör paketi."""

    service = models.ForeignKey(
        SoftwareService, on_delete=models.CASCADE,
        related_name="credit_packages", verbose_name="Hizmet",
    )
    package_name = models.CharField(max_length=255, verbose_name="Paket Adı")
    purchase_date = models.DateField(null=True, blank=True,
                                       verbose_name="Alış Tarihi")
    total_credits = models.PositiveIntegerField(default=0,
                                                  verbose_name="Toplam Kontör")
    remaining_credits = models.PositiveIntegerField(default=0,
                                                      verbose_name="Kalan Kontör")
    critical_threshold = models.PositiveIntegerField(default=100,
                                                       verbose_name="Kritik Eşik")
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        verbose_name="Tutar",
    )
    currency = models.CharField(max_length=8, default="TRY",
                                  verbose_name="Para Birimi")
    payable = models.OneToOneField(
        "finance.PayableItem", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="integrator_credit_package",
        verbose_name="Bağlı PayableItem",
    )
    status = models.CharField(
        max_length=16, choices=CreditPackageStatus.choices,
        default=CreditPackageStatus.ACTIVE, db_index=True, verbose_name="Durum",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notlar")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="integrator_credits_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="integrator_credits_updated",
    )

    class Meta:
        verbose_name = "Kontör Paketi"
        verbose_name_plural = "Kontör Paketleri"
        ordering = ["-purchase_date", "-created_at"]
        indexes = [models.Index(fields=["status"])]

    def __str__(self):
        return f"{self.service.provider_name} · {self.package_name}"

    # PayableItem helper
    @property
    def owner_type(self) -> str:
        return self.service.owner_type

    @property
    def company(self):
        return self.service.owner_company

    @property
    def person(self):
        return self.service.owner_person

    @property
    def due_date(self):
        from django.utils import timezone
        return self.purchase_date or timezone.localdate()

    @property
    def usage_percentage(self) -> int:
        if not self.total_credits:
            return 0
        used = max(0, self.total_credits - self.remaining_credits)
        return int(used * 100 / self.total_credits)


class IntegratorDocument(BaseModel):
    """Sözleşme, tarife, fatura, dekont, kontör satın alma belgesi."""

    service = models.ForeignKey(
        SoftwareService, null=True, blank=True,
        on_delete=models.CASCADE, related_name="documents",
    )
    contract = models.ForeignKey(
        ServiceContract, null=True, blank=True,
        on_delete=models.CASCADE, related_name="documents",
    )
    credit_package = models.ForeignKey(
        CreditPackage, null=True, blank=True,
        on_delete=models.CASCADE, related_name="documents",
    )
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT,
        related_name="integrator_links",
    )
    document_role = models.CharField(
        max_length=24, choices=IntegratorDocumentRole.choices,
        default=IntegratorDocumentRole.OTHER,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="integrator_docs_uploaded",
    )

    class Meta:
        verbose_name = "Entegratör Belgesi"
        verbose_name_plural = "Entegratör Belgeleri"
        ordering = ["-created_at"]
        unique_together = [("service", "contract", "credit_package",
                              "document", "document_role")]

    def __str__(self):
        ref = self.credit_package or self.contract or self.service
        return f"{ref} · {self.get_document_role_display()}"
