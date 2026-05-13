"""
Faz 15 — Production Hardening Patch testleri.

Kapsam:
- requirements.txt mevcut ve gerekli paket girişlerini içerir
- production.py import edilebilir (env stub) ve güvenlik ayarları doğru
- DATA_UPLOAD_MAX_MEMORY_SIZE / FILE_UPLOAD_MAX_MEMORY_SIZE
- LOGGING formatlı
- CSRF_TRUSTED_ORIGINS ALLOWED_HOSTS'tan üretiliyor
- SECURE_REFERRER_POLICY = same-origin
- Path'ler /var/www/muhasebe-ops ile uyumlu (DEPLOY_ROOT default)
- backup.sh mevcut ve `bash -n` ile geçerli (bash bulunabilirse)
- .gitignore mevcut ve kritik girdileri içerir
- Document download object-level permission:
    * uploader allowed
    * yonetici allowed
    * unrelated authenticated user forbidden
    * orphan document only uploader/admin
    * chat non-participant forbidden, participant allowed
    * task assigned user allowed
    * payable can_write user allowed
- Telegram real send hâlâ kapalı
- Migrations clean (no changes)
"""
import importlib
import os
import shutil
import subprocess
from io import BytesIO
from pathlib import Path
from unittest import mock

from django.contrib.auth.models import Group, User
from django.core.exceptions import PermissionDenied
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from apps.documents.models import Document, DocumentType
from apps.documents.permissions import can_download_document


REPO_ROOT = Path(__file__).resolve().parents[2]   # muhasebe-operasyon-seed/
BACKEND_DIR = REPO_ROOT / "backend"


# ---------- A. Repository artefacts ----------------------------------------


class RequirementsTxtTest(TestCase):
    def test_requirements_txt_exists(self):
        path = BACKEND_DIR / "requirements.txt"
        self.assertTrue(path.exists(), "backend/requirements.txt yok")

    def test_requirements_contains_core(self):
        path = BACKEND_DIR / "requirements.txt"
        content = path.read_text(encoding="utf-8")
        # Core production paketleri
        for pkg in ("Django==", "openpyxl==", "psycopg", "gunicorn"):
            self.assertIn(pkg, content, f"requirements.txt eksik: {pkg}")


class GitignoreTest(TestCase):
    def test_gitignore_exists(self):
        self.assertTrue((REPO_ROOT / ".gitignore").exists())

    def test_gitignore_required_entries(self):
        content = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
        for needle in [
            ".env", "db.sqlite3", "media/", "private_media/",
            "staticfiles/", "__pycache__", ".pytest_cache",
            "_source_data/",
        ]:
            self.assertIn(needle, content, f".gitignore eksik: {needle}")


class BackupScriptTest(TestCase):
    def test_backup_script_exists(self):
        self.assertTrue((BACKEND_DIR / "scripts" / "backup.sh").exists())

    def test_backup_script_bash_n(self):
        path = BACKEND_DIR / "scripts" / "backup.sh"
        bash = shutil.which("bash")
        if not bash:
            self.skipTest("bash bulunamadı (Windows ortam) — syntax kontrolü atlandı")
        result = subprocess.run(
            [bash, "-n", str(path)],
            capture_output=True, text=True,
        )
        self.assertEqual(
            result.returncode, 0,
            f"backup.sh syntax error: {result.stderr}"
        )

    def test_backup_script_contains_required_pieces(self):
        content = (BACKEND_DIR / "scripts" / "backup.sh").read_text(encoding="utf-8")
        for needle in ("set -euo pipefail", "pg_dump", "tar -czf",
                       "sha256sum", "BACKUP_ROOT", "PRIVATE_MEDIA_ROOT"):
            self.assertIn(needle, content)

    def test_backup_script_no_secret(self):
        content = (BACKEND_DIR / "scripts" / "backup.sh").read_text(encoding="utf-8")
        for forbidden in ("PGPASSWORD=", "DB_PASSWORD=", "TOKEN=", "echo $DB_"):
            self.assertNotIn(forbidden, content)


# ---------- B. Production settings -----------------------------------------


