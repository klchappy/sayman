"""Chat models — Faz 11 MVP (DB-backed; Channels/WebSocket YOK).

Anayasa:
- Madde 3.8 soft-delete: BaseModel miras (is_active/archive/restore).
- ChatEvent immutable.
- Telegram / mail send / cron / WebSocket YOK.
"""
from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class ChatThreadType(models.TextChoices):
    DIRECT = "DIRECT", "Birebir"
    GROUP = "GROUP", "Grup"
    RECORD = "RECORD", "Kayıt Bağlantılı"
    TASK = "TASK", "Görev Bağlantılı"
    SYSTEM = "SYSTEM", "Sistem"


class ChatThreadStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Aktif"
    ARCHIVED = "ARCHIVED", "Arşiv"
    CLOSED = "CLOSED", "Kapalı"


class ChatParticipantRole(models.TextChoices):
    OWNER = "OWNER", "Sahip"
    MEMBER = "MEMBER", "Üye"
    VIEWER = "VIEWER", "Görüntüleyici"


class ChatMessageType(models.TextChoices):
    TEXT = "TEXT", "Metin"
    SYSTEM = "SYSTEM", "Sistem"
    FILE = "FILE", "Dosya"
    EVENT = "EVENT", "Olay"


class ChatMessageStatus(models.TextChoices):
    SENT = "SENT", "Gönderildi"
    EDITED = "EDITED", "Düzenlendi"
    DELETED = "DELETED", "Silindi"


class ChatEventType(models.TextChoices):
    THREAD_CREATED = "THREAD_CREATED", "Konu Açıldı"
    PARTICIPANT_ADDED = "PARTICIPANT_ADDED", "Katılımcı Eklendi"
    PARTICIPANT_REMOVED = "PARTICIPANT_REMOVED", "Katılımcı Çıkarıldı"
    MESSAGE_SENT = "MESSAGE_SENT", "Mesaj Gönderildi"
    MESSAGE_DELETED = "MESSAGE_DELETED", "Mesaj Silindi"
    ATTACHMENT_ADDED = "ATTACHMENT_ADDED", "Ek Yüklendi"
    THREAD_ARCHIVED = "THREAD_ARCHIVED", "Konu Arşivlendi"
    THREAD_CLOSED = "THREAD_CLOSED", "Konu Kapatıldı"
    READ = "READ", "Okundu"


class ChatThread(BaseModel):
    """Sohbet konusu — birebir/grup/kayıt-bağlı/görev-bağlı/sistem."""

    title = models.CharField(max_length=255, blank=True, default="")
    thread_type = models.CharField(
        max_length=16, choices=ChatThreadType.choices, default=ChatThreadType.DIRECT
    )
    status = models.CharField(
        max_length=16, choices=ChatThreadStatus.choices, default=ChatThreadStatus.ACTIVE
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="chat_threads_created",
    )
    # Generic relation (string-based — Faz 1 deseni)
    related_app = models.CharField(max_length=64, blank=True, default="", db_index=True)
    related_model = models.CharField(max_length=64, blank=True, default="", db_index=True)
    related_object_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    related_title = models.CharField(max_length=255, blank=True, default="")

    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_message_preview = models.CharField(max_length=240, blank=True, default="")

    class Meta:
        verbose_name = "Chat Thread"
        verbose_name_plural = "Chat Threads"
        ordering = ["-last_message_at", "-updated_at"]
        indexes = [
            models.Index(fields=["related_app", "related_model", "related_object_id"]),
            models.Index(fields=["thread_type", "status"]),
        ]

    def __str__(self):
        return self.title or f"Thread #{self.pk}"

    @property
    def is_terminal(self) -> bool:
        return self.status in (ChatThreadStatus.ARCHIVED, ChatThreadStatus.CLOSED)


class ChatParticipant(BaseModel):
    """Bir thread'in katılımcısı + last_read_at + muted."""

    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_participations"
    )
    role = models.CharField(
        max_length=16, choices=ChatParticipantRole.choices, default=ChatParticipantRole.MEMBER
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    muted = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Chat Katılımcı"
        verbose_name_plural = "Chat Katılımcılar"
        constraints = [
            models.UniqueConstraint(fields=["thread", "user"], name="uniq_chat_participant"),
        ]
        ordering = ["thread_id", "joined_at"]

    def __str__(self):
        return f"{self.user} @ {self.thread_id}"


class ChatMessage(BaseModel):
    """Mesaj — TEXT/SYSTEM/FILE/EVENT; reply_to self FK; soft-delete (status=DELETED)."""

    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
    )
    body = models.TextField(blank=True, default="")
    reply_to = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies"
    )
    message_type = models.CharField(
        max_length=16, choices=ChatMessageType.choices, default=ChatMessageType.TEXT
    )
    status = models.CharField(
        max_length=16, choices=ChatMessageStatus.choices, default=ChatMessageStatus.SENT
    )
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages_deleted",
    )
    sent_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Chat Mesaj"
        verbose_name_plural = "Chat Mesajlar"
        ordering = ["sent_at"]
        indexes = [
            models.Index(fields=["thread", "sent_at"]),
            models.Index(fields=["thread", "status"]),
        ]

    def __str__(self):
        return f"{self.sender} · {self.sent_at:%d.%m.%Y %H:%M}"

    @property
    def is_deleted(self) -> bool:
        return self.status == ChatMessageStatus.DELETED


class ChatAttachment(BaseModel):
    """Mesaja bağlı doküman — Document.get_or_create_from_file ile SHA-256 dedup."""

    message = models.ForeignKey(
        ChatMessage, on_delete=models.CASCADE, related_name="attachments"
    )
    document = models.ForeignKey(
        "documents.Document", on_delete=models.PROTECT, related_name="chat_attachments"
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_attachments_uploaded",
    )

    class Meta:
        verbose_name = "Chat Eki"
        verbose_name_plural = "Chat Ekleri"
        constraints = [
            models.UniqueConstraint(
                fields=["message", "document"], name="uniq_chat_attachment_per_message"
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ek · msg #{self.message_id} · {self.document_id}"


class ChatEvent(models.Model):
    """Immutable thread/messag event log — silinmez."""

    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=32, choices=ChatEventType.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_events",
    )
    summary = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Chat Olayı"
        verbose_name_plural = "Chat Olayları"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["thread", "created_at"]),
            models.Index(fields=["event_type"]),
        ]

    def __str__(self):
        return f"{self.event_type} · {self.thread_id}"
