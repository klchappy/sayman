"""
Faz 2 Base Scaffold smoke tests.

PHASE1_TEST_STRATEGY.md kritik acceptance criteria 18 maddenin
Faz 2'de uygulanabilir alt kümesi.
"""
from pathlib import Path

from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.test import Client, TestCase
from django.urls import reverse

from apps.accounts.roles import ROLES, ROLE_CODES
from apps.audit.models import AuditAction, AuditLog
from apps.audit.services import audit_log
from apps.parties.models import Bank, Company, Institution, Person, PropertyAsset


BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class SystemCheckTest(TestCase):
    def test_django_check_clean(self):
        from io import StringIO
        out = StringIO()
        call_command("check", stdout=out)
        # Django call_command exit code 0 means clean.

    def test_migrations_no_pending(self):
        from io import StringIO
        out = StringIO()
        try:
            call_command("makemigrations", "--dry-run", "--check", stdout=out)
        except SystemExit:
            self.fail("Bekleyen migration var.")


class SeedRolesTest(TestCase):
    def test_seed_roles_creates_6_groups(self):
        call_command("seed_roles", "--quiet")
        self.assertEqual(Group.objects.filter(name__in=ROLE_CODES).count(), 6)
        for r in ROLES:
            self.assertTrue(Group.objects.filter(name=r.code).exists(), r.code)

    def test_seed_roles_idempotent(self):
        call_command("seed_roles", "--quiet")
        before = Group.objects.count()
        call_command("seed_roles", "--quiet")
        after = Group.objects.count()
        self.assertEqual(before, after)

    def test_seed_roles_writes_audit(self):
        call_command("seed_roles", "--quiet")
        self.assertTrue(AuditLog.objects.filter(action="SEED").exists())


class AuthFlowTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpw12345")

    def test_login_url_accessible_anon(self):
        res = self.client.get(reverse("accounts:login"))
        self.assertEqual(res.status_code, 200)

    def test_dashboard_redirects_anon_to_login(self):
        res = self.client.get(reverse("dashboard:home"))
        self.assertIn(res.status_code, (302, 301))
        self.assertIn("/accounts/login/", res.url)

    def test_dashboard_authenticated_200(self):
        self.client.force_login(self.user)
        res = self.client.get(reverse("dashboard:home"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Muhasebe Operasyon")

    def test_login_writes_audit(self):
        before = AuditLog.objects.filter(action="LOGIN").count()
        # Form post (anonymous): LoginView.form_valid içinde audit yazılır
        res = self.client.post(reverse("accounts:login"),
                               {"username": "testuser", "password": "testpw12345"})
        self.assertIn(res.status_code, (302, 301))
        self.assertTrue(AuditLog.objects.filter(action="LOGIN").count() > before)


class PartiesCRUDTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("admin2", "a@a.com", "pw12345xx")
        self.client.force_login(self.user)

    def test_master_index_page(self):
        res = self.client.get(reverse("parties:index"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Şirketler")
        self.assertContains(res, "Bankalar")

    def test_create_company(self):
        res = self.client.post(
            reverse("parties:create", kwargs={"slug": "companies"}),
            {"name": "Acme Tekstil A.Ş.", "short_name": "KT", "tax_number": "1234567890", "notes": ""},
        )
        self.assertIn(res.status_code, (302, 301))
        self.assertTrue(Company.objects.filter(short_name="KT").exists())
        # AuditLog yazıldı mı?
        self.assertTrue(
            AuditLog.objects.filter(action=AuditAction.CREATE, model_name="company").exists()
        )

    def test_archive_restores_softly(self):
        c = Company.objects.create(name="Test Co", short_name="TC")
        res = self.client.post(reverse("parties:archive", kwargs={"slug": "companies", "pk": c.pk}))
        self.assertIn(res.status_code, (302, 301))
        c.refresh_from_db()
        self.assertFalse(c.is_active, "Soft-delete: is_active False olmalı")
        self.assertIsNotNone(c.archived_at)
        # Restore
        res2 = self.client.post(reverse("parties:archive", kwargs={"slug": "companies", "pk": c.pk}))
        c.refresh_from_db()
        self.assertTrue(c.is_active)
        # Audit yazıldı mı?
        self.assertTrue(AuditLog.objects.filter(action="ARCHIVE", object_id=str(c.pk)).exists())
        self.assertTrue(AuditLog.objects.filter(action="RESTORE", object_id=str(c.pk)).exists())

    def test_no_hard_delete_in_url_routes(self):
        from django.urls import resolve
        # Delete URL'in olmadığını doğrula
        from django.urls.exceptions import NoReverseMatch
        with self.assertRaises(NoReverseMatch):
            reverse("parties:delete", kwargs={"slug": "companies", "pk": 1})


class AuditLogTest(TestCase):
    def test_audit_log_helper(self):
        u = User.objects.create_user("audituser", password="pw")
        c = Company.objects.create(name="Test", short_name="T1")
        log = audit_log(actor=u, action="UPDATE", obj=c, summary="Test")
        self.assertEqual(log.action, "UPDATE")
        self.assertEqual(log.actor, u)
        self.assertEqual(log.app_label, "parties")
        self.assertEqual(log.model_name, "company")
        self.assertEqual(log.object_id, str(c.pk))


class DesignContractTest(TestCase):
    """Anayasa Madde 11 + DESIGN_FREEZE: dark mode yok, IBM Plex var, Inter/JetBrains yok."""

    def test_no_dark_mode_in_css(self):
        """Comment'ler hariç hiçbir aktif kuralda dark mode olmamalı."""
        import re
        css = (BACKEND_DIR / "static" / "css" / "app.css").read_text(encoding="utf-8")
        # Tüm CSS comment'lerini sök (/* ... */)
        without_comments = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
        self.assertNotIn(
            "prefers-color-scheme: dark",
            without_comments.lower(),
            "Aktif CSS'te dark mode rule'u yasak (Anayasa 11.1)",
        )

    def test_ibm_plex_in_base_template(self):
        base = (BACKEND_DIR / "templates" / "base.html").read_text(encoding="utf-8")
        self.assertIn("IBM+Plex+Sans", base)
        self.assertIn("IBM+Plex+Mono", base)

    def test_no_forbidden_fonts(self):
        css = (BACKEND_DIR / "static" / "css" / "app.css").read_text(encoding="utf-8")
        base = (BACKEND_DIR / "templates" / "base.html").read_text(encoding="utf-8")
        combined = (css + base).lower()
        # "Inter" markası kontrolü — kelime sınırıyla
        import re
        # 'inter' kelimesi tek başına geçmemeli (font olarak)
        self.assertIsNone(re.search(r"\bfont-family[^;]*\binter\b", combined),
                          "'Inter' font kullanımı yasak (DESIGN_FREEZE)")
        # JetBrains Mono yasak
        self.assertNotIn("jetbrains", combined,
                         "JetBrains font kullanımı yasak (DESIGN_FREEZE)")

    def test_brand_palette_tokens_exist(self):
        css = (BACKEND_DIR / "static" / "css" / "app.css").read_text(encoding="utf-8")
        for token in ["--brand-900", "--brand-700", "--accent-500", "--success-500", "--danger-500"]:
            self.assertIn(token, css, f"{token} eksik")

    def test_chat_widget_placeholder_in_base(self):
        widget = (BACKEND_DIR / "templates" / "includes" / "chat_widget_placeholder.html").read_text(encoding="utf-8")
        self.assertIn("chat-widget", widget)

    def test_payment_threshold_constants(self):
        from django.conf import settings
        self.assertEqual(settings.PAYMENT_DEKONT_REQUIRED_THRESHOLD, 5_000)
        self.assertEqual(settings.PAYMENT_DOUBLE_APPROVAL_THRESHOLD, 50_000)


class HelperTest(TestCase):
    def test_format_money_tr(self):
        from apps.core.helpers import format_money_tr
        self.assertEqual(format_money_tr(1234.56), "₺ 1.234,56")
        self.assertEqual(format_money_tr(0), "₺ 0,00")
        self.assertEqual(format_money_tr(None), "—")

    def test_mask_tc(self):
        from apps.core.helpers import mask_tc
        self.assertEqual(mask_tc("12345678901"), "123***8901")
        self.assertEqual(mask_tc(""), "***")
