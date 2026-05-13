"""
parties.models — Faz 2 minimal master.

Tam sürüm: PHASE1_DATA_MODEL_PLAN.md A.2-A.6.
Faz 2'de minimal alan kümesi; sonraki fazlarda alan eklenir.
"""
from django.db import models

from apps.core.models import BaseModel


class Company(BaseModel):
    """Şirket (Acme Enerji, Acme Tekstil, Beta Tekstil, ...)."""

    name = models.CharField(max_length=255, verbose_name="Ünvan")
    short_name = models.CharField(max_length=64, unique=True, verbose_name="Kısa Kod")
    tax_number = models.CharField(max_length=20, blank=True, default="", db_index=True, verbose_name="Vergi No")

    class Meta:
        verbose_name = "Şirket"
        verbose_name_plural = "Şirketler"
        ordering = ["short_name"]

    def __str__(self):
        return self.name


class Person(BaseModel):
    """Şahıs (Aile bireyleri bireyleri ve ilgili kişiler)."""

    full_name = models.CharField(max_length=255, verbose_name="Ad Soyad")
    short_name = models.CharField(max_length=64, blank=True, default="", verbose_name="Kısa Ad")

    class Meta:
        verbose_name = "Şahıs"
        verbose_name_plural = "Şahıslar"
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class PropertyAsset(BaseModel):
    """
    Mülk / gayrimenkul (SiteX daire, fabrika, ofis, vs.).

    Faz 7 W-3 patch · zenginleştirilmiş lifecycle:
    status (ACTIVE/PASSIVE/SOLD/RENTED/NEEDS_REVIEW), property_type,
    owner_person/company FK, province/district, parcel_info, independent_section.
    """

    OWNER_TYPES = [
        ("COMPANY", "Şirket"),
        ("PERSON", "Şahıs"),
        ("MIXED", "Ortak"),
        ("OTHER", "Diğer"),
    ]
    STATUS_CHOICES = [
        ("ACTIVE", "Aktif"),
        ("PASSIVE", "Pasif"),
        ("SOLD", "Satıldı"),
        ("RENTED", "Kirada"),
        ("NEEDS_REVIEW", "Kontrol Gerekli"),
    ]
    PROPERTY_TYPES = [
        ("APARTMENT", "Daire"),
        ("SHOP", "İşyeri / Dükkân"),
        ("OFFICE", "Ofis"),
        ("LAND", "Arsa / Arazi"),
        ("WAREHOUSE", "Depo"),
        ("FACTORY", "Fabrika"),
        ("HOTEL", "Otel"),
        ("OTHER", "Diğer"),
    ]

    name = models.CharField(max_length=255, verbose_name="İsim")
    property_type = models.CharField(
        max_length=16, choices=PROPERTY_TYPES, default="OTHER",
        db_index=True, verbose_name="Mülk Tipi",
    )
    owner_type = models.CharField(
        max_length=16, choices=OWNER_TYPES, default="PERSON",
        verbose_name="Sahip Tipi",
    )
    owner_person = models.ForeignKey(
        "parties.Person", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="owned_properties",
        verbose_name="Malik (Şahıs)",
    )
    owner_company = models.ForeignKey(
        "parties.Company", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="owned_properties",
        verbose_name="Malik (Şirket)",
    )

    province = models.CharField(max_length=64, blank=True, default="", verbose_name="İl")
    district = models.CharField(max_length=64, blank=True, default="", verbose_name="İlçe")
    address = models.TextField(blank=True, default="", verbose_name="Adres")
    parcel_info = models.CharField(
        max_length=128, blank=True, default="",
        verbose_name="Ada/Parsel", help_text="Örn. 1234/56",
    )
    independent_section = models.CharField(
        max_length=64, blank=True, default="",
        verbose_name="Bağımsız Bölüm",
    )

    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default="ACTIVE",
        db_index=True, verbose_name="Durum",
    )
    sale_date = models.DateField(null=True, blank=True, verbose_name="Satış Tarihi")
    buyer_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Alıcı")

    class Meta:
        verbose_name = "Mülk"
        verbose_name_plural = "Mülkler"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def owner_label(self) -> str:
        if self.owner_type == "COMPANY" and self.owner_company:
            return self.owner_company.name
        if self.owner_type == "PERSON" and self.owner_person:
            return self.owner_person.full_name
        return self.get_owner_type_display()


class Bank(BaseModel):
    """Banka master (Albaraka, Garanti, Yapı Kredi, ...)."""

    name = models.CharField(max_length=128, unique=True, verbose_name="Banka Adı")

    class Meta:
        verbose_name = "Banka"
        verbose_name_plural = "Bankalar"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Institution(BaseModel):
    """Kurum / hizmet sağlayıcı (TTNET, CK Boğaziçi, Belediye, vb.)."""

    INSTITUTION_TYPES = [
        ("TELEKOM", "Telekom"),
        ("ELEKTRIK", "Elektrik"),
        ("DOGALGAZ", "Doğalgaz"),
        ("SU", "Su"),
        ("BELEDIYE", "Belediye"),
        ("ENTEGRATOR", "Entegratör"),
        ("SGK", "SGK / BAĞKUR"),
        ("ITO", "İTO"),
        ("DIGER", "Diğer"),
    ]
    name = models.CharField(max_length=128, verbose_name="Kurum Adı")
    institution_type = models.CharField(
        max_length=16, choices=INSTITUTION_TYPES, default="DIGER", verbose_name="Tip"
    )

    class Meta:
        verbose_name = "Kurum"
        verbose_name_plural = "Kurumlar"
        ordering = ["name"]

    def __str__(self):
        return self.name
