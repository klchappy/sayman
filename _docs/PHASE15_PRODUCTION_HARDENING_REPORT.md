# PHASE 15 — PRODUCTION HARDENING PATCH REPORT

**Tarih:** 2026-05-07
**Tip:** Lokal kod/config sertleştirmesi · Migration yok · DB write yok · Deploy yok
**Önceki:** Faz 14 Production Readiness Audit → WARNING (4 BLOCKER + 7 WARNING)
**Hedef:** 4 BLOCKER + 5 öncelikli WARNING'i kontrollü patch ile kapatmak.

---

## 1. Özet

| Sınıf | Faz 14 | Faz 15 sonu |
|---|---|---|
| BLOCKER | 4 | **0** |
| Öncelikli WARNING | 5 | **0** |
| INFO/Tasarım | 6 | 6 (değişmedi — bilinçli) |
| Toplam test | 413 | **449** (+36 phase15) |
| `manage.py check` | ✅ | ✅ |
| `makemigrations --dry-run --check` | clean | clean |

---

## 2. Faz 14 BLOCKER Kapanış Tablosu

| Kod | Risk | Çözüm | Doğrulama |
|---|---|---|---|
| **B1** | `requirements.txt` yok | `backend/requirements.txt` oluşturuldu (Django/openpyxl/psycopg/gunicorn pinli) | `RequirementsTxtTest` (2 test) |
| **B2** | `CSRF_TRUSTED_ORIGINS` tanımsız | `production.py` içinde env destekli, ALLOWED_HOSTS'tan türetimli mantık | `ProductionSettingsTest.test_csrf_trusted_origins_*` (2 test) |
| **B3** | Git repo yok | `git init` çalıştırıldı; `.gitignore` repo root'a eklendi | `GitignoreTest` (2 test) + `git status --short` |
| **B4** | Document download object-level perm yok | `apps/documents/permissions.py` + `DocumentDownloadView` PermissionDenied | `DocumentPermission*Test` (12 test) + `DocumentDownloadViewPermissionTest` (4 test) |

**4/4 BLOCKER kapandı.**

---

## 3. Öncelikli WARNING Kapanış Tablosu

| Kod | Risk | Çözüm | Doğrulama |
|---|---|---|---|
| **W1** | Path'ler plan ile uyumsuz | `production.py` `DEPLOY_ROOT=/var/www/muhasebe-ops`; STATIC_ROOT/MEDIA_ROOT/PRIVATE_MEDIA_ROOT türev | `ProductionSettingsTest.test_paths_align_with_deployment_plan` |
| **W2** | Upload limit yok | `DATA_UPLOAD_MAX_MEMORY_SIZE=110MB`, `FILE_UPLOAD_MAX_MEMORY_SIZE=25MB` | `ProductionSettingsTest.test_upload_limits` |
| **W3** | Logging yetersiz | RotatingFileHandler `/var/log/muhasebe-ops/app.log` (10MB×7) + console; yazılamazsa graceful fallback | `ProductionSettingsTest.test_logging_has_handlers` |
| **W4** | Referrer policy yok | `SECURE_REFERRER_POLICY="same-origin"` | `ProductionSettingsTest.test_secure_cookies_and_ssl` |
| **W5** | Backup script yok | `backend/scripts/backup.sh` (`set -euo pipefail`, pg_dump custom format, tar.gz, sha256sum, retention 7gün) | `BackupScriptTest` (4 test, `bash -n` PASS) |

**5/5 öncelikli WARNING kapandı.**

Kalan WARNING'ler:
- **W6** Django sürümü → bu raporda yazılı karar (aşağıda §6).
- **W7** X-Accel-Redirect → bilinçli olarak ertelendi (Faz 16+ optimizasyon).

---

## 4. Değiştirilen / Eklenen Dosyalar

### Yeni
| Dosya | Amaç |
|---|---|
| `backend/requirements.txt` | Pinli runtime bağımlılıkları |
| `backend/apps/documents/permissions.py` | `can_download_document(user, doc)` helper |
| `backend/scripts/backup.sh` | PostgreSQL + private_media yedekleme taslağı |
| `backend/tests/test_phase15.py` | 36 test (settings/permission/script/no-op) |
| `.gitignore` | Secret/build/cache dışlama |
| `_docs/PHASE15_PRODUCTION_HARDENING_REPORT.md` | Bu rapor |
| `_analysis/reports/PHASE15_PRODUCTION_HARDENING_VERIFICATION.md` | Doğrulama dosyası |

### Güncellenen
| Dosya | Değişiklik |
|---|---|
| `backend/config/settings/production.py` | Tam yeniden yazım: env-driven, CSRF/SECURITY hardened, path/logging/upload limit eklendi |
| `backend/apps/documents/views.py` | `DocumentDownloadView.get` içinde `can_download_document` çağrısı + denied audit log |

