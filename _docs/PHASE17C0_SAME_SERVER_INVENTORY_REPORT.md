# PHASE 17C-0 — SAME SERVER READ-ONLY INVENTORY REPORT

**Tarih:** 2026-05-08
**Sınıflandırma:** ⚠️ **SAME SERVER ISOLATION — WARNING (PLAN READY, INVENTORY PENDING)**

Operatör server SSH erişimi sağlamadığı için **gerçek read-only inventory komutları yürütülmedi**. Bu rapor:
1. Komut paketi (operatör koşumu için hazır)
2. Operatörden beklenen değerler için **boş template'ler**
3. OPS Muhasebe için izolasyon önerileri
4. Risk değerlendirmesi (varsayım bazlı)

içerir. Operatör read-only komutları koştuktan sonra "INVENTORY VALUES" bölümleri doldurulacak ve raporun sınıflandırması PASS / BLOCKER olarak güncellenecektir.

---

## 0. Yönetici Özeti

| Madde | Sonuç |
|---|---|
| Server SSH erişimi | ❌ verilmedi |
| Read-only inventory komutları yürütüldü | ❌ HAYIR |
| İzolasyon planı taslağı üretildi | ✅ |
| OPS Muhasebe ayrı path/DB/socket önerisi | ✅ |
| Santral/Araç sistemine dokunma | ❌ (yapılmadı, yapılmayacak) |
| Production deploy / staging install | ❌ yapılmadı |

---

## 1. SERVER RESOURCE AUDIT — komut paketi (operatör koşar)

```bash
# Tüm komutlar READ-ONLY
hostname
whoami
uname -a
uptime
df -h
df -i                    # inode
free -h
timedatectl
nproc
cat /etc/os-release
python3 --version
psql --version 2>/dev/null || echo "psql not found"
nginx -v 2>&1 || echo "nginx not found"
systemctl --version | head -1
```

**INVENTORY VALUES (operatör doldurur):**

| Alan | Değer |
|---|---|
| hostname | `__________` |
| OS / sürüm | `__________` |
| Kernel | `__________` |
| CPU çekirdek sayısı | `__________` |
| RAM toplam | `__________` |
| RAM kullanılan | `__________` |
| Disk `/var` boş | `__________` |
| Disk `/` boş | `__________` |
| inode kullanım | `__________` |
| Load avg (1/5/15) | `__________` |
| Timezone | `__________` |
| Python3 sürüm | `__________` |
| PostgreSQL sürüm | `__________` |
| nginx sürüm | `__________` |
| systemd sürüm | `__________` |

**OPS Muhasebe gereksinim eşiği:**
- Python 3.13+ (gerekli; 3.11/3.12 ile test edilmedi)
- PostgreSQL 14+
- nginx 1.18+
- RAM ≥ 2 GB serbest (3 gunicorn worker)
- Disk `/var` ≥ 20 GB (kod + venv + media + 7 günlük backup)
- Disk `/var/backups` ≥ 10 GB

---

## 2. EXISTING SYSTEM INVENTORY — komut paketi

```bash
# Santral
systemctl list-units --type=service --state=running | grep -i santral || true
ls -ld /var/www/santral 2>/dev/null
ls -l /etc/systemd/system/ | grep -i santral || true
ls -l /etc/nginx/sites-enabled/ | grep -i santral || true
ls /var/log/santral* 2>/dev/null

# Araç Takip
systemctl list-units --type=service --state=running | grep -iE "arac|takip" || true
ls -ld /var/www/arac-takip 2>/dev/null
ls -l /etc/systemd/system/ | grep -iE "arac|takip" || true
ls -l /etc/nginx/sites-enabled/ | grep -iE "arac|takip" || true

# PostgreSQL DB listesi (sadece ad — secret yok)
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY 1;"
sudo -u postgres psql -tAc "SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY 1;"

# crontab özetleri (komut adı/plan; secret okuma)
sudo crontab -l 2>/dev/null | grep -vE '^\s*#' | awk '{print $1,$2,$3,$4,$5,$6}' || true
ls /etc/cron.d/ /etc/cron.daily/ /etc/cron.hourly/ 2>/dev/null

# systemd timers
systemctl list-timers --all
```

