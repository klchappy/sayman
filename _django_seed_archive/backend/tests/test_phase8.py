"""
Faz 8 — Teminat Mektupları & Komisyon Manual MVP testleri.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.finance.models import PayableItem, PayableStatus
from apps.parties.models import Bank, Company, Institution
from apps.guarantees.models import (
    CommissionPeriodKind, CommissionStatus, GuaranteeCommissionPeriod,
    GuaranteeDocument, GuaranteeDocumentRole, GuaranteeLetter, GuaranteeStatus,
    GuaranteeType,
)
from apps.guarantees.services.guarantees import (
    archive_guarantee, attach_guarantee_document, calculate_commission_amount,
    cancel_commission_period, cancel_guarantee, create_commission_period,
    create_guarantee, create_payable_from_commission,
    generate_commission_periods, renew_guarantee, restore_guarantee,
    return_guarantee, update_guarantee,
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


def _bank(name="Garanti BBVA"):
    return Bank.objects.create(name=name)


def _institution(name="İSKİ"):
    return Institution.objects.get_or_create(name=name)[0]


def _guarantee(user=None, **kwargs):
    user = user or _user()
    kwargs.setdefault("letter_no", "TM-2025-0001")
    kwargs.setdefault("title", "Test Teminat")
    kwargs.setdefault("amount", Decimal("100000"))
    kwargs.setdefault("commission_period", CommissionPeriodKind.QUARTERLY)
    kwargs.setdefault("commission_rate", Decimal("4.00"))
    kwargs.setdefault("issue_date", date(2025, 1, 1))
    kwargs.setdefault("expiry_date", date(2026, 1, 1))
    kwargs.setdefault("bank", _bank("Garanti " + kwargs["letter_no"]))
    return create_guarantee(user=user, **kwargs)


# ===========================================================================
# Lifecycle
# ===========================================================================
class GuaranteeLifecycleTest(TestCase):
    def test_create_writes_audit(self):
        u = _user()
        g = _guarantee(user=u)
        self.assertTrue(
            AuditLog.objects.filter(object_id=str(g.pk), action="CREATE").exists()
        )

    def test_update(self):
        u = _user()
        g = _guarantee(user=u)
        update_guarantee(guarantee=g, user=u, title="Yeni başlık")
        g.refresh_from_db()
        self.assertEqual(g.title, "Yeni başlık")

    def test_archive_restore(self):
        u = _user()
        g = _guarantee(user=u)
        archive_guarantee(guarantee=g, user=u, reason="x")
        g.refresh_from_db()
        self.assertFalse(g.is_active)
        restore_guarantee(guarantee=g, user=u)
        g.refresh_from_db()
        self.assertTrue(g.is_active)

    def test_cancel_sets_status_and_cascades(self):
        u = _user()
        g = _guarantee(user=u)
        cp = create_commission_period(
            guarantee=g, user=u, period_label="2025-Q1",
            due_date=date(2025, 3, 31), commission_amount=Decimal("1000"),
        )
        cancel_guarantee(guarantee=g, user=u, reason="hata")
        g.refresh_from_db(); cp.refresh_from_db()
        self.assertEqual(g.status, GuaranteeStatus.CANCELLED)
        self.assertEqual(cp.status, CommissionStatus.CANCELLED)

    def test_return_sets_status(self):
        u = _user()
        g = _guarantee(user=u)
        return_guarantee(guarantee=g, user=u, returned_at=date(2026, 3, 1))
        g.refresh_from_db()
        self.assertEqual(g.status, GuaranteeStatus.RETURNED)
        self.assertEqual(g.returned_at, date(2026, 3, 1))

    def test_return_blocks_repeat(self):
        u = _user()
        g = _guarantee(user=u)
        return_guarantee(guarantee=g, user=u, returned_at=date(2026, 3, 1))
        with self.assertRaises(ValidationError):
            return_guarantee(guarantee=g, user=u, returned_at=date(2026, 4, 1))

    def test_renew_links_old_new(self):
        u = _user()
        old = _guarantee(user=u, letter_no="OLD-1")
        new = renew_guarantee(
            old=old, user=u, letter_no="NEW-1", title="Yenilendi",
            amount=Decimal("100000"),
            commission_period=CommissionPeriodKind.QUARTERLY,
        )
        old.refresh_from_db()
        self.assertEqual(old.status, GuaranteeStatus.RENEWED)
        self.assertEqual(old.renewed_to_id, new.pk)
        self.assertEqual(new.renewed_from_id, old.pk)

    def test_renew_blocked_when_closed(self):
        u = _user()
        g = _guarantee(user=u)
        cancel_guarantee(guarantee=g, user=u)
        with self.assertRaises(ValidationError):
            renew_guarantee(old=g, user=u, letter_no="N1", title="t", amount=Decimal("1"))


# ===========================================================================
# Commission Periods
# ===========================================================================
class CommissionPeriodTest(TestCase):
    def test_create_period(self):
        u = _user()
        g = _guarantee(user=u)
        cp = create_commission_period(
            guarantee=g, user=u, period_label="2025-Q2",
            due_date=date(2025, 6, 30), commission_amount=Decimal("1000"),
        )
        self.assertEqual(cp.commission_amount, Decimal("1000.00"))

    def test_unique_label(self):
        u = _user()
        g = _guarantee(user=u)
        create_commission_period(
            guarantee=g, user=u, period_label="2025-Q2",
            due_date=date(2025, 6, 30), commission_amount=Decimal("1"),
        )
        with self.assertRaises(ValidationError):
            create_commission_period(
                guarantee=g, user=u, period_label="2025-Q2",
                due_date=date(2025, 6, 30), commission_amount=Decimal("2"),
            )

    def test_returned_blocks_new_period(self):
        u = _user()
        g = _guarantee(user=u)
        return_guarantee(guarantee=g, user=u, returned_at=date(2025, 5, 1))
        with self.assertRaises(ValidationError):
            create_commission_period(
                guarantee=g, user=u, period_label="2025-Q3",
                due_date=date(2025, 9, 30), commission_amount=Decimal("100"),
            )

    def test_cancelled_blocks_new_period(self):
        u = _user()
        g = _guarantee(user=u)
        cancel_guarantee(guarantee=g, user=u)
        with self.assertRaises(ValidationError):
            create_commission_period(
                guarantee=g, user=u, period_label="X",
                due_date=date(2025, 9, 30), commission_amount=Decimal("100"),
            )

    def test_generate_idempotent(self):
        u = _user()
        g = _guarantee(user=u, issue_date=date.today() + timedelta(days=10))
        c1 = generate_commission_periods(guarantee=g, user=u, months=12)
        c2 = generate_commission_periods(guarantee=g, user=u, months=12)
        self.assertEqual(len(c1), 4)  # quarterly, 12 months -> 4
        self.assertEqual(len(c2), 0)

    def test_calculate_commission_amount(self):
        u = _user()
        g = _guarantee(user=u, amount=Decimal("100000"),
                       commission_rate=Decimal("4.00"),
                       commission_period=CommissionPeriodKind.QUARTERLY)
        amt = calculate_commission_amount(g)
        # 100000 * 4 / 100 / 4 = 1000
        self.assertEqual(amt, Decimal("1000.00"))

    def test_manual_override(self):
        u = _user()
        g = _guarantee(user=u)
        cp = create_commission_period(
            guarantee=g, user=u, period_label="2025-Q3",
            due_date=date(2025, 9, 30),
            commission_amount=Decimal("9999"),  # manuel override
        )
        self.assertEqual(cp.commission_amount, Decimal("9999.00"))


# ===========================================================================
# Payable köprüsü
# ===========================================================================
class CommissionPayableTest(TestCase):
    def setUp(self):
        self.user = _user()
        self.bank = _bank("Akbank-X")
        self.company = Company.objects.create(name="ŞİRKET A.Ş.", short_name="SRKA")
        self.g = create_guarantee(
            user=self.user, letter_no="TM-2025-PAY", title="Pay test",
            amount=Decimal("200000"), commission_rate=Decimal("3.00"),
            commission_period=CommissionPeriodKind.QUARTERLY,
            issue_date=date(2025, 1, 1), expiry_date=date(2026, 1, 1),
            bank=self.bank, owner_company=self.company,
        )
        self.cp = create_commission_period(
            guarantee=self.g, user=self.user, period_label="2025-Q1",
            due_date=date(2025, 3, 31),
            commission_amount=Decimal("1500"),
        )

    def test_create_payable(self):
        payable, created = create_payable_from_commission(
            period=self.cp, user=self.user
        )
        self.assertTrue(created)
        self.assertEqual(payable.amount, Decimal("1500.00"))
        self.assertEqual(payable.category, "GUARANTEE_COMMISSION")
        self.assertEqual(payable.bank_id, self.bank.pk)
        self.cp.refresh_from_db()
        self.assertEqual(self.cp.status, CommissionStatus.LINKED)

    def test_create_payable_idempotent(self):
        p1, c1 = create_payable_from_commission(period=self.cp, user=self.user)
        p2, c2 = create_payable_from_commission(period=self.cp, user=self.user)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(p1.pk, p2.pk)

    def test_cancelled_period_blocks_payable(self):
        cancel_commission_period(period=self.cp, user=self.user)
        with self.assertRaises(ValidationError):
            create_payable_from_commission(period=self.cp, user=self.user)

    def test_returned_guarantee_blocks_payable(self):
        return_guarantee(guarantee=self.g, user=self.user,
                         returned_at=date(2025, 4, 1))
        with self.assertRaises(ValidationError):
            create_payable_from_commission(period=self.cp, user=self.user)

    def test_finance_thresholds_applied(self):
        """Büyük tutar requires_double_approval ve requires_receipt'i tetiklemeli."""
        big = create_commission_period(
            guarantee=self.g, user=self.user, period_label="2025-Q-BIG",
            due_date=date(2025, 6, 30),
            commission_amount=Decimal("60000"),  # > 50K
        )
        payable, _ = create_payable_from_commission(period=big, user=self.user)
        self.assertTrue(payable.requires_double_approval)
        self.assertTrue(payable.requires_receipt)


