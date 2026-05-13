# MASTER PROJE ANAYASASI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Sürüm:** 1.0 (Faz 0B çıktısı)
**Tarih:** 2026-05-05
**Durum:** ONAYLANMIŞ TASARIM REFERANSI — sonraki tüm fazların ana referansıdır.

> Bu doküman, sonraki tüm fazların (0C, 0D, 1, 2, …, 14) bağlayıcı referans dokümanıdır. Anayasa maddelerine aykırı değişiklik için resmi karar deftere işlenmelidir (`PHASE0B_DECISION_REGISTER.md`).

---

## MADDE 1 — PROJE KİMLİĞİ

### 1.1 Proje Adı
**MUHASEBE OPERASYON SİSTEMİ**

### 1.2 Kısa Amaç
Acme şirketler grubu ve Aile bireyleri şahıs/ev/mülklerine ait muhasebe ve finans operasyonlarını **tek çatıdan** yönetmek. Sistem **sadece bir hatırlatıcı/fatura takip değildir**; muhasebe ekibinin günlük operasyon merkezidir.

### 1.3 Kapsam (IN-SCOPE)
- Şirket ve şahıs faturaları (oluşturma, takip, ödeme bağlama)
- Ödemeler ve ödeme yöntemi ayrımı (otomatik / elden / EFT / kredi kartı / havale / nakit)
- Abonelik ve taahhüt takibi (kampanya bitişi, paket yönetimi)
- SiteX sitesi 5 daire için aidat/gider/ekstre/yıllık belge yönetimi
- Emlak vergisi & mülk takibi (yıl × dönem × belediye)
- Teminat mektupları ve komisyon ödemeleri
- BAĞKUR / SSK / BES / İTO / vergi ödemeleri
- ETA / Papinet / EDM entegratör sözleşmeleri ve kontör takibi
- Kira sözleşmeleri ve aylık kira ödemeleri
- Ajanda & görev yönetimi (kullanıcı bazlı atama)
- Widget'lı kurumsal chat (kayıt-bağlantılı)
- Bildirim merkezi (sistem içi + Telegram)
- Import merkezi (Excel / PDF / RAR / klasör — taslak/onay akışı)
- Raporlama ve Excel/PDF export
- AuditLog ve NotificationLog
- Yetki ve kullanıcı yönetimi

