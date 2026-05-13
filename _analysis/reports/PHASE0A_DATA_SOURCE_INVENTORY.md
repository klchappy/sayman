# FAZ 0A — VERİ KAYNAĞI ENVANTERİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 0A — Read-Only Veri Kaynağı Envanteri ve Modül Analizi
**Hazırlama tarihi:** 2026-05-05
**Mod:** READ-ONLY (kod yok, migration yok, DB yok, import yok)
**Kaynak klasör:** `C:\Users\lenovo\Desktop\muhasebe\`
**Çalışma kopyası:** `C:\Users\lenovo\Desktop\muhasebe-operasyon-seed\_source_data\` (orijinal dosyalar değiştirilmedi, sadece kopyalandı)

---

## 1. KAYNAK DOSYA HASH/SIZE RAPORU

| Dosya | Boyut (byte) | SHA-256 |
|---|---|---|
| BAĞKUR ÖDEMELERİ.xlsx | 12.701 | fbe799106c9cae982d5e0b4c6803c994463983188b6c6ac0c3a4aba261ac38a6 |
| EMLAK VERGİLERİ 2024.rar | 3.800.286 | ae716a5412b35ac1fefc0a8b321478a4519ef995373a4429d023f875a41805aa |
| EMLAK VERGİLERİ 2025.rar | 473.698 | 8f0ced29c3be1ce5f105e3185f0ab1f52ac96eef0d32fe19c13ad3d5c6096501 |
| EV ABONELİKLERİ ALBARAKA OTOMATİK ÖDEMELER.xlsx | 36.550 | 96df016fd8d2c1383b5e5344968fbc1bf2430571dd03a75725d379b60e3066f1 |
| PAPİNET.rar | 9.558.862 | 531017c8792f6a1e09fc332064267195d7855a42818368b5503ebe41752fb065 |
| SITEX.rar | 46.941.309 | d1361c06816584f94fdc64e81f9bc1cd5097bbe99717d1c63db9bba4d8c8cce6 |
| TEMİNAT MEKTUPLARI TAKİP LİSTESİ ACME ENERJI BANKA1 BANKA2.xlsx | 1.135.743 | b97e9477a986b7f8f358623ea88d0b0db6262da91a54cb9ba68c0a6be5572d80 |
| ÖDEMELER OTOMATİKLER VE ELDEN YAPILANLAR.xlsx | 41.283 | a78289055fc4871807fe9b14763d5904c0485d49c51aec36022fa499cc7eafda |
| ÖDEMELER TAKİP ÇİZELGESİ GENEL ÖDEMELER.xlsx | 91.440 | e106dbc5211751413a4e665e00c2fc385fa8b7312b4442b550960a973e2d79ff |
| İTO aidat ödeme çizlegesi.xlsx | 23.213 | f7f6cdc7c9742cd935099eefa9796e52f57394ab9d0c641aeb5917854693368a |
| ŞAHISLAR OTOMATİK ÖDEME.xlsx | 31.388 | dddf456256730c288bd806a612ba4e4b7ffd49336eafa07af6328732fd549834 |
| ŞİRKET ABONELİKLERİ ACME ENERJI ACME TEKSTIL BETA.xlsx | 18.882 | 7bcb0b5cfc87f35c8738021d76060300449057d98799bfd94b51dc76195e955c |

> Kopyalama yöntemi: `cp -n` (mevcut hedef üzerine yazmaz). Orijinal `muhasebe\` klasörü hiç değiştirilmemiştir.

---

## 2. ANA ENVANTER TABLOSU

| # | Dosya / Arşiv | Tip | Tahmini İçerik | Bağlanacağı Modül(ler) | Ana Alanlar (gözlemlenen) | Import Zorluğu | Önerilen Strateji | Kontrol Gerekli Alanlar | MVP Etkisi |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **BAĞKUR ÖDEMELERİ.xlsx** | Excel — matris (kişi × ay) | 5 şahıs için aylık BAĞKUR (4B) prim ödemeleri | 13. Resmi Ödemeler / BAĞKUR · 4. Ödeme Takip · 15. Ajanda | Şahıs, TC No, Aylık tutar, OCAK..ARALIK kolonları | Düşük | Long-format'a "unpivot" → her ay 1 satır = 1 ödeme dönemi | TC No format, Tutar > 0, Ay sırası | **YÜKSEK** — kritik düzenli ödeme |
| 2 | **EMLAK VERGİLERİ 2024.rar** | RAR — PDF + JPG + XLSX | 1. ve 2. dönem emlak vergisi makbuz/borç dökümleri (Bakırköy, Fatih, Beyoğlu, Esenyurt, Manisa-Şehzadeler, Yalova, Bayrampaşa-MegaCenter) | 10. Emlak Vergisi & Mülk · 3. PDF Fatura Import · 18. Import Merkezi | Belediye, Sicil No, Mülk sahibi, Dönem (1/2), Yıl, Belge dosyası | **Yüksek** — heterojen PDF/JPG, OCR gerekli | Önce metadata import (dosya adı parse), sonra opsiyonel OCR | Kişi-mülk eşleşmesi, dönem tanımlaması, manuel doğrulama zorunlu | Orta — referans/arşiv |
| 3 | **EMLAK VERGİLERİ 2025.rar** | RAR — PDF + LNK + XLSX | 2025 dönem 1-2 borç dökümleri (Bakırköy 5 sicil + Fatih 3 mükellef + Yalova + Bayrampaşa) | 10. Emlak Vergisi & Mülk | Sicil, Şahıs, Belge | **Yüksek** | Aynı | Aynı | Orta |
| 4 | **EV ABONELİKLERİ ALBARAKA OTOMATİK ÖDEMELER.xlsx** | Excel — meta sheet + 5 kişi/mülk tab × ay matrisi | Şahıslar (Mehmet Rahim, Mehmet Ali, Ali, Test, Kaan + RENK APT) için ev/elektrik/internet/su/aidat otomatik ödemeleri | 8. Ev/Şahıs Otomatik Ödeme · 5. Otomatik Ödemeler · 7. Abonelik & Taahhüt | Hesap No, Hizmet No, Tesisat No, Hizmet Tipi, Telefon, Kurum, Açıklama, Banka, Paket Tutar, Paket Tipi, Taahhüt Bitiş Tarihi, OCAK..ARALIK (Son Ödeme Tarihi & Tutar) | Orta | İki adımlı: (a) ABONELIKLER sheet → master abonelik kaydı, (b) Kişi sheet'leri → aylık ödeme satırları | "X" işaretli satırlar (iptal), boş tutar, taahhüt tarihi | **YÜKSEK** — temel iş |
| 5 | **PAPİNET.rar** | RAR — PDF faturalar + Excel + sözleşmeler | Papinet, EDM, ETA entegratör/kontör faturaları (Enerji, ETA, KC, MDT, Beta Tekstil), yıllık sözleşme PDF'leri (defter saklama, e-fatura, e-irsaliye) | 14. ETA/Papinet/EDM/Kontör · 3. PDF Fatura Import | Tarih, Şirket, Belge Tipi (sözleşme/fatura), Dosya | Yüksek | Önce klasör/şirket map'le, sonra PDF metadata; kontör eşik takibi ayrı | Sözleşme bitişi, kontör bakiyesi, ödeme durumu | Orta-Yüksek |
| 6 | **SITEX.rar** | RAR — büyük arşiv (277 dosya): aylık ekstre PDF'leri (B2.28, B3.31, A4.17/22/25), aidat bildirim yazıları, denetim raporu, bütçe PDF'leri, "Aidat Farkları" Excel | SiteX sitesi 5 daire (A4.17, A4.22, A4.25, B2.28, B3.31) için 2024-01 → 2026-04 ekstreleri | 9. SiteX Aidat ve Gider · 18. Import Merkezi · 11/12. Belge arşivi | Daire kodu, Yıl-Ay, PDF (ekstre), Aidat tutarı, Gider tutarı, Aidat farkı, Denetim/bütçe belgeleri | **Çok Yüksek** | Klasör+dosyaadı parse → daire+ay; PDF body OCR/parse 2. fazda | Aidat farkı doğrulaması, eksik ay tespiti | **YÜKSEK** — düzenli aylık iş |
| 7 | **ŞAHISLAR OTOMATİK ÖDEME.xlsx** | Excel — 2026 versiyonu, 5 şahıs tab | EV ABONELİKLERİ'nin 2026 yıl sürümü; aynı yapı | 8. Ev/Şahıs Otomatik Ödeme | Aynı (4) ile | Düşük (yapı 4 ile aynı) | 4 ile aynı pipeline; sadece YIL parametresi farklı | "X" iptal işaretleri | **YÜKSEK** |
| 8 | **ŞİRKET ABONELİKLERİ ACME ENERJI ACME TEKSTIL BETA.xlsx** | Excel — 2 sheet | Acme Enerji (Yeniçe HES, Kısık), Acme Tekstil, Beta, MakYapı, MDT, KC İplik için TTNet/TT/Turkcell internet, telefon, fax, ISDN, GSM hatları + paket tutar + taahhüt bitiş | 7. Abonelik & Taahhüt · 14. Entegratör/Kontör | Hesap No, Hizmet No, Kurum, Firma, Kime Ait, Ödeme Durumu, Paket Tutar, Paket Tipi, Taahhüt Bitiş, Adres, Yetkili | Düşük | Master abonelik tablosuna direkt dönüş | Taahhüt bitiş, "X" iptaller, "İPTAL DİLEKÇESİ VERİLDİ" notları | **YÜKSEK** |
| 9 | **İTO aidat ödeme çizlegesi.xlsx** | Excel — yıl bazlı sheet (2022, 2023, 2025) | Şirket bazlı İTO oda aidatı 2 taksit (Haziran/Ekim) takibi | 13. Resmi Ödemeler / İTO · 4. Ödeme Takip | Sicil No, Firma Ünvanı, Tutar, 1. Taksit (ödenen tutar/durum/tarih), 2. Taksit | Düşük | Yıl × Şirket × Taksit long-format | "TAMAMI ÖDENDİ" gibi metin işaretleri, sicil no | Orta |
| 10 | **ÖDEMELER OTOMATİKLER VE ELDEN YAPILANLAR.xlsx** | Excel — 8 sheet: Beta Tekstil, Acme Tekstil, Acme Enerji, Boğaziçi-Makyapı, KC İplik, MDT, Sayfa1, Sayfa2 | 2026 yılı için şirket bazlı tüm faturalar (telefon, internet, çardak aidat, vs.) Son Ödeme & Tutar matrisi | 4. Ödeme Takip · 6. Elden/EFT/Kart Ayrımı · 12. Düzenli Ödemeler | Şirket sheet'i, Fatura/Hizmet Tanımı, OCAK..ARALIK Son Ödeme & Tutar | Orta | Sheet→Şirket eşleme tablosu (manuel onay), satır→hizmet/fatura, ay→dönem | Sheet adı normalizasyonu, "ELDEN" işaretli satırlar | **YÜKSEK** |
| 11 | **ÖDEMELER TAKİP ÇİZELGESİ GENEL ÖDEMELER.xlsx** | Excel — 9 sheet: 2020, 2021, 2022, 2023, 2025, 2026, BAĞKUR ÖDEME, EMLAK VERGİSİ, KİRA FİYATI | KİRALAR (Acme Tekstil, Beta Merkez, Beta Otel, Acme Enerji, KC Enerji), Bağkur, emlak özet — yıllar arası tarihçe (2020-2026) | 12. Düzenli Ödemeler / Kira · 4. Ödeme Takip · Tarihsel arşiv | Yıl, Kategori (KİRALAR), Şirket, Tutar, OCAK..ARALIK ödeme tarihleri | Orta | Yıl bazında kategori×kayıt×ay long-format. Kira ayrı submodule | "."  ile işaretli boş hücreler, kira artışı (yıl bazlı tutar farkı) | Orta |
| 12 | **TEMİNAT MEKTUPLARI TAKİP LİSTESİ ACME ENERJI BANKA1 BANKA2.xlsx** | Excel — 4 sheet (Acme Enerji, Beta Tekstil, Acme Tekstil, "16000 TL EPİAŞ-TEİAŞ") | Banka, TM tarihi, Mektup No, Mektup Tipi, Hangi Kuruma, KISIK/YENİCE HES, Tutar, Komisyon Oranı, Komisyon Tutarı (Yıllık/Aylık), 1 Aylık ödeme tarihi, 3 Aylık ödeme tarihi, "İADE OLDU" notu | 11. Teminat Mektupları | Banka, Mektup No, Tarih, Tutar, Komisyon, Periyodik ödeme tarihleri, İade durumu | Yüksek | Heterojen sheet yapıları → her şirket için ayrı parse + standart TeminatMektubu modeli | Komisyon dönemi (aylık/3 aylık), iade durumu, mektup tipi (fiziki/elektronik) | **YÜKSEK** — kritik finansal |

---

## 3. ARŞİV İÇERİK ÖZETLERİ

### 3.1 EMLAK VERGİLERİ 2024.rar (34 entry)
- **2 dönem klasörü:** `1.DÖNEM`, `2.DÖNEM`
- **Belediye dağılımı:** Bakırköy (5 mükellef PDF), Fatih (3 mükellef PDF+XLSX), Beyoğlu (Makyapı + şahsi MRK), Esenyurt (PDF+JPG), Manisa-Şehzadeler, Yalova-Termal, Bayrampaşa Mega Center
- **Format çeşitliliği:** PDF, JPG, JPEG, XLSX karışık → OCR + manuel girdi gerekecek

### 3.2 EMLAK VERGİLERİ 2025.rar (~14 entry)
- Bakırköy 5 sicil borç dökümü (Test, Kaan, Mehmet Ali, Mehmet, Ali Acme)
- Fatih 3 mükellef Excel + Yalova + Bayrampaşa makbuzları
- Sicil numaraları net (348873, 349102, 95936, 95937, 95938)

### 3.3 PAPİNET.rar (65 entry)
- **Klasör yapısı:** `PAPİNET\ENERJİ PAPİNET`, `\ETA PAPİNET`, `\KC`, `\MDT`, `\BETA BRODE PAPİNET`, ayrıca `YILLIK SÖZLEŞMELER\` (defter saklama, e-fatura, e-irsaliye 2019-2021)
- **Belge tipleri:** PDF faturalar (PPE2024…, PPE2025… numaralı + tarihli), XLSX (E-fatura/e-irsaliye listesi, EDM kontör kampanya, sözleşme son tarihler)
- **Ana sözleşme:** "EDM DİGİTAL PLANET SÖZLEŞME SON TARİHLERİ VE PAKETLER.xlsx" — kontör kampanya bilgileri kritik

### 3.4 SITEX.rar (277 entry — en büyük arşiv)
- **Yapı:** `PRUVA\YYYY-MM\<DAIRE>.pdf`
- **Daireler:** A4.17, A4.22, A4.25, B2.28, B3.31 (5 daire)
- **Aylık dosya tipi:** Daire kodu + ".pdf" (ekstre) ve "<daire> AİDAT BİLDİRİM YAZISI.pdf" (bildirim)
- **Yıllık belgeler:** İşletme maliyetleri, denetim raporu, ek bütçe, avans işletme bütçesi (Türkçe ve İngilizce)
- **Dönem kapsamı:** 2024-01 → 2026-04 (aktif) + ESKİ EKSTRELER alt klasörü
- **Diğer:** "AİDAT FARKLARI - ŞAHISLARA YATAN PARALAR.xlsx" — manuel mutabakat tablosu

---

## 4. DOSYA TİPİ DAĞILIMI

| Tip | Adet | Önerilen Pipeline |
|---|---|---|
| .xlsx | 9 | openpyxl ile sheet→model unpivot |
| .rar | 4 | Önce extract → klasör/dosyaadı parse → sonra opsiyonel PDF parse/OCR |
| .pdf (RAR içinde) | ~250+ | Metadata önce; içerik OCR sonra (Faz 2-3) |
| .jpg/.jpeg | ~10 | Sadece belge eki olarak kayıt; OCR opsiyonel |
| .doc | 1 | SiteX yetki belgesi — sadece dosya eki |
| .lnk | 1 | Yoksay |
| ~$*.xlsx | 1 | Office geçici dosyası — yoksay |

---

## 5. YÜKSEK SEVİYE BULGULAR

1. **Tüm Excel'ler matris (kişi×ay / şirket×ay) formatında** — long-format'a "unpivot" zorunlu. Sistem ekranı bu matrisi taklit etmemeli; tablo backend'de `(kayit_id, donem_yyyymm, son_odeme_tarihi, tutar, durum)` olmalı.
2. **5 ana mülk sahibi/şahıs:** Mehmet Rahim Acme, Mehmet Ali Acme, Ali Acme, Test Kullanıcı, Kaan Acme (+ Tal'in, Mehriban, Meliha, Semra Aydar BAĞKUR'da).
3. **Şirket grubu:** Acme Enerji (Yeniçe HES, Kısık), Acme Tekstil, Beta Tekstil, KC İplik, MakYapı, MDT, FMK, Beta Otel.
4. **Kira tutar değişimi yıllık** — kira_fiyati history tablosu gerekli.
5. **SiteX her ay 5 daire × 2 belge** = ~10 PDF/ay düzenli akış. Bu modül için klasör import + dropbox/folder watcher gelecekte gerekli.
6. **Teminat mektubu** sheet yapıları çok heterojen — sheet bazlı ayrı parser yazılacak, sonra ortak modele yazılacak.
7. **"X" işareti** EV ABONELİKLERİ'nde "iptal/uygulanmaz" anlamında kullanılmış — boolean iptal flagi olarak yorumlanacak.
8. **"ELDEN" / "ALBARAKA TALİMAT" / "BANKA EFT" / "KREDİ KARTI"** işaretleri ödeme yöntemini gösterir — `OdemeYontemi` enum'ı zorunlu.
9. **PDF'ler doğrudan kesin kayıt yaratmamalı** — ImportBatch → ImportDraft → kullanıcı onayı → kesin kayıt.

---
