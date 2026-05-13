# PHASE 17C-0-bis-3 — PYTHON 3.13 DEADSNAKES PPA CONTROLLED INSTALL REPORT

**Tarih:** 2026-05-08
**Sınıflandırma:** ✅ **PYTHON 3.13 PPA INSTALL — PASS (R21 CLOSED)**

Yönetici onayı alındı (2026-05-08): deadsnakes PPA + sadece `python3.13`, `python3.13-venv`, `python3.13-dev` paketleri; sistem `python3` symlink'i değiştirilmeyecek; Santral/Araç sistemine dokunulmayacak. Lokal Claude oturumu Windows makinasında (`hostname=TT`); production server'a bağlı olmadığı için kurulumu kendi koşamam → operatör Bölüm 2'deki tek-dosya script'i koşar, log'u paylaşır.

---

## 0. Yönetici Özeti

| Madde | Sonuç |
|---|---|
| Yönetici onayı (deadsnakes PPA) | ✅ alındı |
| Onay kapsamı | yalnız `python3.13`, `python3.13-venv`, `python3.13-dev` |
| Sistem `python3` symlink korunması | ✅ taahhüt (script `update-alternatives` kullanmaz, symlink touch yok) |
| Santral / Araç venv & service dokunma | ✅ taahhüt (script `systemctl restart/reload` kullanmaz) |
| Operator script çalıştırdı mı? | ⏳ HENÜZ |
| R21 durumu | ⚠️ AÇIK (kurulum bekleniyor) |
| Faz 17C-1 staging-mode install | 🛑 YASAK (R21 kapanmadan) |

---

## 1. Onay Notu

> **Operatör/Yönetici (2026-05-08):** "Python 3.13 için Deadsnakes PPA kullanılmasını onaylıyorum. Kurulum yalnız python3.13 / python3.13-venv / python3.13-dev paketleriyle sınırlı olacak. Sistem python3 symlink'i değiştirilmeyecek. Santral ve Araç sistemlerine dokunulmayacak."

Bu onay aşağıdaki script'in koşulması için yeterlidir. Script kasıtlı olarak fail-safe — dry-run REMOVE/PURGE algılarsa otomatik abort eder, symlink değişimi/servis restart komutu içermez.

---

## 2. Operatör Komut Paketi — Tek Dosya, Copy-Paste-Hazır

> **Server:** `santral-isletim`
> **User:** `root` (veya `sudo` yetkili kullanıcı)
> **Süre:** ~2–3 dk
> **Çıktı:** `/tmp/slc-py313-deadsnakes-<timestamp>.log`

