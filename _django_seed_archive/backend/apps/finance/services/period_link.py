"""
Period → PayableItem dönüştürücü (Faz 5 ortak helper).

Subscriptions / RegularPayments / OfficialPayments app'leri bu fonksiyonu
çağırarak kendi period kayıtlarından PayableItem üretebilir.

Kural (idempotency):
- period.payable zaten varsa: yeni yaratmaz, mevcut payable'ı döner.
"""
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.audit.services import audit_log

from ..models import OwnerType, PayableSource, PayableStatus, PaymentMethod, PayableItem
from .payments import calculate_payable_status, requires_double_approval, requires_receipt


@transaction.atomic
def create_payable_from_period(
    *,
    period,
    user,
    title: str,
    category: str,
    institution=None,
    period_label: str = "",
    supplier_name: str = "",
    payment_method: str = PaymentMethod.EFT,
    bank=None,
    extra_notes: str = "",
) -> tuple[PayableItem, bool]:
    """
    Generic period (Subscription/Regular/Official) → PayableItem.

    `period` nesnesi şu alanları taşımalı:
    - owner_type, company, person
    - amount (Decimal)
    - due_date (date)
    - currency (str, optional)
    - payable (FK, opsiyonel idempotency)

    Returns: (payable, created)
    """
    # Idempotency
    existing = getattr(period, "payable", None)
    if existing:
        return existing, False

    payable = PayableItem(
        owner_type=getattr(period, "owner_type", None) or OwnerType.OTHER,
        company=getattr(period, "company", None),
        person=getattr(period, "person", None),
        title=title,
        category=category,
        institution=institution,
        supplier_name=supplier_name,
        period_label=period_label,
        due_date=period.due_date,
        currency=getattr(period, "currency", None) or "TRY",
        amount=Decimal(str(period.amount)),
        payment_method=payment_method,
        bank=bank,
        source=PayableSource.MANUAL,
        notes=(
            f"Kaynak: {period._meta.app_label}.{period._meta.model_name} #{period.pk}"
            + (f"\n{extra_notes}" if extra_notes else "")
        ),
        created_by=user,
        updated_by=user,
    )
    payable.requires_receipt = requires_receipt(payable.amount)
    payable.requires_double_approval = requires_double_approval(payable.amount)
    payable.status = calculate_payable_status(payable)
    payable.save()

    # Period güncelle
    period.payable = payable
    if hasattr(period, "status"):
        # Generic enum: LINKED varsa onu kullan
        try:
            period.status = "LINKED"
        except Exception:
            pass
    period.save(update_fields=["payable", "status", "updated_at"]) if hasattr(period, "updated_at") \
        else period.save(update_fields=["payable", "status"])

    audit_log(
        actor=user, action="CREATE", obj=payable,
        summary=f"Period'dan PayableItem yaratıldı: {title} · {payable.amount} TL",
        metadata={
            "source_app": period._meta.app_label,
            "source_model": period._meta.model_name,
            "source_id": period.pk,
            "amount": str(payable.amount),
            "due_date": str(payable.due_date),
            "requires_receipt": payable.requires_receipt,
            "requires_double_approval": payable.requires_double_approval,
        },
    )
    return payable, True