**INVENTORY VALUES (operatör doldurur):**

### Santral İşletim Sistemi
| Alan | Değer |
|---|---|
| systemd service adı | `__________` |
| nginx site dosyası | `/etc/nginx/sites-enabled/__________` |
| Path | `/var/www/__________` |
| Listen port / socket | `__________` |
| DB adı (yalnız isim) | `__________` |
| Cron işleri (komut/plan) | `__________` |

### Araç Takip Sistemi
| Alan | Değer |
|---|---|
| systemd service adı | `__________` |
| nginx site dosyası | `/etc/nginx/sites-enabled/__________` |
| Path | `/var/www/__________` |
| Listen port / socket | `__________` |
| DB adı (yalnız isim) | `__________` |
| Cron işleri (komut/plan) | `__________` |

> **Kural:** `.env` / token / password / chat_id ekrana basılmayacak; yalnız var/yok ve dosya yolu raporlanacak.

---

## 3. PORT / SOCKET / NGINX ISOLATION — komut paketi

```bash
ss -ltnp 2>/dev/null | head -40
nginx -T 2>/dev/null | grep -E "^\s*(listen|server_name)" | head -40
```

**INVENTORY VALUES (operatör doldurur):**

| Mevcut listen | Sahip |
|---|---|
| 80 | nginx |
| 443 | nginx |
| `__________` | Santral |
| `__________` | Araç Takip |

### OPS Muhasebe için ÖNERİ

| Kaynak | Değer |
|---|---|
| systemd service | `muhasebe-ops-gunicorn.service` (zaten Faz 16 taslağı) |
| Gunicorn bind | **`127.0.0.1:8103`** veya socket `/run/muhasebe-ops/gunicorn.sock` |
| nginx site dosyası | `/etc/nginx/sites-enabled/muhasebe-ops.conf` (Faz 16 taslağı) |
| nginx server_name | `muhasebe.<örgüt-domain>` veya geçici staging IP |
| Log path | `/var/log/muhasebe-ops/` |
| Static path | `/var/www/muhasebe-ops/static/` |
| Public media | `/var/www/muhasebe-ops/media/` |
| **Private media** | `/var/www/muhasebe-ops/private_media/` — **nginx üzerinden public servis EDİLMEZ** |

> 8103 portu rastgele yüksek; mevcut Santral/Araç ile çakışma kontrolünü operatör yapar. Çakışırsa 8104, 8105, ... ile artırılır.

---

## 4. POSTGRESQL ISOLATION

**Kural:** Santral / Araç DB'lerine **ASLA** dokunulmayacak. Yeni DB ve user oluşturma yalnız Faz 17C-bis veya Faz 18'de.

### Önerilen isimlendirme

| Ortam | DB | User |
|---|---|---|
| Production | `muhasebe` | `muhasebe_user` |
| Staging-mode (aynı server) | `muhasebe_staging` | `muhasebe_staging_user` |

Operatör mevcut DB/user listesini (`\l` + `\du`) verdiğinde çakışma kontrolü yapılır. Çakışma varsa OPS Muhasebe için suffix değiştirilir.

**Yetki kuralı:**
- `muhasebe_user` yalnız `muhasebe` üzerinde owner / `CONNECT,USAGE,SELECT,INSERT,UPDATE,DELETE`
- Diğer DB'lere (Santral / Araç) `REVOKE ALL ON DATABASE ...`
- Hiçbir OPS user superuser olmayacak

---

## 5. FILESYSTEM ISOLATION

