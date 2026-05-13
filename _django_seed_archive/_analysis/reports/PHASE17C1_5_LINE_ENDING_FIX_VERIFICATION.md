# PHASE 17C-1.5 — SCRIPT LINE ENDING FIX VERIFICATION

**Tarih:** 2026-05-08
**Sonuç:** ✅ **LINE ENDING FIX — PASS**

---

## 1. Yürütme Kanıtı

```
Working tree: backend/scripts/deploy.sh   CR count: 0   ✅
Working tree: backend/scripts/backup.sh   CR count: 0   ✅
bash -n backend/scripts/deploy.sh        OK             ✅
bash -n backend/scripts/backup.sh        OK             ✅
manage.py check (config.settings.local)  0 issues       ✅
makemigrations --dry-run --check         No changes     ✅
```

Eski archive'da CRLF (`0d 0a`); yeni `.gitattributes` `* text=auto eol=lf` + `*.sh text eol=lf` ile `git archive` çıktısı LF'i koruyacak (Faz 18 archive yeniden üretilecek).

---

## 2. Acceptance Criteria

| Madde | Beklenen | Sonuç |
|---|---|---|
| `.gitattributes` eklendi | EVET | ✅ |
| `* text=auto eol=lf` global kuralı | EVET | ✅ |
| `*.sh text eol=lf` | EVET | ✅ |
| `deploy/**/*.service text eol=lf` | EVET | ✅ |
| `deploy/**/*.timer text eol=lf` | EVET | ✅ |
| `deploy/**/*.conf text eol=lf` | EVET | ✅ |
| `*.py text eol=lf` | EVET | ✅ |
| Working tree shell scripts LF | EVET | ✅ |
| `bash -n deploy.sh` | EVET | ✅ |
| `bash -n backup.sh` | EVET | ✅ |
| Django `manage.py check` 0 issues | EVET | ✅ |
| `makemigrations --dry-run --check` no changes | EVET | ✅ |
| Server deploy / SSH change | YOK | ✅ |
| DB write / migrate / seed | YOK | ✅ |
| nginx / systemd | YOK | ✅ |
| Santral / Araç | YOK | ✅ |
| git push | YOK | ✅ |
| Commit yalnız line-ending + reports | EVET | ✅ |

---

## 3. Risk Sınıflandırması

| Sınıf | Sayı | Liste |
|---|---|---|
| BLOCKER | **0** | — |
| WARNING | **0** | — |
| INFO | **2** | (1) Faz 18 öncesi yeni baseline tag oluşturulup yeni `git archive` üretilmesi gerekir; (2) `core.autocrlf=true` global git ayarı kalıyor — `.gitattributes` artık üstün; ileride başka geliştirici makinasından commit yapılırsa attribute kuralları hâlâ etkin olur |

---

## 4. No-op / Sınır Doğrulaması

| Kural | Durum |
|---|---|
| Server deploy | ✅ yok |
| SSH ile production değişikliği | ✅ yok |
| DB write | ✅ yok |
| migrate / seed | ✅ yok |
| nginx / systemd | ✅ yok |
| Santral / Araç path/DB/service/cron | ✅ dokunulmadı |
| `gunicorn.service` (Santral) restart/reload | ✅ yok |
| `arac-takip-gunicorn.service` restart/reload | ✅ yok |
| nginx restart/reload | ✅ yok |
| postgresql restart | ✅ yok |
| Telegram / mail / cron | ✅ yok |
| git push | ✅ yok (yalnız local commit) |
| Source data | ✅ dokunulmadı |
| Secret / token rapora yazma | ✅ yok |

---

## 5. Sonuç

**LINE ENDING FIX — PASS.**

| Soru | Cevap |
|---|---|
| BLOCKER | 0 |
| WARNING | 0 |
| INFO | 2 |
| `.gitattributes` eklendi mi? | ✅ |
| Working tree LF mi? | ✅ |
| bash -n syntax check PASS mi? | ✅ |
| Django `manage.py check` PASS mi? | ✅ |
| `makemigrations --dry-run --check` PASS mi? | ✅ |
| Faz 18 Production Deploy yolu açık mı? | ✅ EVET |
| Önerilen next step | **Faz 18 — Production Deploy** öncesi yeni `git archive` üret (`pre-production-mvp-deploy-ready` tag) ve sha256 hesapla; sonra Faz 18 promptu |
