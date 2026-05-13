from django.urls import path

from . import views

app_name = "parties"

urlpatterns = [
    path("", views.MasterIndexView.as_view(), name="index"),
    path("<slug:slug>/", views.MasterListView.as_view(), name="list"),
    path("<slug:slug>/new/", views.MasterCreateView.as_view(), name="create"),
    path("<slug:slug>/<int:pk>/", views.MasterDetailView.as_view(), name="detail"),
    path("<slug:slug>/<int:pk>/edit/", views.MasterUpdateView.as_view(), name="update"),
    path("<slug:slug>/<int:pk>/archive/", views.MasterArchiveView.as_view(), name="archive"),
]
