"""Faz 10 — Görev view'leri (Seed Design V2)."""
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import ValidationError
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.views.generic import DetailView, FormView, ListView, TemplateView, View

from apps.finance.permissions import can_approve, can_write

from .forms import (TaskAttachmentForm, TaskCommentForm, TaskForm,
                    TaskPostponeForm)
from .models import ACTIVE_STATUSES, Task, TaskPriority, TaskStatus
from .services.tasks import (add_comment, assign_task, attach_document,
                             cancel_task, complete_task, create_task,
                             get_overdue_tasks, get_today_tasks_for_user,
                             get_upcoming_tasks, postpone_task, reopen_task,
                             start_task, update_task)


class WriteMixin(UserPassesTestMixin):
    raise_exception = True

    def test_func(self):
        return can_write(self.request.user)


class ApproveMixin(UserPassesTestMixin):
    raise_exception = True

    def test_func(self):
        return can_approve(self.request.user)


# ------------------------------- list / queries ----------------------------

class TaskListView(LoginRequiredMixin, ListView):
    model = Task
    template_name = "tasks/task_list.html"
    context_object_name = "tasks"
    paginate_by = 50

    def get_queryset(self):
        qs = Task.objects.filter(is_active=True).select_related(
            "assigned_to", "created_by", "completed_by"
        )
        status = self.request.GET.get("status")
        priority = self.request.GET.get("priority")
        assigned = self.request.GET.get("assigned")
        if status:
            qs = qs.filter(status=status)
        if priority:
            qs = qs.filter(priority=priority)
        if assigned == "me":
            qs = qs.filter(assigned_to=self.request.user)
        return qs.order_by("-created_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["can_write"] = can_write(self.request.user)
        ctx["can_approve"] = can_approve(self.request.user)
        ctx["status_choices"] = TaskStatus.choices
        ctx["priority_choices"] = TaskPriority.choices
        ctx["filter_status"] = self.request.GET.get("status", "")
        ctx["filter_priority"] = self.request.GET.get("priority", "")
        ctx["filter_assigned"] = self.request.GET.get("assigned", "")
        return ctx


class TaskTodayView(LoginRequiredMixin, TemplateView):
    template_name = "tasks/task_today.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        user = self.request.user
        today = timezone.localdate()
        ctx["today"] = today
        ctx["today_tasks"] = get_today_tasks_for_user(user)
        ctx["overdue_tasks"] = get_overdue_tasks(user)
        ctx["upcoming_tasks"] = get_upcoming_tasks(user, days=7)
        ctx["can_write"] = can_write(user)
        return ctx


class TaskUpcomingView(LoginRequiredMixin, ListView):
    template_name = "tasks/task_list.html"
    context_object_name = "tasks"
    paginate_by = 50

    def get_queryset(self):
        return get_upcoming_tasks(days=14)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["page_title"] = "Yaklaşan Görevler"
        ctx["can_write"] = can_write(self.request.user)
        ctx["status_choices"] = TaskStatus.choices
        ctx["priority_choices"] = TaskPriority.choices
        return ctx


class TaskOverdueView(LoginRequiredMixin, ListView):
    template_name = "tasks/task_list.html"
    context_object_name = "tasks"
    paginate_by = 50

    def get_queryset(self):
        return get_overdue_tasks()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["page_title"] = "Geciken Görevler"
        ctx["can_write"] = can_write(self.request.user)
        ctx["status_choices"] = TaskStatus.choices
        ctx["priority_choices"] = TaskPriority.choices
        return ctx


class TaskAssignedToMeView(LoginRequiredMixin, ListView):
    template_name = "tasks/task_list.html"
    context_object_name = "tasks"
    paginate_by = 50

    def get_queryset(self):
        return Task.objects.filter(
            is_active=True, assigned_to=self.request.user,
            status__in=ACTIVE_STATUSES,
        ).order_by("due_date", "-priority")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["page_title"] = "Bana Atanan Görevler"
        ctx["can_write"] = can_write(self.request.user)
        ctx["status_choices"] = TaskStatus.choices
        ctx["priority_choices"] = TaskPriority.choices
        return ctx


class TaskCreatedByMeView(LoginRequiredMixin, ListView):
    template_name = "tasks/task_list.html"
    context_object_name = "tasks"
    paginate_by = 50

    def get_queryset(self):
        return Task.objects.filter(
            is_active=True, created_by=self.request.user,
        ).order_by("-created_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["page_title"] = "Oluşturduğum Görevler"
        ctx["can_write"] = can_write(self.request.user)
        ctx["status_choices"] = TaskStatus.choices
        ctx["priority_choices"] = TaskPriority.choices
        return ctx


# -------------------------------- create / edit ----------------------------

class TaskCreateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "tasks/task_form.html"
    form_class = TaskForm

    def form_valid(self, form):
        cd = form.cleaned_data
        task = create_task(
            title=cd["title"],
            description=cd.get("description") or "",
            assigned_to=cd.get("assigned_to"),
            created_by=self.request.user,
            priority=cd.get("priority") or TaskPriority.NORMAL,
            due_date=cd.get("due_date"),
            due_time=cd.get("due_time"),
        )
        messages.success(self.request, "Görev oluşturuldu.")
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": task.pk}))


class TaskCreateForObjectView(LoginRequiredMixin, WriteMixin, FormView):
    """Bir domain nesnesi için görev oluştur — querystring'ten related_app/model/object_id."""
    template_name = "tasks/task_form.html"
    form_class = TaskForm

    def get_initial(self):
        initial = super().get_initial()
        if title := self.request.GET.get("title"):
            initial["title"] = title
        return initial

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["related_app"] = self.request.GET.get("app", "")
        ctx["related_model"] = self.request.GET.get("model", "")
        ctx["related_object_id"] = self.request.GET.get("object_id", "")
        ctx["related_title"] = self.request.GET.get("related_title", "")
        return ctx

    def form_valid(self, form):
        cd = form.cleaned_data
        task = create_task(
            title=cd["title"],
            description=cd.get("description") or "",
            assigned_to=cd.get("assigned_to"),
            created_by=self.request.user,
            priority=cd.get("priority") or TaskPriority.NORMAL,
            due_date=cd.get("due_date"),
            due_time=cd.get("due_time"),
            related_app=self.request.GET.get("app", ""),
            related_model=self.request.GET.get("model", ""),
            related_object_id=self.request.GET.get("object_id", ""),
            related_title=self.request.GET.get("related_title", ""),
        )
        messages.success(self.request, "Bağlantılı görev oluşturuldu.")
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": task.pk}))


class TaskUpdateView(LoginRequiredMixin, WriteMixin, FormView):
    template_name = "tasks/task_form.html"
    form_class = TaskForm

    def dispatch(self, request, *args, **kwargs):
        self.task = get_object_or_404(Task, pk=kwargs["pk"], is_active=True)
        return super().dispatch(request, *args, **kwargs)

    def get_form_kwargs(self):
        kw = super().get_form_kwargs()
        kw["instance"] = self.task
        return kw

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["task"] = self.task
        ctx["edit_mode"] = True
        return ctx

    def form_valid(self, form):
        cd = form.cleaned_data
        update_task(
            self.task, actor=self.request.user,
            title=cd["title"], description=cd.get("description") or "",
            priority=cd.get("priority") or TaskPriority.NORMAL,
            due_date=cd.get("due_date"), due_time=cd.get("due_time"),
        )
        if cd.get("assigned_to") != self.task.assigned_to:
            assign_task(self.task, assignee=cd.get("assigned_to"), actor=self.request.user)
        messages.success(self.request, "Görev güncellendi.")
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": self.task.pk}))


# -------------------------------- detail -----------------------------------

class TaskDetailView(LoginRequiredMixin, DetailView):
    model = Task
    template_name = "tasks/task_detail.html"
    context_object_name = "task"

    def get_queryset(self):
        return Task.objects.filter(is_active=True).select_related(
            "assigned_to", "created_by", "completed_by", "cancelled_by"
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        task = self.object
        ctx["comments"] = task.comments.filter(is_active=True).select_related("author")
        ctx["attachments"] = task.attachments.filter(is_active=True).select_related(
            "document", "uploaded_by"
        )
        ctx["events"] = task.events.select_related("actor")[:30]
        ctx["comment_form"] = TaskCommentForm()
        ctx["attachment_form"] = TaskAttachmentForm()
        ctx["postpone_form"] = TaskPostponeForm()
        ctx["can_write"] = can_write(self.request.user)
        ctx["can_approve"] = can_approve(self.request.user)
        ctx["can_complete"] = (
            can_write(self.request.user)
            or task.assigned_to_id == self.request.user.id
        )
        return ctx


# ----------------------------- transition actions --------------------------

class TaskStartView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_active=True)
        try:
            start_task(task, actor=request.user)
            messages.success(request, "Görev başladı.")
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))


