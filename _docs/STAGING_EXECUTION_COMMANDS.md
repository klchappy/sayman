# STAGING EXECUTION COMMANDS

**Faz 17A — Staging Dry-Run.**
Bu doküman, staging sunucu/VM erişimi sağlandığında **operatör tarafından elle** sırayla çalıştırılacak komut paketidir. Otomatik koşulmaz; her bölümün çıktısı kayıt altına alınır.

> **Status:** REMOTE STAGING NOT PROVIDED. Komutlar burada hazır; uygulama operatör onayı gerektirir.

Hedef topoloji:
- OS: Ubuntu 22.04+ / Debian 12+
- Python: 3.13.x
- PostgreSQL: 14+
- Servis kullanıcı: `slc:slc`
- Tek node, IP-only veya geçici DNS

---

## 0. Sistem ön bilgi

```bash
hostnamectl
uname -a
python3 --version
psql --version
df -h /var
timedatectl | grep -E 'Time zone|System clock'
```

## 1. Sistem paketleri

```bash
sudo apt-get update
sudo apt-get install -y python3.13 python3.13-venv python3.13-dev \
    build-essential libpq-dev postgresql nginx certbot python3-certbot-nginx
```

## 2. Kullanıcı + klasörler

```bash
sudo useradd -r -m -s /bin/bash slc || true
sudo mkdir -p /var/www/muhasebe-ops \
              /var/log/muhasebe-ops \
              /var/backups/muhasebe-ops/{db,media,log,checksums} \
              /etc/muhasebe-ops
sudo chown -R slc:slc /var/www/muhasebe-ops /var/log/muhasebe-ops /var/backups/muhasebe-ops
sudo chmod 750 /etc/muhasebe-ops
```

## 3. PostgreSQL DB + kullanıcı

```bash
sudo -u postgres psql <<'SQL'
CREATE USER muhasebe WITH PASSWORD '<set-staging-password>';
CREATE DATABASE muhasebe OWNER muhasebe ENCODING 'UTF8' LC_COLLATE='tr_TR.UTF-8' LC_CTYPE='tr_TR.UTF-8' TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE muhasebe TO muhasebe;
SQL
```

`.pgpass` (slc kullanıcısı):
```bash
sudo -u slc bash -c 'umask 077; cat > ~/.pgpass <<EOF
127.0.0.1:5432:muhasebe:muhasebe:<set-staging-password>
EOF'
```

## 4. Repo + venv

```bash
sudo -iu slc
git clone <repo-url> /var/www/muhasebe-ops/repo   # veya rsync ile
python3.13 -m venv /var/www/muhasebe-ops/venv
/var/www/muhasebe-ops/venv/bin/pip install --upgrade pip
/var/www/muhasebe-ops/venv/bin/pip install -r /var/www/muhasebe-ops/repo/backend/requirements.txt
```

## 5. .env (gizli)

```bash
sudo install -m 0640 -o slc -g slc /dev/null /etc/muhasebe-ops/.env
sudo -e /etc/muhasebe-ops/.env   # backend/.env.production.example baz alınır
```

## 6. Django sağlığı

```bash
source /var/www/muhasebe-ops/venv/bin/activate
set -a; . /etc/muhasebe-ops/.env; set +a
cd /var/www/muhasebe-ops/repo/backend
python manage.py check --deploy
python manage.py makemigrations --check --dry-run    # No changes detected
```

## 7. Migrate (boş staging DB)

```bash
python manage.py migrate --noinput
python manage.py showmigrations | tail -n 30
```

## 8. Seedler (idempotent)

```bash
python manage.py seed_roles
python manage.py seed_settings
python manage.py seed_notification_rules

# 2. çağrı — idempotency kontrol
python manage.py seed_roles
python manage.py seed_settings
python manage.py seed_notification_rules
```

## 9. Statik

```bash
python manage.py collectstatic --noinput
ls /var/www/muhasebe-ops/static | head
```

## 10. Superuser (staging-only test hesabı)

```bash
python manage.py createsuperuser
```

