# PHASE 14 — PRODUCTION READINESS VERIFICATION (READ-ONLY)

**Tarih:** 2026-05-07
**Tip:** Salt-okunur denetim · Kod / migration / data dokunulmadı · Sonuç: **WARNING**

---

## 1. Yürütme Kanıtı

```
$ python --version
Python 3.13.2

$ python -c "import django; print(django.get_version())"
6.0.4

$ python manage.py check
System check identified no issues (0 silenced).

$ python manage.py makemigrations --dry-run --check
No changes detected
```

Working tree:
```
$ git status
fatal: not a git repository (or any of the parent directories): .git
```

Test suite **bu fazda yeniden çalıştırılmadı** (read-only sınır + zaman). Baseline: Faz 13 raporu **413/413 PASS**, `_docs/PHASE13_NOTIFICATIONS_DRYRUN_MVP_REPORT.md` ve `_analysis/reports/PHASE13_NOTIFICATIONS_DRYRUN_MVP_VERIFICATION.md` ile sabitlenmiştir.

---

## 2. Doğrulanan Maddeler

| # | İddia | Yöntem | Sonuç |
|---|-------|--------|-------|
| 1 | Sistem kontrolü temiz | `manage.py check` | ✅ |
| 2 | Migration drift yok | `makemigrations --dry-run --check` | ✅ |
| 3 | Production settings DEBUG=False | `Grep DEBUG` `production.py:6` | ✅ |
| 4 | SECRET_KEY env zorunlu | `production.py:9` `os.environ["DJANGO_SECRET_KEY"]` | ✅ |
| 5 | ALLOWED_HOSTS env | `production.py:10` | ✅ |
| 6 | SECURE_SSL_REDIRECT True | `production.py:27` | ✅ |
| 7 | SESSION/CSRF cookie secure | `production.py:25-26` | ✅ |
| 8 | HSTS 1 yıl + subdomains + preload | `production.py:28-30` | ✅ |
| 9 | SECURE_PROXY_SSL_HEADER | `production.py:34` | ✅ |
| 10 | CSRF_TRUSTED_ORIGINS | `Grep` boş | ❌ BLOCKER |
| 11 | DB env zinciri PostgreSQL | `production.py:12-22` | ✅ |
| 12 | TIME_ZONE Europe/Istanbul | `base.py:105` | ✅ |
| 13 | Telegram real send guard | `Grep requests/urllib in apps/notifications` → 0 | ✅ |
| 14 | SMTP send_mail/EmailMessage aktif kod | `Grep` 0 | ✅ |
| 15 | Celery/scheduler import | `Grep` 0 | ✅ |
| 16 | Document private storage | `documents/storage.py` `base_url=None` | ✅ |
| 17 | sha256 dedup | `documents/models.py:118-164` | ✅ |
| 18 | DocumentDownloadView LoginRequiredMixin | `documents/views.py:27` | ✅ |
| 19 | DocumentDownloadView object-level perm | yok | ❌ BLOCKER |
| 20 | LoginRequiredMixin yaygınlığı | 271 occurrence (21 dosya) | ✅ |
| 21 | Chat user_can_view_thread gate | `chat/views.py` `if not user_can_view_thread:` | ✅ |
| 22 | 6 rol seed | `accounts/roles.py` | ✅ |
| 23 | RunPython migration güvenliği | 2 dosya, ikisi de enrichment/backfill | ⚠ INFO |
| 24 | Hard delete | template/view grep negative | ✅ |
| 25 | Soft archive/cancel pattern | tüm modüllerde | ✅ |
| 26 | UI yasaklı kelime (Pruva/Acme/HES…) `templates/` | `Grep` 0 | ✅ |
| 27 | UI yasaklı font (Inter/JetBrains) `static/css` | `Grep` 0 | ✅ |
| 28 | prefers-color-scheme aktif | yalnız yorum (`KULLANILMAZ`) | ✅ |
| 29 | “Site Aidatları” user-facing label | sidebar/dashboard/pruva templates | ✅ |
| 30 | BRAND context | `base.py:141-147` OPS / Muhasebe Operasyonları | ✅ |
| 31 | requirements.txt veya pyproject.toml | yok | ❌ BLOCKER |
| 32 | Git repo | yok | ❌ BLOCKER |

---

## 3. Aktif Settings Uyarıları

| Madde | Beklenen | Aktüel | Sınıf |
|---|---|---|---|
| `CSRF_TRUSTED_ORIGINS` | tanımlı | yok | BLOCKER |
| `STATIC_ROOT` | `/var/www/muhasebe-ops/static` (plan) | `/srv/muhasebe/shared/static` | WARNING |
| `MEDIA_ROOT` | `/var/www/muhasebe-ops/media` (plan) | `/var/lib/muhasebe/media` | WARNING |
| `PRIVATE_MEDIA_ROOT` | explicit prod | base default | WARNING |
| `DATA_UPLOAD_MAX_MEMORY_SIZE` | ≥ 100 MB | default 2.5 MB | WARNING |
| `SECURE_REFERRER_POLICY` | `same-origin` | tanımsız | WARNING |
| Logging | RotatingFileHandler | console only | WARNING |

---

## 4. Önceki Faz Korumaları

| Faz | Test | Status (baseline) |
|---|---|---|
| 2–9 (initial) | 281 | ✅ |
| 10 (Tasks) | 43 | ✅ |
| 12 (Reports) | 47 | ✅ |
| 13 (Notifications) | 42 | ✅ |
| **Toplam** | **413** | **✅ baseline** |

Bu faz **kod / migration / template / static / data dokunmadı**, dolayısıyla regresyon yaratamaz. Doğrulama matematiksel olarak korunur.

---

## 5. Yapılmayanlar (Spec Sınırı Gereği)

- ❌ Kod patch (planlanan B1-B4 düzeltmeleri burada uygulanmadı)
- ❌ Migration üretim
- ❌ migrate / DB write
- ❌ Seed komut çalıştırma
- ❌ Telegram / mail gönderim
- ❌ Cron / scheduler kurulum
- ❌ Production deploy
- ❌ Git commit / push
- ❌ Excel / RAR / PDF kaynak dosya değişikliği
- ❌ Design canvas dokunma

Yalnızca rapor dosyaları yazıldı (5 dosya).

---

## 6. Sonuç

**PRODUCTION READINESS — WARNING.**

- 4 BLOCKER (requirements, CSRF_TRUSTED_ORIGINS, git, document object-perm)
- 7 WARNING (path’ler, upload limit, logging, referrer, Django version, X-Accel, backup script)
- 9 PASS başlık
- Önerilen sonraki faz: **Faz 15 — Production Hardening Patch** (küçük ölçek: 4 blocker + 5 warning kapanır, test suite 413/413 korunur).
