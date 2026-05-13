from django.urls import path

from . import views

app_name = "imports"

urlpatterns = [
    path("", views.ImportListView.as_view(), name="list"),
    path("new/", views.ImportNewView.as_view(), name="new"),
    path("<uuid:batch_id>/", views.ImportDetailView.as_view(), name="detail"),
    path("<uuid:batch_id>/preview/", views.ImportPreviewView.as_view(), name="preview"),
    path("<uuid:batch_id>/cancel/", views.BatchCancelView.as_view(), name="cancel"),
    path("<uuid:batch_id>/records/<int:pk>/", views.DraftDetailView.as_view(), name="record_detail"),
    path("<uuid:batch_id>/records/<int:pk>/approve/", views.DraftApproveView.as_view(), name="record_approve"),
    path("<uuid:batch_id>/records/<int:pk>/reject/", views.DraftRejectView.as_view(), name="record_reject"),
    path("<uuid:batch_id>/records/<int:pk>/manual/", views.DraftManualReviewView.as_view(), name="record_manual"),
]
