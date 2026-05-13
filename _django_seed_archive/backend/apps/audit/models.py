"""
AuditLog — Anayasa Madde 3.5: her kritik CRUD yazılır.
PHASE1_DATA_MODEL_PLAN.md M.1.
"""
from django.conf import settings
from django.db import models


class AuditAction(models.TextChoices):
    CREATE = "CREATE", "Oluştur"
    UPDATE = "UPDATE", "Güncelle"
    ARCHIVE = "ARCHIVE", "Pasifleştir"
    RESTORE = "RESTORE", "Geri Al"
    HARD_DELETE = "HARD_DELETE", "Kalıcı Sil"
    LOGIN = "LOGIN", "Giriş"
    LOGOUT = "LOGOUT", "Çıkış"
    SEED = "SEED", "Tohumlama"
    PERMISSION_CHANGE = "PERMISSION_CHANGE", "Yetki Değişikliği"
    VIEW = "VIEW", "Görüntüleme"


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_actions",
        verbose_name="Aktör",
    )
    action = models.CharField(max_length=32, choices=AuditAction.choices, db_index=True)
    app_label = models.CharField(max_length=64, blank=True, default="")
    model_name = models.CharField(max_length=64, blank=True, default="")
    object_id = models.CharField(max_length=64, blank=True, default="")
    object_repr = models.CharField(max_length=255, blank=True, default="")
    summary = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Audit Kaydı"
        verbose_name_plural = "Audit Kayıtları"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["app_label", "model_name", "object_id"]),
            models.Index(fields=["actor", "-created_at"]),
        ]

    def __str__(self):
        actor = self.actor.username if self.actor else "sistem"
        return f"{actor} · {self.get_action_display()} · {self.object_repr or self.model_name}"