# ===========================================================================
# Document
# ===========================================================================
class DocumentTest(TestCase):
    def test_attach_dedup(self):
        from apps.documents.models import Document
        from django.core.files.uploadedfile import SimpleUploadedFile
        u = _user()
        g = _guarantee(user=u)
        f = SimpleUploadedFile("teminat.pdf", b"PDFGUARANTEE", content_type="application/pdf")
        doc, _ = Document.get_or_create_from_file(f, title="teminat")
        doc.save()
        d1 = attach_guarantee_document(
            user=u, document=doc,
            document_role=GuaranteeDocumentRole.GUARANTEE_LETTER,
            guarantee=g,
        )
        d2 = attach_guarantee_document(
            user=u, document=doc,
            document_role=GuaranteeDocumentRole.GUARANTEE_LETTER,
            guarantee=g,
        )
        self.assertEqual(d1.pk, d2.pk)

    def test_return_document_attach(self):
        from apps.documents.models import Document
        from django.core.files.uploadedfile import SimpleUploadedFile
        u = _user()
        g = _guarantee(user=u)
        f = SimpleUploadedFile("iade.pdf", b"RETURNDOC", content_type="application/pdf")
        doc, _ = Document.get_or_create_from_file(f, title="iade")
        doc.save()
        d = attach_guarantee_document(
            user=u, document=doc,
            document_role=GuaranteeDocumentRole.RETURN_LETTER,
            guarantee=g,
        )
        self.assertEqual(d.document_role, GuaranteeDocumentRole.RETURN_LETTER)


