"""
SiteX Daire / Aidat modelleri — Faz 6 Manual MVP.

Anayasa Madde 1.5 (izolasyon), 3.4 (onaysız domain commit yok),
3.8 (soft-delete), 3.16 (yyyymm long-format).

Sınırsız genişleme: SiteX başlangıçta 5 daire master seed edilir
(A4.17/A4.22/A4.25/B2.28/B3.31) ama sistem yalnızca bu daireler ile
sınırlı değildir. Yeni daire UI'dan eklenebilir.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


# === ENUMs =================================================================

class UnitOwnerType(models.TextChoices):
    COMPANY = "COMPANY", "Şirket"
    PERSON = "PERSON", "Şahıs"
    FAMILY = "FAMILY", "Aile"
    OTHER = "OTHER", "Diğer"


class UnitUsageType(models.TextChoices):
    OWNER_OCCUPIED = "OWNER_OCCUPIED", "Malik Oturuyor"
    RENTED = "RENTED", "Kirada"
    EMPTY = "EMPTY", "Boş"
    OTHER = "OTHER", "Diğer"


class UnitStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    PASSIVE = "PASSIVE", "Pasif"
    SOLD = "SOLD", "Satıldı"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class StatementStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PENDING = "PENDING", "Bekliyor"
    LINKED = "LINKED", "PayableItem Bağlı"
    PAID = "PAID", "Ödendi"
    CANCELLED = "CANCELLED", "İptal"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Gerekli"


class StatementSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    IMPORT_DRAFT = "IMPORT_DRAFT", "Import Draft"
    PDF = "PDF", "PDF"
    EXCEL = "EXCEL", "Excel"
    OTHER = "OTHER", "Diğer"


class StatementDocumentRole(models.TextChoices):
    STATEMENT = "STATEMENT", "Aylık Ekstre"
    RECEIPT = "RECEIPT", "Dekont"
    BUDGET = "BUDGET", "Bütçe"
    REPORT = "REPORT", "Rapor"
    TITLE_DEED = "TITLE_DEED", "Tapu / Belge"
    OTHER = "OTHER", "Diğer"


class AidatDifferenceDirection(models.TextChoices):
    PAID_TO_PERSON = "PAID_TO_PERSON", "Şahsa Ödendi"
    RECEIVED_FROM_PERSON = "RECEIVED_FROM_PERSON", "Şahıstan Tahsil Edildi"
    OFFSET = "OFFSET", "Mahsuplaşma"
    OTHER = "OTHER", "Diğer"


class AidatDifferenceStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    OPEN = "OPEN", "Açık"
    SETTLED = "SETTLED", "Kapandı"
    CANCELLED = "CANCELLED", "İptal"


class SiteDocumentType(models.TextChoices):
    BUDGET = "BUDGET", "Yıllık Bütçe"
    AUDIT_REPORT = "AUDIT_REPORT", "Denetim Raporu"
    GENERAL_ASSEMBLY = "GENERAL_ASSEMBLY", "Genel Kurul"
    TITLE_DEED = "TITLE_DEED", "Tapu / Resmi Belge"
    MANAGEMENT_NOTICE = "MANAGEMENT_NOTICE", "Yönetim Duyurusu"
    OTHER = "OTHER", "Diğer"


# === MODELS ================================================================

class PruvaUnit(BaseModel):
    """
    SiteX sitesindeki bağımsız daire/birim.

    Sınırsız genişleme: kod alanı `unique` ama uygulama 5 daire ile
    sınırlandırılmamıştır. Yeni daire UI'dan eklenebilir.
    """

    code = models.CharField(
        max_length=32, unique=True, db_index=True,
        verbose_name="Daire Kodu", help_text="Örn. A4.17, B2.28",
    )
    block = models.CharField(max_length=16, blank=True, default="", verbose_name="Blok")
    unit_no = models.CharField(max_length=16, blank=True, default="", verbose_name="Daire No")

    owner_type = models.CharField(
        max_length=16, choices=UnitOwnerType.choices, default=UnitOwnerType.PERSON,
        verbose_name="Sahip Tipi",
    )
    owner_person = models.ForeignKey(
        "parties.Person", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_units",
        verbose_name="Malik (Şahıs)",
    )
    owner_company = models.ForeignKey(
        "parties.Company", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_units",
        verbose_name="Malik (Şirket)",
    )

    usage_type = models.CharField(
        max_length=24, choices=UnitUsageType.choices, default=UnitUsageType.OWNER_OCCUPIED,
        verbose_name="Kullanım",
    )
    default_due_day = models.IntegerField(
        default=20, verbose_name="Varsayılan Son Ödeme Günü",
        help_text="SiteX için ayın 20'si (override edilebilir).",
    )
    status = models.CharField(
        max_length=16, choices=UnitStatus.choices, default=UnitStatus.ACTIVE,
        db_index=True, verbose_name="Durum",
    )

    sale_date = models.DateField(null=True, blank=True, verbose_name="Satış Tarihi")
    buyer_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Alıcı")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_units_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_units_updated",
    )

    class Meta:
        verbose_name = "SiteX Daire"
        verbose_name_plural = "SiteX Daireleri"
        ordering = ["code"]

    def __str__(self):
        return self.code

    @property
    def owner_label(self) -> str:
        if self.owner_type == UnitOwnerType.COMPANY and self.owner_company:
            return self.owner_company.name
        if self.owner_type == UnitOwnerType.PERSON and self.owner_person:
            return self.owner_person.full_name
        return self.get_owner_type_display()


class PruvaStatement(BaseModel):
    """
    Aylık aidat ekstresi (1 daire × 1 ay = 1 satır).

    `unique_together = (unit, year, month)` → idempotent.
    `total_amount = aidat + gider + previous_debt + penalty + other`
    """

    unit = models.ForeignKey(
        PruvaUnit, on_delete=models.PROTECT, related_name="statements",
        verbose_name="Daire",
    )
    year = models.IntegerField(verbose_name="Yıl")
    month = models.IntegerField(verbose_name="Ay")  # 1-12
    period_label = models.CharField(
        max_length=16, blank=True, default="",
        verbose_name="Dönem (yyyy-mm)",
        help_text="Anayasa 3.16 long-format yyyy-mm.",
    )
    due_date = models.DateField(verbose_name="Son Ödeme")

    aidat_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Aidat")
    gider_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Gider Katılımı")
    previous_debt = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Önceki Bakiye")
    penalty = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Gecikme")
    other = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Diğer")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), verbose_name="Toplam")

    payable = models.OneToOneField(
        "finance.PayableItem", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_statement",
        verbose_name="Bağlı PayableItem",
    )
    status = models.CharField(
        max_length=16, choices=StatementStatus.choices, default=StatementStatus.PENDING,
        db_index=True, verbose_name="Durum",
    )
    source = models.CharField(
        max_length=16, choices=StatementSource.choices, default=StatementSource.MANUAL,
        verbose_name="Kaynak",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_statements_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_statements_updated",
    )

    class Meta:
        verbose_name = "SiteX Ekstresi"
        verbose_name_plural = "SiteX Ekstreleri"
        ordering = ["-year", "-month", "unit__code"]
        unique_together = [("unit", "year", "month")]
        indexes = [
            models.Index(fields=["year", "month"]),
            models.Index(fields=["status", "due_date"]),
        ]

    def __str__(self):
        return f"{self.unit.code} · {self.period_label or f'{self.year}-{self.month:02d}'}"

    # PayableItem helper (period_link.py kullanımı için)
    @property
    def owner_type(self) -> str:
        return self.unit.owner_type
    @property
    def company(self):
        return self.unit.owner_company
    @property
    def person(self):
        return self.unit.owner_person
    @property
    def amount(self) -> Decimal:
        return self.total_amount
    @property
    def currency(self) -> str:
        return "TRY"


class PruvaStatementDocument(BaseModel):
    """Statement ↔ Document ara tablosu (rol ile)."""

    statement = models.ForeignKey(
        PruvaStatement, on_delete=models.CASCADE, related_name="documents",
    )
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT, related_name="pruva_statement_links",
    )
    document_role = models.CharField(
        max_length=16, choices=StatementDocumentRole.choices,
        default=StatementDocumentRole.STATEMENT,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_statement_docs_uploaded",
    )

    class Meta:
        verbose_name = "SiteX Ekstre Belgesi"
        verbose_name_plural = "SiteX Ekstre Belgeleri"
        ordering = ["-created_at"]
        unique_together = [("statement", "document", "document_role")]

    def __str__(self):
        return f"{self.statement} · {self.get_document_role_display()}"


class PruvaAidatDifference(BaseModel):
    """
    Aidat farkı / şahıs–şirket arası mahsuplaşma kaydı.

    Bir daireye bağlanabilir veya yalnızca şahıs/şirket bazında olabilir.
    """

    unit = models.ForeignKey(
        PruvaUnit, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="aidat_differences",
    )
    person = models.ForeignKey(
        "parties.Person", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_aidat_differences",
    )
    company = models.ForeignKey(
        "parties.Company", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_aidat_differences",
    )

    period_label = models.CharField(max_length=16, blank=True, default="")
    date = models.DateField(verbose_name="Tarih")
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Tutar")
    direction = models.CharField(
        max_length=24, choices=AidatDifferenceDirection.choices,
        default=AidatDifferenceDirection.PAID_TO_PERSON,
        verbose_name="Yön",
    )
    status = models.CharField(
        max_length=16, choices=AidatDifferenceStatus.choices,
        default=AidatDifferenceStatus.OPEN, db_index=True,
    )
    document = models.ForeignKey(
        "documents.Document", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_aidat_differences",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_aidat_diffs_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_aidat_diffs_updated",
    )

    class Meta:
        verbose_name = "SiteX Aidat Farkı"
        verbose_name_plural = "SiteX Aidat Farkları"
        ordering = ["-date"]

    def __str__(self):
        ref = self.unit.code if self.unit else (self.person.full_name if self.person else "—")
        return f"{ref} · {self.amount} · {self.date:%d.%m.%Y}"


class PruvaSiteDocument(BaseModel):
    """Site geneli belge (yıllık bütçe, denetim raporu, genel kurul, tapu)."""

    title = models.CharField(max_length=255, verbose_name="Başlık")
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT, related_name="pruva_site_docs",
    )
    document_type = models.CharField(
        max_length=24, choices=SiteDocumentType.choices, default=SiteDocumentType.OTHER,
        db_index=True, verbose_name="Belge Tipi",
    )
    year = models.IntegerField(null=True, blank=True, verbose_name="Yıl")
    period_label = models.CharField(max_length=16, blank=True, default="")
    related_unit = models.ForeignKey(
        PruvaUnit, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="site_documents",
        verbose_name="İlgili Daire (varsa)",
    )

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pruva_site_docs_uploaded",
    )

    class Meta:
        verbose_name = "SiteX Site Belgesi"
        verbose_name_plural = "SiteX Site Belgeleri"
        ordering = ["-year", "-created_at"]

    def __str__(self):
        return f"{self.title} ({self.get_document_type_display()})"
