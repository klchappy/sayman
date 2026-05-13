"""Entegratör/Yazılım Hizmeti & Kontör formları (Faz 9)."""
from django import forms

from .models import (
    CreditPackage, IntegratorDocumentRole, ServiceContract, SoftwareService,
)


class SoftwareServiceForm(forms.ModelForm):
    class Meta:
        model = SoftwareService
        fields = [
            "owner_company", "owner_person",
            "provider_name", "provider_type", "service_type",
            "title", "customer_no", "account_no",
            "status", "notes",
        ]
        widgets = {"notes": forms.Textarea(attrs={"rows": 2})}

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("owner_company") and cleaned.get("owner_person"):
            self.add_error("owner_person",
                           "Hem şirket hem şahıs sahibi seçemezsiniz.")
        if not (cleaned.get("provider_name") or "").strip():
            self.add_error("provider_name", "Sağlayıcı adı zorunlu.")
        return cleaned


class ServiceContractForm(forms.ModelForm):
    class Meta:
        model = ServiceContract
        fields = [
            "contract_type", "title",
            "start_date", "end_date", "renewal_date",
            "amount", "currency",
            "status", "notes",
        ]
        widgets = {
            "start_date": forms.DateInput(attrs={"type": "date"}),
            "end_date": forms.DateInput(attrs={"type": "date"}),
            "renewal_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class ContractRenewForm(forms.ModelForm):
    """Yenileme — yeni sözleşme alanları."""

    class Meta:
        model = ServiceContract
        fields = [
            "contract_type", "title",
            "start_date", "end_date", "renewal_date",
            "amount", "currency", "notes",
        ]
        widgets = {
            "start_date": forms.DateInput(attrs={"type": "date"}),
            "end_date": forms.DateInput(attrs={"type": "date"}),
            "renewal_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class CreditPackageForm(forms.ModelForm):
    class Meta:
        model = CreditPackage
        fields = [
            "package_name", "purchase_date",
            "total_credits", "remaining_credits", "critical_threshold",
            "amount", "currency",
            "status", "notes",
        ]
        widgets = {
            "purchase_date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def clean(self):
        cleaned = super().clean()
        total = cleaned.get("total_credits") or 0
        remaining = cleaned.get("remaining_credits")
        if remaining is None:
            cleaned["remaining_credits"] = total
        elif remaining > total:
            self.add_error("remaining_credits",
                            "Kalan kontör toplamdan büyük olamaz.")
        return cleaned


class CreditUsageUpdateForm(forms.Form):
    remaining_credits = forms.IntegerField(min_value=0, label="Kalan Kontör")
    notes = forms.CharField(required=False, widget=forms.Textarea(attrs={"rows": 2}),
                              label="Not")


class IntegratorDocumentUploadForm(forms.Form):
    document = forms.ModelChoiceField(queryset=None, label="Belge")
    document_role = forms.ChoiceField(
        choices=IntegratorDocumentRole.choices,
        initial=IntegratorDocumentRole.CONTRACT,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from apps.documents.models import Document
        self.fields["document"].queryset = (
            Document.objects.filter(is_active=True).order_by("-created_at")[:200]
        )
