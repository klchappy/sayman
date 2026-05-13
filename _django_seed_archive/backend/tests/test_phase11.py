"""
Faz 11 — Chat Widget / Mesaj Merkezi MVP testleri.

Thread/participant/message lifecycle, permissions, attachments, queries,
domain integration, dashboard, widget JSON, UI contract, no-WS guards.
"""
import os
import re
from datetime import date
from io import BytesIO

from django.contrib.auth.models import Group, User
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.chat.models import (ChatAttachment, ChatEvent, ChatEventType,
                               ChatMessage, ChatMessageStatus, ChatParticipant,
                               ChatThread, ChatThreadStatus, ChatThreadType)
from apps.chat.services import (add_participant, archive_thread,
                                 attach_document_to_message, close_thread,
                                 create_direct_thread,
                                 create_record_thread, create_task_thread,
                                 create_thread,
                                 get_or_create_record_thread,
                                 get_or_create_task_thread,
                                 get_thread_messages,
                                 get_threads_for_object, get_unread_count,
                                 get_user_threads, mark_thread_read,
                                 remove_participant, reply_message,
                                 send_message, soft_delete_message,
                                 user_can_view_thread)
from apps.tasks.services import create_task as create_task_obj


def _user(name, groups=("super_admin",), is_super=True):
    u = User.objects.create_user(name, password="pw12345xx")
    if is_super:
        u.is_superuser = True
        u.save()
    for g in groups:
        grp, _ = Group.objects.get_or_create(name=g)
        u.groups.add(grp)
    return u


# ----------------- Thread create -----------------


class ThreadCreateTest(TestCase):
    def setUp(self):
        self.a = _user("ta")
        self.b = _user("tb", groups=("personel",), is_super=False)

    def test_create_thread_emits_event_and_audit(self):
        t = create_thread(actor=self.a, title="Konu 1", thread_type=ChatThreadType.GROUP)
        self.assertEqual(t.status, ChatThreadStatus.ACTIVE)
        self.assertTrue(ChatEvent.objects.filter(thread=t, event_type=ChatEventType.THREAD_CREATED).exists())
        self.assertTrue(AuditLog.objects.filter(app_label="chat", model_name="chatthread", action="CREATE").exists())

    def test_owner_participant_created(self):
        t = create_thread(actor=self.a, title="K")
        self.assertTrue(ChatParticipant.objects.filter(thread=t, user=self.a, role="OWNER").exists())

    def test_create_direct_thread_dedup(self):
        t1 = create_direct_thread(actor=self.a, other_user=self.b)
        t2 = create_direct_thread(actor=self.a, other_user=self.b)
        self.assertEqual(t1.pk, t2.pk)

    def test_writer_required_for_create(self):
        viewer = _user("tv", groups=("goruntuleyici",), is_super=False)
        with self.assertRaises(PermissionDenied):
            create_thread(actor=viewer, title="x")

    def test_create_record_thread_links_object(self):
        from apps.finance.models import PayableItem
        p = PayableItem.objects.create(title="P", amount=100, due_date=date(2026, 5, 8))
        t = create_record_thread(actor=self.a, obj=p)
        self.assertEqual(t.thread_type, ChatThreadType.RECORD)
        self.assertEqual(t.related_app, "finance")
        self.assertEqual(t.related_model, "payableitem")
        self.assertEqual(t.related_object_id, str(p.pk))

    def test_get_or_create_record_thread_dedup(self):
        from apps.finance.models import PayableItem
        p = PayableItem.objects.create(title="P", amount=100, due_date=date(2026, 5, 8))
        t1 = get_or_create_record_thread(actor=self.a, obj=p)
        t2 = get_or_create_record_thread(actor=self.a, obj=p)
        self.assertEqual(t1.pk, t2.pk)

    def test_create_task_thread(self):
        task = create_task_obj(title="T", created_by=self.a)
        t = create_task_thread(actor=self.a, task=task)
        self.assertEqual(t.thread_type, ChatThreadType.TASK)
        self.assertEqual(t.related_app, "tasks")
        self.assertEqual(t.related_object_id, str(task.pk))


# ----------------- Participant -----------------


