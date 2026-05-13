# PHASE 17A — STAGING DRY-RUN / DEPLOY PROVA REPORT

**Tarih:** 2026-05-07
**Sınıflandırma:** ⚠️ **WARNING** — Lokal hazırlık PASS, ancak gerçek staging dry-run YAPILMADI (remote ortam verilmedi). Production'a geçmeden önce operatörün staging üzerinde `_docs/STAGING_EXECUTION_COMMANDS.md` paketini koşması zorunludur.

---

## 0. Yönetici özeti

- **Lokal precheck:** PASS
- **Script syntax (`bash -n`):** PASS x2
- **Deploy guard runtime testi:** PASS — `CONFIRM_DEPLOY` yokken script `exit 2` ile durur
- **Production settings import + env override:** PASS — tüm güvenlik knob'ları beklenen değerlerde
- **Phase 15 odaklı test alt kümesi:** 36/36 PASS (regresyon yok)
- **Config taslakları (systemd / nginx / gunicorn / production.py):** PASS
- **Remote staging:** **NOT PROVIDED** → `_docs/STAGING_EXECUTION_COMMANDS.md` operatöre devredildi
- **Production preflight evrakı:** Yeni `_docs/PRODUCTION_PREFLIGHT_CHECKLIST.md` üretildi
- **Spec sınırı:** Hiçbir gerçek deploy / migrate / DB write / Telegram / mail / commit / push yapılmadı

---

## 1. Lokal Precheck Sonuçları

```
$ pwd
/c/Users/lenovo/Desktop/muhasebe-operasyon-seed

$ git status --short
?? .gitignore
?? _analysis/
?? _docs/
?? backend/
?? deploy/
?? design-canvas.jsx
?? preview/

$ python --version
Python 3.13.2

$ python manage.py check
System check identified no issues (0 silenced).

$ python manage.py makemigrations --dry-run --check
No changes detected

$ bash -n backend/scripts/deploy.sh && echo OK   → DEPLOY_OK
$ bash -n backend/scripts/backup.sh && echo OK   → BACKUP_OK
```

| Kontrol | Sonuç |
|---|---|
| Proje root | ✅ |
| Git repo (init, no commits) | ✅ |
| Python 3.13.2 | ✅ |
| `manage.py check` | ✅ (0 issue) |
| `makemigrations --dry-run` | ✅ (no changes) |
| `bash -n deploy.sh` | ✅ |
| `bash -n backup.sh` | ✅ |
| Production settings import | ✅ |
| `.env.production.example` secret-free | ✅ (yalnız `<placeholder>`) |

---

## 2. Test Sonucu

Faz 15 baseline 449/449 PASS (önceki fazda kanıtlandı). Bu fazda zaman tasarrufu için **deploy/security odaklı `tests/test_phase15.py` alt kümesi** çalıştırıldı:

```
$ python manage.py test tests.test_phase15 -v 0
Ran 36 tests in 46.346s
OK
```

| Sınıf | Test sayısı | Sonuç |
|---|---|---|
| RequirementsTxtTest | 2 | ✅ |
| GitignoreTest | 2 | ✅ |
| BackupScriptTest | 4 | ✅ |
| ProductionSettingsTest | 8 | ✅ |
| DocumentPermission*Test | 14 | ✅ |
| DocumentDownloadViewPermissionTest | 4 | ✅ |
| TelegramRealSendStillDisabledTest | 1 | ✅ |
| MakemigrationsCleanTest | 1 | ✅ |
| **Toplam** | **36** | **✅** |

Regresyon yok. Tam suite (449) bu fazda tekrar koşulmadı; baseline son 1 hafta içinde Faz 15'de doğrulandı.

---

## 3. Deploy Script Guard Kontrolü (`backend/scripts/deploy.sh`)

| Madde | Bulgu |
|---|---|
| `set -euo pipefail` | ✅ satır 15 |
| `IFS=$'\n\t'` | ✅ satır 16 |
| `CONFIRM_DEPLOY=yes` guard | ✅ satır 19–22 (yokken `exit 2`) |
| Pre-flight (REPO_DIR/VENV_DIR/ENV_FILE/manage.py) | ✅ satır 33–36 |
| Path env override (`DEPLOY_ROOT`, `REPO_DIR`, `VENV_DIR`, `ENV_FILE`, `SERVICE_NAME`) | ✅ satır 25–29 |
| Hata yakalama (set -e) | ✅ pipefail aktif |
| Secret loglama riski | ✅ yok — env yalnız `set -a; . "$ENV_FILE"; set +a` ile yüklenir; print/log yok |
| Migrate/collectstatic/seed guard öncesi tetikleniyor mu | ❌ HAYIR — guard reddederse hiçbir şey çalışmaz |

