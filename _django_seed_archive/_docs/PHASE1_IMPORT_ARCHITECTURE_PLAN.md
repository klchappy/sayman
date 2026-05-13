# FAZ 1 — IMPORT MİMARİSİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

> Anayasa Madde 7 + PHASE0A_DATA_SOURCE_INVENTORY.md + DESIGN Frame 03/04/24 birleşimi.

---

## 1. ANA İLKELER

| # | Kural |
|---|---|
| 1.1 | **Onaysız kesin kayıt yok.** Her import önce taslak/ön izleme/onay akışından geçer. |
| 1.2 | **Idempotency zorunlu** — aynı dosya/satır birden fazla kez yüklenirse: UPDATE veya SKIP. |
| 1.3 | **Atomic commit** — bir batch ya tamamen başarılı ya rollback. |
| 1.4 | **24 saat rollback penceresi** — commit sonrası geri alma. |
| 1.5 | **Tüm aksiyon AuditLog'a yazılır** (UPLOAD/PARSE/MAPPING/PREVIEW/APPROVE/REJECT/COMMIT/ROLLBACK). |
| 1.6 | **Kaynak dosya kalıcı saklanır** (`Belge.ozel_sinif=IMPORT_KAYNAK`, sha256 dedup). |
| 1.7 | **Hata düzeltmeden commit edilemez** — zorunlu validasyon. |
| 1.8 | **Manuel doğrulama (mor)** kayıtları kullanıcı onayına düşer. |

---

## 2. KAPSAM

| Tip | Pipeline | MVP |
|---|---|---|
| **Excel (.xlsx, .xlsm)** | openpyxl → sheet/satır parse → mapping → ImportDraftRecord | MVP-1 |
| **PDF (tek)** | pdfplumber metadata + filename parse → ImportDraftRecord | MVP-1 (metadata) / MVP-2 (OCR) |
| **RAR / ZIP** | rarfile / zipfile → extract → klasör/dosya adı parse → batch ImportDraftRecord | MVP-1 |
| **Klasör (drag-drop)** | Recursive scan → her dosya için ImportDraftRecord | MVP-2 |
| **Tek tek dosya yükleme** | Form upload → ImportSourceFile | MVP-1 |

---

## 3. PIPELINE ADIMLARI

```
[1] UPLOAD                 → ImportBatch oluştur, ImportSourceFile + Belge yarat (sha256)
[2] PARSE                  → Excel: sheet→ham satır JSON | PDF: filename+metadata | RAR: extract→dosya listesi
[3] MAPPING                → ImportMappingProfile seç (kayıtlı şablon) veya yeni mapping kur
[4] DRAFT GENERATION       → ImportDraftRecord (ham_veri_json + parse_edilmis_json + mapping_uyarisi)
[5] VALIDATION             → Her draft için: required, format, dedup, fuzzy match, "X" iptal kuralı
[6] PREVIEW                → Frame 04 kullanıcıya gösterilir; renk kodlu satırlar
[7] CORRECTION             → Inline edit veya sağ panel düzeltme
[8] APPROVAL               → Tümünü Onayla / Sadece Yeşilleri / Reddet
[9] COMMIT                 → transaction.atomic: kesin kayıt yarat + ImportLog APPROVE+COMMIT
[10] ROLLBACK PENCERESİ    → 24 saat içinde geri alma (kayıtlar soft-delete)
```

---

## 4. MODEL YAPISI (PHASE1_DATA_MODEL_PLAN.md ref)

- `ImportBatch` — toplu iş.
- `ImportSourceFile` — fiziki dosya (Excel sheet, PDF sayfa, RAR içindeki tekil).
- `ImportDraftRecord` — satır seviyesi taslak (ham + parse JSON).
- `ImportDraftField` — opsiyonel alan-alan granular log.
- `ImportLog` — aksiyon zaman çizelgesi.
- `ImportMappingProfile` — kaydedilmiş eşleme şablonu.

