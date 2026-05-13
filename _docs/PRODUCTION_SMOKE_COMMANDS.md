# PRODUCTION SMOKE COMMANDS

**Faz 16 — Production Deploy Prep.**
Sunucuda deploy sonrası elle çalıştırılır. Hiçbir komut bu repo dışında otomatik tetiklenmez.

---

## 0. Ön koşul

```bash
sudo -iu slc
cd /var/www/muhasebe-ops/repo/backend
source /var/www/muhasebe-ops/venv/bin/activate
set -a; . /etc/muhasebe-ops/.env; set +a
```

---

## 1. Django sağlığı

```bash
python manage.py check --deploy
python manage.py makemigrations --check --dry-run    # "No changes detected" beklenir
python manage.py showmigrations | tail -n 30
```

## 2. Statik & path

```bash
ls -lh /var/www/muhasebe-ops/static/ | head
ls -ld /var/www/muhasebe-ops/private_media
ls -ld /var/log/muhasebe-ops
ls -ld /var/backups/muhasebe-ops
```

## 3. DB bağlantısı (read-only)

```bash
python - <<'PY'
import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE","config.settings.production")
django.setup()
from django.contrib.auth import get_user_model
print("users:", get_user_model().objects.count())
from apps.audit.models import AuditLog
print("audit:", AuditLog.objects.count())
PY
```

## 4. HTTP smoke (yeni terminal)

```bash
curl -kI https://muhasebe.example.com/                # 302 -> /accounts/login/
curl -kI https://muhasebe.example.com/accounts/login/ # 200
curl -kI https://muhasebe.example.com/static/admin/css/base.css   # 200
curl -k  https://muhasebe.example.com/healthz 2>/dev/null | head  # opsiyonel
```

## 5. Gunicorn / systemd

```bash
sudo systemctl status --no-pager muhasebe-ops-gunicorn.service | head -n 20
journalctl -u muhasebe-ops-gunicorn.service -n 50 --no-pager
```

## 6. Nginx

```bash
sudo nginx -t
sudo tail -n 20 /var/log/nginx/muhasebe-ops.error.log
```

## 7. Login + indirme (manuel — tarayıcı)

1. https://muhasebe.example.com/accounts/login/ → super_admin login
2. Anasayfa "Site Aidatları" kartı görünür mü?
3. Bir belge indir → 200 + audit_log VIEW kaydı
4. Logout → tekrar indirme → 302 login

## 8. Backup script smoke (DRY)

```bash
bash -n /var/www/muhasebe-ops/repo/backend/scripts/backup.sh
# Gerçek çalıştırma sadece systemd timer üzerinden 03:30
```

## 9. Telegram / mail kapalı doğrulama

```bash
python - <<'PY'
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE","config.settings.production")
django.setup()
from django.conf import settings
print("EMAIL_BACKEND:", settings.EMAIL_BACKEND)
print("TELEGRAM_REAL_SEND_ENABLED:", getattr(settings,"TELEGRAM_REAL_SEND_ENABLED", None))
PY
# EMAIL_BACKEND=...dummy.EmailBackend
# TELEGRAM_REAL_SEND_ENABLED=False
```

---

## Başarı kriteri

Tüm 9 adım hata vermeden tamamlanır → Production CANLI kabul.
Aksi → `_docs/PRODUCTION_ROLLBACK_PLAN.md`.
