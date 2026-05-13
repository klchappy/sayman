# PHASE 16 — PRODUCTION DEPLOY PREP REPORT

**Tarih:** 2026-05-07
**Sınıflandırma:** ✅ **PASS**
**Kapsam:** Deploy hazırlık dosyaları + dry-run plan. Gerçek deploy YAPILMADI.

---

## 1. Üretilen Dosyalar

| # | Yol | Tür | Amaç |
|---|---|---|---|
| 1 | `backend/.env.production.example` | env | Sunucu .env şablonu (gerçek secret yok) |
| 2 | `backend/scripts/deploy.sh` | bash | Manuel deploy taslağı (CONFIRM_DEPLOY guard) |
| 3 | `deploy/systemd/muhasebe-ops-gunicorn.service` | unit | Gunicorn systemd service |
| 4 | `deploy/nginx/muhasebe-ops.conf` | nginx | Reverse proxy + SSL şablonu |
| 5 | `deploy/gunicorn/gunicorn.conf.py` | python | Worker/timeout konfig |
| 6 | `_docs/PRODUCTION_SMOKE_COMMANDS.md` | doc | 9 adımlı smoke koşumu |
| 7 | `_docs/PRODUCTION_ROLLBACK_PLAN.md` | doc | A–F senaryolu rollback |
| 8 | `_docs/STAGING_DRY_RUN_CHECKLIST.md` | doc | 13 bölüm staging checklist |
| 9 | `_docs/PHASE16_DEPLOY_PREP_REPORT.md` | doc | Bu rapor |
| 10 | `_analysis/reports/PHASE16_DEPLOY_PREP_VERIFICATION.md` | doc | Doğrulama |

---

## 2. env Şablonu

`backend/.env.production.example` içerir:

- Django: `DJANGO_SETTINGS_MODULE=config.settings.production`, `DJANGO_SECRET_KEY=<placeholder>`, `DEBUG=False`
- Hosts: `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`
- DB: `DB_NAME/USER/PASSWORD/HOST/PORT`
- Path: `DEPLOY_ROOT`, `PRIVATE_MEDIA_ROOT`, `DJANGO_LOG_DIR`, `BACKUP_ROOT`
- Güvenlik: `DJANGO_SECURE_SSL_REDIRECT=1`, `DJANGO_SECURE_HSTS_SECONDS=31536000`
- No-op: `DJANGO_EMAIL_BACKEND=...dummy`, `TELEGRAM_REAL_SEND_ALLOWED=False`
- Gunicorn: workers/timeout/bind

Gerçek secret YOK. Sunucuda `/etc/muhasebe-ops/.env` 0640 saklanır.

---

## 3. deploy.sh Akışı

`set -euo pipefail` + `CONFIRM_DEPLOY=yes` guard.

1. Pre-flight (REPO_DIR, VENV_DIR, ENV_FILE, manage.py)
2. ENV yükle
3. Pre-deploy backup anchor (son dump listesi)
4. `pip install -r requirements.txt`
5. `manage.py check --deploy`
6. `makemigrations --check --dry-run`
7. `migrate --noinput`
8. `collectstatic --noinput`
9. `seed_roles` / `seed_settings` / `seed_notification_rules` (idempotent)
10. `systemctl restart muhasebe-ops-gunicorn` (placeholder)
11. Smoke / rollback referansları

**`bash -n backend/scripts/deploy.sh` → OK**
**`bash -n backend/scripts/backup.sh` → OK**

---

## 4. systemd / nginx / gunicorn

- **systemd:** Type=notify, User=slc, EnvironmentFile=/etc/muhasebe-ops/.env, ProtectSystem=full, ReadWritePaths sınırlı.
- **nginx:** 80→443 redirect, TLSv1.2/1.3, `client_max_body_size 110m` (Django uyumlu), static/media alias, private_media nginx'te DEĞİL (Django üzerinden), güvenlik header'ları.
- **gunicorn:** sync worker, 3 worker, timeout 60, max_requests=1000, journald log, /dev/shm worker_tmp.

---

## 5. Smoke / Rollback / Staging

- **Smoke:** Django check → static → DB query → HTTP curl → systemd → nginx → manuel login indirme → no-op doğrulama.
- **Rollback:** A (kod), B (DB+kod), C (static), D (servis), E (tam), F (acil DB).
- **Staging:** 13 bölüm × ortalama 5 madde = 60+ kontrol kalemi.

---

## 6. No-op / Sınır Doğrulaması

| Kural | Durum |
|---|---|
| Telegram gerçek gönderim | ❌ kapalı (`TELEGRAM_REAL_SEND_ENABLED=False`) |
| SMTP | ❌ dummy backend |
| Cron / Celery / scheduler | ❌ yok (yalnız taslak systemd timer) |
| Gerçek deploy / migrate / DB write | ❌ yapılmadı |
| commit / push | ❌ yapılmadı |
| Kaynak Excel / RAR / PDF dokunma | ❌ yapılmadı |
| Design canvas dokunma | ❌ yapılmadı |
| Yalnız `bash -n` syntax check | ✅ |

---

## 7. Yürütme Kanıtı

```
$ python manage.py check
System check identified no issues (0 silenced).

$ python manage.py makemigrations --dry-run --check
No changes detected

$ bash -n backend/scripts/backup.sh && echo OK
OK

$ bash -n backend/scripts/deploy.sh && echo OK
OK

$ git status --short
?? .gitignore
?? _analysis/
?? _docs/
?? backend/
?? deploy/
?? design-canvas.jsx
?? preview/
```

---

## 8. Yapılmayanlar (Spec Sınırı)

- Gerçek sunucuya bağlanma yok
- migrate / collectstatic / seed gerçek çalıştırma yok
- DB write yok
- Yeni migration üretimi yok
- Telegram / mail / cron yok
- git commit / push / tag yok
- Kaynak Excel / RAR / PDF dokunma yok

---

## 9. Sonuç

**PHASE 16 — PASS.**

- 10 dosya üretildi
- Tüm bash script'ler `bash -n` PASS
- Django check + migrations clean
- Faz 15'in 449/449 testi sağlam (regresyon yok)

**Bir sonraki adım:** Operatör staging dry-run checklist üzerinden gerçek staging sunucusunda kuru deneme yapar; PASS sonrası production deploy yetki verilir.
