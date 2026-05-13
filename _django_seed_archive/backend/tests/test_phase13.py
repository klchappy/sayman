"""
Faz 13 — Bildirim Merkezi / Telegram Dry-run MVP testleri.

Rule seed/CRUD, NotificationLog, dry-run builders, dedup,
suppress/cancel/ready, Telegram safe-noop, dashboard widget,
UI contract & no-op guards (no HTTP / no SMTP / no Celery).
"""
import os
import re
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

from django.contrib.auth.models import Group, User
from django.core.exceptions import PermissionDenied
from django.core.management import call_command
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.notifications.models import (NotificationCategory,
                                        NotificationChannel, NotificationLog,
                                        NotificationPreference,
                                        NotificationRule, NotificationSeverity,
                                        NotificationStatus,
                                        NotificationTriggerType)
from apps.notifications.services import (build_due_payable_notifications,
                                          build_guarantee_commission_notifications,
                                          build_integrator_credit_notifications,
                                          build_overdue_payable_notifications,
                                          build_property_tax_notifications,
                                          build_site_dues_notifications,
                                          build_subscription_commitment_notifications,
                                          build_task_due_notifications,
                                          cancel_notification,
                                          create_notification_log,
                                          mark_notification_ready,
                                          render_notification,
                                          run_notification_dry_run,
                                          send_telegram_notification,
                                          simulate_telegram_message,
                                          suppress_notification)


def _user(name, groups=("super_admin",), is_super=True):
    u = User.objects.create_user(name, password="pw12345xx")
    if is_super:
        u.is_superuser = True
        u.save()
    for g in groups:
        grp, _ = Group.objects.get_or_create(name=g)
        u.groups.add(grp)
    return u


def _make_payable(**kw):
    from apps.finance.models import PayableItem
    defaults = dict(title="P", amount=Decimal("100.00"), due_date=date(2026, 5, 8))
    defaults.update(kw)
    return PayableItem.objects.create(**defaults)


# ----------------- Seed -----------------


class SeedRulesTest(TestCase):
    def test_seed_creates_rules(self):
        call_command("seed_notification_rules", stdout=StringIO())
        self.assertTrue(NotificationRule.objects.filter(code="PAYABLE_DUE_T7").exists())
        self.assertTrue(NotificationRule.objects.filter(code="INTEGRATOR_CREDIT_CRITICAL").exists())
        self.assertTrue(NotificationRule.objects.filter(code="REPORT_EXPORT_FAILED").exists())
        # Tüm seedler dry_run_only=True
        self.assertEqual(NotificationRule.objects.filter(dry_run_only=False).count(), 0)

    def test_seed_idempotent(self):
        call_command("seed_notification_rules", stdout=StringIO())
        first_count = NotificationRule.objects.count()
        call_command("seed_notification_rules", stdout=StringIO())
        self.assertEqual(NotificationRule.objects.count(), first_count)

    def test_seed_does_not_create_logs(self):
        call_command("seed_notification_rules", stdout=StringIO())
        self.assertEqual(NotificationLog.objects.count(), 0)

    def test_seed_writes_audit(self):
        call_command("seed_notification_rules", stdout=StringIO())
        self.assertTrue(AuditLog.objects.filter(
            app_label="notifications", model_name="notificationrule",
            action="SEED",
        ).exists())


# ----------------- Rule CRUD -----------------


class RuleCrudTest(TestCase):
    def test_create_and_update_rule(self):
        r = NotificationRule.objects.create(
            name="X", code="X1", category=NotificationCategory.SYSTEM,
            trigger_type=NotificationTriggerType.MANUAL,
            severity=NotificationSeverity.INFO,
        )
        self.assertEqual(str(r), "X1 · X")
        r.name = "X2"
        r.save()
        r.refresh_from_db()
        self.assertEqual(r.name, "X2")


# ----------------- Render -----------------


class RenderTest(TestCase):
    def test_render_uses_templates_and_skips_token(self):
        r = NotificationRule.objects.create(
            name="r", code="r1", category=NotificationCategory.PAYABLE,
            trigger_type=NotificationTriggerType.DUE_DATE,
            severity=NotificationSeverity.WARNING,
            title_template="Vade: {due_date}",
            message_template="Tutar {amount}",
        )
        title, msg = render_notification(r, {
            "due_date": "08.05.2026", "amount": "100",
            "token": "BOT_TOKEN_SECRET", "chat_id": "12345",
        })
        self.assertEqual(title, "Vade: 08.05.2026")
        self.assertEqual(msg, "Tutar 100")
        self.assertNotIn("BOT_TOKEN_SECRET", title + msg)


