"""
PUBLIC schema URL Configuration — Sayman Faz A.

django-tenants `PUBLIC_SCHEMA_URLCONF` ile bu modül, root domain'e
(`sayman.deploi.net` / `localhost`) gelen istekler için kullanılır.

Burada SADECE control plane (sistem yönetimi) URL'leri olur:
  - /admin/         → Django admin (Organization, TenantSchema, Domain yönetimi)
  - /accounts/      → kullanıcı giriş (Faz B'de organization seçici eklenir)
  - /              → landing/marketing sayfası (Faz F'de eklenecek)

Tenant-private URL'ler `config.urls` modülünde tanımlıdır ve subdomain'e
göre çağrılır.
"""
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include(("apps.accounts.urls", "accounts"), namespace="accounts")),

    # Landing — Faz F'de SaaS marketing/onboarding sayfasıyla değişir
    path("", RedirectView.as_view(url="/admin/", permanent=False)),
]
