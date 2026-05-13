"""Emlak Vergisi URL'leri (Faz 7)."""
from django.urls import path

from . import views

app_name = "properties"

urlpatterns = [
    # Dashboard
    path("", views.PropertiesDashboardView.as_view(), name="dashboard"),

    # Assets (mülkler)
    path("assets/new/", views.AssetCreateView.as_view(), name="asset_create"),
    path("assets/<int:pk>/", views.AssetDetailView.as_view(), name="asset_detail"),
    path("assets/<int:pk>/edit/", views.AssetUpdateView.as_view(), name="asset_update"),
    path("assets/<int:pk>/mark-sold/", views.AssetMarkSoldView.as_view(), name="asset_mark_sold"),

    # Municipalities
    path("municipalities/", views.MunicipalityListView.as_view(), name="municipality_list"),
    path("municipalities/new/", views.MunicipalityCreateView.as_view(), name="municipality_create"),

    # Tax years
    path("years/new/", views.TaxYearCreateView.as_view(), name="tax_year_create"),
    path("years/<int:pk>/", views.TaxYearDetailView.as_view(), name="tax_year_detail"),
    path("years/<int:pk>/edit/", views.TaxYearUpdateView.as_view(), name="tax_year_update"),
    path("years/<int:pk>/cancel/", views.TaxYearCancelView.as_view(), name="tax_year_cancel"),
    path("years/<int:pk>/generate-installments/",
         views.TaxYearGenerateInstallmentsView.as_view(), name="tax_year_generate_installments"),
    path("years/<int:pk>/installments/new/",
         views.InstallmentCreateView.as_view(), name="installment_create"),
    path("years/<int:year_pk>/documents/upload/",
         views.DocumentUploadView.as_view(), name="year_document_upload"),

    # Installments
    path("installments/<int:pk>/", views.InstallmentDetailView.as_view(), name="installment_detail"),
    path("installments/<int:pk>/edit/", views.InstallmentUpdateView.as_view(), name="installment_update"),
    path("installments/<int:pk>/cancel/", views.InstallmentCancelView.as_view(), name="installment_cancel"),
    path("installments/<int:pk>/create-payable/",
         views.InstallmentCreatePayableView.as_view(), name="installment_create_payable"),
    path("installments/<int:inst_pk>/documents/upload/",
         views.DocumentUploadView.as_view(), name="installment_document_upload"),
]
