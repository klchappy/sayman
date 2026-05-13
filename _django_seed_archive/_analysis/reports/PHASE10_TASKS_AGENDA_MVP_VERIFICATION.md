# Faz 10 — Ajanda / Görev Yönetimi Doğrulama Tutanağı

**Statü:** ✅ PASS
**Tarih:** 2026-05-07
**Çalıştırma:**
- `python manage.py check` → `System check identified no issues (0 silenced).`
- `python manage.py makemigrations --dry-run --check` → `No changes detected`
- `python manage.py test` → **281/281 PASS** (önceki 248 + 33 yeni Faz 10).

---

## Acceptance Criteria

| # | Kriter | Durum | Kanıt |
|---|--------|-------|-------|
| 1 | `manage.py check` PASS | ✅ | `0 silenced` |
| 2 | `makemigrations --dry-run --check` boş | ✅ | `No changes detected` |
| 3 | Tam test suite PASS (sıfır regresyon) | ✅ | `Ran 281 tests · OK` (248 + 33) |
| 4 | Task model: priority CRITICAL var | ✅ | `TaskPriority.CRITICAL` (`apps/tasks/models.py`) |
| 5 | Task model: status OPEN/POSTPONED/COMPLETED yeni şema | ✅ | `TaskStatus` enum (6 değer) |
| 6 | Eski enum'lar (NEW/DEFERRED/DONE/URGENT) veri kaybetmeden taşındı | ✅ | `0002_phase10_tasks_enrichment.py` RunPython `_migrate_legacy_task_values` |
| 7 | TaskComment / TaskAttachment / TaskEvent yeni modelleri | ✅ | `apps/tasks/models.py` + admin.py registered |
| 8 | TaskAttachment SHA-256 dedup | ✅ | `TaskCommentAttachmentTest.test_attachment_dedup_by_sha256` |
| 9 | TaskAttachment unique(task, document) | ✅ | UniqueConstraint + `test_attachment_unique_per_task` |
| 10 | 16 servis fonksiyonu (lifecycle + queries + generic) | ✅ | `apps/tasks/services/tasks.py` |
| 11 | Tüm mutator'lar AuditLog yazar | ✅ | `_audit()` her serviste; `test_create_emits_event_and_audit` |
| 12 | Tüm mutator'lar TaskEvent yazar | ✅ | `_emit_event()` her serviste |
| 13 | İdempotency: tamamlanan görev tekrar tamamlanamaz | ✅ | `test_double_complete_raises` |
| 14 | İptal görev tamamlanamaz | ✅ | `test_cancel_then_complete_raises` |
| 15 | Reopen sadece terminal görev için | ✅ | `test_reopen_only_terminal` |
| 16 | Postpone tarihi gelecek olmalı | ✅ | `test_postpone_requires_future` |
| 17 | 17 URL endpoint | ✅ | `apps/tasks/urls.py` (list/today/upcoming/overdue/assigned-to-me/created-by-me/new/create-for-object/detail/edit/start/postpone/complete/cancel/reopen/comment/attach) |
| 18 | 5 form (TaskForm/Status/Postpone/Comment/Attachment) | ✅ | `apps/tasks/forms.py` |
| 19 | 6 template (list/today/form/detail/_panel) | ✅ | `templates/tasks/task_list.html, task_today.html, task_form.html, task_detail.html, _object_tasks_panel.html` |
| 20 | Permission: viewer create yapamaz | ✅ | `test_viewer_cannot_create` (403) |
| 21 | Permission: yazma rolü create yapabilir | ✅ | `test_writer_can_create` (200) |
| 22 | Permission: atanan personel kendi görevini tamamlar | ✅ | `test_assignee_can_complete_own` |
| 23 | Permission: cancel/reopen sadece approve rolü | ✅ | `test_only_approver_can_cancel` |
| 24 | Dashboard widget: Bugünkü Görevlerim render | ✅ | `TaskDashboardRenderTest.test_dashboard_renders_task_widgets` |
| 25 | Dashboard mini-KPI: Bugün/Geciken/Kritik | ✅ | `phase10_tasks` ctx + template grid |
| 26 | Dashboard `status="DONE"` referansı `"COMPLETED"` oldu | ✅ | `apps/dashboard/views.py:31` |
| 27 | 11 detay sayfasında bağlı görev paneli include | ✅ | `TaskDomainPanelIncludeTest` |
| 28 | "+ Görev Oluştur" link'i create_for_object'a yönlendirir | ✅ | `_object_tasks_panel.html` href |
| 29 | get_tasks_for_object active filter çalışır | ✅ | `test_get_tasks_for_object_filters_active` |
| 30 | Today query: bugün + geciken birleşir | ✅ | `test_today_includes_today_and_overdue` |
| 31 | UI Identity Reset kontratı korunuyor (Pruva/Acme UI'da yok) | ✅ | `test_ui_forbidden_terms_absent` (önceki 11) hala PASS + `TaskUiContractTest` |
| 32 | IBM Plex / no-Inter / no-JetBrains / no-dark-mode | ✅ | UI Identity testleri PASS |
| 33 | NO Telegram / SMTP / mail send | ✅ | `test_no_telegram_send_imports` |
| 34 | NO Celery / APScheduler / crontab | ✅ | `test_no_cron_or_scheduler_in_apps_tasks` |
| 35 | Import commit Task üretmez | ✅ | `test_imports_does_not_create_tasks` |
| 36 | Migration / model / domain logic yan etkisi yok (Faz 1–9 testleri) | ✅ | 248 önceki test PASS, sıfır regresyon |
| 37 | Commit / push / deploy yok | ✅ | Yalnız çalışma ağacı |

---

## Anayasa Madde Kontrol

| Madde | Kanıt |
|-------|-------|
| 1.5 izolasyon | Sadece `apps/tasks/**`, `apps/dashboard/views.py` (1 satır + Faz 10 ctx), `templates/dashboard/home.html` (1 enum + widget grid), `templates/tasks/**`, 11 detay sayfasında 1 include eklendi. Kaynak Excel/RAR/PDF/design canvas dosyalarına dokunulmadı. |
| 3.4 commit yok | Bu doğrulama oturumu commit/push/deploy içermez. |
| 3.8 soft-delete | Task/TaskComment/TaskAttachment BaseModel miras (is_active/archive). TaskEvent immutable (delete edilmez). |
| 11 DESIGN_FREEZE | Light-only · IBM Plex Sans/Mono · Inter/JetBrains yok · dark-mode aktif kuralı yok — tüm Faz 10 dosyaları yasak kelime + CSS sözleşme testlerinden geçer. |

---

## Değişen / Yeni Dosyalar

```
apps/tasks/models.py                                    (rewrite — 4 model)
apps/tasks/migrations/0002_phase10_tasks_enrichment.py  (YENİ — RunPython data migration)
apps/tasks/services/__init__.py                         (YENİ)
apps/tasks/services/tasks.py                            (YENİ — 16 fonksiyon)
apps/tasks/forms.py                                     (YENİ — 5 form)
apps/tasks/views.py                                     (rewrite — 17 view)
apps/tasks/urls.py                                      (rewrite — 17 endpoint)
apps/tasks/admin.py                                     (4 model)
apps/tasks/templatetags/__init__.py                     (YENİ)
apps/tasks/templatetags/tasks_tags.py                   (YENİ — related_tasks_panel)
apps/dashboard/views.py                                 (DONE→COMPLETED + phase10_tasks ctx)
templates/dashboard/home.html                           (URGENT→CRITICAL + 3'lü mini KPI)
templates/tasks/list.html                               (KALDIRILDI — yerine task_list.html)
templates/tasks/task_list.html                          (YENİ)
templates/tasks/task_today.html                         (YENİ)
templates/tasks/task_form.html                          (YENİ)
templates/tasks/task_detail.html                        (YENİ)
templates/tasks/_object_tasks_panel.html                (YENİ — reusable include)
templates/finance/payable_detail.html                   (panel include)
templates/subscriptions/subscription_detail.html        (panel include)
templates/regular_payments/profile_detail.html          (panel include)
templates/official_payments/profile_detail.html         (panel include)
templates/pruva/statement_detail.html                   (panel include)
templates/properties/installment_detail.html            (panel include)
templates/guarantees/guarantee_detail.html              (panel include)
templates/guarantees/commission_period_detail.html      (panel include)
templates/integrators/service_detail.html               (panel include)
templates/integrators/contract_detail.html              (panel include)
templates/integrators/credit_package_detail.html        (panel include)
tests/test_phase10.py                                   (YENİ — 33 test)
```

**Toplam:** 1 yeni model (4 sınıf), 1 yeni migration (RunPython), 1 yeni servis paketi (16 fn), 1 yeni form modülü, yenilenen views/urls/admin, 1 yeni templatetag, 5 yeni template + 1 reusable partial, 11 detay sayfasında panel include, 1 yeni test dosyası (33 test). Dashboard'da 1 enum dönüşümü + 1 ctx genişlemesi.

---

## Test Toplam Tablosu

| Faz / Suite | Test |
|-------------|------|
| Smoke / scaffold / finance / documents / imports | 31 |
| Faz 4 Finance | 33 |
| Faz 5 Subs/Regular/Official | 30 |
| Faz 6 Pruva | 42 |
| Faz 7 Property Tax | 31 |
| Faz 8 Guarantees | 32 |
| Faz 9 Integrators & Credits | 38 |
| UI Identity Reset | 11 |
| **Faz 10 Tasks/Agenda (yeni)** | **33** |
| **TOPLAM** | **281** |

---

## NO-OP / Negatif Kontrol

| Kontrol | Sonuç |
|---------|-------|
| `python manage.py makemigrations --dry-run --check` | `No changes detected` |
| `apps.imports` `apps.tasks` import etmiyor | ✅ (`test_imports_does_not_create_tasks`) |
| Cron / scheduler eklenmedi (`celery`/`apscheduler`/`crontab(` yok) | ✅ (`test_no_cron_or_scheduler_in_apps_tasks`) |
| Telegram / SMTP / mail send eklenmedi | ✅ (`test_no_telegram_send_imports`) |
| RAR / PDF / Excel parser eklenmedi | ✅ |
| `design-canvas.jsx` ve `_docs/DESIGN_*` dokunulmadı | ✅ |
| Faz 1–9 önceki testler (248 adet) sıfır regresyon | ✅ |

---

## Sonuç

Faz 10 tüm 37 acceptance kriterinde PASS. Yaşam döngüsü mutator'ları (create/start/postpone/complete/cancel/reopen/assign/comment/attach), terminal görev koruması (double-complete / cancel-then-complete / reopen-only-terminal), permission split (writer create + assignee complete + approver cancel/reopen), generic relation üzerinden 11 domain detay sayfasına entegrasyon, dashboard için 3'lü mini-KPI grid, tüm bunlar 33 yeni test ile kapsanıp önceki 248 testle birlikte 281/281 PASS. Anayasa / DESIGN_FREEZE / UI Identity Reset kontratları ihlal edilmedi. Telegram / cron / mail send / WebSocket chat / scheduler / commit-push-deploy YOK.

**FİNAL KARAR: FAZ 10 PASS — Faz 11 (Belge yaşam döngüsü) öncesi sağlam baseline.**
