# FAZ 1 — TEST STRATEJİSİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

---

## 1. GENEL İLKELER

| İlke | Açıklama |
|---|---|
| **Test edilmeyen kod yok** | MVP-1 hedef coverage **%60+**, MVP-2 **%75+** (Anayasa Madde 14.5) |
| **PostgreSQL testlerde kullanılır** | SQLite test DB yasak — JSONB / unique constraint farklılıkları |
| **Idempotency testi zorunlu** | Her import / cron / API endpoint için |
| **Audit testi zorunlu** | CRUD eylemi sonrası AuditLog yazımı doğrulanır |
| **Soft-delete davranışı testi** | `delete()` → `is_active=False`; `objects` filter |
| **Permission test her view için** | Yetkili / yetkisiz davranış |
| **TDD önerilir** | Özellikle servis layer'da |

---

## 2. TEST ARAÇ TAKIMI

| Tool | Görev |
|---|---|
| `pytest` + `pytest-django` | Test framework |
| `factory_boy` | Model factory |
| `freezegun` | Tarih dondurma (cron, T-N testleri) |
| `pytest-cov` | Coverage raporu |
| `responses` | HTTP mock (Telegram API) |
| `playwright` veya `selenium` | UI smoke (MVP-2) |
| `pytest-postgresql` | Test DB orchestration |

---

## 3. TEST GRUPLARI

### 3.1 Model Tests
**Amaç:** Alanlar, validasyon, soft-delete, unique constraint.

**Örnek test adları:**
- `test_sahis_tc_unique`
- `test_mulk_pruva_kodu_partial_unique`
- `test_emlak_vergisi_unique_per_yil_donem`
- `test_belge_sha256_dedup`
- `test_fatura_donem_yyyymm_format_check`
- `test_softdelete_default_manager_filters_inactive`
- `test_pruva34_daire_seed_5_records`
- `test_teminat_komisyon_periyot_enum`

**Acceptance:** Her model için minimum 1 CRUD + 1 soft-delete test.

**MVP:** MVP-1.

---

### 3.2 Service Tests
**Amaç:** Business logic, kayıt yaratma, transaction atomic, hesaplama.

**Örnek test adları:**
- `test_mark_paid_creates_audit_log`
- `test_mark_paid_partial_keeps_kalan`
- `test_pruva34_aidat_farki_compute`
- `test_kontor_kritik_threshold_detection`
- `test_emlak_grid_query_efficient`
- `test_get_or_create_record_thread_idempotent`
- `test_format_money_tr_thousand_decimal`
- `test_mask_tc_first_3_last_4_visible`

**MVP:** MVP-1 critical, MVP-2 expand.

---

### 3.3 Permission Tests
**Amaç:** Yetki matrisinin doğru çalıştığı.

**Örnek test adları:**
- `test_muhasebeci_can_mark_payment_below_threshold`
- `test_muhasebeci_cannot_approve_above_threshold`
- `test_muhasebeci_cannot_commit_import`
- `test_super_admin_can_hard_delete`
- `test_yonetici_cannot_change_telegram_mode`
- `test_personel_only_sees_assigned_tasks`
- `test_chat_thread_visibility_by_participant`
- `test_simulate_permission_returns_correct_status`

**Acceptance:** Her view için yetkisiz erişim 403 dönmeli.

**MVP:** MVP-1 zorunlu.

---

### 3.4 Import Dry-run Tests
**Amaç:** Import parse + validasyon + draft yaratma DB write yapmadan.

**Örnek test adları:**
- `test_excel_dry_run_5k_rows_under_30s`
- `test_excel_dry_run_returns_correct_status_distribution`
- `test_pdf_filename_parse_pruva_format`
- `test_rar_extract_pruva_klasor_pattern`
- `test_validation_required_field_missing_marks_error`
- `test_validation_x_mark_marks_warning`
- `test_validation_new_kurum_marks_manual`
- `test_dry_run_does_not_persist_anything`

**MVP:** MVP-1 (Faz 3 öncesi).

---

### 3.5 Import Commit Tests
**Amaç:** Onaylı kayıtların kesin oluşturulması.

**Örnek test adları:**
- `test_commit_creates_target_records`
- `test_commit_atomic_rolls_back_on_error`
- `test_commit_only_green_skips_warnings`
- `test_commit_writes_audit_log_per_record`
- `test_commit_links_belge_ozel_sinif`
- `test_commit_creates_auto_tasks_when_not_historical`
- `test_commit_skips_auto_tasks_when_historical_data_true`

**MVP:** MVP-1 (Faz 3).

---

### 3.6 Idempotency Tests
**Amaç:** Aynı işlemi 2 kez yapmak yan etki yaratmamalı.

