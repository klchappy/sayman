# PRODUCTION ROLLBACK PLAN

**Faz 16 — Production Deploy Prep.**
Bu plan, deploy adımlarında ortaya çıkacak başarısızlık senaryolarına karşı geri-dönüş sırasıdır. Manuel çalıştırılır.

---

## 0. Karar matrisi

| Belirti | Aşama | Aksiyon |
|---|---|---|
| `manage.py check --deploy` FAIL | Pre-migrate | A: Kod rollback |
| `migrate` FAIL (yarım) | Migrate | B: DB restore + kod rollback |
| `collectstatic` FAIL | Post-migrate | C: Static rollback (DB sağlam) |
| Gunicorn start FAIL / 502 | Servis | D: Service rollback |
| Smoke FAIL — fonksiyonel hata | Post-deploy | E: Tam rollback |
| Veri kaybı şüphesi | Herhangi | F: Acil DB restore |

---

## A. Kod rollback (DB değişmedi)

```bash
sudo -iu slc
cd /var/www/muhasebe-ops/repo
git log --oneline -n 5
git checkout <önceki-commit-sha>
sudo systemctl restart muhasebe-ops-gunicorn.service
```

## B. Migrate yarım kaldı

1. **DB restore** (en güncel pre-deploy dump):
   ```bash
   LATEST=$(ls -1t /var/backups/muhasebe-ops/db/*.dump | head -n 1)
   echo "Restore: $LATEST"
   pg_restore --clean --if-exists -h 127.0.0.1 -U muhasebe -d muhasebe "$LATEST"
   ```
2. Kod rollback (A adımı).
3. `python manage.py showmigrations` → eski sürümle uyumlu olduğunu doğrula.

## C. Static rollback

```bash
sudo rm -rf /var/www/muhasebe-ops/static
git checkout <önceki-commit-sha> -- backend/
source /var/www/muhasebe-ops/venv/bin/activate
python /var/www/muhasebe-ops/repo/backend/manage.py collectstatic --noinput
sudo systemctl reload nginx
```

## D. Servis rollback

```bash
sudo systemctl status muhasebe-ops-gunicorn.service
sudo journalctl -u muhasebe-ops-gunicorn.service -n 100 --no-pager
sudo systemctl restart muhasebe-ops-gunicorn.service
# hâlâ FAIL ise:
sudo systemctl stop muhasebe-ops-gunicorn.service
# A adımı + restart
```

## E. Tam rollback

1. B (DB restore)
2. A (kod git checkout)
3. C (static)
4. D (servis restart)
5. Smoke `_docs/PRODUCTION_SMOKE_COMMANDS.md`

## F. Acil DB restore

```bash
sudo systemctl stop muhasebe-ops-gunicorn.service       # yazma kes
LATEST=$(ls -1t /var/backups/muhasebe-ops/db/*.dump | head -n 1)
pg_restore --clean --if-exists -h 127.0.0.1 -U muhasebe -d muhasebe "$LATEST"
sudo systemctl start muhasebe-ops-gunicorn.service
```

---

## Önkoşul (deploy ÖNCESİ alınacak)

- [ ] `pg_dump` — pre-deploy snapshot:
      `pg_dump -Fc -h 127.0.0.1 -U muhasebe -d muhasebe -f /var/backups/muhasebe-ops/db/predeploy-$(date +%F-%H%M).dump`
- [ ] `private_media` tar:
      `tar -czf /var/backups/muhasebe-ops/media/predeploy-$(date +%F-%H%M).tar.gz -C /var/www/muhasebe-ops private_media`
- [ ] `git rev-parse HEAD` → kayıt altına al

## Yetki kuralı

- DB restore yetkili: yalnız sistem yöneticisi.
- pg_restore --clean tüm tabloları boşaltır; DRY önce staging'de.
- Telegram / mail / cron'a rollback yokt — bu fazda zaten kapalı.
