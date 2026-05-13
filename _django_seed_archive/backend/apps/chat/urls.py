from django.urls import path

from . import views

app_name = "chat"

urlpatterns = [
    path("", views.MessageCenterView.as_view(), name="center"),
    path("threads/", views.ThreadListView.as_view(), name="thread_list"),
    path("threads/new/", views.ThreadCreateView.as_view(), name="thread_create"),
    path("threads/create-for-object/", views.ThreadCreateForObjectView.as_view(), name="create_for_object"),
    path("threads/create-for-task/<int:task_id>/", views.ThreadCreateForTaskView.as_view(), name="create_for_task"),
    path("threads/<int:pk>/", views.ThreadDetailView.as_view(), name="thread_detail"),
    path("threads/<int:pk>/send/", views.send_message_view, name="send"),
    path("threads/<int:pk>/attach/", views.attach_view, name="attach"),
    path("threads/<int:pk>/read/", views.mark_read_view, name="mark_read"),
    path("threads/<int:pk>/close/", views.close_view, name="close"),
    path("threads/<int:pk>/archive/", views.archive_view, name="archive"),
    path("messages/<int:pk>/reply/", views.reply_message_view, name="reply"),
    path("messages/<int:pk>/delete/", views.delete_message_view, name="delete_message"),
    path("widget/", views.widget_view, name="widget"),
    path("widget/unread/", views.widget_unread, name="widget_unread"),
    path("widget/threads/", views.widget_threads, name="widget_threads"),
    path("widget/threads/<int:pk>/messages/", views.widget_thread_messages, name="widget_thread_messages"),
]
