# FAZ 4 — FATURA & ÖDEME MANUAL MVP RAPORU
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 4 — Manual-first Fatura/Ödeme MVP
**Tarih:** 2026-05-06
**Durum:** TAMAMLANDI · 65/65 test PASS · Faz 5 için hazır

---

## 1. OLUŞTURULAN APP (1)

| App | Sorumluluk |
|---|---|
| `apps.finance` | PayableItem (fatura/ödeme kalemi) + PaymentTransaction + PayableDocument · manual CRUD + ödeme işaretleme + tutar eşiği (5K dekont, 50K çift onay) + dashboard KPI besleyicisi |

---

## 2. MODEL LİSTESİ (3 yeni)

| Model | Anahtar Alanlar | Faz |
|---|---|---|
| `PayableItem` | owner_type/company/person, title, category, institution, supplier_name, invoice_number, subscription_reference, period_label, issue_date, **due_date**, currency, **amount, amount_paid**, **status** (10 enum), payment_method (7 enum), bank, source (5 enum), **requires_receipt, requires_double_approval**, approved_by, approved_at, BaseModel | ✅ |
| `PaymentTransaction` | payable FK, payment_date, amount, payment_method, bank, **status** (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED), receipt_document FK Document, note, created_by/approved_by | ✅ |
| `PayableDocument` | payable FK, document FK, document_role (INVOICE/RECEIPT/CONTRACT/STATEMENT/OTHER), uploaded_by + unique_together (payable, document, document_role) | ✅ |

**Computed properties:** `remaining_amount`, `has_receipt`, `is_overdue`, `owner_label`.

---

## 3. MIGRATION

```
finance       [X] 0001_initial    (PayableItem + PaymentTransaction + PayableDocument + 2 index + 1 unique_together)
```

---

## 4. URL LİSTESİ (9 endpoint)

```
/finance/payables/                            → liste + KPI + filter
/finance/payables/new/                        → oluştur
/finance/payables/<int:pk>/                   → detay (header + 4 KPI + ödemeler + belgeler + audit)
/finance/payables/<int:pk>/edit/              → düzenle
/finance/payables/<int:pk>/archive/           → POST arşiv/restore
/finance/payables/<int:pk>/mark-paid/         → ödeme işaretleme formu
/finance/payables/<int:pk>/add-document/      → belge yükleme formu
/finance/payments/<int:pk>/approve/           → POST yüksek tutar ödeme onaylama
/finance/payments/<int:pk>/reject/            → POST reddetme
```

---

## 5. TEMPLATE LİSTESİ (5 yeni)

```
templates/finance/
  ├── payable_list.html       (KPI bandı 6 kart + filter bar + 11 kolon tablo + status badge sistemi)
  ├── payable_form.html       (16-alan grid form + tutar eşiği uyarı)
  ├── payable_detail.html     (header + 4 özet KPI + 2 panel + ödemeler tablosu + belge tablosu + bağlı görevler + audit)
  ├── mark_paid.html          (özet kart + ödeme formu + dekont yükleme + audit notu + tutar eşiği uyarı)
  └── document_upload.html    (basit yükleme formu)
```

---

## 6. SERVİS LİSTESİ

`apps/finance/services/payments.py`:

- `requires_receipt(amount)` — 5.000 TL eşiği
- `requires_double_approval(amount)` — 50.000 TL eşiği
- `calculate_payable_status(payable)` — tutar/ödeme/tarih bazlı status
- `refresh_status(payable)` — yeniden hesapla + kaydet
- `create_payable(...)` — yarat + audit + eşik flag'leri
- `update_payable(...)` — güncelle + flag yenile + audit
- `archive_payable(...)` / `restore_payable(...)` — soft-delete + audit
- `attach_document(payable, document, role)` — PayableDocument link (idempotent)
- `add_partial_payment(...)` — kısmi/tam ödeme yarat (eşik kontrolleri)
- `mark_paid(...)` — kalan miktarı tek tx ile ödeme
- `approve_payment_transaction(tx, user)` — yüksek tutar onay (yetki kontrol)
- `reject_payment_transaction(tx, user, reason)` — yüksek tutar red

`apps/finance/permissions.py`:
- `can_write(user)` — super_admin/yonetici/muhasebe_muduru/muhasebeci
- `can_approve(user)` — super_admin/yonetici/muhasebe_muduru

---

## 7. TUTAR EŞİĞİ DAVRANIŞI

| Tutar | Dekont | Çift Onay | Davranış |
|---|---|---|---|
| < 5.000 TL | İsteğe bağlı | Hayır | `mark_paid` doğrudan APPROVED → `PayableStatus.PAID` |
| 5.000 - 49.999 TL | **Zorunlu** | Hayır | Dekont yoksa `PaymentRuleError`; varsa APPROVED → PAID |
| ≥ 50.000 TL | Zorunlu | **EVET** | Tx → `PENDING_APPROVAL`; Payable → `WAITING_APPROVAL`; **amount_paid değişmez**; onay sonrası APPROVED → PAID |

