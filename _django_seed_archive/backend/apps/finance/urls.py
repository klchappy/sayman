from django.urls import path

from . import views

app_name = "finance"

urlpatterns = [
    path("payables/", views.PayableListView.as_view(), name="list"),
    path("payables/new/", views.PayableCreateView.as_view(), name="create"),
    path("payables/<int:pk>/", views.PayableDetailView.as_view(), name="detail"),
    path("payables/<int:pk>/edit/", views.PayableUpdateView.as_view(), name="update"),
    path("payables/<int:pk>/archive/", views.PayableArchiveView.as_view(), name="archive"),
    path("payables/<int:pk>/mark-paid/", views.MarkPaidView.as_view(), name="mark_paid"),
    path("payables/<int:pk>/add-document/", views.PayableAddDocumentView.as_view(), name="add_document"),
    path("payments/<int:pk>/approve/", views.PaymentApproveView.as_view(), name="payment_approve"),
    path("payments/<int:pk>/reject/", views.PaymentRejectView.as_view(), name="payment_reject"),
]
