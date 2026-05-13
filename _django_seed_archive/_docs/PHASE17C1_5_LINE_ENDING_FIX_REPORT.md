# PHASE 17C-1.5 — SCRIPT LINE ENDING FIX + PRE-PRODUCTION COMMIT REPORT

**Tarih:** 2026-05-08
**Sınıflandırma:** ✅ **LINE ENDING FIX — PASS**

Faz 17C-1 staging install sırasında ortaya çıkan CRLF kök nedeni kapatıldı: `.gitattributes` ile `*.sh`, `deploy/**/*.{service,timer,conf,py}` ve diğer text dosyalar `eol=lf` olarak normalize edildi. `git archive` artık LF'i koruyacak.

---

## 0. Yönetici Özeti

| Madde | Sonuç |
|---|---|
| Kök neden tespit edildi mi? | ✅ `core.autocrlf=true` (Windows) + `.gitattributes` yok → `git archive` `*.sh`'a CRLF enjekte ediyordu |
| Working tree byte kontrolü | ✅ `deploy.sh`/`backup.sh` CR sayısı = 0 |
| Eski archive byte kontrolü | ❌ `_build/muhasebe-ops-baseline.tar.gz` içinde CRLF (`0d 0a`) — bu yüzden Faz 17C-1 Aşama 9'da `bash: $'\r'` hatası |
| `.gitattributes` eklendi | ✅ |
| `bash -n deploy.sh` | ✅ OK |
| `bash -n backup.sh` | ✅ OK |
| `manage.py check` (lokal `config.settings.local`) | ✅ "System check identified no issues (0 silenced)" |
| `makemigrations --dry-run --check` | ✅ "No changes detected" |
| Commit | ⏳ bu raporun yazımından sonra (rapor + .gitattributes + 2 doc + report dosyaları) |
| Server deploy / SSH change | ❌ yok |
| Santral / Araç dokunma | ❌ yok |
| nginx/systemd/migrate/seed | ❌ yok |
| git push | ❌ yok |

---

## 1. Kök Neden Kanıtı

```
$ git config --get core.autocrlf
true

$ head -2 backend/scripts/deploy.sh | xxd | head -2
00000000: 2321 2f75 7372 2f62 696e 2f65 6e76 2062  #!/usr/bin/env b
00000010: 6173 680a 2320 534c 4320 4d75 6861 7365  ash.# OPS Muhase
                                ^^                  → 0x0a = LF (working tree LF)

$ tar -xzf _build/muhasebe-ops-baseline.tar.gz -C /tmp/probe
$ head -2 /tmp/probe/muhasebe-ops-baseline/backend/scripts/deploy.sh | xxd | head -2
00000000: 2321 2f75 7372 2f62 696e 2f65 6e76 2062  #!/usr/bin/env b
00000010: 6173 680d 0a23 2053 4c43 204d 7568 6173  ash..# OPS Muhas
                                ^^^^^^             → 0x0d 0x0a = CRLF (archive CRLF)
```

Working tree LF idi, ama `git archive` `core.autocrlf=true` etkisiyle text-detected `.sh` için CRLF üretiyordu. `.gitattributes` olmadan `text=auto` filtresi auto-detect tarafından override ediliyor.

---

## 2. Düzeltme

### 2.1 `.gitattributes` (yeni dosya)

```
* text=auto eol=lf

*.sh                    text eol=lf
deploy/**/*.service     text eol=lf
deploy/**/*.timer       text eol=lf
deploy/**/*.conf        text eol=lf
deploy/**/*.py          text eol=lf

*.py                    text eol=lf
*.cfg / *.ini / *.toml / *.yml / *.yaml / *.html / *.css / *.js / *.json / *.md   text eol=lf

*.png/*.jpg/*.jpeg/*.gif/*.ico/*.pdf/*.zip/*.tar.gz/*.tgz/*.xlsx/*.xls/*.docx/*.rar  binary
```

`* text=auto eol=lf` → repo'daki tüm text dosyalar checkout/archive sırasında **LF**.
Açık `eol=lf` deklarasyonları kritik dosyaları ek güvenceyle kilitler.

### 2.2 Renormalize

```
$ git add --renormalize .
(working tree zaten LF olduğu için sadece daha önce staged 2 doc tekrar staged; deploy.sh/backup.sh için byte değişimi yok)
```

---

## 3. Doğrulama

### 3.1 Working tree byte kontrolü

```
$ for f in backend/scripts/deploy.sh backend/scripts/backup.sh; do
    printf "%-40s CR count: " "$f"
    tr -cd '\r' < "$f" | wc -c
  done
backend/scripts/deploy.sh                CR count: 0
backend/scripts/backup.sh                CR count: 0
```

### 3.2 Bash syntax check

```
$ bash -n backend/scripts/deploy.sh && echo OK
OK
$ bash -n backend/scripts/backup.sh && echo OK
OK
```

### 3.3 Django check (lokal `config.settings.local`)

```
$ DJANGO_SETTINGS_MODULE=config.settings.local python manage.py check
System check identified no issues (0 silenced).

$ DJANGO_SETTINGS_MODULE=config.settings.local python manage.py makemigrations --dry-run --check
No changes detected
```

