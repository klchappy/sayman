from django.contrib import admin

from .models import ReportRun, ReportTemplate


@admin.register(ReportTemplate)
class ReportTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "report_type", "default_format", "is_active", "updated_at")
    list_filter = ("report_type", "default_format", "is_active")
    search_fields = ("name", "slug", "description")


@admin.register(ReportRun)
class ReportRunAdmin(admin.ModelAdmin):
    list_display = ("report_type", "format", "status", "row_count", "created_by", "created_at")
    list_filter = ("report_type", "format", "status")
    search_fields = ("title", "error_message")
