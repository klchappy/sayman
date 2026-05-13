# PHASE 17C-0-bis-2 — PYTHON 3.13 VERIFICATION

**Tarih:** 2026-05-08
**Sonuç:** ⚠️ **PYTHON 3.13 VERIFICATION WARNING — UNIVERSE PATHWAY UNAVAILABLE; DEADSNAKES PPA OR PYENV ROUTE REQUIRED**

---

## 1. Yürütme Kanıtı

Operatör `santral-isletim` üzerinde Bölüm 2-A read-only precheck script'ini koştu. Log: `/tmp/slc-py313-precheck-2026-05-08-095810.log`. Özet:

```
Host: santral-isletim   |   User: root   |   Date: 2026-05-08T09:58:10+03:00

Python 3.12.3
/usr/bin/python3 -> python3.12          (DEĞİŞMEMİŞ)
python3.13: command not found

gunicorn.service              active
arac-takip-gunicorn.service   active
nginx.service                 active
postgresql@16-main.service    active

apt-cache policy python3.13          : (no candidate)
apt-cache policy python3.13-venv     : (no candidate)
apt-cache policy python3.13-dev      : (no candidate)
software-properties-common: 0.99.49.4 (Hetzner mirror)

apt-get -s install python3.13 python3.13-venv python3.13-dev:
  E: Unable to locate package python3.13
  E: Unable to locate package python3.13-venv
  E: Unable to locate package python3.13-dev
```

---

## 2. Acceptance Criteria

| Madde | Beklenen | Sonuç |
|---|---|---|
| Server precheck (hostname/python3/which/ls/systemctl) | EVET | ✅ |
| `apt-cache policy python3.13` çıktısı | EVET | ✅ — paket Noble universe'de YOK |
| Dry-run `apt-get -s install` | EVET | ✅ — `Unable to locate` |
| Kurulum (yalnız onay sonrası) | KOŞULLU | ❌ — paket yok, koşulmadı |
| `/usr/bin/python3` korunması doğrulandı | EVET | ✅ `-> python3.12` |
| Test venv `/tmp/slc-py313-venv` import check | EVET | ❌ kurulum yok |
| Servis aktiflik kontrolü | EVET | ✅ 4 servis ACTIVE |
| Santral / Araç sistem dokunma yok | DOĞRU | ✅ |
| `update-alternatives` kullanımı yok | DOĞRU | ✅ |
| Symlink değişikliği yok | DOĞRU | ✅ |
| systemctl restart/reload yok | DOĞRU | ✅ |
| nginx reload yok | DOĞRU | ✅ |
| migrate / seed / DB / user create | DOĞRU | ✅ yok |
| Telegram / mail / cron | DOĞRU | ✅ yok |
| git pull/push | DOĞRU | ✅ yok |
| Secret/token/password ekrana basma | DOĞRU | ✅ yok |
| PPA repo eklenmesi | DOĞRU | ✅ yapılmadı |
| `apt-get install` (gerçek) | DOĞRU | ✅ yapılmadı |

---

## 3. Risk Sınıflandırması

| Sınıf | Sayı | Liste |
|---|---|---|
| BLOCKER | **0** | (precheck PASS; kurulum yolu hâlâ açık — yalnız onay/yöntem seçimi gerekli) |
| WARNING | **1** (devam) | R21 (Python 3.12.3 vs OPS 3.13+) hâlâ açık; universe yolu kapalı, deadsnakes PPA / pyenv yolu açık |
| INFO | **6+** | RX1–RX7 (önceki ön risk); PPA-1..6 (deadsnakes spesifik) |

---

## 4. Çakışma / Güvenlik Kontrolleri

| Konu | Durum |
|---|---|
| `/usr/bin/python3` korundu | ✅ `python3.12` (Santral/Araç scripts etkilenmez) |
| Sistem 4 kritik servis | ✅ ACTIVE (precheck snapshot ile doğrulandı) |
| Disk yeterliği | ✅ 138 GB (Faz 17C-0-bis ölçümü) |
| `software-properties-common` | ✅ kurulu — `add-apt-repository` mevcut |
| Universe `python3.13` paketi | ❌ YOK (Noble sürüm sınırı) |
| deadsnakes PPA Launchpad erişimi | ❓ test edilmedi (PPA eklenmedi) |

---

## 5. No-op / Sınır Doğrulaması

| Kural | Durum |
|---|---|
| Santral / Araç write | ✅ yok |
| Server'a write komutu | ✅ yok (yalnız read-only sorgular) |
| `/usr/bin/python3` değişimi | ✅ yok |
| `update-alternatives` | ✅ yok |
| Santral / Araç venv dokunma | ✅ yok |
| systemctl restart/reload | ✅ yok |
| nginx reload | ✅ yok |
| migrate / seed / DB / user create | ✅ yok |
| OPS app deploy | ✅ yok |
| Telegram / mail / cron / git push | ✅ yok |
| Secret / token ekrana basma | ✅ yok |
| `/tmp/slc-py313-venv` oluşturma | ✅ yapılmadı |
| PPA repo eklenmesi | ✅ yapılmadı |
| `apt-get install` (gerçek) | ✅ yapılmadı |

---

## 6. Sonuç

**PYTHON 3.13 VERIFICATION — WARNING.**

| Soru | Cevap |
|---|---|
| BLOCKER sayısı | **0** |
| WARNING sayısı | **1** (R21 — hâlâ açık) |
| INFO sayısı | RX1–RX7 + PPA-1..6 + 5 önceki faz |
| Python 3.13 kuruldu mu? | ❌ HAYIR |
| `/usr/bin/python3` korundu mu? | ✅ EVET (`python3.12`, version 3.12.3) |
| Santral / Araç servisleri aktif mi? | ✅ EVET (gunicorn, arac-takip-gunicorn ACTIVE) |
| nginx / postgresql aktif mi? | ✅ EVET (nginx, postgresql@16-main ACTIVE) |
| Test venv başarılı mı? | ❌ oluşturulmadı (kurulum yok) |
| R21 kapandı mı? | ❌ AÇIK |
| Faz 17C-1'e geçilebilir mi? | 🛑 HAYIR (R21 kapanmadan) |
| Önerilen next step | **Faz 17C-0-bis-3** — yönetici Yol A (deadsnakes PPA, rapor Bölüm 6.2 C1–C11) veya Yol B (pyenv, slc user altında) tercih eder; ayrı risk raporu + onay paketi sonrası kurulum yapılır |

**Faz 17C-1 Same Server Staging-Mode Install YASAK** — bu WARNING kapanmadan ilerlenmez.
