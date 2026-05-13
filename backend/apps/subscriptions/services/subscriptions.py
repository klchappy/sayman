"""Subscription servisleri — Faz 5 manual MVP."""
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.audit.services import audit_log

from ..models import (
    CommitmentStatus,
    PeriodChargeStatus,
    Subscription,
    SubscriptionCommitment,
    SubscriptionPeriodCharge,
)


@transaction.atomic
def create_subscription(*, user, **kwargs) -> Subscription:
    obj = Subscription(**kwargs)
    obj.created_by = user
    obj.updated_by = user
    obj.save()
    audit_log(actor=user, action="CREATE", obj=obj, summary=f"Abonelik yaratıldı: {obj.title}")
    return obj


@transaction.atomic
def update_subscription(*, subscription: Subscription, user, **fields) -> Subscription:
    changed = []
    for k, v in fields.items():
        if hasattr(subscription, k) and getattr(subscription, k) != v:
            setattr(subscription, k, v)
            changed.append(k)
    subscription.updated_by = user
    subscription.save()
    audit_log(actor=user, action="UPDATE", obj=subscription,
              summary=f"Güncellendi: {subscription.title}",
              metadata={"changed": changed})
    return subscription


def archive_subscription(*, subscription: Subscription, user, reason: str = "") -> Subscription:
    subscription.archive(actor=user, reason=reason)
    audit_log(actor=user, action="ARCHIVE", obj=subscription,
              summary=f"Pasifleştirildi: {subscription.title}", metadata={"reason": reason})
    return subscription


def restore_subscription(*, subscription: Subscription, user) -> Subscription:
    subscription.restore(actor=user)
    audit_log(actor=user, action="RESTORE", obj=subscription, summary=f"Aktifleştirildi: {subscription.title}")
    return subscription


@transaction.atomic
def add_commitment(*, subscription: Subscription, user, **kwargs) -> SubscriptionCommitment:
    kwargs.setdefault("reminder_days", [60, 30, 15, 7, 1])
    cm = SubscriptionCommitment(subscription=subscription, **kwargs)
    cm.created_by = user
    cm.status = calculate_commitment_status(cm)
    cm.save()
    audit_log(actor=user, action="CREATE", obj=cm,
              summary=f"Taahhüt eklendi: {subscription.title} · {cm.end_date}")
    return cm


def calculate_commitment_status(commitment: SubscriptionCommitment) -> str:
    """Bitiş tarihine göre status (manuel CANCELLED/RENEWED override edilmez)."""
    if commitment.status in (CommitmentStatus.CANCELLED, CommitmentStatus.RENEWED, CommitmentStatus.NEEDS_REVIEW):
        return commitment.status
    today = timezone.localdate()
    days = (commitment.end_date - today).days
    if days < 0:
        return CommitmentStatus.EXPIRED
    if days <= 60:
        return CommitmentStatus.APPROACHING
    return CommitmentStatus.ACTIVE


def refresh_commitment_statuses():
    """Cron yardımcısı — tüm aktif taahhütlerin status'unu yenile (Faz 10'da scheduled)."""
    qs = SubscriptionCommitment.objects.filter(is_active=True).exclude(status__in=[
        CommitmentStatus.CANCELLED, CommitmentStatus.RENEWED,
    ])
    for cm in qs:
        new_status = calculate_commitment_status(cm)
        if new_status != cm.status:
            cm.status = new_status
            cm.save(update_fields=["status", "updated_at"])


@transaction.atomic
def create_period_charge(*, subscription: Subscription, user, period_label: str,
                         due_date: date, amount: Decimal, **extra) -> SubscriptionPeriodCharge:
    pc = SubscriptionPeriodCharge.objects.create(
        subscription=subscription,
        period_label=period_label,
        due_date=due_date,
        amount=Decimal(str(amount)),
        created_by=user,
        **extra,
    )
    audit_log(actor=user, action="CREATE", obj=pc,
              summary=f"Dönem ücret kaydı: {subscription.title} · {period_label}")
    return pc


def link_period_charge_to_payable(*, charge: SubscriptionPeriodCharge, payable, user):
    """Manuel olarak mevcut bir PayableItem ile bağ kur."""
    if charge.payable_id:
        return charge
    charge.payable = payable
    charge.status = PeriodChargeStatus.LINKED
    charge.save(update_fields=["payable", "status", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=charge,
              summary=f"Manuel PayableItem bağlandı: #{payable.pk}")
    return charge


def create_payable_from_subscription_charge(*, charge: SubscriptionPeriodCharge, user,
                                            payment_method=None, bank=None):
    """SubscriptionPeriodCharge → PayableItem (idempotent)."""
    from apps.finance.services.period_link import create_payable_from_period

    sub = charge.subscription
    pm = payment_method or sub.default_payment_method
    bnk = bank or sub.default_bank

    payable, created = create_payable_from_period(
        period=charge,
        user=user,
        title=f"{sub.title} · {charge.period_label}".strip(" ·"),
        category=sub.get_service_type_display(),
        institution=sub.institution,
        period_label=charge.period_label,
        supplier_name=sub.provider_name,
        payment_method=pm,
        bank=bnk,
        extra_notes=f"Abonelik: {sub.title} · Hesap: {sub.account_no or '—'}",
    )
    if created:
        # status'ü explicit LINKED yap
        charge.status = PeriodChargeStatus.LINKED
        charge.save(update_fields=["status", "updated_at"])
    return payable, created
