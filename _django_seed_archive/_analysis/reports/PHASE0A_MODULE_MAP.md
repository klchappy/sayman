# FAZ 0A — MODÜL HARİTASI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 0A — Modül Mimarisi Önerisi (read-only)
**Tarih:** 2026-05-05

> Bu dokümanda 21 modülün her biri için iş amacı, veri kaynağı bağlantısı, ana ekranlar, modeller, otomatik bildirim/görev kuralları, MVP önceliği ve zorluk seviyesi tanımlanır.

---

## A. MODÜL ÖNCELİK MATRİSİ (özet)

| Sıra | Modül | MVP | Zorluk | Bağımlılık |
|---|---|---|---|---|
| 1 | Yetki & Kullanıcı (#21) | **MVP-1** | Düşük | — |
| 2 | Dashboard (#1) | **MVP-1** | Orta | Tüm modüller (read) |
| 3 | Ödeme Takip (#4) | **MVP-1** | Orta | Fatura, Abonelik |
| 4 | Fatura Takip (#2) | **MVP-1** | Orta | — |
| 5 | Abonelik & Taahhüt (#7) | **MVP-1** | Orta | Fatura |
| 6 | Otomatik Ödemeler (#5) | **MVP-1** | Düşük | Ödeme |
| 7 | Ev/Şahıs Otomatik (#8) | **MVP-1** | Düşük | Otomatik |
| 8 | SiteX (#9) | **MVP-1** | Yüksek | Mülk |
| 9 | Emlak Vergisi (#10) | **MVP-1** | Yüksek | Mülk |
| 10 | Teminat Mektupları (#11) | **MVP-1** | Yüksek | — |
| 11 | Resmi Ödemeler (#13) | **MVP-1** | Orta | Ödeme |
| 12 | Düzenli Ödemeler / Kira (#12) | **MVP-1** | Orta | — |
| 13 | Ajanda & Görev (#15) | **MVP-1** | Orta | Tüm |
| 14 | Bildirim Merkezi (#17) | **MVP-1** | Orta | — |
| 15 | Import Merkezi (#18) | **MVP-1** | Yüksek | Tüm |
| 16 | AuditLog (#20) | **MVP-1** | Düşük | Tüm |
| 17 | PDF Fatura Import (#3) | **MVP-2** | Çok Yüksek | Import |
| 18 | Elden/EFT/Kart Ayrımı (#6) | **MVP-2** | Düşük | Ödeme |
| 19 | ETA/Papinet/Entegratör (#14) | **MVP-2** | Yüksek | Abonelik |
| 20 | Raporlama / Excel Export (#19) | **MVP-2** | Orta | Tüm |
| 21 | Kurumsal Chat (#16) | **MVP-3** | Yüksek | Yetki |

---

## B. MODÜL DETAYLARI

### 1) Dashboard / Muhasebe Operasyon Merkezi
- **Amaç:** Bugün/bu hafta/bu ay neler yapılması gerektiğini tek ekrandan göstermek.
- **Veri Kaynağı:** Tüm modüllerden read-only kart/widget.
- **Ekranlar:** Ana dashboard, Bugünkü işler, Geciken işler, Yaklaşan ödemeler, Eksik dekont, Kontör eşik altı, Sözleşme bitişi yaklaşanlar, Import bekleyenler.
- **Modeller:** (yok — read-only) — `DashboardWidget`, `WidgetTercih` (kişiselleştirme).
- **Bildirim/Görev:** Yok (display layer).
- **MVP:** MVP-1 / Orta zorluk.

### 2) Fatura Takip
- **Amaç:** Şirket ve şahıs faturalarını dönem bazında takip.
- **Veri Kaynağı:** Şirket Abonelikleri, Ev Abonelikleri, Ödemeler Çizelgeleri, PAPİNET PDF'leri.
- **Ekranlar:** Fatura listesi (filtre: şirket/dönem/durum), Fatura detay, Fatura ekle/düzenle, Fatura → ödeme bağlama.
- **Modeller:** `Fatura`, `FaturaKalemi`, `FaturaBelgesi`.
- **Bildirim/Görev:** Son ödeme tarihi T-7, T-3, T-1, T+0 (geciken).
- **MVP:** MVP-1 / Orta.

### 3) PDF Fatura Import
- **Amaç:** Papinet/EDM/elektrik/su PDF'lerinden otomatik metadata çıkartma.
- **Veri Kaynağı:** PAPİNET.rar, gelecek PDF'ler.
- **Ekranlar:** PDF yükleme, Çıkarılan alan ön izleme, Onay/red, Hatalı OCR düzeltme.
- **Modeller:** `ImportBatch`, `ImportDraft`, `ImportLog`, `BelgeOCRSonuc`.
- **Bildirim/Görev:** OCR güven skoru < eşik → manuel kontrol görevi.
- **MVP:** MVP-2 / Çok Yüksek zorluk (önce manuel yükleme + metadata, OCR sonra).

### 4) Ödeme Takip
- **Amaç:** Tüm ödeme kalemlerini (otomatik/elden/EFT/kart) tek tabloda görme.
- **Veri Kaynağı:** Tüm ödeme kaynaklı Excel'ler.
- **Ekranlar:** Ödeme listesi, Ay görünümü (matris), Kişi/şirket bazlı, Eksik dekont uyarı, Ödeme detay.
- **Modeller:** `Odeme`, `OdemeYontemi` (enum), `OdemeBelgesi` (dekont), `OdemeMutabakat`.
- **Bildirim/Görev:** Eksik dekont, Ödeme onayı bekleyen, Tutar tutmayan satır.
- **MVP:** MVP-1 / Orta.

### 5) Otomatik Ödemeler
- **Amaç:** Banka talimatıyla otomatik kesilen ödemeleri ayrı izlemek (Albaraka talimat etiketi vs.).
- **Veri Kaynağı:** EV ABONELİKLERİ, ŞİRKET ABONELİKLERİ, ŞAHISLAR OTOMATİK ÖDEME.
- **Ekranlar:** Otomatik talimat listesi, Banka bazlı görünüm, Talimat iptal işareti, Aylık otomatik akış.
- **Modeller:** `OtomatikOdemeTalimati` (Abonelik'e bağlı), `BankaTalimatHareket`.
- **Bildirim/Görev:** Banka iptal/eksik tahsilat, Talimat değişikliği.
- **MVP:** MVP-1 / Düşük.

### 6) Elden / EFT / Kredi Kartı Ödemeleri
- **Amaç:** Manuel ödenen kalemleri ayrı kategoride raporlama.
- **Veri Kaynağı:** ÖDEMELER OTOMATİKLER VE ELDEN.
- **Ekranlar:** Ödeme yöntemi filtreli liste, "Elden" görev oluşturma, Dekont yükleme.
- **Modeller:** `Odeme.yontem` enum (OTOMATIK/ELDEN/EFT/KREDI_KARTI/HAVALE/NAKIT).
- **Bildirim/Görev:** "Elden ödenecek" → kullanıcı atanmış görev.
- **MVP:** MVP-2 / Düşük (Ödeme Takip alt fonksiyonu).

### 7) Abonelik & Taahhüt Takip
- **Amaç:** Tüm internet/telefon/elektrik/su/doğalgaz aboneliklerini ve taahhüt bitişlerini izlemek.
- **Veri Kaynağı:** ŞİRKET ABONELİKLERİ, EV ABONELİKLERİ.
- **Ekranlar:** Abonelik listesi, Taahhüt bitiş takvimi, Kampanya pakettipi, İptal süreç ekranı, Taahhüt yenileme.
- **Modeller:** `Abonelik`, `Taahhut`, `Kampanya`, `IptalSureci`.
- **Bildirim/Görev:** Taahhüt bitişi T-60, T-30, T-15, T-7. Yeni paket teklifi görevi.
- **MVP:** MVP-1 / Orta.

### 8) Ev / Şahıs Otomatik Ödemeleri
- **Amaç:** Şahıs ve ev mülklerinin otomatik ödeme akışı (Aile bireyleri için).
- **Veri Kaynağı:** EV ABONELİKLERİ, ŞAHISLAR OTOMATİK ÖDEME.
- **Ekranlar:** Şahıs bazlı görünüm, Mülk bazlı görünüm, Ay matrisi (gösterim), Yıl karşılaştırma.
- **Modeller:** `Sahis`, `Mulk`, `Abonelik`, `Odeme` (5+7 üzerine view).
- **Bildirim/Görev:** Modül #5/#7'den miras.
- **MVP:** MVP-1 / Düşük.

### 9) SiteX Aidat ve Gider Takibi
- **Amaç:** 5 daire için aylık aidat + giderlerin ekstre & ödeme takibi.
- **Veri Kaynağı:** SITEX.rar (PDF ekstreler), EV ABONELİKLERİ Test/Kaan/Ali/Mehmet Ali sayfaları, ÖDEMELER OTOMATİKLER (Aidat satırları).
- **Ekranlar:** Daire listesi, Daire detayı (yıl-ay timeline), Ekstre PDF görüntüleyici, Aidat farkı tablosu, Yıllık bütçe/denetim arşiv, Genel kurul belge arşivi.
- **Modeller:** `SiteXDaire`, `SiteXEkstre` (yıl-ay-daire-belge), `SiteXAidat`, `SiteXGider`, `SiteXAidatFarki`, `SiteXYillikBelge` (denetim/bütçe).
- **Bildirim/Görev:** Her ay 20'sinde ödeme görevi, Ekstre PDF eksikse uyarı, Aidat farkı varsa kontrol görevi.
- **MVP:** MVP-1 / Yüksek.

### 10) Emlak Vergisi & Mülk Takip
- **Amaç:** Tüm mülk ve gayrimenkullerin yıl × dönem (1/2) emlak vergisi takibi.
- **Veri Kaynağı:** EMLAK VERGİLERİ 2024.rar, 2025.rar, ÖDEMELER TAKİP ÇİZELGESİ "EMLAK VERGİSİ" sheet.
- **Ekranlar:** Mülk listesi, Mülk detayı (yıl/dönem grid), Belge yükleme, Belediye bazlı filtre, Ödeme durumu işaretleme.
- **Modeller:** `Mulk`, `MulkSahibi`, `EmlakVergisi` (yıl, donem, mulk, tutar, durum), `EmlakBelgesi`.
- **Bildirim/Görev:** 1. taksit Mayıs sonu, 2. taksit Kasım sonu hatırlatma. Belge eksikse görev.
- **MVP:** MVP-1 / Yüksek.

### 11) Teminat Mektupları
- **Amaç:** Bankalardan alınan teminat mektupları + komisyon ödemeleri takibi.
- **Veri Kaynağı:** TEMİNAT MEKTUPLARI TAKİP LİSTESİ.
- **Ekranlar:** Mektup listesi (aktif/iade), Mektup detay, Komisyon takvimi (1A/3A periyodu), İade işlemi, Banka bazlı görünüm.
- **Modeller:** `TeminatMektubu`, `TeminatKomisyonOdemesi`, `TeminatIade`.
- **Bildirim/Görev:** Komisyon ödeme tarihi T-7/T-1, Mektup süresi yaklaşıyor, İade sonrası kapatma.
- **MVP:** MVP-1 / Yüksek.

### 12) Muhasebe Düzenli Ödemeler (Kira vb.)
- **Amaç:** Şirketler arası kira, sabit gider gibi periyodik kalemler.
- **Veri Kaynağı:** ÖDEMELER TAKİP ÇİZELGESİ (KİRALAR sheet'leri 2020-2026, KİRA FİYATI sheet).
- **Ekranlar:** Kira sözleşme listesi, Kira artış geçmişi, Aylık ödeme matrisi.
- **Modeller:** `KiraSozlesmesi`, `KiraDonemTutar`, `KiraOdeme`.
- **Bildirim/Görev:** Aylık kira tarihi T-3, Yıl başı kira artışı kontrol görevi.
- **MVP:** MVP-1 / Orta.

### 13) Resmi Ödemeler / Vergi / İTO / BAĞKUR / SSK / BES
- **Amaç:** Resmi kurumlara yapılan periyodik ödemeler.
- **Veri Kaynağı:** BAĞKUR ÖDEMELERİ, İTO aidat, ÖDEMELER TAKİP "BAĞKUR ÖDEME" sheet.
- **Ekranlar:** Tip bazlı liste (BAĞKUR/SSK/BES/İTO), Şahıs/şirket × dönem grid, Kurum bazlı filtreleme.
- **Modeller:** `ResmiOdeme`, `ResmiOdemeTipi` (enum), `ResmiOdemeDonemi`.
- **Bildirim/Görev:** BAĞKUR aylık (her ayın son günü), İTO 1.taksit Haziran / 2.taksit Ekim, SSK aylık.
- **MVP:** MVP-1 / Orta.

### 14) ETA / Papinet / EDM / Entegratör / Kontör Takip
- **Amaç:** E-fatura entegratör sözleşmeleri ve kontör bakiyesi izleme.
- **Veri Kaynağı:** PAPİNET.rar (sözleşmeler, kontör kampanya XLSX, faturalar).
- **Ekranlar:** Entegratör listesi, Şirket × entegratör matrisi, Kontör bakiye, Sözleşme bitiş takvimi, Kontör kampanya, Fatura arşivi.
- **Modeller:** `Entegrator`, `EntegratorSozlesme`, `KontorBakiye`, `KontorHareket`, `KontorKampanya`.
- **Bildirim/Görev:** Sözleşme bitişi T-60, Kontör eşik altı (örn. <500), Yıllık yenileme görevi.
- **MVP:** MVP-2 / Yüksek.

### 15) Ajanda & Görev Yönetimi
- **Amaç:** Kullanıcı bazlı görev atama ve takvim.
- **Veri Kaynağı:** Sistem içi (otomatik üretim + manuel).
- **Ekranlar:** Bugünkü işler, Haftalık takvim, Aylık takvim, Kişi bazlı görev, Geciken görevler, Görev detay (yorum/dosya/erteleme/tamamlama).
- **Modeller:** `Gorev`, `GorevYorumu`, `GorevEki`, `GorevGecmisi`, `GorevSablonu` (otomatik üretim için).
- **Bildirim/Görev:** Atama bildirimi, Yaklaşan deadline, Geciken görev günlük özet.
- **MVP:** MVP-1 / Orta.

### 16) Kurumsal Chat / Mesajlaşma Widget
- **Amaç:** Görev/ödeme/fatura/SiteX ekstresi/teminat bağlamında konuşma.
- **Veri Kaynağı:** Sistem içi.
- **Ekranlar:** Sağ alt widget, Mesaj merkezi tam ekran, Birebir, Grup, Kayıt-bağlantılı thread.
- **Modeller:** `ChatThread`, `ChatMessage`, `ChatParticipant`, `ChatOkundu`, `ChatEki`.
- **Bildirim/Görev:** Yeni mesaj rozeti, Mention bildirimi.
- **MVP:** MVP-3 / Yüksek.

### 17) Bildirim / Telegram Merkezi
- **Amaç:** Tüm modüllerin bildirimlerini standardize gönderim.
- **Ekranlar:** Bildirim ayarları, Telegram dry-run, Telegram test, Gönderim geçmişi, Şablon yönetimi.
- **Modeller:** `Bildirim`, `BildirimKanali`, `NotificationLog`, `TelegramKonfig`, `TelegramGonderim`.
- **Bildirim akışı:** Sistem içi → NotificationLog → Telegram dry-run → Telegram test → Gerçek gönderim (sıralı).
- **MVP:** MVP-1 / Orta.

### 18) Import Merkezi
- **Amaç:** Excel/PDF/RAR/klasör import → ön izleme → onay → kesin kayıt.
- **Ekranlar:** Yeni import, Mapping ekranı, Ön izleme tablosu, Hata listesi, Onay, ImportBatch geçmişi.
- **Modeller:** `ImportBatch`, `ImportDraft`, `ImportLog`, `ImportMapping`, `ImportHata`.
- **Kural:** Hiçbir import doğrudan kesin kayıt yaratmaz.
- **MVP:** MVP-1 / Yüksek.

### 19) Raporlama / Excel Export
- **Amaç:** Tüm modüllerden filtreli rapor ve Excel çıktı.
- **Ekranlar:** Rapor seçici, Filtreler, Önizleme, Excel/PDF export, Zamanlanmış rapor.
- **Modeller:** `RaporSablonu`, `RaporCalistirma`.
- **MVP:** MVP-2 / Orta.

### 20) AuditLog / İşlem Geçmişi
- **Amaç:** Tüm değişikliklerin kim/ne/ne zaman log'u.
- **Modeller:** `AuditLog` (kullanici, model, kayit_id, eylem, eski_deger_json, yeni_deger_json, zaman, ip).
- **Ekranlar:** Genel log, Kayıt bazlı zaman çizelgesi, Filtre.
- **MVP:** MVP-1 / Düşük.

### 21) Yetki ve Kullanıcı Yönetimi
- **Amaç:** Rol bazlı erişim kontrolü.
- **Roller:** Super Admin, Yönetici, Muhasebe Müdürü, Muhasebeci (Ayşe, Erdal, Melek), Read-Only.
- **Modeller:** Django built-in `User` + `Grup`, `Rol`, `Yetki`, `KullaniciTercih`.
- **MVP:** MVP-1 / Düşük (her şeyden önce gelmeli).

---