class TaskPostponeView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_active=True)
        form = TaskPostponeForm(request.POST)
        if not form.is_valid():
            messages.error(request, "Form geçersiz.")
            return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))
        try:
            postpone_task(
                task,
                postponed_until=form.cleaned_data["postponed_until"],
                actor=request.user,
                reason=form.cleaned_data.get("reason") or "",
            )
            messages.success(request, "Görev ertelendi.")
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))


class TaskCompleteView(LoginRequiredMixin, View):
    """Atanan personel kendi görevini tamamlayabilir; aksi yazma yetkisi gerekir."""

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_active=True)
        is_assignee = task.assigned_to_id == request.user.id
        if not (is_assignee or can_write(request.user)):
            messages.error(request, "Yetki yok.")
            return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))
        try:
            complete_task(task, actor=request.user)
            messages.success(request, "Görev tamamlandı.")
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))


class TaskCancelView(LoginRequiredMixin, ApproveMixin, View):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_active=True)
        reason = request.POST.get("reason", "")
        try:
            cancel_task(task, actor=request.user, reason=reason)
            messages.success(request, "Görev iptal.")
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))


class TaskReopenView(LoginRequiredMixin, ApproveMixin, View):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_active=True)
        try:
            reopen_task(task, actor=request.user)
            messages.success(request, "Görev yeniden açıldı.")
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))


class TaskCommentCreateView(LoginRequiredMixin, View):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_active=True)
        form = TaskCommentForm(request.POST)
        if not form.is_valid():
            messages.error(request, "Yorum boş olamaz.")
            return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))
        try:
            add_comment(task, body=form.cleaned_data["body"], author=request.user)
            messages.success(request, "Yorum eklendi.")
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))


class TaskAttachmentCreateView(LoginRequiredMixin, WriteMixin, View):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, is_active=True)
        form = TaskAttachmentForm(request.POST, request.FILES)
        if not form.is_valid():
            messages.error(request, "Dosya yükleme başarısız.")
            return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))
        try:
            attach_document(
                task,
                django_file=form.cleaned_data["file"],
                uploaded_by=request.user,
                title=form.cleaned_data.get("title") or "",
            )
            messages.success(request, "Belge eklendi.")
        except ValidationError as e:
            messages.error(request, "; ".join(e.messages))
        return HttpResponseRedirect(reverse("tasks:detail", kwargs={"pk": pk}))
