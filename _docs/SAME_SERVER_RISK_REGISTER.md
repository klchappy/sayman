# SAME SERVER RISK REGISTER

**Faz 17C-0 çıktısı.** Aynı server'da Santral İşletim + Araç Takip + yeni OPS Muhasebe sistemi yan yana çalıştığında ortaya çıkabilecek riskler. Her risk için: olasılık × etki, azaltma stratejisi, sahibi.

---

## Risk Matrisi

| # | Risk | Olasılık | Etki | Skor | Sahip | Azaltma |
|---|---|---|---|---|---|---|
| **R1** | RAM/CPU kapasitesi yetmez; OPS worker'ları Santral/Araç'a baskı | Orta | Yüksek | 🟥 9 | Operatör | Inventory'de `free -h`, `nproc`, `uptime`. OPS 1.5–2 GB serbest RAM ister. Yetmezse worker=1 başlat |
| **R2** | PostgreSQL `max_connections` aşılır | Düşük | Yüksek | 🟧 6 | Operatör | `SHOW max_connections; SHOW superuser_reserved_connections;` toplam mevcut peak + 5 < limit kontrol; gerekirse `ALTER SYSTEM SET max_connections = N;` (yalnız bakım penceresinde) |
| **R3** | Gunicorn portu (`8103`) Santral/Araç ile çakışır | Düşük | Orta | 🟨 4 | Operatör | `ss -ltnp` ile kontrol; çakışmada 8104→8105→... |
| **R4** | nginx reload sırasında Santral/Araç açık bağlantıları kesilir | Düşük | Orta | 🟨 4 | Operatör | nginx graceful reload (`-s reload`) — mevcut bağlantılar tamamlanır; reload sonrası smoke |
| **R5** | Backup disk dolar → Santral/Araç backup'larını etkiler | Orta | Yüksek | 🟥 9 | Operatör | `df -h /var/backups` ≥ 10 GB free; OPS retention 7 gün; gerekirse OPS için ayrı partition |
| **R6** | OPS migrate sırasında PostgreSQL CPU spike → Santral/Araç latency | Düşük | Orta | 🟨 4 | Operatör | Maintenance window'da migrate; off-peak |
| **R7** | Yanlışlıkla Santral/Araç dosyalarına yazma (manuel hata) | Düşük | Yüksek | 🟧 6 | Operatör | systemd `ProtectSystem=full` + `ReadWritePaths` kernel garantisi; manuel komutlarda explicit path |
| **R8** | `.env` Santral/Araç user tarafından okunabilir | Düşük | Yüksek | 🟧 6 | Operatör | `/etc/muhasebe-ops/.env` mode 0640, owner slc:slc; `chmod o-rwx /etc/muhasebe-ops` |
| **R9** | `private_media` nginx üzerinden public sızar | Düşük | Yüksek | 🟧 6 | Geliştirici | nginx config'te `private_media` location YOK; Django `DocumentDownloadView` object-level permission (Faz 15 testleri) |
| **R10** | Yanlış DB adı çakışması (`muhasebe` ↔ Santral/Araç DB) | Düşük | Yüksek | 🟧 6 | Operatör | Inventory `\l` sonrası ad doğrulama; çakışmada suffix değişimi |
| **R11** | nginx -t FAIL ama reload yapılır → Santral/Araç down | Çok Düşük | Çok Yüksek | 🟥 9 | Operatör | Reload prosedürü sıkı: `nginx -t \|\| { echo ABORT; exit 1; }`; failure'da reload YOK |
| **R12** | OPS `audit_log` yüksek hacim → DB büyür | Orta | Orta | 🟨 4 | Geliştirici | Monitoring; gerekirse arşivleme/partitioning sonraki fazda |
| **R13** | OPS migration başarısız → DB partial state | Düşük | Yüksek | 🟧 6 | Operatör | Pre-deploy `pg_dump`; `PRODUCTION_ROLLBACK_PLAN.md` B adımı |
| **R14** | Telegram real-send yanlışlıkla açılır | Çok Düşük | Yüksek | 🟧 6 | Geliştirici | Kod default `False`; `TelegramRealSendStillDisabledTest` pytest guard'ı; `.env` `TELEGRAM_REAL_SEND_ALLOWED=False` |
| **R15** | SMTP yanlışlıkla aktif → mail spam | Çok Düşük | Yüksek | 🟧 6 | Geliştirici | Kod default `dummy.EmailBackend`; `.env` override |
| **R16** | Cron yanlışlıkla eklenir → otomatik komut | Çok Düşük | Orta | 🟨 4 | Operatör | Yalnız `muhasebe-ops-backup.timer` aktif; başka cron/timer yok |
| **R17** | Disk inode dolar → Santral/Araç dosya yazamaz | Düşük | Yüksek | 🟧 6 | Operatör | `df -i` izleme; OPS private_media büyük dosya politikası 100MB |
| **R18** | Aynı sertifika/Let's Encrypt rate limit | Düşük | Orta | 🟨 4 | Operatör | OPS için ayrı subdomain; `certbot --nginx -d muhasebe.<domain>` |
| **R19** | Logrotate yanlış config → Santral/Araç log dönüşü etkilenir | Çok Düşük | Orta | 🟨 2 | Operatör | OPS için ayrı `/etc/logrotate.d/muhasebe-ops`; mevcut config dosyalarına dokunma |
| **R20** | İzleme gözden kaçar — sessiz hata | Orta | Orta | 🟨 4 | Operatör | İlk hafta günlük `journalctl -u muhasebe-ops-gunicorn` + `audit_log` review |

