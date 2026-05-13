"""
SiteX servisleri — Faz 6 Manual MVP.

Tüm CRUD/lifecycle/Period→Payable işlemleri burada.
Anayasa Madde 3.5 (audit her aksiyon).
"""
from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import audit_log

from ..models import (
    AidatDifferenceStatus,
    PruvaAidatDifference,
    PruvaSiteDocument,
    PruvaStatement,
    PruvaStatementDocument,
    PruvaUnit,
    StatementDocumentRole,
    StatementStatus,
    UnitStatus,
)


# === Yardımcı ==============================================================

def default_due_date(year: int, month: int, unit: PruvaUnit) -> date:
    """
    Daireye özel `default_due_day` (varsayılan 20) baz alınarak `date` üretir.
    Şubat gibi 28/29 günlü ayda taşma olursa ay sonuna çekilir.
    """
    day = unit.default_due_day or 20
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last))


def calculate_statement_total(*, aidat=0, gider=0, previous_debt=0, penalty=0, other=0) -> Decimal:
    """Statement toplam tutar hesaplama (helper)."""
    return (
        Decimal(str(aidat or 0))
        + Decimal(str(gider or 0))
        + Decimal(str(previous_debt or 0))
        + Decimal(str(penalty or 0))
        + Decimal(str(other or 0))
    )


# === Unit CRUD =============================================================

@transaction.atomic
def create_unit(*, user, **kwargs) -> PruvaUnit:
    obj = PruvaUnit(**kwargs)
    obj.created_by = user
    obj.updated_by = user
    obj.save()
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"SiteX daire oluşturuldu: {obj.code}")
    return obj


@transaction.atomic
def update_unit(*, unit: PruvaUnit, user, **fields) -> PruvaUnit:
    changed = []
    for k, v in fields.items():
        if hasattr(unit, k) and getattr(unit, k) != v:
            setattr(unit, k, v)
            changed.append(k)
    unit.updated_by = user
    unit.save()
    audit_log(actor=user, action="UPDATE", obj=unit,
              summary=f"Daire güncellendi: {unit.code}",
              metadata={"changed": changed})
    return unit


def archive_unit(*, unit: PruvaUnit, user, reason: str = "") -> PruvaUnit:
    unit.archive(actor=user, reason=reason)
    unit.status = UnitStatus.PASSIVE
    unit.save(update_fields=["status", "updated_at"])
    audit_log(actor=user, action="ARCHIVE", obj=unit,
              summary=f"Daire pasifleştirildi: {unit.code}",
              metadata={"reason": reason})
    return unit


def restore_unit(*, unit: PruvaUnit, user) -> PruvaUnit:
    unit.restore(actor=user)
    unit.status = UnitStatus.ACTIVE
    unit.save(update_fields=["status", "updated_at"])
    audit_log(actor=user, action="RESTORE", obj=unit,
              summary=f"Daire aktifleştirildi: {unit.code}")
    return unit


@transaction.atomic
def mark_unit_sold(*, unit: PruvaUnit, user, sale_date: date, buyer_name: str = "") -> PruvaUnit:
    """Satıldı durumuna alır; tarihçe korunur."""
    unit.status = UnitStatus.SOLD
    unit.sale_date = sale_date
    unit.buyer_name = buyer_name
    unit.updated_by = user
    unit.save(update_fields=["status", "sale_date", "buyer_name", "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=unit,
              summary=f"Daire satıldı: {unit.code} → {buyer_name or '?'}",
              metadata={"event": "UNIT_SOLD", "sale_date": str(sale_date),
                        "buyer": buyer_name})
    return unit


# === Statement CRUD ========================================================

@transaction.atomic
def create_statement(
    *,
    unit: PruvaUnit,
    user,
    year: int,
    month: int,
    aidat_amount: Decimal | float | int = 0,
    gider_amount: Decimal | float | int = 0,
    previous_debt: Decimal | float | int = 0,
    penalty: Decimal | float | int = 0,
    other: Decimal | float | int = 0,
    due_date_override: date | None = None,
    period_label: str | None = None,
    source: str | None = None,
    notes: str = "",
) -> PruvaStatement:
    """Yeni ekstre yarat (idempotent: unique(unit,year,month))."""
    if month < 1 or month > 12:
        raise ValidationError("Ay 1-12 arası olmalı.")
    if PruvaStatement.objects.filter(unit=unit, year=year, month=month).exists():
        raise ValidationError(f"Bu daireye {year}-{month:02d} ekstresi zaten kayıtlı.")

    label = period_label or f"{year}-{month:02d}"
    due = due_date_override or default_due_date(year, month, unit)
    total = calculate_statement_total(
        aidat=aidat_amount, gider=gider_amount,
        previous_debt=previous_debt, penalty=penalty, other=other,
    )
    obj = PruvaStatement(
        unit=unit, year=year, month=month, period_label=label, due_date=due,
        aidat_amount=Decimal(str(aidat_amount)),
        gider_amount=Decimal(str(gider_amount)),
        previous_debt=Decimal(str(previous_debt)),
        penalty=Decimal(str(penalty)),
        other=Decimal(str(other)),
        total_amount=total,
        notes=notes or "",
        created_by=user, updated_by=user,
    )
    if source:
        obj.source = source
    obj.save()
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Ekstre oluşturuldu: {unit.code} · {label} · {total} TL",
              metadata={"unit": unit.code, "year": year, "month": month,
                        "total": str(total)})
    return obj


