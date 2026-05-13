# FAZ 1 — TEKNİK MİMARİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Sürüm:** 1.0
**Tarih:** 2026-05-05
**Durum:** TASLAK · Faz 2 Base Scaffold için bağlayıcı

---

## 1. STACK ÖZETİ

| Katman | Seçim | Versiyon | Gerekçe |
|---|---|---|---|
| Dil | Python | **3.12+** | Type hint olgunluğu, performans, modern syntax |
| Web Framework | Django | **5.1 LTS** veya 5.2 | LTS desteği, async desteği, built-in auth/admin |
| Veritabanı | PostgreSQL | **15+** | JSON kolonu (ImportDraft), full-text search, GiST/GIN index, partition desteği |
| Cache / Queue Broker | Redis | **7+** | Cache + Celery broker + WebSocket pubsub |
| Task Queue | Celery | **5.4+** | Görev otomatik üretimi cron, bildirim gönderimi, rapor export |
| Real-time | Django Channels | **4.x** | Chat (Faz 11) WebSocket altyapısı |
| Frontend | Django Templates + HTMX + Alpine.js | HTMX 2.x · Alpine 3.x | Server-rendered, basit, SEO/audit dostu, Anayasa Madde 11 ile uyumlu |
| CSS | Tailwind CSS | 3.x | Design tokens (`tokens.css` veya `tailwind.config.js`) ile uyumlu |
| Icon | Lucide | latest | Anayasa badge ikonları + UI |
| File Parsing | openpyxl + pdfplumber + rarfile | latest | Excel + PDF metadata + RAR |
| OCR (MVP-2) | Tesseract veya alternatif | — | Faz 2 sonrası |
| Storage | Local FS + S3-compatible (LATER) | — | MVP-1 local; private storage |
| Web Server | Gunicorn + Uvicorn (ASGI) | latest | Channels için ASGI gerekli |
| Reverse Proxy | nginx | 1.24+ | TLS, statik dosya, gzip |
| Container | Docker + docker-compose | latest | Reproducible deploy |
| OS | Ubuntu Server | 22.04 LTS / 24.04 LTS | Python 3.12, systemd, kolay paket yönetimi |

**Yasak:** SQLite (production), MySQL, MongoDB. SQLite yalnız local geliştirici DB için izin verilir; CI/CD'de PostgreSQL test container.

---

## 2. APP YAPISI (üst düzey)

```
backend/
├── config/                 # Django proje konfigürasyonu
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   ├── prod.py
│   │   └── test.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py             # Channels için
├── apps/
│   ├── core/               # BaseModel, mixins, soft-delete, audit middleware
│   ├── accounts/           # User, Group, Role, Permission helper
│   ├── parties/            # Sahis, Sirket, Mulk, Banka, Kurum
│   ├── documents/          # Belge model + storage + sha256 dedup
│   ├── imports/            # ImportBatch/Draft/Log/Mapping (Faz 3)
│   ├── finance/            # Fatura, Ödeme (Faz 4)
│   ├── subscriptions/      # Abonelik, Taahhüt (Faz 5)
│   ├── pruva/              # SiteX (Faz 6)
│   ├── properties/         # Mülk + Emlak vergisi (Faz 7)
│   ├── guarantees/         # Teminat mektupları (Faz 8)
│   ├── integrators/        # ETA/Papinet/Kontör (Faz 9 — MVP-2)
│   ├── tasks/              # Ajanda + Görev (Faz 10)
│   ├── chat/               # Kurumsal chat (Faz 11 — MVP-3)
│   ├── notifications/      # Bildirim + Telegram (Faz 12)
│   ├── reports/            # Raporlama / Excel export (Faz 13)
│   ├── audit/              # AuditLog (her zaman aktif)
│   ├── dashboard/          # Dashboard widget aggregator
│   └── official_payments/  # BAĞKUR / SSK / İTO / BES / vergi
├── static/
│   ├── css/
│   │   └── tokens.css
│   ├── js/
│   └── fonts/
│       └── ibm-plex-{sans,mono}/
├── templates/
│   ├── base.html
│   ├── components/
│   └── <app>/
├── locale/
│   └── tr/                 # Türkçe çeviri (zorunlu)
├── media/                  # Yüklenen dosyalar (gitignore)
├── _backups/               # DB dump path
├── manage.py
├── pyproject.toml          # poetry veya pip-tools
└── requirements/
    ├── base.txt
    ├── prod.txt
    └── dev.txt
```

---

## 3. SETTINGS YAPISI

3 ortam: `local` (geliştirici), `test` (CI), `prod` (ayrı VPS).

