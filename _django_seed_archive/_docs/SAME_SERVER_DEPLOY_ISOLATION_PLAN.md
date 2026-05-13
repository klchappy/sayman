# SAME SERVER DEPLOY ISOLATION PLAN

**Faz 17C-0 çıktısı.** Muhasebe Operasyonları yeni sistemi, halihazırda canlı çalışan iki kritik sistemle (Santral İşletim, Araç Takip) **aynı server** üzerinde devreye alınacak. Bu plan, izolasyon kurallarını, namespace ayrımını ve Santral/Araç koruma sınırlarını tanımlar.

---

## 1. Namespace Ayrımı

| Kaynak | Santral | Araç Takip | **OPS Muhasebe (yeni)** |
|---|---|---|---|
| Linux user | `root` ⚠️ | `www-data` | **`slc`** (yeni, ayrı) |
| Path | `/var/www/santral` | `/var/www/arac-takip` | **`/var/www/muhasebe-ops`** |
| Repo / kod | `/var/www/santral` | `/var/www/arac-takip` | `/var/www/muhasebe-ops/repo` |
| Venv | (Santral içinde) | (arac-takip içinde) | `/var/www/muhasebe-ops/venv` |
| Static | (Santral içinde) | (arac-takip içinde) | `/var/www/muhasebe-ops/static` |
| Public media | (Santral içinde) | (arac-takip içinde) | `/var/www/muhasebe-ops/media` |
| Private media | yok | yok | `/var/www/muhasebe-ops/private_media` (nginx public yok) |
| Log | `/var/log/santral_*` | `/var/log/arac-takip` | `/var/log/muhasebe-ops` |
| Backup | `/var/backups/santral` | `/var/backups/arac-takip` | `/var/backups/muhasebe-ops` |
| Env (secret) | (Santral içinde) | (arac-takip içinde) | `/etc/muhasebe-ops/.env` (0640, owner slc:slc) |
| systemd service | `gunicorn.service` (jenerik), `santral-dengeleme.service` | `arac-takip-gunicorn.service`, `arac-takip-backup.service` | `muhasebe-ops-gunicorn.service` |
| systemd timer | `santral-dengeleme.timer` | `arac-takip-backup.timer` (~02:30) | `muhasebe-ops-backup.timer` (03:30 + jitter) |
| nginx site | `/etc/nginx/sites-enabled/santral` | `/etc/nginx/sites-enabled/arac-takip` | `/etc/nginx/sites-enabled/muhasebe-ops.conf` |
| nginx server_name | (Santral) | (arac-takip) | `muhasebe.<domain>` veya geçici staging IP |
| Gunicorn bind | unix `/run/gunicorn.sock` + `127.0.0.1:8001` | unix `/root/.gunicorn/*.ctl` | **`127.0.0.1:8103`** (FREE ✅) |
| PostgreSQL DB | `santral_db` | `acme_arac_takip` | `muhasebe` / `muhasebe_staging` (çakışma yok ✅) |
| PostgreSQL user | `santral_user` | `arac_user` | `muhasebe_user` / `muhasebe_staging_user` (çakışma yok ✅) |

> ✅ **Faz 17C-0-bis (2026-05-08) inventory ile doldurulmuştur.** Port/DB/role/path çakışması yok.
> ✅ **Faz 17C-0-bis-3 (2026-05-08) — Python 3.13.13 kuruldu (deadsnakes PPA, R21 KAPANDI).** Sistem `python3` 3.12.3 olarak korundu; 4 kritik servis active; izole venv smoke OK.

### Python 3.13 Yöntemi (Faz 17C-0-bis-2)

