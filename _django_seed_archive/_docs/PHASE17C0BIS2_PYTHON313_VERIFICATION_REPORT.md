# PHASE 17C-0-bis-2 — PYTHON 3.13 INSTALLATION VERIFICATION REPORT

**Tarih:** 2026-05-08
**Sınıflandırma:** ⚠️ **PYTHON 3.13 VERIFICATION WARNING — UNIVERSE PATHWAY UNAVAILABLE; DEADSNAKES PPA APPROVAL REQUIRED**

Operatör `santral-isletim` server'ında Bölüm 2-A read-only precheck script'ini koştu (`/tmp/slc-py313-precheck-2026-05-08-095810.log`). Kurulum (Bölüm 2-B) **yapılmadı** çünkü Ubuntu 24.04 Noble `universe` repo'sunda `python3.13` paketi yok. Kurulum yolu **deadsnakes PPA** üzerinden geçer; bu yol ayrı yönetici onayı + ayrı risk raporu gerektirir → bu fazda kurulum BLOCKED.

**Sonuç durumu:**
- `/usr/bin/python3` korundu (DEĞİŞMEDİ → `python3.12`)
- 4 servis hâlâ aktif (`gunicorn`, `arac-takip-gunicorn`, `nginx`, `postgresql@16-main`)
- Santral/Araç sistemine dokunulmadı
- R21 hâlâ AÇIK

---

## 0. Yönetici Özeti

| Madde | Sonuç |
|---|---|
| Server precheck (Bölüm 2-A) operatör tarafından koşuldu mu? | ✅ EVET (`/tmp/slc-py313-precheck-2026-05-08-095810.log`) |
| Python 3.13 paketi `apt-cache policy` sonucu | ❌ **Unable to locate package python3.13** (Noble universe sağlamıyor) |
| Python 3.13 kuruldu mu? | ❌ HAYIR (paket erişilebilir değil) |
| `/usr/bin/python3` korundu mu? | ✅ **DEĞİŞMEDİ** (`/usr/bin/python3 -> python3.12`, version `3.12.3`) |
| Santral / Araç / nginx / postgresql servisleri | ✅ **HEPSİ ACTIVE** (snapshot kanıtı) |
| `software-properties-common` mevcut mu? | ✅ EVET (0.99.49.4) — `add-apt-repository` kullanılabilir |
| Test venv `/tmp/slc-py313-venv` | ❌ oluşturulmadı (kurulum yapılmadı) |
| R21 durumu | ⚠️ AÇIK |
| Faz 17C-1 staging-mode install | 🛑 YASAK (R21 kapanmadı) |

**Kanıt (`/tmp/slc-py313-precheck-2026-05-08-095810.log` özeti):**
```
Host: santral-isletim
User: root
Date: 2026-05-08T09:58:10+03:00

### CURRENT PYTHON
Python 3.12.3
/usr/bin/python3
lrwxrwxrwx 1 root root 10 Nov 12 15:15 /usr/bin/python3 -> python3.12
python3.13: command not found

### SERVICE SNAPSHOT
gunicorn.service                    active
arac-takip-gunicorn.service         active
nginx.service                       active
postgresql@16-main.service          active

### APT POLICY
software-properties-common: Installed: 0.99.49.4 (Hetzner mirror noble-updates/main)
(python3.13 / python3.13-venv / python3.13-dev: NO entry → unavailable)

### DRY-RUN INSTALL
E: Unable to locate package python3.13
E: Unable to locate package python3.13-venv
E: Unable to locate package python3.13-dev

### REMOVE / PURGE CHECK
(empty — anlamsız, paket bulunamadı)
```

---

## 1. Yapılan / Yapılamayan Adımlar

| Adım | Durum |
|---|---|
| 1. Precheck (hostname/whoami/python3 --version/which/ls -l/systemctl status) | ✅ operatör koştu |
| 2. Python 3.13 paket erişilebilirliği (`apt-cache policy` + `apt-get -s install`) | ✅ koşuldu — **PAKET YOK** (Noble universe) |
| 3. Kurulum (`apt-get install -y python3.13 python3.13-venv python3.13-dev`) | ❌ koşulmadı (paket yok; ayrıca yönetici onayı gerekli) |
| 4. İzole test venv (`/tmp/slc-py313-venv`) + import check | ❌ koşulmadı (kurulum yok) |
| 5. Mevcut sistem güvenlik kontrolü (servisler aktif mi?) | ✅ snapshot — 4 servis ACTIVE |