```python
# config/settings/base.py
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "channels",
    # local apps
    "apps.core",
    "apps.audit",
    "apps.accounts",
    "apps.parties",
    "apps.documents",
    # ...
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",  # TR
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.middleware.AuditLogMiddleware",  # custom
    "apps.core.middleware.SoftDeleteMiddleware",
]

LANGUAGE_CODE = "tr"
TIME_ZONE = "Europe/Istanbul"
USE_I18N = True
USE_TZ = True

# Para format helper'ı locale ile değil, custom Tr formatlayıcı ile
```

`prod.py`: DEBUG=False, ALLOWED_HOSTS, secure cookies, HSTS, secret env'den.

---

## 4. MEDIA / STATIC YAPISI

```
media/
├── imports/                # Yüklenen kaynak Excel/RAR/PDF (sha256 prefix)
│   ├── batches/<batch_id>/source/<sha256_first2>/<sha256>.<ext>
│   └── batches/<batch_id>/extracted/   # RAR çıkarımı (geçici)
├── documents/              # Onaylanmış kalıcı belgeler
│   ├── faturalar/<yyyymm>/<sha256>.pdf
│   ├── dekontlar/
│   ├── ekstreler/
│   ├── makbuzlar/
│   ├── borc_dokumleri/
│   ├── teminat_mektuplari/
│   ├── sozlesmeler/
│   └── pruva34_yillik/
├── chat/                   # Chat ek dosyaları
└── exports/<user_id>/<yyyymm>/  # Excel/PDF export ürünleri (ttl ile temizlik)

static/                     # collectstatic hedefi
fonts/
```

**Güvenlik:**
- Media private (nginx `internal` directive + Django `X-Accel-Redirect`).
- Belge erişimi yetki kontrolü ile (View → check perm → serve).
- Yüklenen dosya tipi whitelist (.xlsx, .xlsm, .pdf, .jpg, .jpeg, .png, .rar, .zip, .doc, .docx).
- Maks dosya boyutu: 100 MB import; 25 MB chat eki; 10 MB dekont.
- sha256 + boyut + MIME doğrulama upload sırasında.

---

## 5. LOGLAMA

3 log akışı:

| Log | Hedef | Format | Ne yazılır |
|---|---|---|---|
| `django.log` | `/var/log/muhasebe/django.log` | JSON line | Request/response (sensitive maskelenmiş) |
| `audit.log` | DB `AuditLog` tablosu | structured JSON kolon | Tüm CRUD aksiyonları |
| `notification.log` | DB `NotificationLog` tablosu | structured | Bildirim üretim + gönderim denemeleri |
| `celery.log` | `/var/log/muhasebe/celery.log` | JSON line | Cron + async task |

**Maskeleme kuralları (Anayasa 12.1):**
- TC No: ilk 3 + son 4 görünür, ortası `***` (`123***1234`)
- Telefon: son 4 görünür
- IBAN: son 4 görünür
- Şifre/token: hiç loglanmaz

`django-structlog` veya custom JSON formatter önerilir.

---

## 6. AUDITLOG MİMARİSİ

`apps.audit.middleware.AuditLogMiddleware`:
- Request başlangıcında `request.user` yakalanır.
- Model `pre_save`/`post_save`/`post_delete` signal'ları tetiklenir.
- Generic FK ile `AuditLog(user, model, kayit_id, eylem, eski_json, yeni_json, modul, ip, ua)`.
- "Eski/yeni JSON" diff: `django-simple-history` veya custom snapshot.
- Hard-delete istisnası: zorunlu sebep + Super Admin onayı.

`AuditLog` PostgreSQL `JSONB` kolonu + GIN index → arama hızlı.

---

## 7. NOTIFICATIONLOG MİMARİSİ

`NotificationRule` (kural tanımı) + `NotificationLog` (üretim) + `NotificationDeliveryAttempt` (gönderim denemesi).

