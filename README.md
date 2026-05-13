# SAYMAN — Multi-Tenant Muhasebe Operasyon Platformu

> **Sayman** (eski Türkçe: muhasebeci, kasiyer), birden fazla holding/grubun ve her grup içinde birden fazla sektörün (tekstil, enerji, inşaat, gayrimenkul, kişisel, sanayi, hukuk, …) muhasebe ve finans operasyonlarını **tek çatı altında** yürüten multi-tenant SaaS platformudur.

Bu repo, anonimleştirilmiş `muhasebe-operasyon-seed` paketinden 2026-05-13 tarihinde türetildi (17 faz Django kodu + 60 doküman). Faz A → H roadmap'i ile multi-group + schema-per-tenant SaaS'e dönüştürülüyor.

## Mimari Özeti

```
SYSTEM
├── PUBLIC SCHEMA (Control Plane — sistem geneli)
│   ├── Group ────────── holding/müşteri (Kılıç Holding, Yılmaz Holding, …)
│   ├── User ─────────── tek hesap, birden fazla Group'a bağlanabilir
│   ├── UserGroupRole ─── group-default rol (örn. Muhasebeci@Kılıç)
│   ├── UserTenantOverride── tenant-bazlı istisna (Hukuk'a girmesin)
│   ├── TenantRegistry ── Group altındaki sektör listesi + config
│   ├── Subscription ──── billing/abonelik (Iyzico)
│   ├── Bank, Institution ── her zaman group-shared
│   ├── Person, Company, Property + share_scope[]── opsiyonel paylaşım
│   └── AuditLog ──────── group-level
│
└── TENANT SCHEMAS (Data Plane — schema-per-tenant, naming: g{group_id}_{tenant_slug})
    ├── g1_tekstil       ─→ Fatura, Ödeme, Abonelik
    ├── g1_enerji
    ├── g1_insaat
    ├── g1_gayrimenkul   ─→ EmlakVergisi, SiteX, Kira
    ├── g1_kisisel
    ├── g1_sanayi
    ├── g1_hukuk
    └── g2_tekstil       ─→ ikinci müşteri olduğunda
```

## Yapı

```
backend/        Django 6 / Python 3.12+
  apps/
    tenancy/      [YENİ — Faz A] Group + TenantRegistry + TenantMiddleware
    accounts/     User + UserGroupRole + UserTenantOverride
    parties/      Sahis/Sirket/Mulk + share_scope[] (Group-shared)
    finance/      Fatura/Odeme (Tenant-private)
    ... (orijinal 19 app)
  config/       Settings (base/local/local_pg/production)
  templates/    Django template'ler
  static/       CSS/JS varlıkları
  tests/        pytest-django
preview/        Vite + React design canvas (orijinal seed)
deploy/         Coolify + Nginx + systemd + gunicorn
_docs/          Faz raporları + PHASE_A_… (yeni)
_analysis/      Analiz / doğrulama raporları
```

## Hızlı Başlangıç (Docker — önerilen)

Lokal makinada Python kurulu olmasına gerek yok. Sadece Docker Desktop yeterli.

```powershell
cd C:\Users\kaank\sayman

# 1) PostgreSQL container'ını başlat
docker compose up -d db

# 2) Backend image'ını build et
docker compose build web

# 3) Public schema migration (sadece SHARED_APPS)
docker compose run --rm web python manage.py migrate_schemas --shared

# 4) İlk organization + 7 sektör tenant'ı seed
docker compose run --rm web python manage.py bootstrap_sayman `
    --org-name "Kılıç Holding" --org-slug kilic `
    --base-domain localhost --ensure-public

# 5) Superuser oluştur
docker compose run --rm web python manage.py createsuperuser

# 6) Web sunucuyu başlat (port 8200)
docker compose up -d web
docker compose logs -f web   # log takibi
```

### Erişim

| URL | Schema | Açıklama |
|---|---|---|
| http://localhost:8200/admin/ | `public` | Control plane — Organization/Tenant/User yönetimi |
| http://tekstil.kilic.localhost:8200/admin/ | `g3_tekstil` | Tekstil tenant admin |
| http://enerji.kilic.localhost:8200/admin/ | `g3_enerji` | Enerji tenant admin |
| http://insaat.kilic.localhost:8200/admin/ | `g3_insaat` | İnşaat tenant admin |
| http://gayrimenkul.kilic.localhost:8200/admin/ | `g3_gayrimenkul` | Gayrimenkul tenant admin |
| http://kisisel.kilic.localhost:8200/admin/ | `g3_kisisel` | Kişisel tenant admin |
| http://sanayi.kilic.localhost:8200/admin/ | `g3_sanayi` | Sanayi tenant admin |
| http://hukuk.kilic.localhost:8200/admin/ | `g3_hukuk` | Hukuk tenant admin |

**Not:** Windows 10+ otomatik `*.localhost` → `127.0.0.1` resolve eder; `hosts` dosyası düzenlemeye gerek yok.

### Yararlı Docker Komutları

```powershell
# Container durumu
docker compose ps

# PostgreSQL shell
docker compose exec db psql -U sayman_user -d sayman_dev

# Schema'ları listele
docker compose exec db psql -U sayman_user -d sayman_dev -c "\dn"

# Django shell (multi-tenant aware)
docker compose run --rm web python manage.py shell

# Belirli tenant'a tenant_command çalıştır
docker compose run --rm web python manage.py tenant_command shell --schema=g3_tekstil

# Tüm container'ları durdur
docker compose down

# Volume'ları da temizle (DB sıfırla)
docker compose down -v
```

## Settings Ortamları

| Ortam | DJANGO_SETTINGS_MODULE | DB |
|---|---|---|
| Lokal Docker | `config.settings.local_pg` | PostgreSQL (compose service `db`) |
| Lokal native | `config.settings.local` | SQLite (sadece public schema testi; multi-tenant runtime için PG zorunlu) |
| Production | `config.settings.production` | PostgreSQL (env'den) |

## Roadmap

- ✅ Seed paket (17 faz tek-tenant muhasebe sistemi)
- ✅ **Faz A.0 — Multi-Tenant Scaffold** (django-tenants kuruldu; 1 organization + 7 tenant + schema izolasyon doğrulandı)
- 🚧 **Faz A.1 — Tenant Switcher UI + Subdomain prod hazırlık**
- ⏳ Faz B — Hibrit Auth & Permission (UserGroupRole + UserTenantOverride)
- ⏳ Faz C — Group-Shared Master Data (`share_scope[]`)
- ⏳ Faz D — DRF REST API
- ⏳ Faz E — Sektör Konfig Sistemi (`TenantConfig.sector` + `active_modules[]`)
- ⏳ Faz F — SaaS Onboarding + Billing (Iyzico)
- ⏳ Faz G — Production Deploy (Coolify wildcard SSL)
- ⏳ Faz H — Damga / Santral API köprüleri

Detay: `_docs/PHASE_A_MULTI_TENANT_PLAN.md`.

## Lisans

Proprietary. © 2026 Kaan Kılıç. Tüm hakları saklıdır.
