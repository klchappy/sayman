from django.contrib import admin

from .models import SystemSetting


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "value_type", "description", "is_active", "updated_at")
    list_filter = ("value_type", "is_active")
    search_fields = ("key", "description")
    readonly_fields = ("created_at", "updated_at")
