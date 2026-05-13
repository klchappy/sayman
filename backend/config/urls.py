"""Muhasebe URL Configuration."""
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path
from django.views.generic import RedirectView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", RedirectView.as_view(pattern_name="dashboard:home", permanent=False)),
    path("accounts/", include(("apps.accounts.urls", "accounts"), namespace="accounts")),
    path("dashboard/", include(("apps.dashboard.urls", "dashboard"), namespace="dashboard")),
    path("master/", include(("apps.parties.urls", "parties"), namespace="parties")),
    path("documents/", include(("apps.documents.urls", "documents"), namespace="documents")),
    path("imports/", include(("apps.imports.urls", "imports"), namespace="imports")),
    path("finance/", include(("apps.finance.urls", "finance"), namespace="finance")),
    path("subscriptions/", include(("apps.subscriptions.urls", "subscriptions"), namespace="subscriptions")),
    path("regular-payments/", include(("apps.regular_payments.urls", "regular_payments"), namespace="regular_payments")),
    path("official-payments/", include(("apps.official_payments.urls", "official_payments"), namespace="official_payments")),
    path("pruva/", include(("apps.pruva.urls", "pruva"), namespace="pruva")),
    path("properties/", include(("apps.properties.urls", "properties"), namespace="properties")),
    path("guarantees/", include(("apps.guarantees.urls", "guarantees"), namespace="guarantees")),
    path("integrators/", include(("apps.integrators.urls", "integrators"), namespace="integrators")),
    path("audit/", include(("apps.audit.urls", "audit"), namespace="audit")),
    path("notifications/", include(("apps.notifications.urls", "notifications"), namespace="notifications")),
    path("tasks/", include(("apps.tasks.urls", "tasks"), namespace="tasks")),
    path("chat/", include(("apps.chat.urls", "chat"), namespace="chat")),
    path("reports/", include(("apps.reports.urls", "reports"), namespace="reports")),
]
