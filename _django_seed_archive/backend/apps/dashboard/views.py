from decimal import Decimal

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q, Sum
from django.utils import timezone
from django.views.generic import TemplateView

from apps.audit.models import AuditLog
from apps.notifications.models import NotificationLog
from apps.tasks.models import Task

from apps.core.helpers import format_money_tr


class DashboardHomeView(LoginRequiredMixin, TemplateView):
    template_name = "dashboard/home.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)

        # === Finance KPI'ları (Faz 4) ===
        from apps.finance.models import PayableItem, PayableStatus
        from apps.finance.views import _missing_receipt_count

        today = timezone.localdate()
        active = PayableItem.objects.filter(is_active=True).exclude(
            status__in=[PayableStatus.CANCELLED, PayableStatus.PAID, PayableStatus.ARCHIVED]
        )
        bugun = active.filter(due_date=today)
        gecikmis = active.filter(due_date__lt=today)
        tamam = Task.objects.filter(is_active=True, status="COMPLETED").count()
        toplam_gorev = Task.objects.filter(is_active=True).count()
        gorev_pct = (tamam * 100 // toplam_gorev) if toplam_gorev > 0 else 0

        ctx["kpis"] = [
            {
                "label": "Bugün Ödenecek",
                "value": format_money_tr(bugun.aggregate(t=Sum("amount"))["t"] or Decimal("0")),
                "hint": f"{bugun.count()} kalem",
                "color": "brand",
            },
            {
                "label": "Geciken",
                "value": format_money_tr(gecikmis.aggregate(t=Sum("amount"))["t"] or Decimal("0")),
                "hint": f"{gecikmis.count()} kalem",
                "color": "danger",
            },
            {
                "label": "Görev Tamamlanma",
                "value": f"%{gorev_pct}",
                "hint": f"{tamam}/{toplam_gorev}",
                "color": "info",
            },
            {
                "label": "Eksik Dekont",
                "value": str(_missing_receipt_count()),
                "hint": "5K+ TL",
                "color": "orange",
            },
        ]

        # === Faz 5: Abonelik / Düzenli / Resmi özetleri ===
        from apps.subscriptions.models import (
            Subscription, SubscriptionCommitment, CommitmentStatus,
        )
        from apps.regular_payments.models import RegularPaymentProfile, RegularPaymentPeriod
        from apps.official_payments.models import OfficialPaymentProfile, OfficialPaymentPeriod

        active_subs = Subscription.objects.filter(is_active=True, status="ACTIVE").count()
        approaching = SubscriptionCommitment.objects.filter(
            is_active=True, status=CommitmentStatus.APPROACHING, end_date__gte=today,
        ).select_related("subscription").order_by("end_date")[:5]

        regular_this_month = RegularPaymentPeriod.objects.filter(
            is_active=True, due_date__year=today.year, due_date__month=today.month,
        )
        regular_total = regular_this_month.aggregate(t=Sum("amount"))["t"] or Decimal("0")

        official_upcoming = OfficialPaymentPeriod.objects.filter(
            is_active=True, due_date__gte=today,
            due_date__lte=today + timezone.timedelta(days=30),
        ).select_related("profile").order_by("due_date")[:5]

        unlinked_count = (
            RegularPaymentPeriod.objects.filter(is_active=True, payable__isnull=True,
                                                 due_date__lte=today + timezone.timedelta(days=30)).count()
            + OfficialPaymentPeriod.objects.filter(is_active=True, payable__isnull=True,
                                                    due_date__lte=today + timezone.timedelta(days=30)).count()
        )

        # === Faz 6: SiteX özeti ===
        from apps.pruva.models import (PruvaUnit, PruvaStatement,
                                        PruvaAidatDifference, UnitStatus,
                                        AidatDifferenceStatus, StatementStatus)
        ctx["phase6_pruva"] = {
            "active_units": PruvaUnit.objects.filter(is_active=True, status=UnitStatus.ACTIVE).count(),
            "sold_units": PruvaUnit.objects.filter(status=UnitStatus.SOLD).count(),
            "open_statements": PruvaStatement.objects.filter(
                is_active=True, status__in=[StatementStatus.PENDING, StatementStatus.DRAFT]
            ).count(),
            "open_diffs": PruvaAidatDifference.objects.filter(
                is_active=True, status=AidatDifferenceStatus.OPEN
            ).count(),
        }

        # === Faz 7: Emlak Vergisi özeti ===
        from apps.properties.models import (
            PropertyTaxYear, PropertyTaxInstallment, InstallmentStatus,
        )
        from apps.parties.models import PropertyAsset

        this_year = today.year
        upcoming_tax = PropertyTaxInstallment.objects.filter(
            is_active=True, due_date__gte=today,
            due_date__lte=today + timezone.timedelta(days=45),
            status__in=[InstallmentStatus.PENDING, InstallmentStatus.LINKED],
        ).select_related("tax_year__property_asset").order_by("due_date")[:5]
        overdue_tax = PropertyTaxInstallment.objects.filter(
            is_active=True, due_date__lt=today,
            status__in=[InstallmentStatus.PENDING, InstallmentStatus.LINKED,
                        InstallmentStatus.OVERDUE],
        ).count()
        ctx["phase7_property"] = {
            "tracked_this_year": PropertyTaxYear.objects.filter(
                is_active=True, tax_year=this_year
            ).count(),
            "active_assets": PropertyAsset.objects.filter(
                is_active=True
            ).exclude(status__in=["SOLD", "PASSIVE"]).count(),
            "sold_assets": PropertyAsset.objects.filter(status="SOLD").count(),
            "upcoming_installments": upcoming_tax,
            "overdue_count": overdue_tax,
            "this_year": this_year,
        }

        # === Faz 8: Teminat Mektupları & Komisyon özeti ===
        from apps.guarantees.models import (
            CommissionStatus, GuaranteeCommissionPeriod, GuaranteeLetter,
            GuaranteeStatus,
        )
        active_g = GuaranteeLetter.objects.filter(
            is_active=True,
            status__in=[GuaranteeStatus.ACTIVE, GuaranteeStatus.APPROACHING]
        )
        upcoming_commission = (
            GuaranteeCommissionPeriod.objects.filter(
                is_active=True, due_date__gte=today,
                due_date__lte=today + timezone.timedelta(days=45),
                status__in=[CommissionStatus.PENDING, CommissionStatus.LINKED],
            ).select_related("guarantee", "payable").order_by("due_date")[:5]
        )
        overdue_commission = GuaranteeCommissionPeriod.objects.filter(
            is_active=True, due_date__lt=today,
            status__in=[CommissionStatus.PENDING, CommissionStatus.LINKED,
                        CommissionStatus.OVERDUE],
        ).count()
        ctx["phase8_guarantee"] = {
            "active_count": active_g.count(),
            "upcoming_commissions": upcoming_commission,
            "overdue_count": overdue_commission,
            "returning_count": GuaranteeLetter.objects.filter(
                is_active=True, status=GuaranteeStatus.APPROACHING
            ).count(),
            "linked_payables": GuaranteeCommissionPeriod.objects.filter(
                is_active=True, payable__isnull=False,
            ).count(),
        }

        # === Faz 9: Entegratör & Kontör özeti ===
        from apps.integrators.models import (
            ContractStatus, CreditPackage, CreditPackageStatus,
            ServiceContract, ServiceStatus, SoftwareService,
        )
        active_services = SoftwareService.objects.filter(
            is_active=True, status=ServiceStatus.ACTIVE
        )
        approaching_contracts_qs = ServiceContract.objects.filter(
            is_active=True,
            status__in=[ContractStatus.ACTIVE, ContractStatus.APPROACHING],
            renewal_date__gte=today,
            renewal_date__lte=today + timezone.timedelta(days=30),
        ).select_related("service").order_by("renewal_date")[:5]
        critical_credits_qs = CreditPackage.objects.filter(
            is_active=True,
            status__in=[CreditPackageStatus.CRITICAL, CreditPackageStatus.EXHAUSTED],
        ).select_related("service").order_by("remaining_credits")[:5]
        ctx["phase9_integrators"] = {
            "active_services": active_services.count(),
            "approaching_contracts": approaching_contracts_qs,
            "critical_credits": critical_credits_qs,
            "exhausted_count": CreditPackage.objects.filter(
                is_active=True, status=CreditPackageStatus.EXHAUSTED
            ).count(),
            "linked_payables": (
                ServiceContract.objects.filter(is_active=True, payable__isnull=False).count()
                + CreditPackage.objects.filter(is_active=True, payable__isnull=False).count()
            ),
        }

        ctx["phase5_summary"] = {
            "active_subscriptions": active_subs,
            "approaching_commitments": approaching,
            "regular_this_month_count": regular_this_month.count(),
            "regular_this_month_total": regular_total,
            "official_upcoming": official_upcoming,
            "unlinked_periods": unlinked_count,
        }

        # === Risk kartları (Faz 5'te yaklaşan taahhüt aktif) ===
        ctx["risk_cards"] = [
            {"label": "Kontör Kritik",
             "desc": (f"{CreditPackage.objects.filter(is_active=True, status__in=[CreditPackageStatus.CRITICAL, CreditPackageStatus.EXHAUSTED]).count()} kontör paketi kritik/tükenmiş")
                     if CreditPackage.objects.filter(is_active=True, status__in=[CreditPackageStatus.CRITICAL, CreditPackageStatus.EXHAUSTED]).exists()
                     else "Kritik kontör yok",
             "color": "danger" if ctx["phase9_integrators"]["exhausted_count"] else "warning"},
            {"label": "Yaklaşan Taahhüt",
             "desc": f"{approaching.count()} abonelik taahhüdü 60 gün içinde bitiyor"
                     if approaching.exists() else "Yaklaşan taahhüt yok",
             "color": "orange" if approaching.exists() else "warning"},
            {"label": "Teminat Komisyonu", "desc": "Faz 8'de aktif", "color": "warning"},
            {"label": "Bağlantısız Dönem",
             "desc": f"{unlinked_count} period PayableItem'a bağlanmamış"
                     if unlinked_count else "Tüm dönemler bağlı",
             "color": "danger" if unlinked_count else "warning"},
        ]

        # === Yaklaşan ödemeler (T-7) ===
        ctx["upcoming_payables"] = active.filter(
            due_date__gte=today, due_date__lte=today + timezone.timedelta(days=7)
        ).order_by("due_date")[:7]

        # === Son finance audit ===
        ctx["recent_audit"] = AuditLog.objects.select_related("actor").order_by("-created_at")[:8]

        ctx["recent_notifications"] = NotificationLog.objects.order_by("-created_at")[:5]
        # === Faz 10: Görev widget'ları ===
        from apps.tasks.models import ACTIVE_STATUSES, TaskEvent, TaskPriority, TaskStatus
        from apps.tasks.services import (get_overdue_tasks,
                                          get_today_tasks_for_user,
                                          get_upcoming_tasks)
        my_open = Task.objects.filter(
            assigned_to=self.request.user, is_active=True,
            status__in=ACTIVE_STATUSES,
        )
        ctx["my_tasks"] = my_open.order_by("due_date", "-priority")[:5]
        ctx["phase10_tasks"] = {
            "today_count": get_today_tasks_for_user(self.request.user).count(),
            "overdue_count": get_overdue_tasks(self.request.user).count(),
            "upcoming_count": get_upcoming_tasks(self.request.user, days=7).count(),
            "critical_count": my_open.filter(priority=TaskPriority.CRITICAL).count(),
            "assigned_to_me_count": my_open.count(),
            "recent_events": TaskEvent.objects.select_related("task", "actor")[:5],
        }
        # === Faz 11: Chat widget'ları ===
        from apps.chat.models import ChatThread, ChatThreadStatus, ChatThreadType
        from apps.chat.services import get_unread_count, get_user_threads
        active_qs = ChatThread.objects.filter(is_active=True, status=ChatThreadStatus.ACTIVE)
        # === Faz 12: Rapor / Export widget ===
        from apps.reports.models import ReportRun, ReportRunStatus
        runs_qs = ReportRun.objects.filter(is_active=True).order_by("-created_at")
        ctx["phase12_reports"] = {
            "recent_runs": list(runs_qs[:5]),
            "completed_count": runs_qs.filter(status=ReportRunStatus.COMPLETED).count(),
            "failed_count": runs_qs.filter(status=ReportRunStatus.FAILED).count(),
            "pending_count": runs_qs.filter(status__in=[ReportRunStatus.PENDING, ReportRunStatus.RUNNING]).count(),
        }
        ctx["phase11_chat"] = {
            "unread_count": get_unread_count(user=self.request.user),
            "active_threads": active_qs.count(),
            "record_threads": active_qs.filter(thread_type=ChatThreadType.RECORD).count(),
            "task_threads": active_qs.filter(thread_type=ChatThreadType.TASK).count(),
            "recent_threads": list(get_user_threads(self.request.user)[:3]),
        }
        # === Faz 13: Bildirim widget ===
        from apps.notifications.models import NotificationStatus
        notif_qs = NotificationLog.objects.order_by("-created_at")
        ctx["phase13_notifications"] = {
            "recent": list(notif_qs[:5]),
            "dry_run_count": notif_qs.filter(status=NotificationStatus.DRY_RUN).count(),
            "suppressed_count": notif_qs.filter(status=NotificationStatus.SUPPRESSED).count(),
            "failed_count": notif_qs.filter(status=NotificationStatus.FAILED).count(),
            "critical_count": notif_qs.filter(severity="CRITICAL").count(),
            "real_send_open": False,
        }
        return ctx
