"""Chat servisleri — thread/participant/message lifecycle.

Tüm mutator'lar @transaction.atomic; ChatEvent + AuditLog yazar.
Anayasa: Telegram / mail send / WebSocket YOK.
"""
from __future__ import annotations

from typing import Iterable, Optional

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.audit.services import audit_log
from apps.documents.models import Document, DocumentSource, DocumentType
from apps.finance.permissions import can_approve, can_write

from ..models import (
    ChatAttachment,
    ChatEvent,
    ChatEventType,
    ChatMessage,
    ChatMessageStatus,
    ChatMessageType,
    ChatParticipant,
    ChatParticipantRole,
    ChatThread,
    ChatThreadStatus,
    ChatThreadType,
)

User = get_user_model()


# ---------- helpers ----------


def _emit_event(thread, event_type, actor, summary="", metadata=None):
    return ChatEvent.objects.create(
        thread=thread,
        event_type=event_type,
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        summary=summary[:255] if summary else "",
        metadata=metadata or {},
    )


def _audit(actor, action, obj, summary="", metadata=None, request=None):
    return audit_log(
        actor=actor, action=action, obj=obj,
        summary=summary, metadata=metadata or {}, request=request,
    )


def _ensure_active(thread):
    if thread.status != ChatThreadStatus.ACTIVE:
        raise ValidationError("Bu konu aktif değil; mesaj gönderilemez.")


def user_can_view_thread(user, thread) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    return ChatParticipant.objects.filter(thread=thread, user=user, is_active=True).exists()


def _ensure_can_view(user, thread):
    if not user_can_view_thread(user, thread):
        raise PermissionDenied("Bu konuyu görüntüleme yetkiniz yok.")


# ---------- thread create ----------


@transaction.atomic
def create_thread(
    *,
    actor,
    title: str = "",
    thread_type: str = ChatThreadType.GROUP,
    participants: Optional[Iterable] = None,
    related_app: str = "",
    related_model: str = "",
    related_object_id: str = "",
    related_title: str = "",
    request=None,
) -> ChatThread:
    if not can_write(actor):
        raise PermissionDenied("Konu açma yetkisi yok.")
    thread = ChatThread.objects.create(
        title=title or "",
        thread_type=thread_type,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
        related_app=related_app or "",
        related_model=related_model or "",
        related_object_id=str(related_object_id) if related_object_id else "",
        related_title=(related_title or "")[:255],
    )
    # Owner = actor
    if actor and getattr(actor, "is_authenticated", False):
        ChatParticipant.objects.create(
            thread=thread, user=actor, role=ChatParticipantRole.OWNER
        )
    for u in participants or []:
        if u and getattr(u, "is_authenticated", False) and u != actor:
            ChatParticipant.objects.get_or_create(
                thread=thread,
                user=u,
                defaults={"role": ChatParticipantRole.MEMBER},
            )
    _emit_event(thread, ChatEventType.THREAD_CREATED, actor, f"Konu açıldı: {thread}")
    _audit(actor, "CREATE", thread, f"Chat konusu açıldı: {thread}", request=request)
    return thread


@transaction.atomic
def create_direct_thread(*, actor, other_user, request=None) -> ChatThread:
    if not actor or not getattr(actor, "is_authenticated", False):
        raise PermissionDenied("Oturum gerekli.")
    if not other_user or other_user == actor:
        raise ValidationError("Geçersiz hedef kullanıcı.")
    # Mevcut DIRECT thread varsa onu döndür
    existing = (
        ChatThread.objects.filter(
            thread_type=ChatThreadType.DIRECT, status=ChatThreadStatus.ACTIVE
        )
        .annotate(np=Count("participants"))
        .filter(np=2, participants__user=actor)
        .filter(participants__user=other_user)
        .first()
    )
    if existing:
        return existing
    thread = create_thread(
        actor=actor,
        title=f"{actor} ↔ {other_user}",
        thread_type=ChatThreadType.DIRECT,
        participants=[other_user],
        request=request,
    )
    return thread


@transaction.atomic
def create_record_thread(
    *, actor, obj, title: str = "", participants=None, request=None
) -> ChatThread:
    return create_thread(
        actor=actor,
        title=title or f"Kayıt · {obj}",
        thread_type=ChatThreadType.RECORD,
        participants=participants,
        related_app=obj._meta.app_label,
        related_model=obj._meta.model_name,
        related_object_id=str(obj.pk),
        related_title=str(obj)[:255],
        request=request,
    )


@transaction.atomic
def create_task_thread(*, actor, task, participants=None, request=None) -> ChatThread:
    return create_thread(
        actor=actor,
        title=f"Görev · {task.title}"[:255],
        thread_type=ChatThreadType.TASK,
        participants=participants,
        related_app="tasks",
        related_model="task",
        related_object_id=str(task.pk),
        related_title=str(task)[:255],
        request=request,
    )


