"""Faz 4 — Fatura/Ödeme MVP testleri."""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.documents.models import Document, DocumentType
from apps.finance.models import (
    DocumentRole,
    OwnerType,
    PayableItem,
    PayableStatus,
    PaymentMethod,
    PaymentTransaction,
    TransactionStatus,
)
from apps.finance.services.payments import (
    PaymentRuleError,
    add_partial_payment,
    approve_payment_transaction,
    archive_payable,
    attach_document,
    create_payable,
    mark_paid,
    reject_payment_transaction,
    requires_double_approval,
    requires_receipt,
    restore_payable,
    update_payable,
)
from apps.parties.models import Bank, Company, Institution


def _make_company(name="Acme Tekstil A.Ş.", short="KT"):
    return Company.objects.create(name=name, short_name=short)


class ThresholdHelpersTest(TestCase):
    def test_requires_receipt_threshold(self):
        self.assertFalse(requires_receipt(Decimal("4999.99")))
        self.assertTrue(requires_receipt(Decimal("5000")))
        self.assertTrue(requires_receipt(Decimal("12500")))

    def test_requires_double_approval_threshold(self):
        self.assertFalse(requires_double_approval(Decimal("49999.99")))
        self.assertTrue(requires_double_approval(Decimal("50000")))


class PayableCRUDTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("u_crud", "a@a.com", "pw12345xx")
        self.company = _make_company()

    def _make(self, amount=Decimal("1000"), due_in_days=5):
        return create_payable(
            user=self.user,
            owner_type=OwnerType.COMPANY,
            company=self.company,
            title="Test fatura",
            due_date=timezone.localdate() + timedelta(days=due_in_days),
            amount=amount,
            payment_method=PaymentMethod.EFT,
        )

    def test_create_payable_writes_audit(self):
        p = self._make(amount=Decimal("1500"))
        self.assertEqual(p.status, PayableStatus.APPROACHING)
        self.assertFalse(p.requires_receipt)
        self.assertFalse(p.requires_double_approval)
        self.assertTrue(AuditLog.objects.filter(model_name="payableitem", action="CREATE").exists())

    def test_create_payable_5k_requires_receipt(self):
        p = self._make(amount=Decimal("5000"))
        self.assertTrue(p.requires_receipt)
        self.assertFalse(p.requires_double_approval)

    def test_create_payable_50k_requires_double_approval(self):
        p = self._make(amount=Decimal("75000"))
        self.assertTrue(p.requires_receipt)
        self.assertTrue(p.requires_double_approval)

    def test_update_payable(self):
        p = self._make(amount=Decimal("1000"))
        update_payable(payable=p, user=self.user, amount=Decimal("8000"), title="Updated")
        p.refresh_from_db()
        self.assertEqual(p.title, "Updated")
        self.assertEqual(p.amount, Decimal("8000"))
        self.assertTrue(p.requires_receipt)

    def test_archive_restore(self):
        p = self._make()
        archive_payable(payable=p, user=self.user, reason="test")
        p.refresh_from_db()
        self.assertFalse(p.is_active)
        self.assertEqual(p.status, PayableStatus.ARCHIVED)
        restore_payable(payable=p, user=self.user)
        p.refresh_from_db()
        self.assertTrue(p.is_active)


class PaymentRulesTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("u_pay", "a@a.com", "pw12345xx")
        self.company = _make_company()
        self.bank = Bank.objects.create(name="Albaraka")

    def _make(self, amount):
        return create_payable(
            user=self.user, owner_type=OwnerType.COMPANY, company=self.company,
            title="Test", due_date=timezone.localdate() + timedelta(days=10),
            amount=Decimal(str(amount)),
        )

    def _receipt(self, name="dekont.pdf", content=b"PDF"):
        f = SimpleUploadedFile(name, content)
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=self.user, document_type=DocumentType.RECEIPT)
        return doc

    def test_mark_paid_small_amount_no_receipt_required(self):
        p = self._make(1000)
        tx = mark_paid(
            payable=p, user=self.user, payment_date=timezone.localdate(),
            payment_method=PaymentMethod.EFT,
        )
        p.refresh_from_db()
        self.assertEqual(p.status, PayableStatus.PAID)
        self.assertEqual(p.amount_paid, Decimal("1000"))
        self.assertEqual(tx.status, TransactionStatus.APPROVED)

    def test_mark_paid_large_amount_blocks_without_receipt(self):
        p = self._make(8000)
        with self.assertRaises(PaymentRuleError):
            mark_paid(
                payable=p, user=self.user, payment_date=timezone.localdate(),
                payment_method=PaymentMethod.EFT, receipt_document=None,
            )

    def test_mark_paid_large_amount_with_receipt_works(self):
        p = self._make(8000)
        receipt = self._receipt("8k_dekont.pdf", b"AAAA")
        tx = mark_paid(
            payable=p, user=self.user, payment_date=timezone.localdate(),
            payment_method=PaymentMethod.EFT, receipt_document=receipt,
        )
        p.refresh_from_db()
        self.assertEqual(tx.status, TransactionStatus.APPROVED)
        self.assertEqual(p.status, PayableStatus.PAID)

    def test_partial_payment_status(self):
        p = self._make(1000)
        add_partial_payment(
            payable=p, user=self.user, amount=Decimal("400"),
            payment_date=timezone.localdate(), payment_method=PaymentMethod.EFT,
        )
        p.refresh_from_db()
        self.assertEqual(p.amount_paid, Decimal("400"))
        self.assertEqual(p.status, PayableStatus.PARTIAL_PAID)
        # İkinci kısmi
        add_partial_payment(
            payable=p, user=self.user, amount=Decimal("600"),
            payment_date=timezone.localdate(), payment_method=PaymentMethod.EFT,
        )
        p.refresh_from_db()
        self.assertEqual(p.amount_paid, Decimal("1000"))
        self.assertEqual(p.status, PayableStatus.PAID)

    def test_payment_exceeds_amount_blocked(self):
        p = self._make(1000)
        with self.assertRaises(PaymentRuleError):
            add_partial_payment(
                payable=p, user=self.user, amount=Decimal("1500"),
                payment_date=timezone.localdate(), payment_method=PaymentMethod.EFT,
            )

    def test_high_amount_payment_waiting_approval(self):
        """50K+ ödeme: amount_paid HENÜZ değişmez, status WAITING_APPROVAL."""
        p = self._make(75000)
        receipt = self._receipt("75k_dekont.pdf", b"BBBB")
        tx = add_partial_payment(
            payable=p, user=self.user, amount=Decimal("75000"),
            payment_date=timezone.localdate(),
            payment_method=PaymentMethod.EFT, receipt_document=receipt,
        )
        p.refresh_from_db()
        self.assertEqual(tx.status, TransactionStatus.PENDING_APPROVAL)
        self.assertEqual(p.amount_paid, Decimal("0"), "Onay bekleyen ödeme amount_paid'i değiştirmemeli")
        self.assertEqual(p.status, PayableStatus.WAITING_APPROVAL)

    def test_approve_pending_transaction(self):
        # Yetkili: muhasebe_muduru
        approver = User.objects.create_user("approver", password="pw")
        call_command("seed_roles", "--quiet")
        approver.groups.add(Group.objects.get(name="muhasebe_muduru"))

        p = self._make(75000)
        receipt = self._receipt("ap.pdf", b"DDDD")
        tx = add_partial_payment(
            payable=p, user=self.user, amount=Decimal("75000"),
            payment_date=timezone.localdate(),
            payment_method=PaymentMethod.EFT, receipt_document=receipt,
        )
        # Onayla
        approve_payment_transaction(tx=tx, user=approver)
        tx.refresh_from_db()
        p.refresh_from_db()
        self.assertEqual(tx.status, TransactionStatus.APPROVED)
        self.assertEqual(p.amount_paid, Decimal("75000"))
        self.assertEqual(p.status, PayableStatus.PAID)

    def test_reject_pending_transaction(self):
        approver = User.objects.create_user("rejecter", password="pw")
        call_command("seed_roles", "--quiet")
        approver.groups.add(Group.objects.get(name="yonetici"))

        p = self._make(60000)
        receipt = self._receipt("rej.pdf", b"EEEE")
        tx = add_partial_payment(
            payable=p, user=self.user, amount=Decimal("60000"),
            payment_date=timezone.localdate(),
            payment_method=PaymentMethod.EFT, receipt_document=receipt,
        )
        reject_payment_transaction(tx=tx, user=approver, reason="Hatalı tutar")
        tx.refresh_from_db()
        p.refresh_from_db()
        self.assertEqual(tx.status, TransactionStatus.REJECTED)
        self.assertEqual(p.amount_paid, Decimal("0"))

    def test_unauthorized_user_cannot_approve(self):
        p = self._make(60000)
        receipt = self._receipt("una.pdf", b"FFFF")
        tx = add_partial_payment(
            payable=p, user=self.user, amount=Decimal("60000"),
            payment_date=timezone.localdate(),
            payment_method=PaymentMethod.EFT, receipt_document=receipt,
        )
        muhasebeci = User.objects.create_user("muh", password="pw")
        call_command("seed_roles", "--quiet")
        muhasebeci.groups.add(Group.objects.get(name="muhasebeci"))
        with self.assertRaises(PaymentRuleError):
            approve_payment_transaction(tx=tx, user=muhasebeci)


class DocumentAttachTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("u_doc", "a@a.com", "pw12345xx")
        self.payable = create_payable(
            user=self.user, owner_type=OwnerType.COMPANY, company=_make_company(),
            title="Doc test", due_date=timezone.localdate() + timedelta(days=5),
            amount=Decimal("1000"),
        )

    def test_attach_document_dedup(self):
        f = SimpleUploadedFile("inv.pdf", b"INVOICE_PDF")
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=self.user)
        attach_document(payable=self.payable, document=doc, user=self.user, document_role=DocumentRole.INVOICE)

        # Aynı doc + aynı role tekrar bağla — duplicate yaratmaz
        attach_document(payable=self.payable, document=doc, user=self.user, document_role=DocumentRole.INVOICE)
        self.assertEqual(self.payable.documents.count(), 1)

        # Receipt rolü ekle — yeni link
        attach_document(payable=self.payable, document=doc, user=self.user, document_role=DocumentRole.RECEIPT)
        self.assertEqual(self.payable.documents.count(), 2)

    def test_has_receipt_property(self):
        f = SimpleUploadedFile("dek.pdf", b"DEKONT")
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=self.user, document_type=DocumentType.RECEIPT)
        self.assertFalse(self.payable.has_receipt)
        attach_document(payable=self.payable, document=doc, user=self.user, document_role=DocumentRole.RECEIPT)
        self.payable.refresh_from_db()
        self.assertTrue(self.payable.has_receipt)


class ViewPermissionTest(TestCase):
    def setUp(self):
        call_command("seed_roles", "--quiet")
        self.muhasebeci = User.objects.create_user("muh1", password="pw12345xx")
        self.muhasebeci.groups.add(Group.objects.get(name="muhasebeci"))
        self.viewer = User.objects.create_user("viewer1", password="pw12345xx")
        self.viewer.groups.add(Group.objects.get(name="goruntuleyici"))

    def test_anon_redirect(self):
        res = self.client.get(reverse("finance:list"))
        self.assertEqual(res.status_code, 302)

    def test_viewer_can_list_but_not_create(self):
        self.client.force_login(self.viewer)
        res = self.client.get(reverse("finance:list"))
        self.assertEqual(res.status_code, 200)
        # Görüntüleyici yeni kayıt açamaz
        res2 = self.client.get(reverse("finance:create"))
        self.assertEqual(res2.status_code, 403)

    def test_muhasebeci_can_create(self):
        self.client.force_login(self.muhasebeci)
        res = self.client.get(reverse("finance:create"))
        self.assertEqual(res.status_code, 200)


class DashboardFinanceIntegrationTest(TestCase):
    """Dashboard KPI'ları finance verisinden besleniyor mu?"""

    def setUp(self):
        self.user = User.objects.create_superuser("u_dash", "a@a.com", "pw12345xx")
        company = _make_company()
        # 1 bugün ödenecek + 1 geciken kayıt
        create_payable(
            user=self.user, owner_type=OwnerType.COMPANY, company=company,
            title="Bugün", due_date=timezone.localdate(),
            amount=Decimal("3000"),
        )
        create_payable(
            user=self.user, owner_type=OwnerType.COMPANY, company=company,
            title="Geciken", due_date=timezone.localdate() - timedelta(days=10),
            amount=Decimal("4500"),
        )

    def test_dashboard_kpi_reflects_finance(self):
        self.client.force_login(self.user)
        res = self.client.get(reverse("dashboard:home"))
        self.assertEqual(res.status_code, 200)
        # Bugün KPI'da en az "1 kalem" gözükmeli
        self.assertContains(res, "1 kalem")
        # Geciken para tutarı görünmeli (TR format)
        self.assertContains(res, "4.500,00")


class ImportCommitStillNoOpTest(TestCase):
    """Faz 4 sınırı: Import commit hâlâ domain kaydı yaratmamalı."""

    def test_commit_does_not_create_payable(self):
        from io import BytesIO
        import openpyxl
        from apps.imports.services.import_service import (
            commit_batch, create_import_batch, parse_excel_to_drafts,
        )
        from apps.imports.models import ImportSourceType

        u = User.objects.create_user("u_imp", password="pw")

        # Küçük xlsx fixture
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Sahip", "Tutar"])
        ws.append(["X", 1000])
        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        f = SimpleUploadedFile("imp.xlsx", bio.read())
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=u, document_type=DocumentType.IMPORT_SOURCE)
        batch = create_import_batch(user=u, source_type=ImportSourceType.EXCEL)
        parse_excel_to_drafts(batch=batch, document=doc, user=u)

        before = PayableItem.objects.count()
        result = commit_batch(batch=batch, user=u)
        after = PayableItem.objects.count()

        self.assertEqual(before, after, "Import commit PayableItem yaratmamalı (Faz 4 NO-OP)")
        self.assertFalse(result["domain_commit"])


class DesignContractFinanceTest(TestCase):
    """Anayasa Madde 11 + DESIGN_FREEZE: dark mode yok, IBM Plex var, Inter/JetBrains yok."""

    def test_no_dark_mode_and_no_forbidden_fonts_in_finance_templates(self):
        import re
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        finance_templates_dir = backend / "templates" / "finance"
        for tpl in finance_templates_dir.glob("*.html"):
            content = tpl.read_text(encoding="utf-8").lower()
            self.assertNotIn(
                "prefers-color-scheme: dark", content,
                f"{tpl.name}: dark mode yasak",
            )
            self.assertIsNone(
                re.search(r"font-family[^;]*\binter\b", content),
                f"{tpl.name}: 'Inter' font yasak",
            )
            self.assertNotIn("jetbrains", content, f"{tpl.name}: 'JetBrains' yasak")