## 11. systemd unit + nginx

```bash
sudo cp /var/www/muhasebe-ops/repo/deploy/systemd/muhasebe-ops-gunicorn.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now muhasebe-ops-gunicorn.service
sudo systemctl status --no-pager muhasebe-ops-gunicorn | head -n 15

sudo cp /var/www/muhasebe-ops/repo/deploy/nginx/muhasebe-ops.conf /etc/nginx/sites-available/muhasebe-ops
sudo ln -sf /etc/nginx/sites-available/muhasebe-ops /etc/nginx/sites-enabled/muhasebe-ops
sudo nginx -t && sudo systemctl reload nginx
```

## 12. Smoke (HTTP)

```bash
curl -kI http://staging.local/                    # 301 -> https
curl -kI https://staging.local/accounts/login/    # 200
curl -kI https://staging.local/static/admin/css/base.css   # 200
```

## 13. App smoke (manuel — tarayıcı)

- super_admin login
- Dashboard "Site Aidatları" kartı
- Fatura create
- Belge upload + indirme (audit_log kontrol)
- Görev create + belge ek
- Chat mesaj + dosya
- Bildirim manuel tetikleyici (Telegram dry-run logu)
- Site Aidatları ekstre → Payable
- Emlak taksit → Payable
- Teminat komisyon → Payable
- Entegratör kontör → Payable
- Rapor export (Excel)

## 14. Security smoke

```bash
# viewer hesabı oluştur (admin UI'dan), aşağıdakileri TARAYICIDAN dene:
# - viewer fatura create -> 403
# - viewer rapor export -> 403
# - viewer belge indirme (yetkisiz) -> 403 + audit DENIED
# - chat non-participant download -> 403
# - anonim indirme -> 302 login
```

```bash
# Telegram / mail kapalı doğrulama
python - <<'PY'
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE","config.settings.production")
django.setup()
from django.conf import settings
assert settings.EMAIL_BACKEND.endswith("dummy.EmailBackend")
assert settings.TELEGRAM_REAL_SEND_ENABLED is False
print("OK no-op guards intact")
PY
```

## 15. Backup script dry-run

```bash
sudo bash -n /var/www/muhasebe-ops/repo/backend/scripts/backup.sh && echo OK

# Gerçek çağrı (boş DB üzerinde güvenli):
sudo -iu slc env DB_NAME=muhasebe DB_USER=muhasebe \
    PRIVATE_MEDIA_ROOT=/var/www/muhasebe-ops/private_media \
    BACKUP_ROOT=/var/backups/muhasebe-ops \
    bash /var/www/muhasebe-ops/repo/backend/scripts/backup.sh

ls -lh /var/backups/muhasebe-ops/db/
sha256sum -c /var/backups/muhasebe-ops/checksums/*.sha256
```

## 16. Restore drill (AYRI boş staging DB üzerine)

```bash
sudo -u postgres psql -c 'CREATE DATABASE muhasebe_restore_test OWNER muhasebe;'

LATEST=$(ls -1t /var/backups/muhasebe-ops/db/*.dump | head -n 1)
pg_restore -h 127.0.0.1 -U muhasebe -d muhasebe_restore_test "$LATEST"

# Smoke ettikten sonra:
sudo -u postgres psql -c 'DROP DATABASE muhasebe_restore_test;'
```

## 17. Rollback drill

`_docs/PRODUCTION_ROLLBACK_PLAN.md` adımları staging'de DENENİR (B + A + D senaryoları).

## 18. Çıkış

```bash
sudo systemctl stop muhasebe-ops-gunicorn   # staging'i kapatma; production değil
```

---

## Çıktı toplama

Her adımın stdout/stderr'i `/var/log/muhasebe-ops/staging-dryrun-$(date +%F).log` dosyasına kaydedilir. Operatör bu logu Faz 17B raporuna ekler.

## Kabul kriteri

13 + 14 + 15 + 16 PASS → Faz 17B Production Preflight'a yetki.
Aksi → blocker yaz, fix, tekrar.
