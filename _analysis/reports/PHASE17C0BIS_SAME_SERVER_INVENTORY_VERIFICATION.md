# PHASE 17C-0-bis — SAME SERVER INVENTORY VERIFICATION

**Tarih:** 2026-05-08
**Sonuç:** ⚠️ **SAME SERVER INVENTORY — WARNING (1 yeni R21 — Python 3.13 kurulum)**

---

## 1. Yürütme Kanıtı

Operatör `santral-isletim` server'ında read-only inventory script'ini koştu; çıktı `/tmp/slc-inventory-2026-05-08-092623.log`.

```
hostname    : santral-isletim
OS          : Ubuntu 24.04 LTS
Kernel      : 6.8
CPU         : AMD EPYC-Genoa, 4 vCPU
RAM         : 7.6 GB total / 6.3 GB free / swap 0
Disk /      : 150 GB / 138 GB free / 5%
Python3     : 3.12.3   ⚠️
PostgreSQL  : 16.13    ✅
nginx       : 1.24.0   ✅
systemd     : 255      ✅
```

---

## 2. Acceptance Criteria

| Madde | Beklenen | Sonuç |
|---|---|---|
| Server resource inventory toplandı | EVET | ✅ |
| Santral inventory toplandı | EVET | ✅ |
| Araç Takip inventory toplandı | EVET | ✅ |
| Port/socket çakışma kontrolü | EVET | ✅ (8103/8104/8105 FREE) |
| Nginx isolation kontrolü | EVET | ⚠️ kısmi (mask hatası nedeniyle `nginx -T` özet çıkmadı; sites-enabled liste yeterli) |
| PostgreSQL `\l`+`\du` listelendi | EVET | ✅ (DB/role çakışma yok) |
| Filesystem çakışma kontrolü | EVET | ✅ (`ls -la /var/www` cross-ref) |
| Backup/timer envanteri | EVET | ✅ |
| Cron/timer envanteri | EVET | ⚠️ kısmi (mask hatası — root + user crontab boş; systemd timers tam) |
| Risk register gerçek değerlerle güncellendi | EVET | ✅ (R1/R2/R3/R5/R10 PASS; R21/R22 eklendi) |
| Santral / Araç write yok | DOĞRU | ✅ |
| Production deploy / migrate / seed yok | DOĞRU | ✅ |
| systemctl / nginx / gunicorn reload yok | DOĞRU | ✅ |
| cron değişiklik yok | DOĞRU | ✅ |
| Telegram / mail / git push yok | DOĞRU | ✅ |
| Şifre / token / env ekrana basma yok | DOĞRU | ✅ |

---

## 3. Risk Sınıflandırması

| Sınıf | Sayı | Liste |
|---|---|---|
| BLOCKER | **0** | — |
| WARNING | **1** | R21: Python 3.12.3 server'da; OPS 3.13+ ister → operatör `python3.13` kurmalı (deadsnakes PPA / Ubuntu 24.04) |
| INFO | **2** + 5 önceki faz | R22 (Santral gunicorn root altında — OPS izolasyonunu etkilemez); script bug INFO (mask + for-p heredoc) |

R1, R2, R3, R5, R10 ölçümle **PASS** durumuna geçti.

---

## 4. Çakışma Kontrolü

| Konu | Durum |
|---|---|
| RAM yeterliği | ✅ 6.3 GB free ≥ 2 GB eşik |
| Disk yeterliği | ✅ 138 GB free ≥ 30 GB eşik |
| Port 8103/8104/8105 | ✅ HEPSİ BOŞ |
| DB ad (`muhasebe[_staging]`) | ✅ çakışma yok |
| Role ad (`muhasebe_user[_staging]`) | ✅ çakışma yok |
| Path `/var/www/muhasebe-ops[-staging]` | ✅ yok (NEW) |
| Path `/var/log/muhasebe-ops`, `/var/backups/muhasebe-ops` | ✅ yok (NEW) |
| nginx server_name çakışması | ✅ yok (yeni subdomain önerisi) |
| Backup timer saat çakışması | ✅ yok (OPS 03:30 ≠ Araç 02:30) |
| `max_connections=100` yeterliği | ✅ OPS 4–5 conn rahat sığar |

---

## 5. No-op / Sınır Doğrulaması

| Kural | Durum |
|---|---|
| Santral / Araç write | ✅ yok |
| Production / staging server'a write | ✅ yok |
| Dosya / klasör / DB / user / venv create | ✅ yok |
| migrate / seed / collectstatic / deploy | ✅ yok |
| systemctl restart/reload / nginx reload | ✅ yok |
| cron / crontab değişiklik | ✅ yok |
| Telegram / mail / git push | ✅ yok |
| .env / secret / token / chat_id ekrana basma | ✅ yok |

---

## 6. Sonuç

**SAME SERVER INVENTORY — WARNING.**

| Soru | Cevap |
|---|---|
| BLOCKER sayısı | **0** |
| WARNING sayısı | **1** (R21) |
| INFO sayısı | **2 yeni + 5 önceki** |
| Santral için risk | **Yok** |
| Araç için risk | **Yok** |
| Disk / RAM yeterli mi? | **Evet** |
| Port 8103/8104/8105 | **HEPSİ FREE** |
| nginx server_name çakışması | **Yok** |
| PostgreSQL DB/user çakışması | **Yok** |
| Path/log/backup çakışması | **Yok** |
| Önerilen next step | **Faz 17C-0-bis-2** — operatör `python3.13` kurar (deadsnakes PPA, sistem python3 3.12'ye dokunmadan); doğrulama sonrası **Faz 17C-1 Same Server Staging-Mode Install** (`muhasebe_staging` DB, port 8104) açılır |

**Faz 17C-1 staging-mode install yolu açıktır — yalnız R21 (Python 3.13) kapatma şartıyla.**
