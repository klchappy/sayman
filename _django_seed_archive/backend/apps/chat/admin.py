from django.contrib import admin

from .models import (
    ChatAttachment,
    ChatEvent,
    ChatMessage,
    ChatParticipant,
    ChatThread,
)


@admin.register(ChatThread)
class ChatThreadAdmin(admin.ModelAdmin):
    list_display = ("__str__", "thread_type", "status", "created_by", "last_message_at", "is_active")
    list_filter = ("thread_type", "status", "is_active")
    search_fields = ("title", "related_title", "related_app", "related_model")


@admin.register(ChatParticipant)
class ChatParticipantAdmin(admin.ModelAdmin):
    list_display = ("thread", "user", "role", "last_read_at", "muted", "is_active")
    list_filter = ("role", "muted", "is_active")
    search_fields = ("thread__title", "user__username")


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("thread", "sender", "message_type", "status", "sent_at")
    list_filter = ("message_type", "status")
    search_fields = ("body",)


@admin.register(ChatAttachment)
class ChatAttachmentAdmin(admin.ModelAdmin):
    list_display = ("message", "document", "uploaded_by", "created_at")
    search_fields = ("document__title",)


@admin.register(ChatEvent)
class ChatEventAdmin(admin.ModelAdmin):
    list_display = ("thread", "event_type", "actor", "created_at")
    list_filter = ("event_type",)
    search_fields = ("summary",)