**Örnek test adları:**
- `test_excel_reupload_same_sha256_uses_existing_belge`
- `test_fatura_import_duplicate_uses_update_strategy`
- `test_emlak_import_duplicate_year_donem_skip`
- `test_auto_task_creator_no_duplicate_for_same_target_period`
- `test_pruva_ekstre_re_import_idempotent`
- `test_belge_dedup_returns_same_instance`

**MVP:** MVP-1 zorunlu.

---

### 3.7 Notification Dry-run Tests
**Amaç:** 4 aşamalı kapı + Telegram gerçek KAPALI doğrulaması.

**Örnek test adları:**
- `test_dispatch_creates_sistem_ici_log`
- `test_dispatch_dry_run_does_not_call_telegram_api`
- `test_telegram_real_mode_blocked_without_super_admin`
- `test_telegram_token_encrypted_at_rest`
- `test_notification_retry_3_attempts_with_backoff`
- `test_t_minus_7_rule_targets_only_within_window`
- `test_threshold_rule_kontor_below_500_triggers`
- `test_user_mute_list_filters_notification`

**MVP:** MVP-1 (gerçek Telegram Faz 12'de eklenir).

---

### 3.8 Task Workflow Tests
**Amaç:** Görev otomatik üretim + yaşam döngüsü.

**Örnek test adları:**
- `test_auto_task_t_minus_3_runs_at_correct_date`
- `test_pruva_aydan_17si_task_created_for_each_daire`
- `test_task_complete_writes_history`
- `test_task_defer_requires_reason_and_audit`
- `test_task_kanban_drag_updates_durum`
- `test_task_assigned_user_can_complete`
- `test_task_unauthorized_user_cannot_complete`
- `test_overdue_summary_email_at_09_00`

**MVP:** MVP-1 (Faz 10).

---

### 3.9 Chat Permission Tests (MVP-3)
- `test_chat_thread_only_visible_to_participants`
- `test_record_linked_thread_inherits_record_perm`
- `test_mention_creates_notification`
- `test_message_soft_delete_keeps_audit`
- `test_websocket_unauthorized_disconnect`

**MVP:** MVP-3 (Faz 11).

---

### 3.10 UI Smoke Tests
**Amaç:** Critical user flow render + interaction (Playwright).

**Test scenarios:**
- `smoke_login_redirects_to_dashboard`
- `smoke_dashboard_renders_kpi_cards`
- `smoke_invoice_list_filter_works`
- `smoke_invoice_detail_tabs_switch`
- `smoke_mark_paid_modal_submit`
- `smoke_import_upload_step_to_preview`
- `smoke_import_preview_action_buttons`
- `smoke_pruva_daire_card_click_opens_timeline`
- `smoke_emlak_grid_cell_click_opens_drawer`
- `smoke_task_card_complete_button`
- `smoke_chat_widget_collapse_expand`
- `smoke_audit_log_drawer_shows_diff`

**MVP:** MVP-2 (Faz 13 öncesi).

---

### 3.11 Mobile Smoke Checklist
**Amaç:** 6 mobil frame'in iPhone Pro Max viewport'unda doğru render'ı.

**Manuel checklist + Playwright (430×932 device emulation):**
- [ ] Mobile dashboard 2x2 KPI grid render
- [ ] Risk kartları yatay scroll
- [ ] Tab/chip yatay scroll
- [ ] Sticky bottom action bar görünür
- [ ] FAB (+) görünür ve clickable
- [ ] Form input fontSize 16
- [ ] Tüm aksiyon butonları ≥44px
- [ ] Tablo görünmüyor (kart akışı)
- [ ] Modal/drawer fullscreen
- [ ] Chat fullscreen Frame 25
- [ ] Capture="camera" attribute dekont upload
- [ ] iOS safe-area padding doğru

**MVP:** MVP-1 (manuel) + MVP-2 (otomatik).

---

### 3.12 AuditLog Tests
- `test_create_record_writes_create_audit`
- `test_update_record_writes_update_with_diff`
- `test_soft_delete_writes_soft_delete_audit`
- `test_hard_delete_writes_critical_audit_with_reason`
- `test_audit_masks_tc_phone_in_log`
- `test_login_logout_writes_audit`
- `test_permission_change_marked_critical`
- `test_audit_query_by_record_id_efficient`

**MVP:** MVP-1 zorunlu.

---

### 3.13 Export Tests
- `test_excel_export_columns_match_selection`
- `test_pdf_export_renders_money_format_tr`
- `test_export_respects_user_filter`
- `test_export_respects_user_permission`
- `test_export_writes_audit_log`
- `test_export_file_cleanup_after_ttl`

**MVP:** MVP-2 (Faz 13).

---

### 3.14 Management Command Tests
- `test_bootstrap_users_creates_6_groups`
- `test_seed_master_idempotent`
- `test_import_dry_run_command_outputs_report`
- `test_audit_export_excel_format_valid`
- `test_pruva_import_rar_command`
- `test_emlak_taksit_calendar_command`

**MVP:** MVP-1 her command için min 1 test.

---

## 4. KRİTİK ACCEPTANCE CRITERIA (MVP-1 release öncesi)

Aşağıdaki testler **mutlaka yeşil** olmalı:

1. ✅ Login + Logout audit yazılıyor.
2. ✅ Yetki matrisi 6 rol için doğru.
3. ✅ Import dry-run hiç DB write yapmıyor.
4. ✅ Import commit atomic; hata olursa tüm batch rollback.
5. ✅ Aynı dosya tekrar yüklemek duplicate yaratmıyor (sha256).
6. ✅ Soft-delete sonrası `objects.all()` kaydı göstermiyor.
7. ✅ Hard-delete sadece Super Admin + sebep zorunlu.
8. ✅ AuditLog'da TC/telefon maskeli.
9. ✅ Telegram gerçek modu KAPALI default.
10. ✅ Otomatik görev üretimi idempotent.
11. ✅ `historical_data=True` import → görev/bildirim üretmiyor.
12. ✅ SiteX RAR parse 5 daire × ay matrisi doğru.
13. ✅ Emlak vergisi `(mulk, yil, donem)` unique.
14. ✅ Teminat mektubu `(banka, mektup_no)` unique.
15. ✅ Para format `₺ 1.234,56` tüm export'larda.
16. ✅ Mobile input fontSize ≥16px (CSS test).
17. ✅ Touch target ≥44px (axe DevTools).
18. ✅ WCAG AA kontrast (axe).

---

## 5. FACTORY BOY ÖRNEKLERİ

```python
# tests/factories.py
class SahisFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Sahis
    ad_soyad = factory.Faker("name", locale="tr_TR")
    tc_no = factory.Sequence(lambda n: f"1234567{n:04d}")
    aile_grubu = "ACME"

class FaturaFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Fatura
    fatura_tarihi = factory.LazyFunction(date.today)
    son_odeme_tarihi = factory.LazyAttribute(lambda o: o.fatura_tarihi + timedelta(days=20))
    donem_yyyymm = factory.LazyAttribute(lambda o: o.fatura_tarihi.strftime("%Y%m"))
    tutar = Decimal("100.00")
    durum = "BEKLIYOR"
    kurum = factory.SubFactory(KurumFactory)
```

---

## 6. CI/CD TEST PIPELINE (öneri)

```yaml
# .github/workflows/test.yml veya .gitlab-ci.yml
test:
  services:
    - postgres:15
    - redis:7
  steps:
    - lint:    ruff check + black --check
    - migrate: python manage.py migrate
    - test:    pytest --cov=apps --cov-report=xml --cov-fail-under=60
    - upload:  codecov.io (opsiyonel)
```

PR merge için:
- ✅ Lint geçti
- ✅ Test coverage ≥%60 (MVP-1) / ≥%75 (MVP-2)
- ✅ Migration check (`python manage.py makemigrations --check`)
- ✅ En az 1 reviewer onayı

---

## 7. DR / RESTORE DRILL (manual, çeyreklik)

| # | Test |
|---|---|
| 1 | DB backup'tan restore staging'e |
| 2 | Login + Dashboard + 1 fatura görüntüleme |
| 3 | Media restore + 1 PDF açma |
| 4 | AuditLog timeline 30 gün önce kayıt görünür |
| 5 | Smoke 12 madde geçti |

İlk drill: prod canlısından 1 hafta önce.

---

## 8. PERFORMANS TEST (LATER, MVP-2)

- **k6** veya **locust** ile load test.
- Hedef: 30 eşzamanlı kullanıcı, 1 sn altı response time, %99 success.
- Senaryolar: dashboard render, fatura listesi 500 kayıt, import preview 1K satır.

---

## 9. RİSK BAZLI TEST ÖNCELİĞİ

| Modül | Risk | Test Yoğunluğu MVP-1 |
|---|---|---|
| Imports | Çok yüksek (veri kalitesi) | %85 |
| Audit | Yüksek (KVKK + uyum) | %85 |
| Accounts/Permissions | Yüksek | %75 |
| Finance/Payments | Yüksek (finansal) | %75 |
| Notifications/Telegram | Yüksek (yanlış mesaj) | %75 |
| SiteX/Emlak/Teminat | Orta | %65 |
| Tasks | Orta | %70 |
| Reports | Düşük | %60 |
| Chat (MVP-3) | Düşük | — |

---

**SON.** Bu strateji Faz 2 başlangıcından MVP-1 canlısına kadar test öncelik referansıdır.