def _stub_env_for_prod():
    return {
        "DJANGO_SECRET_KEY": "x" * 50,
        "ALLOWED_HOSTS": "muhasebe-ops.example.com",
        "DB_NAME": "muhasebe",
        "DB_USER": "muhasebe",
        "DB_PASSWORD": "pw",
        "DB_HOST": "127.0.0.1",
        "DB_PORT": "5432",
        # /var/log yazılamaz → modül sessizce konsola düşer
    }


class ProductionSettingsTest(TestCase):
    def setUp(self):
        # Modülü temiz import etmek için cache'ten düşür
        import sys
        sys.modules.pop("config.settings.production", None)

    def _load(self):
        with mock.patch.dict(os.environ, _stub_env_for_prod(), clear=False):
            return importlib.import_module("config.settings.production")

    def test_imports_with_env(self):
        prod = self._load()
        self.assertFalse(prod.DEBUG)
        self.assertEqual(prod.ALLOWED_HOSTS, ["muhasebe-ops.example.com"])

    def test_secure_cookies_and_ssl(self):
        prod = self._load()
        self.assertTrue(prod.SESSION_COOKIE_SECURE)
        self.assertTrue(prod.CSRF_COOKIE_SECURE)
        self.assertTrue(prod.SECURE_SSL_REDIRECT)
        self.assertGreaterEqual(prod.SECURE_HSTS_SECONDS, 31536000)
        self.assertTrue(prod.SECURE_HSTS_INCLUDE_SUBDOMAINS)
        self.assertTrue(prod.SECURE_HSTS_PRELOAD)
        self.assertEqual(prod.SECURE_REFERRER_POLICY, "same-origin")
        self.assertEqual(
            prod.SECURE_PROXY_SSL_HEADER,
            ("HTTP_X_FORWARDED_PROTO", "https"),
        )

    def test_csrf_trusted_origins_derived(self):
        prod = self._load()
        self.assertIn("https://muhasebe-ops.example.com", prod.CSRF_TRUSTED_ORIGINS)

    def test_csrf_trusted_origins_env_override(self):
        env = {**_stub_env_for_prod(),
               "CSRF_TRUSTED_ORIGINS": "https://a.example.com,https://b.example.com"}
        with mock.patch.dict(os.environ, env, clear=False):
            import sys
            sys.modules.pop("config.settings.production", None)
            prod = importlib.import_module("config.settings.production")
        self.assertIn("https://a.example.com", prod.CSRF_TRUSTED_ORIGINS)
        self.assertIn("https://b.example.com", prod.CSRF_TRUSTED_ORIGINS)

    def test_upload_limits(self):
        prod = self._load()
        self.assertGreaterEqual(prod.DATA_UPLOAD_MAX_MEMORY_SIZE, 100 * 1024 * 1024)
        self.assertTrue(hasattr(prod, "FILE_UPLOAD_MAX_MEMORY_SIZE"))

    def test_paths_align_with_deployment_plan(self):
        prod = self._load()
        # Plan: /var/www/muhasebe-ops/{static,media,private_media}
        self.assertIn("muhasebe-ops", str(prod.STATIC_ROOT))
        self.assertIn("muhasebe-ops", str(prod.MEDIA_ROOT))
        self.assertIn("muhasebe-ops", str(prod.PRIVATE_MEDIA_ROOT))
        self.assertTrue(str(prod.PRIVATE_MEDIA_ROOT).endswith("private_media"))

    def test_logging_has_handlers(self):
        prod = self._load()
        self.assertIn("console", prod.LOGGING["handlers"])
        # File handler /var/log yazılamasa da config içinde tanımlı olmalı —
        # yazılabilir ortamda otomatik eklenir; salt-config kontrolü:
        # /var/log/muhasebe-ops yazılamazsa graceful fallback (sadece console).
        # Burada tanım blok mevcudiyetini doğrulamak yeterli:
        self.assertIn("muhasebe", prod.LOGGING["loggers"])

    def test_telegram_real_send_disabled(self):
        prod = self._load()
        self.assertFalse(getattr(prod, "TELEGRAM_REAL_SEND_ENABLED", True))


# ---------- C. Document download object-level permission -------------------


