"""
Faz 6 — SiteX Daire/Aidat Manual MVP + Lifecycle (W-1, W-2) testleri.
"""
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib.auth.models import Group, User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.core.models import SystemSetting
from apps.documents.models import Document
from apps.finance.models import (PayableItem, PayableStatus,
                                 PaymentTransaction, TransactionStatus)
from apps.finance.services.payments import (PaymentRuleError, add_partial_payment,
                                             cancel_payable, create_payable,
                                             mark_paid)
from apps.parties.models import Person
from apps.pruva.models import (AidatDifferenceDirection, PruvaAidatDifference,
                                PruvaSiteDocument, PruvaStatement,
                                PruvaStatementDocument, PruvaUnit, SiteDocumentType,
                                StatementDocumentRole, StatementStatus, UnitStatus)
from apps.pruva.services.pruva import (archive_unit, attach_site_document,
                                        attach_statement_document,
                                        cancel_aidat_difference, cancel_statement,
                                        create_aidat_difference,
                                        create_payable_from_statement,
                                        create_statement, create_unit,
                                        default_due_date, mark_unit_sold,
                                        restore_unit, update_statement, update_unit,
                                        calculate_statement_total)


def _make_user(username="u1", is_super=True):
    u = User.objects.create_user(username, password="pw12345xx")
    if is_super:
        u.is_superuser = True
        u.save()
    return u


def _make_unit(code="A4.17", **extra):
    extra.setdefault("default_due_day", 20)
    return PruvaUnit.objects.create(code=code, **extra)


def _make_doc(name="ekstre.pdf", content=b"PDF-DATA"):
    f = SimpleUploadedFile(name, content, content_type="application/pdf")
    doc, _ = Document.get_or_create_from_file(f, title=name)
    doc.save()
    return doc


# ===========================================================================
# W-1: cancel_payable + state guard
# ===========================================================================
class CancelPayableTest(TestCase):
    def setUp(self):
        self.user = _make_user("cancel_u")
        self.payable = create_payable(
            user=self.user,
            owner_type="OTHER",
            title="Test fatura", category="TEST",
            due_date=date.today() + timedelta(days=10),
            amount=Decimal("3000"),
        )

    def test_cancel_sets_status(self):
        cancel_payable(payable=self.payable, user=self.user, reason="hatalı kayıt")
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.status, PayableStatus.CANCELLED)

    def test_cancel_writes_audit(self):
        cancel_payable(payable=self.payable, user=self.user, reason="dup")
        self.assertTrue(
            AuditLog.objects.filter(
                object_id=str(self.payable.pk),
                metadata__event="CANCEL_PAYABLE",
            ).exists()
        )

    def test_cancelled_blocks_mark_paid(self):
        cancel_payable(payable=self.payable, user=self.user, reason="x")
        with self.assertRaises(PaymentRuleError):
            mark_paid(payable=self.payable, user=self.user)

    def test_cancelled_blocks_partial_payment(self):
        cancel_payable(payable=self.payable, user=self.user)
        with self.assertRaises(PaymentRuleError):
            add_partial_payment(
                payable=self.payable, user=self.user,
                amount=Decimal("1000"), payment_date=date.today(),
            )

    def test_cancel_idempotent_call(self):
        cancel_payable(payable=self.payable, user=self.user)
        cancel_payable(payable=self.payable, user=self.user)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.status, PayableStatus.CANCELLED)

    def test_paid_payable_cannot_be_cancelled(self):
        # Düşük tutar → tek seferde APPROVED + PAID
        small = create_payable(
            user=self.user, owner_type="OTHER",
            title="Küçük", category="X",
            due_date=date.today() + timedelta(days=5),
            amount=Decimal("100"),
        )
        mark_paid(payable=small, user=self.user)
        small.refresh_from_db()
        self.assertEqual(small.status, PayableStatus.PAID)
        with self.assertRaises(PaymentRuleError):
            cancel_payable(payable=small, user=self.user)

    def test_pending_approval_blocks_cancel(self):
        big = create_payable(
            user=self.user, owner_type="OTHER",
            title="Yüksek", category="X",
            due_date=date.today() + timedelta(days=5),
            amount=Decimal("60000"),
        )
        # 60K → PENDING_APPROVAL tx + WAITING_APPROVAL state
        receipt = _make_doc("dekont.pdf")
        add_partial_payment(
            payable=big, user=self.user,
            amount=Decimal("60000"),
            payment_date=date.today(), receipt_document=receipt,
        )
        big.refresh_from_db()
        self.assertEqual(big.status, PayableStatus.WAITING_APPROVAL)
        with self.assertRaises(PaymentRuleError):
            cancel_payable(payable=big, user=self.user)


