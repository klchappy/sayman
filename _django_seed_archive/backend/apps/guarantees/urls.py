"""Teminat Mektupları URL'leri (Faz 8)."""
from django.urls import path

from . import views

app_name = "guarantees"

urlpatterns = [
    path("", views.GuaranteeListView.as_view(), name="list"),
    path("new/", views.GuaranteeCreateView.as_view(), name="create"),

    path("<int:pk>/", views.GuaranteeDetailView.as_view(), name="detail"),
    path("<int:pk>/edit/", views.GuaranteeUpdateView.as_view(), name="update"),
    path("<int:pk>/archive/", views.GuaranteeArchiveView.as_view(), name="archive"),
    path("<int:pk>/restore/", views.GuaranteeRestoreView.as_view(), name="restore"),
    path("<int:pk>/cancel/", views.GuaranteeCancelView.as_view(), name="cancel"),
    path("<int:pk>/return/", views.GuaranteeReturnView.as_view(), name="return"),
    path("<int:pk>/renew/", views.GuaranteeRenewView.as_view(), name="renew"),
    path("<int:pk>/add-document/",
         views.GuaranteeDocumentUploadView.as_view(), name="add_document"),

    path("<int:pk>/periods/new/",
         views.CommissionPeriodCreateView.as_view(), name="period_create"),
    path("<int:pk>/generate-periods/",
         views.GuaranteeGeneratePeriodsView.as_view(), name="generate_periods"),

    path("periods/<int:pk>/",
         views.CommissionPeriodDetailView.as_view(), name="period_detail"),
    path("periods/<int:pk>/edit/",
         views.CommissionPeriodUpdateView.as_view(), name="period_update"),
    path("periods/<int:pk>/cancel/",
         views.CommissionPeriodCancelView.as_view(), name="period_cancel"),
    path("periods/<int:pk>/create-payable/",
         views.CommissionPeriodCreatePayableView.as_view(), name="period_create_payable"),
    path("periods/<int:period_pk>/add-document/",
         views.GuaranteeDocumentUploadView.as_view(), name="period_add_document"),
]
