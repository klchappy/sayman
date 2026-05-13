"""
Finance servisleri — Anayasa Madde 3.3-3.5 + tutar eşikleri (D-008/D-011/D-021).

Eşikler `settings.PAYMENT_DEKONT_REQUIRED_THRESHOLD` (5.000 TL) ve
`settings.PAYMENT_DOUBLE_APPROVAL_THRESHOLD` (50.000 TL) — Faz 4'te
constant; ileride `SystemSetting` modeline geçirilecek.
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import audit_log

from ..models import (
    DocumentRole,
    PayableDocument,
    PayableItem,
    PayableStatus,
    PaymentMethod,
    PaymentTransaction,
    TransactionStatus,
)


# === EŞİK YARDIMCI ==========================================================

def requires_receipt(amount: Decimal | float | int) -> bool:
    """Önce SystemSetting, yoksa Django settings constant fallback."""
    from apps.core.models import get_setting
    threshold = get_setting(
        "PAYMENT_DEKONT_REQUIRED_THRESHOLD",
        default=settings.PAYMENT_DEKONT_REQUIRED_THRESHOLD,
        value_type="DECIMAL",
    )
    return Decimal(str(amount)) >= Decimal(str(threshold))


def requires_double_approval(amount: Decimal | float | int) -> bool:
    from apps.core.models import get_setting
    threshold = get_setting(
        "PAYMENT_DOUBLE_APPROVAL_THRESHOLD",
        default=settings.PAYMENT_DOUBLE_APPROVAL_THRESHOLD,
        value_type="DECIMAL",
    )
    return Decimal(str(amount)) >= Decimal(str(threshold))


# === STATUS HESAPLAMA ======================================================

def calculate_payable_status(payable: PayableItem) -> str:
    """
    Tutar/ödeme/tarih durumuna göre status döner.
    İptal/Arşiv/Taslak/WAITING_APPROVAL gibi manuel durumları DEĞİŞTİRMEZ.
    """
    if payable.status in (
        PayableStatus.CANCELLED,
        PayableStatus.ARCHIVED,
        PayableStatus.DRAFT,
        PayableStatus.WAITING_APPROVAL,
        PayableStatus.NEEDS_REVIEW,
    ):
        return payable.status

    paid = payable.amount_paid or Decimal("0")
    amount = payable.amount or Decimal("0")

    if paid >= amount and amount > 0:
        return PayableStatus.PAID
    if Decimal("0") < paid < amount:
        return PayableStatus.PARTIAL_PAID

    today = timezone.localdate()
    days_left = (payable.due_date - today).days
    if days_left < 0:
        return PayableStatus.OVERDUE
    if days_left <= 7:
        return PayableStatus.APPROACHING
    return PayableStatus.PENDING


def refresh_status(payable: PayableItem) -> PayableItem:
    new_status = calculate_payable_status(payable)
    if new_status != payable.status:
        payable.status = new_status
        payable.save(update_fields=["status", "updated_at"])
    return payable


# === CRUD ===================================================================

@transaction.atomic
def create_payable(*, user, **kwargs) -> PayableItem:
    """Yeni PayableItem yarat + eşik flag'lerini set et + audit."""
    payable = PayableItem(**kwargs)
    payable.created_by = user
    payable.updated_by = user
    payable.requires_receipt = requires_receipt(payable.amount)
    payable.requires_double_approval = requires_double_approval(payable.amount)
    if payable.requires_double_approval and payable.status == PayableStatus.PENDING:
        # Yüksek tutar — initial status WAITING_APPROVAL'a çekilmez (kayıt henüz ödenmemiş);
        # Faz 4'te sadece "ödeme işaretleme" sırasında WAITING_APPROVAL'a düşer.
        pass
    payable.status = calculate_payable_status(payable) if payable.status == PayableStatus.PENDING else payable.status
    payable.save()
    audit_log(
        actor=user, action="CREATE", obj=payable,
        summary=f"Fatura/Ödeme yaratıldı: {payable.title}",
        metadata={
            "amount": str(payable.amount),
            "due_date": str(payable.due_date),
            "requires_receipt": payable.requires_receipt,
            "requires_double_approval": payable.requires_double_approval,
        },
    )
    return payable


@transaction.atomic
def update_payable(*, payable: PayableItem, user, **fields) -> PayableItem:
    changed = []
    for k, v in fields.items():
        if hasattr(payable, k) and getattr(payable, k) != v:
            setattr(payable, k, v)
            changed.append(k)
    payable.updated_by = user
    # Eşik flag'leri yeniden hesapla (tutar değişmiş olabilir)
    payable.requires_receipt = requires_receipt(payable.amount)
    payable.requires_double_approval = requires_double_approval(payable.amount)
    payable.save()
    refresh_status(payable)
    audit_log(
        actor=user, action="UPDATE", obj=payable,
        summary=f"Güncellendi: {payable.title}",
        metadata={"changed_fields": changed},
    )
    return payable


