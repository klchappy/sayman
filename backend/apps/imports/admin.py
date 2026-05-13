from django.contrib import admin

from .models import (
    ImportBatch,
    ImportDraftField,
    ImportDraftRecord,
    ImportLog,
    ImportMappingProfile,
    ImportSourceFile,
)


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = ("batch_id", "title", "source_type", "target_module", "status",
                    "row_count", "ok_count", "warning_count", "error_count", "manual_review_count",
                    "created_by", "created_at")
    list_filter = ("status", "source_type", "target_module", "historical_data")
    search_fields = ("title", "batch_id")
    readonly_fields = ("batch_id", "parsed_at", "approved_at", "committed_at", "rollback_until",
                       "row_count", "ok_count", "warning_count", "error_count", "manual_review_count",
                       "created_at", "updated_at")


@admin.register(ImportSourceFile)
class ImportSourceFileAdmin(admin.ModelAdmin):
    list_display = ("batch", "sheet_name", "document", "row_count", "status")
    list_filter = ("status",)
    search_fields = ("sheet_name", "document__original_filename")


@admin.register(ImportDraftRecord)
class ImportDraftRecordAdmin(admin.ModelAdmin):
    list_display = ("batch", "source_row_number", "validation_status", "status",
                    "suggested_action", "display_title")
    list_filter = ("validation_status", "status", "suggested_action")
    search_fields = ("display_title", "record_key")


@admin.register(ImportDraftField)
class ImportDraftFieldAdmin(admin.ModelAdmin):
    list_display = ("draft_record", "field_name", "status", "confidence")
    list_filter = ("status",)


@admin.register(ImportLog)
class ImportLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "batch", "level", "code", "message")
    list_filter = ("level",)
    search_fields = ("code", "message")


@admin.register(ImportMappingProfile)
class ImportMappingProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "source_type", "target_module", "is_active", "created_at")
    list_filter = ("source_type", "target_module", "is_active")
    search_fields = ("name",)
