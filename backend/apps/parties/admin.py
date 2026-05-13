from django.contrib import admin

from .models import Bank, Company, Institution, Person, PropertyAsset


class BaseAdmin(admin.ModelAdmin):
    list_display = ("__str__", "is_active", "created_at", "updated_at")
    list_filter = ("is_active",)
    readonly_fields = ("created_at", "updated_at", "archived_at", "archived_by")


@admin.register(Company)
class CompanyAdmin(BaseAdmin):
    list_display = ("name", "short_name", "tax_number", "is_active", "created_at")
    search_fields = ("name", "short_name", "tax_number")


@admin.register(Person)
class PersonAdmin(BaseAdmin):
    list_display = ("full_name", "short_name", "is_active")
    search_fields = ("full_name", "short_name")


@admin.register(PropertyAsset)
class PropertyAssetAdmin(BaseAdmin):
    list_display = ("name", "owner_type", "is_active")
    list_filter = ("owner_type", "is_active")
    search_fields = ("name",)


@admin.register(Bank)
class BankAdmin(BaseAdmin):
    list_display = ("name", "is_active")
    search_fields = ("name",)


@admin.register(Institution)
class InstitutionAdmin(BaseAdmin):
    list_display = ("name", "institution_type", "is_active")
    list_filter = ("institution_type", "is_active")
    search_fields = ("name",)
