# FAZ 2 — BASE SCAFFOLD RAPORU
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 2 — Base Scaffold
**Tarih:** 2026-05-05
**Durum:** TAMAMLANDI · Tüm kabul kriterleri PASS · Faz 3 Import Merkezi için hazır

---

## 1. OLUŞTURULAN İSKELET

```
backend/
├── manage.py
├── README.md
├── .gitignore
├── config/
│   ├── __init__.py
│   ├── urls.py            (8 namespace include)
│   ├── wsgi.py
│   ├── asgi.py            (Channels Faz 11'de eklenir)
│   └── settings/
│       ├── __init__.py
│       ├── base.py        (paylaşılan ayarlar + token)
│       ├── local.py       (SQLite default)
│       ├── local_pg.py    (PostgreSQL hazır)
│       └── production.py  (env-based, Faz 14 placeholder)
├── apps/
│   ├── core/              (BaseModel + helper + tags)
│   ├── audit/             (AuditLog model + service + view + admin)
│   ├── accounts/          (Auth view + 6 rol seed command)
│   ├── parties/           (5 master CRUD: Company/Person/PropertyAsset/Bank/Institution)
│   ├── notifications/     (NotificationLog model + view)
│   ├── tasks/             (Task model + view)
│   ├── chat/              (ChatThread/ChatMessage placeholder)
│   └── dashboard/         (KPI + risk + audit + task widget aggregator)
├── templates/
│   ├── base.html
│   ├── includes/          (topbar, sidebar, messages, chat_widget_placeholder, status_badge)
│   ├── accounts/          (login, profile)
│   ├── dashboard/         (home)
│   ├── parties/           (index, list, detail, form)
│   ├── audit/             (list)
│   ├── notifications/     (list)
│   ├── tasks/             (list)
│   ├── chat/              (center placeholder)
│   └── core/              (empty_state)
├── static/css/app.css     (DESIGN_FREEZE token + component class)
└── tests/
    └── test_smoke.py      (22 test)
```

**Toplam Python dosya:** 91 (tests + apps + config + manage)
**Toplam template:** 14
**Toplam CSS:** 1 (app.css ~250 satır)

---

## 2. APP LİSTESİ (8)

| App | Sorumluluk | Faz 2 Kapsam |
|---|---|---|
| `apps.core` | BaseModel, SoftDeleteMixin, helper'lar, tags | ✅ |
| `apps.audit` | AuditLog model + middleware-friendly service | ✅ |
| `apps.accounts` | Login/logout/profile + 6 rol seed | ✅ |
| `apps.parties` | 5 master CRUD (archive/restore) | ✅ |
| `apps.notifications` | NotificationLog placeholder model + view | ✅ |
| `apps.tasks` | Task placeholder model + dashboard widget | ✅ |
| `apps.chat` | ChatThread/Message placeholder + center page | ✅ |
| `apps.dashboard` | 4 KPI + 4 risk + bağlı widget'lar | ✅ |

---

## 3. MODEL LİSTESİ (8 model + Django built-in)

