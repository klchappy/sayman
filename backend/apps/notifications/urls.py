from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.NotificationDashboardView.as_view(), name="dashboard"),
    path("legacy/", views.NotificationListView.as_view(), name="list"),

    path("rules/", views.RuleListView.as_view(), name="rule_list"),
    path("rules/new/", views.RuleCreateView.as_view(), name="rule_create"),
    path("rules/<int:pk>/", views.RuleDetailView.as_view(), name="rule_detail"),
    path("rules/<int:pk>/edit/", views.RuleEditView.as_view(), name="rule_edit"),

    path("logs/", views.LogListView.as_view(), name="log_list"),
    path("logs/<int:pk>/", views.LogDetailView.as_view(), name="log_detail"),
    path("logs/<int:pk>/suppress/", views.log_suppress, name="log_suppress"),
    path("logs/<int:pk>/cancel/", views.log_cancel, name="log_cancel"),
    path("logs/<int:pk>/ready/", views.log_ready, name="log_ready"),

    path("dry-run/", views.DryRunView.as_view(), name="dry_run"),
    path("dry-run/run/", views.DryRunView.as_view(), name="dry_run_run"),

    path("telegram-test/", views.TelegramTestView.as_view(), name="telegram_test"),

    path("preferences/", views.PreferencesView.as_view(), name="preferences"),
]
