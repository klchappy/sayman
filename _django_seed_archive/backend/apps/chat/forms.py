"""Chat formları — Faz 11."""
from django import forms
from django.contrib.auth import get_user_model

from .models import ChatMessage, ChatThread, ChatThreadType

User = get_user_model()


class ChatThreadForm(forms.ModelForm):
    participants = forms.ModelMultipleChoiceField(
        queryset=User.objects.filter(is_active=True),
        required=False,
        widget=forms.SelectMultiple(attrs={"class": "form-control"}),
        label="Katılımcılar",
    )

    class Meta:
        model = ChatThread
        fields = ["title", "thread_type"]
        widgets = {
            "title": forms.TextInput(attrs={"class": "form-control"}),
            "thread_type": forms.Select(attrs={"class": "form-control"}),
        }


class ChatMessageForm(forms.Form):
    body = forms.CharField(
        widget=forms.Textarea(attrs={"class": "form-control", "rows": 2, "placeholder": "Mesaj yazın…"}),
        required=False,
        label="Mesaj",
    )
    reply_to = forms.IntegerField(required=False, widget=forms.HiddenInput())

    def clean(self):
        cd = super().clean()
        if not (cd.get("body") or "").strip():
            raise forms.ValidationError("Mesaj boş olamaz.")
        return cd


class ChatAttachmentForm(forms.Form):
    file = forms.FileField(label="Dosya")
    title = forms.CharField(required=False, max_length=255, label="Başlık")


class ChatParticipantForm(forms.Form):
    user = forms.ModelChoiceField(
        queryset=User.objects.filter(is_active=True),
        widget=forms.Select(attrs={"class": "form-control"}),
        label="Kullanıcı",
    )
