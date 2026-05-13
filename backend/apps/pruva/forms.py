from django import forms

from .models import (
    AidatDifferenceDirection, AidatDifferenceStatus,
    PruvaAidatDifference, PruvaSiteDocument, PruvaStatement, PruvaUnit,
    StatementDocumentRole, SiteDocumentType,
)


class UnitForm(forms.ModelForm):
    class Meta:
        model = PruvaUnit
        fields = [
            "code", "block", "unit_no",
            "owner_type", "owner_person", "owner_company",
            "usage_type", "default_due_day", "status",
            "sale_date", "buyer_name", "notes",
        ]
        widgets = {
            "sale_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def clean(self):
        cleaned = super().clean()
        ot = cleaned.get("owner_type")
        if ot == "COMPANY" and not cleaned.get("owner_company"):
            self.add_error("owner_company", "Şirket seçin.")
        if ot == "PERSON" and not cleaned.get("owner_person"):
            self.add_error("owner_person", "Şahıs seçin.")
        day = cleaned.get("default_due_day")
        if day is not None and (day < 1 or day > 31):
            self.add_error("default_due_day", "1-31 arası olmalı.")
        return cleaned


class StatementForm(forms.ModelForm):
    """Manuel ekstre giriş formu."""

    class Meta:
        model = PruvaStatement
        fields = [
            "year", "month", "period_label", "due_date",
            "aidat_amount", "gider_amount", "previous_debt", "penalty", "other",
            "source", "notes",
        ]
        widgets = {
            "due_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def clean_month(self):
        m = self.cleaned_data["month"]
        if m < 1 or m > 12:
            raise forms.ValidationError("Ay 1-12 arası olmalı.")
        return m


class StatementDocumentUploadForm(forms.Form):
    document = forms.ModelChoiceField(queryset=None, label="Belge")
    document_role = forms.ChoiceField(
        choices=StatementDocumentRole.choices,
        initial=StatementDocumentRole.STATEMENT,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from apps.documents.models import Document
        self.fields["document"].queryset = Document.objects.filter(is_active=True).order_by("-created_at")[:200]


class AidatDifferenceForm(forms.ModelForm):
    class Meta:
        model = PruvaAidatDifference
        fields = [
            "unit", "person", "company",
            "period_label", "date", "amount",
            "direction", "status", "document", "notes",
        ]
        widgets = {
            "date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class SiteDocumentForm(forms.ModelForm):
    class Meta:
        model = PruvaSiteDocument
        fields = ["title", "document", "document_type", "year", "period_label", "related_unit", "notes"]
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class MarkSoldForm(forms.Form):
    sale_date = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))
    buyer_name = forms.CharField(max_length=255, required=False)