---

## 2. Operatör için Komut Paketi (READ-ONLY önce, sonra onaylı kurulum)

> **Çalıştırma kuralı:** Aşağıdaki paket **iki bölümdür**. **Bölüm A** read-only — operatör koşar, çıktıyı paylaşır. **Bölüm B** kurulum — yalnızca yönetici onayı + Bölüm A çıktısı PASS sonrası koşulur. Aralarında karar vermek için Faz 17C-0-bis-2-RUN ikinci bir Claude oturumu yeterli.

### Bölüm A — READ-ONLY Precheck

```bash
LOG=/tmp/slc-py313-precheck-$(date +%F-%H%M%S).log
{
  echo "=== A1 — Identity ==="
  hostname; whoami; uname -a

  echo "=== A2 — Existing python3 (must remain 3.12.3) ==="
  python3 --version
  which python3
  ls -l /usr/bin/python3
  ls -l /usr/bin/python3.12 2>/dev/null || true
  readlink -f /usr/bin/python3

  echo "=== A3 — python3.13 already installed? ==="
  command -v python3.13 && python3.13 --version || echo "python3.13 NOT INSTALLED"

  echo "=== A4 — apt-cache policy (default repos) ==="
  apt-cache policy python3.13 python3.13-venv python3.13-dev 2>&1 | head -60
  apt-cache policy software-properties-common 2>&1 | head -10

  echo "=== A5 — Apt sources list (PPA tespiti) ==="
  ls -la /etc/apt/sources.list.d/ | head -30
  grep -h '^deb ' /etc/apt/sources.list /etc/apt/sources.list.d/*.list 2>/dev/null | head -40

  echo "=== A6 — Dry-run install plan (no actual install) ==="
  apt-get -s install python3.13 python3.13-venv python3.13-dev 2>&1 | tail -40

  echo "=== A7 — Mevcut servis durumu (snapshot, restart YOK) ==="
  systemctl is-active gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service
  systemctl status gunicorn.service --no-pager 2>&1 | head -10
  systemctl status arac-takip-gunicorn.service --no-pager 2>&1 | head -10

  echo "=== A8 — Disk durumu ==="
  df -h /var /usr /tmp
} > "$LOG" 2>&1
echo "Precheck log: $LOG"
```

**Operatör çıktıyı paylaşır → Faz 17C-0-bis-2'nin değerlendirme aşamasında karar verilir:**

| Senaryo | Karar |
|---|---|
| `apt-cache policy python3.13` `Candidate: 3.13.x` (Ubuntu 24.04 universe) ve `apt-get -s install` REMOVE içermez | ✅ Bölüm B'ye geçilebilir (universe) |
| `apt-cache policy python3.13` `Unable to locate` | ⚠️ deadsnakes PPA gerekli — yönetici onayı + ayrı risk raporu |
| `apt-get -s install` REMOVE/AUTOREMOVE içerir (özellikle python3.12 / python3-minimal / sistem paketleri) | 🛑 **BLOCKED** — kuruluma gidilmez |
| `python3` zaten `/usr/bin/python3.13` symlink'i ise (beklenmez) | 🛑 **BLOCKED** — Santral/Araç bozulur |

> **Kritik:** Ubuntu 24.04 (Noble) `universe` repo'sunda `python3.13` paketi **mevcut olabilir** (Noble 24.04.x backport listesi). `apt-cache policy` çıktısı buna kesin cevap verir. Operatör çıktıyı paylaşmadan kuruluma geçilmez.

### Bölüm B — Onaylı Kurulum (yalnız Bölüm A PASS + onay sonrası)

