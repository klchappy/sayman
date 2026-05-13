"""Faz 5 — SystemSetting + Subscriptions + RegularPayments + OfficialPayments testleri."""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.core.models import SystemSetting, SystemSettingValueType, get_setting
from apps.finance.models import PayableItem
from apps.finance.services.payments import (requires_double_approval,
                                             requires_receipt)
from apps.parties.models import Company, Person


def _make_company(name="Acme Tekstil", short=None):
    short = short or name[:6].upper().replace(" ", "")
    return Company.objects.create(name=name, short_name=short)


# ===========================================================================
# SystemSetting
# ===========================================================================
class SystemSettingTest(TestCase):
    def test_fallback_to_django_settings(self):
        # DB'de yoksa fallback constant kullanılmalı
        SystemSetting.objects.filter(key="PAYMENT_DEKONT_REQUIRED_THRESHOLD").delete()
        self.assertTrue(requires_receipt(Decimal("5000")))
        self.assertFalse(requires_receipt(Decimal("4999")))

    def test_db_setting_overrides_constant(self):
        SystemSetting.objects.create(
            key="PAYMENT_DEKONT_REQUIRED_THRESHOLD",
            value="10000", value_type=SystemSettingValueType.DECIMAL,
            description="Override eşik", is_active=True,
        )
        # Cache yok, doğrudan okur
        self.assertFalse(requires_receipt(Decimal("5000")))
        self.assertTrue(requires_receipt(Decimal("10000")))

    def test_double_approval_db_override(self):
        SystemSetting.objects.create(
            key="PAYMENT_DOUBLE_APPROVAL_THRESHOLD",
            value="100000", value_type=SystemSettingValueType.DECIMAL, is_active=True,
        )
        self.assertFalse(requires_double_approval(Decimal("50000")))
        self.assertTrue(requires_double_approval(Decimal("100000")))

    def test_inactive_setting_falls_back(self):
        SystemSetting.objects.create(
            key="PAYMENT_DEKONT_REQUIRED_THRESHOLD",
            value="999999", value_type=SystemSettingValueType.DECIMAL, is_active=False,
        )
        # is_active=False → fallback'a düşmeli
        self.assertTrue(requires_receipt(Decimal("5000")))


# ===========================================================================
# Subscriptions
# ===========================================================================
class SubscriptionsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("u_sub", "a@a.com", "pw12345xx")
        self.company = _make_company()

    def test_create_subscription_writes_audit(self):
        from apps.subscriptions.services.subscriptions import create_subscription
        sub = create_subscription(
            user=self.user, owner_type="COMPANY", company=self.company,
            title="Türk Telekom İnternet", service_type="INTERNET",
            account_no="1234567",
        )
        self.assertEqual(sub.status, "ACTIVE")
        self.assertTrue(AuditLog.objects.filter(model_name="subscription", action="CREATE").exists())

    def test_update_archive_restore(self):
        from apps.subscriptions.services.subscriptions import (
            archive_subscription, create_subscription, restore_subscription,
            update_subscription,
        )
        sub = create_subscription(
            user=self.user, owner_type="COMPANY", company=self.company,
            title="X", service_type="OTHER",
        )
        update_subscription(subscription=sub, user=self.user, title="Y")
        sub.refresh_from_db()
        self.assertEqual(sub.title, "Y")

        archive_subscription(subscription=sub, user=self.user)
        sub.refresh_from_db()
        self.assertFalse(sub.is_active)

        restore_subscription(subscription=sub, user=self.user)
        sub.refresh_from_db()
        self.assertTrue(sub.is_active)

    def test_commitment_approaching_status(self):
        from apps.subscriptions.services.subscriptions import (
            add_commitment, create_subscription,
        )
        sub = create_subscription(
            user=self.user, owner_type="COMPANY", company=self.company,
            title="Test", service_type="GSM",
        )
        # 30 gün sonra biten taahhüt → APPROACHING
        cm = add_commitment(
            subscription=sub, user=self.user,
            end_date=timezone.localdate() + timedelta(days=30),
            campaign_name="Test campaign",
        )
        self.assertEqual(cm.status, "APPROACHING")

        cm2 = add_commitment(
            subscription=sub, user=self.user,
            end_date=timezone.localdate() + timedelta(days=400),
        )
        self.assertEqual(cm2.status, "ACTIVE")

    def test_create_payable_from_charge(self):
        from apps.subscriptions.services.subscriptions import (
            create_payable_from_subscription_charge, create_period_charge,
            create_subscription,
        )
        sub = create_subscription(
            user=self.user, owner_type="COMPANY", company=self.company,
            title="Internet", service_type="INTERNET",
            default_payment_method="EFT",
        )
        charge = create_period_charge(
            subscription=sub, user=self.user,
            period_label="2026-05",
            due_date=timezone.localdate() + timedelta(days=10),
            amount=Decimal("1500"),
        )
        before = PayableItem.objects.count()
        payable, created = create_payable_from_subscription_charge(charge=charge, user=self.user)
        self.assertTrue(created)
        self.assertEqual(PayableItem.objects.count(), before + 1)
        self.assertEqual(payable.amount, Decimal("1500"))
        charge.refresh_from_db()
        self.assertEqual(charge.payable, payable)
        self.assertEqual(charge.status, "LINKED")

    def test_duplicate_payable_blocked(self):
        from apps.subscriptions.services.subscriptions import (
            create_payable_from_subscription_charge, create_period_charge,
            create_subscription,
        )
        sub = create_subscription(
            user=self.user, owner_type="COMPANY", company=self.company,
            title="X", service_type="OTHER",
        )
        charge = create_period_charge(
            subscription=sub, user=self.user, period_label="2026-05",
            due_date=timezone.localdate() + timedelta(days=10),
            amount=Decimal("1000"),
        )
        p1, c1 = create_payable_from_subscription_charge(charge=charge, user=self.user)
        p2, c2 = create_payable_from_subscription_charge(charge=charge, user=self.user)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(p1.pk, p2.pk)


