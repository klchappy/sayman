from django import forms

from .models import RegularPaymentPeriod, RegularPaymentProfile


class RegularProfileForm(forms.ModelForm):
    class Meta:
        model = RegularPaymentProfile
        fields = [
            "owner_type", "company", "person",
            "title", "category", "supplier_name", "institution",
            "period_type", "default_due_day", "default_amount", "currency",
            "default_payment_method", "default_bank",
            "start_date", "end_date", "status", "notes",
        ]
        widgets = {
            "start_date": forms.DateInput(attrs={"type": "date"}),
            "end_date": forms.DateInput(attrs={"type": "date"}),
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


class RegularPeriodForm(forms.ModelForm):
    class Meta:
        model = RegularPaymentPeriod
        fields = ["period_label", "due_date", "amount", "source", "notes"]
        widgets = {
            "due_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class GeneratePeriodsForm(forms.Form):
    months = forms.IntegerField(label="Üretilecek Ay Sayısı", min_value=1, max_value=24, initial=12)