# ----------------- create_notification_log -----------------


class CreateLogTest(TestCase):
    def test_dry_run_default(self):
        u = _user("cl_u")
        log = create_notification_log(
            category=NotificationCategory.PAYABLE,
            severity=NotificationSeverity.WARNING,
            title="t", message="m", actor=u,
        )
        self.assertEqual(log.status, NotificationStatus.DRY_RUN)
        self.assertTrue(log.dry_run)
        self.assertFalse(log.real_send_allowed)

    def test_audit_written(self):
        u = _user("cl_a")
        log = create_notification_log(
            category=NotificationCategory.SYSTEM,
            severity=NotificationSeverity.INFO,
            title="t", actor=u,
        )
        self.assertTrue(AuditLog.objects.filter(
            app_label="notifications", model_name="notificationlog",
            object_id=str(log.pk),
        ).exists())


# ----------------- Builders / Dry-run -----------------


def _seed():
    call_command("seed_notification_rules", stdout=StringIO())


class DueOverduePayableTest(TestCase):
    def setUp(self):
        _seed()
        today = timezone.localdate()
        _make_payable(title="Yaklaşan", due_date=today + timedelta(days=3))
        _make_payable(title="Geciken", due_date=today - timedelta(days=2))

    def test_due_payable_log(self):
        logs = build_due_payable_notifications(days=7)
        self.assertGreaterEqual(len(logs), 1)
        self.assertEqual(logs[0].category, NotificationCategory.PAYABLE)
        self.assertEqual(logs[0].status, NotificationStatus.DRY_RUN)

    def test_overdue_payable_log(self):
        logs = build_overdue_payable_notifications()
        self.assertGreaterEqual(len(logs), 1)
        self.assertEqual(logs[0].severity, NotificationSeverity.CRITICAL)

    def test_due_payable_dedup(self):
        first = build_due_payable_notifications(days=7)
        second = build_due_payable_notifications(days=7)
        self.assertEqual(len(second), 0,
                         f"Duplicate dry-run engellenmedi (ilk={len(first)} ikinci={len(second)})")


class TaskDueTest(TestCase):
    def setUp(self):
        _seed()

    def test_today_and_overdue_task(self):
        from apps.tasks.services import create_task
        u = _user("td_u")
        today = timezone.localdate()
        create_task(title="bugün", created_by=u, due_date=today)
        create_task(title="geç", created_by=u, due_date=today - timedelta(days=3))
        logs = build_task_due_notifications()
        self.assertGreaterEqual(len(logs), 2)
        self.assertTrue(any(l.severity == NotificationSeverity.CRITICAL for l in logs))


class SiteDuesTest(TestCase):
    def setUp(self):
        _seed()

    def test_site_dues_user_facing_label(self):
        from apps.pruva.models import PruvaStatement, PruvaUnit
        unit = PruvaStatement._meta.get_field("unit").related_model.objects.create(
            code="A1", block="A", unit_no="1",
        )
        today = timezone.localdate()
        PruvaStatement.objects.create(
            unit=unit, year=2026, month=5, due_date=today + timedelta(days=2),
            aidat_amount=Decimal("100"), gider_amount=Decimal("0"),
            previous_debt=Decimal("0"), penalty=Decimal("0"), other=Decimal("0"),
            total_amount=Decimal("100"), period_label="2026-05",
        )
        logs = build_site_dues_notifications(days=3)
        self.assertGreaterEqual(len(logs), 1)
        # User-facing label "Site Aidatları"
        self.assertIn("Site Aidatları", logs[0].title + logs[0].message)
        self.assertNotIn("Pruva", logs[0].title + logs[0].message)


