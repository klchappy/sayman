from django import forms

from .models import ImportBatch, ImportSourceType, ImportTargetModule


class ImportUploadForm(forms.Form):
    title = forms.CharField(
        label="Başlık", max_length=255, required=False,
        widget=forms.TextInput(attrs={"placeholder": "ör. Mayıs 2026 Aboneliklik Import"}),
    )
    source_type = forms.ChoiceField(label="Kaynak Türü", choices=ImportSourceType.choices, initial=ImportSourceType.EXCEL)
    target_module = forms.ChoiceField(label="Hedef Modül", choices=ImportTargetModule.choices, initial=ImportTargetModule.GENERIC)
    historical_data = forms.BooleanField(
        label="Geçmiş yıl verisi (otomatik görev/bildirim üretmesin)",
        required=False, initial=False,
    )
    file = forms.FileField(label="Dosya")

    def clean_file(self):
        f = self.cleaned_data["file"]
        max_bytes = 100 * 1024 * 1024  # default 100 MB; settings'ten gelecek
        from django.conf import settings
        max_bytes = settings.IMPORT_MAX_FILE_SIZE_MB * 1024 * 1024
        if f.size > max_bytes:
            raise forms.ValidationError(f"Dosya boyutu {settings.IMPORT_MAX_FILE_SIZE_MB} MB üzerinde.")
        return f
