# FAZ A — MULTI-GROUP + MULTI-TENANT FOUNDATION

**Proje:** Sayman
**Faz:** A (Foundation)
**Tarih:** 2026-05-13
**Durum:** 🚧 IN PROGRESS — Faz A.0 (scaffold) başlıyor
**Bağlayıcılık:** `PROJECT_ANAYASA.md` Madde 1-12 hala geçerli; bu plan Madde 14 ("Diğer Acme projelerinden izolasyon") **değiştirilmiş** halini günceller — proje artık SaaS olduğu için "izolasyon" Group seviyesinde anlaşılır.

---

## 0. Yönetici Özeti

Sayman'ı tek-tenant Django uygulamasından multi-group + multi-tenant SaaS'e çıkartmak. Kullanılan pattern: **schema-per-tenant** (`django-tenants` 3.10.1).

| Madde | Hedef |
|---|---|
| Public schema (Control Plane) | Group, User, UserGroupRole, UserTenantOverride, TenantSchema, Domain, Bank, Institution, Person/Company/Property + share_scope[], AuditLog |
| Tenant schemas (Data Plane) | Fatura, Ödeme, Abonelik, EmlakVergisi, Teminat, Pruva/SiteX, Görev, Chat, Notification, Belge |
| Subdomain routing | `{tenant}.{group}.sayman.deploi.net` (örn. `tekstil.kilic.sayman.deploi.net`) |
| Schema naming | `g{group_id}_{tenant_slug}` (örn. `g1_tekstil`) |

---

## 1. Ön Koşullar (Pre-flight)