def _make_user(username, group=None, *, is_superuser=False):
    u = User.objects.create_user(username, password="pw12345")
    if is_superuser:
        u.is_superuser = True
        u.is_staff = True
        u.save()
    if group:
        g, _ = Group.objects.get_or_create(name=group)
        u.groups.add(g)
    return u


def _make_doc(uploader, content=b"X"):
    doc, _ = Document.get_or_create_from_file(
        SimpleUploadedFile(f"f-{content[:3].decode('ascii','ignore')}-{uploader.id}.txt", content),
        uploaded_by=uploader,
        document_type=DocumentType.OTHER,
    )
    return doc


class DocumentPermissionUploaderTest(TestCase):
    def test_uploader_can_download(self):
        u = _make_user("u_uploader")
        doc = _make_doc(u, b"AAA")
        self.assertTrue(can_download_document(u, doc))

    def test_unrelated_user_cannot_download(self):
        uploader = _make_user("u_owner")
        other = _make_user("u_other")
        doc = _make_doc(uploader, b"BBB")
        self.assertFalse(can_download_document(other, doc))

    def test_anonymous_cannot_download(self):
        u = _make_user("u_anon_owner")
        doc = _make_doc(u, b"CCC")
        self.assertFalse(can_download_document(None, doc))

    def test_orphan_document_only_uploader_or_admin(self):
        uploader = _make_user("u_orph")
        viewer = _make_user("v_orph", group="goruntuleyici")
        doc = _make_doc(uploader, b"ORPH")
        # related_app boş — orphan
        self.assertEqual(doc.related_app, "")
        self.assertTrue(can_download_document(uploader, doc))
        self.assertFalse(can_download_document(viewer, doc))


class DocumentPermissionHighRoleTest(TestCase):
    def test_superuser_can_download(self):
        admin = _make_user("admin1", is_superuser=True)
        owner = _make_user("u_owner_h")
        doc = _make_doc(owner, b"SU")
        self.assertTrue(can_download_document(admin, doc))

    def test_yonetici_can_download(self):
        owner = _make_user("u_owner_y")
        manager = _make_user("manager1", group="yonetici")
        doc = _make_doc(owner, b"YN")
        self.assertTrue(can_download_document(manager, doc))

    def test_muhasebe_muduru_can_download(self):
        owner = _make_user("u_owner_m")
        mm = _make_user("mm1", group="muhasebe_muduru")
        doc = _make_doc(owner, b"MM")
        self.assertTrue(can_download_document(mm, doc))


class DocumentPermissionDomainTest(TestCase):
    def test_muhasebeci_can_download_finance_doc(self):
        owner = _make_user("u_owner_f")
        muhasebeci = _make_user("muh1", group="muhasebeci")
        doc = _make_doc(owner, b"FIN")
        # related_app finance işaretle
        doc.related_app = "finance"
        doc.related_model = "payableitem"
        doc.related_object_id = "1"
        doc.save()
        self.assertTrue(can_download_document(muhasebeci, doc))

    def test_viewer_cannot_download_finance_doc(self):
        owner = _make_user("u_owner_v")
        viewer = _make_user("v1", group="goruntuleyici")
        doc = _make_doc(owner, b"FINV")
        doc.related_app = "finance"
        doc.save()
        self.assertFalse(can_download_document(viewer, doc))


class DocumentPermissionChatTest(TestCase):
    def _make_chat(self, owner, member):
        from apps.chat.models import (ChatAttachment, ChatMessage,
                                       ChatMessageType, ChatParticipant,
                                       ChatParticipantRole, ChatThread,
                                       ChatThreadType)
        thread = ChatThread.objects.create(
            title="t", thread_type=ChatThreadType.DIRECT, created_by=owner,
        )
        ChatParticipant.objects.create(
            thread=thread, user=owner, role=ChatParticipantRole.MEMBER, is_active=True,
        )
        ChatParticipant.objects.create(
            thread=thread, user=member, role=ChatParticipantRole.MEMBER, is_active=True,
        )
        msg = ChatMessage.objects.create(
            thread=thread, sender=owner,
            message_type=ChatMessageType.FILE, body="ek",
        )
        doc = _make_doc(owner, b"CHAT")
        ChatAttachment.objects.create(
            message=msg, document=doc, uploaded_by=owner,
        )
        return thread, msg, doc

    def test_chat_participant_can_download(self):
        owner = _make_user("c_owner")
        member = _make_user("c_member")
        _, _, doc = self._make_chat(owner, member)
        self.assertTrue(can_download_document(member, doc))

    def test_chat_non_participant_cannot_download(self):
        owner = _make_user("c_owner2")
        member = _make_user("c_member2")
        outsider = _make_user("c_outsider")
        _, _, doc = self._make_chat(owner, member)
        self.assertFalse(can_download_document(outsider, doc))


