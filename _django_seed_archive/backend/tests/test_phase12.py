"""
Faz 12 — Raporlama / Excel Export Merkezi MVP testleri.

ReportTemplate / ReportRun lifecycle, preview/export, format coverage,
permission gating (viewer / muhasebeci / manager / AUDIT-restricted),
audit log, dashboard widget, UI contract & no-op guards.
"""
import os
import re
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import Client, TestCase
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.reports.models import (ReportFormat, ReportRun, ReportRunStatus,
                                  ReportTemplate, ReportType)
from apps.reports.services import (can_run_report, cancel_report_run,
                                    create_report_template,
                                    get_available_report_types,
                                    get_recent_exports, preview_report,
                                    run_export, update_report_template)
from apps.reports.services.reporting import (REPORT_DEFINITIONS,
                                              export_to_csv, export_to_xlsx)


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


# ----------------- Template lifecycle -----------------


class ReportTemplateTest(TestCase):
    def setUp(self):
        self.admin = _user("rt_admin")
        self.viewer = _user("rt_viewer", groups=("goruntuleyici",), is_super=False)

    def test_create_report_template(self):
        t = create_report_template(
            name="Geciken Aylık", slug="geciken-aylik",
            report_type=ReportType.PAYABLES, user=self.admin,
        )
        self.assertEqual(t.name, "Geciken Aylık")
        self.assertEqual(t.report_type, ReportType.PAYABLES)
        self.assertTrue(AuditLog.objects.filter(
            app_label="reports", model_name="reporttemplate", action="CREATE",
        ).exists())

    def test_create_template_unknown_type_rejected(self):
        with self.assertRaises(ValidationError):
            create_report_template(
                name="X", slug="x-bad", report_type="UNKNOWN", user=self.admin,
            )

    def test_create_template_viewer_denied(self):
        with self.assertRaises(PermissionDenied):
            create_report_template(
                name="V", slug="v", report_type=ReportType.PAYABLES, user=self.viewer,
            )

    def test_update_report_template(self):
        t = create_report_template(
            name="A", slug="a-slug", report_type=ReportType.TASKS, user=self.admin,
        )
        update_report_template(template=t, user=self.admin, name="A v2")
        t.refresh_from_db()
        self.assertEqual(t.name, "A v2")


# ----------------- Available types -----------------


class AvailableTypesTest(TestCase):
    def test_admin_sees_all_registered(self):
        admin = _user("at_admin")
        avail = get_available_report_types(admin)
        keys = {x["key"] for x in avail}
        self.assertGreaterEqual(len(keys), 8)
        self.assertIn(ReportType.AUDIT, keys)

    def test_writer_does_not_see_audit(self):
        u = _user("at_writer", groups=("muhasebeci",), is_super=False)
        avail = get_available_report_types(u)
        keys = {x["key"] for x in avail}
        self.assertNotIn(ReportType.AUDIT, keys)
        # Yine de en az 7 raporu görmeli
        self.assertGreaterEqual(len(keys), 7)

    def test_viewer_sees_nothing(self):
        v = _user("at_viewer", groups=("goruntuleyici",), is_super=False)
        avail = get_available_report_types(v)
        self.assertEqual(avail, [])


# ----------------- Preview each registered type -----------------


