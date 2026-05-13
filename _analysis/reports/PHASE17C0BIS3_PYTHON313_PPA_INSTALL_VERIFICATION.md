# PHASE 17C-0-bis-3 — PYTHON 3.13 DEADSNAKES PPA CONTROLLED INSTALL VERIFICATION

**Tarih:** 2026-05-08
**Sonuç:** ✅ **PASS — R21 CLOSED — FAZ 17C-1 UNLOCKED**

---

## 1. Yürütme Kanıtı

Operatör `santral-isletim` üzerinde v2 script'ini koştu (false-positive removal scan düzeltmesi sonrası). Log: `/tmp/slc-py313-deadsnakes-2026-05-08-101802.log`. Tüm 12 adım PASS.

```
=== 5 ===  Candidate detected: 3.13.13-1+noble1
=== 6 ===  to-remove count: 0   →   OK — no REMOVE/PURGE (0 to remove)
=== 7 ===  6 newly installed, 0 to remove, 15.1 MB / 56.8 MB
=== 8 ===  python3.13 = 3.13.13   |   python3 = 3.12.3   |   /usr/bin/python3 -> python3.12
            OK — python3 symlink preserved (python3.12)
=== 9 ===  gunicorn / arac-takip-gunicorn / nginx / postgresql@16-main  → all active
=== 10 === Python 3.13.13   pip 26.0.1   IMPORT_OK
=== 11 === CLEANED
=== 12 === python3=3.12.3   python3.13=3.13.13   /usr/bin/python3.12   4 services active
```

---

## 2. Acceptance Criteria

| Madde | Beklenen | Sonuç |
|---|---|---|
| Yönetici onayı | EVET | ✅ |
| PPA eklendi (önceki run) | EVET | ✅ |
| `apt-cache policy` Candidate 3.13.x | EVET | ✅ `3.13.13-1+noble1` |
| Dry-run REMOVE/PURGE temiz | EVET | ✅ 0 to remove |
| Real install (yalnız onay kapsamı) | EVET | ✅ 6 paket NEW (python3.13/-venv/-dev + 3 dep `libpython3.13*`) |
| `python3.13 --version` = 3.13.x | EVET | ✅ `Python 3.13.13` |
| `python3 --version` = 3.12.3 | EVET | ✅ |
| `/usr/bin/python3 -> python3.12` | EVET | ✅ |
| `update-alternatives` kullanımı | YOK | ✅ |
| Symlink değişikliği | YOK | ✅ |
| 4 servis active (kurulum sonrası) | EVET | ✅ |
| systemctl restart/reload | YOK | ✅ |
| nginx reload | YOK | ✅ |
| postgresql restart | YOK | ✅ |
| migrate / seed / DB / user | YOK | ✅ |
| OPS deploy | YOK | ✅ |
| Telegram / mail / cron / git push | YOK | ✅ |
| Secret / token ekrana basma | YOK | ✅ |
| Isolated test venv import OK | EVET | ✅ `IMPORT_OK` |
| Test venv cleanup | EVET | ✅ `CLEANED` |
| R21 kapandı mı? | EVET | ✅ |

---

## 3. Risk Sınıflandırması

| Sınıf | Sayı | Liste |
|---|---|---|
| BLOCKER | **0** | — |
| WARNING | **0** | (R21 KAPANDI) |
| INFO | **2 yeni + önceki** | (1) `needrestart` "Pending kernel upgrade" 6.8.0-90 → 6.8.0-111 (kurulumdan bağımsız, mevcut durum); (2) `needrestart` deferred restart önerileri (dbus, serial-getty@ttyS0, systemd-logind, unattended-upgrades — hiçbiri otomatik koşmadı). Santral/Araç/nginx/postgres listede yok. |

---

## 4. No-op / Sınır Doğrulaması (post-install)

| Kural | Durum |
|---|---|
| `/usr/bin/python3` symlink | ✅ değişmedi (`python3.12`) |
| `update-alternatives` | ✅ kullanılmadı |
| Santral / Araç venv dokunma | ✅ yok |
| systemctl restart/reload | ✅ yok |
| nginx reload | ✅ yok |
| postgresql restart | ✅ yok |
| migrate / seed / DB / user create | ✅ yok |
| OPS deploy | ✅ yok |
| Telegram / mail / cron / git push | ✅ yok |
| Secret / token ekrana basma | ✅ yok |
| Test venv yalnız `/tmp/slc-py313-venv` (izinli) | ✅ oluşturuldu, import test, silindi |

---

## 5. Sonuç

**PYTHON 3.13 PPA INSTALL — PASS.**

| Soru | Cevap |
|---|---|
| BLOCKER | **0** |
| WARNING | **0** |
| INFO | **2 yeni** (kernel upgrade pending + deferred services — bağımsız) |
| PPA eklendi mi? | ✅ EVET |
| Candidate 3.13.x görüldü mü? | ✅ `3.13.13-1+noble1` |
| Dry-run REMOVE/PURGE temiz mi? | ✅ 0 to remove |
| Python 3.13 kuruldu mu? | ✅ `Python 3.13.13` |
| `/usr/bin/python3` korundu mu? | ✅ `python3.12` |
| Santral / Araç servisleri active mi? | ✅ EVET |
| nginx / postgresql active mi? | ✅ EVET |
| Isolated venv import OK mi? | ✅ `IMPORT_OK` + `CLEANED` |
| R21 kapandı mı? | ✅ **KAPANDI** |
| Faz 17C-1'e geçilebilir mi? | ✅ **EVET** |
| Önerilen next step | **Faz 17C-1 — Same Server Staging-Mode Install** (DB `muhasebe_staging`, role `muhasebe_staging_user`, port `127.0.0.1:8104`, path `/var/www/muhasebe-ops-staging`, venv `python3.13 -m venv`) |