**Skor:** olasılık (1–3) × etki (1–3). 🟥 ≥ 7 yüksek, 🟧 5–6 orta, 🟨 ≤ 4 düşük.

---

## Faz 17C-0-bis Ölçüm Sonrası Güncel Durum (2026-05-08)

| # | Risk | Ölçüm | Yeni Durum |
|---|---|---|---|
| R1 | RAM/CPU yetmez | 7.6 GB total / **6.3 GB free**, 4 vCPU | ✅ AZALTILDI (PASS) |
| R2 | PostgreSQL max_connections | `max_connections=100`, mevcut peak düşük | ✅ AZALTILDI (PASS) |
| R3 | Port 8103 çakışması | **8103/8104/8105 hepsi FREE** | ✅ AZALTILDI (PASS) |
| R5 | Backup disk dolar | `/var` 138 GB serbest, %5 used | ✅ AZALTILDI (PASS) |
| R10 | DB ad çakışması | mevcut DB: `santral_db`, `acme_arac_takip`, `postgres` — **çakışma yok** | ✅ AZALTILDI (PASS) |
| **R21 (yeni)** | Python 3.12 vs OPS 3.13+ gereksinimi | server'da **Python 3.12.3** | ✅ **KAPANDI** (Faz 17C-0-bis-3, 2026-05-08) — `python3.13` 3.13.13-1+noble1 deadsnakes PPA üzerinden kuruldu; sistem `python3` 3.12.3 olarak korundu; `/usr/bin/python3 -> python3.12` değişmedi; 4 kritik servis active; `python3.13 -m venv` + import OK; cleanup OK |
| **R22 (yeni)** | Santral gunicorn **root** altında çalışıyor | `/root/.gunicorn/*.ctl`, `/run/gunicorn.sock` | INFO — OPS ayrı `slc` user kullandığı için izolasyon korunur; sadece operatöre not |

**Sonuç:** En yüksek 5 risk sıralamasında R1, R5 ölçümle kapandı. R11 (nginx -t bypass) ve R7 (manuel hata) prosedürel — sıkı azaltma sabit kalır. **R21 yeni WARNING** olarak eklendi; Faz 17C-1 öncesi kapatılmalı.

---

## Faz 17C-0-bis-2 — Python 3.13 Verification Ön Risk Listesi (2026-05-08)

R21 kapatma fazı için kurulum öncesi ek riskler. Bu fazda lokal Claude oturumunun server SSH erişimi olmadığı için **kurulum yapılmadı**; aşağıdaki riskler operatör `_docs/PHASE17C0BIS2_PYTHON313_VERIFICATION_REPORT.md` komut paketini koşmadan önce göz önüne alınmalı.

| # | Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|---|
| **RX1** | `apt install python3.13` mevcut `python3.12` veya sistem paketini kaldırır | Düşük | Çok Yüksek | `apt-get -s install` dry-run ZORUNLU; REMOVE varsa kurulum abort |
| **RX2** | `update-alternatives` veya symlink değişimi → Santral/Araç `python3` çağrıları kırılır | Düşük | Çok Yüksek | `update-alternatives` YASAK; `readlink -f /usr/bin/python3` post-check `python3.12` döndürmeli |
| **RX3** | deadsnakes PPA ekleme sistem paket güvenini değiştirir | Orta (paket yoksa) | Orta | Önce `universe` denenir; PPA gerekirse ayrı yönetici onayı + ayrı risk raporu |
| **RX4** | apt-get update lock'ı Santral/Araç crontab'ı ile çakışır | Çok Düşük | Düşük | Bakım penceresi; gerekirse 1 dk bekle |
| **RX5** | `/tmp/slc-py313-venv` import hatası → OPS requirements 3.13 uyumsuz | Düşük | Orta | Bu fazda yalnız stdlib import; pip install YOK; OPS requirements ayrı fazda |
| **RX6** | Disk dolması (~150 MB kurulum + cache) | Çok Düşük | Düşük | 138 GB free → bol bol yer var |
| **RX7** | `python3.13-dev` C başlık dosyaları başka recommends paketlerini tetikler | Düşük | Düşük | Dry-run çıktısı kontrol; gerekirse `--no-install-recommends` |