class PropertyTaxTest(TestCase):
    def setUp(self):
        _seed()

    def test_property_tax_log(self):
        from apps.parties.models import PropertyAsset
        from apps.properties.models import (Municipality,
                                              PropertyTaxInstallment,
                                              PropertyTaxYear)
        asset = PropertyAsset.objects.create(name="Daire-1")
        muni = Municipality.objects.create(name="Şehir")
        ty = PropertyTaxYear.objects.create(
            property_asset=asset, municipality=muni, tax_year=2026,
            total_accrual_amount=Decimal("400"),
            total_paid_amount=Decimal("0"),
            remaining_amount=Decimal("400"),
        )
        today = timezone.localdate()
        PropertyTaxInstallment.objects.create(
            tax_year=ty, installment_no=1,
            due_date=today + timedelta(days=10), amount=Decimal("200"),
        )
        logs = build_property_tax_notifications(days=15)
        self.assertGreaterEqual(len(logs), 1)


class GuaranteeCommissionTest(TestCase):
    def setUp(self):
        _seed()

    def test_guarantee_commission_log(self):
        from apps.guarantees.models import (GuaranteeCommissionPeriod,
                                              GuaranteeLetter)
        g = GuaranteeLetter.objects.create(
            letter_no="G1", title="T",
            issue_date=date(2026, 1, 1), expiry_date=date(2027, 1, 1),
            amount=Decimal("1000"),
        )
        today = timezone.localdate()
        GuaranteeCommissionPeriod.objects.create(
            guarantee=g, period_label="2026-Q2",
            due_date=today + timedelta(days=5),
            commission_amount=Decimal("50"),
        )
        logs = build_guarantee_commission_notifications(days=7)
        self.assertGreaterEqual(len(logs), 1)


class IntegratorCreditTest(TestCase):
    def setUp(self):
        _seed()

    def test_critical_credit_log(self):
        from apps.integrators.models import (CreditPackage,
                                                CreditPackageStatus,
                                                SoftwareService)
        s = SoftwareService.objects.create(provider_name="X", title="T")
        CreditPackage.objects.create(
            service=s, package_name="P",
            purchase_date=date(2026, 1, 1),
            total_credits=1000, remaining_credits=10,
            critical_threshold=100, amount=Decimal("100"),
            status=CreditPackageStatus.CRITICAL,
        )
        logs = build_integrator_credit_notifications()
        self.assertGreaterEqual(len(logs), 1)
        self.assertEqual(logs[0].severity, NotificationSeverity.WARNING)


class SubscriptionCommitmentTest(TestCase):
    def setUp(self):
        _seed()

    def test_commitment_log(self):
        from apps.subscriptions.models import (Subscription,
                                                 SubscriptionCommitment)
        sub = Subscription.objects.create(title="S")
        today = timezone.localdate()
        SubscriptionCommitment.objects.create(
            subscription=sub, start_date=today,
            end_date=today + timedelta(days=20),
        )
        logs = build_subscription_commitment_notifications(days=30)
        self.assertGreaterEqual(len(logs), 1)


class DryRunOrchestratorTest(TestCase):
    def setUp(self):
        _seed()

    def test_run_all_categories(self):
        u = _user("do_u")
        today = timezone.localdate()
        _make_payable(title="A", due_date=today - timedelta(days=2))
        result = run_notification_dry_run(user=u)
        self.assertIn(NotificationCategory.PAYABLE, result)
        # En az 6 kategori orkestrasyonu
        self.assertGreaterEqual(len(result), 6)

    def test_viewer_cannot_run_dry_run(self):
        v = _user("do_v", groups=("goruntuleyici",), is_super=False)
        with self.assertRaises(PermissionDenied):
            run_notification_dry_run(user=v)

    def test_writer_cannot_run_dry_run(self):
        # Spec: dry-run sadece manager/admin
        muh = _user("do_muh", groups=("muhasebeci",), is_super=False)
        with self.assertRaises(PermissionDenied):
            run_notification_dry_run(user=muh)

    def test_manager_can_run_dry_run(self):
        mgr = _user("do_mgr", groups=("muhasebe_muduru",), is_super=False)
        result = run_notification_dry_run(user=mgr)
        self.assertIsInstance(result, dict)


# ----------------- State transitions -----------------


