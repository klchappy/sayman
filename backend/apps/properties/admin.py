from django.contrib import admin

from .models import (
    Municipality, PropertyTaxDocument, PropertyTaxInstallment, PropertyTaxYear,
)


@admin.register(Municipality)
class MunicipalityAdmin(admin.ModelAdmin):
    list_display = ("name", "province", "district", "is_active")
    list_filter = ("province", "is_active")
    search_fields = ("name", "province", "district")


@admin.register(PropertyTaxYear)
class PropertyTaxYearAdmin(admin.ModelAdmin):
    list_display = ("property_asset", "tax_year", "municipality",
                    "total_accrual_amount", "total_paid_amount",
                    "remaining_amount", "status")
    list_filter = ("tax_year", "status", "source")
    search_fields = ("property_asset__name", "municipality__name")
    autocomplete_fields = ["property_asset", "municipality"]


@admin.register(PropertyTaxInstallment)
class PropertyTaxInstallmentAdmin(admin.ModelAdmin):
    list_display = ("tax_year", "installment_no", "due_date", "amount",
                    "status", "payable", "payment_date")
    list_filter = ("status", "installment_no")
    search_fields = ("tax_year__property_asset__name",)


@admin.register(PropertyTaxDocument)
class PropertyTaxDocumentAdmin(admin.ModelAdmin):
    list_display = ("tax_year", "installment", "document_role", "document",
                    "uploaded_by", "created_at")
    list_filter = ("document_role",)