class PreviewTest(TestCase):
    def setUp(self):
        self.admin = _user("pv_admin")

    def test_preview_payables_overdue(self):
        _make_payable(title="X1", due_date=date(2025, 1, 1))
        out = preview_report(ReportType.PAYABLES, {"mode": "overdue"}, self.admin)
        self.assertEqual(out["report_type"], ReportType.PAYABLES)
        self.assertGreaterEqual(out["row_count"], 1)
        self.assertTrue(out["columns"])

    def test_preview_payables_upcoming(self):
        out = preview_report(ReportType.PAYABLES, {"mode": "upcoming", "days": 7}, self.admin)
        self.assertIn("rows", out)
        self.assertIn("columns", out)

    def test_preview_payables_missing_receipt(self):
        out = preview_report(ReportType.PAYABLES, {"mode": "missing_receipt"}, self.admin)
        self.assertIn("rows", out)

    def test_preview_payables_pending_approval(self):
        out = preview_report(ReportType.PAYABLES, {"mode": "pending_approval"}, self.admin)
        self.assertIn("rows", out)

    def test_preview_tasks(self):
        from apps.tasks.services import create_task
        create_task(title="Görev", created_by=self.admin)
        out = preview_report(ReportType.TASKS, {}, self.admin)
        self.assertGreaterEqual(out["row_count"], 1)

    def test_preview_site_dues(self):
        out = preview_report(ReportType.SITE_DUES, {}, self.admin)
        self.assertEqual(out["report_type"], ReportType.SITE_DUES)

    def test_preview_property_tax(self):
        out = preview_report(ReportType.PROPERTY_TAX, {}, self.admin)
        self.assertEqual(out["report_type"], ReportType.PROPERTY_TAX)

    def test_preview_guarantees(self):
        out = preview_report(ReportType.GUARANTEES, {}, self.admin)
        self.assertEqual(out["report_type"], ReportType.GUARANTEES)

    def test_preview_integrators(self):
        out = preview_report(ReportType.INTEGRATORS, {}, self.admin)
        self.assertEqual(out["report_type"], ReportType.INTEGRATORS)

    def test_preview_documents(self):
        out = preview_report(ReportType.DOCUMENTS, {}, self.admin)
        self.assertEqual(out["report_type"], ReportType.DOCUMENTS)

    def test_preview_audit(self):
        out = preview_report(ReportType.AUDIT, {}, self.admin)
        self.assertEqual(out["report_type"], ReportType.AUDIT)


# ----------------- Permission gating -----------------


class PermissionTest(TestCase):
    def test_viewer_cannot_run_any_report(self):
        v = _user("perm_v", groups=("goruntuleyici",), is_super=False)
        for rt in REPORT_DEFINITIONS.keys():
            self.assertFalse(can_run_report(v, rt), f"viewer should not run {rt}")

    def test_audit_only_for_approver(self):
        muh = _user("perm_muh", groups=("muhasebeci",), is_super=False)
        mgr = _user("perm_mgr", groups=("muhasebe_muduru",), is_super=False)
        self.assertFalse(can_run_report(muh, ReportType.AUDIT))
        self.assertTrue(can_run_report(mgr, ReportType.AUDIT))

    def test_writer_can_run_payables(self):
        muh = _user("perm_muh2", groups=("muhasebeci",), is_super=False)
        self.assertTrue(can_run_report(muh, ReportType.PAYABLES))

    def test_preview_denied_for_viewer(self):
        v = _user("perm_v2", groups=("goruntuleyici",), is_super=False)
        with self.assertRaises(PermissionDenied):
            preview_report(ReportType.PAYABLES, {}, v)


# ----------------- Export XLSX/CSV -----------------


class XlsxExportTest(TestCase):
    def setUp(self):
        self.admin = _user("xe_admin")
        _make_payable(title="A", due_date=date(2025, 1, 1))

    def test_xlsx_export_creates_completed_run(self):
        run = run_export(
            report_type=ReportType.PAYABLES,
            filters={"mode": "overdue"},
            fmt=ReportFormat.XLSX, user=self.admin,
        )
        self.assertEqual(run.status, ReportRunStatus.COMPLETED)
        self.assertTrue(run.output_file)
        self.assertGreater(run.file_size, 0)
        self.assertGreaterEqual(run.row_count, 1)
        self.assertTrue(run.output_file.name.endswith(".xlsx"))

    def test_xlsx_bytes_have_zip_signature(self):
        # XLSX is a zip archive — starts with "PK"
        content = export_to_xlsx(
            [{"x": "1"}], [("x", "X")], title="T", metadata={"actor": "u"},
        )
        self.assertTrue(content[:2] == b"PK")


class CsvExportTest(TestCase):
    def setUp(self):
        self.admin = _user("ce_admin")
        _make_payable(title="C", due_date=date(2025, 1, 1))

    def test_csv_export_creates_completed_run(self):
        run = run_export(
            report_type=ReportType.PAYABLES,
            filters={"mode": "overdue"},
            fmt=ReportFormat.CSV, user=self.admin,
        )
        self.assertEqual(run.status, ReportRunStatus.COMPLETED)
        self.assertTrue(run.output_file.name.endswith(".csv"))

    def test_csv_has_utf8_bom_and_semicolon(self):
        content = export_to_csv(
            [{"a": "değer", "b": "x"}],
            [("a", "Başlık"), ("b", "İkinci")],
            title="T",
        )
        # UTF-8 BOM
        self.assertTrue(content.startswith(b"\xef\xbb\xbf"))
        # Semicolon delimiter present (TR Excel-friendly)
        self.assertIn(b";", content)


