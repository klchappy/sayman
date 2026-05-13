# FAZ 0B — CLAUDE DESIGN GİRDİ PAKETİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Hedef:** Faz 0C'de Claude Design'a verilecek temel input.
**Tarih:** 2026-05-05
**Durum:** TEMEL INPUT — Faz 0C'de genişletilecek.

---

## 1. PROJE ADI VE VİZYON

**MUHASEBE OPERASYON SİSTEMİ.** Acme şirketler grubu ve Aile bireyleri şahıs/ev/mülk muhasebe operasyonlarını tek çatıdan yöneten, kayıt-bağlantılı görev/chat/bildirim altyapısına sahip, profesyonel kurumsal bir sistem. **Sadece fatura takip değil, muhasebe operasyon merkezi.**

---

## 2. ANA MODÜLLER (21)

### MVP-1 (16 modül)
1. Yetki ve Kullanıcı
2. AuditLog
3. Dashboard
4. Fatura Takip
5. Ödeme Takip
6. Otomatik Ödemeler
7. Ev/Şahıs Otomatik
8. Abonelik & Taahhüt
9. SiteX Aidat ve Gider
10. Emlak Vergisi & Mülk
11. Teminat Mektupları
12. Resmi Ödemeler (BAĞKUR/SSK/BES/İTO)
13. Düzenli Ödemeler / Kira
14. Ajanda & Görev
15. Bildirim Merkezi (Telegram dry-run)
16. Import Merkezi

### MVP-2 (4)
17. PDF Fatura Import / OCR
18. Elden/EFT/Kart Detay
19. ETA/Papinet/Entegratör/Kontör
20. Raporlama / Excel Export

### MVP-3 (1)
21. Kurumsal Chat (Widget + mesaj merkezi)

---

## 3. TASARLANACAK EKRAN LİSTESİ (104 ekran — Faz 0A'dan)

### İlk parti — öncelikli 10 (D-013 onayı bekleniyor)
1. Login
2. Ana Dashboard
3. Fatura listesi
4. Fatura detay
5. Ödeme listesi (matris/tablo toggle)
6. SiteX daire detay
7. Emlak vergisi grid (mülk × yıl × dönem)
8. Teminat mektubu detay (komisyon takvimi)
9. Görev detay (yorum + dosya + geçmiş)
10. Import preview ekranı

### İkinci parti
- Master tablolar (Sahis, Sirket, Mulk, Banka, Kurum)
- Abonelik liste/detay/taahhüt takvimi
- Resmi ödemeler grid'leri (BAĞKUR şahıs×ay, İTO şirket×yıl×taksit)
- Kira sözleşmesi listesi/detay
- Ajanda takvim (gün/hafta/ay)
- Kanban görev panosu
- Bildirim merkezi
- Mapping editor
- AuditLog timeline
- Yetki/kullanıcı yönetimi

### Mobil ilk parti (M1-M7)
- Mobil dashboard
- Bugünkü görevler
- Görev detay (tamamla)
- Bildirim listesi
- Chat widget (full screen)
- Ödeme okuma listesi
- Belge fotoğraf yükleme

> Tam liste: `_analysis/design_brief/PHASE0A_DESIGN_SCREEN_LIST.md`

---

## 4. UI PRENSİPLERİ (Anayasa Madde 11'den)

