"""
Faz 7 — Emlak Vergisi & Mülk Takip Manual MVP testleri.

W-3 PropertyAsset zenginleştirme + properties app + servisler + UI + design contract.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.finance.models import PayableItem, PayableStatus
from apps.parties.models import Person, PropertyAsset
from apps.properties.models import (
    InstallmentStatus, Municipality, PropertyTaxDocument,
    PropertyTaxInstallment, PropertyTaxYear, TaxDocumentRole, TaxYearStatus,
)
from apps.properties.services.property_tax import (
    attach_tax_document, calculate_tax_year_totals, cancel_installment,
    cancel_property_tax_year, create_installment, create_municipality,
    create_payable_from_installment, create_property_asset,
    create_property_tax_year, default_installment_due_date,
    generate_default_installments, mark_property_sold,
)


def _user(name="kullanici"):
    u = User.objects.create_user(name, password="pw12345xx")
    u.is_superuser = True
    u.save()
    return u


def _asset(name="SiteX D-101", **extra):
    extra.setdefault("status", "ACTIVE")
    extra.setdefault("property_type", "APARTMENT")
    return PropertyAsset.objects.create(name=name, **extra)


# ===========================================================================
# W-3: PropertyAsset zenginleştirme
# ===========================================================================
class PropertyAssetW3Test(TestCase):
    def test_default_status_active(self):
        a = _asset()
        self.assertEqual(a.status, "ACTIVE")

    def test_property_types_choices(self):
        a = _asset(name="Arsa", property_type="LAND")
        self.assertEqual(a.property_type, "LAND")

    def test_owner_person_fk(self):
        p = Person.objects.create(full_name="Test Kullanıcı")
        a = _asset(owner_type="PERSON", owner_person=p)
        self.assertEqual(a.owner_label, "Test Kullanıcı")

    def test_mark_sold_keeps_history(self):
        u = _user()
        a = create_property_asset(user=u, name="Daire-X")
        ty = create_property_tax_year(
            user=u, property_asset=a, tax_year=2024,
            total_accrual_amount=Decimal("1000"),
        )
        mark_property_sold(asset=a, user=u, sale_date=date(2026, 4, 1),
                           buyer_name="Yeni Sahip")
        a.refresh_from_db()
        self.assertEqual(a.status, "SOLD")
        self.assertEqual(a.buyer_name, "Yeni Sahip")
        # geçmiş yıl korunmalı
        self.assertTrue(PropertyTaxYear.objects.filter(pk=ty.pk).exists())

    def test_create_property_asset_writes_audit(self):
        u = _user()
        a = create_property_asset(user=u, name="Ofis-1", property_type="OFFICE")
        self.assertTrue(
            AuditLog.objects.filter(object_id=str(a.pk), action="CREATE").exists()
        )

    def test_unlimited_property_addition(self):
        u = _user()
        for i in range(5):
            create_property_asset(user=u, name=f"Mülk-{i}")
        self.assertEqual(PropertyAsset.objects.count(), 5)


# ===========================================================================
# Municipality
# ===========================================================================
class MunicipalityTest(TestCase):
    def test_create(self):
        u = _user()
        m = create_municipality(user=u, name="Beşiktaş Belediyesi",
                                province="İstanbul", district="Beşiktaş")
        self.assertEqual(m.name, "Beşiktaş Belediyesi")

    def test_unique_triple(self):
        Municipality.objects.create(name="X", province="İst", district="Y")
        with self.assertRaises(Exception):
            Municipality.objects.create(name="X", province="İst", district="Y")


# ===========================================================================
# PropertyTaxYear
# ===========================================================================
class PropertyTaxYearTest(TestCase):
    def setUp(self):
        self.user = _user()
        self.asset = _asset()

    def test_create(self):
        ty = create_property_tax_year(
            user=self.user, property_asset=self.asset, tax_year=2025,
            total_accrual_amount=Decimal("2400"),
        )
        self.assertEqual(ty.tax_year, 2025)
        self.assertEqual(ty.remaining_amount, Decimal("2400"))

    def test_unique_per_property_year(self):
        create_property_tax_year(
            user=self.user, property_asset=self.asset, tax_year=2025,
            total_accrual_amount=Decimal("2400"),
        )
        with self.assertRaises(ValidationError):
            create_property_tax_year(
                user=self.user, property_asset=self.asset, tax_year=2025,
            )

    def test_cancel_cascades(self):
        ty = create_property_tax_year(
            user=self.user, property_asset=self.asset, tax_year=2025,
            total_accrual_amount=Decimal("1000"),
        )
        generate_default_installments(tax_year=ty, user=self.user)
        cancel_property_tax_year(tax_year=ty, user=self.user, reason="hata")
        ty.refresh_from_db()
        self.assertEqual(ty.status, TaxYearStatus.CANCELLED)
        for i in ty.installments.all():
            self.assertEqual(i.status, InstallmentStatus.CANCELLED)


# ===========================================================================
# Default due date kuralı
# ===========================================================================
class DefaultDueDateTest(TestCase):
    def test_first_installment_may_31(self):
        d = default_installment_due_date(2025, 1)
        self.assertEqual(d, date(2025, 5, 31))

    def test_second_installment_nov_30(self):
        d = default_installment_due_date(2025, 2)
        self.assertEqual(d, date(2025, 11, 30))

    def test_other_falls_to_nov(self):
        d = default_installment_due_date(2025, 0)
        self.assertEqual(d, date(2025, 11, 30))


# ===========================================================================
# Installment + idempotency + totals
# ===========================================================================
class InstallmentTest(TestCase):
    def setUp(self):
        self.user = _user()
        self.asset = _asset()
        self.ty = create_property_tax_year(
            user=self.user, property_asset=self.asset, tax_year=2025,
            total_accrual_amount=Decimal("2400"),
        )

    def test_generate_default_installments(self):
        created = generate_default_installments(tax_year=self.ty, user=self.user)
        self.assertEqual(len(created), 2)
        self.assertEqual(self.ty.installments.count(), 2)
        i1 = self.ty.installments.get(installment_no=1)
        self.assertEqual(i1.due_date, date(2025, 5, 31))
        self.assertEqual(i1.amount, Decimal("1200.00"))

    def test_generate_idempotent(self):
        generate_default_installments(tax_year=self.ty, user=self.user)
        again = generate_default_installments(tax_year=self.ty, user=self.user)
        self.assertEqual(len(again), 0)
        self.assertEqual(self.ty.installments.count(), 2)

    def test_unique_per_year_no(self):
        generate_default_installments(tax_year=self.ty, user=self.user)
        with self.assertRaises(ValidationError):
            create_installment(
                tax_year=self.ty, user=self.user, installment_no=1,
                amount=Decimal("100"),
            )

    def test_calculate_totals_partial(self):
        generate_default_installments(tax_year=self.ty, user=self.user)
        i1 = self.ty.installments.get(installment_no=1)
        i1.status = InstallmentStatus.PAID
        i1.save()
        calculate_tax_year_totals(self.ty)
        self.ty.refresh_from_db()
        self.assertEqual(self.ty.total_paid_amount, Decimal("1200.00"))
        self.assertEqual(self.ty.remaining_amount, Decimal("1200.00"))
        self.assertEqual(self.ty.status, TaxYearStatus.PARTIAL_PAID)


# ===========================================================================
# Payable bağlama
# ===========================================================================
class InstallmentPayableTest(TestCase):
    def setUp(self):
        self.user = _user()
        self.asset = _asset(owner_type="OTHER")
        self.muni = Municipality.objects.create(name="Şişli Belediyesi")
        self.ty = create_property_tax_year(
            user=self.user, property_asset=self.asset, tax_year=2025,
            municipality=self.muni, total_accrual_amount=Decimal("2000"),
        )
        generate_default_installments(tax_year=self.ty, user=self.user)
        self.inst = self.ty.installments.get(installment_no=1)

    def test_create_payable(self):
        payable, created = create_payable_from_installment(
            installment=self.inst, user=self.user,
        )
        self.assertTrue(created)
        self.assertEqual(payable.amount, Decimal("1000.00"))
        self.assertEqual(payable.category, "EMLAK_VERGISI")
        self.inst.refresh_from_db()
        self.assertEqual(self.inst.status, InstallmentStatus.LINKED)
        self.assertIsNotNone(self.inst.payable_id)

    def test_create_payable_idempotent(self):
        p1, c1 = create_payable_from_installment(installment=self.inst, user=self.user)
        p2, c2 = create_payable_from_installment(installment=self.inst, user=self.user)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(p1.pk, p2.pk)

    def test_cancelled_blocks_payable(self):
        cancel_installment(installment=self.inst, user=self.user, reason="x")
        with self.assertRaises(ValidationError):
            create_payable_from_installment(installment=self.inst, user=self.user)

    def test_zero_amount_blocks_payable(self):
        i2 = self.ty.installments.get(installment_no=2)
        i2.amount = Decimal("0")
        i2.save()
        with self.assertRaises(ValidationError):
            create_payable_from_installment(installment=i2, user=self.user)


# ===========================================================================
# Document
# ===========================================================================
class DocumentTest(TestCase):
    def test_attach_dedup(self):
        from apps.documents.models import Document
        from django.core.files.uploadedfile import SimpleUploadedFile

        user = _user()
        asset = _asset()
        ty = create_property_tax_year(
            user=user, property_asset=asset, tax_year=2025,
            total_accrual_amount=Decimal("1000"),
        )
        f = SimpleUploadedFile("makbuz.pdf", b"PDF-RECEIPT", content_type="application/pdf")
        doc, _ = Document.get_or_create_from_file(f, title="makbuz")
        doc.save()

        d1 = attach_tax_document(
            user=user, document=doc, document_role=TaxDocumentRole.RECEIPT,
            tax_year=ty,
        )
        d2 = attach_tax_document(
            user=user, document=doc, document_role=TaxDocumentRole.RECEIPT,
            tax_year=ty,
        )
        self.assertEqual(d1.pk, d2.pk)


# ===========================================================================
# Permission / view smoke
# ===========================================================================
class ViewPermissionTest(TestCase):
    def test_dashboard_requires_login(self):
        res = self.client.get(reverse("properties:dashboard"))
        self.assertIn(res.status_code, (302, 301))

    def test_dashboard_loads_for_user(self):
        u = _user()
        self.client.force_login(u)
        res = self.client.get(reverse("properties:dashboard"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Emlak Vergisi")

    def test_municipality_list_loads(self):
        u = _user()
        self.client.force_login(u)
        res = self.client.get(reverse("properties:municipality_list"))
        self.assertEqual(res.status_code, 200)


# ===========================================================================
# Sidebar link
# ===========================================================================
class SidebarLinkTest(TestCase):
    def test_emlak_link_active(self):
        u = _user()
        self.client.force_login(u)
        res = self.client.get(reverse("dashboard:home"))
        self.assertContains(res, "/properties/")
        self.assertNotContains(res, "Faz 7'de aktif")  # Eski placeholder kalkmış olmalı


# ===========================================================================
# Dashboard widget
# ===========================================================================
class DashboardWidgetTest(TestCase):
    def test_widget_renders_with_data(self):
        u = _user()
        a = _asset()
        ty = create_property_tax_year(
            user=u, property_asset=a, tax_year=date.today().year,
            total_accrual_amount=Decimal("1000"),
        )
        generate_default_installments(tax_year=ty, user=u)
        self.client.force_login(u)
        res = self.client.get(reverse("dashboard:home"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Emlak Vergisi & Mülk Takip")


# ===========================================================================
# Design contract — dark mode yok, IBM Plex var, Inter/JetBrains yok
# ===========================================================================
class DesignContractTest(TestCase):
    def test_no_dark_mode_no_forbidden_fonts(self):
        import re
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        d = backend / "templates" / "properties"
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
# NO-OP import guard — properties app içinde import komut/dosyası YOK
# ===========================================================================
class NoOpImportTest(TestCase):
    def test_no_import_command_in_properties(self):
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        cmd_dir = backend / "apps" / "properties" / "management" / "commands"
        files = list(cmd_dir.glob("*.py")) if cmd_dir.exists() else []
        non_init = [f for f in files if f.name != "__init__.py"]
        self.assertEqual(non_init, [],
                         "Faz 7 manual MVP — properties altında import command olmamalı")

    def test_no_telegram_in_properties(self):
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        for sub in ["apps/properties", "templates/properties"]:
            d = backend / sub
            for f in d.rglob("*"):
                if f.is_file() and f.suffix in (".py", ".html"):
                    content = f.read_text(encoding="utf-8").lower()
                    self.assertNotIn("telegram", content, f"{f}: Telegram yasak (Faz 7)")