**R21 kapanma kriteri (PASS):**
- `python3 --version` = `Python 3.12.3` (DEĞİŞMEMİŞ)
- `python3.13 --version` = `Python 3.13.x`
- `readlink -f /usr/bin/python3` = `/usr/bin/python3.12`
- 4 servis (`gunicorn`, `arac-takip-gunicorn`, `nginx`, `postgresql@16-main`) aktif
- `/tmp/slc-py313-venv` import check OK + cleanup OK

### 17C-0-bis-2 Bölüm 2-A Sonucu (operatör koşumu)

`/tmp/slc-py313-precheck-2026-05-08-095810.log` ile doğrulandı:
- `/usr/bin/python3 -> python3.12` ✅ korundu
- `python3.13` Noble universe'de YOK (apt-get -s: `Unable to locate package python3.13`)
- 4 servis ACTIVE ✅
- `software-properties-common` 0.99.49.4 kurulu — PPA yolu açık

**Universe yolu kapalı.** Kurulum için ek riskler:

| # | Risk (deadsnakes PPA) | Olasılık | Etki | Azaltma |
|---|---|---|---|---|
| **PPA-1** | PPA imza anahtarı sistem güveni | Orta | Orta | Launchpad standart key `BA6932366A755776` |
| **PPA-2** | PPA `python3.12` veya sistem paketini override eder | Düşük | Çok Yüksek | `apt-get -s install` dry-run REMOVE/PURGE kontrol; abort-on-detect |
| **PPA-3** | `apt-get update` diğer repolarla conflict | Düşük | Düşük | update çıktısı 200 OK kontrolü |
| **PPA-4** | `update-alternatives` otomatik tetiklenir | Çok Düşük | Çok Yüksek | `update-alternatives` YASAK; post-install symlink kontrolü |
| **PPA-5** | PPA kalıcı → gelecek `apt upgrade` Python sürpriz değişir | Düşük | Orta | `Pin-Priority: 100` ile `python3.13`'e sınırla |
| **PPA-6** | Hetzner mirror PPA proxy etmez | Yüksek | Düşük | Doğrudan Launchpad URL eklenir; mirror gerekmez |

**Alternatif Yol B — Pyenv (slc user altında):** sistem paket zinciri etkilenmez; ~15 dk derleme; build-time bağımlılıklar (`build-essential`, `libssl-dev`, `libffi-dev`, `libsqlite3-dev`) gerekir. Ayrı Faz 17C-0-bis-3 raporunda değerlendirilir.

---

## En Yüksek 5 Risk

1. **R1** RAM/CPU kapasitesi yetmez → 🟥 9
2. **R5** Backup disk dolar → 🟥 9
3. **R11** nginx -t FAIL'e rağmen reload → 🟥 9
4. **R7** Manuel hata Santral/Araç dosyalarına yazma → 🟧 6
5. **R13** OPS migration partial state → 🟧 6

---

## Risk Sınıflandırma Sonucu

| Sınıf | Sayı |
|---|---|
| BLOCKER (🟥, kabul edilemez ve azaltılamaz) | **0** |
| WARNING (🟥/🟧 azaltma stratejisi şart) | **9** |
| INFO / izlenecek (🟨 düşük) | **11** |

Hiçbir risk azaltma stratejisi olmadan kabul edilemez seviyede değil. **Aynı server'da staging-mode → production deploy yolu güvenli yürütülebilir.**

---

## Karar

**SAME SERVER RISK REGISTER — WARNING.**

- 0 BLOCKER
- 9 WARNING (sıkı azaltma stratejileri zorunlu)
- 11 INFO

Önerilen yol: **SEÇENEK A — Aynı server'da staging-mode prova**, sonra Faz 18 production deploy.

Önkoşul: Operatör Faz 17C-0 inventory komutlarını koşar; gerçek değerler doldurulur; çakışma kontrolü PASS olur.