class StateTransitionTest(TestCase):
    def setUp(self):
        self.admin = _user("st_admin")
        self.log = create_notification_log(
            category=NotificationCategory.PAYABLE,
            severity=NotificationSeverity.WARNING,
            title="t", actor=self.admin,
        )

    def test_mark_ready(self):
        mark_notification_ready(log=self.log, user=self.admin)
        self.log.refresh_from_db()
        self.assertEqual(self.log.status, NotificationStatus.READY)

    def test_suppress(self):
        suppress_notification(log=self.log, user=self.admin, reason="spam")
        self.log.refresh_from_db()
        self.assertEqual(self.log.status, NotificationStatus.SUPPRESSED)
        self.assertEqual(self.log.metadata.get("suppress_reason"), "spam")

    def test_cancel(self):
        cancel_notification(log=self.log, user=self.admin)
        self.log.refresh_from_db()
        self.assertEqual(self.log.status, NotificationStatus.CANCELLED)


# ----------------- Telegram safe no-op -----------------


class TelegramSafeNoopTest(TestCase):
    def test_simulate_returns_masked_chat_and_no_real_send(self):
        admin = _user("tg_a")
        log = create_notification_log(
            category=NotificationCategory.SYSTEM,
            title="hi", message="m",
            target_chat_id="123456789", actor=admin,
        )
        sim = simulate_telegram_message(log)
        self.assertFalse(sim["real_send"])
        # Maskeli — raw chat id görünmemeli
        self.assertNotIn("123456789", sim["masked_chat_id"])
        self.assertIn("12", sim["masked_chat_id"])
        self.assertIn("89", sim["masked_chat_id"])

    def test_send_telegram_with_real_send_disallowed_suppressed(self):
        admin = _user("tg_b")
        log = create_notification_log(
            category=NotificationCategory.SYSTEM,
            title="hi", actor=admin,
            dry_run=False, real_send_allowed=False,
        )
        out = send_telegram_notification(log, actor=admin)
        out.refresh_from_db()
        self.assertEqual(out.status, NotificationStatus.SUPPRESSED)

    def test_send_telegram_dry_run_suppressed(self):
        admin = _user("tg_c")
        log = create_notification_log(
            category=NotificationCategory.SYSTEM,
            title="hi", actor=admin, dry_run=True,
        )
        out = send_telegram_notification(log, actor=admin)
        out.refresh_from_db()
        self.assertEqual(out.status, NotificationStatus.SUPPRESSED)

    def test_send_telegram_does_not_make_http_request(self):
        # Hard guard: requests/urllib import edilmediğinden .post yapılamaz
        # Yine de fonksiyon çağrısı sırasında bağlantı yok — coverage için
        # hızlı sanity check yapalım.
        admin = _user("tg_d")
        log = create_notification_log(
            category=NotificationCategory.SYSTEM, title="x", actor=admin,
        )
        send_telegram_notification(log, actor=admin)
        # Test biti: hata fırlatmadı, log SUPPRESSED.
        log.refresh_from_db()
        self.assertEqual(log.status, NotificationStatus.SUPPRESSED)


# ----------------- View / HTTP -----------------


class ViewerCannotDryRunTest(TestCase):
    def test_dry_run_post_403(self):
        v = _user("vc_v", groups=("goruntuleyici",), is_super=False)
        c = Client()
        c.force_login(v)
        r = c.post(reverse("notifications:dry_run"), {"days": 7, "category": ""})
        self.assertEqual(r.status_code, 403)


class ManagerCanDryRunTest(TestCase):
    def test_manager_post_200(self):
        _seed()
        mgr = _user("mc_mgr", groups=("muhasebe_muduru",), is_super=False)
        c = Client()
        c.force_login(mgr)
        r = c.post(reverse("notifications:dry_run"), {"days": 7, "category": ""})
        self.assertEqual(r.status_code, 200)


