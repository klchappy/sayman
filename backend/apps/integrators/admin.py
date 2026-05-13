from django.contrib import admin

from .models import (
    CreditPackage, IntegratorDocument, ServiceContract, SoftwareService,
)


@admin.register(SoftwareService)
class SoftwareServiceAdmin(admin.ModelAdmin):
    list_display = ("provider_name", "title", "provider_type", "service_type",
                    "status", "created_at")
    list_filter = ("provider_type", "service_type", "status")
    search_fields = ("provider_name", "title", "customer_no", "account_no")
    autocomplete_fields = ["owner_company", "owner_person"]


@admin.register(ServiceContract)
class ServiceContractAdmin(admin.ModelAdmin):
    list_display = ("service", "title", "contract_type",
                    "start_date", "end_date", "renewal_date",
                    "amount", "status")
    list_filter = ("contract_type", "status", "currency")
    search_fields = ("title", "service__provider_name", "service__title")
    autocomplete_fields = ["service", "renewed_from", "renewed_to"]


@admin.register(CreditPackage)
class CreditPackageAdmin(admin.ModelAdmin):
    list_display = ("service", "package_name", "purchase_date",
                    "total_credits", "remaining_credits",
                    "critical_threshold", "status")
    list_filter = ("status", "currency")
    search_fields = ("package_name", "service__provider_name", "service__title")
    autocomplete_fields = ["service"]


@admin.register(IntegratorDocument)
class IntegratorDocumentAdmin(admin.ModelAdmin):
    list_display = ("service", "contract", "credit_package",
                    "document_role", "uploaded_by", "created_at")
    list_filter = ("document_role",)
    search_fields = ("service__provider_name", "service__title")