### 1.4 Kapsam Dışı (OUT-OF-SCOPE)
- Şirket genel muhasebesi (Logo/Mikro vb. yerine geçmez)
- Bordro / personel maaş hesaplama
- Tedarikçi/müşteri CRM yönetimi
- Stok / envanter yönetimi (ayrı **Envanter Sistemi** projesi)
- Araç takip (ayrı **Araç Takip Sistemi** projesi)
- Enerji üretim/işletim verisi (ayrı **Acme Enerji İşletim Sistemi** projesi)
- E-fatura/e-arşiv kesme (entegratör tarafı)
- Banka API entegrasyonu (MVP-1'de manuel, sonraki fazda değerlendirilir)
- Vergi beyannamesi hazırlama
- Mobil native uygulama (web responsive yeterli; native sonra)

### 1.5 Diğer Projelerden İzolasyon Kuralı
**KESİN:** Bu proje aşağıdaki projelerden tamamen izoledir.
- Acme Enerji İşletim Sistemi
- Araç Takip Sistemi
- Envanter Sistemi

İzolasyon ilkeleri:
- Ayrı klasör (`C:\Users\lenovo\Desktop\muhasebe-operasyon-seed\`)
- Ayrı git repo
- Ayrı Django projesi
- Ayrı veritabanı
- Ayrı sunucu/VPS önerilir; minimum ayrı DB schema zorunlu
- Diğer projelerin klasörlerine **dokunulmaz**
- Ortak kullanıcı (SSO) gelecekte ayrı bir entegrasyon kararıyla değerlendirilir

### 1.6 Ana Kullanıcı Grupları
- **Yönetim:** Yönetici, Muhasebe Müdürü
- **Operasyon:** Muhasebeci Ayşe, Erdal, Melek (genişlemeye açık)
- **Sistem:** Super Admin
- **Pasif:** Salt görüntüleyici (denetçi, mali müşavir vb.)

### 1.7 Hedef Kullanım Senaryosu
Her sabah muhasebeci dashboard'a girer → bugünün görevlerini görür → fatura/ödeme/SiteX ekstre/teminat komisyonu vb. kalemleri işaretler → dekontu yükler → bağlı görevler kapanır → AuditLog yazılır → günün sonunda yöneticiye Telegram özeti gider.

---

## MADDE 2 — ANA VİZYON

> **MUHASEBE OPERASYON SİSTEMİ sadece bir fatura takip aracı değildir; Acme grubu muhasebe ve finans ekibinin günlük operasyon merkezidir.**

Sistem aşağıdaki tüm operasyonları **tek çatı altında** yürütür:
- Şirket ve şahıs faturaları
- Ödemeler (otomatik / elden / EFT / kredi kartı / havale / nakit ayrımı)
- Abonelik ve taahhütler
- SiteX aidat / gider / ekstre / site yönetimi belgeleri
- Emlak vergileri
- Teminat mektupları
- BAĞKUR / SSK / BES / İTO / resmi ödemeler
- ETA / Papinet / EDM entegratör ve kontör takipleri
- Kira ödemeleri ve sözleşmeleri
- Ajanda & görev yönetimi
- Widget'lı kurumsal chat
- Telegram + dashboard bildirimleri
- Import ön izleme/onay süreçleri
- AuditLog / NotificationLog
- Raporlama ve Excel export

Her kayıt, görev, mesaj ve belge **birbirine bağlanabilir**; sistem bir kaydın etrafında konuşma, görev, dosya ve geçmişin birleştiği bir context oluşturur.

---

## MADDE 3 — TEMEL TASARIM PRENSİPLERİ (ANAYASA MADDELERİ)

| # | Prensip | Bağlayıcılık |
|---|---|---|
| 3.1 | Excel görüntüsü birebir kopyalanmaz. | KESİN |
| 3.2 | Excel/RAR/PDF kaynakları profesyonel **normalize veri modeline** dönüştürülür (long-format). | KESİN |
| 3.3 | Her import önce **taslak/ön izleme** ekranına düşer. | KESİN |
| 3.4 | Kullanıcı onayı olmadan **kesin kayıt oluşmaz**. | KESİN |
| 3.5 | Her kritik işlem **AuditLog'a** yazılır. | KESİN |
| 3.6 | Her sistem uyarısı **NotificationLog** ile izlenir. | KESİN |
| 3.7 | Telegram **gerçek gönderimi** en son ayrı onay kapısıyla açılır (3 aşamalı: dry-run → test → gerçek). | KESİN |
| 3.8 | **Fiziksel silme yasaktır.** İptal/pasif/arşiv kullanılır (Super Admin için kontrollü hard-delete istisnası). | KESİN |
| 3.9 | Görev, chat, belge, ödeme ve kayıtlar **birbirine bağlanabilir** (polimorfik). | KESİN |
| 3.10 | **Mobil uyum baştan zorunludur** (responsive web). | KESİN |
| 3.11 | Claude Design çıktısı **kodlamadan önce** alınır (Faz 0C). | KESİN |
| 3.12 | UI **profesyonel, sade, kart tabanlı, kurumsal** olur. | KESİN |
| 3.13 | **Dark mode istenmiyor.** Sadece açık (light) tema. | KESİN |
| 3.14 | Proje diğer Acme projelerinden **izole** yürütülür. | KESİN |
| 3.15 | Tarih formatı `dd.MM.yyyy`, para `₺ 1.234,56`, yerel TR. | KESİN |
| 3.16 | Tüm dönemsel veriler `yyyymm` veya `(yil, donem)` long-format. Ay matrisi sadece view layer. | KESİN |
| 3.17 | Belge silme yok; "iptal" işareti ve arşiv klasörü. | KESİN |
| 3.18 | Tüm dosyalar `Belge` modeline bağlanır (sha256 + boyut + tip). | KESİN |
| 3.19 | KVKK uyumu: TC No ve şahsi bilgiler audit log'da maskelenir. | KESİN |
| 3.20 | Yedekleme: günlük DB dump + haftalık dosya snapshot. | KESİN |

---

## MADDE 4 — KULLANICI VE ROL YAPISI

### 4.1 Roller

| Rol | Ana Sorumluluk |
|---|---|
| **Super Admin** | Sistem yönetimi, yetki atama, kullanıcı oluşturma, restore/rollback, hard-delete istisnası |
| **Yönetici** | Tüm modülleri görür, raporları çeker, son onay kapısı |
| **Muhasebe Müdürü** | Tüm operasyon modüllerini yönetir, görev atar, import onaylar |
| **Muhasebeci** | Atanan modüllerde kayıt giriş/düzenleme, ödeme işaretleme, dekont yükleme |
| **Personel** | Kendisine atanan görevleri görür, sınırlı kayıt erişimi |
| **Salt Görüntüleyici** | Read-only erişim, rapor görür, export edebilir/edemez (kararlanacak) |

### 4.2 Örnek Kullanıcılar

| Kullanıcı | Önerilen Rol |
|---|---|
| Super Admin | Super Admin |
| Yönetici | Yönetici |
| Muhasebe Müdürü | Muhasebe Müdürü |
| Ayşe | Muhasebeci |
| Erdal | Muhasebeci |
| Melek | Muhasebeci |
| (gelecek) Mali Müşavir | Salt Görüntüleyici |

### 4.3 Yetki Matrisi

| Yetki / Rol | Super Admin | Yönetici | Muh. Müdürü | Muhasebeci | Personel | Görüntüleyici |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Tüm modüller görüntüleme | ✅ | ✅ | ✅ | Atananlar | Atanan görevler | ✅ |
| Kayıt ekleme | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Kayıt düzenleme | ✅ | ✅ | ✅ | Kendi/atanan | ⛔ | ⛔ |
| Kayıt iptal/arşiv | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Hard-delete | ✅ (denetim altında) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Ödeme işaretleme | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Ödeme nihai onayı | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Import yükleme | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Import **onaylama** (commit) | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Görev atama | ✅ | ✅ | ✅ | Sınırlı | ⛔ | ⛔ |
| Görev tamamlama | ✅ | ✅ | ✅ | ✅ | ✅ (kendisine atanan) | ⛔ |
| Chat kullanımı | ✅ | ✅ | ✅ | ✅ | ✅ (sınırlı) | ⛔ |
| Rapor görüntüleme | ✅ | ✅ | ✅ | ✅ | Sınırlı | ✅ |
| Excel export | ✅ | ✅ | ✅ | ✅ | ⛔ | ❓ (karar def.) |
| Telegram konfig | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| AuditLog görüntüleme | ✅ | ✅ | Sınırlı | ⛔ | ⛔ | ⛔ |
| Yetki yönetimi | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |

---

## MADDE 5 — ANA MODÜL ANAYASASI

> Her modül `id` numarası anayasa madde numarasıdır. Faz 4-13'te bu sıraya göre uygulanır.

### 5.1 Dashboard / Muhasebe Operasyon Merkezi
- **Amaç:** Bugün/bu hafta/bu ay ne yapılacak — tek ekran özet.
- **Bağlı kaynak:** Tüm modüllerden read.
- **Veri yapısı:** WidgetTercih, KpiCache.
- **Ekranlar:** Ana dashboard, Bugün, Yaklaşan ödemeler, Eksik dekont, Kontör eşik altı, Sözleşme bitişi yaklaşanlar, Import bekleyenler, SiteX ay özeti.
- **Görev/bildirim:** Yok (display layer).
- **Import:** Yok.
- **MVP:** MVP-1 / Orta. **Bağımlılık:** Tüm modüller (sonradan widget eklenir).

### 5.2 Fatura Takip
- **Amaç:** Şirket/şahıs faturalarını dönem bazında takip.
- **Bağlı kaynak:** Şirket/Ev Abonelikleri, Ödemeler Çizelgeleri, PAPİNET PDF.
- **Veri yapısı:** `Fatura`, `FaturaKalemi`, `FaturaBelgesi`.
- **Ekranlar:** Liste, Detay, Ekle/Düzenle, Ödeme bağla.
- **Görev/bildirim:** T-7/T-3/T-1/T+0 hatırlatma.
- **Import:** Excel + PDF.
- **MVP:** MVP-1 / Orta. **Bağımlılık:** Abonelik, Şirket/Sahis.

### 5.3 PDF Fatura Import (OCR)
- **Amaç:** PDF'den otomatik metadata.
- **Bağlı kaynak:** PAPİNET.rar, gelecek PDF.
- **Veri yapısı:** `BelgeOCRSonuc`, `ImportDraft` (PDF tipi).
- **Ekranlar:** Yükleme, OCR önizleme, düzeltme.
- **Görev/bildirim:** Düşük güven skoru → manuel kontrol görevi.
- **MVP:** MVP-2 / Çok Yüksek. **Bağımlılık:** Fatura, Import Merkezi.

### 5.4 Ödeme Takip
- **Amaç:** Tüm ödeme kalemleri tek tabloda.
- **Bağlı kaynak:** Tüm ödeme Excel'leri.
- **Veri yapısı:** `Odeme`, `OdemeBelgesi`, `OdemeMutabakat`.
- **Ekranlar:** Liste (matris/tablo toggle), detay, ekle, mutabakat, eksik dekont, yöntem raporu.
- **Görev/bildirim:** Eksik dekont, mutabakat farkı.
- **MVP:** MVP-1 / Orta. **Bağımlılık:** Fatura, Banka.

### 5.5 Otomatik Ödemeler
- **Amaç:** Banka talimatlı ödemeleri ayrı izleme.
- **Bağlı kaynak:** EV ABONELİKLERİ, ŞAHISLAR OTOMATİK, ŞİRKET ABONELİKLERİ.
- **Veri yapısı:** `OtomatikOdemeTalimati`, `BankaTalimatHareket`.
- **Ekranlar:** Talimat listesi, Banka bazlı, Aylık akış.
- **Görev/bildirim:** Banka iptal/eksik tahsilat.
- **MVP:** MVP-1 / Düşük. **Bağımlılık:** Abonelik, Banka.

### 5.6 Elden / EFT / Kredi Kartı Ödemeleri
- **Amaç:** Manuel ödeme yöntemi raporlaması.
- **Bağlı kaynak:** ÖDEMELER OTOMATİKLER VE ELDEN.
- **Veri yapısı:** `Odeme.yontem` enum.
- **Ekranlar:** Yöntem filtresi, Elden görev, dekont yükleme.
- **Görev/bildirim:** "Elden ödenecek" görevi.
- **MVP:** MVP-2 / Düşük. **Bağımlılık:** Ödeme.

### 5.7 Abonelik & Taahhüt Takip
- **Amaç:** Abonelik ve kampanya bitiş takibi.
- **Bağlı kaynak:** ŞİRKET ABONELİKLERİ, EV ABONELİKLERİ.
- **Veri yapısı:** `Abonelik`, `Taahhut`, `Kampanya`, `IptalSureci`.
- **Ekranlar:** Liste, Detay, Taahhüt takvimi, İptal süreci.
- **Görev/bildirim:** T-60/T-30/T-7 taahhüt bitişi.
- **MVP:** MVP-1 / Orta. **Bağımlılık:** Mülk, Sahis, Sirket, Kurum.

### 5.8 Ev / Şahıs Otomatik Ödemeleri
- **Amaç:** Aile bireyleri ev/mülk otomatik ödeme akışı.
- **Bağlı kaynak:** EV ABONELİKLERİ, ŞAHISLAR OTOMATİK.
- **Veri yapısı:** Sahis + Mülk + Abonelik + Odeme view.
- **Ekranlar:** Şahıs/Mülk bazlı, ay matrisi, yıl karşılaştırma.
- **MVP:** MVP-1 / Düşük. **Bağımlılık:** 5.5 + 5.7.

### 5.9 SiteX Aidat ve Gider Takibi
- **Amaç:** 5 daire için aylık aidat/gider/ekstre/yıllık belge.
- **Bağlı kaynak:** SITEX.rar, EV ABONELİKLERİ ilgili sheet.
- **Veri yapısı:** `SiteXDaire`, `SiteXEkstre`, `SiteXAidat`, `SiteXGider`, `SiteXAidatFarki`, `SiteXYillikBelge`.
- **Ekranlar:** Daire kart, daire detay, ekstre PDF görüntüleyici, aidat farkı, yıllık belgeler.
- **Görev/bildirim:** Ayın 17'si ekstre indir, ayın 20'si ödeme T-3.
- **MVP:** MVP-1 / Yüksek. **Bağımlılık:** Mülk, Sahis, Belge.

### 5.10 Emlak Vergisi & Mülk Takip
- **Amaç:** Mülk × yıl × dönem (1/2) emlak vergisi.
- **Bağlı kaynak:** EMLAK 2024.rar, 2025.rar, ÖDEMELER TAKİP "EMLAK".
- **Veri yapısı:** `Mulk`, `EmlakVergisi`, `EmlakBelgesi`.
- **Ekranlar:** Liste (mülk × yıl × dönem grid), mülk detay, belge yükleme, belediye filtre.
- **Görev/bildirim:** 1.taksit Mayıs sonu, 2.taksit Kasım sonu T-15.
- **MVP:** MVP-1 / Yüksek. **Bağımlılık:** Mülk, Belge.

### 5.11 Teminat Mektupları
- **Amaç:** Banka teminat mektupları + komisyon.
- **Bağlı kaynak:** TEMİNAT MEKTUPLARI Excel.
- **Veri yapısı:** `TeminatMektubu`, `TeminatKomisyonOdemesi`, `TeminatIade`.
- **Ekranlar:** Liste (aktif/iade), detay, komisyon takvimi, iade modal.
- **Görev/bildirim:** Komisyon T-7/T-1, mektup süresi, iade kapatma.
- **MVP:** MVP-1 / Yüksek. **Bağımlılık:** Sirket, Banka.

### 5.12 Muhasebe Düzenli Ödemeler (Kira)
- **Amaç:** Şirketler arası kira ve sabit gider.
- **Bağlı kaynak:** ÖDEMELER TAKİP ÇİZELGESİ Kira sheet'leri.
- **Veri yapısı:** `KiraSozlesmesi`, `KiraDonemTutar`, `KiraOdeme`.
- **Ekranlar:** Sözleşme listesi, kira artış geçmişi, aylık matris.
- **Görev/bildirim:** Aylık kira T-3, yıl başı artış kontrol.
- **MVP:** MVP-1 / Orta. **Bağımlılık:** Sirket.

### 5.13 Resmi Ödemeler (Vergi/İTO/BAĞKUR/SSK/BES)
- **Amaç:** Resmi kurum periyodik ödeme.
- **Bağlı kaynak:** BAĞKUR ÖDEMELERİ, İTO aidat, ÖDEMELER TAKİP "BAĞKUR".
- **Veri yapısı:** `ResmiOdeme`, `ResmiOdemeTipi`.
- **Ekranlar:** Tip filtreli liste, BAĞKUR şahıs×ay grid, İTO şirket×yıl×taksit, SSK/BES.
- **Görev/bildirim:** BAĞKUR aylık, İTO Haziran/Ekim, SSK 23'ü.
- **MVP:** MVP-1 / Orta. **Bağımlılık:** Sahis, Sirket.

### 5.14 ETA / Papinet / EDM / Entegratör / Kontör
- **Amaç:** Entegratör sözleşmeleri + kontör.
- **Bağlı kaynak:** PAPİNET.rar.
- **Veri yapısı:** `Entegrator`, `EntegratorSozlesme`, `KontorBakiye`, `KontorHareket`, `KontorKampanya`.
- **Ekranlar:** Entegratör listesi, şirket × entegratör matrisi, kontör bakiye, sözleşme takvimi, fatura arşivi.
- **Görev/bildirim:** Sözleşme bitişi T-60, kontör eşik <500.
- **MVP:** MVP-2 / Yüksek. **Bağımlılık:** Sirket, Belge.

### 5.15 Ajanda & Görev Yönetimi
- **Amaç:** Kullanıcı bazlı görev + takvim.
- **Veri yapısı:** `Gorev`, `GorevYorumu`, `GorevEki`, `GorevGecmisi`, `GorevSablonu`.
- **Ekranlar:** Bugün, Hafta, Ay, Geciken, Kanban kişi, görev detay, şablon yönetimi.
- **Görev/bildirim:** Atama, deadline, geciken günlük özet.
- **MVP:** MVP-1 / Orta. **Bağımlılık:** User.

### 5.16 Kurumsal Chat
- **Amaç:** Kayıt-bağlantılı sohbet.
- **Veri yapısı:** `ChatThread`, `ChatMessage`, `ChatParticipant`, `ChatOkundu`, `ChatEki`.
- **Ekranlar:** Widget, mesaj merkezi, birebir, grup, kayıt thread, mention.
- **MVP:** MVP-3 / Yüksek. **Bağımlılık:** User, tüm kayıt modülleri.

### 5.17 Bildirim / Telegram Merkezi
- **Veri yapısı:** `Bildirim`, `BildirimKanali`, `NotificationLog`, `TelegramKonfig`, `TelegramGonderim`.
- **Akış:** Sistem içi → NotificationLog → Telegram dry-run → test → gerçek.
- **MVP:** MVP-1 / Orta (gerçek Telegram Faz 12'de açılır).

### 5.18 Import Merkezi
- **Veri yapısı:** `ImportBatch`, `ImportDraft`, `ImportLog`, `ImportMapping`, `ImportHata`, `Belge`.
- **Ekranlar:** Yeni import, mapping, ön izleme, hata, onay, geçmiş, rollback.
- **Kural:** Onaysız kesin kayıt yok.
- **MVP:** MVP-1 / Yüksek. **Bağımlılık:** Tüm hedef modüller.

### 5.19 Raporlama / Excel Export
- **Veri yapısı:** `RaporSablonu`, `RaporCalistirma`.
- **MVP:** MVP-2 / Orta.

### 5.20 AuditLog
- **Veri yapısı:** `AuditLog`.
- **MVP:** MVP-1 / Düşük (her şeyden önce middleware kurulur).

### 5.21 Yetki ve Kullanıcı Yönetimi
- **Veri yapısı:** Django `User` + `Grup`, `Rol`, `Yetki`, `KullaniciTercih`.
- **MVP:** MVP-1 / Düşük.

---

## MADDE 6 — NORMALİZE VERİ MODELİ ANAYASASI

> Detay: `_analysis/model_drafts/PHASE0A_NORMALIZED_MODEL_DRAFT.md` (bağlayıcı taslak).

### 6.1 Ortak Çekirdek (BaseModel)
- `id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `is_active`, `notes` — tüm modellerde miras alınır.

### 6.2 Şirket / Kişi / Sahip
| Model | Amaç | Ana Alanlar | MVP |
|---|---|---|---|
| `Sahis` | Aile bireyi/şahıs | ad_soyad, tc_no, telefon, aile_grubu | ✅ |
| `Sirket` | Grup şirket | unvan, kisa_ad, vergi_no, sicil_no | ✅ |
| `Mulk` | Gayrimenkul | isim, mulk_tipi, sahibi (Sahis/Sirket), belediye, sicil_no, pruva34_daire_kodu | ✅ |
| `Banka` | Banka master | ad, kisa_kod | ✅ |
| `Kurum` | Hizmet sağlayıcı (TT, CK, İGDAŞ vb.) | ad, kurum_tipi | ✅ |

### 6.3 Fatura / Ödeme
| Model | Ana Alanlar | MVP |
|---|---|---|
| `Fatura` | fatura_no, tarihi, son_odeme, donem_yyyymm, tutar, kurum, hizmet_tipi, durum, belge | ✅ |
| `FaturaKalemi` | fatura, kalem_adi, miktar, tutar | ✅ |
| `Odeme` | fatura, tarih, tutar, yontem, banka, dekont, durum, mutabakat | ✅ |

### 6.4 Abonelik / Taahhüt
| Model | MVP |
|---|---|
| `Abonelik` (mulk/sahis/sirket, kurum, hesap_no, paket, otomatik_odeme) | ✅ |
| `Taahhut` (abonelik, başlangıç, bitiş, kampanya, ceza) | ✅ |
| `Kampanya` | ✅ |
| `IptalSureci` | MVP-2 |

### 6.5 SiteX
`SiteXDaire`, `SiteXEkstre` (yyyymm + belge), `SiteXAidat`, `SiteXGider`, `SiteXAidatFarki`, `SiteXYillikBelge` — tümü MVP-1.

### 6.6 Emlak Vergisi
`EmlakVergisi` (mulk, yil, donem, tutar, durum, odeme, belge) — unique (mulk,yil,donem). MVP-1.

### 6.7 Teminat Mektupları
`TeminatMektubu`, `TeminatKomisyonOdemesi`, `TeminatIade` — MVP-1.

### 6.8 Resmi Ödemeler
`ResmiOdeme` (tip enum: BAGKUR/SSK/BES/ITO/KGK/GELIR/KDV/MTV) — MVP-1.

### 6.9 ETA / Papinet / Entegratör / Kontör
`Entegrator`, `EntegratorSozlesme`, `KontorBakiye`, `KontorHareket`, `KontorKampanya` — MVP-2.

### 6.10 Ajanda / Görev
`Gorev`, `GorevYorumu`, `GorevEki`, `GorevGecmisi`, `GorevSablonu` — MVP-1.

### 6.11 Chat
`ChatThread`, `ChatMessage`, `ChatParticipant`, `ChatOkundu`, `ChatEki` — MVP-3.

### 6.12 Import
`ImportBatch`, `ImportDraft`, `ImportLog`, `ImportMapping`, `ImportHata` — MVP-1.

### 6.13 Bildirim / NotificationLog
`Bildirim`, `BildirimKanali`, `NotificationLog`, `TelegramKonfig`, `TelegramGonderim` — MVP-1 (Telegram gerçek Faz 12).

### 6.14 AuditLog
`AuditLog` (kullanici, model, kayit_id, eylem, eski/yeni JSON, modul) — MVP-1.

### 6.15 Belge / Dosya
`Belge` (dosya, sha256, tip, ozel_sinif: FATURA/DEKONT/EKSTRE/EMLAK_BORC/EMLAK_MAKBUZ/TEMINAT/SOZLESME/OCR_KAYNAK) — MVP-1.

### 6.16 Anayasa Kuralı
- Her modelde **soft-delete** (`is_active=False`) — hard-delete sadece Super Admin (audit zorunlu).
- Tüm dönemsel kayıtlar `yyyymm` veya `(yil, donem)` long-format.
- Generic FK (`bagli_model + bagli_id`) Görev/Chat/Bildirim'de polimorfik bağ kurar.

---

## MADDE 7 — IMPORT ANAYASASI

### 7.1 Ana İlke
> **Import edilen hiçbir veri doğrudan ana kayda yazılmaz. Önce taslak/ön izleme/onay akışından geçer.**

### 7.2 Pipeline'lar

| Tip | Akış |
|---|---|
| **Excel** | Upload → openpyxl parse → Mapping (kayıtlı şablon veya manuel) → ImportDraft satırları → Ön izleme → Hata düzeltme → Onay → Kesin kayıt |
| **PDF (tek)** | Upload → metadata extract (filename + meta) → Opsiyonel OCR → ImportDraft → Onay → `Belge` + ilgili kayıt |
| **RAR / Klasör** | Upload → Extract → Klasör/dosya adı parse (regex pattern) → Toplu ImportDraft → Onay sonrası ilgili modellere dağıt |

### 7.3 ImportBatch / ImportDraft / ImportLog
- **ImportBatch:** İşin başlığı (tip, hedef modül, kaynak dosya, durum, satır sayıları).
- **ImportDraft:** Satır bazlı taslak (ham_veri_json + parse_edilmis_json + mapping_uyarisi + durum + hedef_kayit_app/id).
- **ImportLog:** Her aksiyon (UPLOAD/PARSE/MAPPING/PREVIEW/APPROVE/REJECT/COMMIT/ROLLBACK).

### 7.4 Kontrol Gerekli Kayıtlar
- "X" işaretli (iptal varsayımı) → manuel onay
- "İPTAL DİLEKÇESİ VERİLDİ" not'lu → manuel iptal
- Tutar boş / 0 → kullanıcıya soru
- Sicil/TC formatı bozuk → kontrol
- Aynı (abonelik, yyyymm) için 2+ ödeme → mutabakat
- SiteX aidat farkı satırları → manuel mutabakat
- OCR güven skoru < eşik → manuel düzeltme

### 7.5 Idempotency / Tekrarlı Import
- Her ImportDraft satırı `(hedef_modul, dogal_anahtar)` ile dedup edilir (örn. Fatura: `(abonelik_id, yyyymm)`; EmlakVergisi: `(mulk_id, yil, donem)`).
- Aynı kayıt tekrar import edilirse: **UPDATE** veya **SKIP** seçimi mapping ekranında belirlenir.
- ImportBatch **rollback** yapılabilir (tüm batch geri alınır, AuditLog'a `IMPORT_ROLLBACK` yazılır).

### 7.6 Hata / Uyarı Logları
- Her ImportDraft satırının `mapping_uyarisi` ve `hata` alanı vardır.
- ImportHata tablosunda batch bazlı agregasyon.
- Onay ekranında özet: yeşil (ok), sarı (uyarı, onaylanabilir), kırmızı (hata, düzeltmeden onay yok).

### 7.7 Dosya Saklama ve Belge Bağlantısı
- Tüm yüklenen dosyalar `Belge` modeline kaydedilir (sha256 + boyut).
- ImportBatch'in kaynak dosyası kalıcı saklanır (audit için).
- PDF/RAR çıkarımları geçici klasörde işlenir, onay sonrası kalıcı `Belge` olarak yazılır.

### 7.8 İlk Veri Göçü Sırası (Faz 0A önerisi onaylanmıştır)
1. Çekirdek seed (Sahis, Sirket, Banka, Kurum, Mulk) — manuel + Şirket Abonelik Excel'inden
2. Şirket + Ev Abonelikleri (meta sheet) → `Abonelik` + `Taahhut`
3. Şahıs/Ev otomatik (2025-2026) → `Fatura` + `Odeme`
4. Ödemeler Otomatikler ve Elden → şirket bazlı `Fatura` + `Odeme`
5. Ödemeler Takip Çizelgesi Kira sheet'leri (2020-2026) → `KiraSozlesmesi`
6. İTO + BAĞKUR + ÖDEMELER TAKİP Bağkur → `ResmiOdeme`
7. ÖDEMELER TAKİP EMLAK + EMLAK 2024.rar + 2025.rar → `EmlakVergisi`
8. SITEX.rar → `SiteXDaire` + `SiteXEkstre` + `Belge`
9. TEMİNAT MEKTUPLARI → `TeminatMektubu`
10. PAPİNET.rar → `Entegrator` + `EntegratorSozlesme`

---

## MADDE 8 — BİLDİRİM VE TELEGRAM ANAYASASI

### 8.1 Üç Aşamalı Akış
1. **Sistem içi dashboard uyarısı** (anında, her zaman aktif)
2. **NotificationLog** kaydı (anında, her zaman)
3. **Telegram dry-run** (admin görür, gönderilmez — Faz 12'de aktif)
4. **Telegram test** kanalı (admin onayı sonrası — Faz 12'de aktif)
5. **Telegram gerçek** gönderim (final aşama — ayrı onay kapısı)

### 8.2 Bildirim Kuralları (özet)

| Tetikleyici | Sistem içi | Telegram | Görev |
|---|:-:|:-:|:-:|
| Fatura T-7/T-3/T-1 | ✅ | T-1 | T-3 |
| Abonelik taahhüt T-60/T-30/T-7 | ✅ | T-30/T-7 | T-30 |
| SiteX ayın 17'si (ekstre indir) | ✅ | — | ✅ |
| SiteX ayın 20'si (ödeme) | ✅ | T-3 | T-3 |
| Emlak 1.taksit Mayıs sonu | ✅ | T-15 | T-15 |
| Emlak 2.taksit Kasım sonu | ✅ | T-15 | T-15 |
| Teminat komisyon T-7/T-1 | ✅ | T-1 | T-7 |
| BAĞKUR aylık | ✅ | Ay sonu | Ay sonu T-3 |
| SSK ayın 23'ü | ✅ | T-3 | T-3 |
| BES aylık | ✅ | T-3 | T-3 |
| İTO 30 Haziran / 31 Ekim | ✅ | T-15 | T-15 |
| ETA/Papinet sözleşme T-60 | ✅ | ✅ | ✅ |
| Kontör <500 | ACIL | ACIL | ✅ |
| Eksik dekont | ✅ | — | ✅ |
| Eksik fatura | ✅ | — | ✅ |
| Kontrol bekleyen import | ✅ | — | ✅ |
| Geciken görev günlük 09:00 | ✅ | ✅ özet | — |
| Tamamlanmamış gün sonu 17:30 | ✅ | — | — |

### 8.3 Telegram Konfig (Super Admin yetkisi)
- Bot token (encrypted)
- Chat ID
- Mod: `DRY_RUN | TEST | GERCEK`
- Mod değişikliği AuditLog'a yazılır.

---

## MADDE 9 — AJANDA VE GÖREV ANAYASASI

### 9.1 Tanım
> Ajanda **sıradan takvim değil**, kayıt-bağlantılı görev yönetim sistemidir.

### 9.2 Görev Alanları
- Başlık, açıklama
- Atayan kullanıcı, atanan kullanıcı
- Öncelik (DUSUK/NORMAL/YUKSEK/ACIL)
- Son tarih
- Durum (YENI/BASLADI/BEKLIYOR/ERTELENDI/TAMAMLANDI/IPTAL)
- Bağlı modül + kayıt id (polimorfik)
- Dosya eki (Belge)
- Yorumlar (zaman damgalı)
- Erteleme tarihi + sebep
- Tamamlama tarihi
- İşlem geçmişi (`GorevGecmisi`)
- Otomatik üretildi mi? + şablon kaynağı

### 9.3 Görev Ekranları
- Bugünkü görevlerim
- Yaklaşan görevlerim
- Geciken görevlerim
- Bana atananlar
- Benim atadıklarım
- Kişi bazlı görev panosu (kanban)
- Günlük takvim
- Haftalık takvim
- Aylık takvim
- Görev detay (yorum/dosya/geçmiş/erteleme/tamamlama)
- Görev şablonu yönetimi (otomatik üretim)

### 9.4 Otomatik Görev Üretimi
- `GorevSablonu` modelinde tetikleyici kural (örn. `{"tip":"T_MINUS_DAYS","alan":"son_odeme_tarihi","gun":3}`).
- Cron job her gece 00:30 çalışır, eşleşen kayıtlar için görev üretir, `otomatik_uretildi=True` işaretler.
- Aynı kaynak için duplicate görev üretilmez.

---

## MADDE 10 — CHAT ANAYASASI

### 10.1 Tanım
> Chat sadece sohbet değil, **operasyon kayıtlarıyla bağlantılı konuşma** sistemidir. Bir SiteX ekstresi, bir teminat mektubu, bir görev veya bir fatura kendi başlı thread'ine sahip olabilir.

### 10.2 Özellikler
- Birebir mesaj
- Grup mesaj
- Kayıt-bağlantılı thread (bağlı_model + bağlı_id)
- Dosya eki (Belge)
- Okundu bilgisi (`ChatOkundu`)
- Bildirim rozeti (topbar)
- Mention (@kullanici)
- Sağ alt widget (collapse/expand)
- Mesaj merkezi tam ekran
- Mobil uyum
- Yetki kontrollü görünürlük (rol bazlı)

### 10.3 MVP Notu
Chat **MVP-3**'tedir. MVP-1'de görev yorumu (`GorevYorumu`) yeterlidir; tam chat sonra eklenir.

---

## MADDE 11 — UI / UX ANAYASASI

| # | Kural |
|---|---|
| 11.1 | Dark mode **YOK**. Sadece light tema. |
| 11.2 | Profesyonel, sade, kurumsal görünüm. |
| 11.3 | Kart tabanlı dashboard. |
| 11.4 | Badge/rozet sistemi: yeşil (ödendi), sarı (bekliyor), turuncu (yaklaşan), kırmızı (geciken), gri (iptal/pasif), mavi (taslak/onay-bekliyor). |
| 11.5 | Mobil uyum (iPhone Pro Max dahil) baştan zorunlu. |
| 11.6 | Input font-size mobile minimum **16px** (iOS zoom önleme). |
| 11.7 | Büyük dokunulabilir butonlar (mobile minimum 44x44px). |
| 11.8 | Tablo yerine mobilde **kart görünümü**. |
| 11.9 | Import preview ekranı standart layout (özet üst, satırlar orta, hata sağ panel). |
| 11.10 | Kaydetmeden çıkış uyarısı (`beforeunload` + modal). |
| 11.11 | Üst ve alt **kaydet** butonu standardı (uzun formlarda). |
| 11.12 | Boş durum (empty state) çizimi + CTA butonu zorunlu. |
| 11.13 | Filtre bar + arama + tarih aralığı her liste ekranında. |
| 11.14 | Modal/onay standardı: kırmızı (yıkıcı), mavi (onay), gri (iptal). |
| 11.15 | Dashboard KPI kartları + risk kartları. |
| 11.16 | Tipografi: Inter / IBM Plex Sans (TR karakter desteği). |
| 11.17 | Para `₺ 1.234,56`, tarih `dd.MM.yyyy`, yerel TR. |
| 11.18 | Sol menü gruplandırma: Operasyon / Mülk-Şahıs / Şirket / Resmi-Banka / Sistem (Faz 0C onaylar). |
| 11.19 | Sağ alt chat widget (collapse default). |
| 11.20 | Topbar: arama, bildirim zili, kullanıcı menüsü, hızlı oluştur. |

---

## MADDE 12 — KVKK / VERİ SAKLAMA / GÜVENLİK

| # | Kural |
|---|---|
| 12.1 | TC No, telefon, hesap no gibi şahsi bilgiler audit log'da maskelenir. |
| 12.2 | Yedekleme: günlük DB dump + haftalık dosya snapshot. |
| 12.3 | Telegram bot token encrypted saklanır. |
| 12.4 | Şifreler hash'lenir (Django default), 2FA Faz 2'de değerlendirilir. |
| 12.5 | Salt görüntüleyici rolünde belge indirme audit'lenir. |
| 12.6 | Hard-delete sadece Super Admin + zorunlu sebep + audit. |
| 12.7 | Süreli erişim logları minimum 2 yıl saklanır. |
| 12.8 | Üretim sunucu erişimi VPN/SSH key + IP whitelist. |

---

## MADDE 13 — SÜRÜM / RELEASE / DEPLOY

| # | Kural |
|---|---|
| 13.1 | Branş yapısı: `main` (prod), `dev` (entegrasyon), `feat/*`, `fix/*`, `release/*`. |
| 13.2 | Commit standartı: `<modul>: <tip>: <açıklama>` (örn. `pruva34: feat: aidat farkı ekranı`). |
| 13.3 | PR zorunlu — direkt push yasak. |
| 13.4 | Migration tek başına commit edilir, model değişikliğiyle ayrılmaz. |
| 13.5 | Her release notu `_docs/releases/vX.Y.Z.md` — değişiklik + migration + rollback notu. |
| 13.6 | Deploy: `dev` → manuel test → `release/*` → prod (manuel onay). |
| 13.7 | Deploy öncesi DB backup zorunlu. |

---

## MADDE 14 — TEST / QA STANDARTI

| # | Kural |
|---|---|
| 14.1 | Her model için minimum 1 unit test (CRUD + soft-delete). |
| 14.2 | Her import pipeline için end-to-end testi (örn. örnek Excel ile). |
| 14.3 | Bildirim/görev otomatik üretim cron'ları için fixtures testi. |
| 14.4 | UI smoke test (Playwright/Selenium) MVP-2'de. |
| 14.5 | Test coverage hedef %60 (MVP-1), %75 (MVP-2). |

---

## MADDE 15 — ANAYASA DEĞİŞİKLİĞİ

Bu anayasanın değiştirilmesi için:
1. Değişiklik gerekçesi `_docs/PHASE0B_DECISION_REGISTER.md` dosyasına eklenir.
2. Etkilenen modüller listelenir.
3. Yönetici onayı alınır.
4. Yeni sürüm numarası verilir (1.1, 1.2, …).
5. Eski sürüm `_docs/_archive/PROJECT_ANAYASA_v{X.Y}.md` olarak arşivlenir.

---

**SON.** Bu doküman tüm sonraki fazlar için bağlayıcıdır.
