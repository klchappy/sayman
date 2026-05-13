"""Bildirim servisleri — Faz 13 Dry-run MVP.

KESİN KURALLAR (Anayasa Madde 8 + Faz 13 spec):
  - Gerçek Telegram gönderimi YOK. send_telegram_notification no-op/SUPPRESSED.
  - Hiçbir HTTP request yapılmaz; requests.* / urllib.* import edilmez.
  - real_send_allowed=False ise gerçek gönderim engellenir.
  - SMTP/mail YOK.
  - Cron/scheduler YOK.
  - Token / chat_id raw render edilmez (template'ler masked_chat_id kullanır).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import audit_log
from apps.finance.permissions import can_approve, can_write

from ..models import (NotificationCategory, NotificationChannel,
                      NotificationLevel, NotificationLog, NotificationRule,
                      NotificationSeverity, NotificationStatus,
                      NotificationTriggerType)


# ---------- Permission ----------


def _can_run_dry_run(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    return can_approve(user)


def _can_view(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user.is_superuser or can_write(user)


# ---------- Render ----------


def render_notification(rule: Optional[NotificationRule], context: dict) -> tuple[str, str]:
    """Basit string formatlama — token/chat id render edilmez."""
    title_tpl = (rule.title_template if rule else "") or context.get("title", "")
    msg_tpl = (rule.message_template if rule else "") or context.get("message", "")
    safe_ctx = {k: v for k, v in context.items() if k not in ("token", "chat_id", "bot_token")}
    try:
        title = title_tpl.format(**safe_ctx) if title_tpl else context.get("title", "")
    except Exception:
        title = title_tpl or context.get("title", "")
    try:
        msg = msg_tpl.format(**safe_ctx) if msg_tpl else context.get("message", "")
    except Exception:
        msg = msg_tpl or context.get("message", "")
    return title, msg


# ---------- Core create ----------


def _fingerprint(*, rule_code: str, related_app: str, related_model: str,
                  related_object_id: str, target_date: Any = None) -> str:
    target = ""
    if target_date is not None:
        target = target_date.isoformat() if hasattr(target_date, "isoformat") else str(target_date)
    return f"{rule_code}|{related_app}|{related_model}|{related_object_id}|{target}"


def _severity_to_level(sev: str) -> str:
    if sev == NotificationSeverity.CRITICAL:
        return NotificationLevel.DANGER
    if sev == NotificationSeverity.WARNING:
        return NotificationLevel.WARNING
    return NotificationLevel.INFO


def create_notification_log(
    *, rule: Optional[NotificationRule] = None,
    category: str, severity: str = NotificationSeverity.INFO,
    channel: str = NotificationChannel.DASHBOARD,
    title: str, message: str = "",
    related_app: str = "", related_model: str = "",
    related_object_id: str = "", related_title: str = "",
    target_user=None, target_chat_id: str = "",
    dry_run: bool = True, real_send_allowed: bool = False,
    status: str = NotificationStatus.DRY_RUN,
    metadata: Optional[dict] = None,
    actor=None, request=None, fingerprint: str = "",
    audit: bool = True,
) -> NotificationLog:
    meta = dict(metadata or {})
    if fingerprint:
        meta.setdefault("fingerprint", fingerprint)
    log = NotificationLog.objects.create(
        rule=rule,
        category=category,
        severity=severity,
        level=_severity_to_level(severity),
        channel=channel,
        status=status,
        title=title or "",
        message=message or "",
        related_app=related_app or "",
        related_model=related_model or "",
        related_object_id=str(related_object_id or ""),
        related_title=related_title or "",
        target_user=target_user,
        target_chat_id=target_chat_id or "",
        dry_run=dry_run,
        real_send_allowed=False if dry_run else real_send_allowed,
        metadata=meta,
        created_by=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
    )
    if audit:
        audit_log(
            actor=actor, action="CREATE", obj=log,
            summary=f"Bildirim ({status}): {title[:80]}",
            metadata={"category": category, "rule": rule.code if rule else "",
                      "fingerprint": fingerprint},
            request=request,
        )
    return log


def _dedup_exists(rule_code: str, related_app: str, related_model: str,
                  related_object_id: str, target_date: Any = None) -> bool:
    fp = _fingerprint(
        rule_code=rule_code, related_app=related_app, related_model=related_model,
        related_object_id=str(related_object_id), target_date=target_date,
    )
    return NotificationLog.objects.filter(metadata__fingerprint=fp).exists()


# ---------- Builders ----------


def build_due_payable_notifications(*, days: int = 7, actor=None, request=None) -> List[NotificationLog]:
    from apps.finance.models import PayableItem, PayableStatus
    rule = NotificationRule.objects.filter(code="PAYABLE_DUE_T7", is_active=True).first()
    today = timezone.localdate()
    qs = PayableItem.objects.filter(
        is_active=True,
        due_date__gte=today,
        due_date__lte=today + timedelta(days=days),
    ).exclude(status__in=[PayableStatus.PAID, PayableStatus.CANCELLED, PayableStatus.ARCHIVED])
    out = []
    for p in qs:
        fp = _fingerprint(rule_code="PAYABLE_DUE_T7", related_app="finance",
                           related_model="payableitem", related_object_id=p.pk,
                           target_date=p.due_date)
        if NotificationLog.objects.filter(metadata__fingerprint=fp).exists():
            continue
        title, msg = render_notification(rule, {
            "title": f"Yaklaşan Ödeme: {p.title}",
            "message": f"{p.title} · vade {p.due_date.strftime('%d.%m.%Y')} · tutar {p.amount}",
            "due_date": p.due_date.strftime("%d.%m.%Y"),
            "amount": str(p.amount),
        })
        out.append(create_notification_log(
            rule=rule, category=NotificationCategory.PAYABLE,
            severity=NotificationSeverity.WARNING,
            title=title, message=msg,
            related_app="finance", related_model="payableitem",
            related_object_id=p.pk, related_title=p.title,
            actor=actor, request=request, fingerprint=fp,
        ))
    return out


def build_overdue_payable_notifications(*, actor=None, request=None) -> List[NotificationLog]:
    from apps.finance.models import PayableItem, PayableStatus
    rule = NotificationRule.objects.filter(code="PAYABLE_OVERDUE", is_active=True).first()
    today = timezone.localdate()
    qs = PayableItem.objects.filter(
        is_active=True, due_date__lt=today,
    ).exclude(status__in=[PayableStatus.PAID, PayableStatus.CANCELLED, PayableStatus.ARCHIVED])
    out = []
    for p in qs:
        fp = _fingerprint(rule_code="PAYABLE_OVERDUE", related_app="finance",
                           related_model="payableitem", related_object_id=p.pk,
                           target_date=today)
        if NotificationLog.objects.filter(metadata__fingerprint=fp).exists():
            continue
        title, msg = render_notification(rule, {
            "title": f"Geciken Ödeme: {p.title}",
            "message": f"{p.title} vadesi {p.due_date.strftime('%d.%m.%Y')} geçmiş",
        })
        out.append(create_notification_log(
            rule=rule, category=NotificationCategory.PAYABLE,
            severity=NotificationSeverity.CRITICAL,
            title=title, message=msg,
            related_app="finance", related_model="payableitem",
            related_object_id=p.pk, related_title=p.title,
            actor=actor, request=request, fingerprint=fp,
        ))
    return out


def build_task_due_notifications(*, actor=None, request=None) -> List[NotificationLog]:
    from apps.tasks.models import ACTIVE_STATUSES, Task
    rule_due = NotificationRule.objects.filter(code="TASK_DUE_TODAY", is_active=True).first()
    rule_over = NotificationRule.objects.filter(code="TASK_OVERDUE", is_active=True).first()
    today = timezone.localdate()
    qs = Task.objects.filter(is_active=True, status__in=ACTIVE_STATUSES,
                              due_date__isnull=False)
    out = []
    for t in qs:
        if t.due_date == today:
            rule, sev, code = rule_due, NotificationSeverity.WARNING, "TASK_DUE_TODAY"
        elif t.due_date < today:
            rule, sev, code = rule_over, NotificationSeverity.CRITICAL, "TASK_OVERDUE"
        else:
            continue
        fp = _fingerprint(rule_code=code, related_app="tasks",
                           related_model="task", related_object_id=t.pk,
                           target_date=t.due_date)
        if NotificationLog.objects.filter(metadata__fingerprint=fp).exists():
            continue
        title, msg = render_notification(rule, {
            "title": f"Görev: {t.title}",
            "message": f"Görev {t.title} · son tarih {t.due_date.strftime('%d.%m.%Y')}",
        })
        out.append(create_notification_log(
            rule=rule, category=NotificationCategory.TASK, severity=sev,
            title=title, message=msg,
            related_app="tasks", related_model="task",
            related_object_id=t.pk, related_title=t.title,
            target_user=t.assigned_to, actor=actor, request=request, fingerprint=fp,
        ))
    return out


def build_subscription_commitment_notifications(*, days: int = 30, actor=None, request=None) -> List[NotificationLog]:
    from apps.subscriptions.models import (CommitmentStatus,
                                             SubscriptionCommitment)
    rule = NotificationRule.objects.filter(code="SUBSCRIPTION_COMMITMENT_T30", is_active=True).first()
    today = timezone.localdate()
    qs = SubscriptionCommitment.objects.filter(
        is_active=True, end_date__gte=today,
        end_date__lte=today + timedelta(days=days),
    )
    out = []
    for c in qs:
        fp = _fingerprint(rule_code="SUBSCRIPTION_COMMITMENT_T30",
                           related_app="subscriptions",
                           related_model="subscriptioncommitment",
                           related_object_id=c.pk, target_date=c.end_date)
        if NotificationLog.objects.filter(metadata__fingerprint=fp).exists():
            continue
        title, msg = render_notification(rule, {
            "title": f"Taahhüt Bitişi: {c}",
            "message": f"Taahhüt bitiş tarihi {c.end_date.strftime('%d.%m.%Y')}",
        })
        out.append(create_notification_log(
            rule=rule, category=NotificationCategory.SUBSCRIPTION,
            severity=NotificationSeverity.WARNING,
            title=title, message=msg,
            related_app="subscriptions", related_model="subscriptioncommitment",
            related_object_id=c.pk, related_title=str(c),
            actor=actor, request=request, fingerprint=fp,
        ))
    return out


def build_site_dues_notifications(*, days: int = 3, actor=None, request=None) -> List[NotificationLog]:
    """Site Aidatları — user-facing label 'Site Aidatları'."""
    from apps.pruva.models import PruvaStatement
    rule = NotificationRule.objects.filter(code="SITE_DUES_DUE_T3", is_active=True).first()
    today = timezone.localdate()
    qs = PruvaStatement.objects.filter(
        is_active=True, due_date__gte=today,
        due_date__lte=today + timedelta(days=days),
    )
    out = []
    for s in qs:
        fp = _fingerprint(rule_code="SITE_DUES_DUE_T3", related_app="pruva",
                           related_model="pruvastatement", related_object_id=s.pk,
                           target_date=s.due_date)
        if NotificationLog.objects.filter(metadata__fingerprint=fp).exists():
            continue
        unit_label = str(getattr(s, "unit", "")) or ""
        title, msg = render_notification(rule, {
            "title": f"Site Aidatları: {unit_label}",
            "message": f"Site Aidatları son ödeme {s.due_date.strftime('%d.%m.%Y')}",
        })
        out.append(create_notification_log(
            rule=rule, category=NotificationCategory.SITE_DUES,
            severity=NotificationSeverity.WARNING,
            title=title, message=msg,
            related_app="pruva", related_model="pruvastatement",
            related_object_id=s.pk, related_title=unit_label,
            actor=actor, request=request, fingerprint=fp,
        ))
    return out


def build_property_tax_notifications(*, days: int = 15, actor=None, request=None) -> List[NotificationLog]:
    from apps.properties.models import (InstallmentStatus,
                                          PropertyTaxInstallment)
    rule = NotificationRule.objects.filter(code="PROPERTY_TAX_T15", is_active=True).first()
    today = timezone.localdate()
    qs = PropertyTaxInstallment.objects.filter(
        is_active=True, due_date__gte=today,
        due_date__lte=today + timedelta(days=days),
    ).exclude(status=InstallmentStatus.PAID)
    out = []
    for i in qs:
        fp = _fingerprint(rule_code="PROPERTY_TAX_T15", related_app="properties",
                           related_model="propertytaxinstallment",
                           related_object_id=i.pk, target_date=i.due_date)
        if NotificationLog.objects.filter(metadata__fingerprint=fp).exists():
            continue
        asset = getattr(i.tax_year, "property_asset", None) if getattr(i, "tax_year_id", None) else None
        title, msg = render_notification(rule, {
            "title": f"Emlak Vergisi Taksiti: {asset}",
            "message": f"Taksit {getattr(i, 'installment_no', '')} · son ödeme {i.due_date.strftime('%d.%m.%Y')}",
        })
        out.append(create_notification_log(
            rule=rule, category=NotificationCategory.PROPERTY_TAX,
            severity=NotificationSeverity.WARNING,
            title=title, message=msg,
            related_app="properties", related_model="propertytaxinstallment",
            related_object_id=i.pk, related_title=str(asset) if asset else "",
            actor=actor, request=request, fingerprint=fp,
        ))
    return out


def build_guarantee_commission_notifications(*, days: int = 7, actor=None, request=None) -> List[NotificationLog]:
    from apps.guarantees.models import (CommissionStatus,
                                          GuaranteeCommissionPeriod)
    rule = NotificationRule.objects.filter(code="GUARANTEE_COMMISSION_T7", is_active=True).first()
    today = timezone.localdate()
    qs = GuaranteeCommissionPeriod.objects.filter(
        is_active=True, due_date__gte=today,
        due_date__lte=today + timedelta(days=days),
    ).exclude(status=CommissionStatus.PAID)
    out = []
    for p in qs:
        fp = _fingerprint(rule_code="GUARANTEE_COMMISSION_T7",
                           related_app="guarantees",
                           related_model="guaranteecommissionperiod",
                           related_object_id=p.pk, target_date=p.due_date)
        if NotificationLog.objects.filter(metadata__fingerprint=fp).exists():
            continue
        g = getattr(p, "guarantee", None)
        title, msg = render_notification(rule, {
            "title": f"Teminat Komisyon: {getattr(g, 'letter_no', '')}",
            "message": f"Komisyon vadesi {p.due_date.strftime('%d.%m.%Y')}",
        })
        out.append(create_notification_log(
            rule=rule, category=NotificationCategory.GUARANTEE,
            severity=NotificationSeverity.WARNING,
            title=title, message=msg,
            related_app="guarantees", related_model="guaranteecommissionperiod",
            related_object_id=p.pk,
            related_title=getattr(g, "letter_no", "") if g else "",
            actor=actor, request=request, fingerprint=fp,
        ))
    return out


def build_integrator_credit_notifications(*, actor=None, request=None) -> List[NotificationLog]:
    from apps.integrators.models import CreditPackage, CreditPackageStatus
    rule = NotificationRule.objects.filter(code="INTEGRATOR_CREDIT_CRITICAL", is_active=True).first()
    qs = CreditPackage.objects.filter(
        is_active=True,
        status__in=[CreditPackageStatus.CRITICAL, CreditPackageStatus.EXHAUSTED],
    )
    out = []
    today = timezone.localdate()
    for pkg in qs:
        fp = _fingerprint(rule_code="INTEGRATOR_CREDIT_CRITICAL",
                           related_app="integrators",
                           related_model="creditpackage",
                           related_object_id=pkg.pk, target_date=today)
        if NotificationLog.objects.filter(metadata__fingerprint=fp).exists():
            continue
        s = getattr(pkg, "service", None)
        is_exhausted = pkg.status == CreditPackageStatus.EXHAUSTED
        sev = NotificationSeverity.CRITICAL if is_exhausted else NotificationSeverity.WARNING
        title, msg = render_notification(rule, {
            "title": f"Kontör Kritik: {s}",
            "message": f"Kalan kontör {getattr(pkg, 'remaining_credits', '?')} · durum {pkg.get_status_display() if hasattr(pkg, 'get_status_display') else ''}",
        })
        out.append(create_notification_log(
            rule=rule, category=NotificationCategory.INTEGRATOR, severity=sev,
            title=title, message=msg,
            related_app="integrators", related_model="creditpackage",
            related_object_id=pkg.pk, related_title=str(s) if s else "",
            actor=actor, request=request, fingerprint=fp,
        ))
    return out


# ---------- Orchestrator ----------


_BUILDERS = {
    NotificationCategory.PAYABLE: [
        ("due", build_due_payable_notifications),
        ("overdue", build_overdue_payable_notifications),
    ],
    NotificationCategory.TASK: [("task", build_task_due_notifications)],
    NotificationCategory.SUBSCRIPTION: [("commitment", build_subscription_commitment_notifications)],
    NotificationCategory.SITE_DUES: [("site_dues", build_site_dues_notifications)],
    NotificationCategory.PROPERTY_TAX: [("property_tax", build_property_tax_notifications)],
    NotificationCategory.GUARANTEE: [("guarantee", build_guarantee_commission_notifications)],
    NotificationCategory.INTEGRATOR: [("integrator", build_integrator_credit_notifications)],
}


def dry_run_categories() -> List[str]:
    return list(_BUILDERS.keys())


def run_notification_dry_run(*, category: Optional[str] = None, days: int = 7,
                              user=None, request=None) -> Dict[str, List[NotificationLog]]:
    if not _can_run_dry_run(user):
        raise PermissionDenied("Dry-run yetkisi yok.")
    targets = [category] if category else list(_BUILDERS.keys())
    result: Dict[str, List[NotificationLog]] = {}
    for cat in targets:
        builders = _BUILDERS.get(cat, [])
        produced: List[NotificationLog] = []
        for _name, fn in builders:
            try:
                # Sadece days kabul eden builder'lara days yolla
                import inspect
                sig = inspect.signature(fn)
                kw = {"actor": user, "request": request}
                if "days" in sig.parameters:
                    kw["days"] = days
                produced.extend(fn(**kw))
            except Exception as exc:  # noqa: BLE001
                # Bir kategori hata verirse diğerlerini durdurma
                produced.append(create_notification_log(
                    category=NotificationCategory.SYSTEM,
                    severity=NotificationSeverity.WARNING,
                    title=f"Dry-run hata ({cat})",
                    message=str(exc)[:300], actor=user, request=request,
                ))
        result[cat] = produced
    audit_log(
        actor=user, action="UPDATE", obj=None,
        summary=f"Bildirim dry-run · {len(targets)} kategori",
        metadata={"categories": targets, "produced": {k: len(v) for k, v in result.items()}},
        request=request,
    )
    return result


# ---------- State transitions ----------


@transaction.atomic
def mark_notification_ready(*, log: NotificationLog, user, request=None) -> NotificationLog:
    if not _can_run_dry_run(user):
        raise PermissionDenied("Yetki yok.")
    log.status = NotificationStatus.READY
    log.save(update_fields=["status"])
    audit_log(actor=user, action="UPDATE", obj=log,
              summary=f"Bildirim READY: {log.title[:80]}", request=request)
    return log


@transaction.atomic
def suppress_notification(*, log: NotificationLog, user, request=None,
                           reason: str = "") -> NotificationLog:
    if not _can_run_dry_run(user):
        raise PermissionDenied("Yetki yok.")
    log.status = NotificationStatus.SUPPRESSED
    if reason:
        meta = dict(log.metadata or {})
        meta["suppress_reason"] = reason
        log.metadata = meta
        log.save(update_fields=["status", "metadata"])
    else:
        log.save(update_fields=["status"])
    audit_log(actor=user, action="UPDATE", obj=log,
              summary=f"Bildirim SUPPRESSED: {log.title[:80]}",
              metadata={"reason": reason}, request=request)
    return log


@transaction.atomic
def cancel_notification(*, log: NotificationLog, user, request=None) -> NotificationLog:
    if not _can_run_dry_run(user):
        raise PermissionDenied("Yetki yok.")
    log.status = NotificationStatus.CANCELLED
    log.save(update_fields=["status"])
    audit_log(actor=user, action="UPDATE", obj=log,
              summary=f"Bildirim CANCELLED: {log.title[:80]}", request=request)
    return log


# ---------- Telegram (DRY-RUN ONLY) ----------


def simulate_telegram_message(notification: NotificationLog) -> dict:
    """Telegram mesaj formatını gösterir — gerçek gönderim YOK."""
    text = f"*{notification.title}*\n\n{notification.message}"
    masked = notification.masked_chat_id or "(yok)"
    return {
        "preview_text": text,
        "preview_length": len(text),
        "masked_chat_id": masked,
        "real_send": False,
        "channel": notification.channel,
        "warning": "Gerçek Telegram gönderimi KAPALI — bu yalnız simülasyondur.",
    }


def send_telegram_notification(notification: NotificationLog, *, actor=None,
                                request=None) -> NotificationLog:
    """GERÇEK GÖNDERİM YOK. Faz 13'te no-op / SUPPRESSED davranır.

    Bu fonksiyon HİÇBİR HTTP request yapmaz; requests/urllib import etmez.
    real_send_allowed=False ise log durumu SUPPRESSED'a çekilir ve audit kaydı yazılır.
    """
    # Hard guard — gerçek kanal açıksa bile dry_run flag baskındır.
    if notification.dry_run or not notification.real_send_allowed:
        notification.status = NotificationStatus.SUPPRESSED
        notification.error_message = "Gerçek Telegram gönderimi Faz 13'te kapalı."
        notification.save(update_fields=["status", "error_message"])
        audit_log(
            actor=actor, action="UPDATE", obj=notification,
            summary="Telegram gönderim engellendi (Faz 13 dry-run)",
            metadata={"reason": "real_send_disabled"}, request=request,
        )
        return notification
    # real_send_allowed=True olsa bile bu MVP'de no-op kalır
    notification.status = NotificationStatus.SUPPRESSED
    notification.error_message = "Telegram kanalı henüz devrede değil."
    notification.save(update_fields=["status", "error_message"])
    audit_log(actor=actor, action="UPDATE", obj=notification,
              summary="Telegram gönderim no-op (kanal kapalı)", request=request)
    return notification