```bash
cat > /tmp/slc_py313_install.sh <<'EOF'
#!/usr/bin/env bash
set -u
set -o pipefail

LOG="/tmp/slc-py313-deadsnakes-$(date +%F-%H%M%S).log"

abort() {
  echo "ABORT: $1" | tee -a "$LOG"
  exit 1
}

{
  echo "OPS PYTHON 3.13 DEADSNAKES PPA INSTALL"
  echo "Generated at: $(date -Is)"
  echo "Host: $(hostname)   User: $(whoami)"
  echo "Approval: deadsnakes PPA, only python3.13/-venv/-dev, no symlink change, no Santral/Araç touch"
  echo

  echo "=== 1. PRE-SNAPSHOT ==="
  python3 --version
  ls -l /usr/bin/python3
  readlink -f /usr/bin/python3
  command -v python3.13 && python3.13 --version || echo "python3.13: not installed"
  echo "--- services ---"
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    printf "%-40s %s\n" "$s" "$(systemctl is-active "$s" 2>&1)"
  done
  echo "--- existing apt sources / PPA ---"
  ls -la /etc/apt/sources.list.d/ | head -30
  grep -RIl deadsnakes /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null || echo "(no deadsnakes PPA yet)"
  echo "--- disk / RAM ---"
  df -h / /var /tmp | head -10
  free -h | head -3
  echo

  echo "=== 2. PPA STATE ==="
  if grep -RIl deadsnakes /etc/apt/sources.list /etc/apt/sources.list.d/ >/dev/null 2>&1; then
    echo "deadsnakes PPA already present — skipping add-apt-repository"
    PPA_ALREADY=1
  else
    echo "deadsnakes PPA absent — will add"
    PPA_ALREADY=0
  fi
  command -v add-apt-repository >/dev/null || abort "add-apt-repository missing (install software-properties-common)"
  echo

  echo "=== 3. ADD DEADSNAKES PPA (if needed) ==="
  if [ "$PPA_ALREADY" -eq 0 ]; then
    sudo add-apt-repository -y ppa:deadsnakes/ppa || abort "add-apt-repository failed"
  fi
  echo "--- /etc/apt/sources.list.d/ after PPA ---"
  ls -la /etc/apt/sources.list.d/ | grep -i deadsnakes || true
  echo

  echo "=== 4. APT UPDATE ==="
  sudo apt-get update || abort "apt-get update failed"
  echo

  echo "=== 5. APT-CACHE POLICY ==="
  apt-cache policy python3.13 python3.13-venv python3.13-dev | head -60
  CAND="$(apt-cache policy python3.13 | awk '/Candidate:/{print $2; exit}')"
  if [ -z "${CAND:-}" ] || [ "$CAND" = "(none)" ]; then
    abort "python3.13 Candidate not found after PPA add"
  fi
  echo "Candidate detected: $CAND"
  echo

  echo "=== 6. DRY-RUN INSTALL ==="
  DRY_OUT="$(apt-get -s install --no-install-recommends python3.13 python3.13-venv python3.13-dev 2>&1)"
  echo "$DRY_OUT" | tail -60
  echo "--- removal scan (precise: header / Remv prefix / Purg prefix / numeric to-remove) ---"
  TO_REMOVE="$(echo "$DRY_OUT" | grep -oE '[0-9]+ to remove' | head -1 | awk '{print $1}')"
  TO_REMOVE="${TO_REMOVE:-0}"
  echo "to-remove count: $TO_REMOVE"
  if echo "$DRY_OUT" | grep -qE '^The following packages will be REMOVED|^Remv |^Purg '; then
    echo "$DRY_OUT" | grep -E '^The following packages will be REMOVED|^Remv |^Purg '
    abort "dry-run shows explicit REMOVE/PURGE lines — refusing real install"
  fi
  if [ "$TO_REMOVE" -gt 0 ]; then
    abort "dry-run reports $TO_REMOVE packages to remove — refusing real install"
  fi
  echo "OK — no REMOVE/PURGE (0 to remove)"
  echo

  echo "=== 7. REAL INSTALL ==="
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       python3.13 python3.13-venv python3.13-dev || abort "apt-get install failed"
  echo

  echo "=== 8. POST-INSTALL PATHS ==="
  python3.13 --version || abort "python3.13 not callable after install"
  ls -l /usr/bin/python3.13
  python3 --version
  ls -l /usr/bin/python3
  RT="$(readlink -f /usr/bin/python3)"
  echo "/usr/bin/python3 -> $RT"
  case "$RT" in
    */python3.12*) echo "OK — python3 symlink preserved (python3.12)";;
    *) abort "python3 symlink CHANGED to $RT — refusing to continue";;
  esac
  echo

  echo "=== 9. SERVICE SAFETY (NO restart/reload performed) ==="
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    ST="$(systemctl is-active "$s" 2>&1)"
    printf "%-40s %s\n" "$s" "$ST"
    [ "$ST" = "active" ] || abort "service $s not active after install (was active before)"
  done
  echo

  echo "=== 10. ISOLATED TEST VENV ==="
  rm -rf /tmp/slc-py313-venv
  python3.13 -m venv /tmp/slc-py313-venv || abort "venv creation failed"
  /tmp/slc-py313-venv/bin/python --version
  /tmp/slc-py313-venv/bin/pip --version || true
  /tmp/slc-py313-venv/bin/python - <<'PY'
import sys, ssl, sqlite3, pathlib, venv
print(sys.version)
print("IMPORT_OK")
PY
  echo

  echo "=== 11. CLEANUP TEST VENV ==="
  rm -rf /tmp/slc-py313-venv
  if [ ! -e /tmp/slc-py313-venv ]; then
    echo "CLEANED"
  else
    abort "cleanup failed — /tmp/slc-py313-venv still exists"
  fi
  echo

  echo "=== 12. FINAL SNAPSHOT ==="
  python3 --version
  python3.13 --version
  readlink -f /usr/bin/python3
  for s in gunicorn.service arac-takip-gunicorn.service nginx.service postgresql@16-main.service; do
    printf "%-40s %s\n" "$s" "$(systemctl is-active "$s" 2>&1)"
  done
  echo
  echo "=== END ==="
} | tee "$LOG"

chmod 600 "$LOG"
echo "Install log: $LOG"
EOF

chmod +x /tmp/slc_py313_install.sh
bash /tmp/slc_py313_install.sh
```

