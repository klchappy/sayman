# FAZ 5 — ABONELİK + DÜZENLİ ÖDEME + RESMİ ÖDEME MANUAL MVP RAPORU
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 5 — Manual-first abonelik / kira-SMMM / BAĞKUR-SSK-İTO-BES
**Tarih:** 2026-05-06
**Durum:** TAMAMLANDI · 94/94 test PASS · Faz 6 için hazır

---

## 1. OLUŞTURULAN APP'LER (3 yeni)

| App | Sorumluluk |
|---|---|
| `apps.subscriptions` | Abonelik master + Taahhüt + dönemsel ücret + PayableItem bağlantısı |
| `apps.regular_payments` | Kira/SMMM/İş Güvenliği/Domain/Hosting/Noter/K2/Hizmet düzenli ödemeler + toplu dönem üretim + PayableItem |
| `apps.official_payments` | BAĞKUR/SSK/BES/İTO/Vergi resmi ödemeler + yıllık dönem üretim (İTO 2 taksit / aylık 12 dönem) + PayableItem |

Ek: `apps.core` içine **SystemSetting** modeli (DB-backed eşik ayarları).

---

## 2. MODEL LİSTESİ (8 yeni model)

### apps.core
- `SystemSetting` (key, value, value_type[STRING/INTEGER/DECIMAL/BOOLEAN/JSON], description, is_active)

### apps.subscriptions
- `Subscription` (owner_type, company/person, title, service_type, account_no, package_name, expected_monthly_amount, default_payment_method, status, ...)
- `SubscriptionCommitment` (subscription, start/end_date, campaign_name, committed_amount, normal_amount, cancellation_fee, auto_renew, status, reminder_days)
- `SubscriptionPeriodCharge` (subscription, period_label, due_date, amount, payable FK Finance, status, source) — `unique_together(subscription, period_label, due_date)`

### apps.regular_payments
- `RegularPaymentProfile` (owner_type, company/person, title, category[RENT/SMMM/...], supplier_name, period_type[MONTHLY/QUARTERLY/...], default_due_day, default_amount, status, ...)
- `RegularPaymentPeriod` (profile, period_label, due_date, amount, payable FK, status, source) — `unique_together(profile, period_label, due_date)`

### apps.official_payments
- `OfficialPaymentProfile` (owner_type, payment_type[BAGKUR/SSK/BES/ITO/TAX/MUNICIPAL/OTHER], institution, reference_no, period_type[INSTALLMENT/...], default_amount, status)
- `OfficialPaymentPeriod` (profile, period_label, **installment_no**, due_date, amount, payable FK, status, source) — `unique_together(profile, period_label, installment_no, due_date)`

---

## 3. MIGRATION

```
core              [X] 0001_initial    (SystemSetting)
subscriptions     [X] 0001_initial    (3 model + 1 index + 1 unique)
regular_payments  [X] 0001_initial    (2 model + 1 unique)
official_payments [X] 0001_initial    (2 model + 1 unique)
```

---

## 4. URL LİSTESİ (24 yeni endpoint)

```
/subscriptions/                                    → liste + yaklaşan taahhütler
/subscriptions/new/                                → oluştur
/subscriptions/<pk>/                               → detay (taahhütler + dönemler)
/subscriptions/<pk>/edit/                          → düzenle
/subscriptions/<pk>/archive/                       → POST archive/restore
/subscriptions/<pk>/commitments/new/               → taahhüt ekle
/subscriptions/<pk>/charges/new/                   → dönem ücret ekle
/subscriptions/charges/<pk>/create-payable/        → POST → PayableItem

/regular-payments/                                 → liste
/regular-payments/new/                             → oluştur
/regular-payments/<pk>/                            → detay
/regular-payments/<pk>/edit/                       → düzenle
/regular-payments/<pk>/archive/                    → POST
/regular-payments/<pk>/periods/new/                → manuel dönem
/regular-payments/<pk>/generate-periods/           → POST 12 ay üret
/regular-payments/periods/<pk>/create-payable/     → POST → PayableItem

/official-payments/                                → liste
/official-payments/new/                            → oluştur
/official-payments/<pk>/                           → detay
/official-payments/<pk>/edit/                      → düzenle
/official-payments/<pk>/archive/                   → POST
/official-payments/<pk>/periods/new/               → manuel dönem
/official-payments/<pk>/generate-periods/          → POST yıllık üret
/official-payments/periods/<pk>/create-payable/    → POST → PayableItem
```