| Madde | Durum |
|---|---|
| Django 6.0.4 + Python 3.13 | ✅ mevcut |
| PostgreSQL (django-tenants SQLite desteklemiyor) | ⚠️ lokal kurulum gerekecek (Faz A.4'te) |
| `django-tenants` 3.10.1 PyPI'da | ✅ mevcut (Django 5.2 + 6.0 destekli) |
| Seed paket tek-tenant kodu | ✅ commit'lendi (`c3a7bc9`) |

---

## 2. Veri Modeli (Yeni)

### 2.1 `apps/tenancy/` — yeni Django app

```python
# Group — holding/müşteri (SaaS müşterisi)
class Group(BaseModel):
    name = CharField(max_length=200)           # "Kılıç Holding"
    slug = SlugField(unique=True)              # "kilic"
    plan = CharField(choices=PlanType.choices) # FREE / BASIC / PRO / ENTERPRISE
    is_active = BooleanField(default=True)
    primary_owner = ForeignKey(User)
    created_at = DateTimeField(auto_now_add=True)

# TenantSchema — django-tenants TenantMixin alt sınıfı (her bir sektör)
class TenantSchema(TenantMixin):
    group = ForeignKey(Group, related_name="tenants")
    slug = SlugField()                         # "tekstil", "enerji", ...
    name = CharField(max_length=200)           # "Kılıç Tekstil"
    sector = CharField(choices=Sector.choices) # TEKSTIL, ENERJI, INSAAT, ...
    active_modules = JSONField(default=list)   # ["finance", "subscriptions", ...]
    is_active = BooleanField(default=True)

    # django-tenants alanları (otomatik):
    # schema_name (g{group_id}_{slug} pattern), domain_url, ...

    auto_create_schema = True   # save() çağrıldığında schema otomatik yaratılır
    auto_drop_schema = False    # soft-delete (KVKK; hard-delete Super Admin)

    class Meta:
        unique_together = [("group", "slug")]

# Domain — django-tenants DomainMixin (her tenant için subdomain)
class Domain(DomainMixin):
    pass
    # domain field: "tekstil.kilic.sayman.deploi.net"
    # tenant FK: TenantSchema
    # is_primary: aynı tenant için birden çok domain olabilir
```

### 2.2 Sector enum

```python
class Sector(TextChoices):
    TEKSTIL     = "TEKSTIL",     "Tekstil"
    ENERJI      = "ENERJI",      "Enerji"
    INSAAT      = "INSAAT",      "İnşaat"
    GAYRIMENKUL = "GAYRIMENKUL", "Gayrimenkul"
    KISISEL     = "KISISEL",     "Kişisel / Aile"
    SANAYI      = "SANAYI",      "Sanayi"
    HUKUK       = "HUKUK",       "Hukuk Bürosu"
    DIGER       = "DIGER",       "Diğer"
```

### 2.3 PlanType enum

```python
class PlanType(TextChoices):
    TRIAL      = "TRIAL",      "Deneme (14 gün)"
    BASIC      = "BASIC",      "Temel"
    PRO        = "PRO",        "Pro"
    ENTERPRISE = "ENTERPRISE", "Kurumsal"
```

---

## 3. Settings Yapısı

`config/settings/base.py` şu şekilde reorganize edilir:

```python
SHARED_APPS = (
    "django_tenants",                # MUST be first
    "apps.tenancy",                  # Group, TenantSchema, Domain (MUST be second)
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "apps.accounts",                 # User + roles (Faz B'de UserGroupRole eklenir)
    "apps.audit",                    # AuditLog group-level
    "apps.parties",                  # Person/Company/Property + share_scope (Faz C'de)
    "apps.core",                     # Bank, Institution (group-shared)
    "apps.documents",                # Belge master
)

TENANT_APPS = (
    "django.contrib.contenttypes",   # Django requires this in both
    "apps.finance",
    "apps.subscriptions",
    "apps.regular_payments",
    "apps.official_payments",
    "apps.pruva",
    "apps.properties",
    "apps.guarantees",
    "apps.integrators",
    "apps.imports",
    "apps.notifications",
    "apps.tasks",
    "apps.chat",
    "apps.dashboard",
    "apps.reports",
)

INSTALLED_APPS = list(SHARED_APPS) + [
    app for app in TENANT_APPS if app not in SHARED_APPS
]

TENANT_MODEL = "tenancy.TenantSchema"
TENANT_DOMAIN_MODEL = "tenancy.Domain"

DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        # ...
    }
}

DATABASE_ROUTERS = ("django_tenants.routers.TenantSyncRouter",)

MIDDLEWARE = [
    "django_tenants.middleware.main.TenantMainMiddleware",  # FIRST
    "django.middleware.security.SecurityMiddleware",
    # ... rest as before
]

PUBLIC_SCHEMA_URLCONF = "config.urls_public"
ROOT_URLCONF = "config.urls"  # tenant URLs
```

---

## 4. Yapılacaklar — Adım Adım

### A.0 — Scaffold (bu commit'te)
- [x] requirements.txt'ye `django-tenants>=3.10,<4` ekle
- [ ] `apps/tenancy/` app oluştur (models, admin, apps, migrations)
- [ ] `settings/base.py` reorganize et (SHARED_APPS / TENANT_APPS / DATABASE_ROUTERS)
- [ ] `config/urls_public.py` (Group/Tenant admin için sadece public URL'ler)
- [ ] `apps.tenancy.management.commands.bootstrap_sayman` — ilk Group + 7 tenant seed

### A.1 — Lokal PostgreSQL geçişi
- [ ] `settings/local_pg.py` django-tenants postgresql_backend ile güncelle
- [ ] `settings/local.py` -> SQLite kalır ama "tenancy etkisiz" modu (sadece public migration yapılır, test için)
- [ ] `python manage.py migrate_schemas --shared` ile public migration
- [ ] `python manage.py bootstrap_sayman` ile demo Group ("Kılıç Holding") + 7 tenant

### A.2 — Subdomain routing testi
- [ ] Lokal Windows `hosts` dosyasına `127.0.0.1 tekstil.kilic.localhost` vb. ekle
- [ ] `python manage.py runserver` ile tekstil.kilic.localhost:8200 dene
- [ ] Tenant switcher prototipi: topbar'a "Aktif Tenant" göstergesi

### A.3 — Mevcut tenant-private migration'larını schema-aware yap
- [ ] finance, subscriptions, regular_payments, official_payments, pruva, properties, guarantees, integrators, imports, notifications, tasks, chat, dashboard, reports → tenant schemas'a düşer
- [ ] `python manage.py migrate_schemas` ile tüm tenant schema'ları otomatik kurulur

### A.4 — Smoke test
- [ ] Lokal PostgreSQL'de Kılıç Holding + 7 tenant kurulu
- [ ] `tekstil.kilic.localhost:8200/admin/` → tekstil schema'ya bağlı admin
- [ ] `enerji.kilic.localhost:8200/admin/` → enerji schema'ya bağlı admin
- [ ] İkisi arasında veri sızıntısı yok (test: tekstil'de fatura ekle, enerji'de görünmez)

---

## 5. Risk Kayıt Defteri (Faz A için)

| # | Risk | Etki | Hafifletme |
|---|---|---|---|
| A.R1 | Mevcut SQLite migration'ları schema'lı postgres'e taşırken sorun | Orta | Lokal PG kurulumdan önce migration'lar yeniden generate edilebilir |
| A.R2 | `apps/accounts/User` modeli SHARED_APPS'e taşındı → mevcut FK'lar kırılır | Yüksek | accounts mevcut migration'ları soft-reset; finance/subscriptions vb. tenant FK'ları schema-cross olmaz çünkü User zaten shared |
| A.R3 | Tenant arası ForeignKey yasak — Sahis/Sirket/Mulk shared olduğu için Fatura.kurum FK problemsiz | Düşük | Schema-aware FK için django-tenants resmi pattern: shared model FK |
| A.R4 | Django 6.0 LTS değil (Faz 15 uyarısı) | Orta | django-tenants 3.10.1 6.0'ı destekliyor ama 5.2 LTS'e geri çekme her zaman elimizde |
| A.R5 | Lokal Windows'da subdomain routing zor | Düşük | hosts file + `*.localhost` desteği yeterli |

---

## 6. Çıktılar (Faz A sonu için tanım)

Bu maddeler tamamlanınca Faz A "DONE" sayılır:

1. ✅ `manage.py check` 0 issues
2. ✅ `manage.py migrate_schemas --shared` başarılı
3. ✅ `manage.py bootstrap_sayman` çalışır, 1 Group + 7 tenant + 7 schema yaratır
4. ✅ Subdomain bazlı admin login lokal'de çalışır
5. ✅ İki tenant arasında veri sızıntısı yok (manuel smoke test)
6. ✅ Mevcut 19 Django app yeni TENANT_APPS/SHARED_APPS dağılımında çalışır

---

## 7. Faz A Sonrası

- **Faz B (Hibrit Auth & Permission):** UserGroupRole + UserTenantOverride modelleri, tenant switcher UI, JWT auth
- **Faz C (Group-Shared Master Data):** Person/Company/Property + `share_scope[]` migration; Bank/Institution global
- **Faz D (DRF REST API):** Tüm modeller için viewset/serializer