**Runtime kanıt:**
```
$ bash deploy.sh
ABORT: CONFIRM_DEPLOY=yes değil. Deploy iptal.
EXIT=2
```

Guard'ı geçmek için **bilinçli** `CONFIRM_DEPLOY=yes` gerekir. Sonuç: **PASS**.

---

## 4. Config Taslakları Kontrolü

### 4.1 `backend/config/settings/production.py`
| Knob | Değer | Beklenen | Sonuç |
|---|---|---|---|
| `DEBUG` | False | False | ✅ |
| `EMAIL_BACKEND` | `django.core.mail.backends.dummy.EmailBackend` | dummy | ✅ |
| `TELEGRAM_REAL_SEND_ENABLED` | False | False | ✅ |
| `CSRF_TRUSTED_ORIGINS` | env veya ALLOWED_HOSTS'tan https türev | doğru | ✅ |
| `SECURE_REFERRER_POLICY` | `same-origin` | same-origin | ✅ |
| `SECURE_SSL_REDIRECT` | True (env override) | True | ✅ |
| `SECURE_HSTS_SECONDS` | 31536000 | 1y | ✅ |
| `DATA_UPLOAD_MAX_MEMORY_SIZE` | 115343360 (110MB) | 110MB | ✅ |
| `STATIC_ROOT/MEDIA_ROOT/PRIVATE_MEDIA_ROOT` | `DEPLOY_ROOT` türevli | env-driven | ✅ |
| `LOGGING` | RotatingFileHandler graceful | yes | ✅ |

### 4.2 `deploy/systemd/muhasebe-ops-gunicorn.service`
| Direktif | Değer | Sonuç |
|---|---|---|
| `Type=notify` | ✅ | ✅ |
| `User=slc / Group=slc` | ✅ | ✅ |
| `EnvironmentFile=/etc/muhasebe-ops/.env` | ✅ | ✅ |
| `WorkingDirectory=/var/www/muhasebe-ops/repo/backend` | ✅ | ✅ |
| Hardening (`NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome`, `PrivateTmp`, `ReadWritePaths`) | ✅ | ✅ |
| `Restart=on-failure` | ✅ | ✅ |

### 4.3 `deploy/nginx/muhasebe-ops.conf`
| Madde | Değer | Sonuç |
|---|---|---|
| 80→443 redirect | ✅ | ✅ |
| `client_max_body_size 110m` | ✅ (Django uyumlu) | ✅ |
| `/static/` alias | `/var/www/muhasebe-ops/static/` | ✅ |
| `/media/` alias | `/var/www/muhasebe-ops/media/` | ✅ |
| `private_media` nginx public servisi | ❌ YOK (yalnız Django üzerinden) | ✅ |
| Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) | ✅ | ✅ |
| TLSv1.2/1.3 | ✅ | ✅ |

### 4.4 `deploy/gunicorn/gunicorn.conf.py`
| Param | Değer | Sonuç |
|---|---|---|
| `bind` | 127.0.0.1:8001 (env override) | ✅ |
| `workers` | 3 (env override) | ✅ — küçük örgüt için makul |
| `timeout` | 60 | ✅ |
| `max_requests` | 1000 + jitter | ✅ |
| `worker_tmp_dir` | `/dev/shm` | ✅ |
| `loglevel` | info | ✅ |

---

## 5. Remote Staging Durumu

**REMOTE STAGING NOT PROVIDED.**

Kullanıcı staging sunucu/VM bilgisi sağlamadı. Bu nedenle:
- ❌ Staging OS / Python / PostgreSQL kontrolü yapılmadı
- ❌ Klasör/permission kurulumu yapılmadı
- ❌ Fresh DB migrate yapılmadı
- ❌ Seed komutları idempotency testi yapılmadı
- ❌ collectstatic + static smoke yapılmadı
- ❌ App smoke (login/upload/download/report/chat/notification) yapılmadı
- ❌ Security smoke (viewer 403, anonim redirect) yapılmadı
- ❌ Backup script gerçek pg_dump üretmedi
- ❌ Restore drill yapılmadı
- ❌ Rollback drill yapılmadı

Bunların yerine:
- ✅ `_docs/STAGING_EXECUTION_COMMANDS.md` üretildi (18 bölüm × ortalama 3–6 komut, operatör elle koşar)
- ✅ `_docs/STAGING_DRY_RUN_CHECKLIST.md` "Faz 17A execution notes" bölümü ile güncellendi
- ✅ `_docs/PRODUCTION_PREFLIGHT_CHECKLIST.md` üretildi (12 bölüm A–L, son onay)

