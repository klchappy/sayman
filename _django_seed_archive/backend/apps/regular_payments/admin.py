from django.contrib import admin

from .models import RegularPaymentPeriod, RegularPaymentProfile


@admin.register(RegularPaymentProfile)
class RegularPaymentProfileAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "owner_label", "period_type", "default_amount", "status", "is_active")
    list_filter = ("category", "period_type", "status", "is_active")
    search_fields = ("title", "supplier_name")


@admin.register(RegularPaymentPeriod)
class RegularPaymentPeriodAdmin(admin.ModelAdmin):
    list_display = ("profile", "period_label", "due_date", "amount", "status", "payable")
    list_filter = ("status", "source")
    search_fields = ("profile__title", "period_label")
