# BACKUP / RESTORE PLAN

**Sistem:** Muhasebe Operasyonları Takip Sistemi (Django + PostgreSQL)
**Hedefler:** RPO ≤ 24 saat · RTO ≤ 2 saat · şirket politikası gerektirirse daha sıkı.
**Bu fazda kurulum YAPILMADI** — Faz 16 deploy adımıdır.

---

## 1. Kapsam

| Veri | Kaynak | Tip |
|------|--------|-----|
| PostgreSQL DB (`muhasebe`) | `pg_dump -Fc` | günlük tam |
| `private_media/` (belgeler + rapor exportları) | `tar -czf` veya `rsync --link-dest` | günlük artımlı |
| `static/` | (yok — collectstatic ile yeniden üretilebilir) | gerek yok |
| `.env` | el ile şifreli kasa (`pass`/`vault`) | manuel, repo dışı |
| nginx/systemd config | `/etc/` git repo (örn. `etckeeper`) | günlük |
| log dosyaları | `/var/log/muhasebe-ops/` rotasyon | logrotate |

**Önemli:** `.env`, dump dosyaları içine **eklenmez**. Secret’lar şifreli kasa’da tutulur.

---

## 2. Hedef Yapı

```
/var/backups/muhasebe-ops/
├── db/
│   ├── 2026-05-07.dump
│   ├── 2026-05-08.dump
│   └── ...
├── media/
│   ├── 2026-05-07.tar.gz
│   ├── 2026-05-08.tar.gz
│   └── ...
└── log/
    └── backup.log     # secret içermez; path/size/exit
```

---

## 3. Retention

| Tip | Sıklık | Saklama |
|-----|--------|---------|
| Günlük | her gün 03:30 | son 7 |
| Haftalık | her Pazar | son 4 |
| Aylık | her ayın 1’i | son 6 |

Off-site kopya: minimum **haftalık** uzak hedefe (rsync over SSH veya S3-uyumlu).

---

## 4. Backup Script (taslak)

`/usr/local/sbin/slc-backup.sh` (taslak — bu fazda yazılmadı):

```bash
#!/bin/bash
set -euo pipefail
TS=$(date +%F)
BASE=/var/backups/muhasebe-ops
LOG=$BASE/log/backup.log

mkdir -p "$BASE/db" "$BASE/media" "$BASE/log"

echo "[$(date -Is)] start" >> "$LOG"

# 1. DB
sudo -u postgres pg_dump -Fc -d muhasebe \
  -f "$BASE/db/$TS.dump"
echo "[$(date -Is)] db ok size=$(stat -c%s $BASE/db/$TS.dump)" >> "$LOG"

# 2. private_media
tar -czf "$BASE/media/$TS.tar.gz" \
  -C /var/www/muhasebe-ops private_media
echo "[$(date -Is)] media ok size=$(stat -c%s $BASE/media/$TS.tar.gz)" >> "$LOG"

# 3. retention — günlük 7
find "$BASE/db" -name "*.dump" -mtime +7 -delete
find "$BASE/media" -name "*.tar.gz" -mtime +7 -delete

# 4. haftalık (Pazar arşivle — ayrı klasör önerilir, basitlik için aynı klasörde)
# 5. aylık (ay başı arşivle)
# (üretimde ayrı klasörler / hardlink rotasyonu)

echo "[$(date -Is)] done" >> "$LOG"
```

**İzinler:**
- `chmod 0700 /usr/local/sbin/slc-backup.sh; chown root:root`
- `chmod 0750 /var/backups/muhasebe-ops; chown postgres:muhasebe-ops`

---

## 5. systemd Timer (cron yerine)

`/etc/systemd/system/slc-backup.service`:
```ini
[Unit]
Description=OPS Muhasebe nightly backup
After=postgresql.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/slc-backup.sh
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
```

`/etc/systemd/system/slc-backup.timer`:
```ini
[Unit]
Description=Run OPS backup nightly

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

```
systemctl enable --now slc-backup.timer
```

---

## 6. Restore Drill (testte zorunlu)

### 6.1 DB restore (staging)

```
# 1. Hedef DB hazırla
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS muhasebe_restore;
CREATE DATABASE muhasebe_restore OWNER muhasebe;
EOF

# 2. Restore
sudo -u postgres pg_restore --clean --if-exists \
  -d muhasebe_restore /var/backups/muhasebe-ops/db/2026-05-07.dump

# 3. Uygulama yönlendir (env DB_NAME=muhasebe_restore)
# 4. python manage.py check && smoke test 5 adım
```

### 6.2 Media restore

```
# Hedef path’a aç
mkdir -p /tmp/restore && cd /tmp/restore
tar -xzf /var/backups/muhasebe-ops/media/2026-05-07.tar.gz
ls private_media | wc -l    # dosya sayısı eski sayıyla eş
```

### 6.3 Tam restore (felaket senaryosu)

1. Yeni sunucu hazırla (`PRODUCTION_DEPLOYMENT_PLAN.md` §1–6)
2. `muhasebe` boş DB yarat → `pg_restore` (yukarı)
3. `private_media/` tar’ı `/var/www/muhasebe-ops/` altına aç
4. `collectstatic`
5. gunicorn + nginx + SSL
6. Smoke test (`PRODUCTION_SMOKE_TEST_CHECKLIST.md`)
7. DNS yönlendir

**RTO hedefi:** 2 saat. Drill yapılmadan canlı verilmez.

---

## 7. Drill Takvimi

| Sıklık | Test |
|---|---|
| Aylık | Restore drill (staging’e DB + media) — 1 saat içinde tamamlanmalı |
| Çeyrek | Tam felaket senaryosu (yeni VM, tüm path) |
| Yıllık | Off-site kopyadan restore |

Drill sonuçları `_analysis/reports/BACKUP_DRILL_<YYYY-MM>.md` olarak loglanır.

---

## 8. Backup Log Politikası

`backup.log` içeriği:
- timestamp
- aksiyon (`start` / `db ok` / `media ok` / `done` / `error`)
- dosya yolu + boyut

**Yasak:** secret, password, token, `.env` içeriği, kullanıcı adı/email, raw chat_id.

---

## 9. Monitoring

- `slc-backup.service` exit non-zero → systemd `OnFailure=` ile alert mail (eğer SMTP daha sonra etkinleştirilirse) veya `journalctl` izleme
- Disk kullanımı `> %85` → uyarı (Faz 16+ Prometheus/node_exporter opsiyonel)

---

## 10. Önemli Notlar

- Bu fazda script **yazılmadı**, timer **kurulmadı**, drill **çalıştırılmadı**.
- Faz 16 deploy adımında uygulanacak.
- İlk drill canlıya tanıtım yapmadan önce yapılmalıdır.