---

## 6. Risk Register

### BLOCKER (0 adet)
*(yok)*

### WARNING (4 adet)

| # | Risk | Detay | Aksiyon |
|---|---|---|---|
| W1 | Remote staging dry-run yapılmadı | Sadece lokal sanity; gerçek migrate/seed/smoke kanıtı yok | Operatör staging VM'de `STAGING_EXECUTION_COMMANDS.md` koşmalı |
| W2 | Tam test suite (449) bu fazda yeniden çalıştırılmadı | Faz 15 baseline geçerli, ancak son tarih 2026-05-07 | Faz 17B veya production preflight'ta tam suite tekrarı önerilir |
| W3 | `git commit` hâlâ yok | 7 untracked, history yok | İlk anlamlı commit Faz 17B veya production tag öncesi atılmalı |
| W4 | systemd backup timer unit'i taslak yok | `backup.sh` mevcut ama timer unit'i bu fazda üretilmedi | Faz 17B'de `muhasebe-ops-backup.timer` + `.service` eklenmeli |

### INFO (5 adet)
- Telegram dry-run bilinçli (manual-first stratejisi)
- DB-backed chat bilinçli (WebSocket yok)
- PDF export yok bilinçli (Excel only)
- Scheduler / Celery yok bilinçli (manual-first)
- Eski Excel import ertelenmiş bilinçli (Faz 18+)

---

## 7. Çıktı Dosyaları

| # | Dosya | Tür |
|---|---|---|
| 1 | `_docs/PHASE17A_STAGING_DRYRUN_REPORT.md` | bu dosya |
| 2 | `_analysis/reports/PHASE17A_STAGING_DRYRUN_VERIFICATION.md` | doğrulama |
| 3 | `_docs/STAGING_EXECUTION_COMMANDS.md` | operatör komut paketi (18 bölüm) |
| 4 | `_docs/PRODUCTION_PREFLIGHT_CHECKLIST.md` | A–L final onay |
| 5 | `_docs/STAGING_DRY_RUN_CHECKLIST.md` | "Faz 17A execution notes" eklendi |

---

## 8. Sınır / No-op Doğrulaması

| Kural | Durum |
|---|---|
| Production sunucuya bağlanma | ❌ yapılmadı |
| Production DB'ye bağlanma | ❌ yapılmadı |
| Production migrate/seed/deploy | ❌ yapılmadı |
| Gerçek domain / SSL | ❌ yok |
| Telegram real send | ❌ kapalı + env'de override |
| SMTP/mail | ❌ dummy backend |
| Cron / scheduler | ❌ yok |
| Production secret yazma/gösterme | ❌ yalnız `<placeholder>` |
| commit / push | ❌ yapılmadı |
| Kaynak Excel/RAR/PDF dokunma | ❌ yapılmadı |
| Design canvas dokunma | ❌ yapılmadı |
| Remote SSH / staging | ❌ verilmediği için yapılmadı |

---

## 9. Faz 17B / 18 Önerisi

**Önerilen sıralama:**
1. **Operatör tarafı:** `STAGING_EXECUTION_COMMANDS.md` koşulması (18 bölüm).
2. **Faz 17B — Production Preflight:**
   - Operatörün staging log'u eklenir
   - W4 (backup systemd timer unit) kapatılır
   - W3 (initial commit / repo tag) kapatılır
   - W2 (tam test suite tekrarı) kapatılır
   - `PRODUCTION_PREFLIGHT_CHECKLIST.md` A–L imzalanır
3. **Faz 18 — Production Deploy:**
   - Operatör onayıyla gerçek production deploy
   - `deploy.sh` `CONFIRM_DEPLOY=yes` ile koşulur
   - `PRODUCTION_SMOKE_COMMANDS.md` 1–9 koşulur
4. **Faz 19+ (sonraki yol):** Eski Excel import migrasyonu / X-Accel-Redirect / WebSocket chat / scheduler.

---

## 10. Sonuç

**STAGING DRY-RUN — WARNING.**

- 0 BLOCKER
- 4 WARNING (en kritiği remote staging yokluğu)
- 5 INFO (bilinçli ertelemeler)
- 36/36 hedefli test PASS
- Tüm config taslakları staging uyumlu
- Lokal hazırlık tam; sadece operatörün gerçek staging koşumu eksik

Production deploy'a **direkt geçilmez**; önce Faz 17B preflight + W1–W4 kapatma.
