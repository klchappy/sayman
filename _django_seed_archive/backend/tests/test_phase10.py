"""
Faz 10 — Ajanda / Görev Yönetimi testleri.

Lifecycle, permissions, queries, generic relation, dashboard render, UI contract.
"""
from datetime import timedelta
from io import BytesIO

from django.contrib.auth.models import Group, User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.tasks.models import (ACTIVE_STATUSES, Task, TaskAttachment,
                                TaskComment, TaskEvent, TaskEventType,
                                TaskPriority, TaskSource, TaskStatus)
from apps.tasks.services import (add_comment, assign_task, attach_document,
                                  cancel_task, complete_task, create_task,
                                  create_task_for_object, get_overdue_tasks,
                                  get_tasks_for_object,
                                  get_today_tasks_for_user,
                                  get_upcoming_tasks, postpone_task,
                                  reopen_task, start_task, update_task)


def _user(name="u", groups=("super_admin",), is_super=True):
    u = User.objects.create_user(name, password="pw12345xx")
    if is_super:
        u.is_superuser = True
        u.save()
    for g in groups:
        grp, _ = Group.objects.get_or_create(name=g)
        u.groups.add(grp)
    return u


class TaskLifecycleTest(TestCase):
    """create / start / postpone / complete / cancel / reopen + invalid transitions."""

    def setUp(self):
        self.actor = _user("lc_actor")
        self.assignee = _user("lc_assignee", groups=("personel",), is_super=False)

    def test_create_emits_event_and_audit(self):
        t = create_task(title="Fatura yükle", created_by=self.actor,
                        priority=TaskPriority.HIGH, due_date=timezone.localdate())
        self.assertEqual(t.status, TaskStatus.OPEN)
        self.assertEqual(t.priority, TaskPriority.HIGH)
        self.assertTrue(TaskEvent.objects.filter(task=t, event_type=TaskEventType.CREATED).exists())
        self.assertTrue(AuditLog.objects.filter(
            app_label="tasks", model_name="task", object_id=str(t.pk), action="CREATE"
        ).exists())

    def test_create_with_assignment_emits_assigned_event(self):
        t = create_task(title="X", created_by=self.actor, assigned_to=self.assignee)
        self.assertTrue(TaskEvent.objects.filter(task=t, event_type=TaskEventType.ASSIGNED).exists())

    def test_create_requires_title(self):
        with self.assertRaises(ValidationError):
            create_task(title="   ", created_by=self.actor)

    def test_start_then_complete(self):
        t = create_task(title="X", created_by=self.actor)
        start_task(t, actor=self.actor)
        t.refresh_from_db()
        self.assertEqual(t.status, TaskStatus.IN_PROGRESS)
        complete_task(t, actor=self.actor)
        t.refresh_from_db()
        self.assertEqual(t.status, TaskStatus.COMPLETED)
        self.assertIsNotNone(t.completed_at)
        self.assertEqual(t.completed_by, self.actor)

    def test_double_complete_raises(self):
        t = create_task(title="X", created_by=self.actor)
        complete_task(t, actor=self.actor)
        with self.assertRaises(ValidationError):
            complete_task(t, actor=self.actor)

    def test_cancel_then_complete_raises(self):
        t = create_task(title="X", created_by=self.actor)
        cancel_task(t, actor=self.actor, reason="iptal")
        with self.assertRaises(ValidationError):
            complete_task(t, actor=self.actor)

    def test_postpone_requires_future(self):
        t = create_task(title="X", created_by=self.actor)
        with self.assertRaises(ValidationError):
            postpone_task(t, postponed_until=timezone.localdate(), actor=self.actor)

    def test_postpone_sets_status_and_due(self):
        t = create_task(title="X", created_by=self.actor)
        new_due = timezone.localdate() + timedelta(days=3)
        postpone_task(t, postponed_until=new_due, actor=self.actor, reason="bekliyor")
        t.refresh_from_db()
        self.assertEqual(t.status, TaskStatus.POSTPONED)
        self.assertEqual(t.due_date, new_due)
        self.assertEqual(t.postponed_until, new_due)
        # Sebep yorum olarak eklenmiş
        self.assertTrue(t.comments.filter(is_system=True).exists())

    def test_reopen_clears_terminal_fields(self):
        t = create_task(title="X", created_by=self.actor)
        complete_task(t, actor=self.actor)
        reopen_task(t, actor=self.actor)
        t.refresh_from_db()
        self.assertEqual(t.status, TaskStatus.OPEN)
        self.assertIsNone(t.completed_at)
        self.assertIsNone(t.completed_by)

    def test_reopen_only_terminal(self):
        t = create_task(title="X", created_by=self.actor)
        with self.assertRaises(ValidationError):
            reopen_task(t, actor=self.actor)

    def test_assign_emits_event(self):
        t = create_task(title="X", created_by=self.actor)
        assign_task(t, assignee=self.assignee, actor=self.actor)
        t.refresh_from_db()
        self.assertEqual(t.assigned_to, self.assignee)
        self.assertTrue(TaskEvent.objects.filter(task=t, event_type=TaskEventType.ASSIGNED).exists())

    def test_update_changes_tracked(self):
        t = create_task(title="X", created_by=self.actor, priority=TaskPriority.LOW)
        update_task(t, actor=self.actor, title="Y", priority=TaskPriority.HIGH)
        t.refresh_from_db()
        self.assertEqual(t.title, "Y")
        self.assertEqual(t.priority, TaskPriority.HIGH)
        self.assertTrue(TaskEvent.objects.filter(task=t, event_type=TaskEventType.UPDATED).exists())


