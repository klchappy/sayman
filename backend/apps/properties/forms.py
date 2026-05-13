"""Emlak Vergisi & Mülk Takip — formlar (Faz 7)."""
from django import forms

from apps.parties.models import PropertyAsset

from .models import (
    Municipality, PropertyTaxDocument, PropertyTaxInstallment,
    PropertyTaxYear, TaxDocumentRole,
)


class MunicipalityForm(forms.ModelForm):
    class Meta:
        model = Municipality
        fields = ["name", "province", "district", "website"]


class PropertyAssetForm(forms.ModelForm):
    """W-3 zenginleştirilmiş PropertyAsset formu."""

    class Meta:
        model = PropertyAsset
        fields = [
            "name", "property_type", "owner_type",
            "owner_person", "owner_company",
            "province", "district", "address",
            "parcel_info", "independent_section",
            "status", "sale_date", "buyer_name",
        ]
        widgets = {
            "address": forms.Textarea(attrs={"rows": 2}),
            "sale_date": forms.DateInput(attrs={"type": "date"}),
        }

    def clean(self):
        cleaned = super().clean()
        ot = cleaned.get("owner_type")
        if ot == "COMPANY" and not cleaned.get("owner_company"):
            self.add_error("owner_company", "Şirket seçin.")
        if ot == "PERSON" and not cleaned.get("owner_person"):
            self.add_error("owner_person", "Şahıs seçin.")
        return cleaned


class PropertyTaxYearForm(forms.ModelForm):
    class Meta:
        model = PropertyTaxYear
        fields = [
            "property_asset", "municipality", "tax_year",
            "total_accrual_amount", "status", "source", "notes",
        ]
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def clean_tax_year(self):
        y = self.cleaned_data["tax_year"]
        if y < 2000 or y > 2100:
            raise forms.ValidationError("2000-2100 arası bir yıl giriniz.")
        return y


class PropertyTaxInstallmentForm(forms.ModelForm):
    class Meta:
        model = PropertyTaxInstallment
        fields = [
            "installment_no", "due_date", "amount",
            "status", "payment_date", "notes",
        ]
        widgets = {
            "due_date": forms.DateInput(attrs={"type": "date"}),
            "payment_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class PropertyTaxDocumentUploadForm(forms.Form):
    document = forms.ModelChoiceField(queryset=None, label="Belge")
    document_role = forms.ChoiceField(
        choices=TaxDocumentRole.choices,
        initial=TaxDocumentRole.RECEIPT,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from apps.documents.models import Document
        self.fields["document"].queryset = (
            Document.objects.filter(is_active=True).order_by("-created_at")[:200]
        )


class MarkSoldForm(forms.Form):
    sale_date = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))
    buyer_name = forms.CharField(max_length=255, required=False)
