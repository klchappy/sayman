"""
Task domain servisleri — Faz 10.

Tüm mutator'lar:
  - Task durumunu/atamasını günceller
  - TaskEvent (immutable yaşam döngüsü log) yazar
  - AuditLog yazar (apps.audit.services.audit_log)

Idempotency: COMPLETED/CANCELLED görev tekrar tamamlanamaz/atanamaz (ValidationError).

Anayasa: Telegram/mail send YOK. Cron YOK. Sadece DB + log.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Iterable, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.audit.services import audit_log

from ..models import (
    ACTIVE_STATUSES,
    Task,
    TaskAttachment,
    TaskComment,
    TaskEvent,
    TaskEventType,
    TaskPriority,
    TaskSource,
    TaskStatus,
)


# ----------------------------- internal helpers -----------------------------

def _emit_event(
    *,
    task: Task,
    event_type: str,
    actor=None,
    summary: str = "",
    metadata: Optional[dict] = None,
) -> TaskEvent:
    return TaskEvent.objects.create(
        task=task,
        event_type=event_type,
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        summary=summary[:255],
        metadata=metadata or {},
    )


def _audit(actor, action: str, task: Task, summary: str, metadata: Optional[dict] = None):
    audit_log(actor=actor, action=action, obj=task, summary=summary, metadata=metadata or {})


def _ensure_not_terminal(task: Task, action_label: str) -> None:
    if task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
        raise ValidationError(
            f"Görev '{task.get_status_display()}' durumunda; '{action_label}' uygulanamaz."
        )


# ----------------------------- create / update ------------------------------

@transaction.atomic
def create_task(
    *,
    title: str,
    description: str = "",
    assigned_to=None,
    created_by=None,
    priority: str = TaskPriority.NORMAL,
    due_date: Optional[date] = None,
    due_time=None,
    source: str = TaskSource.MANUAL,
    related_app: str = "",
    related_model: str = "",
    related_object_id: str = "",
    related_title: str = "",
) -> Task:
    if not title or not title.strip():
        raise ValidationError("Başlık zorunlu.")
    task = Task.objects.create(
        title=title.strip()[:255],
        description=description or "",
        assigned_to=assigned_to,
        created_by=created_by,
        priority=priority,
        status=TaskStatus.OPEN,
        source=source,
        due_date=due_date,
        due_time=due_time,
        related_app=related_app or "",
        related_model=related_model or "",
        related_object_id=str(related_object_id) if related_object_id else "",
        related_title=(related_title or "")[:255],
    )
    _emit_event(
        task=task, event_type=TaskEventType.CREATED, actor=created_by,
        summary=f"Görev oluşturuldu: {task.title}",
        metadata={
            "priority": task.priority, "due_date": task.due_date.isoformat() if task.due_date else None,
            "source": task.source,
        },
    )
    if assigned_to:
        _emit_event(
            task=task, event_type=TaskEventType.ASSIGNED, actor=created_by,
            summary=f"Atandı: {assigned_to}",
            metadata={"assigned_to_id": assigned_to.pk, "assigned_to": str(assigned_to)},
        )
    _audit(created_by, "CREATE", task, f"Görev oluşturuldu: {task.title}",
           metadata={"priority": task.priority, "status": task.status})
    return task


@transaction.atomic
def update_task(task: Task, *, actor=None, **fields) -> Task:
    _ensure_not_terminal(task, "düzenleme")
    allowed = {"title", "description", "priority", "due_date", "due_time",
               "related_title"}
    changed = {}
    for k, v in fields.items():
        if k not in allowed:
            continue
        if getattr(task, k) != v:
            changed[k] = {"old": getattr(task, k), "new": v}
            setattr(task, k, v)
    if changed:
        task.save(update_fields=list(changed.keys()) + ["updated_at"])
        _emit_event(task=task, event_type=TaskEventType.UPDATED, actor=actor,
                    summary="Görev güncellendi", metadata={"changed": list(changed.keys())})
        _audit(actor, "UPDATE", task, "Görev güncellendi",
               metadata={"changed": list(changed.keys())})
    return task


@transaction.atomic
def assign_task(task: Task, *, assignee, actor=None) -> Task:
    _ensure_not_terminal(task, "atama")
    old = task.assigned_to
    if old == assignee:
        return task
    task.assigned_to = assignee
    task.save(update_fields=["assigned_to", "updated_at"])
    _emit_event(
        task=task, event_type=TaskEventType.ASSIGNED, actor=actor,
        summary=f"Atandı: {assignee}" if assignee else "Atama kaldırıldı",
        metadata={
            "old_id": getattr(old, "pk", None),
            "new_id": getattr(assignee, "pk", None),
            "old": str(old) if old else None,
            "new": str(assignee) if assignee else None,
        },
    )
    _audit(actor, "UPDATE", task, "Görev atandı",
           metadata={"assignee_id": getattr(assignee, "pk", None)})
    return task


@transaction.atomic
def change_status(task: Task, *, new_status: str, actor=None, summary: str = "") -> Task:
    if new_status not in dict(TaskStatus.choices):
        raise ValidationError(f"Geçersiz durum: {new_status}")
    if task.status == new_status:
        return task
    if task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
        raise ValidationError("Tamamlanmış/iptal görevin durumu değiştirilemez (reopen kullanın).")
    old = task.status
    task.status = new_status
    task.save(update_fields=["status", "updated_at"])
    _emit_event(
        task=task, event_type=TaskEventType.STATUS_CHANGED, actor=actor,
        summary=summary or f"{old} → {new_status}",
        metadata={"old": old, "new": new_status},
    )
    _audit(actor, "UPDATE", task, f"Durum: {old} → {new_status}",
           metadata={"old": old, "new": new_status})
    return task


@transaction.atomic
def start_task(task: Task, *, actor=None) -> Task:
    _ensure_not_terminal(task, "başlat")
    if task.status == TaskStatus.IN_PROGRESS:
        return task
    return change_status(task, new_status=TaskStatus.IN_PROGRESS, actor=actor,
                         summary="Görev başladı")


@transaction.atomic
def postpone_task(task: Task, *, postponed_until: date, actor=None, reason: str = "") -> Task:
    _ensure_not_terminal(task, "ertele")
    if not postponed_until:
        raise ValidationError("Ertelenecek tarih zorunlu.")
    today = timezone.localdate()
    if postponed_until <= today:
        raise ValidationError("Erteleme tarihi gelecek olmalı.")
    old_status = task.status
    old_due = task.due_date
    task.postponed_until = postponed_until
    task.due_date = postponed_until
    task.status = TaskStatus.POSTPONED
    task.save(update_fields=["postponed_until", "due_date", "status", "updated_at"])
    _emit_event(
        task=task, event_type=TaskEventType.POSTPONED, actor=actor,
        summary=f"Ertelendi → {postponed_until.isoformat()}",
        metadata={
            "old_status": old_status,
            "old_due_date": old_due.isoformat() if old_due else None,
            "new_due_date": postponed_until.isoformat(),
            "reason": reason or "",
        },
    )
    _audit(actor, "UPDATE", task, f"Ertelendi → {postponed_until.isoformat()}",
           metadata={"reason": reason or ""})
    if reason:
        TaskComment.objects.create(task=task, author=actor, body=f"[Erteleme] {reason}",
                                   is_system=True)
    return task


@transaction.atomic
def complete_task(task: Task, *, actor=None, summary: str = "") -> Task:
    if task.status == TaskStatus.COMPLETED:
        raise ValidationError("Görev zaten tamamlanmış.")
    if task.status == TaskStatus.CANCELLED:
        raise ValidationError("İptal edilmiş görev tamamlanamaz.")
    now = timezone.now()
    task.status = TaskStatus.COMPLETED
    task.completed_at = now
    task.completed_by = actor if (actor and getattr(actor, "is_authenticated", False)) else None
    task.save(update_fields=["status", "completed_at", "completed_by", "updated_at"])
    _emit_event(
        task=task, event_type=TaskEventType.COMPLETED, actor=actor,
        summary=summary or "Tamamlandı",
        metadata={"completed_at": now.isoformat()},
    )
    _audit(actor, "UPDATE", task, "Görev tamamlandı",
           metadata={"completed_at": now.isoformat()})
    return task


@transaction.atomic
def cancel_task(task: Task, *, actor=None, reason: str = "") -> Task:
    if task.status == TaskStatus.CANCELLED:
        raise ValidationError("Görev zaten iptal.")
    if task.status == TaskStatus.COMPLETED:
        raise ValidationError("Tamamlanmış görev iptal edilemez.")
    now = timezone.now()
    task.status = TaskStatus.CANCELLED
    task.cancelled_at = now
    task.cancelled_by = actor if (actor and getattr(actor, "is_authenticated", False)) else None
    task.save(update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"])
    _emit_event(
        task=task, event_type=TaskEventType.CANCELLED, actor=actor,
        summary=f"İptal: {reason}" if reason else "İptal",
        metadata={"reason": reason or "", "cancelled_at": now.isoformat()},
    )
    _audit(actor, "UPDATE", task, "Görev iptal", metadata={"reason": reason or ""})
    if reason:
        TaskComment.objects.create(task=task, author=actor, body=f"[İptal] {reason}",
                                   is_system=True)
    return task


@transaction.atomic
def reopen_task(task: Task, *, actor=None, summary: str = "") -> Task:
    if task.status not in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
        raise ValidationError("Sadece tamamlanmış/iptal görev yeniden açılabilir.")
    old = task.status
    task.status = TaskStatus.OPEN
    task.completed_at = None
    task.completed_by = None
    task.cancelled_at = None
    task.cancelled_by = None
    task.save(update_fields=["status", "completed_at", "completed_by",
                              "cancelled_at", "cancelled_by", "updated_at"])
    _emit_event(
        task=task, event_type=TaskEventType.REOPENED, actor=actor,
        summary=summary or f"Yeniden açıldı (eski: {old})",
        metadata={"old_status": old},
    )
    _audit(actor, "UPDATE", task, "Yeniden açıldı", metadata={"old_status": old})
    return task


# ------------------------------ comments / attach ---------------------------

@transaction.atomic
def add_comment(task: Task, *, body: str, author=None, is_system: bool = False) -> TaskComment:
    if not body or not body.strip():
        raise ValidationError("Yorum boş olamaz.")
    c = TaskComment.objects.create(
        task=task, author=author, body=body.strip(), is_system=is_system,
    )
    _emit_event(task=task, event_type=TaskEventType.COMMENTED, actor=author,
                summary=body.strip()[:255], metadata={"comment_id": c.pk})
    _audit(author, "CREATE", task, "Yorum eklendi",
           metadata={"comment_id": c.pk, "is_system": is_system})
    return c


@transaction.atomic
def attach_document(task: Task, *, django_file=None, document=None, uploaded_by=None,
                    title: str = "") -> TaskAttachment:
    """
    İki kullanım modu:
      - django_file: yüklenen dosya → Document.get_or_create_from_file (SHA-256 dedup)
      - document:   mevcut Document'i bağla
    """
    from apps.documents.models import Document, DocumentSource, DocumentType

    if document is None and django_file is None:
        raise ValidationError("Dosya veya document gerekli.")
    if document is None:
        document, _created = Document.get_or_create_from_file(
            django_file,
            uploaded_by=uploaded_by,
            document_type=DocumentType.OTHER,
            source=DocumentSource.UPLOAD,
            title=title or getattr(django_file, "name", "Görev Belgesi"),
        )

    att, created = TaskAttachment.objects.get_or_create(
        task=task, document=document,
        defaults={"uploaded_by": uploaded_by},
    )
    if created:
        _emit_event(task=task, event_type=TaskEventType.ATTACHMENT_ADDED, actor=uploaded_by,
                    summary=f"Belge eklendi: {document.title}",
                    metadata={"document_id": document.pk, "sha256": document.sha256})
        _audit(uploaded_by, "CREATE", task, "Belge eklendi",
               metadata={"document_id": document.pk})
    return att


# ------------------------------ generic relation ---------------------------

def create_task_for_object(
    obj,
    *,
    title: str,
    description: str = "",
    assigned_to=None,
    created_by=None,
    priority: str = TaskPriority.NORMAL,
    due_date: Optional[date] = None,
    source: str = TaskSource.MANUAL,
) -> Task:
    """Bir domain nesnesi (PayableItem, PruvaStatement, …) için bağlı görev oluştur."""
    meta = obj._meta
    return create_task(
        title=title,
        description=description,
        assigned_to=assigned_to,
        created_by=created_by,
        priority=priority,
        due_date=due_date,
        source=source,
        related_app=meta.app_label,
        related_model=meta.model_name,
        related_object_id=str(obj.pk),
        related_title=str(obj)[:255],
    )


def get_tasks_for_object(obj, *, include_terminal: bool = False) -> QuerySet[Task]:
    qs = Task.objects.filter(
        is_active=True,
        related_app=obj._meta.app_label,
        related_model=obj._meta.model_name,
        related_object_id=str(obj.pk),
    )
    if not include_terminal:
        qs = qs.filter(status__in=ACTIVE_STATUSES)
    return qs.order_by("-created_at")


# --------------------------------- queries ---------------------------------

def _open_qs() -> QuerySet[Task]:
    return Task.objects.filter(is_active=True, status__in=ACTIVE_STATUSES)


def get_today_tasks_for_user(user) -> QuerySet[Task]:
    today = timezone.localdate()
    return _open_qs().filter(
        assigned_to=user,
    ).filter(
        Q(due_date=today) | Q(due_date__lt=today)
    ).order_by("due_date", "-priority", "-created_at")


def get_overdue_tasks(user=None) -> QuerySet[Task]:
    today = timezone.localdate()
    qs = _open_qs().filter(due_date__lt=today)
    if user is not None:
        qs = qs.filter(assigned_to=user)
    return qs.order_by("due_date", "-priority")


def get_upcoming_tasks(user=None, *, days: int = 7) -> QuerySet[Task]:
    today = timezone.localdate()
    end = today + timezone.timedelta(days=days)
    qs = _open_qs().filter(due_date__gte=today, due_date__lte=end)
    if user is not None:
        qs = qs.filter(assigned_to=user)
    return qs.order_by("due_date", "-priority")
