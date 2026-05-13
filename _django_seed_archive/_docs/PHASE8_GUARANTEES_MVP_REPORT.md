# Faz 8 — Teminat Mektupları & Komisyon · Manual MVP Raporu

**Statü:** ✅ TAMAMLANDI
**Tarih:** 2026-05-07
**Anayasa Maddesi:** 1.5 (izolasyon), 3.4 (onaysız domain commit yok), 3.5 (audit), 3.8 (soft-delete), 3.16 (yyyy long-format), 11 (DESIGN_FREEZE).
**Test:** 199/199 PASS · `python manage.py check` PASS · `python manage.py migrate` PASS.

---

## 1. Kapsam

Faz 8, MUHASEBE OPERASYON SİSTEMİ'nin **Teminat Mektupları & Komisyon Manual MVP**'sidir. Hedef: çoklu banka × çoklu sahip (Person/Company) altında teminat mektubu yaşam döngüsü, komisyon dönemi üretimi, PayableItem entegrasyonu, yenileme zinciri ve iade kilidini eksiksiz manuel olarak işleten modüldür.

> **Manual MVP felsefesi:** Telegram, cron, otomatik scraping, Excel/PDF/RAR ayrıştırma YOKTUR. Kullanıcı UI'dan girer; servisler hesaplar.

---

## 2. apps.guarantees — 3 Model

| Model | Önemli Alanlar | Unique | Notlar |
|-------|----------------|--------|--------|
| `GuaranteeLetter` | owner_company/person, bank, beneficiary_institution, letter_no, title, guarantee_type, purpose, facility_label, issue_date, expiry_date, amount, currency, commission_rate, commission_period, status, renewed_from/to (self FK), returned_at, cancelled_at, notes | (bank, letter_no) **only when letter_no set** | 8 status (ACTIVE/APPROACHING/EXPIRED/RETURNED/RENEWED/CANCELLED/PASSIVE/NEEDS_REVIEW) |
| `GuaranteeCommissionPeriod` | guarantee, period_label, due_date, commission_amount, payable (O2O SET_NULL), status, source, notes | (guarantee, period_label) | 7 status, 4 source (MANUAL/GENERATED/IMPORT_DRAFT/OTHER) |
| `GuaranteeDocument` | guarantee?, commission_period?, document (PROTECT), document_role, uploaded_by | (guarantee, commission_period, document, document_role) | 6 rol (GUARANTEE_LETTER/COMMISSION_RECEIPT/RETURN_LETTER/RENEWAL_DOCUMENT/BANK_NOTICE/OTHER) |

`GuaranteeCommissionPeriod` PayableItem köprüsü için `owner_type/company/person/amount/currency` property'lerine sahiptir → `apps.finance.services.period_link.create_payable_from_period` doğrudan kullanılabilir.

`UniqueConstraint(fields=["bank","letter_no"], condition=Q(letter_no__gt=""))` ile letter_no boşken duplicate engeli devre dışı; dolduğunda zorunlu unique.

---

## 3. Servisler — `services/guarantees.py`

| Fonksiyon | Sözleşme |
|-----------|----------|
| `create_guarantee` | Yeni mektup + audit |
| `update_guarantee` | Diff + audit; closed (CANCELLED/RETURNED/RENEWED) ise blok |
| `archive_guarantee/restore_guarantee` | Soft-delete |
| `cancel_guarantee` | status=CANCELLED, cancelled_at; PENDING/LINKED komisyon dönemlerinde `cancel_payable` cascade |
| `return_guarantee` | status=RETURNED, returned_at; closed mektup tekrar iade edilemez |
| `renew_guarantee` | Yeni mektup oluşturur; old.status=RENEWED, old.renewed_to=new, new.renewed_from=old |
| `calculate_guarantee_status` | Bilgi: expiry < today → EXPIRED, ≤60g → APPROACHING |
| `calculate_commission_amount(amount, rate, kind)` | yıllık baz × factor (MONTHLY=1/12, QUARTERLY=1/4, SEMI_ANNUAL=1/2, YEARLY=1, ONE_TIME=1, CUSTOM=1/4) — `quantize(0.01)` |
| `_period_label(kind, d)` | "2025-04" / "2025-Q2" / "2025-H1" / "2025" |
| `_advance(d, kind)` | Sonraki dönem başlangıç tarihi |
| `create_commission_period` | RETURNED/CANCELLED/PASSIVE/RENEWED mektupta blok; unique label guard |
| `generate_commission_periods(g, user, months=12)` | İdempotent; step_months map'e göre N dönem üretir; `today` ileriye taşır |
| `cancel_commission_period` | Payable cascade + status=CANCELLED |
| `create_payable_from_commission` | İdempotent; CANCELLED period veya closed/zero guarantee'de blok; başlık `"Teminat Komisyonu — {letter_no} — {period_label}"`, kategori `GUARANTEE_COMMISSION`; period.status=LINKED |
| `attach_guarantee_document` | get_or_create dedup |

**Audit Coverage:** Tüm mutator servisler `audit_log(actor, action, target_type, target_id, payload)` çağırır.

---

## 4. UI / URL — 18 Endpoint

