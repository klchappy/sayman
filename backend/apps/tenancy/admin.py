from django.contrib import admin

from .models import Domain, Organization, TenantSchema


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "plan", "is_active", "trial_ends_at", "created_at")
    list_filter = ("plan", "is_active")
    search_fields = ("name", "slug", "contact_email")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(TenantSchema)
class TenantSchemaAdmin(admin.ModelAdmin):
    list_display = ("organization", "slug", "name", "sector", "schema_name",
                    "is_active", "created_on")
    list_filter = ("sector", "is_active", "organization")
    search_fields = ("name", "slug", "schema_name", "organization__name")
    readonly_fields = ("schema_name", "created_on", "created_at", "updated_at")
    list_select_related = ("organization",)


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary")
    list_filter = ("is_primary",)
    search_fields = ("domain",)
    list_select_related = ("tenant",)
