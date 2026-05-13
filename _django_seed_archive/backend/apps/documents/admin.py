from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "document_type", "source", "file_size", "sha256_short", "uploaded_by", "uploaded_at", "is_active")
    list_filter = ("document_type", "source", "is_active")
    search_fields = ("title", "original_filename", "sha256")
    readonly_fields = ("sha256", "file_size", "stored_filename", "uploaded_at", "created_at", "updated_at")

    @admin.display(description="SHA-256 (kısa)")
    def sha256_short(self, obj):
        return obj.sha256[:12] + "…" if obj.sha256 else "—"