@transaction.atomic
def update_statement(*, statement: PruvaStatement, user, **fields) -> PruvaStatement:
    if statement.status in (StatementStatus.LINKED, StatementStatus.PAID, StatementStatus.CANCELLED):
        raise ValidationError(
            f"Durumu '{statement.get_status_display()}' olan ekstre güncellenemez."
        )
    changed = []
    for k, v in fields.items():
        if hasattr(statement, k) and getattr(statement, k) != v:
            setattr(statement, k, v)
            changed.append(k)
    # Toplamı yeniden hesapla
    statement.total_amount = calculate_statement_total(
        aidat=statement.aidat_amount, gider=statement.gider_amount,
        previous_debt=statement.previous_debt, penalty=statement.penalty,
        other=statement.other,
    )
    statement.updated_by = user
    statement.save()
    audit_log(actor=user, action="UPDATE", obj=statement,
              summary=f"Ekstre güncellendi: {statement.unit.code} · {statement.period_label}",
              metadata={"changed": changed, "total": str(statement.total_amount)})
    return statement


@transaction.atomic
def cancel_statement(*, statement: PruvaStatement, user, reason: str = "") -> PruvaStatement:
    """Ekstreyi iptal eder; bağlı PayableItem varsa cancel_payable çağrılır."""
    if statement.status == StatementStatus.CANCELLED:
        return statement
    statement.status = StatementStatus.CANCELLED
    statement.notes = (statement.notes or "") + f"\n[İPTAL] {reason}".strip()
    statement.updated_by = user
    statement.save(update_fields=["status", "notes", "updated_by", "updated_at"])

    if statement.payable_id:
        from apps.finance.services.payments import cancel_payable, PaymentRuleError
        try:
            cancel_payable(payable=statement.payable, user=user,
                           reason=f"Ekstre iptal: {reason}")
        except PaymentRuleError:
            # Onay bekleyen tx vb. varsa sadece statement iptal olur, payable elle hallolur
            pass

    audit_log(actor=user, action="UPDATE", obj=statement,
              summary=f"Ekstre iptal: {statement.unit.code} · {statement.period_label}",
              metadata={"event": "CANCEL_STATEMENT", "reason": reason})
    return statement


@transaction.atomic
def attach_statement_document(
    *, statement: PruvaStatement, document, user,
    document_role: str = StatementDocumentRole.STATEMENT,
) -> PruvaStatementDocument:
    sd, created = PruvaStatementDocument.objects.get_or_create(
        statement=statement, document=document, document_role=document_role,
        defaults={"uploaded_by": user},
    )
    if created:
        audit_log(actor=user, action="UPDATE", obj=statement,
                  summary=f"Belge bağlandı: {document.original_filename} ({document_role})",
                  metadata={"document_id": document.pk, "role": document_role})
    return sd


# === Statement → PayableItem ==============================================

@transaction.atomic
def create_payable_from_statement(*, statement: PruvaStatement, user,
                                  payment_method: str = "EFT", bank=None):
    """
    PruvaStatement → PayableItem (idempotent).

    Faz 5 ortak helper kullanılır.
    Tutar 0 ise yaratılmaz (anlamsız).
    """
    if statement.status == StatementStatus.CANCELLED:
        raise ValidationError("İptal edilmiş ekstreden PayableItem üretilemez.")
    if statement.total_amount <= 0:
        raise ValidationError("Toplam tutar 0 — PayableItem yaratılmaz.")

    from apps.finance.services.period_link import create_payable_from_period
    payable, created = create_payable_from_period(
        period=statement, user=user,
        title=f"SiteX {statement.unit.code} · {statement.period_label}",
        category="SITEX_AIDAT",
        period_label=statement.period_label,
        supplier_name="SiteX Yönetim",
        payment_method=payment_method, bank=bank,
        extra_notes=f"PruvaStatement #{statement.pk} · daire {statement.unit.code}",
    )
    if created:
        statement.status = StatementStatus.LINKED
        statement.save(update_fields=["status", "updated_at"])
    return payable, created


def mark_statement_paid_from_payable(*, statement: PruvaStatement) -> PruvaStatement:
    """Bağlı PayableItem PAID ise statement'i de PAID'e çek."""
    if not statement.payable_id:
        return statement
    from apps.finance.models import PayableStatus
    if statement.payable.status == PayableStatus.PAID:
        statement.status = StatementStatus.PAID
        statement.save(update_fields=["status", "updated_at"])
    return statement


# === Aidat Difference ======================================================

@transaction.atomic
def create_aidat_difference(*, user, **kwargs) -> PruvaAidatDifference:
    obj = PruvaAidatDifference(**kwargs)
    obj.created_by = user
    obj.updated_by = user
    obj.save()
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Aidat farkı: {obj}")
    return obj


@transaction.atomic
def cancel_aidat_difference(*, diff: PruvaAidatDifference, user, reason: str = "") -> PruvaAidatDifference:
    diff.status = AidatDifferenceStatus.CANCELLED
    diff.notes = (diff.notes or "") + f"\n[İPTAL] {reason}".strip()
    diff.updated_by = user
    diff.save(update_fields=["status", "notes", "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=diff,
              summary=f"Aidat farkı iptal: {diff}",
              metadata={"event": "CANCEL_DIFF", "reason": reason})
    return diff


# === Site Document =========================================================

@transaction.atomic
def attach_site_document(*, user, **kwargs) -> PruvaSiteDocument:
    obj = PruvaSiteDocument(**kwargs)
    obj.uploaded_by = user
    obj.save()
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Site belgesi: {obj.title} ({obj.get_document_type_display()})")
    return obj
