"""Reports models — Faz 12 MVP.

ReportTemplate: rapor şablonu (yeniden kullanılabilir).
ReportRun: bir export çalıştırma (history).
"""
from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class ReportType(models.TextChoices):
    PAYABLES = "PAYABLES", "Geciken/Yaklaşan Ödemeler"
    PAYMENTS = "PAYMENTS", "Ödemeler"
    SUBSCRIPTIONS = "SUBSCRIPTIONS", "Abonelikler"
    REGULAR_PAYMENTS = "REGULAR_PAYMENTS", "Düzenli Ödemeler"
    OFFICIAL_PAYMENTS = "OFFICIAL_PAYMENTS", "Resmi Ödemeler"
    SITE_DUES = "SITE_DUES", "Site Aidatları"
    PROPERTY_TAX = "PROPERTY_TAX", "Emlak Vergisi"
    GUARANTEES = "GUARANTEES", "Teminat Komisyonları"
    INTEGRATORS = "INTEGRATORS", "Entegratör & Kontör"
    TASKS = "TASKS", "Görevler"
    DOCUMENTS = "DOCUMENTS", "Belgeler"
    AUDIT = "AUDIT", "AuditLog"
    COMBINED = "COMBINED", "Birleşik"


class ReportFormat(models.TextChoices):
    XLSX = "XLSX", "XLSX"
    CSV = "CSV", "CSV"


class ReportRunStatus(models.TextChoices):
    PENDING = "PENDING", "Beklemede"
    RUNNING = "RUNNING", "Çalışıyor"
    COMPLETED = "COMPLETED", "Tamamlandı"
    FAILED = "FAILED", "Hatalı"
    CANCELLED = "CANCELLED", "İptal"


class ReportTemplate(BaseModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    report_type = models.CharField(max_length=32, choices=ReportType.choices)
    description = models.TextField(blank=True, default="")
    default_format = models.CharField(
        max_length=8, choices=ReportFormat.choices, default=ReportFormat.XLSX
    )
    default_filters = models.JSONField(default=dict, blank=True)
    columns = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="report_templates_created",
    )

    class Meta:
        verbose_name = "Rapor Şablonu"
        verbose_name_plural = "Rapor Şablonları"
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name


class ReportRun(BaseModel):
    template = models.ForeignKey(
        ReportTemplate, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="runs",
    )
    report_type = models.CharField(max_length=32, choices=ReportType.choices)
    title = models.CharField(max_length=200, blank=True, default="")
    filters = models.JSONField(default=dict, blank=True)
    columns = models.JSONField(default=list, blank=True)
    format = models.CharField(
        max_length=8, choices=ReportFormat.choices, default=ReportFormat.XLSX
    )
    status = models.CharField(
        max_length=12, choices=ReportRunStatus.choices, default=ReportRunStatus.PENDING
    )
    row_count = models.PositiveIntegerField(default=0)
    file_size = models.PositiveIntegerField(default=0)
    output_file = models.FileField(upload_to="reports/", null=True, blank=True)
    error_message = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="report_runs_created",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Rapor Çalıştırma"
        verbose_name_plural = "Rapor Çalıştırmaları"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["report_type", "status"]),
            models.Index(fields=["created_by", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.report_type} · {self.format} · {self.get_status_display()}"