| Madde | Karar |
|---|---|
| Sistem `python3` | **DOKUNULMAZ** — `/usr/bin/python3` `python3.12.3` olarak kalır |
| `update-alternatives` | **YASAK** |
| Kurulum komutu | `apt-get install -y python3.13 python3.13-venv python3.13-dev` (Ubuntu 24.04 universe denenir; yoksa deadsnakes PPA ayrı onayla) |
| OPS venv yaratımı | `python3.13 -m venv /var/www/muhasebe-ops[-staging]/venv` |
| OPS servis başlatma | `ExecStart=/var/www/muhasebe-ops/venv/bin/gunicorn ...` (sistem `python3`'e referans yok) |
| Doğrulama | `_docs/PHASE17C0BIS2_PYTHON313_VERIFICATION_REPORT.md` Bölüm 2-A precheck + 2-B install + isolated venv smoke |

**Faz 17C-1 Same Server Staging-Mode Install önkoşulu:** R21 kapanmalı (Python 3.13 kurulu + 4 servis hâlâ aktif + `/usr/bin/python3` 3.12 olarak korunmuş).

---

## 2. Sıkı İzolasyon Kuralları

### 2.1 Filesystem
- OPS user `slc`, **Santral/Araç user'larından farklı**.
- nginx user (`www-data`) yalnız `/var/www/muhasebe-ops/static` ve `/var/www/muhasebe-ops/media` path'lerine **read** erişimi (group/ACL).
- `/var/www/muhasebe-ops/private_media` mode `0750`, group `slc`. **www-data ÜYE DEĞİL.**
- `/etc/muhasebe-ops/.env` mode `0640`, owner `slc:slc`. nginx/postgres user okuyamaz.

### 2.2 systemd
- `muhasebe-ops-gunicorn.service` directives: `User=slc`, `Group=slc`, `ProtectSystem=full`, `ProtectHome=true`, `PrivateTmp=true`, `NoNewPrivileges=true`, `ReadWritePaths=/var/www/muhasebe-ops /var/log/muhasebe-ops /var/backups/muhasebe-ops`.
- Bu directives nedeniyle OPS servisi **Santral/Araç path'lerine yazamaz** (kernel düzeyinde garanti).
- Backup timer ayrı unit (`muhasebe-ops-backup.timer/service`); başka unit etkilenmez.

### 2.3 Gunicorn / port
- OPS bind: `127.0.0.1:8103` (loopback only). Public erişim yalnız nginx üzerinden.
- Mevcut Santral/Araç gunicorn portlarıyla **çakışmamalı**. Operatör inventory'sinde çakışma varsa OPS için bir sonraki boş port (8104, 8105, ...) seçilir.

### 2.4 Nginx
- OPS için **AYRI** site dosyası: `/etc/nginx/sites-enabled/muhasebe-ops.conf`.
- Mevcut Santral/Araç site dosyalarına **dokunulmaz** (open/edit YASAK).
- `nginx -t` PASS sonrası `nginx -s reload` (graceful) → açık bağlantılar etkilenmez.
- Reload öncesi `nginx -T` çıktısında OPS `server_name` değerinin Santral/Araç ile çakışmadığı doğrulanır.

### 2.5 PostgreSQL
- OPS DB ve user, Santral/Araç DB/user'larından **bağımsız**.
- `muhasebe_user` superuser DEĞİL; yetki yalnız kendi DB'sinde.
- Santral/Araç DB'lerine `REVOKE ALL ON DATABASE santral_db FROM muhasebe_user;` (her yeni DB için).
- `pg_hba.conf` değişikliği gerekirse **yalnız OPS satırı eklenir**, mevcut satırlar değiştirilmez.
- `max_connections` yeterliliği kontrol edilir: Santral + Araç + OPS (3 worker × 1 conn) + backup = toplam mevcut limitin altında olmalı.

### 2.6 Cron / Timer
- OPS için cron yok. Yalnız `muhasebe-ops-backup.timer`.
- Backup saati `03:30` + RandomizedDelaySec=600. Mevcut timer'larla **saat çakışması varsa operatör 04:30/05:30'a alır**.
- Telegram real-send `False` (kod default + test guard).

---

## 3. nginx Reload Prosedürü (KRİTİK)

```bash
# 1. Yeni site dosyasını ekle (Santral/Araç dosyalarına dokunma)
sudo cp /var/www/muhasebe-ops/repo/deploy/nginx/muhasebe-ops.conf \
        /etc/nginx/sites-available/muhasebe-ops.conf
sudo ln -sf /etc/nginx/sites-available/muhasebe-ops.conf \
            /etc/nginx/sites-enabled/muhasebe-ops.conf

# 2. SYNTAX kontrol — FAIL ise HİÇBİR ŞEY yapma
sudo nginx -t || { echo "ABORT — nginx -t FAIL"; exit 1; }

# 3. Yalnız PASS sonrası graceful reload
sudo nginx -s reload

# 4. Santral/Araç sağlık kontrolü (smoke)
curl -sI https://santral.<domain>/healthz | head -1
curl -sI https://arac-takip.<domain>/healthz | head -1
# Her ikisi 200/302 olmalı; FAIL ise rollback (4. adım)
```

### Rollback (Santral/Araç etkilenirse)
```bash
sudo rm /etc/nginx/sites-enabled/muhasebe-ops.conf
sudo nginx -t && sudo nginx -s reload
sudo systemctl stop muhasebe-ops-gunicorn.service
sudo systemctl disable muhasebe-ops-gunicorn.service
# DB drop yalnız operatör + yönetici onayı ile:
# sudo -u postgres dropdb muhasebe
```

Bu rollback Santral/Araç dosyaları/servisleri/DB'lerine **dokunmaz**.

---

## 4. Önerilen Deploy Yolu

**SEÇENEK A — Aynı server'da staging-mode prova** *(önerilen)*

```
1. Operatör Faz 17C-0 inventory komutlarını koşar → INVENTORY VALUES doldurulur
2. Çakışma yoksa Faz 17C-0 sınıflandırması PASS
3. Faz 17C-bis-A (staging-mode):
   - DB: muhasebe_staging
   - Path: /var/www/muhasebe-ops-staging  VEYA  /var/www/muhasebe-ops + staging .env
   - Service: muhasebe-ops-staging-gunicorn (port 8104)
   - nginx: önce DOKUNMA, 127.0.0.1:8104 üzerinden curl smoke
   - Smoke + functional + security smoke + backup/restore drill PASS
4. PASS → Faz 18 production deploy:
   - DB: muhasebe
   - Path: /var/www/muhasebe-ops
   - Service: muhasebe-ops-gunicorn (port 8103)
   - nginx site dosyası eklenir; nginx -t → reload
   - PRODUCTION_SMOKE_COMMANDS.md 1–9 PASS
   - backup timer enable
```

**Tahmini süre:** Inventory 30 dk + staging-mode 90 dk + production 60 dk.

---

## 5. Riskler ve Azaltma

| # | Risk | Azaltma |
|---|---|---|
| R1 | Aynı server RAM yetmez | Inventory'de `free -h` kontrol; OPS 1.5–2 GB headroom ister |
| R2 | Aynı PostgreSQL `max_connections` aşılır | Inventory'de `SHOW max_connections;` ve mevcut peak; OPS 4–5 conn ekler |
| R3 | Gunicorn portu çakışır | Inventory'de `ss -ltnp`; çakışmada bir sonraki boş porta kayar |
| R4 | nginx reload Santral/Araç açık conn'larını keser | nginx graceful reload — açık conn'lar tamamlanır; reload sonrası smoke |
| R5 | Backup disk dolar → Santral/Araç backup'larını etkiler | Inventory'de `df -h /var/backups`; dar ise OPS için ayrı disk/partition önerisi |
| R6 | OPS migrate sırasında Santral/Araç PostgreSQL latency yaşar | Maintenance window'da migrate; veya off-peak saat |
| R7 | Yanlışlıkla Santral/Araç dosyalarına yazma | systemd `ProtectSystem=full` + `ReadWritePaths` ile kernel garanti |
| R8 | `.env` OPS dışındaki user tarafından okunur | mode `0640`, owner `slc:slc` |
| R9 | private_media nginx üzerinden public sızar | nginx config'te `private_media` location YOK; yalnız Django |
| R10 | Yanlış DB adı çarpışması | Inventory `\l` listesi sonrası ad doğrulanır |

---

## 6. Onay imzaları

| Rol | Karar | Tarih | İmza |
|---|---|---|---|
| Operatör | | | |
| Yönetici | | | |
| Santral sorumlusu | | | |
| Araç Takip sorumlusu | | | |

Tüm imzalar tamamlanmadan **Faz 17C-bis-A staging-mode başlatılmaz**.
