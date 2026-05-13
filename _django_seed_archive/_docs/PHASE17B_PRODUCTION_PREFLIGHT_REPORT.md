# PHASE 17B — PRODUCTION PREFLIGHT / FINAL DEPLOY GATE REPORT

**Tarih:** 2026-05-07
**Sınıflandırma:** ⚠️ **CONDITIONAL PASS** — Lokal preflight tarafı eksiksizdir; production deploy operatör staging koşumu **veya** kontrollü maintenance window onayı gerektirir.

---

## 0. Yönetici özeti

| Madde | Sonuç |
|---|---|
| `manage.py check` | ✅ 0 issue |
| `makemigrations --dry-run --check` | ✅ No changes detected |
| `bash -n deploy.sh` + `backup.sh` | ✅ |
| Tam test suite | ✅ **449/449 PASS** (Faz 17B'de tazelendi) |
| Git initial commit | ✅ `ed83635` + tag `pre-production-mvp-baseline` |
| Backup systemd timer/service taslakları | ✅ üretildi |
| Production preflight A–L | 6 PASS / 6 WARNING / 0 BLOCKER |
| Production deploy yapıldı mı | ❌ HAYIR |
| Telegram / mail / cron gerçek | ❌ kapalı |
| commit | ✅ var (push YOK) |

---

## 1. Precheck Sonucu

```
$ pwd
/c/Users/lenovo/Desktop/muhasebe-operasyon-seed

$ git status --short
(clean — initial commit sonrası)

$ git log --oneline -n 1
ed83635 Initial production-ready MVP baseline before deploy

$ git rev-parse HEAD
ed83635d55aadb143bb362436be4c7e2da9ba5e5

$ git tag --list
pre-production-mvp-baseline

$ python --version
Python 3.13.2

$ python manage.py check
System check identified no issues (0 silenced).

$ python manage.py makemigrations --dry-run --check
No changes detected

$ bash -n backend/scripts/deploy.sh && echo OK
DEPLOY_OK
$ bash -n backend/scripts/backup.sh && echo OK
BACKUP_OK
```

---

## 2. W2 — Tam Test Suite Tazelendi

```
$ python manage.py test -v 0
Ran 449 tests in 419.826s
OK
System check identified no issues (0 silenced).
```

**449/449 PASS.** Önceki Faz 15 baseline (449) ile birebir uyumlu, regresyon **0**. **W2 KAPATILDI.**

---

## 3. W1 — Staging Dry-Run Durumu

**Durum:** Remote staging hâlâ verilmedi. **W1 hâlâ AÇIK** ama production geçişi için 2 yol tanımlandı:

- **Yol A (önerilen):** Operatör staging VM kurar → `_docs/STAGING_EXECUTION_COMMANDS.md` 18 bölümü koşar → PASS sonrası production.
- **Yol B (yalnız acil):** Staging atla, kontrollü maintenance window + pre-deploy `pg_dump` + immediate rollback hazır.

**Detaylar:** `_docs/PRODUCTION_DEPLOY_GO_NO_GO.md` Bölüm 4 ve 5.
**Bu fazda eklendi:** Yol A/B karar evrakı, no-go koşulları, onay imza tablosu.

---

## 4. W3 — Git Initial Commit / Rollback Anchor

### Güvenlik kontrolü (commit ÖNCESİ)
- `.gitignore` aktif: `.env`, `*.sqlite3`, `media/`, `private_media/`, `_source_data/`, `__pycache__/`, `.venv/`, `*.dump`, `*.tar.gz`, `*.bak`, `*.pem`, `*.key`, `*.log`, `node_modules/` — tümü dışlanıyor.
- `git add -A --dry-run | grep -iE "xlsx|xls|rar|pdf|sqlite|\.env|\.key|\.pem|secret"` → **0 eşleşme**.
- 488 dosya stage edildi; hiçbiri secret/data değil.

### Commit
```
$ git add -A
$ git commit -m "Initial production-ready MVP baseline before deploy ..."
[master (root-commit) ed83635] Initial production-ready MVP baseline before deploy
 488 files changed, 60313 insertions(+)

$ git tag pre-production-mvp-baseline
$ git rev-parse HEAD
ed83635d55aadb143bb362436be4c7e2da9ba5e5
```

**W3 KAPATILDI.** Push yapılmadı. Tag: `pre-production-mvp-baseline`.

---

## 5. W4 — Backup systemd Timer/Service Taslakları

Yeni dosyalar:

### `deploy/systemd/muhasebe-ops-backup.service`
- `Type=oneshot`
- `User=slc`, `Group=slc`
- `EnvironmentFile=/etc/muhasebe-ops/.env`
- `ExecStart=/var/www/muhasebe-ops/repo/backend/scripts/backup.sh`
- Hardening: `NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome`, `PrivateTmp`, `ReadWritePaths` (sadece backup + log)
- `Nice=10`, IO best-effort
- `TimeoutStartSec=1800` (30 dk)
- `StandardOutput/Error=journal`

### `deploy/systemd/muhasebe-ops-backup.timer`
- `OnCalendar=*-*-* 03:30:00`
- `Persistent=true` (kaçırılan job)
- `RandomizedDelaySec=600`
- `WantedBy=timers.target`

**Bu fazda enable/start YAPILMADI.** Operatör production'da `systemctl enable --now muhasebe-ops-backup.timer`. **W4 KAPATILDI.**

---

## 6. Production Preflight Checklist A–L

`_docs/PRODUCTION_PREFLIGHT_CHECKLIST.md` "Faz 17B değerlendirmesi" bölümü güncellendi:

| Bölüm | Sonuç | Not |
|---|---|---|
| A. Kod & Repo | ⚠️ | commit/tag ✅; staging operatör |
| B. Sunucu | ⚠️ | operatör |
| C. .env | ⚠️ | şablon ✅; gerçek operatör |
| D. Path & izin | ⚠️ | şema operatör |
| E. DB | ⚠️ | dump/restore operatör |
| F. Servis (gunicorn + backup) | ✅ | tüm taslaklar üretildi |
| G. Nginx | ✅ | taslak |
| H. Smoke | ⚠️ | paket ✅; koşum operatör |
| I. No-op guards | ✅ | Telegram/SMTP/cron kapalı |
| J. Backup | ✅ | script + timer/service taslak |
| K. Monitoring | ✅ | journald + RotatingFileHandler |
| L. Rollback | ✅ | plan + commit anchor `ed83635` |

**6 PASS / 6 WARNING / 0 BLOCKER.**

WARNING'lerin tamamı **operatör koşumu** kategorisindedir. Hiçbir BLOCKER yoktur.

---

## 7. Production Readiness Delta (Faz 14 → 17B)

| Risk | Faz 14 | Faz 15 | Faz 16 | Faz 17A | Faz 17B |
|---|---|---|---|---|---|
| B1 requirements.txt yok | BLOCKER | ✅ kapalı | ✅ | ✅ | ✅ |
| B2 CSRF_TRUSTED_ORIGINS yok | BLOCKER | ✅ kapalı | ✅ | ✅ | ✅ |
| B3 Git repo yok | BLOCKER | ✅ init | ✅ | ✅ | ✅ **+ commit + tag** |
| B4 Document object permission | BLOCKER | ✅ kapalı | ✅ | ✅ | ✅ |
| W1 Path mismatch | WARNING | ✅ | ✅ | ✅ | ✅ |
| W2 Upload limit | WARNING | ✅ | ✅ | ✅ | ✅ |
| W3 Logging | WARNING | ✅ | ✅ | ✅ | ✅ |
| W4 Referrer policy | WARNING | ✅ | ✅ | ✅ | ✅ |
| W5 Backup script | WARNING | ✅ script | ✅ | ✅ | ✅ **+ timer unit** |
| Faz 17A W1 staging dry-run | — | — | — | OPEN | ⚠️ OPEN (operatör Yol A/B) |
| Faz 17A W2 full suite refresh | — | — | — | OPEN | ✅ kapalı (449/449) |
| Faz 17A W3 git commit | — | — | — | OPEN | ✅ kapalı (`ed83635`) |
| Faz 17A W4 backup timer unit | — | — | — | OPEN | ✅ kapalı (taslak) |

**Net delta:** Faz 17B sonrası **3/4 17A WARNING'i kapandı**, yalnız **W1 (staging)** operatör koşumuna devredildi.

---

## 8. Risk Register (Faz 17B sonrası)

### BLOCKER (0)
*(yok)*

### WARNING (1 + operatör görevleri)
| # | Risk | Detay | Aksiyon |
|---|---|---|---|
| W1 | Remote staging hâlâ koşulmadı | Faz 17A'dan devam | Operatör `STAGING_EXECUTION_COMMANDS.md` çalıştırır (Yol A); ya da maintenance window ile Yol B |

### INFO (5)
- Telegram dry-run bilinçli (manual-first)
- DB-backed chat (WebSocket yok)
- PDF export yok (Excel only)
- Scheduler / Celery yok
- Eski Excel import ertelenmiş (Faz 19+)

---

## 9. Çıktı Dosyaları

| # | Dosya | Tür |
|---|---|---|
| 1 | `_docs/PHASE17B_PRODUCTION_PREFLIGHT_REPORT.md` | bu rapor |
| 2 | `_analysis/reports/PHASE17B_PRODUCTION_PREFLIGHT_VERIFICATION.md` | doğrulama |
| 3 | `_docs/PRODUCTION_PREFLIGHT_CHECKLIST.md` | A–L Faz 17B değerlendirmesi eklendi |
| 4 | `_docs/PRODUCTION_DEPLOY_GO_NO_GO.md` | Yol A/B + onay tablosu |
| 5 | `deploy/systemd/muhasebe-ops-backup.service` | yeni (W4) |
| 6 | `deploy/systemd/muhasebe-ops-backup.timer` | yeni (W4) |

> Not: Bu Faz 17B çıktıları henüz commit'e dahil DEĞİL (commit Faz 17B'nin başında alındı). İstenirse Faz 18 başlangıcında ek commit alınabilir.

