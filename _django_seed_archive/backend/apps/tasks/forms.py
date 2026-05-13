"""Faz 10 — Görev formları."""
from django import forms
from django.contrib.auth import get_user_model

from .models import Task, TaskComment, TaskPriority, TaskStatus

User = get_user_model()


class TaskForm(forms.ModelForm):
    """Yeni görev / düzenleme formu."""

    class Meta:
        model = Task
        fields = [
            "title", "description", "assigned_to", "priority",
            "due_date", "due_time",
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 3}),
            "due_date": forms.DateInput(attrs={"type": "date"}),
            "due_time": forms.TimeInput(attrs={"type": "time"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["assigned_to"].queryset = User.objects.filter(is_active=True).order_by("username")
        self.fields["assigned_to"].required = False
        self.fields["due_date"].required = False
        self.fields["due_time"].required = False
        self.fields["description"].required = False


class TaskStatusForm(forms.Form):
    """Manuel durum değişimi (start, change_status)."""
    status = forms.ChoiceField(choices=TaskStatus.choices)


class TaskPostponeForm(forms.Form):
    postponed_until = forms.DateField(
        widget=forms.DateInput(attrs={"type": "date"}),
        label="Yeni Tarih",
    )
    reason = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 2}),
        label="Sebep (opsiyonel)",
    )


class TaskCommentForm(forms.ModelForm):
    class Meta:
        model = TaskComment
        fields = ["body"]
        widgets = {"body": forms.Textarea(attrs={"rows": 2, "placeholder": "Yorum yaz…"})}


class TaskAttachmentForm(forms.Form):
    file = forms.FileField(label="Dosya")
    title = forms.CharField(required=False, max_length=255, label="Başlık (opsiyonel)")
