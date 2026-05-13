"""
Teminat Mektupları & Komisyon servisleri — Faz 8 Manual MVP.

Lifecycle: create/update/archive/restore/cancel/return/renew.
Komisyon: manuel veya generate; hesap basit MVP'de manuel veya
amount × commission_rate / 100 prorate.
PayableItem köprüsü Faz 5/6/7 ile aynı `period_link` helper.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import audit_log

from ..models import (
    CommissionPeriodKind, CommissionSource, CommissionStatus,
    GuaranteeCommissionPeriod, GuaranteeDocument, GuaranteeDocumentRole,
    GuaranteeLetter, GuaranteeStatus,
)


# === GuaranteeLetter lifecycle ============================================

@transaction.atomic
def create_guarantee(*, user, **kwargs) -> GuaranteeLetter:
    obj = GuaranteeLetter.objects.create(
        created_by=user, updated_by=user, **kwargs
    )
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Teminat oluşturuldu: {obj.letter_no} · {obj.title}",
              metadata={"amount": str(obj.amount), "currency": obj.currency,
                        "bank_id": obj.bank_id})
    return obj


@transaction.atomic
def update_guarantee(*, guarantee: GuaranteeLetter, user, **fields) -> GuaranteeLetter:
    if guarantee.status in (GuaranteeStatus.CANCELLED, GuaranteeStatus.RETURNED,
                             GuaranteeStatus.RENEWED):
        # Lifecycle kapalı — sadece notes değiştirilebilir
        allowed = {"notes"}
        if not set(fields).issubset(allowed):
            raise ValidationError(
                "Kapanmış teminat (CANCELLED/RETURNED/RENEWED) yalnız notes ile güncellenebilir."
            )
    changed = []
    for k, v in fields.items():
        if hasattr(guarantee, k) and getattr(guarantee, k) != v:
            setattr(guarantee, k, v)
            changed.append(k)
    guarantee.updated_by = user
    guarantee.save()
    audit_log(actor=user, action="UPDATE", obj=guarantee,
              summary=f"Teminat güncellendi: {guarantee.letter_no}",
              metadata={"changed": changed})
    return guarantee


@transaction.atomic
def archive_guarantee(*, guarantee: GuaranteeLetter, user, reason: str = ""):
    guarantee.archive(actor=user, reason=reason)
    audit_log(actor=user, action="ARCHIVE", obj=guarantee,
              summary=f"Teminat arşivlendi: {guarantee.letter_no}",
              metadata={"reason": reason})
    return guarantee


@transaction.atomic
def restore_guarantee(*, guarantee: GuaranteeLetter, user):
    guarantee.restore(actor=user)
    audit_log(actor=user, action="RESTORE", obj=guarantee,
              summary=f"Teminat geri alındı: {guarantee.letter_no}")
    return guarantee


@transaction.atomic
def cancel_guarantee(*, guarantee: GuaranteeLetter, user, reason: str = ""):
    if guarantee.status == GuaranteeStatus.CANCELLED:
        return guarantee
    guarantee.status = GuaranteeStatus.CANCELLED
    guarantee.cancelled_at = timezone.localdate()
    guarantee.notes = (guarantee.notes or "") + f"\n[İPTAL] {reason}".strip()
    guarantee.updated_by = user
    guarantee.save(update_fields=["status", "cancelled_at", "notes",
                                   "updated_by", "updated_at"])
    # Bağlı PENDING/LINKED komisyonları da iptal et
    from apps.finance.services.payments import cancel_payable, PaymentRuleError
    for cp in guarantee.commission_periods.filter(
        status__in=[CommissionStatus.PENDING, CommissionStatus.LINKED,
                    CommissionStatus.DRAFT, CommissionStatus.OVERDUE]
    ):
        if cp.payable_id:
            try:
                cancel_payable(payable=cp.payable, user=user,
                               reason=f"Teminat iptal: {reason}")
            except PaymentRuleError:
                pass
        cp.status = CommissionStatus.CANCELLED
        cp.save(update_fields=["status", "updated_at"])

    audit_log(actor=user, action="UPDATE", obj=guarantee,
              summary=f"Teminat iptal: {guarantee.letter_no}",
              metadata={"event": "CANCEL_GUARANTEE", "reason": reason})
    return guarantee


@transaction.atomic
def return_guarantee(*, guarantee: GuaranteeLetter, user,
                     returned_at: date | None = None, notes: str = ""):
    if guarantee.status in (GuaranteeStatus.RETURNED, GuaranteeStatus.CANCELLED,
                             GuaranteeStatus.RENEWED):
        raise ValidationError("Bu teminat zaten kapalı (RETURNED/CANCELLED/RENEWED).")
    guarantee.status = GuaranteeStatus.RETURNED
    guarantee.returned_at = returned_at or timezone.localdate()
    if notes:
        guarantee.notes = (guarantee.notes or "") + f"\n[İADE] {notes}".strip()
    guarantee.updated_by = user
    guarantee.save(update_fields=["status", "returned_at", "notes",
                                   "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=guarantee,
              summary=f"Teminat iade: {guarantee.letter_no} · {guarantee.returned_at}",
              metadata={"event": "RETURN_GUARANTEE", "returned_at": str(guarantee.returned_at)})
    return guarantee


@transaction.atomic
def renew_guarantee(*, old: GuaranteeLetter, user, **new_kwargs) -> GuaranteeLetter:
    """Eski mektup → yeni mektup. Eski mektup status=RENEWED olur."""
    if old.status in (GuaranteeStatus.RETURNED, GuaranteeStatus.CANCELLED,
                       GuaranteeStatus.RENEWED):
        raise ValidationError("Bu teminat zaten kapalı; yenileme yapılamaz.")
    new = GuaranteeLetter.objects.create(
        renewed_from=old, created_by=user, updated_by=user, **new_kwargs
    )
    old.status = GuaranteeStatus.RENEWED
    old.renewed_to = new
    old.updated_by = user
    old.save(update_fields=["status", "renewed_to", "updated_by", "updated_at"])
    audit_log(actor=user, action="CREATE", obj=new,
              summary=f"Yenileme: {old.letter_no} → {new.letter_no}",
              metadata={"event": "RENEW_GUARANTEE", "old_id": old.pk})
    audit_log(actor=user, action="UPDATE", obj=old,
              summary=f"Teminat yenilendi: {old.letter_no}",
              metadata={"event": "RENEWED_BY", "new_id": new.pk})
    return new


def calculate_guarantee_status(guarantee: GuaranteeLetter, *, today: date | None = None) -> str:
    """
    Bilgi amaçlı: vade durumuna göre önerilen status.
    Kapanmış (RETURNED/RENEWED/CANCELLED/PASSIVE) durumları değiştirmez.
    """
    if guarantee.status in (GuaranteeStatus.RETURNED, GuaranteeStatus.RENEWED,
                             GuaranteeStatus.CANCELLED, GuaranteeStatus.PASSIVE,
                             GuaranteeStatus.NEEDS_REVIEW):
        return guarantee.status
    today = today or timezone.localdate()
    if guarantee.expiry_date:
        if guarantee.expiry_date < today:
            return GuaranteeStatus.EXPIRED
        if guarantee.expiry_date <= today + timedelta(days=60):
            return GuaranteeStatus.APPROACHING
    return GuaranteeStatus.ACTIVE


# === Commission Period ====================================================

def calculate_commission_amount(
    guarantee: GuaranteeLetter, *,
    period_start: date | None = None, period_end: date | None = None,
) -> Decimal:
    """
    Basit MVP: amount × rate / 100 üzerinden yıllık baz, periyoda göre prorate.
    rate yoksa Decimal('0') döner; kullanıcı manuel girer.
    """
    if not guarantee.commission_rate or guarantee.amount <= 0:
        return Decimal("0")
    yearly = (guarantee.amount * guarantee.commission_rate) / Decimal("100")
    factor_map = {
        CommissionPeriodKind.MONTHLY: Decimal("1") / Decimal("12"),
        CommissionPeriodKind.QUARTERLY: Decimal("1") / Decimal("4"),
        CommissionPeriodKind.SEMI_ANNUAL: Decimal("1") / Decimal("2"),
        CommissionPeriodKind.YEARLY: Decimal("1"),
        CommissionPeriodKind.ONE_TIME: Decimal("1"),
        CommissionPeriodKind.CUSTOM: Decimal("1") / Decimal("4"),
    }
    factor = factor_map.get(guarantee.commission_period, Decimal("1") / Decimal("4"))
    amt = (yearly * factor).quantize(Decimal("0.01"))
    return amt


def _period_label(kind: str, d: date) -> str:
    if kind == CommissionPeriodKind.MONTHLY:
        return f"{d.year}-{d.month:02d}"
    if kind == CommissionPeriodKind.QUARTERLY:
        q = (d.month - 1) // 3 + 1
        return f"{d.year}-Q{q}"
    if kind == CommissionPeriodKind.SEMI_ANNUAL:
        h = 1 if d.month <= 6 else 2
        return f"{d.year}-H{h}"
    if kind == CommissionPeriodKind.YEARLY:
        return f"{d.year}"
    return d.strftime("%Y-%m-%d")


def _advance(d: date, kind: str) -> date:
    if kind == CommissionPeriodKind.MONTHLY:
        m = d.month + 1
        y = d.year + (1 if m > 12 else 0)
        m = ((m - 1) % 12) + 1
        return date(y, m, min(d.day, 28))
    if kind == CommissionPeriodKind.QUARTERLY:
        m = d.month + 3
        y = d.year + (1 if m > 12 else 0)
        m = ((m - 1) % 12) + 1
        return date(y, m, min(d.day, 28))
    if kind == CommissionPeriodKind.SEMI_ANNUAL:
        m = d.month + 6
        y = d.year + (1 if m > 12 else 0)
        m = ((m - 1) % 12) + 1
        return date(y, m, min(d.day, 28))
    if kind == CommissionPeriodKind.YEARLY:
        return date(d.year + 1, d.month, min(d.day, 28))
    return d + timedelta(days=30)


@transaction.atomic
def create_commission_period(
    *, guarantee: GuaranteeLetter, user,
    period_label: str, due_date: date, commission_amount: Decimal | None = None,
    notes: str = "", source: str = CommissionSource.MANUAL,
) -> GuaranteeCommissionPeriod:
    if guarantee.status in (GuaranteeStatus.RETURNED, GuaranteeStatus.CANCELLED,
                             GuaranteeStatus.PASSIVE, GuaranteeStatus.RENEWED):
        raise ValidationError(
            "Kapanmış teminat (RETURNED/CANCELLED/PASSIVE/RENEWED) için yeni komisyon dönemi oluşturulamaz."
        )
    if GuaranteeCommissionPeriod.objects.filter(
        guarantee=guarantee, period_label=period_label
    ).exists():
        raise ValidationError(f"Bu teminat için '{period_label}' dönemi zaten var.")
    amt = commission_amount if commission_amount is not None else calculate_commission_amount(guarantee)
    obj = GuaranteeCommissionPeriod.objects.create(
        guarantee=guarantee, period_label=period_label, due_date=due_date,
        commission_amount=Decimal(str(amt)), notes=notes or "", source=source,
        created_by=user, updated_by=user,
    )
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Komisyon dönemi: {obj}",
              metadata={"guarantee_id": guarantee.pk, "label": period_label,
                        "amount": str(obj.commission_amount)})
    return obj


@transaction.atomic
def generate_commission_periods(
    *, guarantee: GuaranteeLetter, user, months: int = 12,
    start_date: date | None = None,
) -> list[GuaranteeCommissionPeriod]:
    """
    Idempotent: mevcut etiketleri atlar.
    `months` parametresi yaklaşık ufuk; QUARTERLY için 12 ay = 4 dönem.
    """
    if guarantee.status in (GuaranteeStatus.RETURNED, GuaranteeStatus.CANCELLED,
                             GuaranteeStatus.PASSIVE, GuaranteeStatus.RENEWED):
        raise ValidationError(
            "Kapanmış teminat için komisyon dönemi üretilemez."
        )
    kind = guarantee.commission_period
    step_months = {
        CommissionPeriodKind.MONTHLY: 1,
        CommissionPeriodKind.QUARTERLY: 3,
        CommissionPeriodKind.SEMI_ANNUAL: 6,
        CommissionPeriodKind.YEARLY: 12,
        CommissionPeriodKind.ONE_TIME: 12,
        CommissionPeriodKind.CUSTOM: 3,
    }.get(kind, 3)
    count = max(1, months // step_months)

    today = timezone.localdate()
    cur = start_date or guarantee.issue_date or today
    if cur < today:
        # Mevcut tarihten başla — geçmiş dönem üretme
        cur = today
    created: list[GuaranteeCommissionPeriod] = []
    for _ in range(count):
        label = _period_label(kind, cur)
        if not GuaranteeCommissionPeriod.objects.filter(
            guarantee=guarantee, period_label=label
        ).exists():
            obj = GuaranteeCommissionPeriod.objects.create(
                guarantee=guarantee, period_label=label,
                due_date=cur, commission_amount=calculate_commission_amount(guarantee),
                source=CommissionSource.GENERATED,
                created_by=user, updated_by=user,
            )
            created.append(obj)
        cur = _advance(cur, kind)
        if kind == CommissionPeriodKind.ONE_TIME:
            break
    audit_log(actor=user, action="CREATE", obj=guarantee,
              summary=f"Komisyon dönemleri üretildi: {len(created)} yeni",
              metadata={"event": "GENERATE_PERIODS", "created": len(created),
                        "kind": kind, "count_target": count})
    return created


@transaction.atomic
def cancel_commission_period(
    *, period: GuaranteeCommissionPeriod, user, reason: str = ""
) -> GuaranteeCommissionPeriod:
    if period.payable_id:
        from apps.finance.services.payments import cancel_payable, PaymentRuleError
        try:
            cancel_payable(payable=period.payable, user=user,
                           reason=f"Komisyon iptal: {reason}")
        except PaymentRuleError:
            pass
    period.status = CommissionStatus.CANCELLED
    period.notes = (period.notes or "") + f"\n[İPTAL] {reason}".strip()
    period.updated_by = user
    period.save(update_fields=["status", "notes", "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=period,
              summary=f"Komisyon dönemi iptal: {period}",
              metadata={"event": "CANCEL_COMMISSION", "reason": reason})
    return period


# === Payable bağlama ======================================================

@transaction.atomic
def create_payable_from_commission(
    *, period: GuaranteeCommissionPeriod, user,
    payment_method: str = "EFT",
):
    if period.status == CommissionStatus.CANCELLED:
        raise ValidationError("İptal edilmiş komisyon döneminden PayableItem üretilemez.")
    if period.commission_amount <= 0:
        raise ValidationError("Komisyon tutarı 0 — PayableItem yaratılmaz.")
    if period.guarantee.status in (GuaranteeStatus.CANCELLED,
                                    GuaranteeStatus.RETURNED,
                                    GuaranteeStatus.PASSIVE):
        raise ValidationError("Kapanmış teminat için PayableItem üretilemez.")

    from apps.finance.services.period_link import create_payable_from_period
    g = period.guarantee
    title = f"Teminat Komisyonu — {g.letter_no} — {period.period_label}"
    payable, created = create_payable_from_period(
        period=period, user=user,
        title=title, category="GUARANTEE_COMMISSION",
        period_label=period.period_label,
        supplier_name=(g.bank.name if g.bank_id else ""),
        payment_method=payment_method, bank=g.bank,
        extra_notes=(f"Guarantee #{g.pk} · letter_no={g.letter_no}"
                     f" · period #{period.pk}"),
    )
    if created:
        period.status = CommissionStatus.LINKED
        period.save(update_fields=["status", "updated_at"])
    return payable, created


# === Document =============================================================

@transaction.atomic
def attach_guarantee_document(
    *, user, document, document_role: str = GuaranteeDocumentRole.OTHER,
    guarantee: GuaranteeLetter | None = None,
    commission_period: GuaranteeCommissionPeriod | None = None,
) -> GuaranteeDocument:
    if not (guarantee or commission_period):
        raise ValidationError("guarantee veya commission_period zorunlu.")
    if commission_period and not guarantee:
        guarantee = commission_period.guarantee
    obj, created = GuaranteeDocument.objects.get_or_create(
        guarantee=guarantee, commission_period=commission_period,
        document=document, document_role=document_role,
        defaults={"uploaded_by": user},
    )
    if created:
        ref = commission_period or guarantee
        audit_log(actor=user, action="UPDATE", obj=ref,
                  summary=f"Belge bağlandı: {document.original_filename} ({document_role})",
                  metadata={"document_id": document.pk, "role": document_role})
    return obj