---

## 5. TEMPLATE LİSTESİ (12 yeni)

```
templates/subscriptions/    → subscription_list, subscription_form, subscription_detail, commitment_form, charge_form
templates/regular_payments/ → profile_list, profile_form, profile_detail (toplu üret form embedded), period_form
templates/official_payments/→ profile_list, profile_form, profile_detail, period_form
```

---

## 6. SERVİS LİSTESİ

`apps/core/models.py` → `get_setting(key, default, value_type)` helper.

`apps/finance/services/period_link.py` → **`create_payable_from_period`** ortak helper (3 app paylaşıyor).

`apps/subscriptions/services/subscriptions.py` →
- create/update/archive/restore_subscription
- add_commitment + calculate_commitment_status + refresh_commitment_statuses
- create_period_charge / link_period_charge_to_payable
- create_payable_from_subscription_charge

`apps/regular_payments/services/regular_payments.py` →
- create/update/archive/restore_profile
- create_period
- generate_next_periods (1/3/6/12 ay step + idempotent)
- calculate_period_status
- create_payable_from_regular_period

`apps/official_payments/services/official_payments.py` →
- create/update/archive/restore_profile
- create_period
- generate_periods (BAGKUR/SSK/BES → aylık 12 / İTO → 30.06 + 31.10 / YEARLY → 1 / INSTALLMENT → N taksit)
- calculate_period_status
- create_payable_from_official_period

---

## 7. PAYABLEITEM ENTEGRASYONU

**Idempotent** `create_payable_from_period(period, user, ...)`:
- `period.payable` doluysa: yeni yaratmaz, mevcut payable döner.
- Yeni yaratırken: PayableItem `requires_receipt` ve `requires_double_approval` flag'leri **5K/50K eşiklerinden** (SystemSetting → fallback Django settings) hesaplanır.
- `period.payable` doldurulur; `period.status = "LINKED"` set edilir.
- AuditLog yazılır (kaynak: source_app + source_model + source_id metadata).

---

## 8. SYSTEMSETTING EŞİK SİSTEMİ

| Anahtar | Default (settings) | Override |
|---|---|---|
| `PAYMENT_DEKONT_REQUIRED_THRESHOLD` | 5.000 TL | `SystemSetting(value_type=DECIMAL)` ile DB'den |
| `PAYMENT_DOUBLE_APPROVAL_THRESHOLD` | 50.000 TL | aynı şekilde |
| `DEFAULT_CURRENCY` | TRY | (henüz kullanılmıyor; ileri faz için hazır) |

