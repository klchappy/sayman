"""Teminat Mektupları formları (Faz 8)."""
from django import forms

from .models import (
    CommissionPeriodKind, GuaranteeCommissionPeriod, GuaranteeDocumentRole,
    GuaranteeLetter, GuaranteeType,
)


class GuaranteeLetterForm(forms.ModelForm):
    class Meta:
        model = GuaranteeLetter
        fields = [
            "owner_company", "owner_person", "bank", "beneficiary_institution",
            "letter_no", "title", "guarantee_type", "purpose", "facility_label",
            "issue_date", "expiry_date",
            "amount", "currency",
            "commission_rate", "commission_period",
            "status", "notes",
        ]
        widgets = {
            "issue_date": forms.DateInput(attrs={"type": "date"}),
            "expiry_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def clean_letter_no(self):
        ln = (self.cleaned_data.get("letter_no") or "").strip()
        if not ln:
            raise forms.ValidationError("Mektup no zorunlu.")
        return ln

    def clean(self):
        cleaned = super().clean()
        if (cleaned.get("amount") or 0) <= 0:
            self.add_error("amount", "Tutar 0'dan büyük olmalı.")
        if cleaned.get("owner_company") and cleaned.get("owner_person"):
            self.add_error("owner_person",
                           "Hem şirket hem şahıs sahibi seçemezsiniz.")
        return cleaned


class GuaranteeCommissionPeriodForm(forms.ModelForm):
    class Meta:
        model = GuaranteeCommissionPeriod
        fields = [
            "period_label", "due_date", "commission_amount",
            "status", "source", "notes",
        ]
        widgets = {
            "due_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class GuaranteeDocumentUploadForm(forms.Form):
    document = forms.ModelChoiceField(queryset=None, label="Belge")
    document_role = forms.ChoiceField(
        choices=GuaranteeDocumentRole.choices,
        initial=GuaranteeDocumentRole.GUARANTEE_LETTER,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from apps.documents.models import Document
        self.fields["document"].queryset = (
            Document.objects.filter(is_active=True).order_by("-created_at")[:200]
        )


class GuaranteeReturnForm(forms.Form):
    returned_at = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))
    notes = forms.CharField(required=False, widget=forms.Textarea(attrs={"rows": 2}))


class GuaranteeRenewForm(forms.ModelForm):
    """Yenileme — yeni mektup için temel alanlar."""

    class Meta:
        model = GuaranteeLetter
        fields = [
            "owner_company", "owner_person", "bank", "beneficiary_institution",
            "letter_no", "title", "guarantee_type", "purpose", "facility_label",
            "issue_date", "expiry_date",
            "amount", "currency",
            "commission_rate", "commission_period", "notes",
        ]
        widgets = {
            "issue_date": forms.DateInput(attrs={"type": "date"}),
            "expiry_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def clean_letter_no(self):
        ln = (self.cleaned_data.get("letter_no") or "").strip()
        if not ln:
            raise forms.ValidationError("Yeni mektup no zorunlu.")
        return ln
