# PHASE 14 — PRODUCTION READINESS AUDIT (READ-ONLY)

**Tarih:** 2026-05-07
**Tip:** Salt-okunur ön denetim. Kod/migration/data dokunulmadı.
**Baseline:** 413/413 tests PASS · 84 ekran · UI Identity Reset PASS · Faz 13 dry-run PASS

---

## 1. PRECHECK

| Kontrol | Sonuç |
|---|---|
| Proje root | `C:\Users\lenovo\Desktop\muhasebe-operasyon-seed\` — onaylandı |
| Python | **3.13.2** |
| Django | **6.0.4** ⚠ (Django 5.2.14 baseline’dan upgrade görünüyor — LTS pozisyonu doğrulanmalı) |
| Aktif settings | `config.settings.local` (SQLite, DEBUG=True). Prod modülü: `config.settings.production` |
| `manage.py check` | ✅ `System check identified no issues (0 silenced).` |
| `makemigrations --dry-run --check` | ✅ `No changes detected` |
| Toplam migration | 21 dosya / 17 initial · `RunPython` kullanan: chat 0002, tasks 0002 (idempotent backfill) |
| Test suite | Baseline 413/413 (Faz 13 raporu). Bu audit’te tekrar çalıştırılmadı (read-only sınır) |
| Working tree | `git status` → **fatal: not a git repository** ⚠ |
| Diğer path’e dokunma | Yalnız proje root altında okuma yapıldı |

**Precheck verdict:** Çekirdek Django sağlığı PASS. Git ve bağımlılık beyanı eksik (ayrıntı §13).

---

## 2. SETTINGS / ENV AUDIT

| Madde | Durum | Not |
|---|---|---|
| `DEBUG=False` (prod) | ✅ PASS | `production.py:6` |
| `SECRET_KEY` env’den | ✅ PASS | `os.environ["DJANGO_SECRET_KEY"]` (zorunlu) — base.py’daki fallback yalnız local |
| `ALLOWED_HOSTS` env | ✅ PASS | `os.environ.get("ALLOWED_HOSTS","").split(",")` — boşsa **boş liste** olur (ALLOWED_HOSTS doğrulamasını trigger eder; kabul edilebilir) |
| `CSRF_TRUSTED_ORIGINS` | ❌ **BLOCKER** | Tanımsız. HTTPS form POST’ları reddedilir. Django 4+ ile mecburi |
| `SECURE_SSL_REDIRECT` | ✅ PASS | True |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | ✅ PASS | True |
| `SECURE_HSTS_SECONDS` (1 yıl) + subdomains + preload | ✅ PASS | |
| `SECURE_CONTENT_TYPE_NOSNIFF` / `X_FRAME_OPTIONS=SAMEORIGIN` | ✅ PASS | |
| `SECURE_PROXY_SSL_HEADER` | ✅ PASS | nginx X-Forwarded-Proto |
| `SECURE_REFERRER_POLICY` | ⚠ WARNING | Tanımsız (Django default: `same-origin` — kabul edilebilir ama açık yazılması önerilir) |
| `STATIC_URL` / `STATIC_ROOT` | ⚠ WARNING | base.py’da `BASE_DIR/staticfiles`, prod’da `/srv/muhasebe/shared/static` — **deploy path planı (§9) farklı**: `/var/www/muhasebe-ops/static` öneriliyor. Tek doğru kaynak seçilmeli |
| `MEDIA_ROOT` | ⚠ WARNING | prod’da `/var/lib/muhasebe/media`, plan `/var/www/muhasebe-ops/media` — uyumlandırılmalı |
| `PRIVATE_MEDIA_ROOT` | ⚠ WARNING | base.py’da `MEDIA_ROOT/private` — prod’da explicit override yok; plan `/var/www/muhasebe-ops/private_media` öngörüyor |
| Database env | ✅ PASS | DB_NAME/USER/PASSWORD/HOST/PORT, `CONN_MAX_AGE=60` |
| `TIME_ZONE` | ✅ PASS | `Europe/Istanbul`, `USE_TZ=True` |
| `LANGUAGE_CODE`/`USE_I18N` | ✅ PASS | `tr` |
| Logging | ⚠ WARNING | Sadece console handler — prod için `/var/log/muhasebe-ops/django.log` rotating file handler önerilir |
| Telegram real send env | ✅ PASS | YOK; servis kodu daima SUPPRESSED yazar |
| SMTP env | ⚠ INFO | `EMAIL_HOST*` env opsiyonel — Anayasa bilinçli olarak SMTP kapalı |
| Celery / scheduler | ✅ PASS | Hiç değil — bilinçli (manuel-first) |
| `FILE_UPLOAD_MAX_MEMORY_SIZE` / `DATA_UPLOAD_MAX_MEMORY_SIZE` | ⚠ WARNING | Tanımsız → Django default 2.5 MB. `IMPORT_MAX_FILE_SIZE_MB=100` ile çelişebilir; en az `DATA_UPLOAD_MAX_MEMORY_SIZE = 110*1024*1024` veya streaming upload pattern’ı doğrulanmalı |
| `BRAND` context | ✅ PASS | “Muhasebe Operasyonları Takip Sistemi” / “Muhasebe Operasyonları” / “OPERASYON MERKEZİ” |

**Settings verdict:** **WARNING** — 1 BLOCKER (CSRF_TRUSTED_ORIGINS), 5 WARNING. Hızlı düzeltilebilir.

---

## 3. DATABASE / POSTGRESQL READINESS

| Konu | Durum |
|---|---|
| Local SQLite ↔ Prod PostgreSQL ayrımı | ✅ PASS — `local.py` SQLite, `local_pg.py` ve `production.py` `django.db.backends.postgresql` |
| Production env zinciri | ✅ PASS — DB_NAME/USER/PASSWORD/HOST/PORT |
| Migration dosyaları düzenli | ✅ PASS — 17 initial + 4 enrichment, `makemigrations --check` temiz |
| `RunPython`/`RunSQL` migration’lar | ✅ PASS — yalnız 2 yerde: `chat/migrations/0002` ve `tasks/migrations/0002` (idempotent backfill, reverse fonksiyonu da sağlanmalı — manuel kontrol önerilir) |
| Geri dönüşü olmayan veri migration | ✅ PASS — yok |
| Initial migration tutarlılığı | ✅ PASS — 17/17 app initial mevcut |
| Unique constraint riskleri | ⚠ INFO — `Document.sha256 unique`, `NotificationRule.code unique`, `(user,category)` unique pref. PostgreSQL’e geçişte SQLite veri taşıma yapılmayacaksa risk yok (zaten temiz veritabanı varsayılıyor) |
| Index’ler | ✅ PASS — `Document.related_*`, `NotificationLog.created_at`, finance Payable index’leri düzenli |
| Soft-delete pattern | ✅ PASS — chat (`is_deleted`), tasks (cancel), pruva (archive/cancel statement), reports (cancel run). Hard delete yok |

Modül bazlı kritik kontrol:

| Modül | Initial migration | Lifecycle/state | Soft-delete |
|---|---|---|---|
| finance | ✅ | Payable: OPEN/PARTIAL/PAID/CANCELLED | ✅ |
| documents | ✅ | sha256 dedup | ✅ |
| tasks | ✅ + 0002 enrichment | TODO/IN_PROGRESS/DONE/CANCELLED | ✅ |
| chat | ✅ + 0002 attachments | OPEN/CLOSED/ARCHIVED | ✅ (`soft_delete_message`) |
| reports | ✅ | RUNNING/SUCCESS/FAILED/CANCELLED | ✅ |
| notifications | ✅ + 0002 phase13 | DRY_RUN/READY/SUPPRESSED/CANCELLED/SENT/FAILED | ✅ |
| pruva (Site Aidatları) | ✅ | unit archive, statement cancel | ✅ |
| properties | ✅ | tax year/installment | ✅ |
| guarantees | ✅ | issue/release/renew | ✅ |
| integrators | ✅ | service/contract/credit | ✅ |

**DB verdict:** ✅ PASS. SQLite→PG göçü için ayrı plan gerekmeyecek (boş prod DB varsayımı).

---

## 4. MEDIA / PRIVATE DOCUMENT STORAGE AUDIT

| Kontrol | Durum |
|---|---|
| Private storage sınıfı | ✅ `PrivateStorage(FileSystemStorage)` `MEDIA_ROOT/private` altında, `base_url=None` |
| sha256 dedup | ✅ `Document.get_or_create_from_file()` — duplicate dosya ikinci `Document` üretmez |
| Upload path traversal | ✅ Path `documents/<sha[:2]>/<sha>.<ext>` — kullanıcı input dosya adı path’e direkt enjekte edilmez |
| Fiziksel overwrite | ✅ sha256 unique nedeniyle aynı içerik tek dosya |
| Download login zorunlu | ✅ `DocumentDownloadView(LoginRequiredMixin, View)` |
| Download object-level permission | ⚠ **WARNING** — Yalnızca login kontrolü var; “bu kullanıcı bu Document’a bakabilir mi?” kontrolü yok. Tüm authenticated kullanıcılar tüm belgeleri indirebilir. (Audit log yazılıyor ama erişim engellenmiyor.) |
| `audit_log` `action="VIEW"` | ✅ |
| nginx X-Accel-Redirect | ⚠ INFO — Şu anda Django `FileResponse` ile servis. Yorum satırında “Faz 14 prod: nginx X-Accel-Redirect” yazıyor; **uygulanmamış** |
| Public media servis edilmesi | ✅ `media/private/` nginx’ten public servis edilmemeli — deployment plan’da `internal;` location ile blokeli |
| Upload size limiti | ⚠ WARNING — `IMPORT_MAX_FILE_SIZE_MB=100` ama Django global `DATA_UPLOAD_MAX_MEMORY_SIZE` override yok |
| Backup’a media dahil | ✅ Plan: günlük dump + media snapshot (§10) |

**Media verdict:** **WARNING** — Object-level permission açığı (Faz 15 hedefi olabilir veya hızlı patch). Geri kalanı sağlam.

---

## 5. SECURITY / AUTH / PERMISSION AUDIT

| Alan | Durum |
|---|---|
| `LoginRequiredMixin` / `@login_required` kapsamı | ✅ 21 view modülünde 271 occurrence — tüm modül görünümleri korunmuş |
| 6 rol seed (`seed_roles`) | ✅ `super_admin / yonetici / muhasebe_muduru / muhasebeci / personel / goruntuleyici` |
| `can_write` / `can_approve` helper | ✅ tek kaynak `apps.finance.permissions` |
| Viewer create/export blok | ✅ `WriteMixin(UserPassesTestMixin) raise_exception=True` (finance/reports/chat/notifications/pruva/...) |
| Approve gate (50K ödeme, mark-ready, dry-run, telegram-test) | ✅ `ApprovePermMixin` / `_CanApproveMixin` |
| AuditLog mutator’larda | ✅ finance, documents, notifications, chat, tasks, reports, pruva, properties, guarantees, integrators tüm mutate noktalarında çağrılıyor |
| Hard delete | ✅ Yok (yalnız super_admin için domain tarafından açık değil) |
| Soft archive/cancel/status pattern | ✅ tüm modüller |
| Document download permission | ⚠ WARNING — sadece login (yukarıdaki §4 ile aynı) |
| Report export permission | ✅ login + can_write (TemplateCreate/Export) + permission helper `can_run_report` |
| Chat non-participant erişimi | ✅ `user_can_view_thread()` her thread view’de zorunlu; widget thread mesajları için 403 |
| Notification gerçek gönderim | ✅ `dry_run=True` default, `real_send_allowed=False` default, send → SUPPRESSED |
| Token / chat_id raw sızıntı | ✅ `render_notification` `token / chat_id / bot_token` context’ten siler; template’ler sadece `masked_chat_id` |

**Security verdict:** **WARNING** — Sadece document download object-level permission. Geri kalanı sağlam.

---

## 6. UI IDENTITY / DESIGN CONTRACT AUDIT

| Kural | Sonuç |
|---|---|
| “OPS” monogram | ✅ `BRAND.monogram="OPS"` ve sidebar/header’larda |
| “Muhasebe Operasyonları Takip Sistemi” | ✅ |
| “OPERASYON MERKEZİ” | ✅ `BRAND.subtitle` |
| `Pruva` user-facing | ❌ YOK (template grep negative) — “pruva” yalnız URL/namespace/code seviyesi |
| `Acme` / `Acme` | ❌ YOK |
| `KE` / `HES` / `Santral` / `Yenice` / `Kısık` / `üretim` | ❌ YOK |
| IBM Plex Sans / Mono | ✅ `app.css` |
| `Inter` font | ❌ YOK |
| `JetBrains` font | ❌ YOK |
| `prefers-color-scheme` | ✅ Sadece **kullanılmaz** yorumu var (`/* @media (prefers-color-scheme: dark) {} ← KULLANILMAZ */` line 363) |
| Sidebar “Site Aidatları” label | ✅ `templates/includes/sidebar.html:26` |
| Dashboard “Site Aidatları” widget | ✅ `templates/dashboard/home.html:155` |
| Tüm pruva template’lerinde başlık | ✅ “Site Aidatları” user-facing |

**UI verdict:** ✅ **PASS** — Identity reset korunmuş. Hiçbir yasaklı kelime aktif UI’da yok.

---

## 7. MODULE READINESS AUDIT

| Modül | MVP Hazır | Notlar |
|---|---|---|
| **A. Finance** (Payable CRUD, ödeme, kısmi, 5K dekont, 50K çift onay, audit) | ✅ | `PayableListView/CreateView/MarkPaidView/PaymentApproveView/PaymentRejectView` + threshold sabitleri base.py |
| **B. Documents** (upload, sha256, download permission, related) | ✅ (object-level perm WARN) | sha256 dedup + private storage |
| **C. Subscriptions** (abonelik, taahhüt, period charge, payable link) | ✅ | Faz 5 raporlu |
| **D. Regular Payments** (profil, dönem, payable link) | ✅ | |
| **E. Official Payments** (profil, taksit/dönem, payable link) | ✅ | |
| **F. Site Aidatları** (bağımsız bölüm, ekstre, payable link, belge, label) | ✅ | URL `/pruva/`, label “Site Aidatları” |
| **G. Properties / Emlak** (lifecycle, vergi yılı, taksit, payable link, belge) | ✅ | |
| **H. Guarantees** (lifecycle, komisyon, payable link, iade/yenileme) | ✅ | |
| **I. Integrators** (hizmet, sözleşme, kontör, kritik eşik, payable link) | ✅ | |
| **J. Tasks** (lifecycle, comment, attachment, related, dashboard) | ✅ | Faz 10 |
| **K. Chat** (thread, participant perm, message, attachment, widget) | ✅ | Faz 11 — WebSocket YOK, JSON poll |
| **L. Reports** (preview, XLSX/CSV, permission, download) | ✅ | Faz 12 — 47 test |
| **M. Notifications** (rule, dry-run, log, real send kapalı) | ✅ | Faz 13 — 42 test, KAPALI rozetli |

**Module verdict:** ✅ PASS — 13 modülün tümü MVP scope’unda canlıya hazır.

---

## 8. NO-OP / SAFETY GUARD AUDIT

| Yetenek | Beklenen | Doğrulama | Sonuç |
|---|---|---|---|
| Telegram real send | KAPALI | `apps/notifications` altında `requests` / `urllib` / `http.client` import yok (grep) | ✅ |
| SMTP / mail send | KAPALI | `send_mail(` / `EmailMessage(` / `smtplib` aktif kodda yok | ✅ |
| Celery | YOK | İmport yok | ✅ |
| APScheduler | YOK | İmport yok | ✅ |
| cron entegrasyonu | YOK | systemd timer veya cron job tanımı repo’da yok | ✅ |
| WebSocket / Channels | YOK | `apps/chat` JSON poll, `daphne`/`channels` yok | ✅ |
| Import commit → domain create | KAPALI | Faz 3 raporu “preview only” — manuel kontrol önerilir |
| Report scheduled send | YOK | reports hep manuel `run_export` | ✅ |
| Notification scheduled send | YOK | `run_notification_dry_run` manuel komut | ✅ |

**No-op verdict:** ✅ PASS — Yanlışlıkla aktifleşebilecek arka plan yok.

---

## 9. DEPLOYMENT ARCHITECTURE PLAN AUDIT

Plan hedef path’leri:
- App: `/var/www/muhasebe-ops/backend`
- venv: `/var/www/muhasebe-ops/venv`
- Env: `/var/www/muhasebe-ops/.env`
- Static: `/var/www/muhasebe-ops/static`
- Media (public boş): `/var/www/muhasebe-ops/media`
- Private media: `/var/www/muhasebe-ops/private_media`
- Log: `/var/log/muhasebe-ops/`
- Backup: `/var/backups/muhasebe-ops/`

Servisler:
- `muhasebe-ops-gunicorn.service` (systemd)
- nginx site (TLS terminate, X-Accel-Redirect)
- PostgreSQL 16 + role/db
- Backup script `/usr/local/sbin/slc-backup.sh` + systemd timer (cron yerine)

Mevcut prod settings’in deploy path uyumsuzlukları:
- `STATIC_ROOT = /srv/muhasebe/shared/static` ↔ plan `/var/www/muhasebe-ops/static` ⚠
- `MEDIA_ROOT = /var/lib/muhasebe/media` ↔ plan `/var/www/muhasebe-ops/media` ⚠
- `PRIVATE_MEDIA_ROOT` prod’da explicit yok (base.py: `MEDIA_ROOT/private`).

**Bu fazda kurulum yapılmadı.** Detaylı plan: `_docs/PRODUCTION_DEPLOYMENT_PLAN.md`.

**Deploy verdict:** ⚠ WARNING — production.py path’leri plan’a göre güncellenmeli (1 commit-lik patch).

---

## 10. BACKUP / RESTORE PLAN

Detayı `_docs/BACKUP_RESTORE_PLAN.md`. Özet:

- **PostgreSQL günlük dump:** `pg_dump -Fc` → `/var/backups/muhasebe-ops/db/YYYY-MM-DD.dump`
- **Media snapshot:** `tar` veya `rsync` `/var/www/muhasebe-ops/private_media` günlük
- **Export/report dosyaları:** `private_media` altında saklandığından aynı snapshot’a dahil
- **Retention:** günlük 7 · haftalık 4 · aylık 6
- **Restore drill:** `pg_restore -d` + `tar -xzf` → smoke test çalışması (bkz. §11)
- **Backup log:** secret içermez; sadece path/size/exit

---

## 11. PRODUCTION SMOKE TEST PLAN

Detay: `_docs/PRODUCTION_SMOKE_TEST_CHECKLIST.md`. Özet 30+ adım — login/dashboard/static, modül akışları, güvenlik blokları, Telegram dry-run KAPALI doğrulaması.

---

## 12. DEPLOY SEQUENCE PLAN

Detay: `_docs/PRODUCTION_DEPLOYMENT_PLAN.md`. 14 adım: server hazırlık → repo aktarımı → venv → requirements → .env → migrate → seed_roles + seed_settings + seed_notification_rules → createsuperuser → collectstatic → gunicorn/nginx/SSL → backup script → smoke → rollback anchor.

---

## 13. RISK REGISTER

### BLOCKER (deploy öncesi şart)

| # | Risk | Etkisi | Çözüm |
|---|---|---|---|
| **B1** | `requirements.txt` / `pyproject.toml` **yok** | Reproducible install imkânsız | `pip freeze > requirements.txt` (versiyon pin) — 1 commit |
| **B2** | `CSRF_TRUSTED_ORIGINS` `production.py`’de tanımsız | HTTPS form POST 403 verir, login dahil hiçbir form çalışmaz | `CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h]` |
| **B3** | Git repo initialize **edilmemiş** | Sürüm kontrolü yok, rollback anchor yok | `git init` + initial commit + `.gitignore` (db.sqlite3, media/, .env, staticfiles/) |
| **B4** | Document download **object-level permission** yok | Tüm authenticated kullanıcı tüm belgeleri indirebilir; KVKK riski | `DocumentDownloadView.get`’e `related_app/model/object_id` üzerinden yetki helper’ı |

### WARNING (deploy hazırlık fazında düzeltilmeli)

| # | Risk | Çözüm |
|---|---|---|
| W1 | `STATIC_ROOT` / `MEDIA_ROOT` / `PRIVATE_MEDIA_ROOT` path’leri plan ile uyumsuz | production.py path’lerini `/var/www/muhasebe-ops/...` ile hizala |
| W2 | `DATA_UPLOAD_MAX_MEMORY_SIZE` override yok, 100MB import’la çelişir | `DATA_UPLOAD_MAX_MEMORY_SIZE = 110*1024*1024` |
| W3 | nginx X-Accel-Redirect uygulanmamış (FileResponse stream) | İlk versiyonda kabul; v1.1’de patch |
| W4 | Logging sadece console | `RotatingFileHandler` `/var/log/muhasebe-ops/django.log` |
| W5 | `SECURE_REFERRER_POLICY` tanımsız | `SECURE_REFERRER_POLICY = "same-origin"` |
| W6 | Django **6.0.4** sürümü — 5.2 LTS yerine 6.x kullanımı | LTS kararı doğrulanmalı (proje belgeleri 5.2.14 söylüyordu) |
| W7 | Backup script ve systemd timer **henüz yazılmadı** | Deploy fazında kur |

### INFO (kabul edilen tasarım kararları)

| # | Konu |
|---|---|
| I1 | Manual-first; Celery/cron/APScheduler kasıtlı YOK |
| I2 | Telegram dry-run kasıtlı; gerçek gönderim Faz 15+ kararı |
| I3 | WebSocket yok; chat poll-based |
| I4 | PDF export yok (yalnız XLSX/CSV); Faz 15+ adayı |
| I5 | Object-level permission sınırlı (B4 dışında modül-level çalışıyor) |
| I6 | Mobile UI smoke testi manual gerekli (QA) |

---

## 14. ÖZET

| Sınıf | Sayı |
|---|---|
| ✅ PASS | 9 başlık (DB, modüller, UI, no-op, çekirdek security/auth, render guard, audit, soft-delete, brand) |
| ⚠ WARNING | 7 (path mismatch, file-upload limit, X-Accel, logging, referrer, Django ver., backup script) |
| ❌ BLOCKER | 4 (requirements, CSRF_TRUSTED_ORIGINS, git, document object-perm) |

---

## 15. FİNAL KARAR

> **PRODUCTION READINESS WARNING** — Küçük ama zorunlu düzeltmeler sonrası deploy hazırlığına geçilebilir.

### En kritik 5 risk
1. **B1** — `requirements.txt` yok → reproducible deploy imkânsız.
2. **B2** — `CSRF_TRUSTED_ORIGINS` yok → HTTPS form POST 403.
3. **B4** — Document download object-level permission yok → KVKK / yetkisiz erişim.
4. **B3** — Git repo yok → rollback/audit imkânsız.
5. **W1** — settings path’leri ↔ deployment plan path’leri uyumsuz → collectstatic / nginx serve hatası.

### Deploy’dan önce şart
- B1 → B4 BLOCKER’lar kapatılmalı.
- W1 path’ler hizalanmalı.
- W4 logging dosya handler’ı eklenmeli.
- `requirements.txt` ile birlikte minimum: `Django==<freeze>`, `psycopg[binary]`, `gunicorn`, `openpyxl`, `Pillow` (varsa).

### Bir sonraki önerilen faz
**Faz 15 — Production Hardening Patch (small):** 4 BLOCKER + 5 WARNING’i tek küçük PR’da kapat (kod değişikliği <200 satır), test suite 413/413 koru, ardından Faz 16 — Production Deploy (ortam kurulumu + smoke).

---

**Audit raporu sonu.** Diğer dosyalar:
- `_analysis/reports/PHASE14_PRODUCTION_READINESS_VERIFICATION.md`
- `_docs/PRODUCTION_DEPLOYMENT_PLAN.md`
- `_docs/PRODUCTION_SMOKE_TEST_CHECKLIST.md`
- `_docs/BACKUP_RESTORE_PLAN.md`