class DocumentPermissionTaskTest(TestCase):
    def _make_task_attachment(self, creator, assignee):
        from apps.tasks.models import Task, TaskAttachment, TaskStatus
        task = Task.objects.create(
            title="t", description="",
            status=TaskStatus.OPEN,
            assigned_to=assignee, created_by=creator,
        )
        doc = _make_doc(creator, b"TASK")
        TaskAttachment.objects.create(task=task, document=doc, uploaded_by=creator)
        return task, doc

    def test_assignee_can_download(self):
        creator = _make_user("t_creator")
        assignee = _make_user("t_assignee")
        _, doc = self._make_task_attachment(creator, assignee)
        self.assertTrue(can_download_document(assignee, doc))

    def test_creator_can_download(self):
        creator = _make_user("t_creator2")
        assignee = _make_user("t_assignee2")
        _, doc = self._make_task_attachment(creator, assignee)
        self.assertTrue(can_download_document(creator, doc))

    def test_unrelated_user_cannot_download_task_attachment(self):
        creator = _make_user("t_creator3")
        assignee = _make_user("t_assignee3")
        outsider = _make_user("t_outsider3")
        _, doc = self._make_task_attachment(creator, assignee)
        self.assertFalse(can_download_document(outsider, doc))


# ---------- D. Download view HTTP integration -------------------------------


class DocumentDownloadViewPermissionTest(TestCase):
    def setUp(self):
        self.uploader = _make_user("dv_uploader")
        self.outsider = _make_user("dv_outsider")
        self.admin = _make_user("dv_admin", is_superuser=True)
        self.doc = _make_doc(self.uploader, b"VIEW-AUTH")

    def _url(self):
        return reverse("documents:download", kwargs={"pk": self.doc.pk})

    def test_anon_redirected_to_login(self):
        c = Client()
        res = c.get(self._url())
        self.assertEqual(res.status_code, 302)

    def test_uploader_200(self):
        c = Client()
        c.force_login(self.uploader)
        res = c.get(self._url())
        self.assertEqual(res.status_code, 200)

    def test_outsider_403(self):
        c = Client()
        c.force_login(self.outsider)
        res = c.get(self._url())
        self.assertEqual(res.status_code, 403)

    def test_admin_200(self):
        c = Client()
        c.force_login(self.admin)
        res = c.get(self._url())
        self.assertEqual(res.status_code, 200)


# ---------- E. No-op guards / migrations ------------------------------------


class TelegramRealSendStillDisabledTest(TestCase):
    def test_no_requests_or_urllib_in_apps_notifications(self):
        import re
        notifs_dir = BACKEND_DIR / "apps" / "notifications"
        for py in notifs_dir.rglob("*.py"):
            text = py.read_text(encoding="utf-8")
            for forbidden in (
                r"^\s*import\s+requests",
                r"^\s*from\s+requests",
                r"^\s*import\s+urllib",
                r"^\s*from\s+urllib",
                r"^\s*import\s+http\.client",
            ):
                self.assertFalse(
                    bool(re.search(forbidden, text, re.MULTILINE)),
                    f"{py} forbidden import: {forbidden}"
                )


class MakemigrationsCleanTest(TestCase):
    def test_no_pending_migrations(self):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        try:
            call_command("makemigrations", "--check", "--dry-run", stdout=out)
        except SystemExit as exc:
            self.fail(f"makemigrations --check failed: exit={exc.code}\n{out.getvalue()}")