# ===========================================================================
# W-2: seed_settings idempotent
# ===========================================================================
class SeedSettingsTest(TestCase):
    def test_first_run_creates_three(self):
        SystemSetting.objects.all().delete()
        call_command("seed_settings", "--quiet")
        keys = set(SystemSetting.objects.values_list("key", flat=True))
        self.assertSetEqual(
            keys,
            {"PAYMENT_DEKONT_REQUIRED_THRESHOLD",
             "PAYMENT_DOUBLE_APPROVAL_THRESHOLD",
             "DEFAULT_CURRENCY"},
        )

    def test_idempotent_does_not_overwrite(self):
        SystemSetting.objects.all().delete()
        call_command("seed_settings", "--quiet")
        # Manuel override
        s = SystemSetting.objects.get(key="PAYMENT_DEKONT_REQUIRED_THRESHOLD")
        s.value = "9999"
        s.save()
        # Tekrar çağır
        call_command("seed_settings", "--quiet")
        s.refresh_from_db()
        self.assertEqual(s.value, "9999")

    def test_writes_audit(self):
        SystemSetting.objects.all().delete()
        call_command("seed_settings", "--quiet")
        self.assertTrue(AuditLog.objects.filter(action="SEED").exists())


# ===========================================================================
# seed_pruva_units idempotent + extensibility
# ===========================================================================
class SeedPruvaUnitsTest(TestCase):
    def test_creates_five_units(self):
        PruvaUnit.objects.all().delete()
        call_command("seed_pruva_units", "--quiet")
        codes = set(PruvaUnit.objects.values_list("code", flat=True))
        self.assertSetEqual(codes, {"A4.17", "A4.22", "A4.25", "B2.28", "B3.31"})

    def test_idempotent(self):
        PruvaUnit.objects.all().delete()
        call_command("seed_pruva_units", "--quiet")
        call_command("seed_pruva_units", "--quiet")
        self.assertEqual(PruvaUnit.objects.count(), 5)

    def test_sixth_unit_can_be_added(self):
        """Sınırsız genişleme — 6. daire eklenebilir."""
        PruvaUnit.objects.all().delete()
        call_command("seed_pruva_units", "--quiet")
        user = _make_user("ext_u")
        new = create_unit(user=user, code="C1.01", block="C1", unit_no="01",
                          owner_type="PERSON", default_due_day=20)
        self.assertEqual(PruvaUnit.objects.count(), 6)
        self.assertEqual(new.code, "C1.01")

    def test_seed_writes_audit(self):
        PruvaUnit.objects.all().delete()
        call_command("seed_pruva_units", "--quiet")
        self.assertTrue(
            AuditLog.objects.filter(action="SEED",
                                    summary__icontains="seed_pruva_units").exists()
        )


# ===========================================================================
# PruvaUnit CRUD + lifecycle
# ===========================================================================
class PruvaUnitLifecycleTest(TestCase):
    def setUp(self):
        self.user = _make_user("lc_u")

    def test_create_writes_audit(self):
        u = create_unit(user=self.user, code="X1.01", default_due_day=20)
        self.assertTrue(AuditLog.objects.filter(
            action="CREATE", object_id=str(u.pk)).exists())

    def test_archive_restore(self):
        u = create_unit(user=self.user, code="X1.02", default_due_day=20)
        archive_unit(unit=u, user=self.user, reason="test")
        u.refresh_from_db()
        self.assertFalse(u.is_active)
        self.assertEqual(u.status, UnitStatus.PASSIVE)
        restore_unit(unit=u, user=self.user)
        u.refresh_from_db()
        self.assertTrue(u.is_active)
        self.assertEqual(u.status, UnitStatus.ACTIVE)

    def test_mark_sold_keeps_history(self):
        u = create_unit(user=self.user, code="X1.03", default_due_day=20)
        # Eskiye ait ekstre yarat
        s = create_statement(unit=u, user=self.user, year=2025, month=10,
                              aidat_amount=1000)
        mark_unit_sold(unit=u, user=self.user, sale_date=date(2026, 1, 1),
                       buyer_name="Yeni Sahip A")
        u.refresh_from_db()
        s.refresh_from_db()
        self.assertEqual(u.status, UnitStatus.SOLD)
        self.assertEqual(u.buyer_name, "Yeni Sahip A")
        # Eski ekstre korundu
        self.assertEqual(PruvaStatement.objects.filter(unit=u).count(), 1)