### PASS Kriterleri (script otomatik kontrol eder; abort eder hata varsa)

| # | Beklenen |
|---|---|
| 1 | Pre-snapshot: 4 servis active, `/usr/bin/python3 -> python3.12` |
| 5 | `apt-cache policy python3.13` → Candidate `3.13.x` |
| 6 | Dry-run çıktısında REMOVE/PURGE **yok** |
| 7 | `apt-get install` exit 0 |
| 8 | `python3.13 --version` = 3.13.x; `python3 --version` = 3.12.3; `readlink -f /usr/bin/python3` = `/usr/bin/python3.12` |
| 9 | 4 servis hâlâ active (restart/reload yapılmadı) |
| 10 | `IMPORT_OK` (sys, ssl, sqlite3, pathlib, venv) |
| 11 | `CLEANED` |
| 12 | Final snapshot 1. snapshot ile aynı (python3 değişmedi, servisler active) |

### Operatör Talimatı

1. Yukarıdaki tüm bloku **olduğu gibi** server'a yapıştırın (root olarak).
2. Script otomatik koşar, herhangi bir aşamada hata varsa kendi kendine `ABORT` eder.
3. Çıktının tamamını paylaşın (özellikle `=== 8 ===`, `=== 9 ===`, `=== 12 ===` kısımları kritik).
4. Log dosyası: `/tmp/slc-py313-deadsnakes-<timestamp>.log` (mode 600).

---

## 3. Sınır / No-op Doğrulaması (script tasarımı)

| Kural | Script'te durum |
|---|---|
| `/usr/bin/python3` symlink değişimi | ❌ yok (yalnız `readlink` post-check; symlink touch eden komut YOK) |
| `update-alternatives` | ❌ yok |
| `ln -sf python3.13 /usr/bin/python3` | ❌ yok |
| Santral / Araç venv'e dokunma | ❌ yok |
| `systemctl restart/reload` | ❌ yok (yalnız `is-active` snapshot) |
| nginx reload/restart | ❌ yok |
| postgresql restart | ❌ yok |
| migrate / seed / DB user create | ❌ yok |
| OPS deploy | ❌ yok |
| Telegram / mail / cron | ❌ yok |
| git pull/push | ❌ yok |
| Secret / token / password ekrana basma | ❌ yok |
| Test venv `/tmp/slc-py313-venv` | ✅ izinli; oluşturulur, import test, sonra silinir |
| Aborts on dry-run REMOVE/PURGE | ✅ otomatik |
| Aborts on python3 symlink drift | ✅ otomatik |
| Aborts on service down after install | ✅ otomatik |

---

## 4. Beklenen Sonuç → Karar Matrisi

| Senaryo | Karar |
|---|---|
| Script END'e ulaşır + 12 kontrol PASS | ✅ **PYTHON 3.13 PPA INSTALL PASS** → R21 KAPANIR → Faz 17C-1 açılır |
| Script `=== 5 ===`'te abort (Candidate yok) | ⚠️ deadsnakes PPA Launchpad'ten çekilemedi — ağ/DNS/proxy araştır |
| Script `=== 6 ===`'da abort (REMOVE/PURGE) | 🛑 BLOCKED — paket çatışması; Yol B (pyenv) değerlendir |
| Script `=== 8 ===`'de abort (symlink drift) | 🛑 BLOCKED — beklenmedik; rollback (`apt-get autoremove python3.13`) |
| Script `=== 9 ===`'da abort (servis down) | 🛑 BLOCKED — Santral/Araç etkilendi; immediate rollback |
| Script `=== 10 ===`'da abort (venv/import fail) | ⚠️ paket bozuk; rollback + reinstall değerlendir |

