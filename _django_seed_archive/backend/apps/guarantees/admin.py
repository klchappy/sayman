from django.contrib import admin

from .models import (
    GuaranteeCommissionPeriod, GuaranteeDocument, GuaranteeLetter,
)


@admin.register(GuaranteeLetter)
class GuaranteeLetterAdmin(admin.ModelAdmin):
    list_display = ("letter_no", "title", "bank", "beneficiary_institution",
                    "amount", "currency", "status", "expiry_date")
    list_filter = ("status", "guarantee_type", "commission_period", "currency")
    search_fields = ("letter_no", "title", "purpose", "facility_label")
    autocomplete_fields = ["bank", "beneficiary_institution",
                           "owner_company", "owner_person",
                           "renewed_from", "renewed_to"]


@admin.register(GuaranteeCommissionPeriod)
class GuaranteeCommissionPeriodAdmin(admin.ModelAdmin):
    list_display = ("guarantee", "period_label", "due_date",
                    "commission_amount", "status", "payable")
    list_filter = ("status", "source")
    search_fields = ("guarantee__letter_no", "period_label")
    autocomplete_fields = ["guarantee"]


@admin.register(GuaranteeDocument)
class GuaranteeDocumentAdmin(admin.ModelAdmin):
    list_display = ("guarantee", "commission_period", "document_role",
                    "uploaded_by", "created_at")
    list_filter = ("document_role",)
    search_fields = ("guarantee__letter_no",)