```
/guarantees/                                       → list (+ KPI'lar + filtre)
/guarantees/new/                                   → create (WriteMixin)
/guarantees/<pk>/                                  → detail
/guarantees/<pk>/edit/                             → update (WriteMixin)
/guarantees/<pk>/archive/                          → archive (WriteMixin)
/guarantees/<pk>/restore/                          → restore (WriteMixin)
/guarantees/<pk>/cancel/                           → cancel (ApproveMixin)
/guarantees/<pk>/return/                           → return (ApproveMixin)
/guarantees/<pk>/renew/                            → renew (ApproveMixin)
/guarantees/<pk>/documents/upload/                 → add_document (WriteMixin)
/guarantees/<pk>/periods/new/                      → period_create (WriteMixin)
/guarantees/<pk>/generate-periods/                 → generate_periods (WriteMixin)
/guarantees/periods/<pk>/                          → period_detail
/guarantees/periods/<pk>/edit/                     → period_update (WriteMixin)
/guarantees/periods/<pk>/cancel/                   → period_cancel (ApproveMixin)
/guarantees/periods/<pk>/create-payable/           → period_create_payable (WriteMixin)
/guarantees/periods/<pk>/documents/upload/         → period_add_document (WriteMixin)
```

**Şablonlar (8):** guarantee_list, guarantee_form, guarantee_detail, guarantee_return, guarantee_renew, commission_period_form, commission_period_detail, guarantee_document_upload.

**Yetki ayrımı (Anayasa 3.4):**
- **WriteMixin** (`can_write`): create/update/archive/restore/document/period CRUD/payable
- **ApproveMixin** (`can_approve`): cancel / return / renew — geri alınamaz lifecycle aksiyonları için yönetici yetkisi gerekir

Sidebar `🛡 Teminat Mektupları` linki placeholder'dan `guarantees:list`'e güncellendi.

---

## 5. Dashboard Entegrasyonu

`apps.dashboard.views.DashboardHomeView` içine `phase8_guarantee` context'i eklendi:
- **active_count** — ACTIVE + APPROACHING toplam mektup
- **upcoming_commissions** — sonraki 45 gün içindeki PENDING/LINKED dönemler (ilk 5)
- **overdue_count** — vadesi geçmiş açık dönemler
- **returning_count** — APPROACHING (60g içinde sona erecek) mektup sayısı
- **linked_payables** — payable'a bağlanmış dönem sayısı

`templates/dashboard/home.html` Faz 8 widget bloğu `phase7_property` sonrasında yerleştirildi. Risk kartı da `Teminat Komisyonu` artık "Faz 8'de aktif" göstermez; canlı kullanım hazır.

---

## 6. Test Kanıtı

`tests/test_phase8.py` · **32 test PASS** · 9 test class:

- `GuaranteeLifecycleTest` (8) — create/update/archive/restore + cancel cascade + return + renew chain + closed blok
- `CommissionPeriodTest` (7) — create, unique label, RETURNED/CANCELLED bloğu, idempotent generate, `calculate_commission_amount → Decimal("1000.00")` (100k × 4% / 4), manual override
- `CommissionPayableTest` (5) — payable creation, idempotent, CANCELLED period blok, RETURNED guarantee blok, **5K dekont + 50K çift onay** flag tetiklenmesi (60K)
- `DocumentTest` (2) — sha256 dedup, RETURN_LETTER attach
- `PermissionTest` (3) — viewer 403, muhasebeci return 403 (can_approve yok), super_admin return 200
- `ListViewTest` (1) — list smoke (KPI render)
- `SidebarAndWidgetTest` (2) — sidebar `/guarantees/` aktif + widget render
- `DesignContractTest` (1) — `templates/guarantees/` altında dark mode / Inter / JetBrains yok
- `NoOpGuardTest` (3) — apps/guarantees altında import command yok, telegram yok, imports app GuaranteeLetter yaratmıyor

**Tam suite:** **199/199 PASS** (Faz 4: 33, Faz 5: 30, Faz 6: 42, Faz 7: 31, Faz 8: 32, smoke + finance + documents + imports).

```
$ python manage.py test
Ran 199 tests in 113.100s
OK
```

---

## 7. Anayasa Uyumu

| Madde | Kontrol | Sonuç |
|-------|---------|-------|
| 1.5 (izolasyon) | Kaynak TEMİNAT.* dosyaları okunmadı/değiştirilmedi; gerçek banka/letter_no/tutar koda gömülmedi | ✅ |
| 3.4 (onaysız commit yok) | cancel/return/renew için ApproveMixin (can_approve) zorunlu | ✅ |
| 3.5 (audit) | Tüm service mutator'lar audit_log yazıyor | ✅ |
| 3.8 (soft-delete) | BaseModel kalıtım, archive/restore destekli | ✅ |
| 3.16 (yyyy long-format) | period_label "2025-04" / "2025-Q2" / "2025-H1" / "2025" | ✅ |
| 11 (DESIGN_FREEZE) | Dark mode YOK, IBM Plex var, Inter/JetBrains YOK | ✅ |

**Hardcode YOK:** Faz 8'de tek bir gerçek mektup, banka, letter_no, tutar koda gömülmedi. Tüm domain veriler UI'dan girilir.

**NO-OP imports:** `apps.imports.commit` GuaranteeLetter yaratmaz; Faz 8 testi bunu doğrular. Hiçbir Excel/PDF/RAR ayrıştırma kodu eklenmedi.

---

## 8. Sonuç

Faz 8 Manual MVP **production-ready** durumdadır. 3 model + 13+ servis + 18 URL + 8 şablon + dashboard widget ile teminat yaşam döngüsü (oluşturma → komisyon dönemi üretimi → PayableItem köprüsü → iade veya yenileme zinciri) eksiksiz manuel olarak çalışır. PayableItem entegrasyonu Faz 5/6/7 ile aynı `period_link` helper üzerinden idempotent şekilde devrededir; 5K dekont ve 50K çift onay eşikleri otomatik uygulanır. Yenileme zinciri (`renewed_from/to` self FK) tarihçeyi kalıcı korur.

**Sonraki Faz:** Faz 9 (Kontör/Stok) — Teminat modülü ile entegre değildir; bağımsız geliştirilebilir.
