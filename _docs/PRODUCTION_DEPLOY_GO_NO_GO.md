# PRODUCTION DEPLOY — GO / NO-GO

**Tarih:** 2026-05-07
**Karar:** ⚠️ **CONDITIONAL GO** — Lokal preflight tarafı eksiksizdir; gerçek production deploy operatör staging koşumu / kontrollü maintenance window onayına bağlıdır.

---

## 1. Karar Matrisi

| Yol | Koşul | Tavsiye |
|---|---|---|
| **A. Önce gerçek staging** | Staging VM/sunucu temin et → `STAGING_EXECUTION_COMMANDS.md` koş → tüm akışlar PASS → production deploy | **ÖNERİLEN** — düşük risk |
| **B. Staging atla, kontrollü production** | Maintenance window + pre-deploy `pg_dump` + immediate rollback hazır + smoke 5 dk içinde | **KOŞULLU** — yalnız operatör + yönetici onayıyla |
| **C. Erken deploy / acele** | — | **YASAK** |

**Önerilen:** **Yol A.** Yol B yalnız zaman kısıtı varsa ve operatör + yönetici imzasıyla.

---

## 2. Hazır olanlar (lokal preflight)

| Madde | Durum |
|---|---|
| `manage.py check` | ✅ 0 issue |
| `makemigrations --dry-run --check` | ✅ No changes |
| Full test suite | ✅ 449/449 (Faz 17B'de tazelendi) |
| `bash -n deploy.sh` | ✅ |
| `bash -n backup.sh` | ✅ |
| Production settings env override | ✅ doğru değerler |
| `.env.production.example` | ✅ secret-free |
| systemd gunicorn unit | ✅ taslak |
| nginx conf | ✅ taslak (110m, private_media public yok) |
| gunicorn conf | ✅ taslak |
| systemd backup service+timer | ✅ Faz 17B taslak |
| Git baseline | ✅ commit `ed83635` + tag `pre-production-mvp-baseline` |
| Rollback plan | ✅ A–F senaryolar |
| Smoke checklist | ✅ 9 adım |
| Staging execution commands | ✅ 18 bölüm |
| No-op guards (Telegram/SMTP/cron) | ✅ kapalı |

---

## 3. Hazır olmayanlar (operatör tarafı)

| Madde | Sorumlu | Yeri |
|---|---|---|
| Gerçek staging dry-run koşumu | Operatör | `STAGING_EXECUTION_COMMANDS.md` |
| `/etc/muhasebe-ops/.env` (gerçek secret) | Operatör | Sunucu, 0640 |
| OS / PostgreSQL kurulumu | Operatör | Ubuntu/Debian |
| `/var/www/muhasebe-ops/...` klasör + izin | Operatör | Sunucu |
| TLS sertifikası (Let's Encrypt) | Operatör | certbot |
| Pre-deploy `pg_dump` | Operatör | Deploy başlangıcı |
| systemd unit'lerinin enable + start'ı | Operatör | `systemctl` |
| Smoke 1–9 koşumu | Operatör | `PRODUCTION_SMOKE_COMMANDS.md` |
| `PRODUCTION_PREFLIGHT_CHECKLIST.md` A–L imza | Operatör + Yönetici | son onay |

---

## 4. Yol A — Önerilen güvenli deploy stratejisi

```
0. Staging VM hazırla
1. STAGING_EXECUTION_COMMANDS.md 18 bölüm koş
2. Çıktıları kayıt et
3. Sorun varsa fix → Faz 18A patch raporu
4. Sorunsuz ise:
   4a. Production sunucu kurulumu (klasörler, .env, PostgreSQL)
   4b. git clone + venv + requirements
   4c. Pre-deploy pg_dump (boş DB de olsa)
   4d. CONFIRM_DEPLOY=yes deploy.sh
   4e. systemctl enable --now muhasebe-ops-gunicorn
   4f. nginx -t && systemctl reload nginx
   4g. PRODUCTION_SMOKE_COMMANDS.md 1–9 PASS
   4h. systemctl enable --now muhasebe-ops-backup.timer
5. PRODUCTION_PREFLIGHT_CHECKLIST.md A–L imzalanır
6. Operatör + yönetici onay
7. CANLI
```

**Tahmini süre:** Staging 60–90 dk + production 45–60 dk.

---

## 5. Yol B — Staging atlama (yalnız acil)

Önkoşul (zorunlu):
- Yönetici yazılı onayı
- Maintenance window 2 saat
- Operatör + yedek operatör ekipte

Akış:
```
1. Pre-deploy pg_dump alınır (kritik)
2. Pre-deploy private_media tar.gz
3. Pre-deploy git tag commit
4. CONFIRM_DEPLOY=yes deploy.sh
5. Smoke 1–9 koşulur — herhangi adım FAIL ise rollback (PRODUCTION_ROLLBACK_PLAN.md)
6. 30 dk gözlem
7. backup timer enable
```

**Risk:** Staging görünmediği için ilk gerçek migrate/seed üretimde olur. Operatör hazırda rollback komutuyla.

---

## 6. NO-GO koşulları

Aşağıdakilerden HERHANGİ BİRİ doğruysa **deploy YAPILMAZ:**

- Test suite < 449/449
- `manage.py check` issue var
- `makemigrations --dry-run` "changes detected"
- `bash -n` script FAIL
- Pre-deploy pg_dump alınmadı
- Operatör + yönetici onayı yok
- Domain DNS / TLS hazır değil
- `/etc/muhasebe-ops/.env` 0640 ve owner=slc:slc değil
- TELEGRAM_REAL_SEND_ALLOWED=True veya EMAIL_BACKEND ≠ dummy

---

## 7. Onay imzaları

| Rol | İsim | Karar (GO / NO-GO / CONDITIONAL) | Tarih | İmza |
|---|---|---|---|---|
| Operatör | | | | |
| Yönetici | | | | |
| Yedek Operatör | | | | |

---

## 8. Faz 17B kararı

**CONDITIONAL GO:** Lokal preflight tarafından deploy'a hazırız. Operatör Yol A (tercihen) veya Yol B (acil) ile devam edebilir. Yol B seçilirse maintenance window + pre-deploy pg_dump zorunludur.

---

## 9. Faz 17C kararı (2026-05-08)

🛑 **STAGING EXECUTION BLOCKED — STAGING SSH INFO REQUIRED.**

Operatör staging VM/SSH bilgilerini sağlamadığı için Yol A bu fazda yürütülemedi. Lokal preflight kanıtları tazelendi (tag `pre-production-mvp-baseline` = `ed83635`, `bash -n` OK, `manage.py check` 0 issue, deploy bundle 623 dosya 0 hassas).

### Faz 18 için güncel öneri

| Senaryo | Karar |
|---|---|
| Operatör SSH bilgisi sağlayacak | **Faz 17C-bis** koşulur → PASS sonrası Faz 18 |
| Operatör staging atlayıp acil deploy | **Yol B** — yönetici yazılı onayı + maintenance window + pre-deploy `pg_dump` zorunlu |
| Hiçbiri | **Faz 18 YASAK** — bekle |

**Production deploy doğrudan geçişi YASAK** — en az aşağıdakilerden biri zorunlu:
1. Faz 17C-bis PASS
2. Yol B yazılı onay paketi

Bunlardan biri tamamlanmadan Faz 18 başlatılmaz.

---

## 10. Faz 17C-0 / 17C-0-bis / 17C-0-bis-2 Güncel Durum

| Faz | Tarih | Sonuç |
|---|---|---|
| 17C-0 (plan/template) | 2026-05-08 | ⚠️ WARNING — plan + komut paketi hazır |
| 17C-0-bis (inventory execution) | 2026-05-08 | ⚠️ WARNING — operatör `santral-isletim` üzerinde read-only inventory koştu; port/DB/role/path çakışması yok; 1 WARNING (R21 Python 3.12 vs 3.13) |
| 17C-0-bis-2 (Python 3.13 verification) | 2026-05-08 | ⚠️ **WARNING** — operatör Bölüm 2-A precheck koştu. `/usr/bin/python3 -> python3.12` korunmuş, 4 servis ACTIVE. **Noble universe `python3.13` paketi YOK** (`Unable to locate`). Kurulum yolu: deadsnakes PPA (Bölüm 6.2 C1–C11) **veya** pyenv (slc user altında). Yönetici onayı + ayrı Faz 17C-0-bis-3 ile kurulum yapılır. R21 hâlâ AÇIK |
| 17C-0-bis-3 (Python 3.13 PPA install) | 2026-05-08 | ✅ **PASS** — `python3.13` 3.13.13-1+noble1 deadsnakes PPA üzerinden kuruldu. Sistem `python3` = 3.12.3 (DEĞİŞMEDİ); `/usr/bin/python3 -> python3.12` korundu; 4 kritik servis active (kurulum öncesi/sonrası aynı); `python3.13 -m venv` + import OK + cleanup OK. **R21 KAPANDI**. Faz 17C-1 yolu açık. |

**Same-server staging-mode yolu (yeni):**
```
17C-0     plan + komut paketi  ✅
17C-0-bis inventory execution  ✅ WARNING (R21)
17C-0-bis-2 Python 3.13 install verification  ⚠️ WARNING (precheck OK; universe yok; PPA/pyenv onayı lazım)
17C-0-bis-3 Python 3.13 install (deadsnakes PPA, 3.13.13-1+noble1)  ✅ PASS — R21 KAPANDI
17C-1     Same-server staging-mode install (DB muhasebe_staging, port 8104) ✅ PASS (10/10 stages, ssh slc-prod, 2026-05-08)
17C-1     PASS sonrası → Faz 18 production deploy (port 8103)
```

**Faz 17C-1 ön koşulu:** R21 kapanmalı (Python 3.13 kuruldu, sistem `python3` 3.12 olarak korundu, 4 servis aktif).
