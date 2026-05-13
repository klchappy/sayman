from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    path("", views.ReportCenterView.as_view(), name="center"),
    path("templates/", views.TemplateListView.as_view(), name="template_list"),
    path("templates/new/", views.TemplateCreateView.as_view(), name="template_create"),
    path("templates/<int:pk>/", views.TemplateDetailView.as_view(), name="template_detail"),
    path("templates/<int:pk>/edit/", views.TemplateEditView.as_view(), name="template_edit"),
    path("preview/", views.PreviewView.as_view(), name="preview"),
    path("export/", views.ExportView.as_view(), name="export"),
    path("run/", views.ExportView.as_view(), name="run"),
    path("runs/", views.RunListView.as_view(), name="run_list"),
    path("runs/<int:pk>/", views.RunDetailView.as_view(), name="run_detail"),
    path("runs/<int:pk>/download/", views.run_download, name="run_download"),
    path("runs/<int:pk>/cancel/", views.run_cancel, name="run_cancel"),
]