**Onay yetkisi:** super_admin / yonetici / muhasebe_muduru.
**Yetkisiz onay denemesi:** `PaymentRuleError`.

**Kısmi ödeme:** amount_paid < amount → `PARTIAL_PAID`. Toplam = amount → `PAID`.
**Aşan tutar:** PaymentRuleError ("Toplam ödeme fatura tutarını aşamaz").

---

## 8. STATUS HESAPLAMA (calculate_payable_status)

| Koşul | Status |
|---|---|
| amount_paid >= amount && amount > 0 | PAID |
| 0 < amount_paid < amount | PARTIAL_PAID |
| due_date < today | OVERDUE |
| due_date içinde 7 gün | APPROACHING |
| Diğer | PENDING |

**Manuel state'ler korunur (override edilmez):** CANCELLED, ARCHIVED, DRAFT, WAITING_APPROVAL, NEEDS_REVIEW.

---

## 9. AUDIT ENTEGRASYONU

| Aksiyon | AuditLog action | model_name |
|---|---|---|
| Payable yaratma | CREATE | payableitem |
| Payable güncelleme | UPDATE | payableitem |
| Payable archive | ARCHIVE | payableitem |
| Payable restore | RESTORE | payableitem |
| Belge bağlama | UPDATE | payableitem |
| Ödeme işaretleme (küçük) | UPDATE | payableitem |
| Ödeme işaretleme (yüksek tutar — pending) | UPDATE | payableitem (needs_approval=True metadata) |
| Yüksek tutar ödeme onayı | UPDATE | payableitem (approved_by metadata) |
| Yüksek tutar ödeme reddi | UPDATE | payableitem (reason metadata) |

Audit log Frame 18'deki gibi sistemde tüm aktör/zaman/IP/eski-yeni-değer JSON'ı tutuyor.

---

## 10. DASHBOARD ENTEGRASYONU

`apps.dashboard.views.DashboardHomeView` finance verisini gerçek zamanlı çekiyor:

| KPI | Kaynak |
|---|---|
| Bugün Ödenecek (₺ + sayı) | `PayableItem(due_date=today, status NOT IN [PAID/CANCELLED/ARCHIVED])` |
| Geciken (₺ + sayı) | `PayableItem(due_date < today, status NOT IN [...])` |
| Görev Tamamlanma % | `Task` (task=DONE / total) |
| Eksik Dekont | `PayableItem(requires_receipt=True, no RECEIPT document)` |
| Yaklaşan Ödemeler (T-7) | dashboard'da yeni "Yaklaşan Ödemeler" widget'ı (yeni eklenen blok) |
| Son AuditLog | tüm modüller |

**Test:** `DashboardFinanceIntegrationTest.test_dashboard_kpi_reflects_finance` — 1 bugün + 1 geciken kayıt → dashboard'da TR formatlı tutar görünür.

---

## 11. TASK ENTEGRASYONU

`PayableDetailView` bağlı görevleri Generic FK pattern ile çekiyor:
```python
Task.objects.filter(
    related_app="finance",
    related_model="payableitem",
    related_object_id=str(payable.pk),
    is_active=True,
)
```

**Faz 4 sınırı:** Detay ekranında **görüntüleme** seviyesinde.
**Faz 10:** Otomatik üretim (T-7 görev şablonu) ve "Görev Oluştur" CTA.

---

## 12. TEST SONUÇLARI

```
$ python manage.py test tests
.................................................................
----------------------------------------------------------------------
Ran 65 tests in 40.5s
OK
```

| Dosya | Test Sayısı | Sonuç |
|---|---|---|
| `tests/test_smoke.py` (Faz 2) | 22 | ✅ |
| `tests/test_documents.py` (Faz 3) | 6 | ✅ |
| `tests/test_imports.py` (Faz 3) | 13 | ✅ |
| `tests/test_finance.py` (Faz 4) | **24** | ✅ |
| **Toplam** | **65** | **✅ 65/65 PASS** |

### Faz 4 yeni test başlıkları (24)

- `ThresholdHelpersTest`: requires_receipt + requires_double_approval (2)
- `PayableCRUDTest`: create + audit, 5K receipt flag, 50K double approval flag, update, archive/restore (5)
- `PaymentRulesTest`: küçük tutar, dekont eksikse blok, dekont varsa OK, kısmi → PAID, aşan tutar blok, 50K WAITING_APPROVAL, approve, reject, yetkisiz approve blok (9)
- `DocumentAttachTest`: dedup + has_receipt property (2)
- `ViewPermissionTest`: anon redirect, viewer 403, muhasebeci create OK (3)
- `DashboardFinanceIntegrationTest`: KPI gerçek finance verisinden (1)
- `ImportCommitStillNoOpTest`: **Faz 4'te de import commit PayableItem yaratmıyor** (1)
- `DesignContractFinanceTest`: dark mode yok, IBM Plex var, Inter/JetBrains yok (1)