class ParticipantTest(TestCase):
    def setUp(self):
        self.owner = _user("po")
        self.member = _user("pm", groups=("personel",), is_super=False)

    def test_add_and_remove_participant(self):
        t = create_thread(actor=self.owner, title="x")
        add_participant(actor=self.owner, thread=t, user=self.member)
        self.assertTrue(ChatParticipant.objects.filter(thread=t, user=self.member, is_active=True).exists())
        remove_participant(actor=self.owner, thread=t, user=self.member)
        self.assertFalse(ChatParticipant.objects.filter(thread=t, user=self.member, is_active=True).exists())

    def test_unique_constraint(self):
        t = create_thread(actor=self.owner, title="x")
        add_participant(actor=self.owner, thread=t, user=self.member)
        # idempotent — same call no error, no dup row
        add_participant(actor=self.owner, thread=t, user=self.member)
        self.assertEqual(ChatParticipant.objects.filter(thread=t, user=self.member).count(), 1)

    def test_non_participant_cannot_view(self):
        t = create_thread(actor=self.owner, title="x")
        outsider = _user("po2", groups=("personel",), is_super=False)
        self.assertFalse(user_can_view_thread(outsider, t))


# ----------------- Message lifecycle -----------------


class MessageLifecycleTest(TestCase):
    def setUp(self):
        self.a = _user("ma")
        self.b = _user("mb", groups=("personel",), is_super=False)
        self.t = create_thread(actor=self.a, title="K", participants=[self.b])

    def test_send_message_creates_event_and_updates_preview(self):
        m = send_message(actor=self.a, thread=self.t, body="merhaba")
        self.t.refresh_from_db()
        self.assertEqual(m.body, "merhaba")
        self.assertEqual(self.t.last_message_preview, "merhaba")
        self.assertIsNotNone(self.t.last_message_at)
        self.assertTrue(ChatEvent.objects.filter(thread=self.t, event_type=ChatEventType.MESSAGE_SENT).exists())

    def test_empty_body_rejected(self):
        with self.assertRaises(ValidationError):
            send_message(actor=self.a, thread=self.t, body="   ")

    def test_reply_message_links_parent(self):
        parent = send_message(actor=self.a, thread=self.t, body="ana")
        rep = reply_message(actor=self.b, parent_message=parent, body="cevap")
        self.assertEqual(rep.reply_to_id, parent.pk)
        self.assertEqual(rep.thread_id, self.t.pk)

    def test_soft_delete_by_sender(self):
        m = send_message(actor=self.a, thread=self.t, body="x")
        soft_delete_message(actor=self.a, message=m)
        m.refresh_from_db()
        self.assertEqual(m.status, ChatMessageStatus.DELETED)
        self.assertEqual(m.body, "")

    def test_non_sender_cannot_delete(self):
        m = send_message(actor=self.a, thread=self.t, body="x")
        outsider = _user("mout", groups=("personel",), is_super=False)
        with self.assertRaises(PermissionDenied):
            soft_delete_message(actor=outsider, message=m)

    def test_admin_can_force_delete(self):
        m = send_message(actor=self.b, thread=self.t, body="x")
        soft_delete_message(actor=self.a, message=m)  # superuser
        m.refresh_from_db()
        self.assertEqual(m.status, ChatMessageStatus.DELETED)

    def test_cannot_send_on_archived_thread(self):
        archive_thread(actor=self.a, thread=self.t)
        with self.assertRaises(ValidationError):
            send_message(actor=self.a, thread=self.t, body="x")

    def test_non_participant_cannot_send(self):
        outsider = _user("mout2", groups=("personel",), is_super=False)
        with self.assertRaises(PermissionDenied):
            send_message(actor=outsider, thread=self.t, body="x")


# ----------------- Attachment -----------------


class AttachmentTest(TestCase):
    def setUp(self):
        self.a = _user("aa")
        self.t = create_thread(actor=self.a, title="K")
        self.m = send_message(actor=self.a, thread=self.t, body="ek var")

    def test_attach_dedup_by_sha256(self):
        f1 = SimpleUploadedFile("a.txt", b"hello", content_type="text/plain")
        f2 = SimpleUploadedFile("b.txt", b"hello", content_type="text/plain")
        att1 = attach_document_to_message(actor=self.a, message=self.m, django_file=f1)
        m2 = send_message(actor=self.a, thread=self.t, body="ikinci")
        att2 = attach_document_to_message(actor=self.a, message=m2, django_file=f2)
        self.assertEqual(att1.document_id, att2.document_id)

    def test_attach_unique_per_message(self):
        f1 = SimpleUploadedFile("c.txt", b"data", content_type="text/plain")
        f2 = SimpleUploadedFile("c.txt", b"data", content_type="text/plain")
        attach_document_to_message(actor=self.a, message=self.m, django_file=f1)
        attach_document_to_message(actor=self.a, message=self.m, django_file=f2)
        self.assertEqual(ChatAttachment.objects.filter(message=self.m).count(), 1)

    def test_attach_writes_event(self):
        f = SimpleUploadedFile("d.txt", b"x", content_type="text/plain")
        attach_document_to_message(actor=self.a, message=self.m, django_file=f)
        self.assertTrue(ChatEvent.objects.filter(thread=self.t, event_type=ChatEventType.ATTACHMENT_ADDED).exists())


