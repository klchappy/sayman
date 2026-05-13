from decimal import Decimal

from django import forms

from apps.documents.models import Document, DocumentSource, DocumentType

from .models import (
    DocumentRole,
    OwnerType,
    PayableItem,
    PaymentMethod,
    PaymentTransaction,
)


class PayableItemForm(forms.ModelForm):
    class Meta:
        model = PayableItem
        fields = [
            "owner_type", "company", "person",
            "title", "category",
            "institution", "supplier_name", "invoice_number", "subscription_reference", "period_label",
            "issue_date", "due_date",
            "currency", "amount",
            "payment_method", "bank",
            "notes",
        ]
        widgets = {
            "issue_date": forms.DateInput(attrs={"type": "date"}),
            "due_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 3}),
        }

    def clean(self):
        cleaned = super().clean()
        owner_type = cleaned.get("owner_type")
        company = cleaned.get("company")
        person = cleaned.get("person")
        if owner_type == OwnerType.COMPANY and not company:
            self.add_error("company", "Şirket sahibi için Şirket seçin.")
        if owner_type == OwnerType.PERSON and not person:
            self.add_error("person", "Şahıs sahibi için Şahıs seçin.")
        amount = cleaned.get("amount")
        if amount is not None and amount <= 0:
            self.add_error("amount", "Tutar 0'dan büyük olmalı.")
        return cleaned


class MarkPaidForm(forms.Form):
    payment_date = forms.DateField(label="Ödeme Tarihi", widget=forms.DateInput(attrs={"type": "date"}))
    amount = forms.DecimalField(label="Ödenen Tutar", max_digits=14, decimal_places=2)
    payment_method = forms.ChoiceField(label="Yöntem", choices=PaymentMethod.choices, initial=PaymentMethod.EFT)
    bank = forms.ModelChoiceField(label="Banka", queryset=None, required=False)
    receipt_file = forms.FileField(label="Dekont (PDF/JPG/PNG)", required=False)
    note = forms.CharField(label="Not", required=False, widget=forms.Textarea(attrs={"rows": 2}))

    def __init__(self, *args, payable=None, **kwargs):
        super().__init__(*args, **kwargs)
        from apps.parties.models import Bank
        self.fields["bank"].queryset = Bank.objects.filter(is_active=True)
        self.payable = payable
        # Default: kalan tutar
        if payable is not None:
            self.fields["amount"].initial = payable.remaining_amount

    def clean_amount(self):
        amount = self.cleaned_data["amount"]
        if amount <= 0:
            raise forms.ValidationError("Tutar 0'dan büyük olmalı.")
        if self.payable is not None:
            if amount > self.payable.remaining_amount:
                raise forms.ValidationError(
                    f"Kalan tutarı ({self.payable.remaining_amount}) aşamaz."
                )
        return amount


class PayableDocumentUploadForm(forms.Form):
    file = forms.FileField(label="Dosya")
    document_role = forms.ChoiceField(label="Rol", choices=DocumentRole.choices, initial=DocumentRole.INVOICE)
    title = forms.CharField(label="Başlık", required=False, max_length=255)


class PaymentRejectForm(forms.Form):
    reason = forms.CharField(label="Sebep", widget=forms.Textarea(attrs={"rows": 2}))
