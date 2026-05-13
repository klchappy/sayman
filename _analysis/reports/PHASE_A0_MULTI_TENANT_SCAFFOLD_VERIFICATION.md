# FAZ A.0 — MULTI-TENANT SCAFFOLD VERIFICATION

**Proje:** Sayman
**Faz:** A.0 (Foundation scaffold)
**Tarih:** 2026-05-13
**Sonuç:** ✅ **PASS (LOCAL DOCKER)**

---

## 0. Yönetici Özeti

Faz A.0 tamamlandı. django-tenants schema-per-tenant pattern'i Sayman üzerinde çalışır durumda. Lokal Docker ortamında 1 organization + 7 sektör tenant'ı + public control plane kurulmuş; schema izolasyon doğrulanmış; web sunucu hem public hem tenant subdomain'lerinde HTTP 200 dönüyor.

| Madde | Sonuç |
|---|---|
| `manage.py check` | ✅ 0 issues |
| `makemigrations tenancy` | ✅ `0001_initial.py` üretildi (Organization + TenantSchema + Domain) |
| `migrate_schemas --shared` | ✅ public schema'da 21 SHARED tablo |
| `bootstrap_sayman` | ✅ "Kılıç Holding" + 7 sektör tenant + 7 domain |
| Schema yaratımı (auto_create_schema) | ✅ 7 schema PostgreSQL'de mevcut |
| Tenant migration izolasyonu | ✅ g3_tekstil'de 48 TENANT tablo; SHARED tablo yok |
| Public admin endpoint | ✅ `localhost:8200/admin/login/` → HTTP 200 |
| Tenant admin endpoint | ✅ `tekstil.kilic.localhost:8200/admin/login/` → HTTP 200 (subdomain routing çalışıyor) |
| Subdomain DNS resolution | ✅ Windows 10+ otomatik `*.localhost` → 127.0.0.1 (hosts file gerekmedi) |

---

## 1. Kurulum Adımları (Çalıştırılan)

```powershell
# 1. Docker compose
docker compose up -d db
docker compose build web

# 2. Migrations
docker compose run --rm web python manage.py check                    # ✅ 0 issues
docker compose run --rm web python manage.py makemigrations tenancy   # ✅ 0001_initial.py
docker compose run --rm web python manage.py migrate_schemas --shared # ✅

# 3. Bootstrap
docker compose run --rm web python manage.py bootstrap_sayman \
    --org-name "Kılıç Holding" --org-slug kilic \
    --base-domain localhost --ensure-public                            # ✅

# 4. Tenant migrations (otomatik save() ile uygulandı)
docker compose run --rm web python manage.py migrate_schemas          # No migrations to apply

# 5. Superuser
docker compose run --rm web python manage.py shell -c "
from django.contrib.auth.models import User
User.objects.create_superuser('admin', 'admin@sayman.local', 'sayman123')
"

# 6. Web sunucu
docker compose up -d web
```

---

## 2. PostgreSQL Schema Durumu

### Schema listesi

```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'g%' OR schema_name = 'public' ORDER BY schema_name;
```

```
schema_name
---------------
 g3_enerji
 g3_gayrimenkul
 g3_hukuk
 g3_insaat
 g3_kisisel
 g3_sanayi
 g3_tekstil
 public
(8 rows)
```

Naming pattern: `g{organization_id}_{tenant_slug}` ✅

### PUBLIC schema (Control Plane — 21 tablo)

- `auth_user`, `auth_group`, `auth_permission` (+ permissions/groups join tabloları)
- `audit_auditlog`
- `core_systemsetting`
- `documents_document`
- `parties_bank`, `parties_company`, `parties_institution`, `parties_person`, `parties_propertyasset`
- `tenancy_organization`, `tenancy_tenantschema`, `tenancy_domain`
- Django sistem: `django_admin_log`, `django_content_type`, `django_migrations`, `django_session`

### g3_tekstil schema (Tenant — 48 tablo)

Tenant-private domain tabloları:
- `finance_*` (PayableItem, PaymentTransaction, PayableDocument)
- `subscriptions_*`, `regular_payments_*`, `official_payments_*`
- `pruva_*`, `properties_*`, `guarantees_*`, `integrators_*`
- `imports_*`, `notifications_*`, `tasks_*`, `chat_*`, `reports_*`
- Lokal `django_content_type` ve `django_migrations` (her schema kendi history'sini tutar)

Diğer 6 tenant schema'da aynı 48 tablo seti (izolasyon test edilebilir).

---

## 3. Subdomain Routing Smoke Test

| Request | Final URL | HTTP | Schema |
|---|---|---|---|
| `GET /` | 302 → `/admin/` | 302 | public |
| `GET /admin/` | 302 → `/admin/login/` | 302 | public |
| `GET /admin/login/` | `/admin/login/` | 200 | public |
| `GET tekstil.kilic.localhost/admin/` | 302 → `/admin/login/` | 302 | **g3_tekstil** |
| `GET tekstil.kilic.localhost/admin/login/` | `/admin/login/` | 200 | **g3_tekstil** |

django-tenants `TenantMainMiddleware`'i Domain modeli üzerinden `tekstil.kilic.localhost` → `g3_tekstil` schema'ya geçişi otomatik yaptı. ✅

---

## 4. Bilinen Sınırlar ve Sonraki Adımlar

### Faz A.0 kapsamı DIŞINDA bırakılanlar (Faz A.1+)

- Tenant switcher UI (topbar'da aktif tenant göstergesi)
- Login akışı henüz organization seçici içermiyor (admin login standard Django form)
- Hibrit rol modeli (`UserOrganizationRole` + `UserTenantOverride`) — Faz B
- `share_scope[]` paylaşılan master data — Faz C
- DRF REST API — Faz D
- Sektör konfig flag'leri runtime'da kullanılmıyor (TenantSchema.active_modules JSON dolu ama view'lar henüz okumıyor) — Faz E
- SaaS billing/onboarding — Faz F
- Production deploy (Coolify wildcard SSL) — Faz G

### Açık tedbir

- Bootstrap çalışırken her tenant `save()` çağrısı schema'da auto migrate tetikliyor — bu beklenen davranış ama büyük tenant_apps listesinde ilk seed yavaş olur (her tenant için ~28 migration). Production'da tenant create flow ayrı bir job queue ile yapılmalı.
