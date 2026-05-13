"""
Entegratör/Yazılım Hizmeti & Kontör servisleri — Faz 9 Manual MVP.

Lifecycle: create/update/archive/restore/cancel/renew/cancel.
Kontör: kullanım azalt → CRITICAL/EXHAUSTED otomatik.
PayableItem: contract veya package üzerinden tek seferlik bağ.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import audit_log

from ..models import (
    ContractStatus, CreditPackage, CreditPackageStatus, IntegratorDocument,
    IntegratorDocumentRole, ServiceContract, ServiceStatus, SoftwareService,
)


# === SoftwareService lifecycle ============================================

@transaction.atomic
def create_service(*, user, **kwargs) -> SoftwareService:
    obj = SoftwareService.objects.create(created_by=user, updated_by=user, **kwargs)
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Hizmet oluşturuldu: {obj.provider_name} · {obj.title}",
              metadata={"provider_type": obj.provider_type,
                        "service_type": obj.service_type})
    return obj


@transaction.atomic
def update_service(*, service: SoftwareService, user, **fields) -> SoftwareService:
    if service.status in (ServiceStatus.CANCELLED, ServiceStatus.RENEWED):
        allowed = {"notes"}
        if not set(fields).issubset(allowed):
            raise ValidationError(
                "Kapanmış hizmet (CANCELLED/RENEWED) yalnız notes ile güncellenebilir."
            )
    changed = []
    for k, v in fields.items():
        if hasattr(service, k) and getattr(service, k) != v:
            setattr(service, k, v)
            changed.append(k)
    service.updated_by = user
    service.save()
    audit_log(actor=user, action="UPDATE", obj=service,
              summary=f"Hizmet güncellendi: {service.provider_name}",
              metadata={"changed": changed})
    return service


@transaction.atomic
def archive_service(*, service: SoftwareService, user, reason: str = ""):
    service.archive(actor=user, reason=reason)
    audit_log(actor=user, action="ARCHIVE", obj=service,
              summary=f"Hizmet arşivlendi: {service.provider_name}",
              metadata={"reason": reason})
    return service


@transaction.atomic
def restore_service(*, service: SoftwareService, user):
    service.restore(actor=user)
    audit_log(actor=user, action="RESTORE", obj=service,
              summary=f"Hizmet geri alındı: {service.provider_name}")
    return service


@transaction.atomic
def cancel_service(*, service: SoftwareService, user, reason: str = ""):
    if service.status == ServiceStatus.CANCELLED:
        return service
    service.status = ServiceStatus.CANCELLED
    service.notes = (service.notes or "") + f"\n[İPTAL] {reason}".strip()
    service.updated_by = user
    service.save(update_fields=["status", "notes", "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=service,
              summary=f"Hizmet iptal: {service.provider_name}",
              metadata={"event": "CANCEL_SERVICE", "reason": reason})
    return service


# === ServiceContract ======================================================

@transaction.atomic
def create_contract(*, service: SoftwareService, user, **kwargs) -> ServiceContract:
    if service.status in (ServiceStatus.CANCELLED, ServiceStatus.PASSIVE):
        raise ValidationError(
            "Pasif/iptal hizmet için yeni sözleşme oluşturulamaz."
        )
    obj = ServiceContract.objects.create(
        service=service, created_by=user, updated_by=user, **kwargs
    )
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Sözleşme oluşturuldu: {obj.title}",
              metadata={"service_id": service.pk, "type": obj.contract_type,
                        "amount": str(obj.amount or 0)})
    return obj


@transaction.atomic
def update_contract(*, contract: ServiceContract, user, **fields) -> ServiceContract:
    if contract.status in (ContractStatus.CANCELLED, ContractStatus.RENEWED):
        allowed = {"notes"}
        if not set(fields).issubset(allowed):
            raise ValidationError(
                "Kapanmış sözleşme (CANCELLED/RENEWED) yalnız notes ile güncellenebilir."
            )
    changed = []
    for k, v in fields.items():
        if hasattr(contract, k) and getattr(contract, k) != v:
            setattr(contract, k, v)
            changed.append(k)
    contract.updated_by = user
    contract.save()
    audit_log(actor=user, action="UPDATE", obj=contract,
              summary=f"Sözleşme güncellendi: {contract.title}",
              metadata={"changed": changed})
    return contract


@transaction.atomic
def cancel_contract(*, contract: ServiceContract, user, reason: str = ""):
    if contract.status == ContractStatus.CANCELLED:
        return contract
    if contract.payable_id:
        from apps.finance.services.payments import cancel_payable, PaymentRuleError
        try:
            cancel_payable(payable=contract.payable, user=user,
                           reason=f"Sözleşme iptal: {reason}")
        except PaymentRuleError:
            pass
    contract.status = ContractStatus.CANCELLED
    contract.notes = (contract.notes or "") + f"\n[İPTAL] {reason}".strip()
    contract.updated_by = user
    contract.save(update_fields=["status", "notes", "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=contract,
              summary=f"Sözleşme iptal: {contract.title}",
              metadata={"event": "CANCEL_CONTRACT", "reason": reason})
    return contract


@transaction.atomic
def renew_contract(*, old: ServiceContract, user, **new_kwargs) -> ServiceContract:
    """Eski sözleşme → yeni. Eski status=RENEWED."""
    if old.status in (ContractStatus.CANCELLED, ContractStatus.RENEWED):
        raise ValidationError("Bu sözleşme zaten kapalı; yenileme yapılamaz.")
    new = ServiceContract.objects.create(
        service=old.service, renewed_from=old,
        created_by=user, updated_by=user, **new_kwargs,
    )
    old.status = ContractStatus.RENEWED
    old.renewed_to = new
    old.updated_by = user
    old.save(update_fields=["status", "renewed_to", "updated_by", "updated_at"])
    audit_log(actor=user, action="CREATE", obj=new,
              summary=f"Sözleşme yenileme: {old.title} → {new.title}",
              metadata={"event": "RENEW_CONTRACT", "old_id": old.pk})
    audit_log(actor=user, action="UPDATE", obj=old,
              summary=f"Sözleşme yenilendi: {old.title}",
              metadata={"event": "RENEWED_BY", "new_id": new.pk})
    return new


def calculate_contract_status(contract: ServiceContract, *, today: date | None = None) -> str:
    """Bilgi: end_date/renewal_date'a göre önerilen status."""
    if contract.status in (ContractStatus.CANCELLED, ContractStatus.RENEWED,
                            ContractStatus.NEEDS_REVIEW):
        return contract.status
    today = today or timezone.localdate()
    target = contract.renewal_date or contract.end_date
    if target:
        if target < today:
            return ContractStatus.EXPIRED
        if target <= today + timedelta(days=30):
            return ContractStatus.APPROACHING
    return ContractStatus.ACTIVE


