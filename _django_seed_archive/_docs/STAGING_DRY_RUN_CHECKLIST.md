# STAGING DRY-RUN CHECKLIST

**Faz 16 — Production Deploy Prep.**
Production'a CANLI geçmeden ÖNCE bir staging sunucuda baştan-sona kuru deneme yapılır. Bu liste tek dokunuşla yürütülür ve her satır el ile imzalanır.

---

## 0. Sunucu hazır

- [ ] OS: Ubuntu 22.04+ / Debian 12+ (Python 3.13 kuruldu)
- [ ] PostgreSQL 14+ kuruldu, `muhasebe` rol + DB açık
- [ ] `slc` kullanıcı + grup açık
- [ ] Path'ler oluştu: `/var/www/muhasebe-ops`, `/var/log/muhasebe-ops`, `/var/backups/muhasebe-ops`, `/etc/muhasebe-ops`
- [ ] `/etc/muhasebe-ops/.env` oluştu, 0640, owner=slc:slc

## 1. Kod & venv

- [ ] `git clone <repo> /var/www/muhasebe-ops/repo` (ya da rsync)
- [ ] `python3.13 -m venv /var/www/muhasebe-ops/venv`
- [ ] `pip install -r backend/requirements.txt` PASS

## 2. Pre-migrate yedek

- [ ] `pg_dump -Fc … -f predeploy-*.dump` üretildi (boş DB de olsa)
- [ ] `tar -czf predeploy-*.tar.gz private_media` üretildi (boş ise log'a düşer)

## 3. Django check

- [ ] `python manage.py check --deploy` → 0 issues
- [ ] `python manage.py makemigrations --check --dry-run` → "No changes detected"

## 4. Migrate + collectstatic + seed

- [ ] `python manage.py migrate --noinput` PASS
- [ ] `python manage.py collectstatic --noinput` PASS
- [ ] `seed_roles`, `seed_settings`, `seed_notification_rules` PASS (idempotent)

## 5. Superuser

- [ ] `python manage.py createsuperuser` çalıştı
- [ ] Login sayfası açılıyor

## 6. Servis

- [ ] `muhasebe-ops-gunicorn.service` `/etc/systemd/system/` altına kopyalandı
- [ ] `systemctl daemon-reload && systemctl enable --now muhasebe-ops-gunicorn`
- [ ] `systemctl status` aktif
- [ ] Gunicorn 127.0.0.1:8001 dinliyor (`ss -ltnp | grep 8001`)

## 7. Nginx + SSL

- [ ] `muhasebe-ops.conf` `/etc/nginx/sites-available/`'e kopyalandı + symlink
- [ ] `nginx -t` OK
- [ ] `certbot --nginx` ile SSL alındı
- [ ] HTTPS 200, HTTP→HTTPS 301

## 8. Smoke

- [ ] `_docs/PRODUCTION_SMOKE_COMMANDS.md` 1–9 tüm adımlar PASS

## 9. Permission smoke

- [ ] super_admin → indirme 200
- [ ] viewer → finans dışı belge 403 + audit DENIED kaydı
- [ ] anonim → 302 login redirect
- [ ] Audit log'da VIEW kayıtları görünüyor

## 10. Backup script smoke

- [ ] `bash -n backend/scripts/backup.sh` OK
- [ ] Test çağrısı: `DB_NAME=muhasebe DB_USER=muhasebe bash backup.sh` →
  `/var/backups/muhasebe-ops/db/<date>.dump` üretildi
- [ ] `sha256sum -c <date>.sha256` PASS
- [ ] systemd timer `muhasebe-ops-backup.timer` etkin (taslak)

## 11. UI identity sanity

- [ ] Anasayfa "Site Aidatları" yazıyor (Pruva değil)
- [ ] Light tema, IBM Plex font yükleniyor
- [ ] Arama sonuç, profile, dashboard kart'ları açılıyor
- [ ] Hiçbir yerde "Acme" / "Pruva" görsel string yok (URL/code hariç)

## 12. No-op guards

- [ ] `EMAIL_BACKEND` = dummy
- [ ] `TELEGRAM_REAL_SEND_ENABLED` = False
- [ ] Cron / Celery / scheduler yok (`systemctl list-timers` ↔ yalnız backup.timer)
- [ ] Outbound network log'unda telegram.org / api.telegram yok

## 13. Rollback prova

- [ ] DB'ye dummy bir kayıt at
- [ ] Migrate yarıda kesilmiş senaryoyu simüle et (bir migration'ı manuel ROLLBACK)
- [ ] `_docs/PRODUCTION_ROLLBACK_PLAN.md` B adımı uygula
- [ ] Eski hâl restore edildi

---

## Onay

Tüm 13 bölüm ✅ → **Production deploy yetkilidir.**
Aksi → blocker yaz, bu listeye dön, fix-and-retest.

---

## Faz 17A execution notes (2026-05-07)

- Lokal precheck PASS: `manage.py check` 0 issue, `makemigrations --dry-run` no changes.
- `bash -n` her iki script (deploy.sh, backup.sh) PASS.
- `deploy.sh` guard runtime test: `CONFIRM_DEPLOY` set edilmeden çalıştırıldı → exit 2 "ABORT" mesajı + hiçbir migrate/seed/collectstatic tetiklenmedi.
- Production settings import (env override ile) → `DEBUG=False`, `EMAIL=dummy`, `TELEGRAM_REAL_SEND_ENABLED=False`, `CSRF=https://<ALLOWED_HOSTS>`, `REFERRER=same-origin`, `UPLOAD_MAX=110MB`, `SSL_REDIRECT=True`, `HSTS=31536000`. Tüm değerler beklenen.
- `tests/test_phase15.py` 36/36 PASS (kısmi suite — deploy/security odaklı). Faz 15 tam baseline 449/449 hâlâ geçerli; bu fazda tam suite tekrarlanmadı (zaman tasarrufu).
- **Remote staging verilmedi** → bu liste ham hâlde "operatör execute" beklentisindedir. Çağrı paketi: `_docs/STAGING_EXECUTION_COMMANDS.md`.
- Faz 17B (production preflight) öncesi bu listenin gerçek bir staging üzerinde tek-tek imzalanması zorunlu.

---

## Faz 17C actual execution notes (2026-05-08)

- **Sonuç:** 🛑 **STAGING EXECUTION BLOCKED — STAGING SSH INFO REQUIRED**
- Kullanıcı bu fazda staging SSH/host/sudo/DB-state bilgilerinin **hiçbirini** sağlamadı. Spec gereği remote işlem **yapılmadı**.
- Lokal kanıtlar tazelendi:
  - `git rev-parse pre-production-mvp-baseline` = `ed83635d55aadb143bb362436be4c7e2da9ba5e5` ✅
  - `manage.py check` 0 issue, `makemigrations --dry-run` no changes
  - `bash -n` deploy.sh + backup.sh OK
  - `git archive --format=tar pre-production-mvp-baseline` → 623 entry, 3.3 MB, 0 hassas eşleşme — staging'e güvenli aktarılabilir.
- Tam test suite Faz 17B'de (2026-05-07) tazelenmişti: 449/449 PASS — bu fazda tekrar koşulmadı.
- 13 bölümün hiçbiri operatör tarafından imzalanmadı (staging yok).
- Faz 17C-bis: operatör SSH bilgisi sağladığında bu liste gerçek staging üzerinde tek-tek imzalanır.