# ----------------- Read / unread -----------------


class ReadUnreadTest(TestCase):
    def setUp(self):
        self.a = _user("ra")
        self.b = _user("rb", groups=("personel",), is_super=False)
        self.t = create_thread(actor=self.a, title="K", participants=[self.b])

    def test_unread_after_message_from_other(self):
        send_message(actor=self.a, thread=self.t, body="x")
        self.assertEqual(get_unread_count(user=self.b), 1)

    def test_mark_read_clears_unread(self):
        send_message(actor=self.a, thread=self.t, body="x")
        mark_thread_read(actor=self.b, thread=self.t)
        self.assertEqual(get_unread_count(user=self.b), 0)

    def test_own_message_not_counted(self):
        send_message(actor=self.b, thread=self.t, body="x")
        self.assertEqual(get_unread_count(user=self.b), 0)


# ----------------- Queries -----------------


class QueryTest(TestCase):
    def setUp(self):
        self.a = _user("qa")
        self.b = _user("qb", groups=("personel",), is_super=False)

    def test_get_user_threads_only_member(self):
        t1 = create_thread(actor=self.a, title="A")
        t2 = create_thread(actor=self.a, title="B", participants=[self.b])
        threads_b = list(get_user_threads(self.b))
        self.assertIn(t2, threads_b)
        self.assertNotIn(t1, threads_b)

    def test_get_thread_messages_excludes_deleted(self):
        t = create_thread(actor=self.a, title="K")
        m1 = send_message(actor=self.a, thread=t, body="a")
        m2 = send_message(actor=self.a, thread=t, body="b")
        soft_delete_message(actor=self.a, message=m1)
        msgs = list(get_thread_messages(t))
        self.assertNotIn(m1, msgs)
        self.assertIn(m2, msgs)

    def test_get_threads_for_object(self):
        from apps.finance.models import PayableItem
        p = PayableItem.objects.create(title="P", amount=10, due_date=date(2026, 5, 8))
        t = create_record_thread(actor=self.a, obj=p)
        result = list(get_threads_for_object(p))
        self.assertEqual(result, [t])


# ----------------- Thread close/archive -----------------


class ThreadStateTest(TestCase):
    def setUp(self):
        self.a = _user("sa")

    def test_close_thread(self):
        t = create_thread(actor=self.a, title="K")
        close_thread(actor=self.a, thread=t)
        t.refresh_from_db()
        self.assertEqual(t.status, ChatThreadStatus.CLOSED)
        self.assertTrue(ChatEvent.objects.filter(thread=t, event_type=ChatEventType.THREAD_CLOSED).exists())

    def test_archive_thread(self):
        t = create_thread(actor=self.a, title="K")
        archive_thread(actor=self.a, thread=t)
        t.refresh_from_db()
        self.assertEqual(t.status, ChatThreadStatus.ARCHIVED)


# ----------------- Permissions -----------------


class PermissionTest(TestCase):
    def setUp(self):
        self.viewer = _user("pv", groups=("goruntuleyici",), is_super=False)
        self.writer = _user("pw", groups=("muhasebeci",), is_super=False)

    def test_viewer_cannot_create_thread(self):
        c = Client()
        c.force_login(self.viewer)
        r = c.post(reverse("chat:thread_create"), {"title": "x", "thread_type": "GROUP"})
        self.assertEqual(r.status_code, 403)

    def test_writer_can_create_thread(self):
        c = Client()
        c.force_login(self.writer)
        r = c.post(reverse("chat:thread_create"), {"title": "x", "thread_type": "GROUP"})
        self.assertEqual(r.status_code, 302)


# ----------------- Widget JSON endpoints -----------------


class WidgetEndpointTest(TestCase):
    def setUp(self):
        self.a = _user("wa")
        self.b = _user("wb", groups=("personel",), is_super=False)
        self.t = create_thread(actor=self.a, title="K", participants=[self.b])
        send_message(actor=self.a, thread=self.t, body="merhaba")

    def test_widget_unread_endpoint(self):
        c = Client()
        c.force_login(self.b)
        r = c.get(reverse("chat:widget_unread"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["unread_count"], 1)

    def test_widget_threads_endpoint(self):
        c = Client()
        c.force_login(self.b)
        r = c.get(reverse("chat:widget_threads"))
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()["threads"]), 1)

    def test_widget_thread_messages_endpoint(self):
        c = Client()
        c.force_login(self.b)
        r = c.get(reverse("chat:widget_thread_messages", args=[self.t.pk]))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["messages"]), 1)


# ----------------- Dashboard render -----------------


