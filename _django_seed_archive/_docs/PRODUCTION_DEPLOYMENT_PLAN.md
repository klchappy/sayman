# PRODUCTION DEPLOYMENT PLAN

**Hedef:** Muhasebe Operasyonları Takip Sistemi canlı kurulum.
**Tip:** Plan dokümanı. Bu fazda **uygulanmayacak** — Faz 16’da çalıştırılacak.
**Önkoşul:** Faz 14 audit BLOCKER’ları (B1–B4) Faz 15 hardening patch ile kapatılmış olmalı.

---

## 0. Hedef Topoloji

```
                    ┌────────────┐
       internet ───▶│  nginx 443 │ TLS terminate, gzip, X-Accel-Redirect
                    └─────┬──────┘
                          │ proxy_pass http://unix:/run/slc-gunicorn.sock
                    ┌─────▼──────┐
                    │  gunicorn  │ systemd · 3 workers · 60s timeout
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐         ┌──────────────┐
                    │  Django    │◀───────▶│ PostgreSQL16 │
                    └─────┬──────┘         └──────────────┘
                          │
                    ┌─────▼─────────┐
                    │ private_media │ FS, nginx `internal;`
                    └───────────────┘
```

---

## 1. Sunucu Hazırlık

- OS: Ubuntu Server 24.04 LTS önerilir
- Paketler:
  ```
  apt update
  apt install -y python3.13 python3.13-venv python3-pip \
                 postgresql postgresql-contrib \
                 nginx certbot python3-certbot-nginx \
                 git tar rsync ufw fail2ban
  ```
- UFW: `22/tcp`, `80/tcp`, `443/tcp` açık.

## 2. PostgreSQL DB / User

```
sudo -u postgres psql <<EOF
CREATE USER muhasebe WITH PASSWORD '<random-32-char>';
CREATE DATABASE muhasebe OWNER muhasebe ENCODING 'UTF8' LC_COLLATE 'tr_TR.UTF-8' LC_CTYPE 'tr_TR.UTF-8' TEMPLATE template0;
ALTER DATABASE muhasebe SET TIMEZONE TO 'Europe/Istanbul';
EOF
```

## 3. Path Yapısı

```
/var/www/muhasebe-ops/
├── backend/              # Django proje (kaynak)
├── venv/
├── .env                  # 0640 root:muhasebe-ops
├── static/               # collectstatic çıktısı
├── media/                # public boş — placeholder
└── private_media/        # belge/rapor — nginx 'internal;'

/var/log/muhasebe-ops/
└── django.log            # 0640 muhasebe-ops:adm

/var/backups/muhasebe-ops/
├── db/
└── media/
```

```
useradd -r -m -d /var/www/muhasebe-ops -s /bin/bash muhasebe-ops
chown -R muhasebe-ops:www-data /var/www/muhasebe-ops
mkdir -p /var/log/muhasebe-ops /var/backups/muhasebe-ops/db /var/backups/muhasebe-ops/media
chown muhasebe-ops:adm /var/log/muhasebe-ops
```

## 4. Repo Aktarımı

İki seçenek:

- **A. Git (önerilen):** `git clone <url> /var/www/muhasebe-ops/backend`
- **B. tar transfer:** local `tar -czf slc.tar.gz backend/` → scp → extract

## 5. venv + requirements

```
cd /var/www/muhasebe-ops
python3.13 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

`requirements.txt` minimum (Faz 15 patch çıktısı):
```
Django==<freeze>
psycopg[binary]==3.x
gunicorn==23.x
openpyxl==3.x
```

## 6. .env Oluşturma

`/var/www/muhasebe-ops/.env`:
```
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(64))">
ALLOWED_HOSTS=muhasebe-ops.example.com
CSRF_TRUSTED_ORIGINS=https://muhasebe-ops.example.com
DB_NAME=muhasebe
DB_USER=muhasebe
DB_PASSWORD=<password>
DB_HOST=127.0.0.1
DB_PORT=5432
```

İzin: `chmod 0640 .env; chown root:muhasebe-ops .env`

## 7. collectstatic

```
sudo -u muhasebe-ops bash -c "cd /var/www/muhasebe-ops/backend && \
  set -a && source ../.env && set +a && \
  ../venv/bin/python manage.py collectstatic --noinput"
```

Çıktı: `/var/www/muhasebe-ops/static/`

## 8. migrate

```
sudo -u muhasebe-ops ../venv/bin/python manage.py migrate
```

`makemigrations` ÇALIŞTIRILMAZ (Faz 14 zaten temiz).

## 9. Seed Komutları (sıralı)

```
python manage.py seed_roles
python manage.py seed_settings
python manage.py seed_notification_rules
python manage.py seed_pruva_units      # opsiyonel — Site Aidatları örnek daireler
```

Tümü idempotent.

## 10. Süper Kullanıcı

```
python manage.py createsuperuser
```

Sonra admin’den 6 gruba kullanıcı ataması (manuel).

## 11. gunicorn systemd Unit

`/etc/systemd/system/muhasebe-ops-gunicorn.service`:
```ini
[Unit]
Description=OPS Muhasebe gunicorn
After=network.target postgresql.service

