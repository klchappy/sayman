from django.contrib import admin

from .models import PayableDocument, PayableItem, PaymentTransaction


@admin.register(PayableItem)
class PayableItemAdmin(admin.ModelAdmin):
    list_display = ("title", "owner_label", "amount", "amount_paid", "due_date",
                    "status", "payment_method", "requires_receipt", "requires_double_approval", "is_active")
    list_filter = ("status", "payment_method", "owner_type", "is_active",
                   "requires_receipt", "requires_double_approval")
    search_fields = ("title", "invoice_number", "supplier_name", "subscription_reference")
    readonly_fields = ("created_at", "updated_at", "approved_at",
                       "requires_receipt", "requires_double_approval")
    date_hierarchy = "due_date"

    def owner_label(self, obj):
        return obj.owner_label
    owner_label.short_description = "Sahip"


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("payable", "amount", "payment_date", "payment_method",
                    "status", "approved_by", "created_at")
    list_filter = ("status", "payment_method")
    search_fields = ("payable__title",)
    date_hierarchy = "payment_date"


@admin.register(PayableDocument)
class PayableDocumentAdmin(admin.ModelAdmin):
    list_display = ("payable", "document", "document_role", "uploaded_by", "created_at")
    list_filter = ("document_role",)