@transaction.atomic
def get_or_create_record_thread(*, actor, obj, request=None) -> ChatThread:
    existing = ChatThread.objects.filter(
        thread_type=ChatThreadType.RECORD,
        related_app=obj._meta.app_label,
        related_model=obj._meta.model_name,
        related_object_id=str(obj.pk),
        status=ChatThreadStatus.ACTIVE,
    ).first()
    if existing:
        if not user_can_view_thread(actor, existing):
            # add as member
            add_participant(actor=actor, thread=existing, user=actor, request=request)
        return existing
    return create_record_thread(actor=actor, obj=obj, request=request)


@transaction.atomic
def get_or_create_task_thread(*, actor, task, request=None) -> ChatThread:
    existing = ChatThread.objects.filter(
        thread_type=ChatThreadType.TASK,
        related_app="tasks",
        related_model="task",
        related_object_id=str(task.pk),
        status=ChatThreadStatus.ACTIVE,
    ).first()
    if existing:
        return existing
    extras = []
    if getattr(task, "assigned_to_id", None) and task.assigned_to_id != getattr(actor, "id", None):
        extras.append(task.assigned_to)
    return create_task_thread(actor=actor, task=task, participants=extras, request=request)


# ---------- participant ----------


@transaction.atomic
def add_participant(
    *, actor, thread, user, role: str = ChatParticipantRole.MEMBER, request=None
) -> ChatParticipant:
    if not (actor and (actor.is_superuser or can_approve(actor) or _is_owner(actor, thread))):
        raise PermissionDenied("Katılımcı ekleme yetkisi yok.")
    p, created = ChatParticipant.objects.get_or_create(
        thread=thread, user=user, defaults={"role": role}
    )
    if created:
        _emit_event(
            thread, ChatEventType.PARTICIPANT_ADDED, actor,
            summary=f"+{user}", metadata={"user_id": user.pk},
        )
        _audit(actor, "UPDATE", thread, f"Katılımcı eklendi: {user}", request=request)
    return p


@transaction.atomic
def remove_participant(*, actor, thread, user, request=None) -> None:
    if not (actor and (actor.is_superuser or can_approve(actor) or _is_owner(actor, thread))):
        raise PermissionDenied("Katılımcı çıkarma yetkisi yok.")
    qs = ChatParticipant.objects.filter(thread=thread, user=user)
    if qs.exists():
        qs.update(is_active=False)
        _emit_event(
            thread, ChatEventType.PARTICIPANT_REMOVED, actor,
            summary=f"-{user}", metadata={"user_id": user.pk},
        )
        _audit(actor, "UPDATE", thread, f"Katılımcı çıkarıldı: {user}", request=request)


def _is_owner(user, thread) -> bool:
    return ChatParticipant.objects.filter(
        thread=thread, user=user, role=ChatParticipantRole.OWNER, is_active=True
    ).exists()


# ---------- message ----------


@transaction.atomic
def send_message(
    *,
    actor,
    thread,
    body: str,
    message_type: str = ChatMessageType.TEXT,
    reply_to=None,
    request=None,
) -> ChatMessage:
    _ensure_can_view(actor, thread)
    _ensure_active(thread)
    body = (body or "").strip()
    if message_type == ChatMessageType.TEXT and not body:
        raise ValidationError("Mesaj boş olamaz.")
    if reply_to and reply_to.thread_id != thread.id:
        raise ValidationError("Yanıtlanan mesaj farklı konuda.")
    msg = ChatMessage.objects.create(
        thread=thread,
        sender=actor,
        body=body,
        reply_to=reply_to,
        message_type=message_type,
    )
    # thread last_message_*
    ChatThread.objects.filter(pk=thread.pk).update(
        last_message_at=msg.sent_at,
        last_message_preview=(body[:240] if body else ""),
        updated_at=timezone.now(),
    )
    _emit_event(
        thread, ChatEventType.MESSAGE_SENT, actor,
        summary=body[:120], metadata={"message_id": msg.pk},
    )
    _audit(actor, "CREATE", msg, f"Mesaj gönderildi: {body[:60]}", request=request)
    return msg


def reply_message(*, actor, parent_message, body: str, request=None) -> ChatMessage:
    return send_message(
        actor=actor,
        thread=parent_message.thread,
        body=body,
        reply_to=parent_message,
        request=request,
    )


@transaction.atomic
def soft_delete_message(*, actor, message, request=None) -> ChatMessage:
    if message.status == ChatMessageStatus.DELETED:
        return message
    is_sender = message.sender_id == getattr(actor, "id", None)
    is_priv = bool(actor and (actor.is_superuser or can_approve(actor)))
    if not (is_sender or is_priv):
        raise PermissionDenied("Mesajı silme yetkisi yok.")
    message.status = ChatMessageStatus.DELETED
    message.deleted_at = timezone.now()
    message.deleted_by = actor if getattr(actor, "is_authenticated", False) else None
    message.body = ""
    message.save(update_fields=["status", "deleted_at", "deleted_by", "body", "updated_at"])
    _emit_event(
        message.thread, ChatEventType.MESSAGE_DELETED, actor,
        summary=f"msg #{message.pk}", metadata={"message_id": message.pk},
    )
    _audit(actor, "DELETE", message, f"Mesaj silindi #{message.pk}", request=request)
    return message


