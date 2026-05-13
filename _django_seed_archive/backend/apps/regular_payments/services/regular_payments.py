"""Regular Payments servisleri."""
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.audit.services import audit_log

from ..models import (
    PeriodStatus,
    PeriodSource,
    PeriodType,
    RegularPaymentPeriod,
    RegularPaymentProfile,
)


@transaction.atomic
def create_profile(*, user, **kwargs) -> RegularPaymentProfile:
    obj = RegularPaymentProfile(**kwargs)
    obj.created_by = user
    obj.updated_by = user
    obj.save()
    audit_log(actor=user, action="CREATE", obj=obj, summary=f"Düzenli ödeme profili: {obj.title}")
    return obj


@transaction.atomic
def update_profile(*, profile, user, **fields) -> RegularPaymentProfile:
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
                  amount: Decimal, source=PeriodSource.MANUAL, **extra) -> RegularPaymentPeriod:
    p = RegularPaymentPeriod.objects.create(
        profile=profile, period_label=period_label, due_date=due_date,
        amount=Decimal(str(amount)), source=source, created_by=user, **extra,
    )
    audit_log(actor=user, action="CREATE", obj=p,
              summary=f"Dönem: {profile.title} · {period_label}")
    return p


def _add_months(d: date, months: int) -> date:
    """Gün sayısı taşmasını ay sınırına çekerek aylık ekleme."""
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    # Ay sonuna sığmıyorsa: gün sayısını ay max'ına çek
    import calendar
    last_day = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last_day))


@transaction.atomic
def generate_next_periods(*, profile, user, months: int = 12) -> list[RegularPaymentPeriod]:
    """
    `months` adet (default 12) ileriye yönelik dönem üretir.
    Idempotent: aynı (profile, period_label, due_date) varsa atlar.
    """
    if not profile.default_amount:
        raise ValueError("Profil 'default_amount' tanımlanmamış.")
    if profile.period_type not in (PeriodType.MONTHLY, PeriodType.QUARTERLY,
                                   PeriodType.SEMI_ANNUAL, PeriodType.YEARLY):
        raise ValueError(f"Toplu üretim {profile.period_type} tipinde desteklenmiyor.")

    step = {
        PeriodType.MONTHLY: 1,
        PeriodType.QUARTERLY: 3,
        PeriodType.SEMI_ANNUAL: 6,
        PeriodType.YEARLY: 12,
    }[profile.period_type]

    today = timezone.localdate()
    base_day = profile.default_due_day or today.day
    # İlk due_date: bu ay (eğer base_day geçmemişse) yoksa sonraki periyot
    first = profile.start_date or today
    base = first.replace(day=min(base_day, 28))  # 28 ile güvenli başla
    # Bugünün öncesindeyse bir periyot ileri
    while base < today:
        base = _add_months(base, step)

    created: list[RegularPaymentPeriod] = []
    for i in range(months // step if step > 0 else months):
        due = _add_months(base, i * step)
        label = due.strftime("%Y-%m")
        period, was_created = RegularPaymentPeriod.objects.get_or_create(
            profile=profile, period_label=label, due_date=due,
            defaults={
                "amount": profile.default_amount,
                "source": PeriodSource.GENERATED,
                "created_by": user,
            },
        )
        if was_created:
            created.append(period)

    audit_log(actor=user, action="CREATE", obj=profile,
              summary=f"{len(created)} dönem üretildi (toplam isteme {months} ay)",
              metadata={"created": len(created), "months": months, "step": step})
    return created


def calculate_period_status(period: RegularPaymentPeriod) -> str:
    if period.payable_id:
        return PeriodStatus.LINKED
    return period.status


def create_payable_from_regular_period(*, period, user, payment_method=None, bank=None):
    from apps.finance.services.period_link import create_payable_from_period
    profile = period.profile
    pm = payment_method or profile.default_payment_method
    bnk = bank or profile.default_bank
    payable, created = create_payable_from_period(
        period=period, user=user,
        title=f"{profile.title} · {period.period_label}".strip(" ·"),
        category=profile.get_category_display(),
        institution=profile.institution,
        period_label=period.period_label,
        supplier_name=profile.supplier_name,
        payment_method=pm, bank=bnk,
        extra_notes=f"Düzenli ödeme profili #{profile.pk}",
    )
    if created:
        period.status = PeriodStatus.LINKED
        period.save(update_fields=["status", "updated_at"])
    return payable, created
