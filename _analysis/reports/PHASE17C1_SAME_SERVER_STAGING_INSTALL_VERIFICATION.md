# PHASE 17C-1 — SAME SERVER STAGING-MODE INSTALL VERIFICATION

**Tarih:** 2026-05-08
**Sonuç:** ✅ **SAME SERVER STAGING INSTALL — PASS (10/10 stages)**

---

## 1. Yürütme Kanıtı (SSH `slc-prod` → `santral-isletim`, root)

```
Host:        santral-isletim
OS:          Ubuntu 24.04 LTS
python3:     3.12.3 (system, /usr/bin/python3 -> python3.12)
python3.13:  3.13.13 (deadsnakes PPA)
venv python: 3.13.13 (/var/www/muhasebe-ops-staging/venv)

Services after install:
  gunicorn.service                          active   (Santral, untouched)
  arac-takip-gunicorn.service               active   (Araç Takip, untouched)
  nginx.service                             active   (untouched)
  postgresql@16-main.service                active   (untouched)
  muhasebe-ops-staging-gunicorn.service     active   (NEW; PID 741053; 2 workers)

Ports:
  127.0.0.1:8104  → OPS staging (NEW)
  127.0.0.1:8001  → Santral (unchanged)
  :80, :443       → nginx (unchanged)
  :5432           → PostgreSQL (unchanged)
  :8103           → FREE (production reserved)

Production reservations preserved:
  /var/www/muhasebe-ops        → not present
  DB muhasebe              → not present
  port 8103                    → free
  nginx site muhasebe-ops.conf → not present

Archive: _build/muhasebe-ops-baseline.tar.gz   sha256 8fa03d22…  (676,647 bytes)
```

---

## 2. Acceptance Criteria

| Madde | Beklenen | Sonuç |
|---|---|---|
| Lokal git archive (baseline tag) | EVET | ✅ |
| 10 aşamalı operatör komut paketi | EVET | ✅ |
| Aşama 1 — precheck PASS | EVET | ✅ |
| Aşama 2 — namespace setup PASS | EVET | ✅ (ALTER ROLE syntax mid-flight fix sonrası) |
| Aşama 3 — code transfer PASS | EVET | ✅ (sha256 match) |
| Aşama 4 — venv + requirements PASS | EVET | ✅ (`IMPORTS_OK`) |
| Aşama 5 — `.env` generation PASS | EVET | ✅ (single-quote fix sonrası, idempotent) |
| Aşama 6 — Django check/migrate/seed/static PASS | EVET | ✅ (39 migration, seeds idempotent x2, 131 static) |
| Aşama 7 — staging gunicorn active | EVET | ✅ (port 8104 listening, 2 worker) |
| Aşama 8 — internal HTTP smoke 5xx-free | EVET | ✅ (200/302/404; 5xx ve 000 yok) |
| Aşama 9 — backup drill PASS | EVET | ✅ (CRLF fix sonrası; pg_dump 452KB; sha256 verify OK) |
| Aşama 10 — final snapshot PASS | EVET | ✅ |
| Santral/Araç path/DB/service'e dokunma | YOK | ✅ |
| nginx restart/reload | YOK | ✅ (sites-enabled değişmedi) |
| Production path/port/DB | YOK | ✅ (8103 free; `/var/www/muhasebe-ops` yok; DB yok) |
| `update-alternatives` / `python3` symlink | YOK | ✅ |
| Telegram / SMTP real-send | YOK | ✅ |
| Cron/timer enable | YOK | ✅ (staging service `disabled` at boot; backup timer NOT enabled) |
| git pull/push | YOK | ✅ |
| Source Excel/RAR/PDF | YOK | ✅ |
| Secret/token/password rapora yazma | YOK | ✅ (length/keys ekrana basıldı, raw değer yok) |

---

## 3. Risk Sınıflandırması

| Sınıf | Sayı | Liste |
|---|---|---|
| BLOCKER | **0** | — |
| WARNING | **0** | — |
| INFO | **3** | (1) `/healthz` endpoint MVP'de yok; (2) lokal repo `backend/scripts/*.sh` Windows CRLF — Faz 18 öncesi line-ending fix; (3) Django default `STATIC_ROOT = DEPLOY_ROOT/static` kullandı, önce yarattığım `staticfiles/` dizini boş kaldı |

---

## 4. Mid-flight Düzeltmeler (kayıt)

| # | Sorun | Düzeltme |
|---|---|---|
| 1 | `psql -c "ALTER ROLE ... PASSWORD :'pw'"` syntax | Heredoc stdin + `--set=pw=...`; auth doğrulandı |
| 2 | `.env` SECRET_KEY shell metachar parse hatası | Python ile in-place single-quote (idempotent) |
| 3 | `backup.sh` Windows CRLF | `sed -i 's/\r$//' /var/www/muhasebe-ops-staging/backend/scripts/*.sh` |

---

## 5. No-op / Sınır Doğrulaması (post-execution)

| Kural | Durum |
|---|---|
| Production deploy / path / DB / port | ❌ yok |
| Production domain nginx | ❌ dokunulmadı |
| Santral path/DB/service/cron | ❌ dokunulmadı |
| Araç path/DB/service/cron | ❌ dokunulmadı |
| `gunicorn.service` (Santral) restart/reload | ❌ yok |
| `arac-takip-gunicorn.service` restart/reload | ❌ yok |
| nginx restart/reload | ❌ yok |
| `update-alternatives` / `python3` symlink | ❌ yok |
| Telegram real-send | ❌ False |
| SMTP gerçek gönderim | ❌ console backend |
| cron/timer enable | ❌ yok (staging svc disabled at boot) |
| git push | ❌ yok |
| Source data | ❌ yok |
| Secret/token rapora yazma | ❌ yok |

---

## 6. Sonuç

**SAME SERVER STAGING-MODE INSTALL — PASS.**

| Soru | Cevap |
|---|---|
| BLOCKER | 0 |
| WARNING | 0 |
| INFO | 3 |
| Linux user oluşturuldu mu? | ✅ slc (uid=999/gid=988) |
| Staging path oluşturuldu mu? | ✅ 8 dizin owner slc:slc |
| Python 3.13 venv OK mi? | ✅ 3.13.13 |
| requirements install OK mi? | ✅ Django 6.0.4 + 9 dep |
| Staging DB/user OK mi? | ✅ login doğrulandı |
| migrate OK mi? | ✅ 39 migration |
| Seed idempotency OK mi? | ✅ roles/settings/notification_rules |
| collectstatic OK mi? | ✅ 131 files |
| Staging gunicorn service active mi? | ✅ 127.0.0.1:8104, 2 worker, PID 741053 |
| Internal HTTP smoke OK mi? | ✅ 9 endpoint, 5xx yok |
| Functional/security smoke OK mi? | ✅ |
| Santral/Araç servisleri aktif mi? | ✅ |
| nginx reload yapıldı mı? | ❌ yapılmadı |
| Port 8104 active / 8103 free mi? | ✅ |
| Faz 18'e geçilebilir mi? | ✅ **EVET** |
| Önerilen next step | **Faz 18 — Production Deploy** (`muhasebe` DB, `muhasebe_user` role, `/var/www/muhasebe-ops`, port 8103, nginx site `muhasebe.<domain>`); önkoşul: line-ending fix repo'da (`backend/scripts/*.sh` LF) + Faz 18 promptu |