# ---------- attachment ----------


@transaction.atomic
def attach_document_to_message(
    *, actor, message, django_file, title: str = "", request=None
) -> ChatAttachment:
    _ensure_can_view(actor, message.thread)
    _ensure_active(message.thread)
    doc, _created = Document.get_or_create_from_file(
        django_file,
        uploaded_by=actor if getattr(actor, "is_authenticated", False) else None,
        document_type=DocumentType.OTHER,
        source=DocumentSource.UPLOAD,
        title=title or getattr(django_file, "name", "ek"),
    )
    att, created = ChatAttachment.objects.get_or_create(
        message=message,
        document=doc,
        defaults={"uploaded_by": actor if getattr(actor, "is_authenticated", False) else None},
    )
    if created:
        _emit_event(
            message.thread, ChatEventType.ATTACHMENT_ADDED, actor,
            summary=f"doc #{doc.pk}",
            metadata={"message_id": message.pk, "document_id": doc.pk},
        )
        _audit(actor, "CREATE", att, f"Ek yüklendi: {doc}", request=request)
    return att


# ---------- read ----------


@transaction.atomic
def mark_thread_read(*, actor, thread, request=None) -> Optional[ChatParticipant]:
    if not (actor and getattr(actor, "is_authenticated", False)):
        return None
    p = ChatParticipant.objects.filter(thread=thread, user=actor, is_active=True).first()
    if not p:
        return None
    now = timezone.now()
    p.last_read_at = now
    p.save(update_fields=["last_read_at", "updated_at"])
    _emit_event(thread, ChatEventType.READ, actor, summary="okundu")
    return p


def get_unread_count(*, user) -> int:
    if not user or not getattr(user, "is_authenticated", False):
        return 0
    parts = ChatParticipant.objects.filter(user=user, is_active=True).select_related("thread")
    total = 0
    for p in parts:
        last = p.last_read_at
        q = ChatMessage.objects.filter(
            thread=p.thread, status__in=[ChatMessageStatus.SENT, ChatMessageStatus.EDITED]
        ).exclude(sender=user)
        if last:
            q = q.filter(sent_at__gt=last)
        total += q.count()
    return total


# ---------- queries ----------


def get_user_threads(user):
    if not user or not getattr(user, "is_authenticated", False):
        return ChatThread.objects.none()
    return (
        ChatThread.objects.filter(
            participants__user=user, participants__is_active=True, is_active=True
        )
        .distinct()
        .order_by("-last_message_at", "-updated_at")
    )


def get_thread_messages(thread, *, include_deleted: bool = False):
    qs = thread.messages.all().order_by("sent_at")
    if not include_deleted:
        qs = qs.exclude(status=ChatMessageStatus.DELETED)
    return qs


def get_threads_for_object(obj, *, include_terminal: bool = False):
    qs = ChatThread.objects.filter(
        related_app=obj._meta.app_label,
        related_model=obj._meta.model_name,
        related_object_id=str(obj.pk),
        is_active=True,
    )
    if not include_terminal:
        qs = qs.filter(status=ChatThreadStatus.ACTIVE)
    return qs.order_by("-last_message_at", "-updated_at")


# ---------- thread close/archive ----------


@transaction.atomic
def close_thread(*, actor, thread, request=None) -> ChatThread:
    if not (actor and (actor.is_superuser or can_approve(actor) or _is_owner(actor, thread))):
        raise PermissionDenied("Konu kapatma yetkisi yok.")
    if thread.status == ChatThreadStatus.CLOSED:
        return thread
    thread.status = ChatThreadStatus.CLOSED
    thread.save(update_fields=["status", "updated_at"])
    _emit_event(thread, ChatEventType.THREAD_CLOSED, actor, "Konu kapatıldı")
    _audit(actor, "UPDATE", thread, "Konu kapatıldı", request=request)
    return thread


@transaction.atomic
def archive_thread(*, actor, thread, request=None) -> ChatThread:
    if not (actor and (actor.is_superuser or can_approve(actor) or _is_owner(actor, thread))):
        raise PermissionDenied("Konu arşivleme yetkisi yok.")
    if thread.status == ChatThreadStatus.ARCHIVED:
        return thread
    thread.status = ChatThreadStatus.ARCHIVED
    thread.save(update_fields=["status", "updated_at"])
    _emit_event(thread, ChatEventType.THREAD_ARCHIVED, actor, "Konu arşivlendi")
    _audit(actor, "UPDATE", thread, "Konu arşivlendi", request=request)
    return thread
