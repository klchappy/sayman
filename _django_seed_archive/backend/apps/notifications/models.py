"""Notification models — Faz 13 Bildirim Merkezi / Telegram Dry-run MVP.

Anayasa Madde 8 (4 aşamalı kapı):
  SISTEM_ICI / DASHBOARD → DRY_RUN → TEST → GERCEK
Bu fazda gerçek Telegram gönderimi YOK; tüm gerçek-gönderim yolları no-op.
"""
from django.conf import settings
from django.db import models


# ---------- Choice sets ----------


class NotificationLevel(models.TextChoices):
    INFO = "INFO", "Bilgi"
    WARNING = "WARNING", "Uyarı"
    DANGER = "DANGER", "Acil"
    SUCCESS = "SUCCESS", "Başarı"


class NotificationSeverity(models.TextChoices):
    INFO = "INFO", "Bilgi"
    WARNING = "WARNING", "Uyarı"
    CRITICAL = "CRITICAL", "Kritik"


class NotificationCategory(models.TextChoices):
    PAYABLE = "PAYABLE", "Ödeme"
    TASK = "TASK", "Görev"
    SUBSCRIPTION = "SUBSCRIPTION", "Abonelik"
    SITE_DUES = "SITE_DUES", "Site Aidatları"
    PROPERTY_TAX = "PROPERTY_TAX", "Emlak Vergisi"
    GUARANTEE = "GUARANTEE", "Teminat"
    INTEGRATOR = "INTEGRATOR", "Entegratör/Kontör"
    REPORT = "REPORT", "Rapor"
    SYSTEM = "SYSTEM", "Sistem"
    OTHER = "OTHER", "Diğer"


class NotificationTriggerType(models.TextChoices):
    DUE_DATE = "DUE_DATE", "Vade"
    OVERDUE = "OVERDUE", "Gecikmiş"
    STATUS_CHANGE = "STATUS_CHANGE", "Durum Değişimi"
    THRESHOLD = "THRESHOLD", "Eşik"
    MANUAL = "MANUAL", "Manuel"
    OTHER = "OTHER", "Diğer"


class NotificationChannel(models.TextChoices):
    DASHBOARD = "DASHBOARD", "Dashboard"
    TELEGRAM = "TELEGRAM", "Telegram"
    EMAIL = "EMAIL", "E-posta"
    SYSTEM = "SYSTEM", "Sistem"
    # Geriye uyum için eski kanallar:
    SISTEM_ICI = "SISTEM_ICI", "Sistem İçi"
    TELEGRAM_DRY_RUN = "TELEGRAM_DRY_RUN", "Telegram Dry-run"
    TELEGRAM_TEST = "TELEGRAM_TEST", "Telegram Test"
    TELEGRAM_GERCEK = "TELEGRAM_GERCEK", "Telegram Gerçek"


class NotificationStatus(models.TextChoices):
    PENDING = "PENDING", "Bekliyor"
    DRY_RUN = "DRY_RUN", "Dry-run"
    TEST = "TEST", "Test"
    READY = "READY", "Hazır"
    SENT = "SENT", "Gönderildi"
    FAILED = "FAILED", "Başarısız"
    SUPPRESSED = "SUPPRESSED", "Bastırıldı"
    CANCELLED = "CANCELLED", "İptal"
    MUTED = "MUTED", "Susturulmuş"
    SCHEDULED = "SCHEDULED", "Zamanlandı"


# ---------- NotificationRule ----------


class NotificationRule(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=80, unique=True)
    category = models.CharField(
        max_length=24, choices=NotificationCategory.choices,
        default=NotificationCategory.OTHER,
    )
    trigger_type = models.CharField(
        max_length=24, choices=NotificationTriggerType.choices,
        default=NotificationTriggerType.OTHER,
    )
    channel = models.CharField(
        max_length=24, choices=NotificationChannel.choices,
        default=NotificationChannel.DASHBOARD,
    )
    days_before = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    dry_run_only = models.BooleanField(default=True)
    severity = models.CharField(
        max_length=12, choices=NotificationSeverity.choices,
        default=NotificationSeverity.INFO,
    )
    title_template = models.CharField(max_length=255, blank=True, default="")
    message_template = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="notification_rules_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Bildirim Kuralı"
        verbose_name_plural = "Bildirim Kuralları"
        ordering = ["category", "code"]

    def __str__(self):
        return f"{self.code} · {self.name}"


# ---------- NotificationLog (genişletilmiş) ----------


class NotificationLog(models.Model):
    rule = models.ForeignKey(
        NotificationRule, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="logs",
    )
    category = models.CharField(
        max_length=24, choices=NotificationCategory.choices,
        default=NotificationCategory.OTHER, db_index=True,
    )
    severity = models.CharField(
        max_length=12, choices=NotificationSeverity.choices,
        default=NotificationSeverity.INFO,
    )

    # Geri uyum: eski "level" alanı korundu
    level = models.CharField(
        max_length=16, choices=NotificationLevel.choices,
        default=NotificationLevel.INFO,
    )
    channel = models.CharField(
        max_length=24, choices=NotificationChannel.choices,
        default=NotificationChannel.DASHBOARD,
    )
    status = models.CharField(
        max_length=16, choices=NotificationStatus.choices,
        default=NotificationStatus.DRY_RUN, db_index=True,
    )

    title = models.CharField(max_length=255)
    message = models.TextField(blank=True, default="")

    related_app = models.CharField(max_length=64, blank=True, default="")
    related_model = models.CharField(max_length=64, blank=True, default="")
    related_object_id = models.CharField(max_length=64, blank=True, default="")
    related_title = models.CharField(max_length=255, blank=True, default="")

    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="notifications_received",
    )
    target_chat_id = models.CharField(max_length=64, blank=True, default="")

    dry_run = models.BooleanField(default=True)
    real_send_allowed = models.BooleanField(default=False)

    error_message = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    metadata = models.JSONField(default=dict, blank=True)

    scheduled_for = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Bildirim"
        verbose_name_plural = "Bildirimler"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "status"]),
            models.Index(fields=["dry_run", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.title}"

    # ---------- helpers ----------

    @property
    def masked_chat_id(self) -> str:
        cid = self.target_chat_id or ""
        if not cid:
            return ""
        if len(cid) <= 4:
            return "****"
        return cid[:2] + "*" * max(0, len(cid) - 4) + cid[-2:]


# ---------- NotificationPreference ----------


class NotificationPreference(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    category = models.CharField(
        max_length=24, choices=NotificationCategory.choices,
        default=NotificationCategory.OTHER,
    )
    dashboard_enabled = models.BooleanField(default=True)
    telegram_enabled = models.BooleanField(default=False)
    email_enabled = models.BooleanField(default=False)
    muted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Bildirim Tercihi"
        verbose_name_plural = "Bildirim Tercihleri"
        unique_together = [("user", "category")]
        ordering = ["user_id", "category"]

    def __str__(self):
        return f"{self.user} · {self.category}"