---

## 13. ACCEPTANCE CRITERIA (17/17 PASS)

| # | Kriter | Sonuç |
|---|---|---|
| 1 | manage.py check PASS | ✅ |
| 2 | migrations apply | ✅ (finance 0001_initial) |
| 3 | testler PASS | ✅ 65/65 |
| 4 | finance app kuruldu | ✅ |
| 5 | manuel PayableItem CRUD çalışıyor | ✅ (test_create_payable + update + archive/restore) |
| 6 | belge/dekont yükleme Document ile çalışıyor | ✅ (sha256 dedup + PayableDocument link) |
| 7 | ödeme işaretleme çalışıyor | ✅ |
| 8 | kısmi ödeme çalışıyor | ✅ |
| 9 | 5.000 TL dekont kuralı çalışıyor | ✅ (test_mark_paid_large_amount_blocks_without_receipt) |
| 10 | 50.000 TL çift onay davranışı çalışıyor | ✅ (test_high_amount_payment_waiting_approval + approve/reject) |
| 11 | AuditLog yazılıyor | ✅ |
| 12 | Dashboard finance verisi gösteriyor | ✅ (test_dashboard_kpi_reflects_finance) |
| 13 | Import commit hâlâ domain kayıt yaratmıyor | ✅ (test_commit_does_not_create_payable) |
| 14 | Dark mode yok | ✅ |
| 15 | IBM Plex Sans/Plex Mono korunuyor | ✅ |
| 16 | Inter/JetBrains yok | ✅ |
| 17 | Diğer projeler / commit/push/deploy | ✅ |

---

## 14. SINIRLAR (Faz 4 sözleşmesi)

| Yasak | Durum |
|---|---|
| Eski Excel/RAR/PDF otomatik domain commit | ❌ — Import commit hâlâ NO-OP |
| Telegram gerçek gönderim | ❌ |
| Otomatik görev üretimi (T-N cron) | ❌ — Faz 10 |
| Object-level permission | ❌ — Faz 5+ |
| Çoklu para birimi | ❌ — TRY only |
| Production deploy | ❌ |
| Commit/push/deploy | ❌ |
| Kaynak Excel/RAR/PDF değişikliği | ❌ |

---

## 15. AÇIK KALANLAR (Faz 5+)

| Madde | Faz |
|---|---|
| Abonelik & Taahhüt modülü | Faz 5 |
| SiteX + Emlak Vergisi + Teminat + Resmi Ödemeler modülleri | Faz 6-9 |
| Otomatik görev üretimi cron (SiteX ayın 17, T-3, T-7, T-15) | Faz 10 |
| Bildirim 4 aşamalı kapı (gerçek Telegram) | Faz 12 |
| Import commit dispatch (modül-spesifik committer) | Faz 4.1 / Faz 5+ |
| Mapping editor UI | Faz 4.1 |
| `SystemSetting` modeli (tutar eşiği DB tarafına) | Faz 5 |
| Çift onay UI'ı (Frame 07'deki "Onay Bekliyor" + 2. kademe yönetici onayı) | Faz 5 |
| Raporlama / Excel export | Faz 13 |
| Object-level permission (`django-guardian`) | Faz 6+ |

---

## 16. FAZ 5'E GEÇİŞ ÖNERİSİ

✅ Tüm kabul kriterleri PASS.
✅ Manual fatura/ödeme akışı + 5K/50K eşik kuralları + AuditLog + dashboard KPI çalışıyor.
✅ Import temeli korundu (commit no-op test'i geçti).

**Faz 5 — Abonelik & Taahhüt** başlatılabilir. İlk adımlar:
1. `apps.subscriptions` (Subscription, SubscriptionCommitment, SubscriptionPeriodCharge).
2. Abonelik master CRUD + taahhüt bitiş takvimi.
3. PayableItem ile bağlantı (subscription_reference + Subscription FK).
4. Otomatik talimat banka takibi.
5. Kayıtlı mapping profile (`sirket_abonelikleri_v1`, `ev_abonelikleri_kisi_sheet_v1`).

---

## 17. ROLLBACK NOTU

```bash
python manage.py migrate finance zero
rm -rf apps/finance templates/finance tests/test_finance.py
# settings/base.py: "apps.finance" ve PAYMENT_*_THRESHOLD constant'lar
# config/urls.py: finance include
# templates/includes/sidebar.html: 🧾 Fatura & Ödeme linki
# apps/dashboard/views.py: PayableItem/refresh_status referansları
# templates/dashboard/home.html: "Yaklaşan Ödemeler" bloğu
```

---

**SON.** Faz 4 manual MVP tamam, Faz 5 Abonelik & Taahhüt için hazır.
