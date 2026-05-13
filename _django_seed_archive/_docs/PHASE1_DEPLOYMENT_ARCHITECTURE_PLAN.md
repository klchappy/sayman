# FAZ 1 — DEPLOYMENT MİMARİSİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05
**Karar referansı:** D-017 (ayrı VPS) · Anayasa Madde 1.5 (izolasyon)

---

## 1. İZOLASYON İLKELERİ

| Kaynak | Karar |
|---|---|
| **VPS** | Ayrı sunucu (örn. `mop-prod-1`); diğer Acme projeleriyle paylaşılmaz |
| **Domain** | Ayrı domain veya alt-domain (örn. `mop.acme.com.tr`) |
| **Veritabanı** | Ayrı PostgreSQL instance veya minimum ayrı DB + DB user |
| **Redis** | Ayrı instance veya logical DB (DB 0) |
| **Linux user** | `muhasebe` (sudo'suz) |
| **Systemd service** | Tüm servisler `muhasebe-*` prefix ile |
| **Nginx site** | Ayrı site config |
| **Media path** | `/var/lib/muhasebe/media` (separate disk önerilir) |
| **Backup path** | `/var/lib/muhasebe/backups` |
| **Repo** | Ayrı private git repo (GitLab/Gitea/Github private) |
| **.env** | Ayrı dosya, `chmod 600 root:muhasebe` |
| **Log path** | `/var/log/muhasebe/` |
| **Secret store** | (LATER) Vault veya age-encrypted; MVP-1 .env yeterli |

> **Hiçbir paylaşım yok.** Diğer Acme projeleri (Enerji İşletim Sistemi / Araç Takip / Envanter) bu sunucuya hiçbir kanaldan erişemez. SSO Faz 14+ değerlendirilebilir, MVP-1'de hayır.

---

## 2. SUNUCU BOYUT TAVSİYESİ

| Ortam | CPU | RAM | Disk | Bant |
|---|---|---|---|---|
| **MVP-1 prod** | 4 vCPU | 8 GB | 200 GB SSD | 1 Gbps |
| **MVP-2 prod** | 8 vCPU | 16 GB | 500 GB SSD | 1 Gbps |
| **Staging** | 2 vCPU | 4 GB | 80 GB | — |

OS: **Ubuntu Server 24.04 LTS** (veya 22.04 LTS).

---

## 3. PATH YAPISI

```
/etc/
├── nginx/sites-available/muhasebe
├── nginx/sites-enabled/muhasebe -> ...
├── systemd/system/muhasebe-web.service
├── systemd/system/muhasebe-asgi.service
├── systemd/system/muhasebe-worker.service
├── systemd/system/muhasebe-beat.service
└── muhasebe/
    ├── env                        # MUHASEBE_SECRET_KEY, DB_URL, etc.
    └── tls/                       # cert/key (Let's Encrypt veya custom)

/srv/muhasebe/                    # Kod
├── current -> releases/2026-05-15-1430/
├── releases/
│   ├── 2026-05-15-1430/
│   ├── 2026-05-14-1830/
│   └── ...
├── shared/
│   ├── venv/
│   ├── static/
│   └── logs/
└── deploy/
    ├── deploy.sh
    └── rollback.sh

/var/lib/muhasebe/
├── media/                         # Yüklenen dosyalar
│   ├── imports/
│   ├── documents/
│   ├── chat/
│   └── exports/
└── backups/
    ├── db/                        # pg_dump çıktıları
    │   ├── daily/
    │   ├── weekly/
    │   └── monthly/
    └── media/                     # rsync snapshot

/var/log/muhasebe/
├── django.log
├── celery.log
├── celery-beat.log
├── asgi.log
├── access.log                     # nginx
└── error.log
```

---

## 4. SYSTEMD SERVİSLERİ

### 4.1 `muhasebe-web.service` (Gunicorn — HTTP)
```ini
[Unit]
Description=Muhasebe Web (Gunicorn)
After=network.target postgresql.service

[Service]
User=muhasebe
Group=muhasebe
WorkingDirectory=/srv/muhasebe/current
EnvironmentFile=/etc/muhasebe/env
ExecStart=/srv/muhasebe/shared/venv/bin/gunicorn config.wsgi \
    --workers 4 --bind 127.0.0.1:8001 --timeout 60 \
    --access-logfile /var/log/muhasebe/access.log \
    --error-logfile /var/log/muhasebe/error.log
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 4.2 `muhasebe-asgi.service` (Uvicorn — Channels/WebSocket)
```ini
[Service]
ExecStart=/srv/muhasebe/shared/venv/bin/uvicorn config.asgi:application \
    --workers 2 --host 127.0.0.1 --port 8002
```

### 4.3 `muhasebe-worker.service` (Celery worker)
```ini
[Service]
ExecStart=/srv/muhasebe/shared/venv/bin/celery -A config worker \
    --loglevel=INFO --concurrency=4 \
    --logfile=/var/log/muhasebe/celery.log
```

### 4.4 `muhasebe-beat.service` (Celery beat — cron)
```ini
[Service]
ExecStart=/srv/muhasebe/shared/venv/bin/celery -A config beat \
    --loglevel=INFO --logfile=/var/log/muhasebe/celery-beat.log \
    --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

---

## 5. NGINX KONFİG ŞEMASI

```nginx
# /etc/nginx/sites-available/muhasebe
upstream muhasebe_web { server 127.0.0.1:8001; }
upstream muhasebe_asgi { server 127.0.0.1:8002; }

server {
    listen 80;
    server_name mop.acme.com.tr;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mop.acme.com.tr;

    ssl_certificate /etc/muhasebe/tls/fullchain.pem;
    ssl_certificate_key /etc/muhasebe/tls/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    client_max_body_size 100M;  # RAR import'lar için

    # Static
    location /static/ {
        alias /srv/muhasebe/shared/static/;
        expires 30d;
        access_log off;
    }

    # Media — internal (X-Accel-Redirect)
    location /protected_media/ {
        internal;
        alias /var/lib/muhasebe/media/;
    }

    # WebSocket → ASGI
    location /ws/ {
        proxy_pass http://muhasebe_asgi;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Diğer hepsi → Gunicorn
    location / {
        proxy_pass http://muhasebe_web;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

---

## 6. ENV / SECRETS YAKLAŞIMI

`/etc/muhasebe/env`:
```bash
DJANGO_SETTINGS_MODULE=config.settings.prod
SECRET_KEY=<random 64 char>
DEBUG=False
ALLOWED_HOSTS=mop.acme.com.tr
DATABASE_URL=postgres://muhasebe_user:***@127.0.0.1:5432/muhasebe_db
REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=redis://127.0.0.1:6379/0

# Encrypted fields master key
FIELD_ENCRYPTION_KEY=<32 byte base64>

# Telegram (Faz 12'de doldurulur, MVP-1'de boş veya dry-run)
TELEGRAM_BOT_TOKEN_ENCRYPTED=<...>
TELEGRAM_DEFAULT_MODE=DRY_RUN

# E-posta (şifre sıfırlama)
EMAIL_HOST=smtp.acme.com.tr
EMAIL_PORT=587
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
EMAIL_USE_TLS=True

# Sentry / monitoring (opsiyonel)
SENTRY_DSN=...
```

**Permission:** `chmod 600 /etc/muhasebe/env && chown root:muhasebe /etc/muhasebe/env`.

**Secret rotasyon:** SECRET_KEY ve TELEGRAM_BOT_TOKEN yıllık rotasyon (LATER manual prosedür).

---

## 7. BACKUP STRATEJİSİ

### 7.1 DB Backup (Anayasa Madde 12.2)
```bash
# /etc/cron.d/muhasebe-backup
0 2 * * * muhasebe pg_dump -Fc muhasebe_db > /var/lib/muhasebe/backups/db/daily/$(date +\%Y\%m\%d).dump
```
- **Günlük:** son 30 gün saklanır.
- **Haftalık:** Pazar 02:30, son 12 hafta.
- **Aylık:** ayın 1'i 03:00, son 24 ay.
- **Restore test:** her ay 1 random backup test ortamına restore edilir (manual prosedür).

### 7.2 Media Backup
```bash
0 3 * * 0 muhasebe rsync -a --delete /var/lib/muhasebe/media/ /var/lib/muhasebe/backups/media/weekly/
```
- Haftalık snapshot.
- Off-site sync (LATER): S3 veya başka VPS'e rsync.

### 7.3 Backup Şifreleme
- `pg_dump | age -e -r <pubkey>` ile şifreleme (LATER).
- Off-site upload öncesi şifreleme zorunlu.

### 7.4 Restore Prosedürü (yazılı runbook)
```bash
# 1. Servisleri durdur
systemctl stop muhasebe-web muhasebe-asgi muhasebe-worker muhasebe-beat
# 2. DB geri yükle
pg_restore -d muhasebe_db /var/lib/muhasebe/backups/db/daily/20260501.dump
# 3. Media geri yükle (gerekirse)
rsync -a /var/lib/muhasebe/backups/media/weekly/ /var/lib/muhasebe/media/
# 4. Servisleri başlat
systemctl start muhasebe-*
# 5. Smoke test (login + dashboard)
```

---

## 8. DEPLOY KAPILARI VE SÜREÇ

### 8.1 Branş yapısı (Anayasa 13.1)
- `main` → prod
- `staging` → staging ortam (LATER, MVP-2)
- `dev` → entegrasyon
- `feat/*`, `fix/*`, `release/*`

### 8.2 Deploy adımları
```bash
# 1. Yerel: PR merge → main
# 2. Sunucu (deploy.sh):
sudo -u muhasebe /srv/muhasebe/deploy/deploy.sh <git_sha>

# Script şunu yapar:
#  a) /srv/muhasebe/releases/<timestamp> dizini yarat
#  b) git clone --depth 1 <repo> ./releases/<timestamp>
#  c) symlink shared/venv, shared/static, shared/logs
#  d) pip install -r requirements/prod.txt
#  e) python manage.py collectstatic --noinput
#  f) python manage.py migrate --noinput
#  g) Symlink swap: current -> releases/<timestamp>
#  h) systemctl restart muhasebe-web muhasebe-asgi muhasebe-worker muhasebe-beat
#  i) Smoke test: curl https://mop.acme.com.tr/healthz/
```

### 8.3 Deploy Öncesi Kontrol Listesi
- [ ] DB backup alındı (otomatik)
- [ ] Migration test ortamında geçti
- [ ] Tests yeşil (CI)
- [ ] Release notu hazır (`_docs/releases/vX.Y.Z.md`)
- [ ] Yönetici onayı (production deploy)
- [ ] Maintenance window (gece 02:00-04:00 TR)

### 8.4 Rollback Prosedürü
```bash
sudo -u muhasebe /srv/muhasebe/deploy/rollback.sh
# Önceki release symlink'e geri döner
# Migration rollback otomatik DEĞİL — manuel müdahale
```

**Migration safety:** her release'de migration backward-compatible olmalı (Anayasa 13.4). Breaking değişiklik 2 release'e bölünür.

---

## 9. MONİTÖRİNG VE ALERT

### 9.1 Health Check
```python
# urls.py
path("healthz/", health_view),  # 200 OK + DB ping
path("readyz/", ready_view),    # +Redis +Celery
```

### 9.2 Sentry (opsiyonel, MVP-2)
- Hata izleme + performans.
- KVKK: kullanıcı bilgisi maskeleme.

### 9.3 Cron Watchdog
- `muhasebe-beat` 5 dk'dan fazla mesaj atmazsa alert.
- Celery worker queue length >100 → alert.

### 9.4 Disk / RAM monitoring
- `node_exporter` + Prometheus + Grafana (LATER, paylaşılan monitoring sunucu).
- MVP-1: basit `df -h` cron + email alert (>%80).

### 9.5 Uptime monitoring
- External (UptimeRobot benzeri) — `https://mop.acme.com.tr/healthz/` her 5 dk.

---

## 10. CI/CD ÖNERİSİ (LATER)

| Aşama | Tool | Görev |
|---|---|---|
| Lint | ruff, black, isort | PR open |
| Type | mypy (opsiyonel) | PR open |
| Test | pytest + pytest-django | PR open |
| Build | Docker image | PR merge to main |
| Deploy | SSH + deploy.sh veya Ansible | Manual onay sonrası |

GitLab CI veya GitHub Actions tercih edilebilir.

---

## 11. DOCKER COMPOSE TASLAĞI (alternatif yol — MVP-2 değerlendirme)

```yaml
# docker-compose.prod.yml
version: '3.9'
services:
  db:
    image: postgres:15
    volumes: [pgdata:/var/lib/postgresql/data]
    env_file: .env
  redis:
    image: redis:7-alpine
  web:
    build: .
    command: gunicorn config.wsgi --bind 0.0.0.0:8001 --workers 4
    depends_on: [db, redis]
    env_file: .env
    volumes:
      - ./media:/app/media
  asgi:
    build: .
    command: uvicorn config.asgi:application --host 0.0.0.0 --port 8002
    depends_on: [db, redis]
  worker:
    build: .
    command: celery -A config worker -l INFO
    depends_on: [redis]
  beat:
    build: .
    command: celery -A config beat -l INFO
    depends_on: [redis]
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./media:/var/lib/muhasebe/media:ro
volumes: { pgdata: }
```

> **MVP-1 yaklaşımı:** systemd + manuel deploy. Docker yaklaşımı MVP-2'de değerlendirilebilir.

---

## 12. GÜVENLİK KONTROL LİSTESİ

- [ ] HTTPS zorunlu (HSTS preload)
- [ ] `DEBUG=False` prod'da
- [ ] `ALLOWED_HOSTS` strict
- [ ] CSRF + Session secure cookies
- [ ] Rate limiting (django-axes login + django-ratelimit views)
- [ ] DB backup encrypted (LATER — age)
- [ ] SSH key-based login only, root SSH disabled
- [ ] UFW firewall: 22 (admin IP whitelist) + 443 + 80
- [ ] fail2ban (SSH + nginx 403)
- [ ] OS auto-update (security patches)
- [ ] PostgreSQL `pg_hba.conf` md5/scram-sha-256
- [ ] Redis password (env'den)
- [ ] Media private (X-Accel-Redirect ile)
- [ ] User input MIME whitelist
- [ ] `Content-Security-Policy` header
- [ ] CSRF token tüm form/POST'larda
- [ ] Şifre hash'leme (Django default Argon2)

---

## 13. DOMAİN VE TLS

- **Domain:** `mop.acme.com.tr` (öneri) veya `muhasebe.acme.com.tr`. Karar D-014.
- **TLS:** Let's Encrypt (certbot otomatik 90 günlük yenileme) veya Acme kurumsal cert.
- **WWW redirect:** `www.mop.acme.com.tr` → `mop.acme.com.tr` 301.

---

## 14. PROD KAPISI (manual onay)

MVP-1 canlıya çıkmadan önce:

1. Yönetici imzası: "Telegram gerçek mod KAPALI" doğrulaması.
2. Yönetici imzası: "Backup test başarılı" doğrulaması.
3. Yönetici imzası: "Yetki matrisi 6 rol için test edildi".
4. Yönetici imzası: "Kullanım kılavuzu hazır".
5. Yönetici imzası: "DR drill (1 backup restore test) başarılı".

---

**SON.** Faz 14 Prod Deploy & Stabilizasyon bu planı uygular.
