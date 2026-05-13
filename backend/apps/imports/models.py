"""
Import Merkezi modelleri — PHASE1_DATA_MODEL_PLAN.md I.1-I.6.

Faz 3 kapsamı:
- ImportBatch / ImportSourceFile / ImportDraftRecord / ImportDraftField / ImportLog / ImportMappingProfile
- Onaysız domain commit YOK.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


# === ENUM'LAR ===============================================================

class ImportSourceType(models.TextChoices):
    EXCEL = "EXCEL", "Excel"
    PDF = "PDF", "PDF"
    RAR = "RAR", "RAR"
    ZIP = "ZIP", "ZIP"
    FOLDER = "FOLDER", "Klasör"
    MANUAL = "MANUAL", "Manuel"


class ImportTargetModule(models.TextChoices):
    INVOICE = "INVOICE", "Fatura / Ödeme"
    SUBSCRIPTION = "SUBSCRIPTION", "Abonelik"
    SITEX = "SITEX", "SiteX"
    PROPERTY_TAX = "PROPERTY_TAX", "Emlak Vergisi"
    GUARANTEE = "GUARANTEE", "Teminat"
    OFFICIAL = "OFFICIAL", "Resmi Ödemeler"
    INTEGRATOR = "INTEGRATOR", "Entegratör"
    MASTER = "MASTER", "Master Tablolar"
    GENERIC = "GENERIC", "Genel / Tanımsız"


class ImportBatchStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    PARSED = "PARSED", "Parse Edildi"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Kontrol Bekliyor"
    APPROVED = "APPROVED", "Onaylandı"
    COMMITTED = "COMMITTED", "Kayıt Edildi"
    FAILED = "FAILED", "Hatalı"
    CANCELLED = "CANCELLED", "İptal"


class DraftSuggestedAction(models.TextChoices):
    CREATE = "CREATE", "Yeni Oluştur"
    UPDATE = "UPDATE", "Güncelle"
    SKIP = "SKIP", "Atla"
    MANUAL_REVIEW = "MANUAL_REVIEW", "Manuel İncele"


class ValidationStatus(models.TextChoices):
    OK = "OK", "OK"
    WARNING = "WARNING", "Uyarı"
    ERROR = "ERROR", "Hata"
    MANUAL_REVIEW = "MANUAL_REVIEW", "Manuel İnceleme"


class DraftRecordStatus(models.TextChoices):
    DRAFT = "DRAFT", "Taslak"
    APPROVED = "APPROVED", "Onaylı"
    REJECTED = "REJECTED", "Reddedildi"
    COMMITTED = "COMMITTED", "Commit Edildi"


class ImportLogLevel(models.TextChoices):
    INFO = "INFO", "Bilgi"
    WARNING = "WARNING", "Uyarı"
    ERROR = "ERROR", "Hata"
    CRITICAL = "CRITICAL", "Kritik"


# === MODELLER ===============================================================

class ImportBatch(BaseModel):
    batch_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    title = models.CharField(max_length=255, blank=True, default="")
    source_type = models.CharField(max_length=16, choices=ImportSourceType.choices, default=ImportSourceType.EXCEL)
    target_module = models.CharField(max_length=24, choices=ImportTargetModule.choices, default=ImportTargetModule.GENERIC)
    status = models.CharField(max_length=16, choices=ImportBatchStatus.choices, default=ImportBatchStatus.DRAFT, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="import_batches_created",
    )
    parsed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="import_batches_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    committed_at = models.DateTimeField(null=True, blank=True)
    rollback_until = models.DateTimeField(null=True, blank=True)  # Faz 4: 24 saat penceresi

    row_count = models.IntegerField(default=0)
    ok_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    manual_review_count = models.IntegerField(default=0)

    historical_data = models.BooleanField(
        default=False,
        help_text="Geçmiş yıl import (D-018): otomatik görev/bildirim üretmez.",
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Import Batch"
        verbose_name_plural = "Import Batch'ler"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title or f"Batch {self.batch_id}"

    @property
    def short_id(self):
        return str(self.batch_id)[:8]


class ImportSourceFile(BaseModel):
    """Bir batch'in altında 1+ kaynak dosya (Excel sheet veya PDF/RAR çıkartma)."""

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="source_files")
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT, related_name="import_uses",
    )
    original_path = models.CharField(max_length=512, blank=True, default="")
    sheet_name = models.CharField(max_length=128, blank=True, default="")
    file_role = models.CharField(max_length=64, blank=True, default="primary")
    row_count = models.IntegerField(default=0)
    status = models.CharField(max_length=24, default="PARSED")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Import Kaynak Dosya"
        verbose_name_plural = "Import Kaynak Dosyalar"
        ordering = ["batch", "id"]

    def __str__(self):
        return f"{self.batch} / {self.sheet_name or self.document.original_filename}"


