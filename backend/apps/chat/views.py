"""Chat views — Faz 11. JSON poll endpoints (WebSocket YOK)."""
from __future__ import annotations

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_GET, require_POST
from django.views.generic import ListView, TemplateView, View

from apps.finance.permissions import can_approve, can_write

from .forms import ChatAttachmentForm, ChatMessageForm, ChatThreadForm
from .models import ChatMessage, ChatMessageStatus, ChatThread, ChatThreadStatus
from .services import (
    add_participant,
    archive_thread,
    attach_document_to_message,
    close_thread,
    create_thread,
    get_or_create_record_thread,
    get_or_create_task_thread,
    get_thread_messages,
    get_unread_count,
    get_user_threads,
    mark_thread_read,
    reply_message,
    send_message,
    soft_delete_message,
    user_can_view_thread,
)

User = get_user_model()


class WriteMixin(UserPassesTestMixin):
    raise_exception = True

    def test_func(self):
        return can_write(self.request.user)


# ---------- screens ----------


class MessageCenterView(LoginRequiredMixin, TemplateView):
    template_name = "chat/message_center.html"

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        threads = list(get_user_threads(self.request.user)[:200])
        ctx["threads"] = threads
        active_id = self.request.GET.get("thread")
        active = None
        messages = []
        if active_id:
            try:
                active = ChatThread.objects.get(pk=active_id)
                if user_can_view_thread(self.request.user, active):
                    messages = list(get_thread_messages(active))
                    mark_thread_read(actor=self.request.user, thread=active, request=self.request)
                else:
                    active = None
            except ChatThread.DoesNotExist:
                active = None
        elif threads:
            active = threads[0]
            messages = list(get_thread_messages(active))
            mark_thread_read(actor=self.request.user, thread=active, request=self.request)
        ctx["active_thread"] = active
        ctx["messages"] = messages
        ctx["message_form"] = ChatMessageForm()
        ctx["attachment_form"] = ChatAttachmentForm()
        ctx["unread_count"] = get_unread_count(user=self.request.user)
        return ctx


# Backwards-compat: existing /chat/ URL still works as message center
ChatCenterView = MessageCenterView


class ThreadListView(LoginRequiredMixin, ListView):
    template_name = "chat/thread_list.html"
    context_object_name = "threads"
    paginate_by = 30

    def get_queryset(self):
        return get_user_threads(self.request.user)


class ThreadDetailView(LoginRequiredMixin, TemplateView):
    template_name = "chat/thread_detail.html"

    def get_context_data(self, **kw):
        ctx = super().get_context_data(**kw)
        thread = get_object_or_404(ChatThread, pk=self.kwargs["pk"])
        if not user_can_view_thread(self.request.user, thread):
            raise PermissionDenied("Bu konuyu görüntüleyemezsiniz.")
        mark_thread_read(actor=self.request.user, thread=thread, request=self.request)
        ctx["thread"] = thread
        ctx["messages"] = list(get_thread_messages(thread))
        ctx["message_form"] = ChatMessageForm()
        ctx["attachment_form"] = ChatAttachmentForm()
        ctx["can_close"] = can_approve(self.request.user)
        return ctx


class ThreadCreateView(LoginRequiredMixin, WriteMixin, View):
    def get(self, request):
        form = ChatThreadForm()
        return render(request, "chat/thread_form.html", {"form": form})

    def post(self, request):
        form = ChatThreadForm(request.POST)
        if not form.is_valid():
            return render(request, "chat/thread_form.html", {"form": form})
        thread = create_thread(
            actor=request.user,
            title=form.cleaned_data.get("title", ""),
            thread_type=form.cleaned_data.get("thread_type"),
            participants=list(form.cleaned_data.get("participants") or []),
            request=request,
        )
        return redirect(reverse("chat:thread_detail", args=[thread.pk]))


class ThreadCreateForObjectView(LoginRequiredMixin, WriteMixin, View):
    """Domain detay sayfasından çağrılır."""

    def get(self, request):
        return self._handle(request)

    def post(self, request):
        return self._handle(request)

    def _handle(self, request):
        app = request.GET.get("app") or request.POST.get("app")
        model = request.GET.get("model") or request.POST.get("model")
        oid = request.GET.get("object_id") or request.POST.get("object_id")
        if not (app and model and oid):
            return HttpResponseBadRequest("app/model/object_id gerekli")
        Model = django_apps.get_model(app, model)
        obj = get_object_or_404(Model, pk=oid)
        thread = get_or_create_record_thread(actor=request.user, obj=obj, request=request)
        return redirect(reverse("chat:thread_detail", args=[thread.pk]))


class ThreadCreateForTaskView(LoginRequiredMixin, WriteMixin, View):
    def get(self, request, task_id):
        return self._handle(request, task_id)

    def post(self, request, task_id):
        return self._handle(request, task_id)

    def _handle(self, request, task_id):
        Task = django_apps.get_model("tasks", "Task")
        task = get_object_or_404(Task, pk=task_id)
        thread = get_or_create_task_thread(actor=request.user, task=task, request=request)
        return redirect(reverse("chat:thread_detail", args=[thread.pk]))