### Migration / Model
- **YOK** — bu fazda model alanı veya migration eklenmedi.

---

## 5. requirements.txt Özeti

```
Django==6.0.4
asgiref==3.11.1
sqlparse==0.5.5
tzdata==2026.1
openpyxl==3.1.5
et_xmlfile==2.0.0
psycopg[binary]>=3.1,<4
gunicorn>=21.2,<24
```

Lokal Windows dev makinesinde `psycopg` ve `gunicorn` yüklü değildir; canlı kuruluma gerekli oldukları için range belirtilmiş, sürüm freeze prod ortam kurulumunda netleşir. `selenium` / `playwright` / `docx2pdf` / `python-telegram-bot` kasıtlı **dahil edilmedi** — production runtime'da kullanılmaz.

---

## 6. Django Version Decision (W6)

**Mevcut:** Django 6.0.4 — `pip freeze` çıktısı.
**Karar:** Faz 15 itibarıyla **6.0.4 freeze edildi**.

| Risk | Değerlendirme |
|---|---|
| Django 6.x **LTS değildir** (6.2 LTS planlanan) | Bilinçli kabul; canlı sonrası izleme |
| Bağımlılıklar (psycopg 3) 6.x ile uyumlu | ✅ |
| Geri çekme planı | İhtiyaç halinde 5.2 LTS'e fallback için requirements.txt güncelleme + tam test koşulu yeterli — model değişikliği gerektirmez |

**Öneri:** Django **6.2 LTS** çıktığında (Nisan 2026 sonrası beklenen) bir hardening fazı daha planlayıp 6.2'ye geçilebilir. O zamana kadar 6.0.4 ile devam.

---

## 7. Document Permission Helper Davranışı

`apps.documents.permissions.can_download_document(user, doc)`:

Karar zinciri:
1. Kullanıcı authenticated değilse → False
2. `is_superuser` veya `yonetici` / `muhasebe_muduru` grubunda → True
3. `doc.uploaded_by == user` → True
4. ChatAttachment ise: kullanıcı thread participant'ıysa → True
5. TaskAttachment ise: kullanıcı `assigned_to` / `created_by` ise → True
6. Domain modülü (finance/pruva/properties/guarantees/integrators/subs/regular_payments/official_payments) belgesi ise + kullanıcı `can_write` → True
7. Aksi durumda → **False (default deny)**

DocumentDownloadView denied path'inde audit_log `action="VIEW"` `metadata={"result":"DENIED"}` yazılır; mevcut audit_log API'si değiştirilmedi.

---

## 8. Production Settings Güvenlik Ayarları

Aktif ayarlar (`production.py`):

| Ayar | Değer |
|---|---|
| `DEBUG` | `False` |
| `SECRET_KEY` | env zorunlu |
| `ALLOWED_HOSTS` | env split |
| `CSRF_TRUSTED_ORIGINS` | env veya ALLOWED_HOSTS'tan https türev |
| `SESSION_COOKIE_SECURE` | `True` |
| `CSRF_COOKIE_SECURE` | `True` |
| `SECURE_SSL_REDIRECT` | env, default `True` |
| `SECURE_HSTS_SECONDS` | env, default `31536000` (1 yıl) |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` |
| `SECURE_HSTS_PRELOAD` | `True` |
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` |
| `SECURE_REFERRER_POLICY` | `"same-origin"` |
| `X_FRAME_OPTIONS` | `"SAMEORIGIN"` |
| `SECURE_PROXY_SSL_HEADER` | `("HTTP_X_FORWARDED_PROTO", "https")` |
| `STATIC_ROOT` | `/var/www/muhasebe-ops/static` |
| `MEDIA_ROOT` | `/var/www/muhasebe-ops/media` |
| `PRIVATE_MEDIA_ROOT` | `/var/www/muhasebe-ops/private_media` |
| `REPORT_EXPORT_ROOT` | `<PRIVATE_MEDIA_ROOT>/reports` |
| `DATA_UPLOAD_MAX_MEMORY_SIZE` | 110 MB |
| `FILE_UPLOAD_MAX_MEMORY_SIZE` | 25 MB |
| `LOGGING` | console + RotatingFileHandler `/var/log/muhasebe-ops/app.log` (graceful fallback) |
| `EMAIL_BACKEND` | dummy default (Anayasa: SMTP no-op) |
| `TELEGRAM_REAL_SEND_ENABLED` | **False** (Anayasa) |

---

## 9. Git Init / .gitignore

```
$ git init
Initialized empty Git repository in C:/Users/lenovo/Desktop/muhasebe-operasyon-seed/.git/

$ git status --short
?? .gitignore
?? _analysis/
?? _docs/
?? backend/
?? design-canvas.jsx
?? preview/
```

Bu fazda **commit yapılmadı** (spec gereği). Faz 16 deploy fazında initial commit + tag atılacak.