# ===========================================================================
# Permissions (read-only role cannot create)
# ===========================================================================
class PermissionTest(TestCase):
    def test_viewer_cannot_create(self):
        u = User.objects.create_user("viewer", password="pw12345xx")
        grp, _ = Group.objects.get_or_create(name="goruntuleyici")
        u.groups.add(grp)
        self.client.force_login(u)
        res = self.client.get(reverse("guarantees:create"))
        self.assertEqual(res.status_code, 403)

    def test_muhasebeci_cannot_return(self):
        """Muhasebeci can_write ama can_approve değil → return view 403."""
        u = User.objects.create_user("muh", password="pw12345xx")
        grp, _ = Group.objects.get_or_create(name="muhasebeci")
        u.groups.add(grp)
        g = _guarantee(user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("guarantees:return", kwargs={"pk": g.pk}))
        self.assertEqual(res.status_code, 403)

    def test_super_admin_can_return(self):
        u = _user("super1")
        g = _guarantee(user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("guarantees:return", kwargs={"pk": g.pk}))
        self.assertEqual(res.status_code, 200)


# ===========================================================================
# View / smoke
# ===========================================================================
class ListViewTest(TestCase):
    def test_list_loads(self):
        u = _user()
        _guarantee(user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("guarantees:list"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Teminat Mektupları")


# ===========================================================================
# Sidebar + Dashboard widget
# ===========================================================================
class SidebarAndWidgetTest(TestCase):
    def test_sidebar_link_active(self):
        u = _user()
        self.client.force_login(u)
        res = self.client.get(reverse("dashboard:home"))
        self.assertContains(res, "/guarantees/")
        self.assertNotContains(res, "Faz 8'de aktif")  # eski placeholder gitmiş olmalı

    def test_widget_renders(self):
        u = _user()
        _guarantee(user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("dashboard:home"))
        self.assertContains(res, "Teminat Mektupları & Komisyon")


# ===========================================================================
# Design contract
# ===========================================================================
class DesignContractTest(TestCase):
    def test_no_dark_mode_no_forbidden_fonts(self):
        import re
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        d = backend / "templates" / "guarantees"
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
    def test_no_import_command_in_guarantees(self):
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        cmd_dir = backend / "apps" / "guarantees" / "management" / "commands"
        files = list(cmd_dir.glob("*.py")) if cmd_dir.exists() else []
        non_init = [f for f in files if f.name != "__init__.py"]
        self.assertEqual(non_init, [],
                         "Faz 8 manual MVP — guarantees altında import command olmamalı")

    def test_no_telegram_in_guarantees(self):
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        for sub in ["apps/guarantees", "templates/guarantees"]:
            d = backend / sub
            for f in d.rglob("*"):
                if f.is_file() and f.suffix in (".py", ".html"):
                    content = f.read_text(encoding="utf-8").lower()
                    self.assertNotIn("telegram", content, f"{f}: Telegram yasak (Faz 8)")

    def test_imports_commit_does_not_create_guarantee(self):
        """Import commit hâlâ NO-OP — guarantee kaydı yaratmamalı."""
        # Hızlı kontrol: imports app'inde 'GuaranteeLetter.objects.create' geçmiyor.
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        imports_dir = backend / "apps" / "imports"
        for f in imports_dir.rglob("*.py"):
            content = f.read_text(encoding="utf-8")
            self.assertNotIn("GuaranteeLetter.objects.create", content,
                             f"{f}: imports app guarantee kaydı yaratmamalı")
