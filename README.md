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

## Hızlı Başlangıç (lokal dev)

```powershell
cd C:\Users\kaank\sayman\backend
python -m venv ..\.venv
..\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
Copy-Item .env.example .env  # secret/DB ayarlarını düzenle
python manage.py migrate_schemas --shared   # Faz A sonrası
python manage.py seed_roles
python manage.py createsuperuser
python manage.py runserver 8200
```

Tarayıcıda: http://127.0.0.1:8200/admin/

## Settings Ortamları

| Ortam | DJANGO_SETTINGS_MODULE | DB |
|---|---|---|
| Lokal | `config.settings.local` | SQLite (Faz A öncesi); Faz A sonrası PostgreSQL zorunlu (django-tenants) |
| Lokal PostgreSQL | `config.settings.local_pg` | PostgreSQL |
| Production | `config.settings.production` | PostgreSQL (env'den) |

## Roadmap

- ✅ Seed paket (17 faz tek-tenant muhasebe sistemi)
- 🚧 **Faz A — Multi-Group + Tenant Foundation** (django-tenants, schema setup) — şu an
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