# ===========================================================================
# default_due_date helper
# ===========================================================================
class DefaultDueDateTest(TestCase):
    def test_default_day_is_20(self):
        u = _make_unit("DD.01")
        self.assertEqual(default_due_date(2026, 5, u), date(2026, 5, 20))

    def test_overridable_per_unit(self):
        u = _make_unit("DD.02", default_due_day=15)
        self.assertEqual(default_due_date(2026, 5, u), date(2026, 5, 15))

    def test_february_overflow_safe(self):
        u = _make_unit("DD.03", default_due_day=30)
        # Şubat 2025 = 28 gün → 28
        self.assertEqual(default_due_date(2025, 2, u), date(2025, 2, 28))


# ===========================================================================
# Statement: create / total / unique / cancel
# ===========================================================================
class StatementTest(TestCase):
    def setUp(self):
        self.user = _make_user("st_u")
        self.unit = _make_unit("ST.01")

    def test_total_calculation(self):
        total = calculate_statement_total(
            aidat=1000, gider=200, previous_debt=300, penalty=50, other=10,
        )
        self.assertEqual(total, Decimal("1560"))

    def test_create_sets_total_and_period(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=Decimal("1500"),
                              gider_amount=Decimal("200"))
        self.assertEqual(s.total_amount, Decimal("1700"))
        self.assertEqual(s.period_label, "2026-05")
        self.assertEqual(s.due_date, date(2026, 5, 20))

    def test_unique_constraint_blocks_duplicate(self):
        create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                          aidat_amount=1000)
        with self.assertRaises(ValidationError):
            create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=2000)

    def test_invalid_month_rejected(self):
        with self.assertRaises(ValidationError):
            create_statement(unit=self.unit, user=self.user, year=2026, month=13,
                              aidat_amount=1000)

    def test_cancel_statement(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=1000)
        cancel_statement(statement=s, user=self.user, reason="hatalı")
        s.refresh_from_db()
        self.assertEqual(s.status, StatementStatus.CANCELLED)

    def test_update_blocked_after_link(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=6,
                              aidat_amount=1000)
        create_payable_from_statement(statement=s, user=self.user)
        s.refresh_from_db()
        # LINKED durumda update reddedilir
        with self.assertRaises(ValidationError):
            update_statement(statement=s, user=self.user, aidat_amount=2000)


# ===========================================================================
# Statement → PayableItem (period_link)
# ===========================================================================
class StatementToPayableTest(TestCase):
    def setUp(self):
        self.user = _make_user("p2p_u")
        self.unit = _make_unit("P2P.01")

    def test_creates_payable(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=Decimal("3000"))
        payable, created = create_payable_from_statement(statement=s, user=self.user)
        self.assertTrue(created)
        self.assertIsInstance(payable, PayableItem)
        self.assertEqual(payable.amount, Decimal("3000"))
        s.refresh_from_db()
        self.assertEqual(s.status, StatementStatus.LINKED)

    def test_idempotent(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=Decimal("3000"))
        p1, c1 = create_payable_from_statement(statement=s, user=self.user)
        p2, c2 = create_payable_from_statement(statement=s, user=self.user)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(p1.pk, p2.pk)

    def test_5k_threshold_applied(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=Decimal("6000"))
        payable, _ = create_payable_from_statement(statement=s, user=self.user)
        self.assertTrue(payable.requires_receipt)
        self.assertFalse(payable.requires_double_approval)

    def test_50k_threshold_applied(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=Decimal("60000"))
        payable, _ = create_payable_from_statement(statement=s, user=self.user)
        self.assertTrue(payable.requires_receipt)
        self.assertTrue(payable.requires_double_approval)

    def test_zero_total_rejected(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=Decimal("0"))
        with self.assertRaises(ValidationError):
            create_payable_from_statement(statement=s, user=self.user)

    def test_cancelled_statement_rejected(self):
        s = create_statement(unit=self.unit, user=self.user, year=2026, month=5,
                              aidat_amount=Decimal("1000"))
        cancel_statement(statement=s, user=self.user)
        with self.assertRaises(ValidationError):
            create_payable_from_statement(statement=s, user=self.user)