# ===========================================================================
# Regular Payments
# ===========================================================================
class RegularPaymentsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("u_reg", "a@a.com", "pw12345xx")
        self.company = _make_company("Acme Enerji", "KE")

    def _make_profile(self, **kw):
        from apps.regular_payments.services.regular_payments import create_profile
        defaults = dict(
            user=self.user, owner_type="COMPANY", company=self.company,
            title="Merkez Kira", category="RENT",
            period_type="MONTHLY", default_due_day=5,
            default_amount=Decimal("12000"),
        )
        defaults.update(kw)
        return create_profile(**defaults)

    def test_create_profile(self):
        p = self._make_profile()
        self.assertEqual(p.status, "ACTIVE")
        self.assertTrue(AuditLog.objects.filter(model_name="regularpaymentprofile", action="CREATE").exists())

    def test_create_period(self):
        from apps.regular_payments.services.regular_payments import create_period
        p = self._make_profile()
        period = create_period(
            profile=p, user=self.user, period_label="2026-05",
            due_date=timezone.localdate() + timedelta(days=5),
            amount=Decimal("12000"),
        )
        self.assertEqual(period.amount, Decimal("12000"))

    def test_generate_12_periods(self):
        from apps.regular_payments.services.regular_payments import generate_next_periods
        p = self._make_profile()
        created = generate_next_periods(profile=p, user=self.user, months=12)
        self.assertEqual(len(created), 12)
        # İdempotent: tekrar üretirse 0
        again = generate_next_periods(profile=p, user=self.user, months=12)
        self.assertEqual(len(again), 0)

    def test_create_payable_from_period(self):
        from apps.regular_payments.services.regular_payments import (
            create_payable_from_regular_period, generate_next_periods,
        )
        p = self._make_profile()
        periods = generate_next_periods(profile=p, user=self.user, months=3)
        period = periods[0]
        before = PayableItem.objects.count()
        payable, created = create_payable_from_regular_period(period=period, user=self.user)
        self.assertTrue(created)
        self.assertEqual(PayableItem.objects.count(), before + 1)
        period.refresh_from_db()
        self.assertEqual(period.status, "LINKED")

    def test_duplicate_payable_blocked(self):
        from apps.regular_payments.services.regular_payments import (
            create_payable_from_regular_period, generate_next_periods,
        )
        p = self._make_profile()
        periods = generate_next_periods(profile=p, user=self.user, months=2)
        period = periods[0]
        p1, c1 = create_payable_from_regular_period(period=period, user=self.user)
        p2, c2 = create_payable_from_regular_period(period=period, user=self.user)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(p1.pk, p2.pk)

    def test_archive_restore(self):
        from apps.regular_payments.services.regular_payments import (
            archive_profile, restore_profile,
        )
        p = self._make_profile()
        archive_profile(profile=p, user=self.user)
        p.refresh_from_db()
        self.assertFalse(p.is_active)
        restore_profile(profile=p, user=self.user)
        p.refresh_from_db()
        self.assertTrue(p.is_active)


