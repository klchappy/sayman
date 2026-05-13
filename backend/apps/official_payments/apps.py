from django.apps import AppConfig


class OfficialPaymentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.official_payments"
    label = "official_payments"
    verbose_name = "Resmi Ödemeler"