class FailedExportTest(TestCase):
    def test_unknown_report_type_marks_failed(self):
        admin = _user("fe_admin")
        run = run_export(
            report_type="NONEXISTENT", filters={},
            fmt=ReportFormat.XLSX, user=admin,
        )
        self.assertEqual(run.status, ReportRunStatus.FAILED)
        self.assertTrue(run.error_message)


# ----------------- Audit log written -----------------


class AuditLogWrittenTest(TestCase):
    def test_export_writes_audit(self):
        admin = _user("au_admin")
        _make_payable(title="A", due_date=date(2025, 1, 1))
        run = run_export(
            report_type=ReportType.PAYABLES, filters={"mode": "overdue"},
            fmt=ReportFormat.XLSX, user=admin,
        )
        self.assertTrue(AuditLog.objects.filter(
            app_label="reports", model_name="reportrun",
            object_id=str(run.pk), action="EXPORT",
        ).exists())


# ----------------- Cancel -----------------


class CancelRunTest(TestCase):
    def test_cancel_pending_run(self):
        admin = _user("cn_admin")
        run = ReportRun.objects.create(
            report_type=ReportType.PAYABLES, format=ReportFormat.XLSX,
            status=ReportRunStatus.PENDING, created_by=admin,
        )
        cancel_report_run(run=run, user=admin)
        run.refresh_from_db()
        self.assertEqual(run.status, ReportRunStatus.CANCELLED)


# ----------------- Recent exports query -----------------


class RecentExportsTest(TestCase):
    def test_writer_sees_only_own(self):
        a = _user("re_a", groups=("muhasebeci",), is_super=False)
        b = _user("re_b", groups=("muhasebeci",), is_super=False)
        ReportRun.objects.create(report_type=ReportType.TASKS, created_by=a, format="XLSX")
        ReportRun.objects.create(report_type=ReportType.TASKS, created_by=b, format="XLSX")
        result = list(get_recent_exports(a))
        self.assertTrue(all(r.created_by_id == a.id for r in result))

    def test_admin_sees_all(self):
        admin = _user("re_admin")
        u = _user("re_u", groups=("muhasebeci",), is_super=False)
        ReportRun.objects.create(report_type=ReportType.TASKS, created_by=u, format="XLSX")
        result = list(get_recent_exports(admin))
        self.assertGreaterEqual(len(result), 1)


# ----------------- View / HTTP -----------------


class ViewerCannotExportTest(TestCase):
    def test_viewer_export_post_403(self):
        v = _user("vc_v", groups=("goruntuleyici",), is_super=False)
        c = Client()
        c.force_login(v)
        r = c.post(reverse("reports:export"), {
            "report_type": ReportType.PAYABLES, "fmt": "XLSX", "mode": "overdue", "days": 7,
        })
        self.assertEqual(r.status_code, 403)

    def test_viewer_preview_403(self):
        v = _user("vc_v2", groups=("goruntuleyici",), is_super=False)
        c = Client()
        c.force_login(v)
        r = c.get(reverse("reports:preview") + f"?report_type={ReportType.PAYABLES}")
        self.assertEqual(r.status_code, 403)


class MuhasebeciCanExportTest(TestCase):
    def test_post_export_redirects_to_run_detail(self):
        u = _user("me_u", groups=("muhasebeci",), is_super=False)
        _make_payable(title="A", due_date=date(2025, 1, 1))
        c = Client()
        c.force_login(u)
        r = c.post(reverse("reports:export"), {
            "report_type": ReportType.PAYABLES, "fmt": "XLSX", "mode": "overdue", "days": 7,
        })
        self.assertEqual(r.status_code, 302)
        self.assertIn("/reports/runs/", r.url)


class AuditExportRestrictedTest(TestCase):
    def test_muhasebeci_cannot_export_audit(self):
        u = _user("ar_u", groups=("muhasebeci",), is_super=False)
        c = Client()
        c.force_login(u)
        r = c.post(reverse("reports:export"), {
            "report_type": ReportType.AUDIT, "fmt": "XLSX", "mode": "", "days": 7,
        })
        self.assertEqual(r.status_code, 403)

    def test_manager_can_export_audit(self):
        u = _user("ar_mgr", groups=("muhasebe_muduru",), is_super=False)
        c = Client()
        c.force_login(u)
        r = c.post(reverse("reports:export"), {
            "report_type": ReportType.AUDIT, "fmt": "XLSX", "mode": "", "days": 7,
        })
        self.assertEqual(r.status_code, 302)


