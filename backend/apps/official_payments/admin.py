from django.contrib import admin

from .models import OfficialPaymentPeriod, OfficialPaymentProfile


@admin.register(OfficialPaymentProfile)
class OfficialPaymentProfileAdmin(admin.ModelAdmin):
    list_display = ("title", "payment_type", "owner_label", "period_type", "default_amount", "status", "is_active")
    list_filter = ("payment_type", "period_type", "status", "is_active")
    search_fields = ("title", "reference_no")


@admin.register(OfficialPaymentPeriod)
class OfficialPaymentPeriodAdmin(admin.ModelAdmin):
    list_display = ("profile", "period_label", "installment_no", "due_date", "amount", "status", "payable")
    list_filter = ("status", "source")
    search_fields = ("profile__title", "period_label")
