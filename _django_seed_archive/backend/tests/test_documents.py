"""Faz 3 — apps.documents testleri."""
from io import BytesIO
import hashlib

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from apps.documents.models import Document, DocumentType


class DocumentSha256Test(TestCase):
    def test_compute_sha256(self):
        content = b"Hello, Muhasebe!"
        expected = hashlib.sha256(content).hexdigest()
        f = BytesIO(content)
        self.assertEqual(Document.compute_sha256(f), expected)

    def test_get_or_create_dedup(self):
        u = User.objects.create_user("uploader", password="pw12345")
        f1 = SimpleUploadedFile("test1.txt", b"AAA")
        d1, created1 = Document.get_or_create_from_file(
            f1, uploaded_by=u, document_type=DocumentType.OTHER, title="T1"
        )
        self.assertTrue(created1)

        # Aynı içerik tekrar yüklenirse mevcut Document döner
        f2 = SimpleUploadedFile("test1_again.txt", b"AAA")
        d2, created2 = Document.get_or_create_from_file(
            f2, uploaded_by=u, document_type=DocumentType.OTHER
        )
        self.assertFalse(created2)
        self.assertEqual(d1.pk, d2.pk)

    def test_different_content_different_document(self):
        u = User.objects.create_user("u2", password="pw12345")
        d1, _ = Document.get_or_create_from_file(SimpleUploadedFile("a.txt", b"AAA"), uploaded_by=u)
        d2, c2 = Document.get_or_create_from_file(SimpleUploadedFile("b.txt", b"BBB"), uploaded_by=u)
        self.assertTrue(c2)
        self.assertNotEqual(d1.pk, d2.pk)
        self.assertNotEqual(d1.sha256, d2.sha256)


class DocumentDownloadTest(TestCase):
    def setUp(self):
        self.u = User.objects.create_user("downloader", password="pw12345")
        self.doc, _ = Document.get_or_create_from_file(
            SimpleUploadedFile("download.txt", b"DOWNLOAD ME"),
            uploaded_by=self.u,
        )

    def test_anon_redirect(self):
        res = self.client.get(reverse("documents:download", kwargs={"pk": self.doc.pk}))
        self.assertEqual(res.status_code, 302)
        self.assertIn("/accounts/login/", res.url)

    def test_authenticated_download(self):
        self.client.force_login(self.u)
        res = self.client.get(reverse("documents:download", kwargs={"pk": self.doc.pk}))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Disposition"][:11], "attachment;")

    def test_list_view_login_required(self):
        res = self.client.get(reverse("documents:list"))
        self.assertEqual(res.status_code, 302)
        self.client.force_login(self.u)
        res2 = self.client.get(reverse("documents:list"))
        self.assertEqual(res2.status_code, 200)
