from django.contrib import admin

from .models import Task, TaskAttachment, TaskComment, TaskEvent


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "assigned_to", "priority", "status",
                    "due_date", "source", "is_active")
    list_filter = ("status", "priority", "source", "is_active")
    search_fields = ("title", "description", "related_title")
    readonly_fields = ("completed_at", "completed_by", "cancelled_at",
                       "cancelled_by", "postponed_until")


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ("task", "author", "is_system", "created_at", "is_active")
    list_filter = ("is_system", "is_active")
    search_fields = ("body",)


@admin.register(TaskAttachment)
class TaskAttachmentAdmin(admin.ModelAdmin):
    list_display = ("task", "document", "uploaded_by", "created_at", "is_active")
    list_filter = ("is_active",)


@admin.register(TaskEvent)
class TaskEventAdmin(admin.ModelAdmin):
    list_display = ("task", "event_type", "actor", "created_at")
    list_filter = ("event_type",)
    search_fields = ("summary",)
    readonly_fields = ("task", "event_type", "actor", "summary", "metadata", "created_at")
