# Faz 7 — Emlak Vergisi & Mülk Takip · Manual MVP Raporu

**Statü:** ✅ TAMAMLANDI
**Tarih:** 2026-05-07
**Anayasa Maddesi:** 1.5 (izolasyon), 3.4 (onaysız domain commit yok), 3.5 (audit), 3.8 (soft-delete), 3.16 (yyyy long-format), 11 (DESIGN_FREEZE).
**Test:** 167/167 PASS · `python manage.py check` PASS · `python manage.py migrate` PASS.

---

## 1. Kapsam

Faz 7, MUHASEBE OPERASYON SİSTEMİ'nin **Emlak Vergisi & Mülk Takip Manual MVP**'sidir. Hedef: belediye-bağımsız, sınırsız mülk genişlemesine açık, satılan mülk için tarihçe koruyan, taksit takibi yapan ve PayableItem entegrasyonu sağlayan eksiksiz bir manuel modül.

> **Manual MVP felsefesi:** Telegram, cron, otomatik scraping, RAR/PDF/Excel modifikasyonu YOKTUR. Tüm domain veriler kullanıcı tarafından arayüzden girilir.

---

## 2. W-3 PropertyAsset Patch

`apps.parties.PropertyAsset` modeli geriye uyumlu şekilde zenginleştirildi:

| Alan | Tip | Default | Açıklama |
|------|-----|---------|----------|
| `property_type` | choice (8 değer) | OTHER | APARTMENT/SHOP/OFFICE/LAND/WAREHOUSE/FACTORY/HOTEL/OTHER |
| `owner_person` | FK Person SET_NULL | null | Şahıs malik |
| `owner_company` | FK Company SET_NULL | null | Şirket malik |
| `province`, `district`, `address` | text | "" | Lokasyon |
| `parcel_info`, `independent_section` | text | "" | Tapu bilgisi |
| `status` | choice (5 değer) | ACTIVE | ACTIVE/PASSIVE/SOLD/RENTED/NEEDS_REVIEW |
| `sale_date`, `buyer_name` | date/text | null/"" | Satış kaydı (mark_property_sold) |

Migration: `parties/0002_propertyasset_buyer_name_propertyasset_district_and_more.py` · uygulandı.

**Kritik kural:** `mark_property_sold` çağrıldığında geçmiş `PropertyTaxYear` ve `PropertyTaxInstallment` kayıtları **silinmez** (PROTECT/CASCADE doğru kuruldu); satış sonrası yıl eklenmek istenirse otomatik `[NOT] Mülk SOLD durumunda — kullanıcı bilinçli ekledi.` notu düşer.

---

## 3. apps.properties — 4 Model

| Model | Önemli Alanlar | Unique | Notes |
|-------|---------------|--------|-------|
| `Municipality` | name, province, district, website | (name, province, district) | Belediye master |
| `PropertyTaxYear` | property_asset, municipality, tax_year, total_accrual_amount, total_paid_amount, remaining_amount, status, source, notes | (property_asset, tax_year) | TaxYearStatus 7 değer |
| `PropertyTaxInstallment` | tax_year, installment_no, due_date, amount, payable (O2O), status, payment_date, notes | (tax_year, installment_no) | InstallmentStatus 7 değer |
| `PropertyTaxDocument` | tax_year, installment, document, document_role, uploaded_by | (tax_year, installment, document, document_role) | TaxDocumentRole 5 değer |

`PropertyTaxInstallment` PayableItem köprüsü için `owner_type/company/person/currency` property'lerine sahiptir → `apps.finance.services.period_link.create_payable_from_period` doğrudan kullanılabilir.

---

## 4. Servisler — `services/property_tax.py`

| Fonksiyon | Sözleşme |
|-----------|----------|
| `create_property_asset` | W-3 yeni mülk + audit |
| `update_property_asset` | Alan diff + audit |
| `mark_property_sold` | status=SOLD, sale_date, buyer_name; tarihçe korunur |
| `create_municipality` | unique triple korunur |
| `default_installment_due_date(year, no)` | **1.taksit=31.05, 2.taksit=30.11**, diğer→30.11 |
| `create_property_tax_year` | unique guard, ValidationError, audit |
| `update_property_tax_year` | CANCELLED kilit |
| `cancel_property_tax_year` | Cascade: bağlı taksitlerin payable'ı `cancel_payable` ile iptal, taksit status=CANCELLED |
| `calculate_tax_year_totals` | PAID toplamı + remaining + status PAID/PARTIAL_PAID/PENDING |
| `create_installment` | unique guard, default due date fallback |
| `generate_default_installments` | İdempotent: 1./2. taksiti yaratır, mevcut atlanır |
| `cancel_installment` | Payable cascade + status=CANCELLED |
| `create_payable_from_installment` | İdempotent (installment.payable doluysa mevcut döner), CANCELLED/0 amount blok |
| `mark_installment_paid_from_payable` | Payable PAID ise installment PAID + payment_date |
| `attach_tax_document` | get_or_create dedup |