`.gitignore` test edilen kritik girdiler:
- `.env`, `.env.*` (`!.env.example` istisna)
- `db.sqlite3*`, `*.sqlite3`
- `media/`, `private_media/`, `staticfiles/`
- `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.coverage`, `htmlcov/`
- `venv/`, `.venv/`
- `_source_data/` (kaynak Excel/RAR/PDF asla repo'ya girmez)
- `*.dump`, `*.tar.gz`, `*.bak`, `backups/`

`git ls-files --others --ignored --exclude-standard` çıktısı: `.venv/`, `.claude/`, `.pytest_cache/` doğru biçimde ignore ediliyor.

---

## 10. Backup Script (`backend/scripts/backup.sh`)

- `set -euo pipefail` strict mode
- `pg_dump -Fc` custom format
- `tar -czf` private_media
- `sha256sum` checksum dosyası
- `find -mtime +7 -delete` retention placeholder
- Secret yok; password env'e basılmaz (PGPASSFILE kullanımı önerilir)
- Syntax doğrulaması: `bash -n` PASS

Bu fazda script **çalıştırılmadı**, yalnız yazıldı.

---

## 11. Test Sonucu

```
$ python manage.py test
Ran 449 tests in 377.829s

OK
```

| Faz | Test | Sonuç |
|---|---|---|
| 1–9 | 281 | ✅ |
| 10 (Tasks) | 43 | ✅ |
| 12 (Reports) | 47 | ✅ |
| 13 (Notifications) | 42 | ✅ |
| **15 (Hardening — yeni)** | **36** | **✅** |
| **TOPLAM** | **449** | **✅** |

`manage.py check` PASS · `makemigrations --dry-run --check`: **No changes detected**.

Faz 15 testlerinin breakdown'u:
- RequirementsTxtTest (2)
- GitignoreTest (2)
- BackupScriptTest (4)
- ProductionSettingsTest (8)
- DocumentPermissionUploaderTest (4)
- DocumentPermissionHighRoleTest (3)
- DocumentPermissionDomainTest (2)
- DocumentPermissionChatTest (2)
- DocumentPermissionTaskTest (3)
- DocumentDownloadViewPermissionTest (4)
- TelegramRealSendStillDisabledTest (1)
- MakemigrationsCleanTest (1)

Önceki test sayısı 413 → değişmedi, hiç regresyon yok.

---

## 12. Kalan WARNING / INFO

| Kod | Durum | Plan |
|---|---|---|
| W6 — Django 6.0.4 | freeze accepted (yukarıda §6) | 6.2 LTS çıkışında ayrı hardening fazı |
| W7 — X-Accel-Redirect | INFO (Django stream çalışıyor) | Faz 17+ optimizasyon |
| I1 — Manual-first / Celery yok | bilinçli | — |
| I2 — Telegram dry-run | bilinçli | Faz 16+ kararı |
| I3 — WebSocket yok | bilinçli | — |
| I4 — PDF export yok | bilinçli | Faz 17+ |
| I5 — Object-level perm sınırlı (B4 kapandı) | INFO | Faz 17+ ek modüllerde genişletme |
| I6 — Mobile QA | INFO | Smoke checklist'e bağlı |

---

## 13. Yapılmadıkları (Spec Sınırı)

- ❌ Production server kurulumu
- ❌ migrate çalıştırma
- ❌ DB write
- ❌ Migration üretim
- ❌ Telegram / mail / cron
- ❌ Git commit / push (yalnız `git init`)
- ❌ Kaynak Excel/RAR/PDF değişikliği
- ❌ Design canvas dokunma

---

## 14. FİNAL KARAR

> **PRODUCTION HARDENING — PASS.**
> Faz 16 Production Deploy fazına geçilebilir.

- 4/4 BLOCKER kapatıldı
- 5/5 öncelikli WARNING kapatıldı
- 449/449 test PASS (önceki 413 → korundu, yeni 36 eklendi)
- `manage.py check` ve `makemigrations --check` temiz
- Migration üretilmedi
- Telegram / mail / cron / WebSocket yok
- Commit / push / deploy yapılmadı

### Bir sonraki faz
**Faz 16 — Production Deploy** (`_docs/PRODUCTION_DEPLOYMENT_PLAN.md`'a göre):
1. Sunucu hazırlama (Ubuntu 24.04 + paketler)
2. PostgreSQL DB/user
3. Path yapısı + muhasebe-ops sistem kullanıcısı
4. Repo aktarımı (`git clone` veya tar)
5. venv + `pip install -r requirements.txt`
6. `.env` (gizli)
7. `collectstatic`
8. `migrate`
9. `seed_roles`, `seed_settings`, `seed_notification_rules`
10. `createsuperuser`
11. gunicorn systemd
12. nginx + SSL
13. Backup timer
14. Smoke test (`PRODUCTION_SMOKE_TEST_CHECKLIST.md`)
15. Initial git tag + DB/media snapshot (rollback anchor)
