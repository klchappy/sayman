from django import forms

from .models import OfficialPaymentPeriod, OfficialPaymentProfile


class OfficialProfileForm(forms.ModelForm):
    class Meta:
        model = OfficialPaymentProfile
        fields = [
            "owner_type", "company", "person",
            "title", "payment_type", "institution", "reference_no",
            "period_type", "default_due_day", "default_amount", "currency",
            "default_payment_method", "default_bank",
            "status", "notes",
        ]
        widgets = {
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


class OfficialPeriodForm(forms.ModelForm):
    class Meta:
        model = OfficialPaymentPeriod
        fields = ["period_label", "installment_no", "due_date", "amount", "source", "notes"]
        widgets = {
            "due_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class GenerateOfficialPeriodsForm(forms.Form):
    year = forms.IntegerField(label="Yıl", initial=2026, min_value=2020, max_value=2030)