| # | Kural |
|---|---|
| 4.1 | **Dark mode YOK.** Sadece light tema. |
| 4.2 | Profesyonel, sade, kart tabanlı, kurumsal. |
| 4.3 | Mobil uyum baştan zorunlu (iPhone Pro Max dahil). |
| 4.4 | Input font-size mobile minimum **16px**. |
| 4.5 | Buton touch target minimum 44×44px. |
| 4.6 | Tablo yerine mobilde kart görünümü. |
| 4.7 | Empty state çizimi + CTA zorunlu. |
| 4.8 | Filter bar + arama + tarih aralığı her listede. |
| 4.9 | Üst ve alt kaydet butonu uzun formlarda. |
| 4.10 | Kaydetmeden çıkış uyarısı. |
| 4.11 | Modal/onay standart: kırmızı yıkıcı, mavi onay, gri iptal. |
| 4.12 | Para `₺ 1.234,56`, tarih `dd.MM.yyyy`. |
| 4.13 | Tipografi: Inter / IBM Plex Sans (TR karakter). |
| 4.14 | Sol menü gruplaması: Operasyon / Mülk-Şahıs / Şirket / Resmi-Banka / Sistem. |
| 4.15 | Sağ alt chat widget (collapse default — MVP-3'te aktif). |
| 4.16 | Topbar: arama + bildirim zili + kullanıcı menü + hızlı oluştur. |

---

## 5. DASHBOARD BEKLENTİSİ

KPI kartları (4 üst sıra):
- Bugün ödenecek toplam tutar
- Geciken ödeme sayısı
- Bu ay tamamlanan / bekleyen görev oranı
- Eksik dekont sayısı

Risk kartları (acil dikkat):
- Kontör eşik altı (varsa)
- Sözleşme bitişi yaklaşan (T-30 içinde)
- Teminat komisyonu yaklaşan (T-7)
- SiteX eksik ekstre

Widget'lar (alt grid 2x4):
- Bugünkü görevler
- Yaklaşan ödemeler (T-7)
- SiteX ay özeti
- Import bekleyenler
- Son AuditLog hareketleri (Yönetici görür)
- Eksik dekont listesi
- Yaklaşan taahhüt bitişi
- Bana atanmış son mesajlar (chat MVP-3)

---

## 6. MOBİL BEKLENTİSİ

- Web responsive (PWA opsiyonel) — native app yok.
- 3 cihaz boyutu test: iPhone Pro Max (430×932), iPad (820×1180), masaüstü (1440+).
- Mobilde tablolar otomatik **kart akışına** dönüşür.
- Belge fotoğraf çekme: tarayıcı `capture="camera"` ile dekont yükleme.
- Sol menü mobilde drawer (hamburger).
- Kanban kanban kart sürükleme yerine "tap → durum değiştir" modal'ı.
- Bildirim ve görev her cihazda öncelikli ekran.

---

## 7. IMPORT PREVIEW BEKLENTİSİ

3 panel layout:
- **Üst (header):** Batch özeti — dosya adı, hedef modül, toplam/başarılı/uyarı/hata satır sayıları, tahmini commit süresi.
- **Orta (data table):** Satır bazlı veri (yeşil=ok, sarı=uyarı, kırmızı=hata). Inline edit etkin.
- **Sağ panel:** Seçili satır detayı + uyarı/hata mesajı + manuel düzeltme alanları.
- **Alt (action bar):** Tümünü onayla / Sadece yeşilleri onayla / Reddet / Mapping'e dön / Excel'e yeniden yükle.
- Hatalar düzeltilmeden commit butonu **disabled**.
- Mapping editor öncesi adımı: kayıtlı şablon seçimi (örn. "EV ABONELİKLERİ kişi sheet v1") veya yeni mapping.

---

## 8. AJANDA / GÖREV BEKLENTİSİ

- Görev kartında: başlık, atanan avatar, son tarih (kırmızı/turuncu/yeşil tag), öncelik badge, bağlı kayıt link.
- Detay drawer: yorum thread'i (zaman damgalı), dosya ek listesi, işlem geçmişi tab'ı, erteleme/tamamla butonları üstte.
- Takvim 3 modu: gün (saatli), hafta (kişi swimlane), ay (heatmap).
- Kanban: durum kolonları (YENİ / BAŞLADI / BEKLİYOR / ERTELENDI / TAMAMLANDI).
- Geciken görev kartı pulse animasyonu (kırmızı kenarlık).
- Görev şablonu yönetimi ekranı: tetikleyici kural visual editor (örn. "EmlakVergisi son_odeme_tarihi - 15 gün → görev oluştur").

---

## 9. CHAT WIDGET BEKLENTİSİ (MVP-3)

- Sağ alt köşe; collapse default (sadece zarf ikonu + rozet).
- Expand: 360×500 popup; tam ekran butonu mevcut.
- Thread listesi → mesaj listesi → input bar layout.
- Kayıt-bağlantılı thread başlığında: "📎 SiteX A4.17 — 2026-03 ekstre" gibi context bilgisi.
- Mention `@kullanici` autocomplete.
- Dosya eki: drag-drop veya dosya butonu.
- Okundu indicator (mavi tik).
- Mobilde tam ekran.

---

## 10. BADGE / STATUS RENK MANTIĞI

| Renk | Kullanım |
|---|---|
| 🟢 Yeşil | Ödendi, tamamlandı, aktif, başarılı |
| 🟡 Sarı | Bekliyor, taslak, onay bekliyor |
| 🟠 Turuncu | Yaklaşan deadline (T-7 içinde), uyarı |
| 🔴 Kırmızı | Geciken, hatalı, kritik, acil |
| ⚪ Gri | İptal, pasif, arşiv |
| 🔵 Mavi | Bilgi, info, otomatik üretildi |
| 🟣 Mor | Özel — örneğin "manuel doğrulama gerekli" |

---

## 11. DARK MODE BİLGİSİ

> **Dark mode istenmemektedir.** Tek tema: light / kurumsal beyaz arka plan + lacivert vurgu. Faz 0C'de "dark mode toggle" tasarlanmasın.

---

## 12. RENK PALETİ ÖNERİSİ (Faz 0C kesinleştirir)

- **Birincil:** Kurumsal lacivert (#1E3A5F veya benzeri)
- **İkincil:** Beyaz / açık gri arkaplan (#F8F9FA)
- **Vurgu:** Sarı/altın aksent (Acme markası nüansı — kullanıcıdan logo onayı bekleniyor)
- **Durum renkleri:** Yukarıdaki badge tablosu
- **Metin:** Koyu gri (#1A1A1A primary, #6B7280 secondary)

---

## 13. TİPOGRAFİ ÖNERİSİ

- **Heading:** Inter Bold 24/20/18/16
- **Body:** Inter Regular 14, line-height 1.5
- **Mono (kod/numara):** JetBrains Mono / IBM Plex Mono
- **Türkçe karakter desteği zorunlu** (ş, ğ, ı, İ, ç, ö, ü)

---

## 14. NOT — BU DOSYA NİHAİ DEĞİL

Bu dosya **Faz 0C'ye temel input**'tur. Faz 0C'de:
- Karar defteri (D-013) ile öncelikli ekranlar kesinleşir.
- Logo + kurumsal renk onaylanır.
- Component kütüphanesi tasarlanır.
- 10 öncelikli ekran çizilir.
- Design tokens dokümante edilir.

Faz 0C çıktısı ile bu dosya birleştirilerek nihai design system dokümanı oluşur.

---
