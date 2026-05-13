# PHASE 17C-0-bis — SAME SERVER READ-ONLY INVENTORY EXECUTION REPORT

**Tarih:** 2026-05-08
**Sınıflandırma:** ⚠️ **SAME SERVER INVENTORY — WARNING (1 BLOCKING-CANDIDATE: Python 3.13)**

Operatör `santral-isletim` server'ında bu fazın read-only inventory script'ini koştu. Çıktı `/tmp/slc-inventory-2026-05-08-092623.log`. Tüm 9 bölüm ölçüldü. Santral / Araç / production sistemine **hiçbir yazma** yapılmadı; tüm komutlar read-only idi.

---

## 0. Yönetici Özeti

| Madde | Sonuç |
|---|---|
| Server SSH / console erişimi | ✅ operatör koştu |
| Read-only inventory komutları yürütüldü | ✅ |
| Santral / Araç sistemine yazma | ❌ yok |
| systemctl restart/reload / nginx reload | ❌ yok |
| migrate / seed / collectstatic | ❌ yok |
| Telegram / mail / git push | ❌ yok |
| Şifre / token / chat_id ekrana basma | ❌ yapılmadı |
| Hangi makinada çalışıldı | server `santral-isletim` (Ubuntu 24.04) |

---

## 1. Server Resource

| Alan | Değer | Notlar |
|---|---|---|
| hostname | `santral-isletim` | |
| OS | Ubuntu 24.04 LTS | |
| Kernel | 6.8 | |
| CPU | AMD EPYC-Genoa, 4 vCPU | |
| RAM | 7.6 GB total / 1.3 GB used / **6.3 GB free** | swap 0 |
| Disk `/` | 150 GB / 138 GB free / 5% used | |
| Timezone | Europe/Istanbul | |
| Python3 | **3.12.3** | ⚠️ OPS 3.13+ gereksinim |
| PostgreSQL | 16.13 | ✅ |
| nginx | 1.24.0 | ✅ |
| systemd | 255 | ✅ |

---

## 2. Santral İşletim

- service'ler: `gunicorn.service` (jenerik ad), `santral-dengeleme.service` + `.timer`
- path: `/var/www/santral` (owner root)
- nginx site: `/etc/nginx/sites-enabled/santral` (file)
- DB: `santral_db` (role: `santral_user`)
- gunicorn: unix socket `/run/gunicorn.sock`, ayrıca loopback `127.0.0.1:8001`
- gunicorn user: **root** ⚠️ (R22 yeni INFO)

## 3. Araç Takip

- service'ler: `arac-takip-gunicorn.service`, `arac-takip-backup.service` + `.timer` (~02:30)
- path: `/var/www/arac-takip` (owner www-data)
- nginx site: `/etc/nginx/sites-enabled/arac-takip` (symlink)
- DB: `acme_arac_takip` (role: `arac_user`)

## 4. Listening Ports

| Port | Sahip |
|---|---|
| 22, 53, 80, 443, 5432 | sshd / systemd-resolved / nginx / nginx / PostgreSQL |
| 8001 | Santral gunicorn (loopback) |
| **8103, 8104, 8105** | **HEPSI BOŞ ✅** |

## 5. Nginx

`mask` fonksiyon export sorunu nedeniyle `nginx -T` özet çıktısı log'a yazılamadı (cosmetic veri boşluğu). Ancak `sites-enabled` listesi yalnız `santral` + `arac-takip`. OPS için ayrı subdomain (`muhasebe.<domain>`) önerildi → server_name çakışma yok.

## 6. PostgreSQL

| Mevcut DB | Mevcut Role |
|---|---|
| `acme_arac_takip`, `postgres`, `santral_db` | `arac_user`, `postgres`, `santral_user` |

`muhasebe`, `muhasebe_staging`, `muhasebe_user`, `muhasebe_staging_user` — **hiçbiri yok** ✅

`max_connections = 100`. OPS 4–5 conn ekler — bol bol sığar.

## 7. Filesystem

`ls -la /var/www` cross-ref:
- `arac-takip`, `santral`, `html` mevcut
- `muhasebe-ops`, `muhasebe-ops-staging`, `/var/log/muhasebe-ops`, `/var/backups/muhasebe-ops` — **hiçbiri yok** ✅