class DashboardViewsTest(TestCase):
    def test_notifications_dashboard_renders(self):
        u = _user("dv_u", groups=("muhasebeci",), is_super=False)
        c = Client()
        c.force_login(u)
        r = c.get(reverse("notifications:dashboard"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Bildirim Merkezi")
        self.assertContains(r, "KAPALI")

    def test_telegram_test_renders_no_real_send(self):
        u = _user("dv_mgr", groups=("muhasebe_muduru",), is_super=False)
        c = Client()
        c.force_login(u)
        r = c.get(reverse("notifications:telegram_test"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "KAPALI")


class LogActionsHttpTest(TestCase):
    def test_http_suppress_and_ready(self):
        admin = _user("la_admin")
        log = create_notification_log(
            category=NotificationCategory.SYSTEM,
            severity=NotificationSeverity.INFO, title="t", actor=admin,
        )
        c = Client()
        c.force_login(admin)
        r = c.post(reverse("notifications:log_ready", args=[log.pk]))
        self.assertEqual(r.status_code, 302)
        log.refresh_from_db()
        self.assertEqual(log.status, NotificationStatus.READY)
        r2 = c.post(reverse("notifications:log_suppress", args=[log.pk]))
        self.assertEqual(r2.status_code, 302)


class MainDashboardWidgetTest(TestCase):
    def test_dashboard_renders_phase13_widget(self):
        u = _user("md_u")
        c = Client()
        c.force_login(u)
        r = c.get(reverse("dashboard:home"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Faz 13")
        self.assertContains(r, "Bildirim Merkezi")
        self.assertContains(r, "KAPALI")


# ----------------- UI contract / no-op guards -----------------


APP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "apps", "notifications",
)
TPL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "templates", "notifications",
)


def _strip_py(src: str) -> str:
    src = re.sub(r'"""[\s\S]*?"""', "", src)
    src = re.sub(r"'''[\s\S]*?'''", "", src)
    src = re.sub(r"^\s*#.*$", "", src, flags=re.M)
    return src


def _walk_py(root):
    out = []
    for dirpath, _, files in os.walk(root):
        for fn in files:
            if fn.endswith(".py"):
                with open(os.path.join(dirpath, fn), encoding="utf-8") as f:
                    out.append(f.read())
    return "\n".join(out)


class UiContractTest(TestCase):
    def test_no_forbidden_terms_in_notifications_templates(self):
        # User-facing label "Site Aidatları"; "Pruva" template'lerde olmayacak.
        forbidden = ["Pruva", "Acme", "ACME", "Inter", "JetBrains", "Santral",
                     "Yenice", "Kısık"]
        for fn in os.listdir(TPL_DIR):
            with open(os.path.join(TPL_DIR, fn), encoding="utf-8") as f:
                src = f.read()
            for w in forbidden:
                self.assertNotIn(w, src, f"{fn} içinde yasak terim: {w}")

    def test_no_dark_mode_in_notifications_templates(self):
        for fn in os.listdir(TPL_DIR):
            with open(os.path.join(TPL_DIR, fn), encoding="utf-8") as f:
                src = f.read()
            self.assertNotIn("prefers-color-scheme", src)

    def test_no_raw_token_or_chat_id_render(self):
        # log_detail/telegram_test masked_chat_id kullanmalı, raw target_chat_id render etmemeli
        for fn in ("log_detail.html", "telegram_test.html", "dashboard.html"):
            with open(os.path.join(TPL_DIR, fn), encoding="utf-8") as f:
                src = f.read()
            self.assertNotIn("{{ log.target_chat_id", src,
                             f"{fn} raw chat id render ediyor")
            self.assertNotIn("BOT_TOKEN", src)


class NoOpGuardTest(TestCase):
    def test_no_telegram_or_smtp_in_apps_notifications(self):
        joined = _strip_py(_walk_py(APP_DIR))
        for marker in ["telegram_bot", "send_telegram_real", "send_mail",
                        "smtplib", "requests.post", "requests.get",
                        "urllib.request", "urlopen"]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_no_celery_or_scheduler_in_apps_notifications(self):
        joined = _strip_py(_walk_py(APP_DIR))
        for marker in ["celery", "apscheduler", "crontab(", "BackgroundScheduler"]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_no_requests_or_urllib_import(self):
        joined = _strip_py(_walk_py(APP_DIR))
        for marker in ["import requests", "from requests",
                        "import urllib", "from urllib", "import http.client"]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_imports_does_not_create_notifications(self):
        imports_dir = os.path.join(os.path.dirname(APP_DIR), "imports")
        if not os.path.exists(imports_dir):
            return
        for root, _, files in os.walk(imports_dir):
            for fn in files:
                if not fn.endswith(".py"):
                    continue
                with open(os.path.join(root, fn), encoding="utf-8") as f:
                    src = f.read()
                self.assertNotIn("NotificationLog.objects.create", src)
                self.assertNotIn("create_notification_log", src)


class MakemigrationsCleanTest(TestCase):
    def test_no_pending_migrations(self):
        try:
            call_command("makemigrations", "--check", "--dry-run", verbosity=0)
        except SystemExit as e:
            self.fail(f"Pending migrations: {e}")
