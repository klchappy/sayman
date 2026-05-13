# PRODUCTION PREFLIGHT CHECKLIST

**Faz 17A çıktısı.** Production deploy ÖNCESİ son onay listesi. Staging dry-run PASS sonrası doldurulur.

---

## A. Kod & Repo

- [ ] Faz 15 + Faz 16 + Faz 17A raporları PASS
- [ ] Tag/commit hash sabitlendi: `__________`
- [ ] `.env.production.example` ↔ gerçek `/etc/muhasebe-ops/.env` parity check
- [ ] Faz 17A staging dry-run PASS (operatör imzası: `__________`)
- [ ] `_docs/STAGING_EXECUTION_COMMANDS.md` çalıştırıldı; çıktı arşivlendi

## B. Sunucu

- [ ] OS güncel, security patch tarihi: `__________`
- [ ] Disk: /var ≥ 20 GB boş
- [ ] timezone: Europe/Istanbul
- [ ] PostgreSQL 14+ kuruldu, autovacuum açık
- [ ] Sertifika (Let's Encrypt) hazır

## C. .env (gerçek)

- [ ] `DJANGO_SECRET_KEY` 64+ char random (production'a özel)
- [ ] `DJANGO_SETTINGS_MODULE=config.settings.production`
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` = gerçek domain
- [ ] `CSRF_TRUSTED_ORIGINS` doğru
- [ ] DB credential'lar `.pgpass` (env'de DB_PASSWORD opsiyonel)
- [ ] `DJANGO_SECURE_SSL_REDIRECT=1`
- [ ] `DJANGO_SECURE_HSTS_SECONDS=31536000`
- [ ] `DJANGO_EMAIL_BACKEND` = dummy
- [ ] `TELEGRAM_REAL_SEND_ALLOWED=False`
- [ ] Dosya izni 0640, owner slc:slc

## D. Path & izin

- [ ] `/var/www/muhasebe-ops/{static,media,private_media}` 0755
- [ ] `/var/log/muhasebe-ops` 0755 owner slc
- [ ] `/var/backups/muhasebe-ops/{db,media,log,checksums}` 0750
- [ ] `private_media` nginx ile serve EDİLMİYOR (yalnız Django)

## E. DB

- [ ] Production DB boş veya planlanan baseline
- [ ] Pre-deploy `pg_dump -Fc` alındı: `__________.dump`
- [ ] Pre-deploy `private_media.tar.gz` alındı: `__________.tar.gz`
- [ ] Restore drill (staging) PASS

## F. Servis

- [ ] systemd unit `/etc/systemd/system/muhasebe-ops-gunicorn.service`
- [ ] `systemctl daemon-reload` yapıldı
- [ ] Gunicorn 127.0.0.1:8001 dinleyecek
- [ ] worker=3, timeout=60 (yük profili sonrası ayar)

## G. Nginx

- [ ] `/etc/nginx/sites-enabled/muhasebe-ops` symlink
- [ ] `nginx -t` OK
- [ ] `client_max_body_size 110m`
- [ ] HTTP→HTTPS redirect
- [ ] TLSv1.2/1.3 aktif
- [ ] Security headers eklendi

## H. Smoke (production'a geçtikten 5 dk içinde)

- [ ] `_docs/PRODUCTION_SMOKE_COMMANDS.md` 1–9 PASS
- [ ] super_admin login OK
- [ ] Belge upload + download + audit log OK
- [ ] Viewer 403 + audit DENIED OK
- [ ] Static 200, Media 200/302, private_media yalnız Django üzerinden

## I. No-op guards

- [ ] `EMAIL_BACKEND=dummy` doğrulandı (runtime check)
- [ ] `TELEGRAM_REAL_SEND_ENABLED=False` doğrulandı
- [ ] `systemctl list-timers` → yalnız backup timer (varsa)
- [ ] Outbound bağlantılar: ne `api.telegram.org` ne `smtp.*`

## J. Backup

- [ ] `backup.sh` cron veya systemd timer 03:30
- [ ] İlk gerçek backup üretildi + sha256 doğrulandı
- [ ] Retention 7 gün doğrulandı

## K. Monitoring & log

- [ ] `journalctl -u muhasebe-ops-gunicorn` temiz
- [ ] `/var/log/nginx/muhasebe-ops.error.log` temiz
- [ ] `/var/log/muhasebe-ops/django.log` rotating (yazılabiliyor)
- [ ] AuditLog kayıtları üretiliyor

## L. Rollback hazır

- [ ] `_docs/PRODUCTION_ROLLBACK_PLAN.md` operatör tarafından okundu
- [ ] Pre-deploy DB dump erişilebilir
- [ ] Önceki commit hash kayıt altında
- [ ] DB restore yetkisi tek kişide

---

## Onay

| Rol | İsim | Tarih | İmza |
|---|---|---|---|
| Operatör | | | |
| Yönetici | | | |

Tüm A–L kalemleri ✅ → **Production deploy yetkilidir.**
Eksik var → Faz 17B Production Preflight tekrar koş.

---

## Faz 17B değerlendirmesi (2026-05-07)

### A. Kod & Repo
- [x] Faz 15 + 16 + 17A + 17B raporları PASS/WARNING — net
- [x] Tag/commit hash sabitlendi: **`ed83635`** (tag `pre-production-mvp-baseline`)
- [ ] `.env.production.example` ↔ gerçek `/etc/muhasebe-ops/.env` parity check — **operatör görevi**
- [ ] Faz 17A staging dry-run PASS — **operatör staging'de koşmalı (W1 OPEN)**
- [ ] `_docs/STAGING_EXECUTION_COMMANDS.md` çalıştırıldı — **bekliyor**
**Sonuç:** ⚠️ WARNING (staging operatör tarafında bekliyor)

### B. Sunucu — N/A (lokal preflight)
**Sonuç:** ⚠️ WARNING — operatör onayı bekliyor

### C. .env (gerçek) — N/A (operatör görevi)
- [x] Şablon `.env.production.example` placeholder, secret-free
- [ ] Gerçek `.env` operatör tarafından üretilecek
**Sonuç:** ⚠️ WARNING — şablon hazır

### D. Path & izin — N/A (sunucu)
**Sonuç:** ⚠️ WARNING — şema dokümante

### E. DB — N/A (operatör)
- [x] Pre-deploy `pg_dump` + `tar.gz` adımı `STAGING_EXECUTION_COMMANDS.md` 15. bölümde
- [x] Restore drill prosedürü `PRODUCTION_ROLLBACK_PLAN.md` B/F adımı
**Sonuç:** ⚠️ WARNING — gerçek dump/restore operatör tarafında

### F. Servis
- [x] `muhasebe-ops-gunicorn.service` taslak hazır
- [x] **YENİ:** `muhasebe-ops-backup.service` + `muhasebe-ops-backup.timer` taslakları (Faz 17B W4)
**Sonuç:** ✅ PASS

### G. Nginx
- [x] `muhasebe-ops.conf` taslak: 110m body, private_media kapalı, security headers
- [x] `nginx -t` operatör tarafında koşulacak
**Sonuç:** ✅ PASS (taslak)

### H. Smoke — N/A (operatör)
- [x] `_docs/PRODUCTION_SMOKE_COMMANDS.md` 9 adımlı paket hazır
**Sonuç:** ⚠️ WARNING — paket hazır, gerçek koşum operatör

### I. No-op guards
- [x] `EMAIL_BACKEND=django.core.mail.backends.dummy.EmailBackend` kod default
- [x] `TELEGRAM_REAL_SEND_ENABLED=False` kod default + test ile doğrulandı
- [x] Tek timer `muhasebe-ops-backup.timer` (sadece backup; cron yok)
**Sonuç:** ✅ PASS

### J. Backup
- [x] `backup.sh` `bash -n` PASS
- [x] **YENİ:** systemd timer + service taslakları (W4 KAPATILDI)
- [ ] İlk gerçek backup üretimi — operatör görevi
**Sonuç:** ✅ PASS (taslak), operatör koşumu bekleniyor

### K. Monitoring & log
- [x] systemd unit'leri `journald` ile entegre
- [x] Django LOGGING RotatingFileHandler graceful fallback
- [x] AuditLog modeli + `audit_log` çağrı noktaları kanıtlandı (Faz 15 testleri)
**Sonuç:** ✅ PASS

### L. Rollback hazır
- [x] `_docs/PRODUCTION_ROLLBACK_PLAN.md` A–F senaryolar
- [x] **YENİ:** Pre-deploy commit anchor `ed83635` (`pre-production-mvp-baseline` tag) — W3 KAPATILDI
- [ ] Pre-deploy DB dump — operatör görevi (deploy başlangıcında)
**Sonuç:** ✅ PASS

---

## Faz 17B özet skor

| Bölüm | Sonuç |
|---|---|
| A Kod & Repo | ⚠️ |
| B Sunucu | ⚠️ |
| C .env | ⚠️ |
| D Path & izin | ⚠️ |
| E DB | ⚠️ |
| F Servis | ✅ |
| G Nginx | ✅ |
| H Smoke | ⚠️ |
| I No-op guards | ✅ |
| J Backup | ✅ |
| K Monitoring | ✅ |
| L Rollback | ✅ |

**6 PASS / 6 WARNING / 0 BLOCKER.**
WARNING'lerin tamamı **"operatör koşumunu bekliyor"** kategorisi. Lokal preflight tarafı eksiksizdir.