# === CreditPackage ========================================================

@transaction.atomic
def create_credit_package(*, service: SoftwareService, user, **kwargs) -> CreditPackage:
    if service.status in (ServiceStatus.CANCELLED, ServiceStatus.PASSIVE):
        raise ValidationError(
            "Pasif/iptal hizmet için yeni kontör paketi oluşturulamaz."
        )
    if "remaining_credits" not in kwargs and "total_credits" in kwargs:
        kwargs["remaining_credits"] = kwargs["total_credits"]
    obj = CreditPackage.objects.create(
        service=service, created_by=user, updated_by=user, **kwargs,
    )
    obj.status = calculate_credit_status(obj)
    obj.save(update_fields=["status"])
    audit_log(actor=user, action="CREATE", obj=obj,
              summary=f"Kontör paketi: {obj.package_name} · {obj.total_credits}",
              metadata={"service_id": service.pk,
                        "total": obj.total_credits,
                        "remaining": obj.remaining_credits})
    return obj


@transaction.atomic
def update_credit_usage(*, package: CreditPackage, user,
                        remaining_credits: int, notes: str = "") -> CreditPackage:
    """Kalan kontörü manuel günceller; status'u CRITICAL/EXHAUSTED'e geçirir."""
    if package.status == CreditPackageStatus.CANCELLED:
        raise ValidationError("İptal edilmiş kontör paketi güncellenemez.")
    if remaining_credits < 0:
        raise ValidationError("Kalan kontör 0'dan küçük olamaz.")
    if remaining_credits > package.total_credits:
        raise ValidationError("Kalan kontör toplamdan büyük olamaz.")
    old = package.remaining_credits
    package.remaining_credits = remaining_credits
    if notes:
        package.notes = (package.notes or "") + f"\n[KULLANIM] {notes}".strip()
    package.status = calculate_credit_status(package)
    package.updated_by = user
    package.save(update_fields=["remaining_credits", "notes", "status",
                                  "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=package,
              summary=f"Kontör kullanım: {old} → {remaining_credits}",
              metadata={"event": "UPDATE_CREDIT_USAGE",
                        "old_remaining": old, "new_remaining": remaining_credits,
                        "status": package.status})
    return package


@transaction.atomic
def cancel_credit_package(*, package: CreditPackage, user, reason: str = ""):
    if package.status == CreditPackageStatus.CANCELLED:
        return package
    if package.payable_id:
        from apps.finance.services.payments import cancel_payable, PaymentRuleError
        try:
            cancel_payable(payable=package.payable, user=user,
                           reason=f"Kontör paketi iptal: {reason}")
        except PaymentRuleError:
            pass
    package.status = CreditPackageStatus.CANCELLED
    package.notes = (package.notes or "") + f"\n[İPTAL] {reason}".strip()
    package.updated_by = user
    package.save(update_fields=["status", "notes", "updated_by", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=package,
              summary=f"Kontör paketi iptal: {package.package_name}",
              metadata={"event": "CANCEL_CREDIT", "reason": reason})
    return package


def calculate_credit_status(package: CreditPackage) -> str:
    if package.status == CreditPackageStatus.CANCELLED:
        return CreditPackageStatus.CANCELLED
    if package.remaining_credits <= 0:
        return CreditPackageStatus.EXHAUSTED
    if package.remaining_credits <= package.critical_threshold:
        return CreditPackageStatus.CRITICAL
    return CreditPackageStatus.ACTIVE


# === Payable bağlama ======================================================

@transaction.atomic
def create_payable_from_contract(*, contract: ServiceContract, user,
                                   payment_method: str = "EFT"):
    if contract.status == ContractStatus.CANCELLED:
        raise ValidationError("İptal edilmiş sözleşmeden PayableItem üretilemez.")
    if not contract.amount or contract.amount <= 0:
        raise ValidationError("Sözleşme tutarı 0/boş — PayableItem yaratılmaz.")

    from apps.finance.services.period_link import create_payable_from_period
    s = contract.service
    title = f"Entegratör Sözleşme — {s.title} — {contract.title}"
    label = ""
    if contract.start_date:
        label = str(contract.start_date.year)
    payable, created = create_payable_from_period(
        period=contract, user=user,
        title=title, category="INTEGRATOR_CONTRACT",
        period_label=label,
        supplier_name=s.provider_name,
        payment_method=payment_method,
        extra_notes=(f"Service #{s.pk} · provider={s.provider_name}"
                     f" · contract #{contract.pk}"),
    )
    if created:
        # period_link "LINKED" yazar; bu modelde ContractStatus.ACTIVE bırakılabilir
        # ama LINKED rule yok — explicit ACTIVE kalır. period_link generic save()
        # yapar; status'u biz koruyoruz.
        # Status koruma:
        contract.refresh_from_db()
        if contract.status == "LINKED":
            contract.status = ContractStatus.ACTIVE
            contract.save(update_fields=["status", "updated_at"])
    return payable, created


@transaction.atomic
def create_payable_from_credit_package(*, package: CreditPackage, user,
                                         payment_method: str = "EFT"):
    if package.status == CreditPackageStatus.CANCELLED:
        raise ValidationError("İptal edilmiş kontör paketinden PayableItem üretilemez.")
    if not package.amount or package.amount <= 0:
        raise ValidationError("Kontör paketi tutarı 0/boş — PayableItem yaratılmaz.")

    from apps.finance.services.period_link import create_payable_from_period
    s = package.service
    title = f"Kontör Paketi — {s.title} — {package.package_name}"
    label = str(package.purchase_date.year) if package.purchase_date else ""
    payable, created = create_payable_from_period(
        period=package, user=user,
        title=title, category="CREDIT_PACKAGE",
        period_label=label,
        supplier_name=s.provider_name,
        payment_method=payment_method,
        extra_notes=(f"Service #{s.pk} · provider={s.provider_name}"
                     f" · package #{package.pk} · total={package.total_credits}"),
    )
    if created:
        package.refresh_from_db()
        if package.status == "LINKED":
            # restore real domain status
            package.status = calculate_credit_status(package)
            package.save(update_fields=["status", "updated_at"])
    return payable, created


# === Document =============================================================

@transaction.atomic
def attach_integrator_document(
    *, user, document, document_role: str = IntegratorDocumentRole.OTHER,
    service: SoftwareService | None = None,
    contract: ServiceContract | None = None,
    credit_package: CreditPackage | None = None,
) -> IntegratorDocument:
    if not (service or contract or credit_package):
        raise ValidationError("service, contract veya credit_package zorunlu.")
    if contract and not service:
        service = contract.service
    if credit_package and not service:
        service = credit_package.service
    obj, created = IntegratorDocument.objects.get_or_create(
        service=service, contract=contract, credit_package=credit_package,
        document=document, document_role=document_role,
        defaults={"uploaded_by": user},
    )
    if created:
        ref = credit_package or contract or service
        audit_log(actor=user, action="UPDATE", obj=ref,
                  summary=f"Belge bağlandı: {document.original_filename} ({document_role})",
                  metadata={"document_id": document.pk, "role": document_role})
    return obj