| App | Modeller |
|---|---|
| core | (abstract) BaseModel, TimeStampedModel, SoftDeleteModel — concrete model yok |
| audit | `AuditLog` (action enum: CREATE/UPDATE/ARCHIVE/RESTORE/HARD_DELETE/LOGIN/LOGOUT/SEED/PERMISSION_CHANGE/VIEW) |
| accounts | (Django built-in `User` + `Group` kullanılıyor; 2FA hook ileride) |
| parties | `Company`, `Person`, `PropertyAsset`, `Bank`, `Institution` |
| notifications | `NotificationLog` (level/channel/status enum'larıyla) |
| tasks | `Task` (priority/status enum'larıyla) |
| chat | `ChatThread`, `ChatMessage` (placeholder) |
| dashboard | (model yok — read-only aggregator) |

---

## 4. MIGRATION LİSTESİ

```
audit         [X] 0001_initial          (AuditLog)
chat          [X] 0001_initial          (ChatThread, ChatMessage)
notifications [X] 0001_initial          (NotificationLog)
parties       [X] 0001_initial          (Bank, Company, Institution, Person, PropertyAsset)
tasks         [X] 0001_initial          (Task)
+ Django built-in: admin, auth, contenttypes, sessions
```

Faz 2 toplam **5 yeni migration**, hepsi uygulanmış.

---

## 5. URL LİSTESİ

```
/                                   → /dashboard/ (redirect)
/admin/                             → Django admin
/accounts/login/                    → Giriş
/accounts/logout/                   → Çıkış
/accounts/profile/                  → Profil
/dashboard/                         → Ana dashboard
/master/                            → Master tablolar index
/master/<slug>/                     → Liste (companies/persons/properties/banks/institutions)
/master/<slug>/new/                 → Yeni
/master/<slug>/<pk>/                → Detay
/master/<slug>/<pk>/edit/           → Düzenle
/master/<slug>/<pk>/archive/        → Pasifleştir / Aktif et (POST)
/audit/                             → AuditLog liste
/notifications/                     → Bildirim liste
/tasks/                             → Görev liste
/chat/                              → Mesaj merkezi placeholder
```

> ❌ Hard-delete URL bilinçli olarak yok (`reverse("parties:delete")` test'te NoReverseMatch döner — Anayasa 3.8).

---

## 6. SETTINGS YAPISI

| Dosya | Amaç | DB |
|---|---|---|
| `base.py` | Paylaşılan ayarlar, INSTALLED_APPS, MIDDLEWARE, locale tr-TR, brand sabitleri, **PAYMENT_DEKONT_REQUIRED_THRESHOLD=5000**, **PAYMENT_DOUBLE_APPROVAL_THRESHOLD=50000** | — |
| `local.py` | DEBUG=True, ALLOWED_HOSTS local | SQLite |
| `local_pg.py` | local + DB env (DB_NAME/USER/PASSWORD/HOST/PORT) | PostgreSQL |
| `production.py` | DEBUG=False, HSTS, secure cookies, env-only secret | PostgreSQL (env) |

Tutar eşikleri **settings constant** olarak yazıldı; ileride `SystemSetting` modeli ile DB tarafına alınabilir (mimari not Faz 4 için).

---

## 7. SEED ROLES — IDEMPOTENT

```bash
$ python manage.py seed_roles
  [+] super_admin (Super Admin)
  [+] yonetici (Yönetici)
  [+] muhasebe_muduru (Muhasebe Müdürü)
  [+] muhasebeci (Muhasebeci)
  [+] personel (Personel)
  [+] goruntuleyici (Görüntüleyici)
seed_roles tamamlandı. 6 yeni rol yaratıldı.

$ python manage.py seed_roles    # 2. çalıştırma
  [.] super_admin (mevcut)
  [.] ...
seed_roles tamamlandı. 0 yeni rol yaratıldı.
```

✅ Idempotent · ✅ AuditLog'a `SEED` aksiyonu yazıldı.

---

## 8. TEST SONUÇLARI

```
$ python manage.py test tests
....................
----------------------------------------------------------------------
Ran 22 tests in 7.28s
OK
```

### Test grupları

| Grup | Test Sayısı | Sonuç |
|---|---|---|
| `SystemCheckTest` | 2 | ✅ |
| `SeedRolesTest` | 3 | ✅ (creates_6_groups, idempotent, writes_audit) |
| `AuthFlowTest` | 4 | ✅ (login URL, anon redirect, auth 200, login writes audit) |
| `PartiesCRUDTest` | 4 | ✅ (index, create+audit, archive→restore softly, no-hard-delete URL) |
| `AuditLogTest` | 1 | ✅ (helper writes correct log) |
| `DesignContractTest` | 6 | ✅ (no dark mode, IBM Plex var, no Inter/JetBrains, brand tokens, chat widget, payment thresholds) |
| `HelperTest` | 2 | ✅ (format_money_tr, mask_tc) |

**Toplam: 22/22 PASS · 0 fail · 0 error · 0 skip**

---

## 9. KABUL KRİTERLERİ DOĞRULAMA

| # | Kriter | Sonuç |
|---|---|---|
| 1 | `manage.py check` PASS | ✅ |
| 2 | Migrations oluşturuldu ve uygulanabiliyor | ✅ (5 app initial migration) |
| 3 | seed_roles idempotent | ✅ (test_seed_roles_idempotent) |
| 4 | Login çalışıyor | ✅ (test_login_url_accessible_anon, test_login_writes_audit) |
| 5 | Dashboard authenticated 200 | ✅ (test_dashboard_authenticated_200) |
| 6 | Master CRUD temel çalışıyor | ✅ (test_create_company, test_master_index_page) |
| 7 | Archive/restore fiziksel silmeden çalışıyor | ✅ (test_archive_restores_softly) |
| 8 | AuditLog create/update/archive/restore/seed yazıyor | ✅ (CRUD + SEED testleri) |
| 9 | NotificationLog placeholder var | ✅ (model + view + dashboard widget) |
| 10 | Task placeholder dashboard'da görünüyor | ✅ (DashboardHomeView.my_tasks) |
| 11 | Chat widget placeholder sağ altta görünüyor | ✅ (test_chat_widget_placeholder_in_base) |
| 12 | Dark mode yok | ✅ (test_no_dark_mode_in_css) |
| 13 | IBM Plex Sans / IBM Plex Mono tokenları var | ✅ (test_ibm_plex_in_base_template) |
| 14 | Inter / JetBrains referansı yok | ✅ (test_no_forbidden_fonts) |
| 15 | Başka projelere dokunulmadı | ✅ (sadece backend/ altında çalışıldı) |
| 16 | Commit/push/deploy yapılmadı | ✅ |
| 17 | PAYMENT_*_THRESHOLD constant'ları | ✅ (test_payment_threshold_constants) |

---

## 10. AÇIK KALANLAR (Faz 3+ için)

| Madde | Faz | Not |
|---|---|---|
| Import parser (Excel/PDF/RAR) | Faz 3 | PHASE1_IMPORT_ARCHITECTURE_PLAN.md hazır |
| Fatura/Ödeme modelleri | Faz 4 | apps.finance + apps.official_payments |
| Otomatik görev üretimi cron | Faz 10 | Celery beat + GorevSablonu |
| Bildirim 4 aşamalı kapı (gerçek) | Faz 12 | Telegram bot + dispatcher |
| Chat WebSocket | Faz 11 | Channels + Redis |
| Object-level permission | Faz 5+ | django-guardian değerlendirilebilir |
| 2FA aktivasyonu | MVP-2 | django-two-factor-auth |
| Production deploy | Faz 14 | systemd + nginx |
| `SystemSetting` model (tutar eşiği DB tarafı) | Faz 4 | settings constant'tan DB'ye geçiş |
| TC No / telefon encryption | Faz 4 (Sahis modeli) | django-fernet-fields önerisi |
| Login throttle / fail2ban | Faz 14 | django-axes |
| Şifre sıfırlama e-posta | Faz 2.1 | SMTP konfig |

---

## 11. ROLLBACK NOTU

Faz 2'yi tamamen geri almak için:

```bash
# 1. SQLite DB'yi sil
rm backend/db.sqlite3

# 2. Migration dosyalarını sil (initial'lar)
rm backend/apps/audit/migrations/0001_initial.py
rm backend/apps/chat/migrations/0001_initial.py
rm backend/apps/notifications/migrations/0001_initial.py
rm backend/apps/parties/migrations/0001_initial.py
rm backend/apps/tasks/migrations/0001_initial.py

# 3. backend/ klasörünü tamamen kaldır (alternatif)
rm -rf backend/
```

`design-canvas.jsx` ve `_docs/_analysis/` Faz 0-1 çıktılarına dokunulmadı.

---

## 12. FAZ 3'E GEÇİŞ KRİTERLERİ

✅ Tüm kabul kriterleri PASS.
✅ AuditLog middleware-friendly çalışıyor.
✅ Master CRUD temel.
✅ Settings 4 ortam hazır.
✅ Tasarım design contract'ı korunuyor.

**Faz 3 başlamaya hazır.**

### Faz 3 ön koşulları (zaten hazır)
- ✅ `apps.parties` master modelleri (Company, Person, PropertyAsset, Bank, Institution).
- ✅ `apps.core.BaseModel` + soft-delete.
- ✅ `apps.audit.services.audit_log` helper.
- ✅ Settings.PAYMENT_*_THRESHOLD constant'ları.
- ✅ `Belge` modeli **eksik** — Faz 3'te `apps.documents` ilk iş.

### Faz 3 ilk adımları
1. `apps.documents` (`Belge` model + sha256 dedup + private storage).
2. `apps.imports` modelleri (`ImportBatch`, `ImportSourceFile`, `ImportDraftRecord`, `ImportLog`, `ImportMappingProfile`).
3. Excel parser servisi (openpyxl).
4. Dry-run + commit + rollback servisi.
5. UI: Frame 03 + Frame 04 implementation.

### Faz 3 sonrası
Faz 4 (Fatura/Ödeme) → Faz 5 (Abonelik) → ... PROJECT_ANAYASA Madde 5 sırası.

---

**SON.** Faz 2 Base Scaffold tamamlandı. Faz 3 Import Merkezi başlatılabilir.