def archive_payable(*, payable: PayableItem, user, reason: str = "") -> PayableItem:
    payable.archive(actor=user, reason=reason)
    payable.status = PayableStatus.ARCHIVED
    payable.save(update_fields=["status", "updated_at"])
    audit_log(
        actor=user, action="ARCHIVE", obj=payable,
        summary=f"Pasifleştirildi: {payable.title}",
        metadata={"reason": reason},
    )
    return payable


def restore_payable(*, payable: PayableItem, user) -> PayableItem:
    payable.restore(actor=user)
    refresh_status(payable)
    audit_log(actor=user, action="RESTORE", obj=payable, summary=f"Aktifleştirildi: {payable.title}")
    return payable


@transaction.atomic
def cancel_payable(*, payable: PayableItem, user, reason: str = "") -> PayableItem:
    """
    PayableItem iptal — Faz 6 W-1 patch (SEED_AND_LIFECYCLE_POLICY 6.5).

    - status = CANCELLED (soft state).
    - is_active KORUNUR (tarihçe için), archive_reason'a sebep yazılmaz; reason `notes` alanına eklenir.
    - Aktif PENDING_APPROVAL transaction varsa block (önce reject/approve gerekir).
    - mark_paid/add_partial_payment iptal sonrası block edilir (state guard).
    - AuditLog UPDATE (action="UPDATE", summary=CANCEL...).
    """
    if payable.status == PayableStatus.CANCELLED:
        return payable
    if payable.status == PayableStatus.PAID:
        raise PaymentRuleError("Tamamen ödenmiş bir kayıt iptal edilemez (önce arşivle).")

    pending = payable.transactions.filter(status=TransactionStatus.PENDING_APPROVAL).exists()
    if pending:
        raise PaymentRuleError(
            "Onay bekleyen ödeme hareketi var. Önce reddedin/onaylayın, sonra iptal edin."
        )

    payable.status = PayableStatus.CANCELLED
    if reason:
        payable.notes = (payable.notes or "") + f"\n[İPTAL] {reason}".strip()
    payable.updated_by = user
    payable.save(update_fields=["status", "notes", "updated_by", "updated_at"])

    audit_log(
        actor=user, action="UPDATE", obj=payable,
        summary=f"İptal edildi: {payable.title}",
        metadata={"event": "CANCEL_PAYABLE", "reason": reason, "previous_status": str(payable.status)},
    )
    return payable


# === BELGE EKLEME ==========================================================

@transaction.atomic
def attach_document(
    *, payable: PayableItem, document, user, document_role: str = DocumentRole.INVOICE,
) -> PayableDocument:
    pd, created = PayableDocument.objects.get_or_create(
        payable=payable, document=document, document_role=document_role,
        defaults={"uploaded_by": user},
    )
    if created:
        audit_log(
            actor=user, action="UPDATE", obj=payable,
            summary=f"Belge bağlandı: {document.original_filename} ({document_role})",
            metadata={"document_id": document.pk, "role": document_role},
        )
    # Status güncelle (dekont eklendiyse durum değişebilir)
    refresh_status(payable)
    return pd


# === ÖDEME İŞARETLEME ======================================================

class PaymentRuleError(ValidationError):
    """Eşik kuralı/dekont kuralı ihlali."""


@transaction.atomic
def add_partial_payment(
    *,
    payable: PayableItem,
    user,
    amount: Decimal,
    payment_date,
    payment_method: str = PaymentMethod.EFT,
    bank=None,
    receipt_document=None,
    note: str = "",
) -> PaymentTransaction:
    """
    Kısmi/tam ödeme hareketi yarat.

    Kurallar:
    - Toplam tutar (`amount`) `payable.amount` üzerinde olamaz.
    - >= 5.000 TL ise dekont zorunlu (kayıt başına değil, her transaction için kontrol).
    - >= 50.000 TL ise direkt APPROVED olmaz; PENDING_APPROVAL olur ve
      `payable.status = WAITING_APPROVAL` çekilir.
    """
    amount = Decimal(str(amount))
    if amount <= 0:
        raise PaymentRuleError("Tutar 0'dan büyük olmalı.")

    if payable.status in (PayableStatus.CANCELLED, PayableStatus.ARCHIVED):
        raise PaymentRuleError(
            f"İptal/arşiv edilmiş kayda ödeme eklenemez (durum: {payable.get_status_display()})."
        )

    new_total = (payable.amount_paid or Decimal("0")) + amount
    if new_total > payable.amount:
        raise PaymentRuleError(
            f"Toplam ödeme ({new_total}) fatura tutarını ({payable.amount}) aşamaz."
        )

    # Dekont zorunluluğu (5.000 TL üzeri ödeme için)
    if requires_receipt(amount) and not receipt_document:
        raise PaymentRuleError(
            f"Tutar {amount} TL ≥ {settings.PAYMENT_DEKONT_REQUIRED_THRESHOLD} TL — "
            "dekont yüklemesi zorunlu."
        )

    # Çift onay (50.000 TL üzeri)
    needs_approval = requires_double_approval(amount)
    tx_status = TransactionStatus.PENDING_APPROVAL if needs_approval else TransactionStatus.APPROVED

    tx = PaymentTransaction.objects.create(
        payable=payable,
        payment_date=payment_date,
        amount=amount,
        payment_method=payment_method,
        bank=bank,
        status=tx_status,
        receipt_document=receipt_document,
        note=note,
        created_by=user,
        approved_by=user if not needs_approval else None,
        approved_at=timezone.now() if not needs_approval else None,
    )

    if needs_approval:
        # Payable status WAITING_APPROVAL'a çekilir; amount_paid değişmez (henüz onaylı değil)
        payable.status = PayableStatus.WAITING_APPROVAL
        payable.save(update_fields=["status", "updated_at"])
    else:
        # Onaylı transaction → amount_paid güncelle + status hesapla
        payable.amount_paid = (payable.amount_paid or Decimal("0")) + amount
        payable.save(update_fields=["amount_paid", "updated_at"])
        refresh_status(payable)

    audit_log(
        actor=user, action="UPDATE", obj=payable,
        summary=(
            f"Ödeme {'onay bekliyor' if needs_approval else 'kaydedildi'}: "
            f"{amount} TL ({payment_method})"
        ),
        metadata={
            "transaction_id": tx.pk,
            "amount": str(amount),
            "method": payment_method,
            "needs_approval": needs_approval,
            "receipt_document_id": receipt_document.pk if receipt_document else None,
        },
    )
    return tx