# ---------- message actions ----------


@login_required
@require_POST
def send_message_view(request, pk):
    thread = get_object_or_404(ChatThread, pk=pk)
    form = ChatMessageForm(request.POST)
    if not form.is_valid():
        return redirect(reverse("chat:thread_detail", args=[thread.pk]))
    try:
        send_message(
            actor=request.user,
            thread=thread,
            body=form.cleaned_data["body"],
            request=request,
        )
    except (PermissionDenied, ValidationError):
        pass
    return redirect(reverse("chat:thread_detail", args=[thread.pk]))


@login_required
@require_POST
def reply_message_view(request, pk):
    parent = get_object_or_404(ChatMessage, pk=pk)
    form = ChatMessageForm(request.POST)
    if form.is_valid():
        reply_message(
            actor=request.user,
            parent_message=parent,
            body=form.cleaned_data["body"],
            request=request,
        )
    return redirect(reverse("chat:thread_detail", args=[parent.thread_id]))


@login_required
@require_POST
def delete_message_view(request, pk):
    msg = get_object_or_404(ChatMessage, pk=pk)
    try:
        soft_delete_message(actor=request.user, message=msg, request=request)
    except PermissionDenied:
        pass
    return redirect(reverse("chat:thread_detail", args=[msg.thread_id]))


@login_required
@require_POST
def attach_view(request, pk):
    thread = get_object_or_404(ChatThread, pk=pk)
    form = ChatAttachmentForm(request.POST, request.FILES)
    if not form.is_valid():
        return redirect(reverse("chat:thread_detail", args=[thread.pk]))
    try:
        # Önce yer tutucu mesaj oluştur (FILE)
        msg = send_message(
            actor=request.user,
            thread=thread,
            body=form.cleaned_data.get("title") or form.cleaned_data["file"].name,
            message_type="FILE",
            request=request,
        )
        attach_document_to_message(
            actor=request.user,
            message=msg,
            django_file=form.cleaned_data["file"],
            title=form.cleaned_data.get("title", ""),
            request=request,
        )
    except (PermissionDenied, ValidationError):
        pass
    return redirect(reverse("chat:thread_detail", args=[thread.pk]))


@login_required
@require_POST
def mark_read_view(request, pk):
    thread = get_object_or_404(ChatThread, pk=pk)
    if user_can_view_thread(request.user, thread):
        mark_thread_read(actor=request.user, thread=thread, request=request)
    return JsonResponse({"ok": True})


@login_required
@require_POST
def close_view(request, pk):
    thread = get_object_or_404(ChatThread, pk=pk)
    try:
        close_thread(actor=request.user, thread=thread, request=request)
    except PermissionDenied:
        pass
    return redirect(reverse("chat:thread_detail", args=[thread.pk]))


@login_required
@require_POST
def archive_view(request, pk):
    thread = get_object_or_404(ChatThread, pk=pk)
    try:
        archive_thread(actor=request.user, thread=thread, request=request)
    except PermissionDenied:
        pass
    return redirect(reverse("chat:thread_detail", args=[thread.pk]))


# ---------- widget JSON poll endpoints ----------


@login_required
@require_GET
def widget_view(request):
    """Widget bottom-right partial."""
    threads = list(get_user_threads(request.user)[:5])
    unread = get_unread_count(user=request.user)
    return render(
        request, "chat/widget.html",
        {"threads": threads, "unread_count": unread},
    )


@login_required
@require_GET
def widget_unread(request):
    return JsonResponse({"unread_count": get_unread_count(user=request.user)})


@login_required
@require_GET
def widget_threads(request):
    threads = get_user_threads(request.user)[:20]
    data = [
        {
            "id": t.pk,
            "title": str(t),
            "type": t.thread_type,
            "preview": t.last_message_preview,
            "last_at": t.last_message_at.isoformat() if t.last_message_at else None,
            "url": reverse("chat:thread_detail", args=[t.pk]),
        }
        for t in threads
    ]
    return JsonResponse({"threads": data})


@login_required
@require_GET
def widget_thread_messages(request, pk):
    thread = get_object_or_404(ChatThread, pk=pk)
    if not user_can_view_thread(request.user, thread):
        return JsonResponse({"messages": []}, status=403)
    msgs = get_thread_messages(thread)[:200]
    data = [
        {
            "id": m.pk,
            "sender": str(m.sender) if m.sender else "",
            "sender_id": m.sender_id,
            "body": m.body if m.status != ChatMessageStatus.DELETED else "",
            "type": m.message_type,
            "status": m.status,
            "sent_at": m.sent_at.isoformat() if m.sent_at else None,
            "reply_to": m.reply_to_id,
        }
        for m in msgs
    ]
    return JsonResponse({"thread_id": thread.pk, "messages": data})