class TaskCommentAttachmentTest(TestCase):
    def setUp(self):
        self.actor = _user("ca_actor")

    def test_comment_emits_event(self):
        t = create_task(title="X", created_by=self.actor)
        c = add_comment(t, body="merhaba", author=self.actor)
        self.assertEqual(c.body, "merhaba")
        self.assertTrue(TaskEvent.objects.filter(task=t, event_type=TaskEventType.COMMENTED).exists())

    def test_empty_comment_raises(self):
        t = create_task(title="X", created_by=self.actor)
        with self.assertRaises(ValidationError):
            add_comment(t, body="   ", author=self.actor)

    def test_attachment_dedup_by_sha256(self):
        t = create_task(title="X", created_by=self.actor)
        f1 = SimpleUploadedFile("a.txt", b"hello-world", content_type="text/plain")
        a1 = attach_document(t, django_file=f1, uploaded_by=self.actor, title="A")
        # Aynı içerik tekrar yüklendiğinde aynı Document'i bağla
        f2 = SimpleUploadedFile("b.txt", b"hello-world", content_type="text/plain")
        t2 = create_task(title="Y", created_by=self.actor)
        a2 = attach_document(t2, django_file=f2, uploaded_by=self.actor)
        self.assertEqual(a1.document.pk, a2.document.pk)

    def test_attachment_unique_per_task(self):
        t = create_task(title="X", created_by=self.actor)
        f = SimpleUploadedFile("a.txt", b"x", content_type="text/plain")
        a1 = attach_document(t, django_file=f, uploaded_by=self.actor)
        # Aynı task + aynı document → idempotent (get_or_create)
        a2 = attach_document(t, document=a1.document, uploaded_by=self.actor)
        self.assertEqual(a1.pk, a2.pk)
        self.assertEqual(t.attachments.count(), 1)


class TaskQueryTest(TestCase):
    def setUp(self):
        self.user = _user("q_user")
        today = timezone.localdate()
        self.t_today = create_task(title="Today", created_by=self.user,
                                    assigned_to=self.user, due_date=today)
        self.t_overdue = create_task(title="Overdue", created_by=self.user,
                                      assigned_to=self.user,
                                      due_date=today - timedelta(days=2))
        self.t_upcoming = create_task(title="Upcoming", created_by=self.user,
                                       assigned_to=self.user,
                                       due_date=today + timedelta(days=3))
        self.t_done = create_task(title="Done", created_by=self.user,
                                   assigned_to=self.user, due_date=today)
        complete_task(self.t_done, actor=self.user)

    def test_today_includes_today_and_overdue(self):
        ids = set(get_today_tasks_for_user(self.user).values_list("pk", flat=True))
        self.assertIn(self.t_today.pk, ids)
        self.assertIn(self.t_overdue.pk, ids)
        self.assertNotIn(self.t_done.pk, ids)
        self.assertNotIn(self.t_upcoming.pk, ids)

    def test_overdue_only_overdue(self):
        ids = set(get_overdue_tasks(self.user).values_list("pk", flat=True))
        self.assertEqual(ids, {self.t_overdue.pk})

    def test_upcoming_in_window(self):
        ids = set(get_upcoming_tasks(self.user, days=7).values_list("pk", flat=True))
        self.assertIn(self.t_upcoming.pk, ids)
        self.assertIn(self.t_today.pk, ids)
        self.assertNotIn(self.t_overdue.pk, ids)
        self.assertNotIn(self.t_done.pk, ids)