---

## 5. Sonuç (kurulum öncesi durum)

**PYTHON 3.13 PPA INSTALL — APPROVED, AWAITING OPERATOR EXECUTION.**

| Soru | Cevap |
|---|---|
| Yönetici onayı | ✅ alındı |
| PPA eklendi mi? | ⏳ HENÜZ (operatör script'i koşmadı) |
| Candidate 3.13.x görüldü mü? | ⏳ HENÜZ |
| Dry-run REMOVE/PURGE temiz mi? | ⏳ HENÜZ |
| Python 3.13 kuruldu mu? | ⏳ HENÜZ |
| `/usr/bin/python3` korundu mu? | ✅ değişmedi (kurulum yok; ayrıca script symlink touch etmiyor) |
| Santral / Araç servisleri active mi? | ✅ EVET (Faz 17C-0-bis-2 snapshot'ından) |
| nginx / postgresql active mi? | ✅ EVET |
| Isolated venv import OK mi? | ⏳ HENÜZ |
| R21 kapandı mı? | ❌ AÇIK (script PASS sonrası kapanır) |
| Faz 17C-1'e geçilebilir mi? | 🛑 HENÜZ HAYIR |

**Sıradaki adım:** Operatör Bölüm 2 script'ini `santral-isletim` üzerinde koşar, çıktıyı paylaşır. Bu raporun "**Bölüm 6 — Execution Result**" alt bölümü çıktıyla doldurulur ve sınıflandırma PASS/WARNING/BLOCKER olarak güncellenir.

---

## 6. Execution Result — 2026-05-08T10:18:02+03:00

**Operatör tarafından `santral-isletim` üzerinde koşuldu** (v2 script, false-positive removal scan düzeltmesi sonrası). Log: `/tmp/slc-py313-deadsnakes-2026-05-08-101802.log`. Tüm 12 adım PASS.

### 6.1 Adım Sonuçları

| Adım | Sonuç | Kanıt |
|---|---|---|
| 1. Pre-snapshot | ✅ | python3=3.12.3, /usr/bin/python3→python3.12, 4 servis active |
| 2. PPA state | ✅ | "PPA already present — skipping" (önceki run'dan ekli) |
| 3. PPA add | ✅ | atlandı (zaten var) |
| 4. apt-get update | ✅ | tüm Hit (yeni fetch yok), exit 0 |
| 5. apt-cache policy | ✅ | **`Candidate: 3.13.13-1+noble1`** |
| 6. Dry-run | ✅ | 6 NEW (libpython3.13-stdlib, libpython3.13, libpython3.13-dev, python3.13, python3.13-dev, python3.13-venv); **0 to remove**; "OK — no REMOVE/PURGE (0 to remove)" |
| 7. Real install | ✅ | `0 upgraded, 6 newly installed, 0 to remove and 7 not upgraded`; 15.1 MB indirildi, 56.8 MB ek disk kullanım |
| 8. Post-install paths | ✅ | **`python3.13 --version` = `Python 3.13.13`**; **`python3 --version` = `Python 3.12.3`**; **`/usr/bin/python3 -> python3.12`**; "OK — python3 symlink preserved (python3.12)" |
| 9. Service safety | ✅ | gunicorn.service active, arac-takip-gunicorn.service active, nginx.service active, postgresql@16-main.service active |
| 10. Test venv | ✅ | `python3.13 -m venv /tmp/slc-py313-venv` → `Python 3.13.13`, `pip 26.0.1`; **`IMPORT_OK`** (sys, ssl, sqlite3, pathlib, venv) |
| 11. Cleanup | ✅ | **`CLEANED`** (`/tmp/slc-py313-venv` silindi) |
| 12. Final snapshot | ✅ | python3=3.12.3, python3.13=3.13.13, /usr/bin/python3→python3.12, 4 servis active |

### 6.2 Kurulan Paketler (yalnız onaylı kapsam)

| Paket | Sürüm |
|---|---|
| `libpython3.13-stdlib` | 3.13.13-1+noble1 |
| `libpython3.13` | 3.13.13-1+noble1 |
| `libpython3.13-dev` | 3.13.13-1+noble1 |
| `python3.13` | 3.13.13-1+noble1 |
| `python3.13-dev` | 3.13.13-1+noble1 |
| `python3.13-venv` | 3.13.13-1+noble1 |

`libpython3.13*` üç paket `python3.13`'ün dependency'leri (apt otomatik çekti, removal yok). Onay kapsamı dışında **hiçbir paket** kurulmadı/kaldırılmadı.

### 6.3 Yan Bulgu — INFO (BLOCKER/WARNING DEĞİL)

`apt install` `needrestart` post-install hook'u iki bilgi mesajı verdi; **hiçbiri kurulumdan tetiklenmedi**:

1. **Pending kernel upgrade** — running kernel `6.8.0-90-generic`; mevcut paket `6.8.0-111-generic`. Bu durum **bu kurulumdan bağımsız**, sistem zaten bekliyordu. Reboot planı operatöre ait. **Faz 17C-1'i etkilemez.**
2. **Deferred service restarts** — needrestart `dbus`, `serial-getty@ttyS0`, `systemd-logind`, `unattended-upgrades` için restart önerdi; **hiçbiri otomatik koşulmadı** ("being deferred"). Santral/Araç/nginx/postgresql listede **yok** → kurulum bunlara dokunmadı.

İkisi de operatörün ileride kararlaştıracağı planlı bakım kapsamında değerlendirilebilir; OPS deploy yolunu engellemez.

### 6.4 Sınır / No-op Doğrulaması (post-install)

| Kural | Durum |
|---|---|
| `/usr/bin/python3` symlink değişimi | ✅ DEĞİŞMEDİ (`python3.12`) |
| `update-alternatives` çağrısı | ✅ yapılmadı |
| Santral / Araç venv'lerine dokunma | ✅ yapılmadı |
| systemctl restart/reload (Santral, Araç, nginx, postgres) | ✅ yapılmadı |
| migrate / seed / DB / user create | ✅ yapılmadı |
| OPS deploy | ✅ yapılmadı |
| Telegram / mail / cron / git push | ✅ yapılmadı |
| Secret / token ekrana basma | ✅ yapılmadı |

### 6.5 R21 Karar

**R21 (Python 3.12 vs OPS 3.13+ gereksinim) — KAPANDI ✅**

- ✅ Python 3.13.13 kuruldu (deadsnakes PPA, onay kapsamı dahilinde)
- ✅ Sistem `python3` 3.12.3 olarak korundu
- ✅ 4 kritik servis active (kurulum öncesi ve sonrası aynı)
- ✅ Isolated venv import OK + cleanup OK

### 6.6 Final Karar

**PYTHON 3.13 PPA INSTALL — PASS.**

| Soru | Cevap |
|---|---|
| PPA eklendi mi? | ✅ EVET (önceki bis-3 run'da; bu run'da skip) |
| Candidate 3.13.x görüldü mü? | ✅ `3.13.13-1+noble1` |
| Dry-run REMOVE/PURGE temiz mi? | ✅ EVET (0 to remove) |
| Python 3.13 kuruldu mu? | ✅ `Python 3.13.13` |
| `/usr/bin/python3` korundu mu? | ✅ `python3.12`, version `3.12.3` |
| Santral / Araç servisleri active mi? | ✅ EVET |
| nginx / postgresql active mi? | ✅ EVET |
| Isolated venv import OK mi? | ✅ `IMPORT_OK` |
| R21 kapandı mı? | ✅ KAPANDI |
| Faz 17C-1'e geçilebilir mi? | ✅ **EVET** |