class ImportDraftRecord(BaseModel):
    """Tek satır taslak — onaysız domain'e yazılmaz."""

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="draft_records")
    source_file = models.ForeignKey(ImportSourceFile, on_delete=models.CASCADE, related_name="draft_records")
    source_row_number = models.IntegerField()

    record_key = models.CharField(max_length=255, blank=True, default="", db_index=True,
                                  help_text="Idempotency için doğal anahtar")
    target_model = models.CharField(max_length=64, blank=True, default="")

    suggested_action = models.CharField(
        max_length=16, choices=DraftSuggestedAction.choices, default=DraftSuggestedAction.MANUAL_REVIEW,
    )
    validation_status = models.CharField(
        max_length=16, choices=ValidationStatus.choices, default=ValidationStatus.MANUAL_REVIEW, db_index=True,
    )
    status = models.CharField(
        max_length=16, choices=DraftRecordStatus.choices, default=DraftRecordStatus.DRAFT, db_index=True,
    )

    display_title = models.CharField(max_length=255, blank=True, default="")
    raw_data = models.JSONField(default=dict, blank=True)
    normalized_data = models.JSONField(default=dict, blank=True)
    validation_messages = models.JSONField(default=list, blank=True,
                                           help_text="[{'code': str, 'level': str, 'msg': str, 'field': ''}]")

    # Commit sonrası doldurulur (Faz 4)
    created_object_app = models.CharField(max_length=64, blank=True, default="")
    created_object_model = models.CharField(max_length=64, blank=True, default="")
    created_object_id = models.CharField(max_length=64, blank=True, default="")

    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Draft Kayıt"
        verbose_name_plural = "Draft Kayıtlar"
        ordering = ["batch", "source_row_number"]
        indexes = [
            models.Index(fields=["batch", "validation_status"]),
            models.Index(fields=["batch", "status"]),
        ]

    def __str__(self):
        return self.display_title or f"#{self.source_row_number}"


class ImportDraftField(BaseModel):
    """Alan-alan granular log (ileri kullanım için; Faz 3'te ham JSON yeterli)."""

    draft_record = models.ForeignKey(ImportDraftRecord, on_delete=models.CASCADE, related_name="field_states")
    field_name = models.CharField(max_length=64)
    raw_value = models.TextField(blank=True, default="")
    normalized_value = models.TextField(blank=True, default="")
    confidence = models.FloatField(default=1.0)
    status = models.CharField(max_length=16, choices=ValidationStatus.choices, default=ValidationStatus.OK)
    message = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Draft Alan Durumu"
        ordering = ["draft_record", "field_name"]

    def __str__(self):
        return f"{self.draft_record} · {self.field_name}"


class ImportLog(models.Model):
    """Aksiyon zaman çizelgesi (UPLOAD/PARSE/APPROVE/REJECT/COMMIT/ROLLBACK)."""

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="logs")
    level = models.CharField(max_length=16, choices=ImportLogLevel.choices, default=ImportLogLevel.INFO)
    code = models.CharField(max_length=64, blank=True, default="")
    message = models.CharField(max_length=512, blank=True, default="")
    context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Import Log"
        verbose_name_plural = "Import Logları"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%d.%m %H:%M} · {self.level} · {self.code}"


class ImportMappingProfile(BaseModel):
    """Kaydedilmiş mapping şablonu (örn. ev_abonelikleri_kisi_sheet_v1)."""

    name = models.CharField(max_length=128, unique=True)
    description = models.TextField(blank=True, default="")
    source_type = models.CharField(max_length=16, choices=ImportSourceType.choices, default=ImportSourceType.EXCEL)
    target_module = models.CharField(max_length=24, choices=ImportTargetModule.choices, default=ImportTargetModule.GENERIC)
    mapping = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="mapping_profiles_created",
    )

    class Meta:
        verbose_name = "Mapping Şablonu"
        verbose_name_plural = "Mapping Şablonları"
        ordering = ["name"]

    def __str__(self):
        return self.name
