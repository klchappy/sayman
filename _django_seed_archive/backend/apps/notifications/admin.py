from django.contrib import admin

from .models import NotificationLog, NotificationPreference, NotificationRule


@admin.register(NotificationRule)
class NotificationRuleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "trigger_type", "channel",
                    "severity", "is_active", "dry_run_only")
    list_filter = ("category", "trigger_type", "channel", "severity",
                   "is_active", "dry_run_only")
    search_fields = ("code", "name")


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "category", "severity", "channel", "title",
                    "status", "dry_run", "real_send_allowed")
    list_filter = ("category", "severity", "channel", "status", "dry_run")
    search_fields = ("title", "message", "related_object_id")
    readonly_fields = ("created_at", "sent_at")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "category", "dashboard_enabled", "telegram_enabled",
                    "email_enabled", "muted")
    list_filter = ("category", "dashboard_enabled", "telegram_enabled", "muted")
    search_fields = ("user__username",)
