from django.apps import AppConfig


class RegularPaymentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.regular_payments"
    label = "regular_payments"
    verbose_name = "Düzenli Ödemeler"
