from django.contrib import admin

from .models import (
    PruvaAidatDifference, PruvaSiteDocument, PruvaStatement,
    PruvaStatementDocument, PruvaUnit,
)


@admin.register(PruvaUnit)
class PruvaUnitAdmin(admin.ModelAdmin):
    list_display = ("code", "block", "unit_no", "owner_label", "usage_type", "status", "is_active")
    list_filter = ("status", "owner_type", "usage_type", "is_active")
    search_fields = ("code", "block", "unit_no")


@admin.register(PruvaStatement)
class PruvaStatementAdmin(admin.ModelAdmin):
    list_display = ("unit", "period_label", "year", "month", "due_date", "total_amount", "status", "payable")
    list_filter = ("status", "source", "year")
    search_fields = ("unit__code", "period_label")


@admin.register(PruvaStatementDocument)
class PruvaStatementDocumentAdmin(admin.ModelAdmin):
    list_display = ("statement", "document_role", "document", "uploaded_by", "created_at")
    list_filter = ("document_role",)


@admin.register(PruvaAidatDifference)
class PruvaAidatDifferenceAdmin(admin.ModelAdmin):
    list_display = ("date", "unit", "person", "amount", "direction", "status")
    list_filter = ("direction", "status")


@admin.register(PruvaSiteDocument)
class PruvaSiteDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "document_type", "year", "related_unit", "created_at")
    list_filter = ("document_type", "year")
    search_fields = ("title",)