# ===========================================================================
# Official Payments
# ===========================================================================
class OfficialPaymentsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("u_off", "a@a.com", "pw12345xx")
        self.person = Person.objects.create(full_name="Test Kullanıcı")
        self.company = _make_company()

    def test_create_bagkur_profile(self):
        from apps.official_payments.services.official_payments import create_profile
        p = create_profile(
            user=self.user, owner_type="PERSON", person=self.person,
            title="BAĞKUR · Test", payment_type="BAGKUR",
            period_type="MONTHLY", default_due_day=28,
            default_amount=Decimal("8120"),
        )
        self.assertEqual(p.payment_type, "BAGKUR")
        self.assertTrue(AuditLog.objects.filter(model_name="officialpaymentprofile", action="CREATE").exists())

    def test_ito_two_installments(self):
        from apps.official_payments.services.official_payments import (
            create_profile, generate_periods,
        )
        p = create_profile(
            user=self.user, owner_type="COMPANY", company=self.company,
            title="İTO · Acme Tekstil", payment_type="ITO",
            period_type="INSTALLMENT", default_amount=Decimal("3800"),
        )
        created = generate_periods(profile=p, user=self.user, year=2026)
        self.assertEqual(len(created), 2)
        ins_nos = sorted(c.installment_no for c in created)
        self.assertEqual(ins_nos, [1, 2])

    def test_bagkur_12_months(self):
        from apps.official_payments.services.official_payments import (
            create_profile, generate_periods,
        )
        p = create_profile(
            user=self.user, owner_type="PERSON", person=self.person,
            title="BAĞKUR Test", payment_type="BAGKUR",
            period_type="MONTHLY", default_due_day=28, default_amount=Decimal("8120"),
        )
        created = generate_periods(profile=p, user=self.user, year=2026)
        self.assertEqual(len(created), 12)

    def test_create_payable_from_official_period(self):
        from apps.official_payments.services.official_payments import (
            create_payable_from_official_period, create_profile, generate_periods,
        )
        p = create_profile(
            user=self.user, owner_type="PERSON", person=self.person,
            title="BAĞKUR test", payment_type="BAGKUR",
            period_type="MONTHLY", default_due_day=28, default_amount=Decimal("8120"),
        )
        periods = generate_periods(profile=p, user=self.user, year=2026)
        before = PayableItem.objects.count()
        payable, created = create_payable_from_official_period(period=periods[0], user=self.user)
        self.assertTrue(created)
        self.assertEqual(PayableItem.objects.count(), before + 1)

    def test_duplicate_payable_blocked(self):
        from apps.official_payments.services.official_payments import (
            create_payable_from_official_period, create_profile, generate_periods,
        )
        p = create_profile(
            user=self.user, owner_type="PERSON", person=self.person,
            title="X", payment_type="BAGKUR",
            period_type="MONTHLY", default_due_day=28, default_amount=Decimal("100"),
        )
        periods = generate_periods(profile=p, user=self.user, year=2026)
        period = periods[0]
        p1, c1 = create_payable_from_official_period(period=period, user=self.user)
        p2, c2 = create_payable_from_official_period(period=period, user=self.user)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(p1.pk, p2.pk)


# ===========================================================================
# Finance integration
# ===========================================================================
class FinanceIntegrationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("u_fi", "a@a.com", "pw12345xx")
        self.company = _make_company()

    def test_high_amount_payable_keeps_double_approval_flag(self):
        """Faz 5'te oluşturulan PayableItem da 50K+ için requires_double_approval=True."""
        from apps.regular_payments.services.regular_payments import (
            create_payable_from_regular_period, create_period, create_profile,
        )
        p = create_profile(
            user=self.user, owner_type="COMPANY", company=self.company,
            title="Yüksek kira", category="RENT",
            period_type="MONTHLY", default_amount=Decimal("75000"),
        )
        period = create_period(
            profile=p, user=self.user, period_label="2026-05",
            due_date=timezone.localdate() + timedelta(days=10),
            amount=Decimal("75000"),
        )
        payable, _ = create_payable_from_regular_period(period=period, user=self.user)
        self.assertTrue(payable.requires_receipt)
        self.assertTrue(payable.requires_double_approval)


