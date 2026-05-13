"""
seed_settings — SystemSetting varsayılanlarını idempotent olarak oluşturur.

Faz 6 W-2 patch · SEED_AND_LIFECYCLE_POLICY §2.

- Mevcut aktif setting overwrite EDİLMEZ; sadece eksik olanlar oluşturulur.
- Idempotent (her çağrıda güvenli).
- AuditLog SEED yazar.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.audit.services import audit_log
from apps.core.models import SystemSetting, SystemSettingValueType


# Sistem varsayılanları — `key`, `value`, `value_type`, `description`
DEFAULTS = [
    (
        "PAYMENT_DEKONT_REQUIRED_THRESHOLD",
        "5000",
        SystemSettingValueType.DECIMAL,
        "Bu tutar (TL) ve üstü ödemelerde dekont yüklemesi zorunlu.",
    ),
    (
        "PAYMENT_DOUBLE_APPROVAL_THRESHOLD",
        "50000",
        SystemSettingValueType.DECIMAL,
        "Bu tutar (TL) ve üstü ödemelerde çift onay zorunlu.",
    ),
    (
        "DEFAULT_CURRENCY",
        "TRY",
        SystemSettingValueType.STRING,
        "Sistem genel para birimi.",
    ),
]


class Command(BaseCommand):
    help = "SystemSetting varsayılanlarını idempotent olarak oluşturur. Audit'lenir."

    def add_arguments(self, parser):
        parser.add_argument("--quiet", action="store_true", help="Daha az output.")

    @transaction.atomic
    def handle(self, *args, **options):
        quiet = options["quiet"]
        created_count = 0
        existing_count = 0
        for key, value, vtype, description in DEFAULTS:
            obj, created = SystemSetting.objects.get_or_create(
                key=key,
                defaults={
                    "value": value,
                    "value_type": vtype,
                    "description": description,
                    "is_active": True,
                },
            )
            if created:
                created_count += 1
                if not quiet:
                    self.stdout.write(self.style.SUCCESS(f"  [+] {key} = {value} ({vtype})"))
            else:
                existing_count += 1
                if not quiet:
                    self.stdout.write(f"  [.] {key} (mevcut, korundu)")

        audit_log(
            actor=None,
            action="SEED",
            summary=f"seed_settings · {created_count} yeni · {existing_count} korundu",
            metadata={
                "keys": [k for k, *_ in DEFAULTS],
                "new": created_count,
                "preserved": existing_count,
            },
        )

        if not quiet:
            self.stdout.write(self.style.SUCCESS(
                f"\nseed_settings tamamlandi. {created_count} yeni, {existing_count} korundu."
            ))
