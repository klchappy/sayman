from django.urls import path

from . import views

app_name = "subscriptions"

urlpatterns = [
    path("", views.SubscriptionListView.as_view(), name="list"),
    path("new/", views.SubscriptionCreateView.as_view(), name="create"),
    path("<int:pk>/", views.SubscriptionDetailView.as_view(), name="detail"),
    path("<int:pk>/edit/", views.SubscriptionUpdateView.as_view(), name="update"),
    path("<int:pk>/archive/", views.SubscriptionArchiveView.as_view(), name="archive"),
    path("<int:pk>/commitments/new/", views.CommitmentCreateView.as_view(), name="commitment_create"),
    path("<int:pk>/charges/new/", views.PeriodChargeCreateView.as_view(), name="charge_create"),
    path("charges/<int:pk>/create-payable/", views.ChargeCreatePayableView.as_view(), name="charge_create_payable"),
]
