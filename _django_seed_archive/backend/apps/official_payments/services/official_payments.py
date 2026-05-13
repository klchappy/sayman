"""Official Payments servisleri."""
from datetime import date
from decimal import Decimal

from django.db import transaction

from apps.audit.services import audit_log

from ..models import (
    OfficialPaymentPeriod,
    OfficialPaymentProfile,
    OfficialPeriodSource,
    OfficialPeriodStatus,
    OfficialPeriodType,
    PaymentType,
)


@transaction.atomic
def create_profile(*, user, **kwargs) -> OfficialPaymentProfile:
    obj = OfficialPaymentProfile(**kwargs)
    obj.created_by = user
    obj.updated_by = user
    obj.save()
    audit_log(actor=user, action="CREATE", obj=obj, summary=f"Resmi ödeme profili: {obj.title}")
    return obj


@transaction.atomic
def update_profile(*, profile, user, **fields):
    changed = []
    for k, v in fields.items():
        if hasattr(profile, k) and getattr(profile, k) != v:
            setattr(profile, k, v)
            changed.append(k)
    profile.updated_by = user
    profile.save()
    audit_log(actor=user, action="UPDATE", obj=profile, summary=f"Güncellendi: {profile.title}",
              metadata={"changed": changed})
    return profile


def archive_profile(*, profile, user, reason: str = ""):
    profile.archive(actor=user, reason=reason)
    audit_log(actor=user, action="ARCHIVE", obj=profile, summary=f"Pasifleştirildi: {profile.title}")
    return profile


def restore_profile(*, profile, user):
    profile.restore(actor=user)
    audit_log(actor=user, action="RESTORE", obj=profile, summary=f"Aktifleştirildi: {profile.title}")
    return profile


@transaction.atomic
def create_period(*, profile, user, period_label: str, due_date: date,
                  amount: Decimal, installment_no=None, source=OfficialPeriodSource.MANUAL,
                  **extra) -> OfficialPaymentPeriod:
    p = OfficialPaymentPeriod.objects.create(
        profile=profile, period_label=period_label, installment_no=installment_no,
        due_date=due_date, amount=Decimal(str(amount)), source=source,
        created_by=user, **extra,
    )
    audit_log(actor=user, action="CREATE", obj=p,
              summary=f"Resmi dönem: {profile.title} · {period_label}")
    return p


def _add_months(d: date, months: int) -> date:
    import calendar
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    last_day = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last_day))


@transaction.atomic
def generate_periods(*, profile, user, year: int, count: int | None = None) -> list[OfficialPaymentPeriod]:
    """
    Belirtilen yıl için dönem üretir.

    BAGKUR/SSK/BES → MONTHLY 12 ay (`count` gözardı)
    İTO → 1 ve 2 numaralı taksit (Haziran sonu, Ekim sonu — varsayılan)
    Diğer YEARLY → 1 kayıt
    INSTALLMENT → `count` adet aylık taksit (default 12)
    """
    from datetime import date as _date

    created: list[OfficialPaymentPeriod] = []
    if profile.payment_type == PaymentType.ITO:
        # 30 Haziran + 31 Ekim varsayılan
        for ins, due in [(1, _date(year, 6, 30)), (2, _date(year, 10, 31))]:
            label = f"{year} {ins}.Tk"
            obj, was = OfficialPaymentPeriod.objects.get_or_create(
                profile=profile, period_label=label, installment_no=ins, due_date=due,
                defaults={
                    "amount": profile.default_amount or Decimal("0"),
                    "source": OfficialPeriodSource.GENERATED,
                    "created_by": user,
                },
            )
            if was:
                created.append(obj)
    elif profile.period_type in (OfficialPeriodType.MONTHLY,):
        if not profile.default_amount:
            raise ValueError("default_amount tanımsız.")
        for m in range(1, 13):
            day = profile.default_due_day or 28
            import calendar
            day = min(day, calendar.monthrange(year, m)[1])
            due = _date(year, m, day)
            label = due.strftime("%Y-%m")
            obj, was = OfficialPaymentPeriod.objects.get_or_create(
                profile=profile, period_label=label, installment_no=None, due_date=due,
                defaults={
                    "amount": profile.default_amount,
                    "source": OfficialPeriodSource.GENERATED,
                    "created_by": user,
                },
            )
            if was:
                created.append(obj)
    elif profile.period_type == OfficialPeriodType.YEARLY:
        due = _date(year, profile.default_due_day or 12, 31)
        try:
            due = _date(year, 12, profile.default_due_day or 31)
        except ValueError:
            due = _date(year, 12, 31)
        label = str(year)
        obj, was = OfficialPaymentPeriod.objects.get_or_create(
            profile=profile, period_label=label, installment_no=None, due_date=due,
            defaults={
                "amount": profile.default_amount or Decimal("0"),
                "source": OfficialPeriodSource.GENERATED,
                "created_by": user,
            },
        )
        if was:
            created.append(obj)
    elif profile.period_type == OfficialPeriodType.INSTALLMENT:
        n = count or 12
        for i in range(1, n + 1):
            due = _add_months(_date(year, 1, profile.default_due_day or 1), i - 1)
            label = f"{year} taksit"
            obj, was = OfficialPaymentPeriod.objects.get_or_create(
                profile=profile, period_label=label, installment_no=i, due_date=due,
                defaults={
                    "amount": profile.default_amount or Decimal("0"),
                    "source": OfficialPeriodSource.GENERATED,
                    "created_by": user,
                },
            )
            if was:
                created.append(obj)
    else:
        raise ValueError(f"Üretim {profile.period_type} tipinde desteklenmiyor.")

    audit_log(actor=user, action="CREATE", obj=profile,
              summary=f"{len(created)} resmi dönem üretildi · {year}",
              metadata={"created": len(created), "year": year, "type": profile.payment_type})
    return created


def calculate_period_status(period: OfficialPaymentPeriod) -> str:
    if period.payable_id:
        return OfficialPeriodStatus.LINKED
    return period.status


def create_payable_from_official_period(*, period, user, payment_method=None, bank=None):
    from apps.finance.services.period_link import create_payable_from_period
    profile = period.profile
    pm = payment_method or profile.default_payment_method
    bnk = bank or profile.default_bank
    title_extra = f" · #{period.installment_no}" if period.installment_no else ""
    payable, created = create_payable_from_period(
        period=period, user=user,
        title=f"{profile.title} · {period.period_label}{title_extra}".strip(" ·"),
        category=profile.get_payment_type_display(),
        institution=profile.institution,
        period_label=period.period_label,
        payment_method=pm, bank=bnk,
        extra_notes=f"Resmi ödeme · ref: {profile.reference_no}",
    )
    if created:
        period.status = OfficialPeriodStatus.LINKED
        period.save(update_fields=["status", "updated_at"])
    return payable, created
