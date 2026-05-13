"""
Faz 9 — Entegratör/Yazılım Hizmeti & Kontör Manual MVP testleri.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.finance.models import PayableItem
from apps.integrators.models import (
    ContractStatus, ContractType, CreditPackage, CreditPackageStatus,
    IntegratorDocumentRole, ProviderType, ServiceContract, ServiceStatus,
    ServiceType, SoftwareService,
)
from apps.integrators.services.integrators import (
    archive_service, attach_integrator_document, calculate_contract_status,
    calculate_credit_status, cancel_contract, cancel_credit_package,
    cancel_service, create_contract, create_credit_package,
    create_payable_from_contract, create_payable_from_credit_package,
    create_service, renew_contract, restore_service, update_contract,
    update_credit_usage, update_service,
)


def _user(name="u", groups=("super_admin",), super_user=True):
    u = User.objects.create_user(name, password="pw12345xx")
    if super_user:
        u.is_superuser = True
        u.save()
    for g in groups:
        grp, _ = Group.objects.get_or_create(name=g)
        u.groups.add(grp)
    return u


def _service(user=None, **kwargs):
    user = user or _user()
    kwargs.setdefault("provider_name", "ETA Bilgi Yönetimi")
    kwargs.setdefault("provider_type", ProviderType.ETA)
    kwargs.setdefault("service_type", ServiceType.ACCOUNTING_SOFTWARE)
    kwargs.setdefault("title", "ETA SQL")
    return create_service(user=user, **kwargs)


def _contract(user=None, service=None, **kwargs):
    user = user or _user("c-user")
    service = service or _service(user=user)
    kwargs.setdefault("contract_type", ContractType.ANNUAL)
    kwargs.setdefault("title", "2025 Yıllık")
    kwargs.setdefault("start_date", date(2025, 1, 1))
    kwargs.setdefault("end_date", date(2025, 12, 31))
    kwargs.setdefault("renewal_date", date(2025, 12, 31))
    kwargs.setdefault("amount", Decimal("12000"))
    return create_contract(service=service, user=user, **kwargs)


def _credit(user=None, service=None, **kwargs):
    user = user or _user("k-user")
    service = service or _service(user=user, title="e-Fatura ETA")
    kwargs.setdefault("package_name", "1000'lik Kontör")
    kwargs.setdefault("purchase_date", date(2025, 6, 1))
    kwargs.setdefault("total_credits", 1000)
    kwargs.setdefault("remaining_credits", 1000)
    kwargs.setdefault("critical_threshold", 100)
    kwargs.setdefault("amount", Decimal("3500"))
    return create_credit_package(service=service, user=user, **kwargs)


# ===========================================================================
# SoftwareService lifecycle
# ===========================================================================
class ServiceLifecycleTest(TestCase):
    def test_create_writes_audit(self):
        u = _user()
        s = _service(user=u)
        self.assertTrue(
            AuditLog.objects.filter(object_id=str(s.pk), action="CREATE").exists()
        )

    def test_update(self):
        u = _user()
        s = _service(user=u)
        update_service(service=s, user=u, title="ETA SQL Pro")
        s.refresh_from_db()
        self.assertEqual(s.title, "ETA SQL Pro")

    def test_archive_restore(self):
        u = _user()
        s = _service(user=u)
        archive_service(service=s, user=u, reason="x")
        s.refresh_from_db()
        self.assertFalse(s.is_active)
        restore_service(service=s, user=u)
        s.refresh_from_db()
        self.assertTrue(s.is_active)

    def test_cancel_sets_status(self):
        u = _user()
        s = _service(user=u)
        cancel_service(service=s, user=u, reason="lisans bitti")
        s.refresh_from_db()
        self.assertEqual(s.status, ServiceStatus.CANCELLED)


# ===========================================================================
# ServiceContract
# ===========================================================================
class ContractTest(TestCase):
    def test_create_contract(self):
        u = _user()
        c = _contract(user=u)
        self.assertEqual(c.status, ContractStatus.ACTIVE)
        self.assertTrue(
            AuditLog.objects.filter(object_id=str(c.pk), action="CREATE").exists()
        )

    def test_update_contract(self):
        u = _user()
        c = _contract(user=u)
        update_contract(contract=c, user=u, amount=Decimal("13500"))
        c.refresh_from_db()
        self.assertEqual(c.amount, Decimal("13500"))

    def test_cannot_create_contract_for_cancelled_service(self):
        u = _user()
        s = _service(user=u)
        cancel_service(service=s, user=u)
        with self.assertRaises(ValidationError):
            create_contract(
                service=s, user=u,
                contract_type=ContractType.ANNUAL, title="X",
                amount=Decimal("100"),
            )

    def test_calculate_contract_status_approaching(self):
        u = _user()
        today = timezone.localdate()
        c = _contract(
            user=u,
            renewal_date=today + timedelta(days=10),
            end_date=today + timedelta(days=10),
        )
        self.assertEqual(calculate_contract_status(c, today=today),
                          ContractStatus.APPROACHING)

    def test_calculate_contract_status_expired(self):
        u = _user()
        today = timezone.localdate()
        c = _contract(
            user=u,
            renewal_date=today - timedelta(days=1),
            end_date=today - timedelta(days=1),
        )
        self.assertEqual(calculate_contract_status(c, today=today),
                          ContractStatus.EXPIRED)

    def test_renew_contract_links_old_new(self):
        u = _user()
        old = _contract(user=u)
        new = renew_contract(
            old=old, user=u, contract_type=ContractType.ANNUAL,
            title="2026 Yıllık",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
            renewal_date=date(2026, 12, 31), amount=Decimal("13000"),
        )
        old.refresh_from_db()
        self.assertEqual(old.status, ContractStatus.RENEWED)
        self.assertEqual(old.renewed_to_id, new.pk)
        self.assertEqual(new.renewed_from_id, old.pk)

    def test_renew_blocked_when_closed(self):
        u = _user()
        old = _contract(user=u)
        cancel_contract(contract=old, user=u)
        with self.assertRaises(ValidationError):
            renew_contract(old=old, user=u, contract_type=ContractType.ANNUAL,
                            title="x", amount=Decimal("100"))

    def test_cancel_contract(self):
        u = _user()
        c = _contract(user=u)
        cancel_contract(contract=c, user=u, reason="iptal")
        c.refresh_from_db()
        self.assertEqual(c.status, ContractStatus.CANCELLED)


# ===========================================================================
# CreditPackage
# ===========================================================================
class CreditPackageTest(TestCase):
    def test_create_credit_package(self):
        u = _user()
        p = _credit(user=u)
        self.assertEqual(p.total_credits, 1000)
        self.assertEqual(p.remaining_credits, 1000)
        self.assertEqual(p.status, CreditPackageStatus.ACTIVE)

    def test_update_remaining_credits(self):
        u = _user()
        p = _credit(user=u)
        update_credit_usage(package=p, user=u, remaining_credits=400)
        p.refresh_from_db()
        self.assertEqual(p.remaining_credits, 400)
        self.assertEqual(p.status, CreditPackageStatus.ACTIVE)

    def test_critical_threshold_status(self):
        u = _user()
        p = _credit(user=u, critical_threshold=100)
        update_credit_usage(package=p, user=u, remaining_credits=80)
        p.refresh_from_db()
        self.assertEqual(p.status, CreditPackageStatus.CRITICAL)

    def test_exhausted_status(self):
        u = _user()
        p = _credit(user=u)
        update_credit_usage(package=p, user=u, remaining_credits=0)
        p.refresh_from_db()
        self.assertEqual(p.status, CreditPackageStatus.EXHAUSTED)

    def test_remaining_cannot_exceed_total(self):
        u = _user()
        p = _credit(user=u)
        with self.assertRaises(ValidationError):
            update_credit_usage(package=p, user=u, remaining_credits=2000)

    def test_cancel_credit_package(self):
        u = _user()
        p = _credit(user=u)
        cancel_credit_package(package=p, user=u, reason="iade")
        p.refresh_from_db()
        self.assertEqual(p.status, CreditPackageStatus.CANCELLED)

    def test_calculate_credit_status_helper(self):
        u = _user()
        p = _credit(user=u, critical_threshold=200)
        p.remaining_credits = 0
        self.assertEqual(calculate_credit_status(p), CreditPackageStatus.EXHAUSTED)
        p.remaining_credits = 150
        self.assertEqual(calculate_credit_status(p), CreditPackageStatus.CRITICAL)
        p.remaining_credits = 800
        self.assertEqual(calculate_credit_status(p), CreditPackageStatus.ACTIVE)


# ===========================================================================
# Payable bağlama
# ===========================================================================
class PayableLinkTest(TestCase):
    def test_create_payable_from_contract(self):
        u = _user()
        c = _contract(user=u)
        payable, created = create_payable_from_contract(contract=c, user=u)
        self.assertTrue(created)
        c.refresh_from_db()
        self.assertEqual(c.payable_id, payable.pk)
        self.assertEqual(payable.amount, Decimal("12000.00"))
        self.assertEqual(payable.category, "INTEGRATOR_CONTRACT")

    def test_payable_idempotent_contract(self):
        u = _user()
        c = _contract(user=u)
        p1, _ = create_payable_from_contract(contract=c, user=u)
        p2, created2 = create_payable_from_contract(contract=c, user=u)
        self.assertEqual(p1.pk, p2.pk)
        self.assertFalse(created2)

    def test_create_payable_from_credit_package(self):
        u = _user()
        p = _credit(user=u)
        payable, created = create_payable_from_credit_package(package=p, user=u)
        self.assertTrue(created)
        p.refresh_from_db()
        self.assertEqual(p.payable_id, payable.pk)
        self.assertEqual(payable.category, "CREDIT_PACKAGE")

    def test_payable_idempotent_credit(self):
        u = _user()
        p = _credit(user=u)
        p1, _ = create_payable_from_credit_package(package=p, user=u)
        p2, created2 = create_payable_from_credit_package(package=p, user=u)
        self.assertEqual(p1.pk, p2.pk)
        self.assertFalse(created2)

    def test_cancelled_contract_blocks_payable(self):
        u = _user()
        c = _contract(user=u)
        cancel_contract(contract=c, user=u)
        with self.assertRaises(ValidationError):
            create_payable_from_contract(contract=c, user=u)

    def test_cancelled_credit_blocks_payable(self):
        u = _user()
        p = _credit(user=u)
        cancel_credit_package(package=p, user=u)
        with self.assertRaises(ValidationError):
            create_payable_from_credit_package(package=p, user=u)

    def test_finance_thresholds_applied(self):
        """60K tutarı için requires_double_approval ve requires_receipt True olmalı."""
        u = _user()
        c = _contract(user=u, amount=Decimal("60000"))
        payable, _ = create_payable_from_contract(contract=c, user=u)
        self.assertTrue(payable.requires_receipt)
        self.assertTrue(payable.requires_double_approval)


# ===========================================================================
# Document
# ===========================================================================
class DocumentTest(TestCase):
    def test_attach_dedup(self):
        from apps.documents.models import Document
        from django.core.files.uploadedfile import SimpleUploadedFile
        u = _user()
        s = _service(user=u)
        f = SimpleUploadedFile("contract.pdf", b"PDFCONTRACT-V1",
                                 content_type="application/pdf")
        doc, _ = Document.get_or_create_from_file(f, title="contract")
        doc.save()
        d1 = attach_integrator_document(
            user=u, document=doc,
            document_role=IntegratorDocumentRole.CONTRACT, service=s,
        )
        d2 = attach_integrator_document(
            user=u, document=doc,
            document_role=IntegratorDocumentRole.CONTRACT, service=s,
        )
        self.assertEqual(d1.pk, d2.pk)

    def test_credit_purchase_attach(self):
        from apps.documents.models import Document
        from django.core.files.uploadedfile import SimpleUploadedFile
        u = _user()
        p = _credit(user=u)
        f = SimpleUploadedFile("credit.pdf", b"KONTORDOC", content_type="application/pdf")
        doc, _ = Document.get_or_create_from_file(f, title="credit")
        doc.save()
        d = attach_integrator_document(
            user=u, document=doc,
            document_role=IntegratorDocumentRole.CREDIT_PURCHASE,
            credit_package=p,
        )
        self.assertEqual(d.document_role, IntegratorDocumentRole.CREDIT_PURCHASE)


# ===========================================================================
# Permissions
# ===========================================================================
class PermissionTest(TestCase):
    def test_viewer_cannot_create(self):
        u = User.objects.create_user("viewer", password="pw12345xx")
        grp, _ = Group.objects.get_or_create(name="goruntuleyici")
        u.groups.add(grp)
        self.client.force_login(u)
        res = self.client.get(reverse("integrators:create"))
        self.assertEqual(res.status_code, 403)

    def test_muhasebeci_cannot_renew(self):
        """Muhasebeci can_write var ama can_approve yok → renew 403."""
        u = User.objects.create_user("muh", password="pw12345xx")
        grp, _ = Group.objects.get_or_create(name="muhasebeci")
        u.groups.add(grp)
        c = _contract(user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("integrators:contract_renew",
                                        kwargs={"pk": c.pk}))
        self.assertEqual(res.status_code, 403)

    def test_super_admin_can_renew(self):
        u = _user("super1")
        c = _contract(user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("integrators:contract_renew",
                                        kwargs={"pk": c.pk}))
        self.assertEqual(res.status_code, 200)


# ===========================================================================
# Smoke / list
# ===========================================================================
class ListViewTest(TestCase):
    def test_list_loads(self):
        u = _user()
        _service(user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("integrators:list"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Entegratör & Kontör")


# ===========================================================================
# Sidebar + Dashboard widget
# ===========================================================================
class SidebarAndWidgetTest(TestCase):
    def test_sidebar_link_active(self):
        u = _user()
        self.client.force_login(u)
        res = self.client.get(reverse("dashboard:home"))
        self.assertContains(res, "/integrators/")
        self.assertNotContains(res, "Faz 9'da aktif (MVP-2)")

    def test_widget_renders(self):
        u = _user()
        _service(user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("dashboard:home"))
        self.assertContains(res, "Entegratör & Kontör")


# ===========================================================================
# Design contract
# ===========================================================================
class DesignContractTest(TestCase):
    def test_no_dark_mode_no_forbidden_fonts(self):
        import re
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        d = backend / "templates" / "integrators"
        for tpl in d.glob("*.html"):
            content = tpl.read_text(encoding="utf-8").lower()
            self.assertNotIn("prefers-color-scheme: dark", content,
                              f"{tpl}: dark mode yasak")
            self.assertIsNone(
                re.search(r"font-family[^;]*\binter\b", content),
                f"{tpl}: 'Inter' font yasak",
            )
            self.assertNotIn("jetbrains", content, f"{tpl}: 'JetBrains' yasak")


# ===========================================================================
# NO-OP guards
# ===========================================================================
class NoOpGuardTest(TestCase):
    def test_no_import_command_in_integrators(self):
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        cmd_dir = backend / "apps" / "integrators" / "management" / "commands"
        files = list(cmd_dir.glob("*.py")) if cmd_dir.exists() else []
        non_init = [f for f in files if f.name != "__init__.py"]
        self.assertEqual(non_init, [],
                          "Faz 9 manual MVP — integrators altında import command olmamalı")

    def test_no_telegram_in_integrators(self):
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        for sub in ["apps/integrators", "templates/integrators"]:
            d = backend / sub
            for f in d.rglob("*"):
                if f.is_file() and f.suffix in (".py", ".html"):
                    content = f.read_text(encoding="utf-8").lower()
                    self.assertNotIn("telegram", content,
                                      f"{f}: Telegram yasak (Faz 9)")

    def test_imports_commit_does_not_create_integrator_records(self):
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        imports_dir = backend / "apps" / "imports"
        for f in imports_dir.rglob("*.py"):
            content = f.read_text(encoding="utf-8")
            for forbidden in ("SoftwareService.objects.create",
                                "ServiceContract.objects.create",
                                "CreditPackage.objects.create"):
                self.assertNotIn(forbidden, content,
                                  f"{f}: imports app integrator kaydı yaratmamalı")
