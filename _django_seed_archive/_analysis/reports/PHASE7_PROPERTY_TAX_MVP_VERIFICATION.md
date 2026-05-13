# Faz 7 — Emlak Vergisi & Mülk Takip Manual MVP · Doğrulama Tutanağı

**Statü:** ✅ PASS
**Tarih:** 2026-05-07
**Çalıştırma:** `python manage.py check` PASS · `migrate` PASS · `manage.py test` 167/167 PASS.

---

## 22-Maddelik Kabul Kriterleri

| # | Kriter | Durum | Kanıt |
|---|--------|-------|-------|
| 1 | `manage.py check` PASS | ✅ | `System check identified no issues (0 silenced).` |
| 2 | Migration apply PASS | ✅ | `parties.0002 OK · properties.0001 OK` |
| 3 | Tüm testler PASS | ✅ | `Ran 167 tests in 97.598s · OK` |
| 4 | W-3 PropertyAsset.status default ACTIVE | ✅ | `PropertyAssetW3Test.test_default_status_active` |
| 5 | W-3 mark_property_sold tarihçeyi korur | ✅ | `test_mark_sold_keeps_history` (TaxYear hâlâ exists) |
| 6 | Yeni mülk UI'dan eklenebilir (sınırsız) | ✅ | `test_unlimited_property_addition` (5 mülk) |
| 7 | Satılan mülk hâlâ görünür (asset_detail) | ✅ | `assets_inactive` dashboard'da, AssetDetailView SOLD'u render eder |
| 8 | Municipality CRUD + unique triple | ✅ | `MunicipalityTest.test_unique_triple` |
| 9 | PropertyTaxYear unique(property, year) | ✅ | `PropertyTaxYearTest.test_unique_per_property_year` |
| 10 | PropertyTaxInstallment unique(year, no) | ✅ | `InstallmentTest.test_unique_per_year_no` |
| 11 | Default due date 1.taksit=31.05 | ✅ | `DefaultDueDateTest.test_first_installment_may_31` |
| 12 | Default due date 2.taksit=30.11 | ✅ | `DefaultDueDateTest.test_second_installment_nov_30` |
| 13 | generate_default_installments idempotent | ✅ | `test_generate_idempotent` (2. çağrı 0 yaratır) |
| 14 | calculate_tax_year_totals doğru hesap | ✅ | `test_calculate_totals_partial` (1200 PAID → PARTIAL_PAID) |
| 15 | create_payable_from_installment çalışır | ✅ | `InstallmentPayableTest.test_create_payable` (LINKED + payable.amount) |
| 16 | Payable creation idempotent | ✅ | `test_create_payable_idempotent` (p1.pk == p2.pk) |
| 17 | CANCELLED installment payable üretmez | ✅ | `test_cancelled_blocks_payable` (ValidationError) |
| 18 | 5K eşik / 50K çift onay kuralları korunur | ✅ | period_link → `requires_receipt`, `requires_double_approval` aktif |
| 19 | Document SHA-256 dedup + attach get_or_create | ✅ | `DocumentTest.test_attach_dedup` |
| 20 | AuditLog 13/13 service yazıyor | ✅ | `test_create_property_asset_writes_audit` |
| 21 | Permission gate (WriteMixin) | ✅ | tüm yazma view'larında `WriteMixin(UserPassesTestMixin)` |
| 22 | Dashboard widget render + sidebar aktif | ✅ | `DashboardWidgetTest`, `SidebarLinkTest` |

---

## Anayasa Madde Kontrol

| Madde | Kanıt |
|-------|-------|
| 1.5 izolasyon | Faz 7 yalnız bu repo `apps.properties` altında; diğer Acme projelerine referans yok. |
| 3.4 commit yok | Bu doğrulama oturumu commit/push/deploy içermez. |
| 3.5 audit | 13 service mutator → 13 `audit_log` çağrısı. |
| 3.8 soft-delete | `BaseModel` kalıtımı; `is_active` filter dashboard ve queryset'lerde. |
| 3.16 yyyy long-format | `tax_year=int(yyyy)`, `period_label=str(yyyy)` PayableItem'a iletilir. |
| 11 DESIGN_FREEZE | `DesignContractTest` PASS — dark mode yok, Inter/JetBrains yok, IBM Plex base.html'de mevcut. |

---

## NO-OP Kontrolleri

| Yasak | Kontrol | Sonuç |
|-------|---------|-------|
| Telegram | properties altında `telegram` keyword'ü yok | ✅ `NoOpImportTest.test_no_telegram_in_properties` |
| Import command | `apps/properties/management/commands/` boş | ✅ `test_no_import_command_in_properties` |
| Cron / scheduler | yok | ✅ kod gözden geçirildi |
| RAR/PDF/Excel modifikasyonu | yok | ✅ source dosyalarına dokunulmadı |
| Hardcode mülk/belediye | yok | ✅ tüm veriler UI'dan girilir |

---

## Kapsam Sayım

- **Models:** 4 (Municipality, PropertyTaxYear, PropertyTaxInstallment, PropertyTaxDocument) + 4 enum
- **Services:** 13 fonksiyon
- **Forms:** 6 (Municipality, PropertyAsset, TaxYear, TaxInstallment, DocumentUpload, MarkSold)
- **Views:** 18 (Dashboard, Asset CRUD/MarkSold, Muni CRUD, TaxYear CRUD/Cancel/GenerateInstallments, Installment CRUD/Cancel/CreatePayable, DocumentUpload year/installment)
- **URL endpoints:** 19 (`properties:*` namespace)
- **Templates:** 10
- **Tests:** 31 (test_phase7.py) — tümü PASS
- **Migrations:** 2 (parties.0002, properties.0001)
- **Dashboard widget:** Faz 7 kartı + 5 satırlık yaklaşan taksit listesi

---

## Sonuç

Faz 7 Manual MVP **kabul edildi**. Hiçbir Anayasa maddesi ihlal edilmedi. Tüm 22 kabul kriteri PASS. 167 test green. Production deploy hazır (kullanıcı onayı sonrası).