class DownloadPermissionTest(TestCase):
    def test_other_user_cannot_download(self):
        owner = _user("dl_o", groups=("muhasebeci",), is_super=False)
        other = _user("dl_x", groups=("muhasebeci",), is_super=False)
        _make_payable(title="A", due_date=date(2025, 1, 1))
        run = run_export(
            report_type=ReportType.PAYABLES, filters={"mode": "overdue"},
            fmt=ReportFormat.XLSX, user=owner,
        )
        c = Client()
        c.force_login(other)
        r = c.get(reverse("reports:run_download", args=[run.pk]))
        self.assertEqual(r.status_code, 403)

    def test_owner_can_download(self):
        owner = _user("dl_o2", groups=("muhasebeci",), is_super=False)
        _make_payable(title="A", due_date=date(2025, 1, 1))
        run = run_export(
            report_type=ReportType.PAYABLES, filters={"mode": "overdue"},
            fmt=ReportFormat.XLSX, user=owner,
        )
        c = Client()
        c.force_login(owner)
        r = c.get(reverse("reports:run_download", args=[run.pk]))
        self.assertEqual(r.status_code, 200)


class ReportCenterRenderTest(TestCase):
    def test_center_renders(self):
        u = _user("rc_u", groups=("muhasebeci",), is_super=False)
        c = Client()
        c.force_login(u)
        r = c.get(reverse("reports:center"))
        self.assertEqual(r.status_code, 200)


# ----------------- Dashboard widget -----------------


class DashboardWidgetTest(TestCase):
    def test_dashboard_renders_phase12_widget(self):
        u = _user("dw_u")
        c = Client()
        c.force_login(u)
        r = c.get(reverse("dashboard:home"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Faz 12")
        self.assertContains(r, "Raporlama")


# ----------------- UI contract / no-op guards -----------------


APP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "apps", "reports",
)
TPL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "templates", "reports",
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
    def test_no_forbidden_terms_in_reports_templates(self):
        forbidden = ["Pruva", "Acme", "ACME", "Inter", "JetBrains"]
        for fn in os.listdir(TPL_DIR):
            with open(os.path.join(TPL_DIR, fn), encoding="utf-8") as f:
                src = f.read()
            for w in forbidden:
                self.assertNotIn(w, src, f"{fn} içinde yasak terim: {w}")

    def test_no_dark_mode_in_reports_templates(self):
        for fn in os.listdir(TPL_DIR):
            with open(os.path.join(TPL_DIR, fn), encoding="utf-8") as f:
                src = f.read()
            self.assertNotIn("prefers-color-scheme", src)


class NoOpGuardTest(TestCase):
    def test_no_telegram_or_smtp_in_apps_reports(self):
        joined = _strip_py(_walk_py(APP_DIR))
        for marker in ["telegram_bot", "send_telegram", "send_mail", "smtplib"]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_no_celery_or_scheduler_in_apps_reports(self):
        joined = _strip_py(_walk_py(APP_DIR))
        for marker in ["celery", "apscheduler", "crontab(", "BackgroundScheduler"]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_no_pdf_required_in_apps_reports(self):
        joined = _strip_py(_walk_py(APP_DIR))
        # PDF üretimi spec dışı; reportlab/weasyprint olmamalı
        for marker in ["reportlab", "weasyprint", "WeasyPrint"]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_imports_does_not_create_reports(self):
        imports_dir = os.path.join(os.path.dirname(APP_DIR), "imports")
        if not os.path.exists(imports_dir):
            return
        for root, _, files in os.walk(imports_dir):
            for fn in files:
                if not fn.endswith(".py"):
                    continue
                with open(os.path.join(root, fn), encoding="utf-8") as f:
                    src = f.read()
                self.assertNotIn("apps.reports", src)


class MakemigrationsCleanTest(TestCase):
    def test_no_pending_migrations(self):
        from django.core.management import call_command
        # --check raises SystemExit on pending changes
        try:
            call_command("makemigrations", "--check", "--dry-run", verbosity=0)
        except SystemExit as e:
            self.fail(f"Pending migrations detected: {e}")