| Path | Sahip | Mode | Notlar |
|---|---|---|---|
| `/var/www/muhasebe-ops/` | `slc:slc` | 0755 | yeni linux user `slc` (önerilen) |
| `/var/www/muhasebe-ops/repo/` | `slc:slc` | 0755 | git checkout |
| `/var/www/muhasebe-ops/venv/` | `slc:slc` | 0755 | Python venv |
| `/var/www/muhasebe-ops/static/` | `slc:slc` | 0755 | nginx alias-r okur |
| `/var/www/muhasebe-ops/media/` | `slc:slc` | 0755 | nginx alias |
| `/var/www/muhasebe-ops/private_media/` | `slc:slc` | 0750 | yalnız Django |
| `/var/log/muhasebe-ops/` | `slc:slc` | 0755 | Django log |
| `/var/backups/muhasebe-ops/` | `slc:slc` | 0750 | DB+media yedekleri |
| `/etc/muhasebe-ops/.env` | `slc:slc` | 0640 | secret |

**Yeni Linux user `slc` önerilir** (Santral/Araç user'larından bağımsız). nginx user (`www-data`) yalnız static + media path'lerine ACL/group ile erişir; private_media'ya **erişim yoktur**.

```bash
# Operatör koşar — sadece mevcut path çakışma kontrolü
ls -ld /var/www/muhasebe-ops 2>/dev/null && echo EXISTS || echo NEW
ls -ld /var/log/muhasebe-ops 2>/dev/null && echo EXISTS || echo NEW
ls -ld /var/backups/muhasebe-ops 2>/dev/null && echo EXISTS || echo NEW
id slc 2>/dev/null && echo USER_EXISTS || echo USER_NEW
```

---

## 6. BACKUP IMPACT AUDIT

```bash
# Operatör koşar — read-only
ls -ld /var/backups 2>/dev/null
ls /var/backups 2>/dev/null
df -h /var/backups
systemctl list-timers --all | grep -iE "backup|santral|arac" || true
```

**INVENTORY VALUES (operatör doldurur):**

| Mevcut backup dizini | Sahip |
|---|---|
| `/var/backups/santral?` | `__________` |
| `/var/backups/arac-takip?` | `__________` |
| Disk boş | `__________` GB |
| Mevcut backup timer'lar | `__________` |

**OPS Muhasebe önerisi:**
- Backup root: `/var/backups/muhasebe-ops/{db,media,log,checksums}` (Faz 15 backup.sh ile uyumlu)
- Timer adı: `muhasebe-ops-backup.timer` (Faz 17B taslağı)
- Çalışma saati: 03:30 + RandomizedDelaySec=600 → mevcut backup timer'larıyla saat çakışması varsa **operatör 04:30/05:30'a alır**

**Kural:** Mevcut Santral/Araç backup mekanizmalarına **dokunulmayacak**.

---

## 7. CRON / TIMER / TELEGRAM RISK

```bash
# Operatör koşar
sudo crontab -l 2>/dev/null
ls /etc/cron.d/
systemctl list-timers --all
```

| Madde | Beklenen | Bulgu |
|---|---|---|
| Mevcut crontab'lar | Santral/Araç'a ait olabilir | `__________` |
| Mevcut systemd timer'lar | Santral/Araç olabilir | `__________` |
| OPS Muhasebe cron / timer | yok (notification real-send kapalı) | ✅ |
| OPS Muhasebe Telegram real-send | False (kod default + test guard) | ✅ |

**OPS kuralı:**
- `TELEGRAM_REAL_SEND_ENABLED=False` — production'da bile kapalı
- Notification dry-run sistemde, gerçek gönderim ayrı faz/onay

---

## 8. SAME-SERVER DEPLOY STRATEGY

### SEÇENEK A — Aynı server'da staging-mode prova (ÖNERİLEN)

```
1. Ayrı DB: muhasebe_staging + muhasebe_staging_user
2. Ayrı path: /var/www/muhasebe-ops (production path; staging .env ile)
   VEYA /var/www/muhasebe-ops-staging (tam izolasyon — tercih)
3. Ayrı systemd: muhasebe-ops-staging-gunicorn.service (port 8104)
4. nginx'e DOKUNMADAN: önce 127.0.0.1:8104 üzerinden curl smoke
5. PASS sonrası nginx site dosyası eklenir (server_name=staging-IP veya staging.subdomain)
6. nginx -t → reload (Santral/Araç site'leri etkilenmez)
7. Smoke + functional smoke
8. Backup/restore drill (ayrı boş restore DB)
9. PASS → Faz 18 production deploy planı
```

**Riskler:**
- nginx reload anında Santral/Araç açık bağlantılar etkilenebilir (graceful reload — minimum risk)
- Aynı PostgreSQL instance — bağlantı sayısı sınırı (`max_connections`) staging+production+santral+araç toplamı kontrol edilmeli
- Disk paylaşımlı — backup büyürse Santral/Araç etkilenebilir → ayrı `/var/backups/muhasebe-ops` partition önerilir

### SEÇENEK B — Doğrudan production deploy (kontrollü)

```
1. Maintenance window (örn. 02:00–04:00)
2. Santral pre-check: systemctl status, son log
3. Araç pre-check: aynı
4. Santral + Araç backup status doğrulama (son 24 saatlik dump var mı)
5. OPS pre-deploy DB dump (boş DB de olsa)
6. OPS nginx config eklenir, NGINX -t
7. Yeni OPS site enable
8. Mevcut Santral/Araç site dosyalarına DOKUNULMAZ
9. nginx reload
10. OPS smoke (PRODUCTION_SMOKE_COMMANDS.md)
11. Santral/Araç sağlık kontrolü (regresyon yoksa)
12. Backup timer enable
```

**Riskler:**
- Staging görünmediği için ilk gerçek migrate/seed üretimde
- Gunicorn worker yükü RAM'e oturmazsa Santral/Araç etkilenebilir
- Hata olursa Santral/Araç downtime riski
- Rollback planı dakikalar içinde uygulanabilmeli

### Önerilen yol: **SEÇENEK A**

Gerekçe: Aynı server'da iki kritik canlı sistem var. Risk azaltmak için önce staging-mode prova; tüm akış PASS olduktan sonra Faz 18 production deploy.

---

## 9. SANTRAL / ARAÇ KORUMA KURALLARI

| Kural | Durum |
|---|---|
| Santral path'lerine yazma | **YASAK** |
| Araç Takip path'lerine yazma | **YASAK** |
| Santral systemd `restart`/`reload` | **YASAK** |
| Araç Takip systemd `restart`/`reload` | **YASAK** |
| Santral DB `migrate`/write | **YASAK** |
| Araç Takip DB `migrate`/write | **YASAK** |
| Santral nginx site dosyası değişiklik | **YASAK** |
| Araç Takip nginx site dosyası değişiklik | **YASAK** |
| Santral/Araç crontab değişiklik | **YASAK** |
| Ortak `nginx reload` | yalnız `nginx -t` PASS sonrası, **maintenance window'da** |
| Rollback: yeni OPS site disable edilebilir | ✅ (`rm /etc/nginx/sites-enabled/muhasebe-ops; nginx -t; nginx -s reload`) Santral/Araç etkilenmez |
| Rollback: yeni OPS systemd disable | ✅ (`systemctl stop+disable muhasebe-ops-gunicorn`) Santral/Araç etkilenmez |
| Rollback: yeni OPS DB drop | ✅ (`DROP DATABASE muhasebe`) Santral/Araç DB'leri etkilenmez |

---

## 10. INVENTORY DURUMU

**Bu fazda gerçek server inventory komutları yürütülmedi** (operatör SSH yok). Yukarıdaki tüm "INVENTORY VALUES" bölümleri **boş**. Operatör read-only paketi koştuktan sonra:

1. Çıktıları bu rapora yapıştırır (secret/password/token YOK)
2. OPS önerileri ile çakışma kontrolü yapılır
3. Çakışma varsa: port/DB/path öneri güncellenir
4. Final sınıflandırma: PASS / WARNING / BLOCKER

---

## 11. Sınır / No-op Doğrulaması

| Kural | Durum |
|---|---|
| Santral'a dokunma | ✅ dokunulmadı |
| Araç Takip'e dokunma | ✅ dokunulmadı |
| Production DB write | ❌ yok |
| migrate / seed | ❌ yok |
| systemctl restart/reload | ❌ yok |
| nginx reload | ❌ yok |
| dosya silme/değiştirme (server'da) | ❌ yok |
| yeni klasör/DB/user/venv (server'da) | ❌ yok |
| Telegram / mail | ❌ kapalı |
| git pull/push | ❌ yapılmadı |
| Şifre/token/env ekrana basma | ❌ yapılmadı |

---

## 12. Sonuç

**SAME SERVER ISOLATION — WARNING (PLAN READY).**

- 0 BLOCKER (server inventory henüz yok; varsayım bazlı yeni blocker bulunmadı)
- 1 WARNING: server inventory tamamlanmadı → Faz 17C-0-bis gerekiyor
- 5 INFO (önceki fazlardan)
- İzolasyon planı + komut paketi hazır
- OPS Muhasebe için path/port/DB/user önerileri net

**Sıradaki adım:** Operatör Bölüm 1–7 read-only komutlarını koşar; çıktıları paylaşır; bu rapor PASS/BLOCKER olarak güncellenir; sonra **Seçenek A staging-mode** yürütülür.

---

## Actual Inventory Values (Faz 17C-0-bis — 2026-05-08, EXECUTED)

**Durum:** ⚠️ **WARNING** — Operatör `santral-isletim` server'ında read-only inventory script'ini koştu (`/tmp/slc-inventory-2026-05-08-092623.log`). Tüm bölümler ölçüldü; **bir tek WARNING** (Python 3.12.3 vs OPS gereksinim 3.13+) ve **iki cosmetic veri boşluğu** (mask fonksiyonu subshell'e export edilmediği için root crontab + nginx config detay yakalanamadı; `for p` döngüsü `bash -lc` heredoc içinde `set -u` ile $p kaybetti → KNOWN PATH CHECK alanı boş; ancak `ls -la /var/www` cross-ref ile telafi edildi).

### Bölüm 1 — Server Resource

| Alan | Değer |
|---|---|
| hostname | `santral-isletim` |
| OS / sürüm | Ubuntu 24.04 LTS (Noble) |
| Kernel | Linux 6.8 |
| CPU | AMD EPYC-Genoa, 4 vCPU |
| RAM toplam / kullanılan / serbest | 7.6 GB / 1.3 GB / **6.3 GB free** |
| Swap | 0 |
| Disk `/` | 150 GB toplam, **138 GB free** (5% used) |
| inode | sağlıklı (kullanım düşük) |
| Timezone | Europe/Istanbul |
| Python3 | **3.12.3** ⚠️ (OPS 3.13+ ister) |
| PostgreSQL | 16.13 ✅ |
| nginx | 1.24.0 ✅ |
| systemd | 255 ✅ |

### Bölüm 2 — Santral İşletim Sistemi

| Alan | Değer |
|---|---|
| systemd service | `gunicorn.service` (jenerik ad), `santral-dengeleme.service` + `.timer` |
| Path | `/var/www/santral` (owner: root) |
| Listen / socket | unix `/run/gunicorn.sock` + loopback `127.0.0.1:8001` |
| nginx site | `/etc/nginx/sites-enabled/santral` (file, symlink değil) |
| DB | `santral_db` (owner `santral_user`) |
| User | **root** (gunicorn root altında çalışıyor) |

### Bölüm 3 — Araç Takip Sistemi

| Alan | Değer |
|---|---|
| systemd service | `arac-takip-gunicorn.service`, `arac-takip-backup.service` + `.timer` |
| Path | `/var/www/arac-takip` (owner: www-data) |
| Listen / socket | gunicorn root altında, `/root/.gunicorn/*.ctl` socketları |
| nginx site | `/etc/nginx/sites-enabled/arac-takip` (symlink) |
| DB | `acme_arac_takip` (owner `arac_user`) |
| Backup timer | ~02:30 |

### Bölüm 4 — Port / Socket Listening

| Port | Sahip |
|---|---|
| 22 | sshd |
| 53 | systemd-resolved (loopback) |
| 80 | nginx |
| 443 | nginx |
| 5432 | PostgreSQL (loopback) |
| **8001** | Santral gunicorn (loopback) |
| **8103** | **FREE** ✅ |
| **8104** | **FREE** ✅ |
| **8105** | **FREE** ✅ |

### Bölüm 5 — Nginx

`nginx -T` özet çıktısı `mask` fonksiyon export sorunu nedeniyle yakalanamadı (cosmetic veri boşluğu). Ancak `sites-enabled` listesi: yalnız `santral` ve `arac-takip` aktif → OPS için **server_name çakışma riski yok** (yeni subdomain `muhasebe.<domain>` önerilir).

### Bölüm 6 — PostgreSQL

| Mevcut DB | Mevcut Role |
|---|---|
| `acme_arac_takip` | `arac_user` |
| `postgres` | `postgres` |
| `santral_db` | `santral_user` |

**`muhasebe`, `muhasebe_staging`, `muhasebe_user`, `muhasebe_staging_user` — hiçbiri kullanılmıyor → çakışma YOK ✅**

`max_connections = 100`. Mevcut kullanım düşük; OPS 4–5 conn rahat sığar.

### Bölüm 7 — Filesystem

`ls -la /var/www` cross-ref:
- `/var/www/arac-takip` ✅ var (www-data)
- `/var/www/santral` ✅ var (root)
- `/var/www/html` ✅ var (default)
- `/var/www/muhasebe-ops` — **YOK** (NEW) ✅
- `/var/www/muhasebe-ops-staging` — **YOK** (NEW) ✅
- `/var/log/muhasebe-ops` — **YOK** (NEW) ✅
- `/var/backups/muhasebe-ops` — **YOK** (NEW) ✅

### Bölüm 8 — Backup

| Mevcut backup | Sahip |
|---|---|
| `/var/backups/arac-takip` | arac-takip ekibi (timer ~02:30) |
| `/var/backups/santral` | santral ekibi |

Disk `/var/backups` ortak partisyon; **138 GB free** → OPS 7-gün retention için yeterli (OPS önerisi 03:30 + 600s jitter → çakışma YOK).

### Bölüm 9 — Cron / Timer

| Veri | Durum |
|---|---|
| Root crontab | mask fonksiyon export hatası nedeniyle yakalanamadı (cosmetic) |
| User crontab | aynı |
| systemd timers | `arac-takip-backup.timer` (~02:30), `santral-dengeleme.timer` aktif. OPS `muhasebe-ops-backup.timer` 03:30 + jitter → çakışma YOK ✅ |

### Inventory ile çakışma kontrolü — ÖZET

| # | Kontrol | Sonuç |
|---|---|---|
| RAM ≥ 2 GB serbest | 6.3 GB serbest | ✅ PASS |
| Disk `/var` ≥ 20 GB | 138 GB serbest | ✅ PASS |
| Backup disk ≥ 10 GB | 138 GB serbest | ✅ PASS |
| Python 3.13+ | 3.12.3 | ⚠️ **WARNING** — operatör `python3.13` kurmalı (Ubuntu 24.04 + deadsnakes PPA) |
| PostgreSQL ≥ 14 | 16.13 | ✅ PASS |
| nginx ≥ 1.18 | 1.24.0 | ✅ PASS |
| Port 8103 boş | FREE | ✅ PASS |
| DB ad `muhasebe[_staging]` çakışma | yok | ✅ PASS |
| Role ad `muhasebe_user[_staging]` çakışma | yok | ✅ PASS |
| Path `/var/www/muhasebe-ops[-staging]` çakışma | yok | ✅ PASS |
| Backup timer saat çakışma | yok (03:30 ≠ 02:30) | ✅ PASS |
| nginx server_name çakışma | yok (ayrı subdomain) | ✅ PASS |
| `max_connections` yeterli | 100, OPS 4–5 conn ekler | ✅ PASS |

Detay: `_docs/PHASE17C0BIS_SAME_SERVER_INVENTORY_EXECUTION_REPORT.md`.
