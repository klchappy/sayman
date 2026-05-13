# Faz 12 — Raporlama / Excel Export Merkezi MVP Raporu

**Durum:** TAMAMLANDI
**Tarih:** 2026-05-07
**Test:** 371/371 PASS (önceki 324 + Faz 12 yeni 47)
**`manage.py check`:** PASS
**`makemigrations --dry-run --check`:** PASS

---

## 1. Kapsam

Faz 12, sistemdeki domain verilerinin (Geciken/Yaklaşan ödemeler, Görevler, Site Aidatları, Emlak Vergisi, Teminat Komisyonları, Entegratör/Kontör, Belgeler, AuditLog) **manuel, senkron** XLSX/CSV export'unu sağlayan Rapor Merkezi'ni ekler.

**Değişmez OPS kimliği** (light-only, IBM Plex Sans/Mono, Pruva → "Site Aidatları" kullanıcı yüzü, Inter/JetBrains/dark-mode YASAK) tüm yeni şablonlarda korunmuştur.

**Hard guard'lar:** Telegram/SMTP/Celery/APScheduler/cron/PDF (reportlab/weasyprint) referansı YOK; `apps.imports` `apps.reports`'a erişmez; bu testler regression olarak yazıldı.

---

## 2. Eklenen Modeller

`apps.reports.models`:

| Model | Açıklama |
|---|---|
| `ReportType` (TextChoices) | 13 rapor tipi: PAYABLES, PAYMENTS, SUBSCRIPTIONS, REGULAR_PAYMENTS, OFFICIAL_PAYMENTS, SITE_DUES, PROPERTY_TAX, GUARANTEES, INTEGRATORS, TASKS, DOCUMENTS, AUDIT, COMBINED |
| `ReportFormat` | XLSX / CSV |
| `ReportRunStatus` | PENDING / RUNNING / COMPLETED / FAILED / CANCELLED |
| `ReportTemplate` | Yeniden kullanılabilir şablon (name, slug-unique, report_type, default_format, default_filters JSON, columns JSON) + BaseModel |
| `ReportRun` | Bir export çalıştırma history kaydı (template FK, report_type, filters, format, status, row_count, file_size, output_file FileField, error_message, completed_at, metadata) + indeksler |

Migration `0001_initial` uygulandı; sonrasında `--check --dry-run` temiz.

---

## 3. Servisler

`apps.reports.services.reporting`:

- **Permission**
  - `can_run_report(user, report_type)` — viewer hiçbir export yapamaz; `AUDIT` raporu sadece `super_admin/yonetici/muhasebe_muduru` (APPROVE_ROLES); diğerleri `WRITE_ROLES`.
- **Definition Registry**
  - `REPORT_DEFINITIONS` dict; `_register()` ile 8 rapor tipi kayıtlı: PAYABLES, TASKS, SITE_DUES, PROPERTY_TAX, GUARANTEES, INTEGRATORS, DOCUMENTS, AUDIT.
  - PAYABLES `mode` filtresi: `overdue` / `upcoming` (days param) / `missing_receipt` / `pending_approval` — tek tanımdan 4 alt-mod.
- **Preview**
  - `preview_report(report_type, filters, user, limit=50)` → `{report_type, title, columns, rows, row_count, preview_count}`.
- **Export (senkron, atomic)**
  - `run_export(report_type, filters, fmt, user, ...)` — ReportRun(RUNNING) yarat → query → row build → XLSX/CSV bytes → `ContentFile` ile `output_file.save()` → COMPLETED + `audit_log(action="EXPORT")`.
  - Hata yakalanırsa: status=FAILED, `error_message[:1000]`, audit "FAILED" kaydı.
- **XLSX (`openpyxl`):** başlık satırı (Font 14 bold), üreten/üretildi satırı, boş satır, header (bold + PatternFill `E5E7EB` + center), data, `min(max_len+2, 60)` auto-width.
- **CSV:** UTF-8 BOM (`\ufeff`) + `;` delimiter (TR Excel), aynı meta+header+data düzeni.
- **Şablon yönetimi:** `create_report_template`, `update_report_template` — her ikisi de `audit_log` yazar.
- **`cancel_report_run`** — sadece PENDING/RUNNING; superuser/creator/approver yetkili.
- **`get_recent_exports(user, limit=10)`** — superuser/approver tümünü, diğerleri yalnız kendi koşturmalarını görür.

---

## 4. URL'ler & View'lar

`reports/`
- `center/` — Rapor Merkezi (kullanılabilir raporlar + son koşturmalar + şablonlar).
- `templates/` (list, new, `<pk>/`, `<pk>/edit/`)
- `preview/?report_type=...` — `PreviewView` (LoginRequired)
- `export/` GET form, POST `run_export` → `run_detail` redirect; viewer 403; AUDIT non-approver 403.
- `runs/` — history; superuser/approver tümünü, writer kendi koşturmalarını.
- `runs/<pk>/`, `runs/<pk>/download/` (FileResponse), `runs/<pk>/cancel/` (POST).