---

## 5. IDEMPOTENCY VE DEDUP

### 5.1 Strateji
| Hedef | Doğal anahtar | Çakışma davranışı |
|---|---|---|
| Fatura | `(abonelik_id, donem_yyyymm)` | UPDATE veya SKIP (mapping ekranında karar) |
| Ödeme | `(fatura_id, odeme_tarihi, tutar, banka_id)` veya `external_ref` | SKIP (ödeme tekrar import edilmez) |
| EmlakVergisi | `(mulk_id, yil, donem)` | UPDATE |
| SiteXEkstre | `(daire_id, yyyymm)` | UPDATE |
| TeminatMektubu | `(banka_id, mektup_no)` | UPDATE |
| ResmiOdeme | `(tip, sahis/sirket, yyyymm, taksit_no)` | UPDATE |
| Belge | `sha256` | SKIP (var olan döner) |

### 5.2 Tekrarlı dosya yükleme
- Aynı sha256'ya sahip dosya tekrar yüklenirse: `Belge` kaydı yeniden kullanılır.
- Yeni `ImportBatch` oluşturulabilir (kullanıcı bilinçli tekrar import yapabilir).
- Eski batch durumu otomatik etkilenmez.

---

## 6. DRY-RUN VE PREVIEW

```python
# apps/imports/services/dry_run.py
def dry_run_excel(file, target_module, mapping_profile):
    """
    Hiçbir DB write yapmadan parse + validate.
    Returns:
        DryRunReport(
            total_rows: int,
            green: int,  # OK
            yellow: int,  # uyarı
            red: int,  # hata
            purple: int,  # manuel doğrulama
            preview_drafts: List[ImportDraftRecord]  # in-memory, save edilmez
        )
    """
```

---

## 7. HATA / UYARI SINIFLARI

```python
class DraftStatus:
    OK = "ok"            # yeşil — direkt commit edilebilir
    WARNING = "uyari"    # sarı — onay ile commit
    ERROR = "hata"       # kırmızı — düzeltmeden commit YOK
    MANUAL = "kontrol"   # mor — manuel doğrulama gerekli (yeni kişi/kurum vs.)

class WarningCode(TextChoices):
    AMOUNT_UNCHANGED = "Tutar geçen aydan değişmedi"
    AMOUNT_ZERO = "Tutar 0"
    AMOUNT_X_MARK = "Excel hücresi 'X' iptal işareti"
    DATE_PAST = "Ödeme tarihi geçmiş"

class ErrorCode(TextChoices):
    REQUIRED_MISSING = "Zorunlu alan boş"
    AMOUNT_INVALID = "Tutar negatif veya parse edilemedi"
    DATE_INVALID = "Tarih formatı bozuk"
    REFERENCE_NOT_FOUND = "Abonelik/mülk master'da bulunamadı"
    FORMAT_MISMATCH = "Sicil/TC formatı bozuk"
    DUPLICATE_RECORD = "Aynı kayıt mevcut, UPDATE/SKIP karar gerekli"

class ManualCode(TextChoices):
    NEW_PERSON_DETECTED = "Yeni şahıs tespit edildi (master'da yok)"
    NEW_KURUM_DETECTED = "Yeni kurum tespit edildi"
    AMBIGUOUS_MATCH = "Birden fazla eşleşme adayı"
    MAPPING_INFERRED = "Mapping tahmin edildi, doğrula"
```

---

## 8. APPROVAL FLOW

| Buton | Eylem |
|---|---|
| **Tümünü Onayla** | Sadece OK + WARNING (kullanıcı uyarıları okuyup onaylıyor) — RED ve MANUAL hariç |
| **Sadece Yeşilleri Onayla** | Sadece OK; WARNING/RED/MANUAL taslakta kalır |
| **Reddet** | Tüm batch REDDEDILDI; Belge kaydı kalır, draft'lar silinmez (audit) |
| **Mapping'e Dön** | Step 3'e geri, draft'lar silinir, batch durumu YUKLENDI |
| **Taslakta Bırak** | Batch durumu ON_IZLEME, kullanıcı sonra devam edebilir |
| **Rollback** | Commit sonrası 24 saat: tüm yaratılan kayıtlar soft-delete + AuditLog |

---

## 9. COMMIT İMPLEMENTASYONU

```python
# apps/imports/services/commit.py
@transaction.atomic
def commit_batch(batch: ImportBatch, user: User, only_green=False):
    drafts = batch.drafts.filter(durum__in=[OK, WARNING] if not only_green else [OK])

    for draft in drafts:
        target_app = draft.hedef_kayit_app
        # dispatch to module-specific committer
        committer = MODULE_COMMITTERS[target_app]
        instance = committer(draft.parse_edilmis_json, batch=batch)
        draft.hedef_kayit_id = instance.id
        draft.durum = ONAYLANDI
        draft.save()

    batch.durum = ONAYLANDI
    batch.commit_zamani = now()
    batch.rollback_son_tarih = now() + timedelta(hours=24)
    batch.save()

    record_audit(user, batch, "IMPORT_APPROVE", new={"committed": drafts.count()})
```

---

## 10. ROLLBACK İMPLEMENTASYONU

```python
@transaction.atomic
def rollback_batch(batch, user):
    if now() > batch.rollback_son_tarih:
        raise PermissionDenied("Rollback süresi doldu (24 saat)")

    for draft in batch.drafts.filter(durum=ONAYLANDI):
        Model = apps.get_model(draft.hedef_kayit_app)
        instance = Model.all_objects.get(id=draft.hedef_kayit_id)
        instance.delete(user=user, reason=f"ImportBatch #{batch.id} rollback")
        draft.durum = ROLLBACK_EDILDI
        draft.save()

    batch.durum = ROLLBACK_EDILDI
    batch.save()
    record_audit(user, batch, "IMPORT_ROLLBACK", critical=True)
```

---

## 11. KAYNAK BAZLI PARSER STRATEJİSİ

| Kaynak | Zorluk | Parser | Kontrol Kuralları | Hedef Model(ler) |
|---|---|---|---|---|
| `BAĞKUR ÖDEMELERİ.xlsx` | Düşük | unpivot kişi×ay | TC format, tutar > 0, ay sırası | `ResmiOdeme(tip=BAGKUR)` |
| `İTO aidat çizelgesi.xlsx` | Düşük | yıl sheet × şirket × taksit | Sicil format, "TAMAMI ÖDENDİ" parse | `ResmiOdeme(tip=ITO)` |
| `EV ABONELİKLERİ.xlsx` (meta sheet) | Düşük | Master abonelik | Hesap no + Kurum dedup | `Abonelik` + `Taahhut` |
| `EV ABONELİKLERİ.xlsx` (kişi sheet'leri) | Orta | unpivot 12 ay × (Son Ödeme + Tutar) | "X" → iptal flag, boş tutar uyarı | `Fatura` + `Odeme` |
| `ŞAHISLAR OTOMATİK ÖDEME.xlsx` | Düşük (yapısı EV ile aynı) | Aynı | Aynı | Aynı |
| `ŞİRKET ABONELİKLERİ.xlsx` | Düşük | Master abonelik | Taahhüt bitiş tarih, paket tutar boş uyarı | `Abonelik` + `Taahhut` |
| `ÖDEMELER OTOMATİKLER VE ELDEN.xlsx` | Orta | Şirket sheet → fatura/ödeme | Sheet→Şirket eşleme onayı, "ELDEN" yöntem işareti | `Fatura` + `Odeme(yontem=ELDEN/EFT)` |
| `ÖDEMELER TAKİP ÇİZELGESİ.xlsx` (yıl sheet'leri) | Orta | Kira kategori×şirket×ay | "." boş hücre, kira artışı yıl bazlı | `KiraSozlesmesi` + `KiraDonemTutar` + `KiraOdeme` |
| `ÖDEMELER TAKİP — EMLAK sheet` | Orta | Mülk listesi + durum | Belediye + Sicil onayı | `Mulk` (varsa) + `EmlakVergisi` |
| `TEMİNAT MEKTUPLARI.xlsx` | **Yüksek** | Şirket bazlı ayrı parser (heterojen sheet) | Mektup no unique, "İADE OLDU" parse, komisyon periyot | `TeminatMektubu` + `TeminatKomisyonOdemesi` |
| `EMLAK VERGİLERİ 2024/2025.rar` | **Yüksek** | extract → dosyaadı parse → metadata | Belediye + kişi tahmin, dönem klasör (1.DÖNEM/2.DÖNEM) | `EmlakVergisi` + `Belge` |
| `SITEX.rar` | **Çok Yüksek** | extract → `PRUVA\YYYY-MM\<DAIRE>.pdf` regex | Daire kodu sabit (5 daire), bildirim yazısı ayrı | `SiteXEkstre` + `Belge` + `SiteXYillikBelge` |
| `PAPİNET.rar` | Yüksek | extract → klasör (entegratör/şirket) + dosya tipi | Sözleşme vs fatura ayrımı | `Entegrator` + `EntegratorSozlesme` + `EntegratorFatura` + `Belge` (MVP-2) |

---

## 12. İLK İMPORT ÖNERİLEN SIRA (D-018: 2024-2026 odaklı)

| Sıra | Kaynak | Hedef | Gerekçe |
|---|---|---|---|
| **1** | TEMİNAT MEKTUPLARI.xlsx | Teminat | Banka master + temel finans referansı |
| **2** | ŞİRKET ABONELİKLERİ.xlsx | Abonelik master | Tüm şirket aboneliklerinin temeli |
| **3** | EV ABONELİKLERİ.xlsx (meta sheet) | Ev abonelik master | Şahıs aboneliklerinin temeli |
| **4** | ŞAHISLAR OTOMATİK ÖDEME.xlsx (2026 sheet'ler) | Fatura/Ödeme 2026 | İlk yıl operasyonel |
| **5** | EV ABONELİKLERİ.xlsx (kişi sheet'leri 2025) | Fatura/Ödeme 2025 | Geçmiş yıl arşiv (görev üretmesin) |
| **6** | ÖDEMELER OTOMATİKLER VE ELDEN.xlsx | Fatura/Ödeme 2026 | Şirket bazlı ek ödemeler |
| **7** | ÖDEMELER TAKİP ÇİZELGESİ.xlsx (KIRA + 2024-2026) | Kira sözleşmesi + ödeme | Düzenli ödemeler |
| **8** | ÖDEMELER TAKİP — EMLAK sheet | Emlak vergisi + Mülk master | Mülk listesi + 2026 durumu |
| **9** | İTO aidat 2025-2026 | ResmiOdeme(tip=ITO) | Resmi ödemeler temel |
| **10** | BAĞKUR ÖDEMELERİ.xlsx (2025-2026) | ResmiOdeme(tip=BAGKUR) | 5 şahıs için aylık |
| **11** | EMLAK VERGİLERİ 2024.rar | EmlakVergisi 2024 + Belge | Geçmiş + makbuz arşiv |
| **12** | EMLAK VERGİLERİ 2025.rar | EmlakVergisi 2025 + Belge | 2025 dönemi |
| **13** | SITEX.rar (2024-2026) | SiteXEkstre + Belge + YillikBelge | Yoğun ama disiplinli yapı |
| **14 (MVP-2)** | PAPİNET.rar | Entegrator + Sozlesme + Fatura | Faz 9 |

> 2020-2023 verileri **LATER (D-018)** — 2. import fazında.

---

## 13. "GEÇMİŞ VERİ" FLAG'İ (D-018)

```python
class ImportBatch(BaseModel):
    # ...
    historical_data = models.BooleanField(
        default=False,
        help_text="True ise: kayıt yaratılır ama otomatik görev/bildirim üretilmez."
    )
```

Cron'lar `historical_data=False` olan kayıtlar için iş üretir. 2020-2024 import'unda `historical_data=True` işaretlenir.

---

## 14. MAPPING PROFILE ÖRNEKLERİ (kayıtlı şablonlar)

| Profil Adı | Hedef | Açıklama |
|---|---|---|
| `ev_abonelikleri_kisi_sheet_v1` | Fatura+Ödeme | EV ABONELİKLERİ kişi sekme yapısı |
| `sirket_abonelikleri_v1` | Abonelik master | ŞİRKET ABONELİKLERİ ana sheet |
| `bagkur_aylik_v1` | ResmiOdeme | BAĞKUR ÖDEMELERİ matrisi |
| `ito_yillik_v1` | ResmiOdeme | İTO yıl sheet'i (2 taksit) |
| `teminat_acme_enerji_v1` | Teminat | Şirket bazlı sheet farkı |
| `teminat_teksan_brode_v1` | Teminat | (heterojen) |
| `teminat_acme_tekstil_v1` | Teminat | (heterojen) |
| `pruva34_ekstre_rar_v1` | SiteXEkstre | RAR klasör+dosya regex |
| `emlak_rar_klasor_v1` | EmlakVergisi+Belge | RAR 1.DÖNEM/2.DÖNEM klasör |
| `kira_yil_sheet_v1` | KiraDonem+Odeme | Kira yıl sheet'leri |

---

## 15. UI HARİTASI (Frame referans)

| Adım | Desktop Frame | Mobile Frame |
|---|---|---|
| 1. UPLOAD | 03 (Center) | (planlandı) |
| 2-3. PARSE+MAPPING | 03 stepper adım 2 | desktop önerisi banner |
| 4-7. PREVIEW + CORRECTION | 04 (3 panel) | 24 (sekmeli kart akışı) |
| 8. APPROVAL | 04 alt sticky bar (6 buton) | 24 alt sticky (Yeşilleri Onayla / Taslak) |
| 9-10. COMMIT + ROLLBACK | 03 son importlar tablosu + drawer | — |

---

## 16. PERFORMANS HEDEFLERİ

| İşlem | Hedef Süre |
|---|---|
| Excel dry-run (5K satır) | <30 sn |
| RAR extract (50 MB) | <10 sn |
| Preview render (500 draft) | <2 sn |
| Commit (1K satır) | <10 sn |
| Rollback (1K kayıt) | <15 sn |

Büyük import'lar Celery async; UI progress bar.

---

## 17. RİSKLER VE MİTİGASYON

| # | Risk | Mitigasyon |
|---|---|---|
| R1 | Teminat heterojen sheet → atlanan mektup | Şirket bazlı parser + manuel doğrulama (mor) zorunlu |
| R2 | SiteX dosya adı convention değişimi | Robust regex + fallback "manuel atama" UI |
| R3 | Aynı dosya tekrar yüklenir, veri çoğalır | sha256 dedup + draft idempotency natural key |
| R4 | Commit ortasında hata → kısmi yazım | `transaction.atomic` zorunlu |
| R5 | "X" işareti yorumu yanlış → otomatik talimat üretilir | Mapping'de "X→iptal" varsayımı kullanıcıya gösterilir, opt-in |
| R6 | OCR hatası → yanlış tutar | OCR güven skoru <0.85 → manuel doğrulama (mor) |
| R7 | Eski yıl import'unda görev/bildirim spam'i | `historical_data=True` flag ile cron filtre |
| R8 | RAR memory taşması | Stream extract + chunked processing (Celery) |

---

**SON.** Faz 3 Import Merkezi implementasyonu bu planı izler.