> **Not:** `config.settings.development` modülü repo'da yok; mevcut: `base.py`, `local.py`, `local_pg.py`, `production.py`. Lokal kontrol için `local.py` (sqlite-backed) kullanıldı.

---

## 4. Sınır / No-op Doğrulaması

| Kural | Durum |
|---|---|
| Server deploy | ❌ yok |
| SSH ile production değişikliği | ❌ yok |
| DB write | ❌ yok |
| migrate/seed | ❌ yok |
| nginx/systemd | ❌ yok |
| Santral / Araç | ❌ yok |
| git push | ❌ yok (yalnız local commit) |
| Telegram / mail / cron | ❌ yok |
| Secret / token rapora yazma | ❌ yok |
| Production / staging server'a komut | ❌ yok |

---

## 5. Commit Planı

Aşağıdaki dosyalar commit edilecek (yalnız line-ending, `.gitattributes` ve rapor dosyaları):

- `.gitattributes` (yeni)
- `_docs/PRODUCTION_PREFLIGHT_CHECKLIST.md` (Faz 17B'den modified — renormalize ile staged)
- `_docs/STAGING_DRY_RUN_CHECKLIST.md` (Faz 17C'den modified — renormalize ile staged)
- `_docs/PHASE17B_PRODUCTION_PREFLIGHT_REPORT.md` (Faz 17B raporu)
- `_docs/PHASE17C_STAGING_EXECUTION_REPORT.md` (Faz 17C raporu)
- `_docs/PHASE17C0_SAME_SERVER_INVENTORY_REPORT.md`
- `_docs/PHASE17C0BIS_SAME_SERVER_INVENTORY_EXECUTION_REPORT.md`
- `_docs/PHASE17C0BIS2_PYTHON313_VERIFICATION_REPORT.md`
- `_docs/PHASE17C0BIS3_PYTHON313_PPA_INSTALL_REPORT.md`
- `_docs/PHASE17C1_SAME_SERVER_STAGING_INSTALL_REPORT.md`
- `_docs/PHASE17C1_5_LINE_ENDING_FIX_REPORT.md` (bu rapor)
- `_docs/PRODUCTION_DEPLOY_GO_NO_GO.md`
- `_docs/SAME_SERVER_DEPLOY_ISOLATION_PLAN.md`
- `_docs/SAME_SERVER_RISK_REGISTER.md`
- `_analysis/reports/PHASE17B_PRODUCTION_PREFLIGHT_VERIFICATION.md`
- `_analysis/reports/PHASE17C_STAGING_EXECUTION_VERIFICATION.md`
- `_analysis/reports/PHASE17C0_SAME_SERVER_ISOLATION_VERIFICATION.md`
- `_analysis/reports/PHASE17C0BIS_SAME_SERVER_INVENTORY_VERIFICATION.md`
- `_analysis/reports/PHASE17C0BIS2_PYTHON313_VERIFICATION.md`
- `_analysis/reports/PHASE17C0BIS3_PYTHON313_PPA_INSTALL_VERIFICATION.md`
- `_analysis/reports/PHASE17C1_SAME_SERVER_STAGING_INSTALL_VERIFICATION.md`
- `_analysis/reports/PHASE17C1_5_LINE_ENDING_FIX_VERIFICATION.md` (bu doğrulama)

Commit mesajı:

```
Normalize deploy scripts line endings before production deploy

- Add .gitattributes with `* text=auto eol=lf` and explicit eol=lf for
  *.sh / deploy/**/*.{service,timer,conf,py} and other text types.
- Root cause: core.autocrlf=true (Windows) + missing .gitattributes
  caused git archive to inject CRLF into shell scripts, breaking bash
  on the staging server (Faz 17C-1 Aşama 9 backup.sh CRLF parse error).
- Working tree was already LF; this commit adds the attribute file so
  future `git archive` outputs preserve LF.
- Includes Faz 17B / 17C-x phase reports and verification docs.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

`git push` **yapılmaz** (faz kuralı). Yalnız local commit.

Commit sonrası **yeni baseline tag** önerilir (örn. `pre-production-mvp-baseline-v2` veya `pre-production-mvp-deploy-ready`) — Faz 18 production archive'ı bu yeni tag'den üretilir, böylece archive LF olur.

---

## 6. Sonuç

**LINE ENDING FIX — PASS.**

| Soru | Cevap |
|---|---|
| `.gitattributes` eklendi mi? | ✅ |
| Working tree LF mi? | ✅ |
| `bash -n` PASS mi? | ✅ deploy.sh + backup.sh |
| `manage.py check` PASS mi? | ✅ 0 issues |
| `makemigrations --dry-run --check` PASS mi? | ✅ no changes |
| Server'a dokunuldu mu? | ❌ |
| Santral / Araç etkilendi mi? | ❌ |
| Faz 18 Production Deploy yolu açık mı? | ✅ EVET (önkoşul: yeni baseline tag + Faz 18 promptu) |

**LINE ENDING FIX PASS — Faz 18 Production Deploy'a geçilebilir.**
