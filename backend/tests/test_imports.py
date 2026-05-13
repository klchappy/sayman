"""Faz 3 — apps.imports + Excel parser + service akışı testleri."""
from io import BytesIO

import openpyxl
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.documents.models import Document, DocumentType
from apps.imports.models import (
    DraftRecordStatus,
    ImportBatch,
    ImportBatchStatus,
    ImportDraftRecord,
    ImportLog,
    ImportSourceFile,
    ImportSourceType,
    ImportTargetModule,
    ValidationStatus,
)
from apps.imports.services.import_service import (
    approve_draft_record,
    cancel_batch,
    commit_batch,
    create_import_batch,
    mark_manual_review,
    parse_excel_to_drafts,
    recalculate_batch_counts,
    reject_draft_record,
)


def make_xlsx_bytes() -> bytes:
    """Test fixture: küçük 3x4 Excel."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Test Sheet"
    ws.append(["Sahip", "Tutar", "Tarih", "Kurum"])  # header (row 1)
    ws.append(["Acme Tekstil", 12430.50, "2026-05-20", "Türk Telekom"])
    ws.append(["Test Kullanıcı", 18750.00, "2026-05-20", "SiteX"])
    ws.append([None, None, None, None])  # boş satır (skipped)
    ws.append(["Beta Tekstil", 25000.00, "2026-05-10", "SMMM"])

    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    return bio.read()


class CreateImportBatchTest(TestCase):
    def test_batch_creation_writes_audit_and_log(self):
        u = User.objects.create_user("creator", password="pw")
        batch = create_import_batch(
            user=u,
            source_type=ImportSourceType.EXCEL,
            target_module=ImportTargetModule.INVOICE,
            title="Test Batch",
        )
        self.assertEqual(batch.status, ImportBatchStatus.DRAFT)
        self.assertEqual(batch.created_by, u)
        self.assertTrue(ImportLog.objects.filter(batch=batch, code="BATCH_CREATED").exists())
        self.assertTrue(AuditLog.objects.filter(model_name="importbatch", action="CREATE").exists())


class ExcelParserTest(TestCase):
    def setUp(self):
        self.u = User.objects.create_user("parser", password="pw")
        f = SimpleUploadedFile("test.xlsx", make_xlsx_bytes())
        self.doc, _ = Document.get_or_create_from_file(
            f, uploaded_by=self.u, document_type=DocumentType.IMPORT_SOURCE,
        )
        self.batch = create_import_batch(user=self.u, source_type=ImportSourceType.EXCEL)

    def test_parse_creates_drafts(self):
        result = parse_excel_to_drafts(batch=self.batch, document=self.doc, user=self.u)
        # 5 satır toplam: 1 header + 3 dolu + 1 boş = 4 dolu (header dahil), header çıkarılınca 3 draft
        self.assertEqual(result["draft_count"], 3, f"Beklenen 3, bulunan {result['draft_count']}")
        self.assertGreaterEqual(result["skipped_empty"], 1)
        self.assertEqual(result["sheet_count"], 1)

        # Source file yaratıldı
        self.assertEqual(ImportSourceFile.objects.filter(batch=self.batch).count(), 1)
        sf = ImportSourceFile.objects.get(batch=self.batch)
        self.assertEqual(sf.sheet_name, "Test Sheet")
        self.assertEqual(sf.metadata.get("header_row"), 1)

        # Draft'lar manual_review default
        drafts = self.batch.draft_records.all()
        self.assertEqual(drafts.count(), 3)
        for d in drafts:
            self.assertEqual(d.validation_status, ValidationStatus.MANUAL_REVIEW)
            self.assertEqual(d.status, DraftRecordStatus.DRAFT)
            self.assertIn("values", d.raw_data)

        # Batch counts recalculated
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.row_count, 3)
        self.assertEqual(self.batch.manual_review_count, 3)
        self.assertEqual(self.batch.status, ImportBatchStatus.NEEDS_REVIEW)


class DraftActionsTest(TestCase):
    def setUp(self):
        self.u = User.objects.create_user("approver", password="pw")
        f = SimpleUploadedFile("act.xlsx", make_xlsx_bytes())
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=self.u)
        self.batch = create_import_batch(user=self.u)
        parse_excel_to_drafts(batch=self.batch, document=doc, user=self.u)
        self.draft = self.batch.draft_records.first()

    def test_approve_draft(self):
        approve_draft_record(draft=self.draft, user=self.u)
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.status, DraftRecordStatus.APPROVED)
        self.assertTrue(ImportLog.objects.filter(code="DRAFT_APPROVED").exists())

    def test_reject_draft(self):
        reject_draft_record(draft=self.draft, user=self.u, reason="Yanlış tutar")
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.status, DraftRecordStatus.REJECTED)
        self.assertEqual(self.draft.metadata.get("reject_reason"), "Yanlış tutar")

    def test_mark_manual_review(self):
        mark_manual_review(draft=self.draft, user=self.u, message="Yeni kişi tespit edildi")
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.validation_status, ValidationStatus.MANUAL_REVIEW)
        # Mesajların listesi güncellendi
        codes = [m.get("code") for m in self.draft.validation_messages]
        self.assertIn("MANUAL", codes)

    def test_cancel_batch(self):
        cancel_batch(batch=self.batch, user=self.u, reason="Yanlış dosya")
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.status, ImportBatchStatus.CANCELLED)
        self.assertEqual(self.batch.metadata.get("cancel_reason"), "Yanlış dosya")


class CommitNoOpTest(TestCase):
    """Faz 3: commit_batch domain kayıt yaratmamalı."""

    def test_commit_does_not_create_domain_records(self):
        u = User.objects.create_user("committer", password="pw")
        f = SimpleUploadedFile("commit.xlsx", make_xlsx_bytes())
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=u)
        batch = create_import_batch(user=u)
        parse_excel_to_drafts(batch=batch, document=doc, user=u)

        result = commit_batch(batch=batch, user=u)
        self.assertFalse(result["domain_commit"])
        self.assertEqual(result["phase"], 3)

        # Hiçbir draft hala COMMITTED'a geçmedi
        committed = batch.draft_records.filter(status=DraftRecordStatus.COMMITTED)
        self.assertEqual(committed.count(), 0)

        # ImportLog COMMIT_BLOCKED yazıldı
        self.assertTrue(ImportLog.objects.filter(batch=batch, code="COMMIT_BLOCKED").exists())


class RecalculateCountsTest(TestCase):
    def test_recalc_after_status_change(self):
        u = User.objects.create_user("rec", password="pw")
        f = SimpleUploadedFile("rec.xlsx", make_xlsx_bytes())
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=u)
        batch = create_import_batch(user=u)
        parse_excel_to_drafts(batch=batch, document=doc, user=u)

        # Manuel set
        d = batch.draft_records.first()
        d.validation_status = ValidationStatus.OK
        d.save()
        recalculate_batch_counts(batch)
        batch.refresh_from_db()
        self.assertEqual(batch.ok_count, 1)
        self.assertEqual(batch.manual_review_count, 2)


class ImportViewSmokeTest(TestCase):
    def setUp(self):
        self.u = User.objects.create_user("u_view", password="pw12345xx", is_staff=True)
        self.client.force_login(self.u)

    def test_import_list_view_anon(self):
        c = self.client_class()
        res = c.get(reverse("imports:list"))
        self.assertEqual(res.status_code, 302)

    def test_import_list_view_auth(self):
        res = self.client.get(reverse("imports:list"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Import Merkezi")

    def test_import_new_get(self):
        res = self.client.get(reverse("imports:new"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Yeni Import")

    def test_import_new_post_creates_batch_and_drafts(self):
        f = SimpleUploadedFile("upload.xlsx", make_xlsx_bytes(),
                               content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res = self.client.post(reverse("imports:new"), {
            "title": "Test Upload",
            "source_type": "EXCEL",
            "target_module": "INVOICE",
            "file": f,
        })
        self.assertEqual(res.status_code, 302)
        self.assertEqual(ImportBatch.objects.count(), 1)
        batch = ImportBatch.objects.first()
        self.assertGreater(batch.row_count, 0)
        self.assertEqual(Document.objects.filter(document_type=DocumentType.IMPORT_SOURCE).count(), 1)

    def test_preview_view(self):
        # Önce batch yarat
        f = SimpleUploadedFile("preview.xlsx", make_xlsx_bytes())
        doc, _ = Document.get_or_create_from_file(f, uploaded_by=self.u, document_type=DocumentType.IMPORT_SOURCE)
        batch = create_import_batch(user=self.u)
        parse_excel_to_drafts(batch=batch, document=doc, user=self.u)
        res = self.client.get(reverse("imports:preview", kwargs={"batch_id": str(batch.batch_id)}))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "Manuel")