class TaskGenericRelationTest(TestCase):
    """create_task_for_object / get_tasks_for_object."""

    def setUp(self):
        self.user = _user("gr_user")

    def test_create_for_payable(self):
        # PayableItem yerine — herhangi bir model'i oluşturmak yerine soyut bir
        # ihtiyaca dayalı: AuditLog'u kullanıyoruz mu? Daha güvenli — kendi Task'ı obje olarak
        # kullan: bir Task'ı diğer Task'a bağla (anlamsız ama generic relation testi için yeterli).
        target = create_task(title="hedef", created_by=self.user)
        t = create_task_for_object(
            target, title="Görevin için iş", created_by=self.user,
            priority=TaskPriority.HIGH,
        )
        self.assertEqual(t.related_app, "tasks")
        self.assertEqual(t.related_model, "task")
        self.assertEqual(t.related_object_id, str(target.pk))
        self.assertEqual(t.related_title[:5], str(target)[:5])

    def test_get_tasks_for_object_filters_active(self):
        target = create_task(title="hedef", created_by=self.user)
        t1 = create_task_for_object(target, title="A", created_by=self.user)
        t2 = create_task_for_object(target, title="B", created_by=self.user)
        complete_task(t2, actor=self.user)
        active = list(get_tasks_for_object(target))
        self.assertIn(t1, active)
        self.assertNotIn(t2, active)
        all_ = list(get_tasks_for_object(target, include_terminal=True))
        self.assertIn(t2, all_)


class TaskPermissionTest(TestCase):
    """View-level yetki kontrolleri."""

    def setUp(self):
        self.viewer = _user("v_view", groups=("goruntuleyici",), is_super=False)
        self.writer = _user("v_write", groups=("muhasebeci",), is_super=False)
        self.approver = _user("v_appr", groups=("yonetici",), is_super=False)
        self.assignee = _user("v_assg", groups=("personel",), is_super=False)
        self.task = create_task(
            title="P", created_by=self.writer, assigned_to=self.assignee,
        )

    def _login(self, user):
        c = Client()
        c.force_login(user)
        return c

    def test_viewer_cannot_create(self):
        c = self._login(self.viewer)
        res = c.get(reverse("tasks:create"))
        self.assertEqual(res.status_code, 403)

    def test_writer_can_create(self):
        c = self._login(self.writer)
        res = c.get(reverse("tasks:create"))
        self.assertEqual(res.status_code, 200)

    def test_assignee_can_complete_own(self):
        c = self._login(self.assignee)
        res = c.post(reverse("tasks:complete", kwargs={"pk": self.task.pk}))
        self.assertEqual(res.status_code, 302)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.COMPLETED)

    def test_viewer_cannot_complete(self):
        c = self._login(self.viewer)
        res = c.post(reverse("tasks:complete", kwargs={"pk": self.task.pk}))
        # 302 to detail with messages.error (idempotent redirect)
        self.assertEqual(res.status_code, 302)
        self.task.refresh_from_db()
        self.assertNotEqual(self.task.status, TaskStatus.COMPLETED)

    def test_only_approver_can_cancel(self):
        c = self._login(self.writer)
        res = c.post(reverse("tasks:cancel", kwargs={"pk": self.task.pk}))
        self.assertEqual(res.status_code, 403)
        c2 = self._login(self.approver)
        res2 = c2.post(reverse("tasks:cancel", kwargs={"pk": self.task.pk}),
                       data={"reason": "x"})
        self.assertEqual(res2.status_code, 302)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.CANCELLED)


class TaskDashboardRenderTest(TestCase):
    def setUp(self):
        self.user = _user("dash_user")
        today = timezone.localdate()
        create_task(title="Bugünkü görev", created_by=self.user,
                    assigned_to=self.user, due_date=today,
                    priority=TaskPriority.CRITICAL)
        create_task(title="Geciken görev", created_by=self.user,
                    assigned_to=self.user,
                    due_date=today - timedelta(days=1))

    def test_dashboard_renders_task_widgets(self):
        c = Client()
        c.force_login(self.user)
        res = c.get(reverse("dashboard:home"))
        self.assertEqual(res.status_code, 200)
        body = res.content.decode("utf-8")
        self.assertIn("Bugünkü Görevlerim", body)
        self.assertIn("Bugünkü görev", body)
        # Phase 10 widget grid
        self.assertIn("Geciken", body)
        self.assertIn("Kritik", body)