class DashboardRenderTest(TestCase):
    def test_dashboard_renders_chat_widget(self):
        u = _user("dr")
        create_thread(actor=u, title="DKonu")
        c = Client()
        c.force_login(u)
        r = c.get(reverse("dashboard:home"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Mesajlar & Konular")
        self.assertContains(r, "Faz 11")


# ----------------- Domain integration -----------------


class DomainPanelIncludeTest(TestCase):
    def test_payable_detail_renders_chat_panel(self):
        from apps.finance.models import PayableItem
        u = _user("dpi")
        p = PayableItem.objects.create(title="P", amount=10, due_date=date(2026, 5, 10))
        create_record_thread(actor=u, obj=p)
        c = Client()
        c.force_login(u)
        r = c.get(reverse("finance:detail", args=[p.pk]))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Bağlı Konular")

    def test_task_detail_chat_link(self):
        u = _user("dti")
        task = create_task_obj(title="X", created_by=u)
        c = Client()
        c.force_login(u)
        r = c.get(reverse("tasks:detail", args=[task.pk]))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Görev için Chat Aç")


# ----------------- UI contract / no-op guards -----------------


APP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "apps", "chat",
)
TPL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "templates", "chat",
)


def _src_concat(paths):
    parts = []
    for p in paths:
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                parts.append(f.read())
    return "\n".join(parts)


class UiContractTest(TestCase):
    def test_no_forbidden_terms_in_chat_templates(self):
        forbidden = ["Pruva", "Acme", "ACME", "Inter", "JetBrains"]
        for fn in os.listdir(TPL_DIR):
            with open(os.path.join(TPL_DIR, fn), encoding="utf-8") as f:
                src = f.read()
            for w in forbidden:
                self.assertNotIn(w, src, f"{fn} içinde yasak terim: {w}")

    def test_no_dark_mode_in_chat_templates(self):
        for fn in os.listdir(TPL_DIR):
            with open(os.path.join(TPL_DIR, fn), encoding="utf-8") as f:
                src = f.read()
            self.assertNotIn("prefers-color-scheme", src)


class NoOpGuardTest(TestCase):
    def test_no_websocket_or_channels_in_apps_chat(self):
        srcs = []
        for root, _, files in os.walk(APP_DIR):
            for fn in files:
                if fn.endswith(".py"):
                    with open(os.path.join(root, fn), encoding="utf-8") as f:
                        srcs.append(f.read())
        joined = "\n".join(srcs)
        # Strip docstrings and comments
        joined = re.sub(r'"""[\s\S]*?"""', "", joined)
        joined = re.sub(r"'''[\s\S]*?'''", "", joined)
        joined = re.sub(r"^\s*#.*$", "", joined, flags=re.M)
        for marker in ["channels.", "AsyncWebsocketConsumer", "WebsocketConsumer", "websocket_urlpatterns"]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_no_telegram_or_smtp_in_apps_chat(self):
        srcs = []
        for root, _, files in os.walk(APP_DIR):
            for fn in files:
                if fn.endswith(".py"):
                    with open(os.path.join(root, fn), encoding="utf-8") as f:
                        srcs.append(f.read())
        joined = "\n".join(srcs)
        joined = re.sub(r'"""[\s\S]*?"""', "", joined)
        joined = re.sub(r"'''[\s\S]*?'''", "", joined)
        joined = re.sub(r"^\s*#.*$", "", joined, flags=re.M)
        for marker in ["telegram_bot", "send_telegram", "send_mail", "smtplib"]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_no_celery_or_scheduler_in_apps_chat(self):
        srcs = []
        for root, _, files in os.walk(APP_DIR):
            for fn in files:
                if fn.endswith(".py"):
                    with open(os.path.join(root, fn), encoding="utf-8") as f:
                        srcs.append(f.read())
        joined = "\n".join(srcs)
        joined = re.sub(r'"""[\s\S]*?"""', "", joined)
        joined = re.sub(r"'''[\s\S]*?'''", "", joined)
        joined = re.sub(r"^\s*#.*$", "", joined, flags=re.M)
        for marker in ["celery", "apscheduler", "crontab("]:
            self.assertNotIn(marker, joined, f"Yasak: {marker}")

    def test_imports_does_not_create_chat(self):
        # apps.imports must not import apps.chat
        imports_dir = os.path.join(
            os.path.dirname(APP_DIR), "imports"
        )
        if not os.path.exists(imports_dir):
            return
        for root, _, files in os.walk(imports_dir):
            for fn in files:
                if not fn.endswith(".py"):
                    continue
                with open(os.path.join(root, fn), encoding="utf-8") as f:
                    src = f.read()
                self.assertNotIn("apps.chat", src)