```bash
LOG=/tmp/slc-py313-install-$(date +%F-%H%M%S).log
{
  echo "=== B1 — Pre-install snapshot ==="
  python3 --version
  readlink -f /usr/bin/python3
  systemctl is-active gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service

  echo "=== B2 — apt update (sadece index, upgrade YOK) ==="
  sudo apt-get update

  echo "=== B3 — Install (NO update-alternatives, NO symlink change) ==="
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
       python3.13 python3.13-venv python3.13-dev

  echo "=== B4 — Post-install paths ==="
  command -v python3.13 && python3.13 --version
  ls -l /usr/bin/python3.13
  python3 --version                      # MUST still be 3.12.3
  readlink -f /usr/bin/python3            # MUST still point to python3.12

  echo "=== B5 — Service safety (NO restart/reload) ==="
  systemctl is-active gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service

  echo "=== B6 — Isolated test venv ==="
  rm -rf /tmp/slc-py313-venv
  python3.13 -m venv /tmp/slc-py313-venv
  /tmp/slc-py313-venv/bin/python --version
  /tmp/slc-py313-venv/bin/pip --version
  /tmp/slc-py313-venv/bin/python -c "import sys, venv, ssl, sqlite3, pathlib; print('IMPORTS OK', sys.version)"

  echo "=== B7 — Cleanup ==="
  rm -rf /tmp/slc-py313-venv
  ls -d /tmp/slc-py313-venv 2>/dev/null && echo "CLEANUP FAILED" || echo "CLEANUP OK"

  echo "=== B8 — Final snapshot ==="
  python3 --version
  python3.13 --version
  systemctl is-active gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service
} > "$LOG" 2>&1
echo "Install log: $LOG"
```

**Beklenen sonuç (PASS):**
- B4: `python3 --version` = `Python 3.12.3` (DEĞİŞMEMİŞ)
- B4: `python3.13 --version` = `Python 3.13.x`
- B4: `readlink -f /usr/bin/python3` = `/usr/bin/python3.12` (DEĞİŞMEMİŞ)
- B5 + B8: 4 servis de `active`
- B6: Tüm import'lar `OK`
- B7: Cleanup `OK`

Herhangi biri farklı çıkarsa → **BLOCKED**, rollback değerlendirmesi (apt-get autoremove güvenli mi).

---

## 3. Risk Değerlendirmesi (kurulum öncesi)

| # | Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|---|
| RX1 | `apt install python3.13` `python3.12` veya sistem paketini kaldırır | Düşük (Ubuntu 24.04 universe) | Çok Yüksek | `apt-get -s install` dry-run ZORUNLU; REMOVE varsa abort |
| RX2 | `update-alternatives` veya symlink değişimi → Santral/Araç python3 çağrıları kırılır | Düşük (komut paketi kullanmıyor) | Çok Yüksek | `update-alternatives` YASAK; `readlink -f /usr/bin/python3` post-check |
| RX3 | deadsnakes PPA eklenmesi sistem paket güvenini değiştirir | Orta (paket yoksa) | Orta | Önce universe denenir; PPA gerekirse ayrı yönetici onayı + ayrı faz |
| RX4 | apt-get update lock'ı Santral/Araç crontab'ı ile çakışır | Çok Düşük | Düşük | Bakım penceresi; gerekirse 1 dk bekle ve tekrar |
| RX5 | `/tmp/slc-py313-venv` içinde import hatası → OPS requirements 3.13 ile uyumsuz | Düşük | Orta | Bu fazda yalnız stdlib import; pip install YOK; OPS requirements ayrı fazda |
| RX6 | Disk dolması (kurulum + venv + cache ~150 MB) | Çok Düşük | Düşük | 138 GB free → bol bol yer var |
| RX7 | `python3.13-dev` C başlık dosyaları başka paketleri tetikler (`build-essential`?) | Düşük | Düşük | Dry-run çıktısı kontrol; gerekirse `--no-install-recommends` opsiyonu |

---

## 4. Sınır / No-op Doğrulaması (Bölüm 2-A koşumu sonrası)

| Kural | Durum |
|---|---|
| Santral / Araç sistemine yazma | ✅ yok |
| Production server'a yazma komutu | ✅ yok (yalnız read-only `apt-cache policy`, `apt-get -s` dry-run, `systemctl is-active`) |
| `/usr/bin/python3` symlink değişimi | ✅ yok (`-> python3.12` korunmuş) |
| `update-alternatives` | ✅ yok |
| Santral / Araç venv dokunma | ✅ yok |
| systemctl restart/reload | ✅ yok |
| nginx reload | ✅ yok |
| migrate / seed / DB user create | ✅ yok |
| OPS app deploy | ✅ yok |
| Telegram / mail / cron | ✅ yok |
| git pull/push | ✅ yok |
| Secret / token / password ekrana basma | ✅ yok |
| `/tmp/slc-py313-venv` oluşturma | ✅ yapılmadı (kurulum koşulmadı) |
| PPA repo eklenmesi | ✅ yapılmadı |
| `apt-get install` (gerçek) | ✅ yapılmadı |

---

## 5. Çıktı Dosyaları