3 aşamalı kapı:
1. **Sistem içi** (anında, her zaman aktif) → Dashboard widget
2. **Dry-run** (admin görür, gönderilmez) → DB'ye yazılır, gönderilmez
3. **Test** (test grubu) → Telegram bot test chat
4. **Gerçek** (Faz 12'de açılır) → Super Admin onayı + audit'lenir

Telegram bot token: encrypted (django-fernet-fields veya AES-GCM env key).

---

## 8. TASK / CHAT ENTEGRASYONU

| Mekanizma | Kullanım |
|---|---|
| **Generic FK** (bagli_model + bagli_id) | Görev/Chat/Bildirim → herhangi bir kayda bağ |
| **Celery beat** | Cron: 00:30 günlük görev üretimi, 09:00 geciken özet, 17:30 günsonu |
| **Celery worker** | Email/Telegram async, rapor export, RAR çıkarma |
| **Channels + Redis** | Chat real-time mesaj, online indicator, typing |

---

## 9. ÇOK YILLI VERİ MODELİ

- **Yıl bağımlı tablolar:** `EmlakVergisi(yil, donem)`, `KiraDonemTutar(yil)`, `SiteXEkstre(yyyymm)`, `Fatura(donem_yyyymm)`, `OfficialPayment(yil, taksit_no)`.
- `yyyymm` her zaman `CHAR(6)` + Django check constraint regex `^[0-9]{6}$`.
- `(yil, donem)` index'lenir; partition gerekirse Faz 14+ değerlendirilir (bugün için <500K satır beklenir, partition gereksiz).
- Tarih aritmetiği için `dateutil.relativedelta` kullanılır.

---

## 10. SOFT DELETE / ARCHIVE

`apps.core.models.BaseModel`:
```python
class BaseModel(models.Model):
    is_active = models.BooleanField(default=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(...)
    delete_reason = models.TextField(blank=True)

    objects = SoftDeleteManager()    # is_active=True default
    all_objects = models.Manager()    # her şey

    class Meta:
        abstract = True
```

- `delete()` override → `is_active=False` + `deleted_at=now`.
- Hard-delete: `force_delete()` Super Admin only + `delete_reason` zorunlu.
- Arşiv durumu: `archived_at` ayrı kolon (yıllık temizlik).
- Filtreleme: default manager `is_active=True`.

---

## 11. IDEMPOTENCY YAKLAŞIMI

| Operasyon | Idempotency anahtarı |
|---|---|
| Fatura import | `(abonelik_id, donem_yyyymm)` unique |
| Ödeme import | `(fatura_id, odeme_tarihi, tutar, banka_id)` natural key + `external_ref` |
| EmlakVergisi import | `(mulk_id, yil, donem)` unique |
| SiteXEkstre | `(daire_id, yyyymm)` unique |
| Teminat | `(banka_id, mektup_no)` unique |
| Belge | `sha256` unique |
| ImportBatch retry | `(source_file_sha256, hedef_modul)` |
| Cron task üretimi | `(sablon_id, hedef_kayit_app+id, donem)` natural key |
| API webhook (LATER) | `Idempotency-Key` HTTP header |

Duplicate algılandığında: **UPDATE veya SKIP** kullanıcı seçer (mapping ekranında).

---

## 12. TRANSACTION ATOMIC YAKLAŞIMI

| Akış | Strateji |
|---|---|
| ImportBatch commit | Tek `transaction.atomic()` block — hata olursa tümü rollback |
| Ödeme işaretleme + görev tamamlama + audit yaz | `transaction.atomic()` + select_for_update on related rows |
| Yetki değişikliği | atomic + AuditLog senkron yazım (savepoint) |
| Cron görev üretimi | her batch (örn. 100 görev) ayrı transaction |
| Bildirim gönderimi | DB write atomic; gerçek gönderim async (Celery) |

`select_for_update` race condition'a karşı (örn. iki kullanıcı aynı faturayı işaretliyor).

---

## 13. SİSTEM SINIRLARI (kapasite varsayımı)

| Metrik | MVP-1 | MVP-2 hedef | LATER |
|---|---|---|---|
| Eşzamanlı kullanıcı | 10 | 30 | 100 |
| DB satır sayısı | <500K | <2M | 10M+ |
| Aylık ödeme kaydı | ~500 | ~2K | — |
| Belge sayısı (toplam) | ~5K | ~20K | — |
| Belge boyutu (toplam) | ~5 GB | ~20 GB | — |
| Import sıklığı | haftalık | günlük | real-time webhook |
| Bildirim/gün | ~50 | ~200 | — |

Bu kapasitede tek VPS (4 vCPU, 8 GB RAM, 200 GB SSD) yeterli.

---

## 14. PROD İZOLASYON YAKLAŞIMI

Anayasa 1.5 / D-017:
- **Ayrı VPS** (örn. `muhasebe.acme.local` veya `mop-prod-1`).
- **Ayrı Linux user** (`muhasebe`) — sudo'suz.
- **Ayrı PostgreSQL DB + DB user** (`muhasebe_db`, `muhasebe_user`).
- **Ayrı Redis instance veya logical DB** (DB 0).
- **Ayrı systemd unit'ler:** `muhasebe-web.service`, `muhasebe-worker.service`, `muhasebe-beat.service`, `muhasebe-asgi.service`.
- **Ayrı nginx site** (`/etc/nginx/sites-available/muhasebe`).
- **Ayrı media path** (`/var/lib/muhasebe/media`).
- **Ayrı backup path** (`/var/lib/muhasebe/backups`).
- **Ayrı git repo** (örn. private GitLab/Gitea).
- **Ayrı .env dosyası** (chmod 600, root:muhasebe).
- **Hiçbir ortak SSO veya DB linkage yok** (Faz 14+ değerlendirilebilir).

---

**SON.** Bu doküman Faz 2 Base Scaffold'un bağlayıcı referansıdır.
