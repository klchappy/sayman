"""
Sayman Faz A — Tenancy modelleri.

3 katman:
  • Organization  → SaaS müşterisi (holding/firma). PUBLIC schema'da.
  • TenantSchema  → Bir organization altındaki sektör (tekstil/enerji/...).
                    django-tenants TenantMixin alt sınıfı; her kayıt için
                    otomatik Postgres schema yaratılır.
  • Domain        → Tenant'a bağlı subdomain. django-tenants DomainMixin
                    alt sınıfı.

Schema isimlendirme: `g{organization_id}_{tenant_slug}`  (örn. g1_tekstil)
"""
from django.conf import settings
from django.db import models
from django_tenants.models import DomainMixin, TenantMixin

from apps.core.models import BaseModel


# --- Enums ------------------------------------------------------------------

class PlanType(models.TextChoices):
    TRIAL      = "TRIAL",      "Deneme (14 gün)"
    BASIC      = "BASIC",      "Temel"
    PRO        = "PRO",        "Pro"
    ENTERPRISE = "ENTERPRISE", "Kurumsal"


class Sector(models.TextChoices):
    TEKSTIL     = "TEKSTIL",     "Tekstil"
    ENERJI      = "ENERJI",      "Enerji"
    INSAAT      = "INSAAT",      "İnşaat"
    GAYRIMENKUL = "GAYRIMENKUL", "Gayrimenkul"
    KISISEL     = "KISISEL",     "Kişisel / Aile"
    SANAYI      = "SANAYI",      "Sanayi"
    HUKUK       = "HUKUK",       "Hukuk Bürosu"
    DIGER       = "DIGER",       "Diğer"


# Sektör başına default açık modül seti.
# `TenantSchema.active_modules` boş ise bu kullanılır.
SECTOR_DEFAULT_MODULES: dict[str, list[str]] = {
    Sector.TEKSTIL:     ["finance", "parties", "subscriptions", "regular_payments",
                         "official_payments", "imports", "notifications", "tasks",
                         "chat", "dashboard", "reports"],
    Sector.ENERJI:      ["finance", "parties", "subscriptions", "integrators",
                         "official_payments", "imports", "notifications", "tasks",
                         "chat", "dashboard", "reports"],
    Sector.INSAAT:      ["finance", "parties", "guarantees", "properties",
                         "regular_payments", "official_payments", "imports",
                         "notifications", "tasks", "chat", "dashboard", "reports"],
    Sector.GAYRIMENKUL: ["finance", "parties", "properties", "pruva",
                         "subscriptions", "regular_payments", "imports",
                         "notifications", "tasks", "chat", "dashboard", "reports"],
    Sector.KISISEL:     ["finance", "parties", "subscriptions", "regular_payments",
                         "properties", "official_payments", "imports",
                         "notifications", "tasks", "dashboard", "reports"],
    Sector.SANAYI:      ["finance", "parties", "subscriptions", "integrators",
                         "official_payments", "imports", "notifications", "tasks",
                         "chat", "dashboard", "reports"],
    Sector.HUKUK:       ["finance", "parties", "regular_payments",
                         "official_payments", "imports", "notifications", "tasks",
                         "dashboard", "reports"],
    Sector.DIGER:       ["finance", "parties", "subscriptions", "regular_payments",
                         "official_payments", "imports", "notifications", "tasks",
                         "chat", "dashboard", "reports"],
}


# --- Models -----------------------------------------------------------------

class Organization(BaseModel):
    """
    SaaS müşterisi — bir holding/firma/aile. PUBLIC schema'da yaşar.

    Altında birden çok TenantSchema (sektör) olur. Kullanıcılar Organization'a
    bağlanır; rol UserOrganizationRole'da (Faz B), tenant-bazlı istisna
    UserTenantOverride'da tutulur.
    """

    name = models.CharField(max_length=200, verbose_name="Ad")
    slug = models.SlugField(max_length=64, unique=True, verbose_name="Slug")
    plan = models.CharField(
        max_length=16, choices=PlanType.choices, default=PlanType.TRIAL,
        verbose_name="Abonelik Planı",
    )
    primary_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="owned_organizations",
        verbose_name="Birincil Sahip",
    )
    contact_email = models.EmailField(blank=True, default="", verbose_name="İletişim E-postası")
    trial_ends_at = models.DateField(null=True, blank=True, verbose_name="Deneme Bitiş")

    class Meta:
        verbose_name = "Organizasyon / Holding"
        verbose_name_plural = "Organizasyonlar"
        ordering = ["name"]

    def __str__(self):
        return self.name


class TenantSchema(TenantMixin, BaseModel):
    """
    Bir Organization altındaki tek bir sektör (tekstil/enerji/inşaat/...).

    django-tenants TenantMixin alt sınıfı: her kayıt için otomatik Postgres
    schema yaratılır. Naming: `g{organization_id}_{slug}` (örn. g1_tekstil).

    Soft-delete: is_active=False yapılınca schema KAPATILMAZ (KVKK; veri
    kaybolmaz). Hard-delete sadece Super Admin tarafından AuditLog ile yapılır.
    """

    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT,
        related_name="tenants", verbose_name="Organizasyon",
    )
    slug = models.SlugField(max_length=64, verbose_name="Slug")
    name = models.CharField(max_length=200, verbose_name="Ad")
    sector = models.CharField(
        max_length=20, choices=Sector.choices, default=Sector.DIGER,
        verbose_name="Sektör",
    )
    active_modules = models.JSONField(
        default=list, blank=True,
        verbose_name="Aktif Modüller",
        help_text="Boş ise SECTOR_DEFAULT_MODULES tablosundan sektör default'u kullanılır",
    )

    # django-tenants davranış flag'leri
    auto_create_schema = True
    auto_drop_schema = False  # Anayasa Madde 3.8 — fiziksel silme yasak

    class Meta:
        verbose_name = "Tenant (Sektör)"
        verbose_name_plural = "Tenant'lar (Sektörler)"
        unique_together = [("organization", "slug")]
        ordering = ["organization__name", "slug"]

    def __str__(self):
        return f"{self.organization.slug}.{self.slug} ({self.get_sector_display()})"

    def save(self, *args, **kwargs):
        # schema_name'i organization+slug'tan üret (yalnız ilk kayıtta)
        if not self.schema_name and self.organization_id and self.slug:
            self.schema_name = f"g{self.organization_id}_{self.slug}"
        super().save(*args, **kwargs)

    def effective_modules(self) -> list[str]:
        """active_modules boşsa sektör default'unu döner."""
        if self.active_modules:
            return list(self.active_modules)
        return list(SECTOR_DEFAULT_MODULES.get(self.sector, []))


class Domain(DomainMixin):
    """
    Bir TenantSchema'ya bağlı subdomain.

    django-tenants DomainMixin: `domain` field (FQDN), `tenant` FK,
    `is_primary` flag.

    Beklenen format: `{tenant_slug}.{organization_slug}.sayman.deploi.net`
    örn: `tekstil.kilic.sayman.deploi.net`

    Lokal dev için: `{tenant_slug}.{organization_slug}.localhost`
    """

    class Meta:
        verbose_name = "Domain"
        verbose_name_plural = "Domain'ler"
