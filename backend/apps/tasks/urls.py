"""Faz 10 — Görev URL'leri."""
from django.urls import path

from . import views

app_name = "tasks"

urlpatterns = [
    path("", views.TaskListView.as_view(), name="list"),
    path("today/", views.TaskTodayView.as_view(), name="today"),
    path("upcoming/", views.TaskUpcomingView.as_view(), name="upcoming"),
    path("overdue/", views.TaskOverdueView.as_view(), name="overdue"),
    path("assigned-to-me/", views.TaskAssignedToMeView.as_view(), name="assigned_to_me"),
    path("created-by-me/", views.TaskCreatedByMeView.as_view(), name="created_by_me"),
    path("new/", views.TaskCreateView.as_view(), name="create"),
    path("create-for-object/", views.TaskCreateForObjectView.as_view(),
         name="create_for_object"),
    path("<int:pk>/", views.TaskDetailView.as_view(), name="detail"),
    path("<int:pk>/edit/", views.TaskUpdateView.as_view(), name="edit"),
    path("<int:pk>/start/", views.TaskStartView.as_view(), name="start"),
    path("<int:pk>/postpone/", views.TaskPostponeView.as_view(), name="postpone"),
    path("<int:pk>/complete/", views.TaskCompleteView.as_view(), name="complete"),
    path("<int:pk>/cancel/", views.TaskCancelView.as_view(), name="cancel"),
    path("<int:pk>/reopen/", views.TaskReopenView.as_view(), name="reopen"),
    path("<int:pk>/comment/", views.TaskCommentCreateView.as_view(), name="comment"),
    path("<int:pk>/attach/", views.TaskAttachmentCreateView.as_view(), name="attach"),
]
