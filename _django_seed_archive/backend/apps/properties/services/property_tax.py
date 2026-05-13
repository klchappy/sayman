"""
Emlak Vergisi servisleri — Faz 7 Manual MVP.

W-3 PropertyAsset lifecycle helper'ları + Municipality + TaxYear +
Installment + Document işlemleri. Tümü AuditLog yazar.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import audit_log

from ..models import (
    InstallmentStatus, Municipality, PropertyTaxDocument,
    PropertyTaxInstallment, PropertyTaxYear, TaxDocumentRole, TaxYearStatus,
)


# === PropertyAsset lifecycle (W-3) ========================================

@transaction.atomic
def create_property_asset(*, user, **kwargs):
    """W-3: yeni mülk yarat + audit."""
    from apps.parties.models import PropertyAsset
    obj = PropertyAsset.objects.create(**kwargs)
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Mülk oluşturuldu: {obj.name}",
              metadata={"property_type": obj.property_type, "status": obj.status})
    return obj


@transaction.atomic
def update_property_asset(*, asset, user, **fields):
    changed = []
    for k, v in fields.items():
        if hasattr(asset, k) and getattr(asset, k) != v:
            setattr(asset, k, v)
            changed.append(k)
    asset.save()
    audit_log(actor=user, action="UPDATE", obj=asset,
              summary=f"Mülk güncellendi: {asset.name}",
              metadata={"changed": changed})
    return asset


@transaction.atomic
def mark_property_sold(*, asset, user, sale_date: date, buyer_name: str = ""):
    """Mülk satıldı; tarihçe (geçmiş yıl/taksit) korunur."""
    asset.status = "SOLD"
    asset.sale_date = sale_date
    asset.buyer_name = buyer_name
    asset.save(update_fields=["status", "sale_date", "buyer_name", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=asset,
              summary=f"Mülk satıldı: {asset.name} → {buyer_name or '?'}",
              metadata={"event": "PROPERTY_SOLD",
                        "sale_date": str(sale_date), "buyer": buyer_name})
    return asset


# === Municipality =========================================================

@transaction.atomic
def create_municipality(*, user, **kwargs) -> Municipality:
    obj = Municipality.objects.create(**kwargs)
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Belediye oluşturuldu: {obj.name}")
    return obj


# === Default due date helper ==============================================

def default_installment_due_date(year: int, installment_no: int) -> date:
    """
    Türkiye emlak vergisi varsayılan son ödeme:
    - 1. taksit: 31.05
    - 2. taksit: 30.11
    - diğer (0/3+): 30.11 (kullanıcı manuel değiştirebilir)
    """
    if installment_no == 1:
        return date(year, 5, 31)
    if installment_no == 2:
        return date(year, 11, 30)
    return date(year, 11, 30)


# === PropertyTaxYear ======================================================

@transaction.atomic
def create_property_tax_year(
    *, user, property_asset, tax_year: int,
    municipality=None, total_accrual_amount=Decimal("0"), notes: str = "",
) -> PropertyTaxYear:
    if PropertyTaxYear.objects.filter(
        property_asset=property_asset, tax_year=tax_year
    ).exists():
        raise ValidationError(
            f"Bu mülke {tax_year} yılı için kayıt zaten var."
        )
    if property_asset.status in ("SOLD",) and not notes:
        # Satılmış mülk için yeni yıl ekleniyorsa kullanıcı bilgisi notes'a düşer.
        notes = "[NOT] Mülk SOLD durumunda — kullanıcı bilinçli ekledi."

    obj = PropertyTaxYear.objects.create(
        property_asset=property_asset, municipality=municipality,
        tax_year=tax_year,
        total_accrual_amount=Decimal(str(total_accrual_amount)),
        remaining_amount=Decimal(str(total_accrual_amount)),
        notes=notes or "",
        created_by=user, updated_by=user,
    )
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Emlak vergisi yılı oluşturuldu: {obj}",
              metadata={"property_id": property_asset.pk, "year": tax_year,
                        "accrual": str(obj.total_accrual_amount)})
    return obj


@transaction.atomic
def update_property_tax_year(*, tax_year: PropertyTaxYear, user, **fields) -> PropertyTaxYear:
    if tax_year.status == TaxYearStatus.CANCELLED:
        raise ValidationError("İptal edilmiş yıl güncellenemez.")
    changed = []
    for k, v in fields.items():
        if hasattr(tax_year, k) and getattr(tax_year, k) != v:
            setattr(tax_year, k, v)
            changed.append(k)
    tax_year.updated_by = user
    tax_year.save()
    calculate_tax_year_totals(tax_year)
    audit_log(actor=user, action="UPDATE", obj=tax_year,
              summary=f"Yıl güncellendi: {tax_year}",
              metadata={"changed": changed})
    return tax_year


@transaction.atomic
def cancel_property_tax_year(*, tax_year: PropertyTaxYear, user, reason: str = ""):
    tax_year.status = TaxYearStatus.CANCELLED
    tax_year.notes = (tax_year.notes or "") + f"\n[İPTAL] {reason}".strip()
    tax_year.updated_by = user
    tax_year.save(update_fields=["status", "notes", "updated_by", "updated_at"])
    # Bağlı taksitlerin payable'ları varsa cancel_payable çağır
    from apps.finance.services.payments import cancel_payable, PaymentRuleError
    for inst in tax_year.installments.all():
        if inst.payable_id:
            try:
                cancel_payable(payable=inst.payable, user=user,
                               reason=f"Emlak vergisi yılı iptal: {reason}")
            except PaymentRuleError:
                pass
        inst.status = InstallmentStatus.CANCELLED
        inst.save(update_fields=["status", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=tax_year,
              summary=f"Yıl iptal: {tax_year}",
              metadata={"event": "CANCEL_TAX_YEAR", "reason": reason})
    return tax_year


def calculate_tax_year_totals(tax_year: PropertyTaxYear) -> PropertyTaxYear:
    """
    Taksitlerin durumuna göre paid/remaining ve status'ü yeniden hesapla.
    `total_accrual_amount` kullanıcı tarafından girilmiş tutardır;
    eğer 0 ise installment toplamı baz alınır.
    """
    paid = Decimal("0")
    accrual_from_installments = Decimal("0")
    for inst in tax_year.installments.filter(is_active=True):
        accrual_from_installments += inst.amount
        if inst.status == InstallmentStatus.PAID:
            paid += inst.amount
    accrual = tax_year.total_accrual_amount or accrual_from_installments
    remaining = max(Decimal("0"), accrual - paid)
    tax_year.total_paid_amount = paid
    tax_year.remaining_amount = remaining
    if tax_year.status not in (TaxYearStatus.CANCELLED, TaxYearStatus.NEEDS_REVIEW,
                                TaxYearStatus.DRAFT):
        if accrual > 0 and paid >= accrual:
            tax_year.status = TaxYearStatus.PAID
        elif paid > 0:
            tax_year.status = TaxYearStatus.PARTIAL_PAID
        else:
            tax_year.status = TaxYearStatus.PENDING
    tax_year.save(update_fields=["total_paid_amount", "remaining_amount",
                                  "status", "updated_at"])
    return tax_year


# === Installment ==========================================================

@transaction.atomic
def create_installment(
    *, tax_year: PropertyTaxYear, user,
    installment_no: int, due_date: date | None = None,
    amount: Decimal = Decimal("0"), notes: str = "",
) -> PropertyTaxInstallment:
    if PropertyTaxInstallment.objects.filter(
        tax_year=tax_year, installment_no=installment_no
    ).exists():
        raise ValidationError(
            f"Bu yıl için {installment_no}. taksit zaten var."
        )
    due = due_date or default_installment_due_date(tax_year.tax_year, installment_no)
    obj = PropertyTaxInstallment.objects.create(
        tax_year=tax_year, installment_no=installment_no,
        due_date=due, amount=Decimal(str(amount)),
        notes=notes or "", created_by=user, updated_by=user,
    )
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Taksit oluşturuldu: {obj}",
              metadata={"tax_year_id": tax_year.pk, "no": installment_no})
    calculate_tax_year_totals(tax_year)
    return obj


@transaction.atomic
def generate_default_installments(*, tax_year: PropertyTaxYear, user) -> list[PropertyTaxInstallment]:
    """
    1. ve 2. taksiti varsayılan tarih (31.05 / 30.11) ile yarat.
    Tutar = total_accrual_amount / 2 (yarı yarıya).
    Idempotent: mevcut taksitleri atlar.
    """
    half = (tax_year.total_accrual_amount or Decimal("0")) / Decimal("2")
    created = []
    for n in (1, 2):
        if PropertyTaxInstallment.objects.filter(
            tax_year=tax_year, installment_no=n
        ).exists():
            continue
        inst = PropertyTaxInstallment.objects.create(
            tax_year=tax_year, installment_no=n,
            due_date=default_installment_due_date(tax_year.tax_year, n),
            amount=half.quantize(Decimal("0.01")),
            created_by=user, updated_by=user,
        )
        created.append(inst)
    audit_log(actor=user, action="CREATE", obj=tax_year,
              summary=f"Varsayılan taksitler üretildi: {len(created)} yeni",
              metadata={"created": len(created), "year": tax_year.tax_year})
    calculate_tax_year_totals(tax_year)
    return created


@transaction.atomic
def cancel_installment(*, installment: PropertyTaxInstallment, user, reason: str = ""):
    if installment.payable_id:
        from apps.finance.services.payments import cancel_payable, PaymentRuleError
        try:
            cancel_payable(payable=installment.payable, user=user,
                           reason=f"Taksit iptal: {reason}")
        except PaymentRuleError:
            pass
    installment.status = InstallmentStatus.CANCELLED
    installment.notes = (installment.notes or "") + f"\n[İPTAL] {reason}".strip()
    installment.updated_by = user
    installment.save(update_fields=["status", "notes", "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=installment,
              summary=f"Taksit iptal: {installment}",
              metadata={"event": "CANCEL_INSTALLMENT", "reason": reason})
    calculate_tax_year_totals(installment.tax_year)
    return installment


# === Payable bağlama ======================================================

@transaction.atomic
def create_payable_from_installment(
    *, installment: PropertyTaxInstallment, user,
    payment_method: str = "EFT", bank=None,
):
    if installment.status == InstallmentStatus.CANCELLED:
        raise ValidationError("İptal edilmiş taksitten PayableItem üretilemez.")
    if installment.amount <= 0:
        raise ValidationError("Taksit tutarı 0 — PayableItem yaratılmaz.")

    from apps.finance.services.period_link import create_payable_from_period
    pa = installment.tax_year.property_asset
    title = (
        f"Emlak Vergisi — {pa.name} — {installment.tax_year.tax_year}"
        f"/{installment.installment_no}. Taksit"
    )
    payable, created = create_payable_from_period(
        period=installment, user=user,
        title=title, category="EMLAK_VERGISI",
        period_label=str(installment.tax_year.tax_year),
        supplier_name=(installment.tax_year.municipality.name
                        if installment.tax_year.municipality_id else ""),
        payment_method=payment_method, bank=bank,
        extra_notes=(f"Property #{pa.pk} · TaxYear #{installment.tax_year.pk}"
                     f" · Installment #{installment.pk}"),
    )
    if created:
        installment.status = InstallmentStatus.LINKED
        installment.save(update_fields=["status", "updated_at"])
    return payable, created


def mark_installment_paid_from_payable(*, installment: PropertyTaxInstallment) -> PropertyTaxInstallment:
    if not installment.payable_id:
        return installment
    from apps.finance.models import PayableStatus
    if installment.payable.status == PayableStatus.PAID:
        installment.status = InstallmentStatus.PAID
        from django.utils import timezone
        installment.payment_date = timezone.localdate()
        installment.save(update_fields=["status", "payment_date", "updated_at"])
        calculate_tax_year_totals(installment.tax_year)
    return installment


# === Document =============================================================

@transaction.atomic
def attach_tax_document(
    *, user, document, document_role: str = TaxDocumentRole.OTHER,
    tax_year: PropertyTaxYear | None = None,
    installment: PropertyTaxInstallment | None = None,
) -> PropertyTaxDocument:
    if not (tax_year or installment):
        raise ValidationError("tax_year veya installment'tan en az biri zorunlu.")
    if installment and not tax_year:
        tax_year = installment.tax_year
    obj, created = PropertyTaxDocument.objects.get_or_create(
        tax_year=tax_year, installment=installment,
        document=document, document_role=document_role,
        defaults={"uploaded_by": user},
    )
    if created:
        ref = installment or tax_year
        audit_log(actor=user, action="UPDATE", obj=ref,
                  summary=f"Belge bağlandı: {document.original_filename} ({document_role})",
                  metadata={"document_id": document.pk, "role": document_role})
    return obj