Tüm yetki sınırları HTTP testleriyle doğrulandı.

---

## 5. Şablonlar

`templates/reports/` (8 dosya): `report_center.html`, `template_list.html`, `template_form.html`, `template_detail.html`, `report_preview.html` (tablo + XLSX/CSV indir butonları + `{% load reports_tags %}` `get_item` filtresi), `export_form.html`, `export_history.html`, `export_detail.html`.

`templatetags/reports_tags.py` — `get_item` filtresi (dict access).

Tüm şablonlar OPS kimliği korumalı (`Pruva`, `Acme`, `Inter`, `JetBrains`, `prefers-color-scheme` YASAK).

---

## 6. Sidebar & Dashboard Entegrasyonu

- `templates/includes/sidebar.html` — placeholder kaldırıldı; `📈 Raporlama` → `reports:center` namespace-aktif highlighting'le.
- `apps.dashboard.views.DashboardHomeView` — `phase12_reports` ctx (recent_runs[:5], completed/failed/pending sayıları).
- `templates/dashboard/home.html` — Faz 11 chat kartı öncesinde **Faz 12 widget'ı** (3 sütun KPI + son exportlar listesi + "Rapor Merkezi →" link).

---

## 7. Yetki Matrisi

| Rol | Preview | Export (XLSX/CSV) | AUDIT raporu | İndirme |
|---|:---:|:---:|:---:|:---:|
| viewer (`goruntuleyici`) | ❌ 403 | ❌ 403 | ❌ | ❌ |
| muhasebeci | ✅ | ✅ | ❌ 403 | ✅ kendi |
| muhasebe_muduru / yonetici | ✅ | ✅ | ✅ | ✅ tüm |
| super_admin | ✅ | ✅ | ✅ | ✅ tüm |

`AuditLog`: her export `app_label="reports", model_name="reportrun", action="EXPORT"` satırı yazar.

---

## 8. Test Özeti

`backend/tests/test_phase12.py` — **47 test**, 19 sınıf:

- ReportTemplateTest (4) — create / unknown_type / viewer_denied / update
- AvailableTypesTest (3) — admin / writer (no AUDIT) / viewer (boş)
- PreviewTest (11) — 4 PAYABLES modu + TASKS + SITE_DUES + PROPERTY_TAX + GUARANTEES + INTEGRATORS + DOCUMENTS + AUDIT
- PermissionTest (4) — viewer her tipe kapalı / AUDIT yalnız approver / writer PAYABLES açık / viewer preview 403
- XlsxExportTest (2) — completed run + ZIP imza
- CsvExportTest (2) — completed run + UTF-8 BOM & `;`
- FailedExportTest (1) — geçersiz tip → FAILED + error_message
- AuditLogWrittenTest (1) — EXPORT action satırı yazılır
- CancelRunTest (1) — PENDING → CANCELLED
- RecentExportsTest (2) — writer kendi / admin tümü
- ViewerCannotExportTest (2) — POST 403 / preview GET 403
- MuhasebeciCanExportTest (1) — POST → 302 redirect run_detail
- AuditExportRestrictedTest (2) — muhasebeci 403 / muhasebe_muduru 302
- DownloadPermissionTest (2) — başka kullanıcı 403 / sahip 200
- ReportCenterRenderTest (1) — center 200
- DashboardWidgetTest (1) — "Faz 12" + "Raporlama" render
- UiContractTest (2) — yasak terim yok / dark-mode yok
- NoOpGuardTest (4) — Telegram/SMTP yok / Celery/scheduler yok / PDF lib yok / `apps.imports → apps.reports` import yok
- MakemigrationsCleanTest (1) — bekleyen migration yok

**Toplam proje testi: 371 (önceki 324 + 47).**

---

## 9. Yasaklar Doğrulaması

| Yasak | Durum |
|---|:---:|
| Telegram bot/`send_telegram` | ✅ yok |
| `send_mail` / `smtplib` | ✅ yok |
| `celery` / `apscheduler` / `crontab(` / `BackgroundScheduler` | ✅ yok |
| `reportlab` / `weasyprint` | ✅ yok |
| WebSocket / Channels | ✅ yok |
| Dark-mode (`prefers-color-scheme`) | ✅ yok |
| Inter / JetBrains font referansı | ✅ yok |
| `Pruva` / `Acme` UI sızıntısı | ✅ yok |
| `apps.imports → apps.reports` | ✅ yok |

---

## 10. Sonraki Adım için Notlar

- 13 enum tipinden 8'i registered/working; PAYMENTS / SUBSCRIPTIONS / REGULAR_PAYMENTS / OFFICIAL_PAYMENTS / COMBINED ileride aynı `_register()` deseniyle eklenebilir — model & UI altyapısı hazır.
- Senkron export tasarımı; eğer ileride binlerce satırlı raporlar yavaşlarsa `ReportRunStatus.PENDING` durumu bir worker tarafından yakalanacak şekilde zaten ayrılmış (model destekliyor) — ama Celery/scheduler getirmek **bu MVP kapsamı dışındadır**.
