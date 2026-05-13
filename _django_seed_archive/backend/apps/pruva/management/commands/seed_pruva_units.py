"""
seed_pruva_units — SiteX başlangıç dairelerini idempotent oluşturur.

SEED_AND_LIFECYCLE_POLICY §2: Bu komut SADECE başlangıç master kayıtlarını
yaratır. Sistem bu 5 daireyle SINIRLI DEĞİLDİR — kullanıcı arayüzden
yeni daire ekleyebilir. Seed kayıtları silinebilir, deaktif edilebilir.

Hiçbir iş kuralı / hesaplama bu kodlara hardcode bağlanmamıştır.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.audit.services import audit_log
from apps.pruva.models import PruvaUnit, UnitStatus, UnitOwnerType


# Yalnızca master seed listesi — iş kuralı değil.
SEED_UNITS = [
    {"code": "A4.17", "block": "A4", "unit_no": "17"},
    {"code": "A4.22", "block": "A4", "unit_no": "22"},
    {"code": "A4.25", "block": "A4", "unit_no": "25"},
    {"code": "B2.28", "block": "B2", "unit_no": "28"},
    {"code": "B3.31", "block": "B3", "unit_no": "31"},
]


class Command(BaseCommand):
    help = "SiteX başlangıç 5 dairesini idempotent oluşturur."

    def add_arguments(self, parser):
        parser.add_argument("--quiet", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        quiet = options["quiet"]
        created_count = 0
        for spec in SEED_UNITS:
            obj, created = PruvaUnit.objects.get_or_create(
                code=spec["code"],
                defaults={
                    "block": spec["block"],
                    "unit_no": spec["unit_no"],
                    "owner_type": UnitOwnerType.PERSON,
                    "default_due_day": 20,
                    "status": UnitStatus.ACTIVE,
                },
            )
            if created:
                created_count += 1
                if not quiet:
                    self.stdout.write(self.style.SUCCESS(f"  [+] {obj.code}"))
            else:
                if not quiet:
                    self.stdout.write(f"  [.] {obj.code} (mevcut)")

        audit_log(
            actor=None, action="SEED",
            summary=f"seed_pruva_units · {created_count} yeni · toplam {len(SEED_UNITS)} master",
            metadata={"codes": [s["code"] for s in SEED_UNITS], "new": created_count},
        )

        if not quiet:
            self.stdout.write(self.style.SUCCESS(
                f"\nseed_pruva_units tamamlandi. {created_count} yeni daire."
            ))