| # | Dosya | Durum |
|---|---|---|
| 1 | `_docs/PHASE17C0BIS2_PYTHON313_VERIFICATION_REPORT.md` | ✅ bu rapor (BLOCKED) |
| 2 | `_analysis/reports/PHASE17C0BIS2_PYTHON313_VERIFICATION.md` | ✅ yeni (BLOCKED) |
| 3 | `_docs/SAME_SERVER_RISK_REGISTER.md` | ✅ R21 hâlâ açık + RX1–RX7 ön risk listesi eklendi |
| 4 | `_docs/SAME_SERVER_DEPLOY_ISOLATION_PLAN.md` | ✅ Python 3.13 satırı eklendi (gereksinim + yöntem) |
| 5 | `_docs/PRODUCTION_DEPLOY_GO_NO_GO.md` | ✅ Faz 17C-0-bis-2 satırı eklendi |

---

## 6. Bölüm 2-A Sonucu — Universe Pathway YOK; Deadsnakes PPA Yolu Gerekli

`apt-cache policy python3.13` ve `apt-get -s install python3.13` çıktıları Ubuntu 24.04 Noble `universe`/`main` repolarında `python3.13` paketinin **mevcut olmadığını** kesinleştirdi. Bu tipik durum — Noble (24.04) Python 3.12.x ile kilitli; 3.13.x backport yalnız **deadsnakes PPA** üzerinden gelir.

### 6.1 Deadsnakes PPA — Risk Tablosu (kurulum öncesi)

| # | Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|---|
| **PPA-1** | PPA repo eklenmesi sistem paket güven zincirini değiştirir (ek imza anahtarı) | Orta | Orta | `add-apt-repository ppa:deadsnakes/ppa` standart Launchpad anahtarı; key fingerprint doğrulaması: `BA6932366A755776` (F23C5A6CF475977595C89F51BA6932366A755776) |
| **PPA-2** | PPA `python3.12` veya sistem paketlerini override eder | Düşük | Çok Yüksek | Kurulum öncesi **`apt-get -s install` dry-run ZORUNLU** — REMOVE/UPGRADE çıkarsa abort |
| **PPA-3** | `apt-get update` sırasında diğer PPA/repolarla conflict | Düşük | Düşük | `update` çıktısında 200 OK kontrol |
| **PPA-4** | `update-alternatives` otomatik tetiklenir → `python3` symlink değişir | Çok Düşük | Çok Yüksek | `update-alternatives` YASAK; PPA paketi default'ta tetiklemez ama post-install `readlink -f /usr/bin/python3` doğrulama ZORUNLU |
| **PPA-5** | PPA kalıcı kalırsa gelecek `apt upgrade`'da Python sürüm sürpriz değişir | Düşük | Orta | PPA kurulumu sonrası `Pin-Priority: 100` ile `python3.13`'e sınırlama; Santral/Araç bağımlılıkları `python3.12` ile kilitli kalır |
| **PPA-6** | Hetzner mirror PPA'yı doğrudan sağlamaz, Launchpad'e doğrudan istek gerekir | Yüksek | Düşük | `add-apt-repository` Launchpad URL'sini eklemekle hallolur; mirror ayarı gerekmez |

### 6.2 Önerilen Komut Paketi — Bölüm 2-C (Deadsnakes PPA, yönetici onaylı)

> **YASAK:** Bu paketi **yönetici yazılı onayı + bakım penceresi** olmadan koşma.