[Service]
Type=notify
User=muhasebe-ops
Group=www-data
WorkingDirectory=/var/www/muhasebe-ops/backend
EnvironmentFile=/var/www/muhasebe-ops/.env
ExecStart=/var/www/muhasebe-ops/venv/bin/gunicorn \
  --workers 3 --timeout 60 \
  --bind unix:/run/slc-gunicorn.sock \
  --access-logfile /var/log/muhasebe-ops/access.log \
  --error-logfile /var/log/muhasebe-ops/error.log \
  config.wsgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```
systemctl daemon-reload
systemctl enable --now muhasebe-ops-gunicorn
```

## 12. nginx Site Config

`/etc/nginx/sites-available/muhasebe-ops`:
```nginx
server {
    listen 80;
    server_name muhasebe-ops.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name muhasebe-ops.example.com;

    ssl_certificate     /etc/letsencrypt/live/muhasebe-ops.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/muhasebe-ops.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 110M;
    gzip on;
    gzip_types text/css application/javascript application/json text/html;

    location /static/ {
        alias /var/www/muhasebe-ops/static/;
        expires 30d;
        access_log off;
    }

    # public media (boş kalmasi beklenir)
    location /media/ {
        alias /var/www/muhasebe-ops/media/;
        access_log off;
    }

    # private media — sadece Django X-Accel-Redirect üzerinden
    location /_protected/ {
        internal;
        alias /var/www/muhasebe-ops/private_media/;
    }

    location / {
        proxy_pass http://unix:/run/slc-gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```
ln -s /etc/nginx/sites-available/muhasebe-ops /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 13. SSL (Let's Encrypt)

```
certbot --nginx -d muhasebe-ops.example.com -m ops@example.com --agree-tos --no-eff-email
systemctl enable --now certbot.timer
```

## 14. Backup Script + Timer

Bkz. `_docs/BACKUP_RESTORE_PLAN.md`. Cron yerine **systemd timer**:
- `slc-backup.service` (oneshot)
- `slc-backup.timer` (`OnCalendar=*-*-* 03:30:00`)

## 15. Smoke Test

Bkz. `_docs/PRODUCTION_SMOKE_TEST_CHECKLIST.md`. Tüm yeşil olmadan canlıya tanıtma yapma.

## 16. Rollback Anchor

- Deploy öncesi: `git tag pre-deploy-YYYYMMDD-HHMM`
- DB snapshot: `pg_dump -Fc -f /var/backups/muhasebe-ops/db/pre-deploy-YYYYMMDD-HHMM.dump`
- Media snapshot: `tar -czf /var/backups/muhasebe-ops/media/pre-deploy-YYYYMMDD-HHMM.tar.gz private_media/`

Rollback prosedürü:
1. `systemctl stop muhasebe-ops-gunicorn`
2. `git checkout pre-deploy-...`
3. `pg_restore --clean -d muhasebe pre-deploy-...dump`
4. `tar -xzf pre-deploy-...tar.gz` (private_media)
5. `migrate` (önceki şemaya zaten dönüldü → no-op)
6. `systemctl start muhasebe-ops-gunicorn`
7. Smoke test 5 kritik adım (login, dashboard, fatura listesi, belge indir, dry-run KAPALI).

---

## Sıralı Komut Özeti

```
# 1. Server prep
apt install ...

# 2. DB
sudo -u postgres psql -c "CREATE USER ... ; CREATE DATABASE ..."

# 3. Path + user
useradd -r ...; mkdir -p ...

# 4. Repo
git clone ... /var/www/muhasebe-ops/backend

# 5. venv
python3.13 -m venv /var/www/muhasebe-ops/venv
source venv/bin/activate
pip install -r backend/requirements.txt

# 6. .env
vim /var/www/muhasebe-ops/.env
chmod 0640 .env

# 7. Static
python manage.py collectstatic --noinput

# 8. migrate
python manage.py migrate

# 9. Seeds
python manage.py seed_roles
python manage.py seed_settings
python manage.py seed_notification_rules

# 10. Superuser
python manage.py createsuperuser

# 11. gunicorn
systemctl enable --now muhasebe-ops-gunicorn

# 12. nginx
ln -s ...; nginx -t; systemctl reload nginx

# 13. SSL
certbot --nginx ...

# 14. Backup
systemctl enable --now slc-backup.timer

# 15. Smoke
checklist (manual)

# 16. Rollback anchor
git tag; pg_dump; tar
```

**Bu fazda hiçbiri uygulanmadı.** Bu yalnız plandır.
