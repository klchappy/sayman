from django.contrib import admin

from .models import Subscription, SubscriptionCommitment, SubscriptionPeriodCharge


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("title", "service_type", "owner_label", "account_no", "expected_monthly_amount", "status", "is_active")
    list_filter = ("service_type", "status", "is_active", "owner_type")
    search_fields = ("title", "account_no", "service_no", "phone_no", "provider_name")


@admin.register(SubscriptionCommitment)
class SubscriptionCommitmentAdmin(admin.ModelAdmin):
    list_display = ("subscription", "campaign_name", "start_date", "end_date", "status", "auto_renew")
    list_filter = ("status", "auto_renew")


@admin.register(SubscriptionPeriodCharge)
class SubscriptionPeriodChargeAdmin(admin.ModelAdmin):
    list_display = ("subscription", "period_label", "due_date", "amount", "status", "payable")
    list_filter = ("status",)
    search_fields = ("subscription__title", "period_label")