```bash
LOG=/tmp/slc-py313-deadsnakes-$(date +%F-%H%M%S).log
{
  echo "=== C1 — Pre-snapshot ==="
  python3 --version
  readlink -f /usr/bin/python3
  systemctl is-active gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service
  ls /etc/apt/sources.list.d/ | head -30

  echo "=== C2 — Add deadsnakes PPA (read-only key + repo entry) ==="
  sudo add-apt-repository --yes ppa:deadsnakes/ppa
  ls -la /etc/apt/sources.list.d/ | grep -i deadsnakes

  echo "=== C3 — Apt update ==="
  sudo apt-get update

  echo "=== C4 — apt-cache policy after PPA ==="
  apt-cache policy python3.13 python3.13-venv python3.13-dev | head -40

  echo "=== C5 — Dry-run install (REMOVE/UPGRADE check) ==="
  apt-get -s install python3.13 python3.13-venv python3.13-dev 2>&1 | tail -50

  echo "=== C6 — STOP: dry-run REMOVE/PURGE varsa devam ETME ==="
  if apt-get -s install python3.13 python3.13-venv python3.13-dev 2>&1 | grep -qiE 'REMOV|PURGE'; then
    echo "ABORT — dry-run REMOVE/PURGE detected"
    exit 1
  fi

  echo "=== C7 — Install (NO update-alternatives) ==="
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       python3.13 python3.13-venv python3.13-dev

  echo "=== C8 — Post-install paths ==="
  command -v python3.13 && python3.13 --version
  ls -l /usr/bin/python3.13
  python3 --version                     # MUST still be 3.12.3
  readlink -f /usr/bin/python3           # MUST still point to python3.12

  echo "=== C9 — Service safety (NO restart/reload) ==="
  systemctl is-active gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service

  echo "=== C10 — Isolated venv smoke ==="
  rm -rf /tmp/slc-py313-venv
  python3.13 -m venv /tmp/slc-py313-venv
  /tmp/slc-py313-venv/bin/python --version
  /tmp/slc-py313-venv/bin/pip --version
  /tmp/slc-py313-venv/bin/python -c "import sys, venv, ssl, sqlite3, pathlib; print('IMPORTS OK', sys.version)"
  rm -rf /tmp/slc-py313-venv
  ls -d /tmp/slc-py313-venv 2>/dev/null && echo "CLEANUP FAILED" || echo "CLEANUP OK"

  echo "=== C11 — Final snapshot ==="
  python3 --version
  python3.13 --version
  systemctl is-active gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service
} > "$LOG" 2>&1
echo "Deadsnakes install log: $LOG"
```

**PASS koşulları (hepsi sağlanmalı):**
- C8: `python3 --version` = `Python 3.12.3` (DEĞİŞMEMİŞ)
- C8: `readlink -f /usr/bin/python3` = `/usr/bin/python3.12` (DEĞİŞMEMİŞ)
- C8: `python3.13 --version` = `Python 3.13.x`
- C9 + C11: 4 servis hâlâ `active`
- C10: import check `OK` + cleanup `OK`

### 6.3 Alternatif — Pyenv (Sistem-Paketsiz)

Yönetici PPA eklemek istemezse alternatif: `pyenv` ile `slc` user altında izole Python 3.13 derleme.
- Avantaj: sistem paket zinciri etkilenmez
- Dezavantaj: ~15 dk derleme süresi, `build-essential` + `libssl-dev` + `libffi-dev` + `libsqlite3-dev` build-time bağımlılıkları (hâlihazırda var olabilir)
- Karar: **Faz 17C-0-bis-3** ayrı raporda değerlendirilir

---

## 7. Sonuç

**PYTHON 3.13 VERIFICATION — WARNING.**

| Soru | Cevap |
|---|---|
| Python 3.13 kuruldu mu? | ❌ **HAYIR** (Noble universe paketi sağlamıyor) |
| `/usr/bin/python3` korundu mu? | ✅ **EVET** — `python3.12`, version 3.12.3 |
| Santral / Araç servisleri aktif mi? | ✅ EVET (gunicorn, arac-takip-gunicorn ACTIVE) |
| nginx / postgresql aktif mi? | ✅ EVET (nginx, postgresql@16-main ACTIVE) |
| Test venv başarılı mı? | ❌ oluşturulmadı (kurulum yok) |
| R21 kapandı mı? | ❌ AÇIK (devam) |
| Faz 17C-1'e geçilebilir mi? | 🛑 HAYIR — R21 kapanmadan |

**Önerilen next step (operatör + yönetici tercihi):**

| Yol | Komut paketi | Onay | Risk |
|---|---|---|---|
| **A. Deadsnakes PPA** | Bölüm 6.2 (C1–C11) | Yönetici yazılı onayı + bakım penceresi | PPA-1..6 (en kritik PPA-2 dry-run REMOVE kontrolü) |
| **B. Pyenv (slc user altında, sistem paketsiz)** | Faz 17C-0-bis-3 ayrı rapor | Yönetici onayı | Düşük — sistem paket zinciri dokunulmaz; ~15 dk build |
| **C. Vazgeç — OPS requirements'i 3.12 ile uyumlu hale getirmeyi değerlendir** | — | Geliştirici testi | OPS test suite'i 3.12 ile çalıştırma + güvenlik regresyon riski |

**Önerilen:** Yol A (deadsnakes PPA) eğer yönetici PPA güveniyle uyumluysa; aksi halde Yol B (pyenv). Yol C **SON ÇARE** (449 testin tamamı 3.12'de yeniden koşulmalı + Django 6.0.4 + psycopg 3.x uyumluluk doğrulaması).
