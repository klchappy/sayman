from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "app_label", "model_name", "object_repr", "summary")
    list_filter = ("action", "app_label", "model_name")
    search_fields = ("object_repr", "summary", "actor__username")
    readonly_fields = [f.name for f in AuditLog._meta.fields]
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
