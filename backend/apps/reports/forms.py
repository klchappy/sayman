from django import forms

from .models import ReportFormat, ReportTemplate, ReportType


class ReportTemplateForm(forms.ModelForm):
    class Meta:
        model = ReportTemplate
        fields = ["name", "slug", "report_type", "description", "default_format"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control"}),
            "slug": forms.TextInput(attrs={"class": "form-control"}),
            "report_type": forms.Select(attrs={"class": "form-control"}),
            "description": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
            "default_format": forms.Select(attrs={"class": "form-control"}),
        }


class ReportRunForm(forms.Form):
    report_type = forms.ChoiceField(choices=ReportType.choices, widget=forms.Select(attrs={"class": "form-control"}))
    fmt = forms.ChoiceField(choices=ReportFormat.choices, initial=ReportFormat.XLSX,
                            widget=forms.Select(attrs={"class": "form-control"}), label="Format")
    mode = forms.CharField(required=False, widget=forms.TextInput(attrs={"class": "form-control"}),
                           help_text="overdue / upcoming / missing_receipt / pending_approval")
    days = forms.IntegerField(required=False, min_value=1, initial=7,
                              widget=forms.NumberInput(attrs={"class": "form-control"}))