# ===========================================================================
# Dashboard
# ===========================================================================
class DashboardPhase5Test(TestCase):
    def test_dashboard_includes_phase5_summary(self):
        u = User.objects.create_superuser("u_dash5", "a@a.com", "pw12345xx")
        company = _make_company("Test Co", "TST")

        from apps.subscriptions.services.subscriptions import (
            add_commitment, create_subscription,
        )
        sub = create_subscription(
            user=u, owner_type="COMPANY", company=company,
            title="Test İnternet", service_type="INTERNET",
        )
        add_commitment(
            subscription=sub, user=u,
            end_date=timezone.localdate() + timedelta(days=20),
            campaign_name="Test",
        )

        self.client.force_login(u)
        res = self.client.get(reverse("dashboard:home"))
        self.assertEqual(res.status_code, 200)
        # Faz 5 özet bölümü render
        self.assertContains(res, "Abonelikler")
        self.assertContains(res, "Düzenli Ödeme")
        self.assertContains(res, "Resmi Ödemeler")


# ===========================================================================
# Permission
# ===========================================================================
class PermissionPhase5Test(TestCase):
    def setUp(self):
        call_command("seed_roles", "--quiet")
        self.viewer = User.objects.create_user("v5", password="pw12345xx")
        self.viewer.groups.add(Group.objects.get(name="goruntuleyici"))

    def test_viewer_cannot_create_subscription(self):
        self.client.force_login(self.viewer)
        res = self.client.get(reverse("subscriptions:create"))
        self.assertEqual(res.status_code, 403)

    def test_viewer_cannot_create_regular(self):
        self.client.force_login(self.viewer)
        res = self.client.get(reverse("regular_payments:create"))
        self.assertEqual(res.status_code, 403)

    def test_viewer_cannot_create_official(self):
        self.client.force_login(self.viewer)
        res = self.client.get(reverse("official_payments:create"))
        self.assertEqual(res.status_code, 403)

    def test_anon_redirect_all_lists(self):
        for url in ["subscriptions:list", "regular_payments:list", "official_payments:list"]:
            res = self.client.get(reverse(url))
            self.assertEqual(res.status_code, 302, f"{url} bekleniyor 302")


# ===========================================================================
# Import commit hâlâ NO-OP
# ===========================================================================
class ImportCommitStillNoOpTest(TestCase):
    """Faz 5 sınırı: Import commit hiçbir Subscription/Regular/Official kaydı yaratmamalı."""

    def test_commit_does_not_create_phase5_records(self):
        from io import BytesIO
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile
        from apps.documents.models import Document, DocumentType
        from apps.imports.services.import_service import (
            commit_batch, create_import_batch, parse_excel_to_drafts,
        )
        from apps.imports.models import ImportSourceType
        from apps.subscriptions.models import Subscription
        from apps.regular_payments.models import RegularPaymentProfile
        from apps.official_payments.models import OfficialPaymentProfile

        u = User.objects.create_user("u_imp5", password="pw")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["A", "B"])
        ws.append(["x", 100])
        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        f = SimpleUploadedFile("imp.xlsx", bio.read())
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=u, document_type=DocumentType.IMPORT_SOURCE)
        batch = create_import_batch(user=u, source_type=ImportSourceType.EXCEL)
        parse_excel_to_drafts(batch=batch, document=doc, user=u)

        before_sub = Subscription.objects.count()
        before_reg = RegularPaymentProfile.objects.count()
        before_off = OfficialPaymentProfile.objects.count()

        result = commit_batch(batch=batch, user=u)
        self.assertFalse(result["domain_commit"])

        self.assertEqual(Subscription.objects.count(), before_sub)
        self.assertEqual(RegularPaymentProfile.objects.count(), before_reg)
        self.assertEqual(OfficialPaymentProfile.objects.count(), before_off)


# ===========================================================================
# Design contract
# ===========================================================================
class DesignContractPhase5Test(TestCase):
    def test_no_dark_mode_no_forbidden_fonts_in_phase5_templates(self):
        import re
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        for app_dir in ["subscriptions", "regular_payments", "official_payments"]:
            d = backend / "templates" / app_dir
            for tpl in d.glob("*.html"):
                content = tpl.read_text(encoding="utf-8").lower()
                self.assertNotIn("prefers-color-scheme: dark", content,
                                 f"{tpl}: dark mode yasak")
                self.assertIsNone(
                    re.search(r"font-family[^;]*\binter\b", content),
                    f"{tpl}: 'Inter' font yasak",
                )
                self.assertNotIn("jetbrains", content, f"{tpl}: 'JetBrains' yasak")

    def test_sidebar_links_exist(self):
        u = User.objects.create_user("vw", password="pw")
        self.client.force_login(u)
        res = self.client.get(reverse("dashboard:home"))
        # Sol menüde 3 link
        self.assertContains(res, 'href="/subscriptions/"')
        self.assertContains(res, 'href="/regular-payments/"')
        self.assertContains(res, 'href="/official-payments/"')
