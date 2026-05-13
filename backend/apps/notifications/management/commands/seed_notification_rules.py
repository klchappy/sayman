"""Idempotent rule seed — Faz 13."""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.audit.services import audit_log

from apps.notifications.models import (NotificationCategory,
                                        NotificationChannel, NotificationRule,
                                        NotificationSeverity,
                                        NotificationTriggerType)


SEED_RULES = [
    {"code": "PAYABLE_DUE_T7", "name": "Yaklaşan Ödeme (T-7)",
     "category": NotificationCategory.PAYABLE,
     "trigger_type": NotificationTriggerType.DUE_DATE, "days_before": 7,
     "severity": NotificationSeverity.WARNING,
     "title_template": "Yaklaşan Ödeme: {title}",
     "message_template": "{title} · vade {due_date} · tutar {amount}"},
    {"code": "PAYABLE_OVERDUE", "name": "Geciken Ödeme",
     "category": NotificationCategory.PAYABLE,
     "trigger_type": NotificationTriggerType.OVERDUE,
     "severity": NotificationSeverity.CRITICAL,
     "title_template": "Geciken Ödeme: {title}",
     "message_template": "{title} vadesi geçmiş"},
    {"code": "TASK_DUE_TODAY", "name": "Bugünkü Görev",
     "category": NotificationCategory.TASK,
     "trigger_type": NotificationTriggerType.DUE_DATE, "days_before": 0,
     "severity": NotificationSeverity.WARNING,
     "title_template": "Görev: {title}", "message_template": "Görev son tarihi bugün"},
    {"code": "TASK_OVERDUE", "name": "Geciken Görev",
     "category": NotificationCategory.TASK,
     "trigger_type": NotificationTriggerType.OVERDUE,
     "severity": NotificationSeverity.CRITICAL,
     "title_template": "Geciken Görev: {title}", "message_template": "Görev gecikti"},
    {"code": "SUBSCRIPTION_COMMITMENT_T30", "name": "Yaklaşan Taahhüt Bitişi (T-30)",
     "category": NotificationCategory.SUBSCRIPTION,
     "trigger_type": NotificationTriggerType.DUE_DATE, "days_before": 30,
     "severity": NotificationSeverity.WARNING,
     "title_template": "Taahhüt Bitişi", "message_template": "Taahhüt yaklaşıyor"},
    {"code": "SITE_DUES_DUE_T3", "name": "Site Aidatları (T-3)",
     "category": NotificationCategory.SITE_DUES,
     "trigger_type": NotificationTriggerType.DUE_DATE, "days_before": 3,
     "severity": NotificationSeverity.WARNING,
     "title_template": "Site Aidatları Yaklaşıyor",
     "message_template": "Site Aidatları son ödeme yaklaşıyor"},
    {"code": "PROPERTY_TAX_T15", "name": "Emlak Vergisi Taksiti (T-15)",
     "category": NotificationCategory.PROPERTY_TAX,
     "trigger_type": NotificationTriggerType.DUE_DATE, "days_before": 15,
     "severity": NotificationSeverity.WARNING,
     "title_template": "Emlak Vergisi", "message_template": "Taksit yaklaşıyor"},
    {"code": "GUARANTEE_COMMISSION_T7", "name": "Teminat Komisyon (T-7)",
     "category": NotificationCategory.GUARANTEE,
     "trigger_type": NotificationTriggerType.DUE_DATE, "days_before": 7,
     "severity": NotificationSeverity.WARNING,
     "title_template": "Teminat Komisyon", "message_template": "Komisyon ödemesi yaklaşıyor"},
    {"code": "INTEGRATOR_CREDIT_CRITICAL", "name": "Kontör Kritik Eşik",
     "category": NotificationCategory.INTEGRATOR,
     "trigger_type": NotificationTriggerType.THRESHOLD,
     "severity": NotificationSeverity.CRITICAL,
     "title_template": "Kontör Kritik", "message_template": "Kontör paketi kritik/tükenmiş"},
    {"code": "REPORT_EXPORT_FAILED", "name": "Rapor Export Hatası",
     "category": NotificationCategory.REPORT,
     "trigger_type": NotificationTriggerType.STATUS_CHANGE,
     "severity": NotificationSeverity.WARNING,
     "title_template": "Rapor Export Hatası",
     "message_template": "Rapor üretimi başarısız"},
]


class Command(BaseCommand):
    help = "Bildirim kurallarını idempotent şekilde seed eder. Mevcut rule overwrite EDİLMEZ."

    def handle(self, *args, **opts):
        created = 0
        skipped = 0
        with transaction.atomic():
            for spec in SEED_RULES:
                code = spec["code"]
                if NotificationRule.objects.filter(code=code).exists():
                    skipped += 1
                    continue
                rule = NotificationRule.objects.create(
                    name=spec["name"], code=code,
                    category=spec["category"], trigger_type=spec["trigger_type"],
                    channel=NotificationChannel.DASHBOARD,
                    days_before=spec.get("days_before"),
                    severity=spec["severity"],
                    title_template=spec.get("title_template", ""),
                    message_template=spec.get("message_template", ""),
                    is_active=True, dry_run_only=True,
                )
                audit_log(actor=None, action="SEED", obj=rule,
                          summary=f"Bildirim kuralı seed: {code}")
                created += 1
        self.stdout.write(self.style.SUCCESS(
            f"Seed tamam — yaratıldı: {created} · atlandı: {skipped}"
        ))
