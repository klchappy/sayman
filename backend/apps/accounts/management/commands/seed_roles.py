"""
seed_roles management command — idempotent rol/grup tohumlaması.

Anayasa Madde 4 + PHASE1_PERMISSION_AUTH_PLAN.md.
"""
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.roles import ROLES
from apps.audit.services import audit_log


class Command(BaseCommand):
    help = "6 rol/grubu yaratır (idempotent). Audit'lenir."

    def add_arguments(self, parser):
        parser.add_argument("--quiet", action="store_true", help="Daha az output.")

    @transaction.atomic
    def handle(self, *args, **options):
        quiet = options["quiet"]
        created_count = 0
        for spec in ROLES:
            grp, created = Group.objects.get_or_create(name=spec.code)
            if created:
                created_count += 1
                if not quiet:
                    self.stdout.write(self.style.SUCCESS(f"  [+] {spec.code} ({spec.name})"))
            else:
                if not quiet:
                    self.stdout.write(f"  [.] {spec.code} (mevcut)")

        # Audit (sistem aktörü = None)
        audit_log(
            actor=None,
            action="SEED",
            summary=f"seed_roles · {created_count} yeni · toplam {len(ROLES)}",
            metadata={"roles": [r.code for r in ROLES], "new": created_count},
        )

        if not quiet:
            self.stdout.write(self.style.SUCCESS(
                f"\nseed_roles tamamlandı. {created_count} yeni rol yaratıldı."
            ))
