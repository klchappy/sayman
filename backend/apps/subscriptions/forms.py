from django import forms

from .models import Subscription, SubscriptionCommitment, SubscriptionPeriodCharge


class SubscriptionForm(forms.ModelForm):
    class Meta:
        model = Subscription
        fields = [
            "owner_type", "company", "person",
            "title", "service_type", "institution",
            "provider_name", "account_no", "service_no", "phone_no",
            "location_label", "address",
            "default_payment_method", "default_bank",
            "package_name", "expected_monthly_amount", "currency",
            "status", "notes",
        ]
        widgets = {
            "address": forms.Textarea(attrs={"rows": 2}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def clean(self):
        cleaned = super().clean()
        ot = cleaned.get("owner_type")
        if ot == "COMPANY" and not cleaned.get("company"):
            self.add_error("company", "Şirket seçin.")
        if ot == "PERSON" and not cleaned.get("person"):
            self.add_error("person", "Şahıs seçin.")
        return cleaned


class SubscriptionCommitmentForm(forms.ModelForm):
    class Meta:
        model = SubscriptionCommitment
        fields = [
            "start_date", "end_date", "campaign_name",
            "committed_amount", "normal_amount", "cancellation_fee",
            "auto_renew", "notes",
        ]
        widgets = {
            "start_date": forms.DateInput(attrs={"type": "date"}),
            "end_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class SubscriptionPeriodChargeForm(forms.ModelForm):
    class Meta:
        model = SubscriptionPeriodCharge
        fields = ["period_label", "due_date", "amount", "source", "notes"]
        widgets = {
            "due_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }
