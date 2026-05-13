# GELECEK GENİŞLEME KURALLARI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Sürüm:** 1.0
**Tarih:** 2026-05-06
**Durum:** BAĞLAYICI

> Bu doküman: yeni kayıt eklemenin / mevcut kayıtları kapatmanın / yenilemenin sistem genelinde nasıl yapılacağını tanımlar. **Hiçbir modül mevcut Excel kayıtlarıyla sınırlı kalmayacak.**

---

## 0. EVRENSEL KURAL

> Sistemde **kod değiştirmeden** veya **migration gerektirmeden** kullanıcı arayüzünden:
> 1. Yeni master kayıt eklenebilir (Şirket / Şahıs / Mülk / Banka / Kurum).
> 2. Yeni operasyon kaydı eklenebilir (Fatura / Ödeme / Abonelik / vs.).
> 3. Mevcut kayıt güncellenebilir.
> 4. Mevcut kayıt pasifleştirilebilir / arşivlenebilir.
> 5. Mevcut kayıt iptal / iade / yenilendi durumuna alınabilir (durum bazlı).
> 6. Tüm aksiyonlar AuditLog'a yazılır.

---

## 1. YENİ FATURA EKLENEBİLİRLİK

### Yol
- **UI:** `/finance/payables/new/` formu.
- **Servis:** `apps.finance.services.payments.create_payable(user=..., **fields)`
- **Yetki:** super_admin / yonetici / muhasebe_muduru / muhasebeci.

### Genişletilebilirlik
| Alan | Değişebilir mi? |
|---|---|
| `owner_type` (COMPANY/PERSON/FAMILY/OTHER) | ✅ |
| `company` / `person` | ✅ master'dan seçilir |
| `category` (free text) | ✅ herhangi bir kategori |
| `institution` | ✅ master'dan |
| `payment_method` enum | (yeni method eklemek için migration; OTHER mevcut) |
| `currency` | ✅ TRY default; MVP-2'de USD/EUR |

### Mevcut faturayı kapatma
- `PayableItem.status = "CANCELLED"` veya `archive_payable()` (`is_active=False`).
- Sebep zorunlu (`notes` / `archive_reason`).

---

## 2. YENİ ABONELİK EKLENEBİLİRLİK

### Yol
- **UI:** `/subscriptions/new/`.
- **Servis:** `create_subscription(user=..., **fields)`.
- **Servis tipleri:** INTERNET / PHONE / GSM / ELECTRICITY / NATURAL_GAS / WATER / SOFTWARE / AIDAT / **OTHER**.
- **Otomatik ödeme banka seçimi:** master'dan.

### İptal / Pasif süreç
1. `Subscription.status = "CANCELLED"` (manuel kullanıcı tercihi).
2. veya `archive_subscription()` (`is_active=False`).
3. Bağlı `SubscriptionCommitment.status = "CANCELLED"` (zincirleme manuel veya servis).
4. Geçmiş `SubscriptionPeriodCharge` kayıtları **silinmez**, audit + tarihçe için saklanır.
5. Yeni abonelik aynı kullanıcı için açılabilir (yeni `Subscription` kaydı).

---

## 3. YENİ SITEX DAİRE EKLEME (Faz 6+)

### Yol (Faz 6'da aktif olacak)
- **UI:** `/pruva/new/` veya `/pruva/dairler/new/` formu.
- **Servis (Faz 6):** `create_pruva_daire(user=..., daire_kodu="C5.18", sahip=..., mulk=...)`.
- **Hardcoded değil:** `SiteXDaire` modelinde `daire_kodu CharField unique` — kod yenilenmesi gerekirse migration yok, sadece yeni satır.

### SiteX daire satıldı / pasif süreç
1. `Mulk.status = "SOLD"` (Faz 7'de Mulk modeli zenginleşecek; Faz 6'da `is_active=False` yeterli).
2. `SiteXDaire.is_active = False`.
3. Bağlı ekstreler ve aidat farkları **silinmez**, tarihçe korunur.
4. Yeni daire alındığında: yeni `Mulk` + yeni `SiteXDaire`.

> **Önemli:** Mevcut Excel'de 5 daire (A4.17 / A4.22 / A4.25 / B2.28 / B3.31) olması, sistemin 5 daire ile sınırlı olduğu anlamına gelmez. **6. veya 7. daire eklenebilir.**

---

## 4. YENİ EMLAK / MÜLK EKLEME (Faz 7+)

### Yol
- **UI:** `/master/properties/new/` (Faz 2'de zaten var) veya Faz 7'de zenginleşmiş `/properties/new/`.
- **Servis (Faz 7):** `create_property(user=..., name, mulk_tipi, sahibi, belediye, ...)`.

### Mülk satıldı / pasif süreç
- `PropertyAsset.status = "SOLD"` (Faz 7'de yeni alan).
- `is_active=False` opsiyonel.
- Bağlı `EmlakVergisi` tarihçesi korunur.
- Yeni mülk alındığında: yeni `PropertyAsset` kaydı (sınırsız).

### Mevcut alanlar
- `name`, `mulk_tipi` (DAIRE/OFIS/FABRIKA/OTEL/ARSA/EV — migration ile genişletilebilir + OTHER ileride eklenebilir), `sahibi_sahis`/`sahibi_sirket`, `address`.

---

## 5. YENİ TEMİNAT MEKTUBU EKLEME (Faz 8+)

### Yol
- **UI:** `/guarantees/new/`.
- **Servis (Faz 8):** `create_guarantee_letter(user=..., banka, mektup_no, tutar, komisyon_orani, periyot, ...)`.

### Lifecycle (Faz 8 PHASE1_DATA_MODEL_PLAN F.1'de tanımlı)
- `durum`: AKTIF / IADE_EDILDI / SURESI_DOLDU / YENILENDI

### İade süreç
- `TeminatMektubu.durum = "IADE_EDILDI"`.
- `TeminatIade(mektup, iade_tarihi, sebep, belge)` kaydı yaratılır.
- AuditLog: action=UPDATE, summary="İade".

### Yenileme süreç
- Yeni `TeminatMektubu` kaydı yaratılır.
- Eski mektup `durum = "YENILENDI"`.
- (Opsiyonel) `previous_letter` FK ile bağ kurulur (Faz 8'de eklenecek alan).

---

## 6. YENİ ENTEGRATÖR / KONTÖR HİZMETİ EKLEME (Faz 9+)

### Yol
- **UI:** `/integrators/new/` (Faz 9 — MVP-2).
- **Servis:** `create_integrator_service(user=..., entegrator, sirket, sozlesme_no, ...)`.

### Mevcut entegratörler sınırı
- `Entegrator.ad` master tablo — yeni entegratör (örn. ZIRAATSOFT, FORIBA) eklemek için migration **gerekmez**, yeni `Entegrator` master kaydı yeterli.

### Sözleşme yenileme
- `EntegratorSozlesme.durum = "YENILENDI"`.
- Yeni sözleşme kaydı (`baslangic_tarihi`, `bitis_tarihi`, `belge` ile).

### Kontör paketi alma
- Yeni `KontorHareket(hareket_tipi=YUKLEME, miktar, fatura)` kaydı.
- `KontorBakiye.bakiye` artırılır (servis hesaplar).

---

## 7. YENİ BANKA / KURUM / KATEGORİ / ŞİRKET / ŞAHIS EKLEME

| Master | UI yolu | Sınır |
|---|---|---|
| **Banka** | `/master/banks/new/` | Sadece `name` unique; sınırsız ekleme |
| **Kurum** (Institution) | `/master/institutions/new/` | `institution_type` enum + OTHER; sınırsız ekleme |
| **Şirket** (Company) | `/master/companies/new/` | `short_name` unique; sınırsız ekleme |
| **Şahıs** (Person) | `/master/persons/new/` | `full_name`; sınırsız ekleme |
| **Mülk** (PropertyAsset) | `/master/properties/new/` | `name` (unique değil); sınırsız ekleme |

### Yeni `institution_type` ekleme
- `OTHER` tipi mevcut.
- Yeni resmi tip (örn. `EFTERSAĞ`) için: kod değişikliği + migration.
- **Pratikte:** tür sayısı 9 (TELEKOM/ELEKTRIK/DOGALGAZ/SU/BELEDIYE/ENTEGRATOR/SGK/ITO/DIGER) — yıllarca yeterli.

### Yeni `category` ekleme (RegularPaymentProfile)
- Mevcut: 8 kategori + OTHER.
- Yeni kategori (örn. `KARGOMAT_HIZMETI`) için kod + migration.
- Geçici çözüm: kategori = OTHER + `notes` veya `supplier_name` ile ayırt etme.

---

## 8. YENİ ÖDEME YÖNTEMİ EKLENEBİLİRLİK

### Mevcut yöntemler
AUTO / EFT / HAVALE / CREDIT_CARD / CASH / ELDEN / OTHER

### Yeni yöntem ekleme (örn. SWIFT, KRIPTO)
- `OTHER` mevcut → kod değişikliği gereksiz.
- Resmi enum'a eklemek için: kod + migration (LATER).

---

## 9. YENİ DÖNEM / TAKSİT / KOMİSYON / EKSTRE EKLENEBİLİRLİK

| Modül | Manuel ekleme | Toplu üretim |
|---|---|---|
| `SubscriptionPeriodCharge` | ✅ `/subscriptions/<pk>/charges/new/` | (cron Faz 10) |
| `RegularPaymentPeriod` | ✅ `/regular-payments/<pk>/periods/new/` | ✅ `/regular-payments/<pk>/generate-periods/` (12 ay) |
| `OfficialPaymentPeriod` | ✅ `/official-payments/<pk>/periods/new/` | ✅ `/official-payments/<pk>/generate-periods/` (yıllık) |
| `SiteXEkstre` (Faz 6) | ✅ planlı | (manuel veya RAR import sonrası onay) |
| `EmlakVergisi` (Faz 7) | ✅ planlı | yıl + dönem matrisi |
| `TeminatKomisyonOdemesi` (Faz 8) | ✅ planlı | komisyon takvimi cron |
| `KontorHareket` (Faz 9) | ✅ planlı | API entegrasyonu LATER |

**Tüm `unique_together` constraint'leri idempotency içindir** — aynı dönem tekrar üretilmeye çalışılırsa yeni kayıt yaratılmaz, mevcut korunur.

---

## 10. EVRENSEL: HİÇBİR MODÜL EXCEL KAYITLARIYLA SINIRLI DEĞİL

### Garantiler
1. **Kod taraması** (`grep "SiteX|Test|A4.17|Albaraka" --include="*.py" -v test|migration`) → 0 production kod hardcoded gerçek kayıt.
2. **Master tablolar DB-driven** — yeni satır eklemek migration gerektirmez.
3. **Enum'lar** çoğu `OTHER` opsiyonu içerir.
4. **PayableItem source enum**: MANUAL / IMPORT_DRAFT / PDF / EXCEL / OTHER — kullanıcı her zaman MANUAL ile başlayabilir.
5. **Period idempotency** doğal anahtarlar üzerinden — duplicate yaratılamaz, ama farklı period_label / due_date ile sınırsız yeni dönem.
6. **archive/restore** her yerde — yanlış kaydı pasifleştir, yenisini ekle.

### Yasak (kod review check-list)
- ❌ `if daire_kodu == "A4.17": ...` gibi sabit if/else
- ❌ `BANKS = ["Albaraka", "Garanti", "Yapı Kredi"]` gibi sabit liste
- ❌ `DAIRES = ["A4.17", "A4.22", "A4.25", "B2.28", "B3.31"]` gibi sabit daire listesi
- ❌ Test fixture dışı seed dosyalarında gerçek tutar / tarih / kişi adı

### İzinli (kod review check-list)
- ✅ Enum'lar (TextChoices) — tipli sınıflandırma için
- ✅ `OTHER` veya `DIGER` opsiyonu eklemek
- ✅ Master tablo seed'i (kullanıcı onayı + idempotent + audit)
- ✅ SystemSetting fallback'lı sabit (kod default + DB override)

---

## 11. KOD REVIEW CHECKLIST (yeni faz başlangıcında)

Her yeni faz / PR'da:

- [ ] Yeni model `BaseModel` miras alıyor mu? (TimeStamped + SoftDelete)
- [ ] Yeni servis fonksiyonu `user` parametresi alıyor + audit_log yazıyor mu?
- [ ] Yeni view `LoginRequiredMixin` + permission test ediliyor mu?
- [ ] Yeni URL'de `archive` (POST) action var mı? `delete` action **yok** mu?
- [ ] Yeni enum'da `OTHER` veya equivalent var mı?
- [ ] Yeni status enum **CANCELLED + ARCHIVED** kapsıyor mu?
- [ ] Migration check (`makemigrations --check`) PR'da geçiyor mu?
- [ ] Test: create / update / archive / restore / duplicate-blocked / viewer-403
- [ ] Seed komutu eklendiyse: idempotent + audit (action=SEED) + dökümantasyon
- [ ] Hardcoded gerçek kayıt yok mu? (`grep` taraması)

---

## 12. YENİ FAZ AÇILDIĞINDA YAPILMASI GEREKEN

1. `_docs/PHASE<N>_<MODULE>_REPORT.md` çıkarma sırasında bu dökümana referans ver.
2. LIFECYCLE_HARDCODE_AUDIT.md'yi yeniden çalıştır (her faz sonu).
3. Yeni modeli SEED_AND_LIFECYCLE_POLICY.md "Seed edilemez" tablosuna ekle.
4. Yeni modülün "Sahip satıldı/iptal/yenilendi" senaryosunu test et.
5. Cancel servisi (eğer status enum'da CANCELLED varsa) ekle veya planla.

---

**SON.** Bu kurallar tüm sonraki fazlar için bağlayıcıdır.
