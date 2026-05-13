"""
Faz 10 — Ajanda / Görev Yönetimi modelleri.

- Task: zenginleştirilmiş görev modeli (priority CRITICAL, status OPEN/POSTPONED/COMPLETED).
- TaskComment: yorum / sistem notu.
- TaskAttachment: Document SHA-256 dedup'lı dosya bağlama.
- TaskEvent: değişmez yaşam döngüsü olay log'u (audit benzeri).

Anayasa Madde 3.4 / 3.8 / 11 uyumlu — soft delete via BaseModel.
"""
from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class TaskPriority(models.TextChoices):
    LOW = "LOW", "Düşük"
    NORMAL = "NORMAL", "Normal"
    HIGH = "HIGH", "Yüksek"
    CRITICAL = "CRITICAL", "Kritik"


class TaskStatus(models.TextChoices):
    OPEN = "OPEN", "Açık"
    IN_PROGRESS = "IN_PROGRESS", "Devam Ediyor"
    WAITING = "WAITING", "Bekliyor"
    POSTPONED = "POSTPONED", "Ertelendi"
    COMPLETED = "COMPLETED", "Tamamlandı"
    CANCELLED = "CANCELLED", "İptal"


class TaskSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    SYSTEM = "SYSTEM", "Sistem"
    IMPORT = "IMPORT", "Import"
    OTHER = "OTHER", "Diğer"


class TaskEventType(models.TextChoices):
    CREATED = "CREATED", "Oluşturuldu"
    UPDATED = "UPDATED", "Güncellendi"
    ASSIGNED = "ASSIGNED", "Atandı"
    STATUS_CHANGED = "STATUS_CHANGED", "Durum Değişti"
    POSTPONED = "POSTPONED", "Ertelendi"
    COMPLETED = "COMPLETED", "Tamamlandı"
    CANCELLED = "CANCELLED", "İptal"
    REOPENED = "REOPENED", "Yeniden Açıldı"
    COMMENTED = "COMMENTED", "Yorum"
    ATTACHMENT_ADDED = "ATTACHMENT_ADDED", "Belge Eklendi"


# Aktif (açık) sayılan statüler — bana atanan / bugünkü vb. listelerde kullanılır
ACTIVE_STATUSES = (
    TaskStatus.OPEN,
    TaskStatus.IN_PROGRESS,
    TaskStatus.WAITING,
    TaskStatus.POSTPONED,
)
TERMINAL_STATUSES = (TaskStatus.COMPLETED, TaskStatus.CANCELLED)


class Task(BaseModel):
    title = models.CharField(max_length=255, verbose_name="Başlık")
    description = models.TextField(blank=True, default="", verbose_name="Açıklama")

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="tasks_assigned",
        verbose_name="Atanan",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="tasks_created",
        verbose_name="Oluşturan",
    )

    priority = models.CharField(
        max_length=12, choices=TaskPriority.choices,
        default=TaskPriority.NORMAL, verbose_name="Öncelik",
    )
    status = models.CharField(
        max_length=16, choices=TaskStatus.choices,
        default=TaskStatus.OPEN, db_index=True, verbose_name="Durum",
    )
    source = models.CharField(
        max_length=12, choices=TaskSource.choices,
        default=TaskSource.MANUAL, verbose_name="Kaynak",
    )

    due_date = models.DateField(null=True, blank=True, verbose_name="Son Tarih")
    due_time = models.TimeField(null=True, blank=True, verbose_name="Son Saat")

    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Tamamlandı")
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="tasks_completed",
        verbose_name="Tamamlayan",
    )

    postponed_until = models.DateField(null=True, blank=True, verbose_name="Ertelendi → Tarih")

    cancelled_at = models.DateTimeField(null=True, blank=True, verbose_name="İptal")
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="tasks_cancelled",
        verbose_name="İptal Eden",
    )

    # Generic relation (string tabanlı — Faz 1 patern)
    related_app = models.CharField(max_length=64, blank=True, default="", db_index=True)
    related_model = models.CharField(max_length=64, blank=True, default="", db_index=True)
    related_object_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    related_title = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Görev"
        verbose_name_plural = "Görevler"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["assigned_to", "status", "due_date"]),
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["related_app", "related_model", "related_object_id"]),
        ]

    def __str__(self):
        return self.title

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    @property
    def is_overdue(self) -> bool:
        from django.utils import timezone
        if self.is_terminal or not self.due_date:
            return False
        return self.due_date < timezone.localdate()


class TaskComment(BaseModel):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="task_comments",
    )
    body = models.TextField(verbose_name="Metin")
    is_system = models.BooleanField(default=False, verbose_name="Sistem")

    class Meta:
        verbose_name = "Görev Yorumu"
        verbose_name_plural = "Görev Yorumları"
        ordering = ["created_at"]

    def __str__(self):
        return f"#{self.task_id} · {self.body[:40]}"


class TaskAttachment(BaseModel):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="attachments")
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT, related_name="task_attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="task_attachments",
    )

    class Meta:
        verbose_name = "Görev Belgesi"
        verbose_name_plural = "Görev Belgeleri"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["task", "document"], name="uniq_task_document",
            ),
        ]

    def __str__(self):
        return f"#{self.task_id} ⇆ Doc#{self.document_id}"


class TaskEvent(models.Model):
    """
    Değişmez yaşam döngüsü log'u — Task üzerindeki her mutator yazar.
    AuditLog'tan ayrı: domain'e özel olay tipi + JSON metadata.
    """
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=24, choices=TaskEventType.choices, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="task_events",
    )
    summary = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Görev Olayı"
        verbose_name_plural = "Görev Olayları"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["task", "-created_at"]),
        ]

    def __str__(self):
        return f"#{self.task_id} · {self.event_type}"
