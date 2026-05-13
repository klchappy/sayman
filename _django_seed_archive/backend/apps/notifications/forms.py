from django import forms

from .models import (NotificationCategory, NotificationLog,
                     NotificationPreference, NotificationRule)


class NotificationRuleForm(forms.ModelForm):
    class Meta:
        model = NotificationRule
        fields = ["name", "code", "category", "trigger_type", "channel",
                   "days_before", "is_active", "dry_run_only", "severity",
                   "title_template", "message_template"]


class NotificationDryRunForm(forms.Form):
    category = forms.ChoiceField(
        required=False,
        choices=[("", "Tüm kategoriler")] + list(NotificationCategory.choices),
    )
    days = forms.IntegerField(initial=7, min_value=1, max_value=365)


class NotificationLogFilterForm(forms.Form):
    category = forms.ChoiceField(
        required=False,
        choices=[("", "Tümü")] + list(NotificationCategory.choices),
    )
    status = forms.CharField(required=False)


class NotificationPreferenceForm(forms.ModelForm):
    class Meta:
        model = NotificationPreference
        fields = ["category", "dashboard_enabled", "telegram_enabled",
                   "email_enabled", "muted"]


class TelegramTestSimulationForm(forms.Form):
    title = forms.CharField(max_length=200)
    message = forms.CharField(widget=forms.Textarea, required=False)
    target_chat_id = forms.CharField(max_length=64, required=False,
                                       help_text="Yalnız simülasyon — gerçek gönderim yok.")