class TaskUiContractTest(TestCase):
    """Faz 10 UI ekledikten sonra UI Identity Reset sözleşmesi korunuyor."""

    def setUp(self):
        self.user = _user("uc_user")

    def test_task_list_renders(self):
        c = Client()
        c.force_login(self.user)
        res = c.get(reverse("tasks:list"))
        self.assertEqual(res.status_code, 200)
        body = res.content.decode("utf-8")
        # OPS kimliği topbar'dan render
        self.assertIn("OPS", body)
        # Yasak kelime yok (dashboard sidebar'dan render edilen alan)
        self.assertNotIn("Pruva", body)
        self.assertNotIn("Acme", body)

    def test_today_view_renders(self):
        c = Client()
        c.force_login(self.user)
        res = c.get(reverse("tasks:today"))
        self.assertEqual(res.status_code, 200)
        body = res.content.decode("utf-8")
        self.assertIn("Bugün", body)


class TaskNoOpGuardTest(TestCase):
    """Anayasa: Telegram/cron yok; import commit Task üretmez."""

    def test_no_telegram_send_imports(self):
        from apps.tasks import services
        # Servis modülünde Telegram/mail sender çağrısı YOK
        # (docstring'lerdeki "Telegram yok" notlarını ayıkla — sadece kod satırları)
        import inspect, re
        src = inspect.getsource(services.tasks)
        # Triple-quote docstring'leri ve yorum satırlarını çıkar
        no_doc = re.sub(r'"""[\s\S]*?"""', "", src)
        no_doc = re.sub(r"^\s*#.*$", "", no_doc, flags=re.MULTILINE)
        self.assertNotIn("send_mail", no_doc)
        self.assertNotIn("smtp", no_doc.lower())
        # Telegram API import / client çağrısı
        self.assertNotIn("telegram_bot", no_doc.lower())
        self.assertNotIn("send_telegram", no_doc.lower())
        self.assertNotIn("python-telegram", no_doc.lower())
        self.assertNotIn("telebot", no_doc.lower())

    def test_no_cron_or_scheduler_in_apps_tasks(self):
        from pathlib import Path
        from apps.tasks import services as svc_pkg
        root = Path(svc_pkg.__file__).resolve().parent.parent
        for p in root.rglob("*.py"):
            txt = p.read_text(encoding="utf-8").lower()
            self.assertNotIn("celery", txt, f"{p}: celery yasak")
            self.assertNotIn("apscheduler", txt, f"{p}: apscheduler yasak")
            self.assertNotIn("crontab(", txt, f"{p}: crontab yasak")

    def test_imports_does_not_create_tasks(self):
        # apps.imports modülünden Task üretimi YOK
        import inspect
        from apps.imports import services as imp_services
        for name in dir(imp_services):
            obj = getattr(imp_services, name)
            if not inspect.ismodule(obj):
                continue
            try:
                src = inspect.getsource(obj)
            except Exception:
                continue
            # create_task çağrısı yok
            self.assertNotIn("from apps.tasks", src)
            self.assertNotIn("apps.tasks.services", src)


class TaskDomainPanelIncludeTest(TestCase):
    """11 detay sayfasında 'Bağlı Görevler' paneli include ediliyor."""

    PATHS = [
        "templates/finance/payable_detail.html",
        "templates/subscriptions/subscription_detail.html",
        "templates/regular_payments/profile_detail.html",
        "templates/official_payments/profile_detail.html",
        "templates/pruva/statement_detail.html",
        "templates/properties/installment_detail.html",
        "templates/guarantees/guarantee_detail.html",
        "templates/guarantees/commission_period_detail.html",
        "templates/integrators/service_detail.html",
        "templates/integrators/contract_detail.html",
        "templates/integrators/credit_package_detail.html",
    ]

    def test_panel_loaded_in_all_detail_templates(self):
        from pathlib import Path
        backend = Path(__file__).resolve().parent.parent
        missing = []
        for rel in self.PATHS:
            p = backend / rel
            if not p.exists():
                missing.append(f"{rel}: missing file")
                continue
            content = p.read_text(encoding="utf-8")
            if "tasks_tags" not in content or "related_tasks_panel" not in content:
                missing.append(rel)
        self.assertFalse(missing, f"Görev paneli eksik: {missing}")
