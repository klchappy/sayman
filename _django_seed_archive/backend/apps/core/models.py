"""
core.models — Tüm modellerin miras alacağı abstract base sınıflar.

Anayasa Madde 3.8: fiziksel silme yasağı (Super Admin istisnası dışında).
PHASE1_DATA_MODEL_PLAN.md A.1: BaseModel.
"""
from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Yaratılma + güncelleme zaman damgası."""

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratılma")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Güncelleme")

    class Meta:
        abstract = True


class ActiveQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def archived(self):
        return self.filter(is_active=False)


class ActiveManager(models.Manager.from_queryset(ActiveQuerySet)):
    """Default manager — tüm kayıtları döner. `objects.active()` aktifler."""


class SoftDeleteModel(models.Model):
    """
    Soft-delete davranışı.

    Anayasa Madde 3.8: silme yerine pasifleştirme.
    `delete()` override edilmez (Django admin uyumu); açık yöntemler:
        instance.archive(actor) ; instance.restore(actor)
    Hard-delete sadece Super Admin için manuel `delete()` çağrısıyla.
    """

    is_active = models.BooleanField(default=True, db_index=True, verbose_name="Aktif")
    archived_at = models.DateTimeField(null=True, blank=True, verbose_name="Pasifleştirme")
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        verbose_name="Pasifleştiren",
    )
    archive_reason = models.TextField(blank=True, default="", verbose_name="Sebep")

    objects = ActiveManager()

    class Meta:
        abstract = True

    def archive(self, actor=None, reason: str = ""):
        from django.utils import timezone

        self.is_active = False
        self.archived_at = timezone.now()
        self.archived_by = actor
        self.archive_reason = reason or ""
        self.save(update_fields=["is_active", "archived_at", "archived_by", "archive_reason", "updated_at"])

    def restore(self, actor=None):
        self.is_active = True
        self.archived_at = None
        self.archived_by = None
        self.archive_reason = ""
        self.save(update_fields=["is_active", "archived_at", "archived_by", "archive_reason", "updated_at"])


class BaseModel(TimeStampedModel, SoftDeleteModel):
    """TimeStamped + SoftDelete birleşimi. Tüm domain modelleri bunu miras alır."""

    notes = models.TextField(blank=True, default="", verbose_name="Notlar")

    class Meta:
        abstract = True


class SystemSettingValueType(models.TextChoices):
    STRING = "STRING", "String"
    INTEGER = "INTEGER", "Integer"
    DECIMAL = "DECIMAL", "Decimal"
    BOOLEAN = "BOOLEAN", "Boolean"
    JSON = "JSON", "JSON"


class SystemSetting(models.Model):
    """
    DB-backed sistem ayarları (Faz 5).

    Faz 4'teki settings constant'larının (PAYMENT_*_THRESHOLD) DB karşılığı.
    Servisler önce DB'den okur; yoksa Django settings constant fallback.
    """

    key = models.CharField(max_length=128, unique=True, db_index=True, verbose_name="Anahtar")
    value = models.TextField(blank=True, default="", verbose_name="Değer")
    value_type = models.CharField(
        max_length=16, choices=SystemSettingValueType.choices,
        default=SystemSettingValueType.STRING, verbose_name="Tip",
    )
    description = models.CharField(max_length=255, blank=True, default="", verbose_name="Açıklama")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Sistem Ayarı"
        verbose_name_plural = "Sistem Ayarları"
        ordering = ["key"]

    def __str__(self):
        return f"{self.key} = {self.value[:40]}"

    def parsed(self):
        """Tipi'ne göre Python değeri döner."""
        from decimal import Decimal
        import json
        if not self.is_active:
            return None
        v = self.value
        if self.value_type == SystemSettingValueType.INTEGER:
            return int(v) if v else 0
        if self.value_type == SystemSettingValueType.DECIMAL:
            return Decimal(v) if v else Decimal("0")
        if self.value_type == SystemSettingValueType.BOOLEAN:
            return v.lower() in ("1", "true", "yes", "evet")
        if self.value_type == SystemSettingValueType.JSON:
            return json.loads(v) if v else None
        return v


def get_setting(key: str, default=None, *, value_type: str | None = None):
    """
    DB'den setting oku; yoksa Django settings constant fallback; yoksa `default`.

    Örn: get_setting("PAYMENT_DEKONT_REQUIRED_THRESHOLD", default=5000, value_type="DECIMAL")
    """
    from django.conf import settings as django_settings

    try:
        s = SystemSetting.objects.get(key=key, is_active=True)
        return s.parsed()
    except SystemSetting.DoesNotExist:
        pass

    fallback = getattr(django_settings, key, default)
    if value_type == "DECIMAL" and fallback is not None:
        from decimal import Decimal
        return Decimal(str(fallback))
    return fallback
