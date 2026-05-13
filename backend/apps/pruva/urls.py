from django.urls import path

from . import views

app_name = "pruva"

urlpatterns = [
    path("", views.PruvaDashboardView.as_view(), name="dashboard"),

    # Units
    path("units/new/", views.UnitCreateView.as_view(), name="unit_create"),
    path("units/<int:pk>/", views.UnitDetailView.as_view(), name="unit_detail"),
    path("units/<int:pk>/edit/", views.UnitUpdateView.as_view(), name="unit_update"),
    path("units/<int:pk>/archive/", views.UnitArchiveView.as_view(), name="unit_archive"),
    path("units/<int:pk>/mark-sold/", views.UnitMarkSoldView.as_view(), name="unit_mark_sold"),

    # Statements
    path("units/<int:pk>/statements/new/", views.StatementCreateView.as_view(), name="statement_create"),
    path("statements/<int:pk>/", views.StatementDetailView.as_view(), name="statement_detail"),
    path("statements/<int:pk>/edit/", views.StatementUpdateView.as_view(), name="statement_update"),
    path("statements/<int:pk>/cancel/", views.StatementCancelView.as_view(), name="statement_cancel"),
    path("statements/<int:pk>/create-payable/", views.StatementCreatePayableView.as_view(), name="statement_create_payable"),
    path("statements/<int:pk>/documents/upload/", views.StatementDocumentUploadView.as_view(), name="statement_document_upload"),

    # Aidat differences
    path("differences/", views.AidatDifferenceListView.as_view(), name="aidat_difference_list"),
    path("differences/new/", views.AidatDifferenceCreateView.as_view(), name="aidat_difference_create"),
    path("differences/<int:pk>/cancel/", views.AidatDifferenceCancelView.as_view(), name="aidat_difference_cancel"),

    # Site documents
    path("site-documents/", views.SiteDocumentListView.as_view(), name="site_document_list"),
    path("site-documents/new/", views.SiteDocumentCreateView.as_view(), name="site_document_create"),
]
