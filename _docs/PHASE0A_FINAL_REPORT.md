# FAZ 0A — FİNAL RAPOR
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 0A — Read-Only Veri Kaynağı Envanteri ve Modül Analizi
**Tarih:** 2026-05-05
**Durum:** TAMAMLANDI (read-only) → Faz 0B'ye hazır

---

## 0. YÖNETİCİ ÖZETİ

Masaüstündeki `muhasebe\` klasörü read-only modda incelendi. **9 Excel + 4 RAR arşivi** (toplam ~62 MB, ~330+ belge) analiz edildi. Excel'lerin tamamı **kişi/şirket × ay matrisi** formatında — sistem bunu birebir taklit etmemeli, **long-format normalize veri modeli** ile inşa edilmeli.

**21 modül** önerildi; **16 tanesi MVP-1** kapsamında. Kritik bulgular:
- SiteX her ay 5 daire × 2 PDF düzenli akışıyla en yoğun belge üreten modül.
- Teminat mektupları her şirket için farklı sheet yapısında — şirket bazlı ayrı parser gerekecek.
- Emlak vergisi PDF/JPG/XLSX karışık → metadata önce, OCR sonra.
- Hiçbir import doğrudan kesin kayıt yaratmamalı; **ImportBatch → ImportDraft → onay → kesin kayıt** zorunlu.

Sonraki adım: **Faz 0B — Master Proje Anayasası** (sözleşme, kurallar, isimlendirme, branş/commit, izinler).

---

## 1. ANA BULGULAR

| # | Bulgu | Etki |
|---|---|---|
| B1 | Tüm Excel'ler matris (kişi×ay) | Long-format unpivot + view layer'da matris render |
| B2 | 5 ana şahıs (Mehmet Rahim, Mehmet Ali, Ali, Test, Kaan Acme) sürekli geçiyor | `Sahis` çekirdek tablosu ve `aile_grubu="ACME"` |
| B3 | Şirket grubu: Acme Enerji (Yeniçe HES, Kısık), Acme Tekstil, Beta Tekstil, KC İplik, MakYapı, MDT, FMK, Beta Otel | `Sirket` master — manuel onaylı seed |
| B4 | Kira tutarı yıl bazlı değişiyor (örn. K.Tekstil 2025: 22500 → 2026: 31500) | `KiraDonemTutar` ayrı tablo |
| B5 | "X" işareti = iptal/uygulanmaz | Boolean `iptal` flagi olarak parse |
| B6 | "ELDEN" / "ALBARAKA TALİMAT" / "BANKA EFT" / "KREDİ KARTI" | `Odeme.yontem` enum zorunlu |
| B7 | SiteX PDF'leri klasör adı + dosya adı parse ile %95 metadata çıkarılabilir | Faz 6'da OCR'ya gerek olmayabilir |
| B8 | PAPİNET sözleşmeleri 2019-2021 dönemi — tarihi belge arşivi | `EntegratorSozlesme` + `Belge` arşiv |
| B9 | Teminat mektubu sheet'lerinde "İADE OLDU" notu serbest metin | `TeminatMektubu.durum` ve `iade_tarihi` ayrı alan |
| B10 | İTO 2 taksit (Haziran/Ekim) sabit kural | `ResmiOdeme(tip=ITO, taksit_no=1/2)` |
| B11 | SiteX ödeme genelde ayın 20-22'sinde | Görev şablonu: ayın 20'si T-3 hatırlatma |
| B12 | BAĞKUR ödeme tutarı 2024'te ~1500 TL → 2025'te ~10000 TL büyük artış | Yıllık tutar değişimi normal |

---

## 2. VERİ KAYNAKLARI ÖZETİ

| Tip | Adet | Toplam Boyut | Yorum |
|---|---|---|---|
| .xlsx | 9 | ~1.4 MB | Yapısal — düşük/orta zorluk |
| .rar | 4 | ~60.7 MB | İçinde ~330 PDF/JPG/XLSX |
| **Toplam belge** | **~340** | **~62 MB** | İlk import partisi ~12-15 ImportBatch |

**Detay:** [`PHASE0A_DATA_SOURCE_INVENTORY.md`](../_analysis/reports/PHASE0A_DATA_SOURCE_INVENTORY.md)

---

## 3. ÖNERİLEN MODÜL MİMARİSİ (21 modül)

**MVP-1 (16):** Yetki, Dashboard, Fatura, Ödeme, Otomatik Ödemeler, Ev/Şahıs, Abonelik, SiteX, Emlak, Teminat, Resmi Ödemeler, Kira, Ajanda, Bildirim, Import, Audit
**MVP-2 (4):** PDF Fatura Import (OCR), Elden/EFT/Kart Detay, ETA/Papinet Detay, Raporlama
**MVP-3 (1):** Kurumsal Chat

**Detay:** [`PHASE0A_MODULE_MAP.md`](../_analysis/reports/PHASE0A_MODULE_MAP.md)

---

## 4. NORMALİZE VERİ MODELİ ÖZETİ

**14 ana model grubu:** Çekirdek (Sahis/Sirket/Mulk/Banka), Fatura/Odeme, Abonelik/Taahhut, SiteX (4 model), EmlakVergisi, TeminatMektubu (+ KomisyonOdemesi), ResmiOdeme, Kira (3 model), Entegrator/Kontor (4 model), Ajanda (5 model), Chat (4 model), Import (5 model + Belge), Bildirim (3 model), AuditLog.

**Toplam ~50 ana model.**

**Tasarım prensipleri:**
1. Tüm dönemsel veriler `yyyymm` veya `(yil, donem)` long-format
2. `Belge` model'i tüm dosyalar için merkezi
3. `Import*` zinciri her import işini kayıt altına alır
4. `AuditLog` her CRUD'u izler
5. Generic FK (`bagli_model + bagli_id`) Görev/Chat/Bildirim'de polimorfik bağ kurar

**Detay:** [`PHASE0A_NORMALIZED_MODEL_DRAFT.md`](../_analysis/model_drafts/PHASE0A_NORMALIZED_MODEL_DRAFT.md)

---

## 5. IMPORT STRATEJİSİ

### 5.1 Üç Ana Pipeline

| Pipeline | Akış |
|---|---|
| **Excel** | Upload → openpyxl parse → Mapping (kayıtlı şablon veya manuel) → ImportDraft satırları → Ön izleme → Hata düzeltme → Onay → Kesin kayıt |
| **PDF (tek)** | Upload → metadata extract (filename + creation date) → Opsiyonel OCR → ImportDraft → Onay → Belge + Fatura/EmlakVergisi/SiteXEkstre |
| **RAR/Klasör** | Upload → Extract → Klasör/dosyaadı parse (regex pattern) → Toplu ImportDraft → Onay sonrası ilgili modellere dağıt |

### 5.2 Önerilen İlk Veri Göçü Sırası

1. **Çekirdek seed:** Sahis, Sirket, Banka, Kurum, Mulk (manuel + İTO/Şirket Abonelik Excel'lerinden)
2. **Şirket Abonelikleri** + **Ev Abonelikleri (meta sheet)** → `Abonelik` + `Taahhut`
3. **Şahıslar Otomatik Ödeme** + **Ev Abonelikleri kişi sheet'leri** (2025-2026) → `Fatura` + `Odeme`
4. **Ödemeler Otomatikler ve Elden** → şirket bazlı `Fatura` + `Odeme`
5. **Ödemeler Takip Çizelgesi** Kira sheet'leri (2020-2026) → `KiraSozlesmesi` + `KiraDonemTutar` + `KiraOdeme`
6. **İTO** + **BAĞKUR** + ÖDEMELER TAKİP Bağkur sheet → `ResmiOdeme`
7. **ÖDEMELER TAKİP — EMLAK sheet** + **EMLAK 2024.rar** + **2025.rar** → `Mulk` + `EmlakVergisi` + `Belge`
8. **SITEX.rar** → `SiteXDaire` + `SiteXEkstre` + `Belge` + `SiteXYillikBelge`
9. **TEMİNAT MEKTUPLARI** → `TeminatMektubu` + `TeminatKomisyonOdemesi`
10. **PAPİNET.rar** → `Entegrator` + `EntegratorSozlesme` + `Fatura` + `Belge`

### 5.3 Kontrol Gerekli Kayıtlar

- "X" işaretli (iptal varsayımı) satırlar → manuel onay
- "İPTAL DİLEKÇESİ VERİLDİ" not'lu satırlar → manuel iptal süreci
- Tutar boş / 0 satırlar → kullanıcıya soru
- Sicil/TC formatı bozuk → kontrol
- Aynı ay içinde aynı abonelik için 2+ ödeme → mutabakat ekranı
- SiteX aidat farkı satırları → manuel mutabakat

**Kural:** Hiçbir kayıt onaysız kesin değildir.

---

## 6. BİLDİRİM / GÖREV STRATEJİSİ

| Tetikleyici | Bildirim | Otomatik Görev |
|---|---|---|
| Fatura son ödeme T-7/T-3/T-1 | Sistem içi + (T-1) Telegram | (T-3) "Ödemeyi yap" görevi |
| Abonelik taahhüt bitişi T-60/T-30/T-7 | Sistem içi + Telegram | (T-30) "Yeni paket teklifi al" görevi |
| SiteX her ayın 17'si | Sistem içi | (Ayın 17'si) "SiteX ekstre indir + ödeme yap" görevi her daire için |
| Emlak vergisi 1.taksit Mayıs sonu | Sistem içi + Telegram | (T-15) "Emlak vergisi öde" görevi her mülk |
| Emlak vergisi 2.taksit Kasım sonu | Aynı | Aynı |
| Teminat komisyon T-7/T-1 | Sistem içi + Telegram | (T-7) "Komisyon ödemesi" görevi |
| BAĞKUR aylık | Sistem içi | (Ay sonu T-3) görev |
| SSK ayın 23'ü | Sistem içi | Görev |
| İTO 1.taksit (30 Haziran) / 2.taksit (31 Ekim) | Telegram | (T-15) görev |
| ETA/Papinet sözleşme bitişi T-60 | Sistem içi + Telegram | "Sözleşme yenile" görevi |
| Kontör eşik altı (<500) | Acil bildirim | "Kontör yükle" görevi |
| Eksik dekont (ödeme var, dekont yok) | Sistem içi | "Dekont yükle" görevi |
| Kontrol bekleyen import | Sistem içi | "Import onayla" görevi |
| Geciken görev | Günlük 09:00 özet | — |
| Tamamlanmamış günlük iş (gün sonu 17:30) | Atanan kullanıcıya | — |

**Bildirim akış sırası (önemli):**
1. Sistem içi dashboard uyarısı (anında)
2. NotificationLog kaydı
3. Telegram **dry-run** (admin görür, gönderilmez)
4. Telegram **test** kanalı (admin onayı sonrası)
5. Telegram **gerçek** gönderim (Faz 12'de aktif)

---

## 7. UI / DESIGN İHTİYAÇLARI

- **104 ekran** taslağı çıkarıldı (auth + dashboard + 19 modül + ayarlar + mobil).
- Özel component'lar: ay matrisi tablosu, KPI card, status tag, belge önizleyici, mapping editor, aylık ödeme grid, telegram test stepper.
- Mobil: dashboard + görev + chat + dekont/makbuz fotoğraf yükleme.

**Detay:** [`PHASE0A_DESIGN_SCREEN_LIST.md`](../_analysis/design_brief/PHASE0A_DESIGN_SCREEN_LIST.md)

---

## 8. MVP ÖNERİSİ

**MVP-1'e KESİN dahil edilmesi gerekenler (16 modül):**
Yetki, Dashboard, Fatura, Ödeme, Otomatik Ödemeler, Ev/Şahıs, Abonelik+Taahhüt, SiteX, Emlak, Teminat, Resmi Ödemeler, Kira, Ajanda+Görev, Bildirim, Import, Audit.

**Sonraya bırakılabilecekler:**
- PDF OCR (Faz 2 — manuel yükleme + metadata yeterli başlangıçta)
- Kurumsal Chat (MVP-3)
- Raporlama Excel export (MVP-2 — başlangıçta liste filtreli görüntüleme yeterli)
- Telegram **gerçek** gönderim (Faz 12'de aktive edilir)

**İlk import partisi:**
1. Çekirdek seed (Sahis, Sirket, Banka, Kurum, Mulk) — MANUEL + Şirket Abonelik Excel'inden
2. SiteX daire master + 2026 ekstreleri (en disiplinli yapı)
3. Şahıs/Şirket abonelikler + 2025-2026 ödeme matrisi
4. Sonra emlak/teminat/resmi

**En düşük riskli başlangıç:** Şirket Abonelik + SiteX daire master (yapı temiz).
**En yüksek riskli:** Teminat Mektupları (heterojen sheet) + PAPİNET PDF arşivi (hacimli, eski).

---

## 9. RİSKLER

| # | Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|---|
| R1 | Excel mapping'leri yanlış kurulur, ilk import veri kalitesi düşer | Yüksek | Yüksek | ImportDraft + onay zorunlu, geri alma (rollback) ImportBatch'te |
| R2 | SiteX PDF naming convention ileride değişirse parser kırılır | Orta | Orta | Robust regex + fallback "manuel atama" ekranı |
| R3 | Teminat mektubu heterojen sheet'leri yorumlanır ama tek bir mektup atlanır | Orta | Yüksek (finansal) | Sheet bazlı ayrı parser + manuel mutabakat şart |
| R4 | Emlak PDF/JPG OCR güvenilirliği düşük | Yüksek | Düşük | OCR'ı opsiyonel; metadata + manuel girdi yeterli |
| R5 | "X" işaretli satırların yorumu yanlışsa otomatik talimatlar üretilir | Orta | Yüksek | Import preview'da "X→iptal" varsayımı kullanıcıya gösterilmeli |
| R6 | Telegram gönderimi yanlış grupa gider | Düşük | Yüksek | 3 aşamalı (dry-run → test → gerçek) süreç zorunlu |
| R7 | Aile bireyleri kişisel bilgi (TC) içeriği — KVKK | Düşük | Yüksek | Yetki kontrolü + audit log + log'da TC maskeleme |
| R8 | Eski 2020-2024 verileri import edilirken aktif görev üretilmesi | Orta | Düşük | Import sırasında "geçmiş veri" flagi → görev/bildirim üretme |
| R9 | Aynı fatura iki defa import edilir | Yüksek | Orta | unique constraint (`abonelik, yyyymm`) + dedup ekranı |
| R10 | SiteX 277 dosyalık RAR memory'de patlar | Düşük | Orta | Stream extract + batch insert |

---

## 10. KODLAMAYA GEÇMEDEN ÖNCE KULLANICIDAN ALINMASI GEREKEN KARARLAR

1. **Renk paleti / logo / kurumsal kimlik** (Claude Design'a girmeden önce)
2. **Sol menü grup yapısı** (önerimiz: Operasyon / Mülk-Şahıs / Şirket / Resmi-Banka / Sistem)
3. **Şahıs ve şirket master listesi onayı** (5 şahıs, ~10 şirket — kesinleştirilecek)
4. **Mülk master listesi onayı** (SiteX 5 daire + Yeniçe HES + Kısık + Yeniçe bina + Floryası + ofisler + fabrikalar — kesinleştirilecek)
5. **Roller ve atanan kullanıcılar** (Ayşe / Erdal / Melek + müdür + yönetici + super admin — gerçek kullanıcı eşleşmesi)
6. **"X" işareti yorumu** = iptal mi pasif mi? (Önerimiz: iptal flag)
7. **Telegram konfig** — bot token, hangi grup, gerçek gönderim hangi modülden başlar?
8. **PDF OCR yapılacak mı yoksa sadece metadata + manuel mi?** (Önerimiz: MVP-2'ye al)
9. **Çoklu dil / çoklu para birimi gerekecek mi?** (Önerimiz: Sadece TR + TRY)
10. **Mobil uygulama scope'u** (Önerimiz: web responsive yeterli; native sonra)
11. **Eski yıllar (2020-2024) import edilecek mi yoksa sadece 2025+ mi?** (Tarihçe için 2020+ önerilir)
12. **Veritabanı:** PostgreSQL onaylı mı?
13. **Auth:** Django built-in mi, SSO mu, 2FA?
14. **Hosting:** Aynı sunucu mu, ayrı VPS mi? (İzolasyon kuralı: ayrı önerilir)

---

## 11. ÖNERİLEN SONRAKİ FAZ: FAZ 0B — MASTER PROJE ANAYASASI

Faz 0A'nın çıktıları sabit. Sıradaki adım **Faz 0B — Master Proje Anayasası**:

- Proje vizyonu / misyonu / kısıtları
- İzolasyon kuralları (diğer Acme projelerinden ayrı)
- Kodlama ve isimlendirme standartları (Türkçe domain + İngilizce teknik)
- Branş / commit / PR kuralları
- Yetki seviyeleri ve audit kuralları
- KVKK / veri saklama / log politikası
- Dosya/belge saklama yolu (storage)
- Yedekleme politikası
- Test/QA strateji şablonu
- Telegram gönderim 3-aşama kuralı (dry-run → test → gerçek)
- Import "onaysız kesin kayıt yok" kuralı (yazılı kural)
- Sürüm/release/deploy süreci

Faz 0B çıktısı sonrası → **Faz 0C: Claude Design UI/UX sistemi**.

---

## 12. RAPOR DOSYALARI

| Dosya | Konum |
|---|---|
| Veri Kaynağı Envanteri | `_analysis/reports/PHASE0A_DATA_SOURCE_INVENTORY.md` |
| Modül Haritası | `_analysis/reports/PHASE0A_MODULE_MAP.md` |
| Normalize Model Taslağı | `_analysis/model_drafts/PHASE0A_NORMALIZED_MODEL_DRAFT.md` |
| Design Ekran Listesi | `_analysis/design_brief/PHASE0A_DESIGN_SCREEN_LIST.md` |
| **Final Rapor (bu dosya)** | `_docs/PHASE0A_FINAL_REPORT.md` |

---

## 13. FAZ 0A SINIRI — DURDURMA NOKTASI

✅ Klasör yapısı oluşturuldu (`_source_data`, `_analysis/{reports,import_inventory,model_drafts,design_brief}`, `_docs`, `backend`).
✅ Kaynak dosyalar `_source_data` altına kopyalandı (orijinal değiştirilmedi).
✅ SHA-256 + boyut raporu üretildi.
✅ Excel'lerin sheet ve kolon yapıları read-only incelendi.
✅ RAR arşivlerinin dosya listesi alındı (içerik PDF body parse YAPILMADI).
✅ 5 rapor markdown dosyası yazıldı.

❌ Kod yazılmadı.
❌ Django app, migration, DB oluşturulmadı.
❌ İmport gerçekleştirilmedi.
❌ Telegram/mail gönderilmedi.
❌ Commit/push/deploy yapılmadı.
❌ Diğer Acme projelerinin klasörlerine dokunulmadı.

**Durum:** Faz 0A tamamlandı. Bir sonraki faz için kullanıcı onayı bekleniyor.

---