# ===========================================================================
# Document attach + sha256 dedup
# ===========================================================================
class StatementDocumentTest(TestCase):
    def setUp(self):
        self.user = _make_user("doc_u")
        self.unit = _make_unit("DOC.01")
        self.statement = create_statement(unit=self.unit, user=self.user,
                                            year=2026, month=5, aidat_amount=1000)

    def test_attach_document(self):
        doc = _make_doc("e.pdf", content=b"AAA")
        sd = attach_statement_document(statement=self.statement, document=doc,
                                        user=self.user)
        self.assertEqual(sd.statement, self.statement)

    def test_sha256_dedup(self):
        doc1 = _make_doc("e1.pdf", content=b"SAME")
        doc2 = _make_doc("e2.pdf", content=b"SAME")
        # Aynı içerik → aynı Document
        self.assertEqual(doc1.pk, doc2.pk)


# ===========================================================================
# Aidat difference
# ===========================================================================
class AidatDifferenceTest(TestCase):
    def setUp(self):
        self.user = _make_user("ad_u")
        self.unit = _make_unit("AD.01")
        self.person = Person.objects.create(full_name="Test Şahıs")

    def test_create_and_audit(self):
        d = create_aidat_difference(
            user=self.user, unit=self.unit, person=self.person,
            date=date.today(), amount=Decimal("500"),
            direction=AidatDifferenceDirection.PAID_TO_PERSON,
        )
        self.assertTrue(AuditLog.objects.filter(
            action="CREATE", object_id=str(d.pk)).exists())

    def test_cancel(self):
        d = create_aidat_difference(
            user=self.user, unit=self.unit, person=self.person,
            date=date.today(), amount=Decimal("500"),
        )
        cancel_aidat_difference(diff=d, user=self.user, reason="hata")
        d.refresh_from_db()
        self.assertEqual(d.status, "CANCELLED")


# ===========================================================================
# Site document
# ===========================================================================
class SiteDocumentTest(TestCase):
    def test_attach(self):
        user = _make_user("sd_u")
        doc = _make_doc("butce.pdf", content=b"BUDGET")
        sd = attach_site_document(
            user=user, title="2026 Bütçesi", document=doc,
            document_type=SiteDocumentType.BUDGET, year=2026,
        )
        self.assertEqual(sd.document_type, SiteDocumentType.BUDGET)
        self.assertTrue(AuditLog.objects.filter(
            action="CREATE", object_id=str(sd.pk)).exists())


# ===========================================================================
# Permissions
# ===========================================================================
class PruvaPermissionsTest(TestCase):
    def setUp(self):
        call_command("seed_roles", "--quiet")
        self.viewer = User.objects.create_user("viewer6", password="pw12345xx")
        self.viewer.groups.add(Group.objects.get(name="goruntuleyici"))

    def test_anon_redirect_dashboard(self):
        res = self.client.get(reverse("pruva:dashboard"))
        self.assertEqual(res.status_code, 302)

    def test_viewer_can_read_dashboard(self):
        self.client.force_login(self.viewer)
        res = self.client.get(reverse("pruva:dashboard"))
        self.assertEqual(res.status_code, 200)

    def test_viewer_cannot_create_unit(self):
        self.client.force_login(self.viewer)
        res = self.client.get(reverse("pruva:unit_create"))
        self.assertEqual(res.status_code, 403)

    def test_viewer_cannot_create_aidat_difference(self):
        self.client.force_login(self.viewer)
        res = self.client.get(reverse("pruva:aidat_difference_create"))
        self.assertEqual(res.status_code, 403)


# ===========================================================================
# Import commit hâlâ NO-OP (Pruva eklendi, sınır korundu)
# ===========================================================================
class ImportNoOpStillEnforcedPhase6Test(TestCase):
    def test_no_pruva_statement_from_imports(self):
        """Pruva tablolarına import yoluyla kayıt yaratılmadığından emin ol."""
        self.assertEqual(PruvaStatement.objects.count(), 0)
        self.assertEqual(PruvaAidatDifference.objects.count(), 0)
        self.assertEqual(PruvaSiteDocument.objects.count(), 0)