`is_active=False` olan SystemSetting'ler fallback'a düşer (test'le doğrulandı).

`requires_receipt()` / `requires_double_approval()` finance servisleri artık `get_setting()` üzerinden okuyor.

---

## 9. DASHBOARD ENTEGRASYONU

Yeni 3-kolon Faz 5 widget grid'i:

| Widget | İçerik |
|---|---|
| 📡 **Abonelikler** | Aktif abonelik sayısı + 5 yaklaşan taahhüt mini liste |
| 💼 **Düzenli Ödeme** | Bu ay dönem sayısı + toplam tutar + bağlantısız uyarı |
| 🏦 **Resmi Ödemeler** | 30 gün içinde 5 yaklaşan official period |

Risk kartları güncellendi: "Yaklaşan Taahhüt" gerçek veriden besleniyor; "Bağlantısız Dönem" 30 gün içinde PayableItem'a bağlanmamış period sayısını gösteriyor.

---

## 10. PERMISSION MATRİSİ

(Faz 4 ile paralel — `apps.finance.permissions` paylaşımlı)

| Aksiyon | Roller |
|---|---|
| Liste / detay | tüm authenticated |
| Create / update / archive / generate / period | super_admin · yonetici · muhasebe_muduru · muhasebeci |
| Görüntüleyici / Personel | sadece read |
| PayableItem onayı (50K+) | super_admin · yonetici · muhasebe_muduru |

---

## 11. AUDIT ENTEGRASYONU

| Aksiyon | Audit |
|---|---|
| Subscription create/update/archive/restore | ✓ |
| Commitment add | ✓ |
| Period charge create | ✓ |
| RegularProfile create/update/archive/restore | ✓ |
| RegularPeriod create | ✓ |
| generate_next_periods | ✓ (created count metadata) |
| OfficialProfile create/update/archive/restore | ✓ |
| OfficialPeriod create | ✓ |
| generate_periods (yıllık) | ✓ |
| Period → PayableItem | ✓ (source_app/model/id metadata) |

---

## 12. TEST SONUÇLARI

```
$ python manage.py test tests
Ran 94 tests in 54.5s
OK
```

| Dosya | Test | Sonuç |
|---|---|---|
| test_smoke.py | 22 | ✅ |
| test_documents.py | 6 | ✅ |
| test_imports.py | 13 | ✅ |
| test_finance.py | 24 | ✅ |
| **test_phase5.py** | **29** | ✅ |
| **Toplam** | **94** | **✅ 94/94 PASS** |

### Faz 5 yeni test başlıkları (29)
- `SystemSettingTest` (4): fallback, override, double approval override, inactive falls back
- `SubscriptionsTest` (5): create+audit, update/archive/restore, commitment APPROACHING, payable from charge, duplicate blocked
- `RegularPaymentsTest` (6): create profile, create period, **12 period generate + idempotent**, payable from period, duplicate blocked, archive/restore
- `OfficialPaymentsTest` (5): BAGKUR profile, **İTO 2 taksit**, **BAGKUR 12 ay**, payable from period, duplicate blocked
- `FinanceIntegrationTest` (1): generated PayableItem 75K → requires_receipt + requires_double_approval **TRUE**
- `DashboardPhase5Test` (1): Faz 5 widget'ları render
- `PermissionPhase5Test` (4): viewer 403'ü 3 app'te + anon redirect 3 list URL
- `ImportCommitStillNoOpTest` (1): import commit hâlâ NO-OP — Subscription/Regular/Official kaydı yaratmaz
- `DesignContractPhase5Test` (2): dark mode + Inter/JetBrains taraması 3 template klasöründe + sidebar 3 link

---

## 13. ACCEPTANCE CRITERIA (20/20 PASS)

| # | Kriter | Sonuç |
|---|---|---|
| 1 | manage.py check PASS | ✅ |
| 2 | migrations apply | ✅ |
| 3 | tüm testler PASS | ✅ 94/94 |
| 4 | apps.subscriptions çalışıyor | ✅ |
| 5 | apps.regular_payments çalışıyor | ✅ |
| 6 | apps.official_payments çalışıyor | ✅ |
| 7 | manuel CRUD | ✅ |
| 8 | archive/restore | ✅ |
| 9 | period create/generate | ✅ (12 ay regular + 2 taksit İTO + 12 ay BAGKUR) |
| 10 | period → PayableItem | ✅ |
| 11 | duplicate PayableItem blocked | ✅ (3 app'te ayrı ayrı test) |
| 12 | AuditLog yazılıyor | ✅ |
| 13 | dashboard yeni özetler | ✅ |
| 14 | permission basic testler | ✅ |
| 15 | SystemSetting fallback/override | ✅ (4 test) |
| 16 | Import commit NO-OP | ✅ |
| 17 | Dark mode yok | ✅ |
| 18 | IBM Plex korunuyor | ✅ |
| 19 | Inter/JetBrains yok | ✅ |
| 20 | Sınırlar (proj/kaynak/deploy) | ✅ |

---

## 14. SINIRLAR (Faz 5 sözleşmesi)

| Yasak | Durum |
|---|---|
| SiteX daire/aidat modülü | ❌ — Faz 6 |
| Emlak vergisi/mülk modülü | ❌ — Faz 7 |
| Teminat mektupları | ❌ — Faz 8 |
| ETA/Papinet/Entegratör | ❌ — Faz 9 |
| Telegram gerçek gönderim | ❌ — Faz 12 |
| Otomatik cron (T-N reminder) | ❌ — Faz 10 |
| Import → Subscription/Regular/Official commit | ❌ (test ile doğrulandı) |
| Excel/RAR/PDF kaynak değiştirme | ❌ |
| Design canvas değiştirme | ❌ |
| Commit/push/deploy | ❌ |

---

## 15. AÇIK KALANLAR (Faz 6+)

| Madde | Faz |
|---|---|
| SiteX daire master + aidat farkı + aylık ekstre import | Faz 6 |
| Emlak vergisi mülk × yıl/dönem grid | Faz 7 |
| Teminat mektupları + komisyon takvimi | Faz 8 |
| ETA/Papinet/Kontör + sözleşme bitiş takip | Faz 9 |
| Otomatik görev üretimi (T-3/T-7/T-15) | Faz 10 |
| Bildirim 4 aşamalı kapı + gerçek Telegram | Faz 12 |
| `SystemSetting` admin UI (key seçici + tip-based widget) | LATER |
| Bildirim widget'ı (taahhüt yaklaşıyor → user notification) | Faz 12 |
| Import committer dispatch (modül-spesifik) | LATER (manual-first stratejide isteğe bağlı) |
| `requires_receipt` ödeme aşamasında değil **kayıt aşamasında** doğrulama | (Faz 4'te zaten var; PayableItem flag'leri Faz 5'te de doğru set ediliyor) |
| Mobile responsive iyileştirme (Faz 5 templates) | Faz 13+ |

---

## 16. FAZ 6'YA GEÇİŞ ÖNERİSİ

**SiteX — özel modül.** İlk adımlar:
1. `apps.pruva` (SiteXDaire 5 sabit daire master + SiteXEkstre [yyyymm × daire] + SiteXAidatFarki + SiteXYillikBelge).
2. SiteX ödeme günü kuralı: ayın 20'si default.
3. Manuel daire CRUD → ekstre upload → dönemsel aidat kaydı (PayableItem üretimi yine ortak helper'dan).
4. Aidat farkı mutabakat ekranı (Frame 09 ilham).
5. Daire bazlı yıllık belge arşivi (denetim raporu/bütçe vb.).

Faz 5'in `period → PayableItem` pattern'i Faz 6'da SiteX için aynen kullanılabilir.

---

## 17. ROLLBACK NOTU

```bash
python manage.py migrate subscriptions zero
python manage.py migrate regular_payments zero
python manage.py migrate official_payments zero
python manage.py migrate core zero  # SystemSetting

rm -rf apps/subscriptions apps/regular_payments apps/official_payments
rm -rf templates/subscriptions templates/regular_payments templates/official_payments
rm -rf apps/finance/services/period_link.py
rm tests/test_phase5.py

# settings/base.py: 3 app'i çıkar
# config/urls.py: 3 include'u çıkar
# templates/includes/sidebar.html: 3 link → eski placeholder
# apps/dashboard/views.py: phase5_summary bloğunu çıkar
# apps/finance/services/payments.py: get_setting kullanımını eski settings.PAYMENT_* sabitine çevir
# apps/core/models.py: SystemSetting + get_setting çıkar
# apps/core/admin.py: SystemSetting admin çıkar
```

---

**SON.** Faz 5 manual MVP tamam. Faz 6 (SiteX) için hazır.
