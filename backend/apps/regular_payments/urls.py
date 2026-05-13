from django.urls import path

from . import views

app_name = "regular_payments"

urlpatterns = [
    path("", views.ProfileListView.as_view(), name="list"),
    path("new/", views.ProfileCreateView.as_view(), name="create"),
    path("<int:pk>/", views.ProfileDetailView.as_view(), name="detail"),
    path("<int:pk>/edit/", views.ProfileUpdateView.as_view(), name="update"),
    path("<int:pk>/archive/", views.ProfileArchiveView.as_view(), name="archive"),
    path("<int:pk>/periods/new/", views.PeriodCreateView.as_view(), name="period_create"),
    path("<int:pk>/generate-periods/", views.GeneratePeriodsView.as_view(), name="generate_periods"),
    path("periods/<int:pk>/create-payable/", views.PeriodCreatePayableView.as_view(), name="period_create_payable"),
]
