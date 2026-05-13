"""Entegratör/Yazılım Hizmeti URL'leri (Faz 9)."""
from django.urls import path

from . import views

app_name = "integrators"

urlpatterns = [
    path("", views.ServiceListView.as_view(), name="list"),
    path("new/", views.ServiceCreateView.as_view(), name="create"),

    path("<int:pk>/", views.ServiceDetailView.as_view(), name="detail"),
    path("<int:pk>/edit/", views.ServiceUpdateView.as_view(), name="update"),
    path("<int:pk>/archive/", views.ServiceArchiveView.as_view(), name="archive"),
    path("<int:pk>/restore/", views.ServiceRestoreView.as_view(), name="restore"),
    path("<int:pk>/cancel/", views.ServiceCancelView.as_view(), name="cancel"),

    path("<int:pk>/contracts/new/", views.ContractCreateView.as_view(),
         name="contract_create"),
    path("contracts/<int:pk>/", views.ContractDetailView.as_view(),
         name="contract_detail"),
    path("contracts/<int:pk>/edit/", views.ContractUpdateView.as_view(),
         name="contract_update"),
    path("contracts/<int:pk>/renew/", views.ContractRenewView.as_view(),
         name="contract_renew"),
    path("contracts/<int:pk>/cancel/", views.ContractCancelView.as_view(),
         name="contract_cancel"),
    path("contracts/<int:pk>/create-payable/",
         views.ContractCreatePayableView.as_view(),
         name="contract_create_payable"),

    path("<int:pk>/credits/new/", views.CreditPackageCreateView.as_view(),
         name="credit_create"),
    path("credits/<int:pk>/", views.CreditPackageDetailView.as_view(),
         name="credit_detail"),
    path("credits/<int:pk>/edit/", views.CreditPackageUpdateView.as_view(),
         name="credit_update"),
    path("credits/<int:pk>/usage/", views.CreditUsageUpdateView.as_view(),
         name="credit_usage"),
    path("credits/<int:pk>/cancel/", views.CreditPackageCancelView.as_view(),
         name="credit_cancel"),
    path("credits/<int:pk>/create-payable/",
         views.CreditPackageCreatePayableView.as_view(),
         name="credit_create_payable"),

    path("<int:pk>/add-document/",
         views.IntegratorDocumentUploadView.as_view(),
         name="add_document"),
    path("contracts/<int:contract_pk>/add-document/",
         views.IntegratorDocumentUploadView.as_view(),
         name="contract_add_document"),
    path("credits/<int:credit_pk>/add-document/",
         views.IntegratorDocumentUploadView.as_view(),
         name="credit_add_document"),
]