**Audit Coverage:** 13/13 service mutator audit_log yazıyor (Anayasa 3.5).

---

## 5. UI / URL — 18 Endpoint

```
/properties/                                       → dashboard
/properties/assets/new/                            → asset_create
/properties/assets/<pk>/                           → asset_detail
/properties/assets/<pk>/edit/                      → asset_update
/properties/assets/<pk>/mark-sold/                 → asset_mark_sold
/properties/municipalities/                        → municipality_list
/properties/municipalities/new/                    → municipality_create
/properties/years/new/                             → tax_year_create
/properties/years/<pk>/                            → tax_year_detail
/properties/years/<pk>/edit/                       → tax_year_update
/properties/years/<pk>/cancel/                     → tax_year_cancel
/properties/years/<pk>/generate-installments/      → tax_year_generate_installments
/properties/years/<pk>/installments/new/           → installment_create
/properties/years/<year_pk>/documents/upload/      → year_document_upload
/properties/installments/<pk>/                     → installment_detail
/properties/installments/<pk>/edit/                → installment_update
/properties/installments/<pk>/cancel/              → installment_cancel
/properties/installments/<pk>/create-payable/      → installment_create_payable
/properties/installments/<inst_pk>/documents/upload/ → installment_document_upload
```

**Şablonlar (10):** dashboard, asset_form, asset_detail, municipality_list, municipality_form, tax_year_form, tax_year_detail, installment_form, installment_detail, document_upload.

**Yetki:** WriteMixin (UserPassesTestMixin + `apps.finance.permissions.can_write`) tüm yazma view'larında.

---

## 6. Dashboard Entegrasyonu

`apps.dashboard.views.DashboardHomeView` içine `phase7_property` context'i + `templates/dashboard/home.html` içine widget eklendi:
- {{ this_year }} takipteki yıl sayısı
- Aktif mülk sayısı (status NOT IN SOLD/PASSIVE)
- Satıldı sayısı (status=SOLD)
- Geciken taksit sayısı
- Yaklaşan 5 taksit (45 gün penceresi)

Sidebar `🏛 Emlak Vergisi` linki placeholder'dan `properties:dashboard`'a güncellendi.

---

## 7. Test Kanıtı

`tests/test_phase7.py` · **31 test PASS** · 11 test class:

- `PropertyAssetW3Test` (6) — default ACTIVE, types, owner FK, mark_sold tarihçe, audit, sınırsız mülk
- `MunicipalityTest` (2) — create + unique triple
- `PropertyTaxYearTest` (3) — create, unique, cancel cascade
- `DefaultDueDateTest` (3) — 31.05, 30.11, fallback
- `InstallmentTest` (4) — generate default, idempotent, unique, totals partial
- `InstallmentPayableTest` (4) — create, idempotent, cancelled blok, 0 amount blok
- `DocumentTest` (1) — attach dedup
- `ViewPermissionTest` (3) — login required, dashboard load, municipality list
- `SidebarLinkTest` (1) — `/properties/` aktif, eski placeholder kalkmış
- `DashboardWidgetTest` (1) — widget render
- `DesignContractTest` (1) — dark mode yok, Inter/JetBrains yok
- `NoOpImportTest` (2) — properties altında import command yok, telegram yok

**Tam suite:** 167/167 PASS (Faz 4: 33, Faz 5: 30, Faz 6: 42, Faz 7: 31, smoke + finance + documents + imports).

---

## 8. Anayasa Uyumu

| Madde | Kontrol | Sonuç |
|-------|---------|-------|
| 1.5 (izolasyon) | Diğer Acme projelerinden bağımsız | ✅ |
| 3.4 (onaysız commit yok) | Bu rapor commit/push içermez | ✅ |
| 3.5 (audit) | 13/13 mutator audit_log | ✅ |
| 3.8 (soft-delete) | BaseModel kalıtım, archive/restore destekli | ✅ |
| 3.16 (yyyy long-format) | PropertyTaxYear `tax_year=int(2025)`, period_label=str(yıl) | ✅ |
| 11 (DESIGN_FREEZE) | dark mode YOK, IBM Plex var, Inter/JetBrains YOK | ✅ |

**Hardcode YOK:** Faz 7'de tek bir mülk/belediye master verisi koda gömülmedi. Tüm domain veriler UI'dan girilir.

---

## 9. Sonuç

Faz 7 Manual MVP **production-ready** durumdadır. W-3 PropertyAsset patch geriye uyumludur (mevcut tüm kayıtlar `status=ACTIVE` defaultu ile korunur). Yeni `apps.properties` 4 model + 13 servis + 18 URL + 10 şablon + dashboard widget ile eksiksiz çalışır. PayableItem köprüsü Faz 5/6 ile aynı `period_link` helper üzerinden idempotent şekilde devrededir.