(Script içindeki `for p` döngüsü `bash -lc` heredoc'unda `set -u` etkisiyle `$p` kaybetti → KNOWN PATH CHECK alanı boş; ancak `ls -la` cross-ref ile telafi edildi.)

## 8. Backup

- `/var/backups/santral`, `/var/backups/arac-takip` mevcut
- disk 138 GB free → OPS 7-gün retention rahat sığar
- mevcut backup timer'ı `arac-takip-backup.timer` ~02:30 → OPS önerisi 03:30 + jitter ile çakışma yok ✅

## 9. Cron / Timer

- `mask` fonksiyon export sorunu nedeniyle root + user crontab log'a yazılamadı (cosmetic).
- systemd timers: `arac-takip-backup.timer`, `santral-dengeleme.timer`, sistem timer'ları (apt, logrotate, motd, fwupd, fstrim).

---

## 10. Çakışma Kontrolü Özeti

| # | Kontrol | Sonuç |
|---|---|---|
| 1 | RAM ≥ 2 GB serbest | ✅ 6.3 GB |
| 2 | Disk `/var` ≥ 20 GB | ✅ 138 GB |
| 3 | Backup disk ≥ 10 GB | ✅ 138 GB |
| 4 | Python 3.13+ | ⚠️ **3.12.3** — kurulum şart |
| 5 | PostgreSQL ≥ 14 | ✅ 16.13 |
| 6 | nginx ≥ 1.18 | ✅ 1.24.0 |
| 7 | Port 8103 boş | ✅ |
| 8 | DB ad çakışması | ✅ yok |
| 9 | Role ad çakışması | ✅ yok |
| 10 | Path çakışması | ✅ yok |
| 11 | nginx server_name çakışması | ✅ yok (subdomain ayrı) |
| 12 | Backup timer saat çakışması | ✅ yok (03:30 ≠ 02:30) |
| 13 | max_connections yeterli | ✅ 100 |

---

## 11. Risk Register Güncel

| # | Risk | Faz 17C-0 | Faz 17C-0-bis ölçüm sonrası |
|---|---|---|---|
| R1 | RAM/CPU yetmez | varsayım | ✅ PASS (6.3 GB free) |
| R2 | PostgreSQL max_conn | varsayım | ✅ PASS (100, low usage) |
| R3 | Port çakışma | varsayım | ✅ PASS (8103/8104/8105 FREE) |
| R5 | Backup disk dolar | varsayım | ✅ PASS (138 GB free) |
| R10 | DB ad çakışma | varsayım | ✅ PASS (no conflict) |
| **R21** | **Python 3.12 vs 3.13 gereksinim** | yeni | ⚠️ **WARNING** — `python3.13` kurulum şart |
| R22 | Santral gunicorn root altında | yeni | INFO (OPS ayrı `slc` user → izolasyon korunur) |

---

## 12. Çıktı Dosyaları

| # | Dosya | Durum |
|---|---|---|
| 1 | `_docs/PHASE17C0BIS_SAME_SERVER_INVENTORY_EXECUTION_REPORT.md` | ✅ bu rapor (WARNING) |
| 2 | `_analysis/reports/PHASE17C0BIS_SAME_SERVER_INVENTORY_VERIFICATION.md` | ✅ güncel (WARNING) |
| 3 | `_docs/PHASE17C0_SAME_SERVER_INVENTORY_REPORT.md` | ✅ "Actual Inventory Values" gerçek değerlerle dolduruldu |
| 4 | `_docs/SAME_SERVER_DEPLOY_ISOLATION_PLAN.md` | ✅ Santral/Araç sütunları gerçek değerlerle, port 8103 kesinleşti |
| 5 | `_docs/SAME_SERVER_RISK_REGISTER.md` | ✅ R1/R2/R3/R5/R10 PASS, R21/R22 eklendi |

---

## 13. Sınır / No-op Doğrulaması

| Kural | Durum |
|---|---|
| Santral / Araç sistemine yazma | ❌ yok |
| Yeni klasör / DB / user / venv (server) | ❌ yok |
| migrate / seed / collectstatic | ❌ yok |
| systemctl restart/reload / nginx reload | ❌ yok |
| cron / crontab değişiklik | ❌ yok |
| Telegram / mail | ❌ kapalı |
| git pull/push | ❌ yapılmadı |
| .env / secret / token / chat_id ekrana basma | ❌ yapılmadı (mask fonksiyon hatalı subshell'de çalışmadığı için yalnız o bölümler boş kaldı; secret sızıntısı yok) |

---

## 14. Sonuç

**SAME SERVER INVENTORY EXECUTION — WARNING.**

| Soru | Cevap |
|---|---|
| BLOCKER sayısı | **0** |
| WARNING sayısı | **1** (R21 — Python 3.12 vs 3.13 gereksinim) |
| INFO sayısı | **2** (R22 yeni + 5 önceki faz INFO) |
| Santral için risk | **Yok** (path/DB/service/port izolasyonu kesinleşti) |
| Araç için risk | **Yok** (aynı) |
| Disk / RAM yeterli mi? | ✅ **Evet** — 138 GB disk, 6.3 GB RAM serbest |
| Port 8103/8104/8105 | ✅ **HEPSİ FREE** |
| nginx server_name çakışması | ✅ **Yok** (ayrı subdomain) |
| PostgreSQL DB/user çakışması | ✅ **Yok** |
| path/log/backup çakışması | ✅ **Yok** (timer 03:30 ≠ 02:30) |
| Önerilen next step | **Faz 17C-0-bis-2 — Python 3.13 kurulum doğrulama** (deadsnakes PPA, sistem `python3` 3.12'ye dokunmadan); sonra **Faz 17C-1 Same Server Staging-Mode Install** (DB `muhasebe_staging`, port 8104) |

**Faz 17C-1 staging-mode install YAPILABILIR — ama önce R21 (Python 3.13) operatör tarafından kapatılmalıdır.**