def mark_paid(
    *,
    payable: PayableItem,
    user,
    payment_date=None,
    payment_method: str = PaymentMethod.EFT,
    bank=None,
    receipt_document=None,
    note: str = "",
) -> PaymentTransaction:
    """Tam ödeme: kalan miktarı tek transaction olarak işaretle."""
    payment_date = payment_date or timezone.localdate()
    remaining = payable.remaining_amount
    if remaining <= 0:
        raise PaymentRuleError("Bu kayıt zaten tamamen ödenmiş.")
    return add_partial_payment(
        payable=payable, user=user, amount=remaining,
        payment_date=payment_date, payment_method=payment_method,
        bank=bank, receipt_document=receipt_document, note=note,
    )


# === TRANSACTION ONAY ======================================================

def _can_approve_payment(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.groups.filter(name__in=["super_admin", "yonetici", "muhasebe_muduru"]).exists()


@transaction.atomic
def approve_payment_transaction(*, tx: PaymentTransaction, user) -> PaymentTransaction:
    if tx.status != TransactionStatus.PENDING_APPROVAL:
        raise PaymentRuleError(f"Transaction durumu uygun değil: {tx.status}")
    if not _can_approve_payment(user):
        raise PaymentRuleError("Onaylama yetkiniz yok.")

    tx.status = TransactionStatus.APPROVED
    tx.approved_by = user
    tx.approved_at = timezone.now()
    tx.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    payable = tx.payable
    payable.amount_paid = (payable.amount_paid or Decimal("0")) + tx.amount
    # Eğer başka pending tx kalmadıysa WAITING_APPROVAL state'ini temizle
    other_pending = payable.transactions.filter(
        status=TransactionStatus.PENDING_APPROVAL,
    ).exclude(pk=tx.pk).exists()
    if not other_pending and payable.status == PayableStatus.WAITING_APPROVAL:
        payable.status = PayableStatus.PENDING  # refresh_status sonra hesaplar
    payable.save(update_fields=["amount_paid", "status", "updated_at"])
    refresh_status(payable)

    audit_log(
        actor=user, action="UPDATE", obj=payable,
        summary=f"Yüksek tutar ödeme onaylandı: {tx.amount} TL",
        metadata={"transaction_id": tx.pk, "approved_by": user.username},
    )
    return tx


@transaction.atomic
def reject_payment_transaction(
    *, tx: PaymentTransaction, user, reason: str = ""
) -> PaymentTransaction:
    if tx.status != TransactionStatus.PENDING_APPROVAL:
        raise PaymentRuleError(f"Transaction durumu uygun değil: {tx.status}")
    if not _can_approve_payment(user):
        raise PaymentRuleError("Reddetme yetkiniz yok.")

    tx.status = TransactionStatus.REJECTED
    tx.note = (tx.note + f"\n[REDDEDİLDİ] {reason}").strip()
    tx.save(update_fields=["status", "note", "updated_at"])

    payable = tx.payable
    # Diğer pending tx yoksa WAITING_APPROVAL'ı temizle ve status'ü yeniden hesapla
    if not payable.transactions.filter(status=TransactionStatus.PENDING_APPROVAL).exists():
        if payable.status == PayableStatus.WAITING_APPROVAL:
            payable.status = PayableStatus.PENDING
            payable.save(update_fields=["status", "updated_at"])
            refresh_status(payable)

    audit_log(
        actor=user, action="UPDATE", obj=payable,
        summary=f"Yüksek tutar ödeme reddedildi: {tx.amount} TL",
        metadata={"transaction_id": tx.pk, "reason": reason},
    )
    return tx