---

## 10. Sınır / No-op Doğrulaması

| Kural | Durum |
|---|---|
| Production deploy | ❌ yapılmadı |
| Production migrate | ❌ yapılmadı |
| Production seed | ❌ yapılmadı |
| Production DB write | ❌ yapılmadı |
| Production SSH | ❌ yapılmadı |
| Production nginx/systemd reload | ❌ yapılmadı |
| Telegram gerçek | ❌ kapalı + test ile doğrulandı |
| SMTP gerçek | ❌ dummy backend |
| Cron / scheduler | ❌ yok |
| Push | ❌ yapılmadı |
| Kaynak Excel/RAR/PDF | ❌ dokunulmadı |
| Design canvas | ❌ dokunulmadı |
| **Git commit (lokal, izin verilen)** | ✅ `ed83635` |
| **Git tag (lokal, izin verilen)** | ✅ `pre-production-mvp-baseline` |

---

## 11. Sonuç

**PHASE 17B — CONDITIONAL PASS.**

- 0 BLOCKER
- 1 OPEN WARNING (W1 — operatör staging)
- 6 PASS / 6 WARNING preflight maddesi (WARNING'lerin tamamı operatör görevi)
- 449/449 test PASS
- Commit + tag rollback anchor hazır
- Backup timer unit'leri taslak

**Karar:** Production deploy'a **lokal taraf** hazır. Operatör Yol A (staging önce) veya Yol B (acil maintenance window) ile Faz 18'e geçebilir.

**Önerilen sıradaki faz:** **Faz 18 — Production Deploy** (Yol A önerilir).
