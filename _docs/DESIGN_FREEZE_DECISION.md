# DESIGN FREEZE DECISION
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Freeze Tarihi:** 2026-05-05
**Sürüm:** Design v1.0 (Sprint 1A-1G konsolide)
**Durum:** **DONDURULDU** · Faz 1 Teknik Mimari'ye aktarım hazır

---

## 1. KAPSAM

26 frame `design-canvas.jsx` içinde sabittir:

- **Desktop (20):** 00 Design System, 01 App Shell, 02 Dashboard, 03 Import Center, 04 Import Preview, 05 Fatura/Ödeme Listesi, 06 Fatura/Ödeme Detay, 07 Ödeme İşaretleme Modal, 08 Abonelik & Taahhüt, 09 SiteX Daire/Aidat, 10 Emlak Vergisi/Mülk, 11 Teminat Mektupları, 12 Resmi Ödemeler, 13 Düzenli Ödemeler, 14 Entegratör/Kontör, 15 Ajanda & Görev, 16 Bildirim/Telegram, 17 Raporlama, 18 AuditLog, 19 Yetki & Master.
- **Mobile (6):** 20 Mobile Dashboard, 21 Mobile Görevler, 22 Mobile Ödeme Listesi, 23 Mobile Ödeme Detay, 24 Mobile Import Kontrol, 25 Mobile Chat Fullscreen.

---

## 2. FREEZE EDİLEN KARARLAR

### 2.1 Renk Sistemi
- **Birincil:** brand-900 `#0F2540` · brand-700 `#1E3A5F` · brand-500 `#3B5F8A` · brand-300 `#A8BBD3` · brand-100 `#E8EEF6`
- **Aksent (sınırlı):** accent-500 `#D4A93C` · accent-100 `#FAF1D6` — sadece birincil CTA, KPI ince çizgi, aktif menü highlight, mobil FAB.
- **Nötr:** bg `#F8F9FA` · card `#FFFFFF` · border `#E5E7EB` · ink `#1A1A1A` · ink-2 `#4B5563` · muted `#9CA3AF`.
- **Semantic (sadece status/badge):** success / warning / danger / info / orange / purple — sayfa BG'lerinde geniş alan dolgusu olarak kullanılmaz.

### 2.2 Tipografi
- **UI:** IBM Plex Sans (root fontFamily).
- **Veri/sayı:** IBM Plex Mono — tutarlar, tarihler, hesap/hizmet/sicil/mektup numaraları, daire kodları, dönem kodları (`yyyymm`), IP, TC (maskeli), kullanım yüzdesi, satır no.
- Inter ve JetBrains Mono **YASAKLI**.
- Hiyerarşi: h1 28/700, h2 24/700, h3 20/600, h4 18/600, body 14, body-sm 13, caption 12 uppercase 0.06em.

### 2.3 Badge Sistemi
- 23 status badge + 6 ödeme yöntemi badge — `DESIGN_STATUS_BADGE_SYSTEM.md` referans.
- Format: pill (radius full) · 24px height · ikon 14px + UPPERCASE 12px metin (mobilde 22px height + 10px metin).

### 2.4 Layout Sistemi
- 12/8/4 kolon responsive grid · 16px gutter ≥1024 · breakpoint <768 mobile.
- Sol menü 240px expanded · 64px collapsed (mobil drawer).
- Topbar 56px sabit, sticky top.
- Max içerik genişliği 1440.
- Mobile viewport: iPhone Pro Max 430×932.

### 2.5 App Shell
- TopBar: K logo + sayfa başlık + ⌘K arama + bildirim zili (rozet) + Hızlı Oluştur (altın) + kullanıcı menü.
- SideNav grupları (Anayasa Madde 11.18 sabit): **Operasyon / Mülk-Şahıs / Şirket / Resmi-Banka / Sistem**.
- Sağ alt collapsed chat widget her sayfada · mobil ekranda fullscreen chat'e dönüşür.

### 2.6 Dashboard Kurgusu
- 4 KPI üst sıra (mobile 2×2).
- Risk kartları (mobile yatay scroll).
- 8 widget grid 2×4 (mobile tek kolon).

### 2.7 Import Preview Kurgusu (kritik)
- Desktop: 3 panel (header + sol belge önizleme + orta data tablosu + sağ düzeltme paneli + alt sticky 6-buton bar).
- Renk kodlu satırlar: yeşil OK / sarı uyarı / kırmızı hata / mor manuel doğrulama.
- Aksiyonlar: Tümünü Onayla / Sadece Yeşilleri / Reddet / Mapping'e Dön / Taslak / Rollback (24 saat).
- Mobile: Sekmeli (Özet/Satırlar/Hatalar/Belge) + kart akışı + uyarı banner "Mapping desktop önerilir".

### 2.8 Görev / Chat Kurgusu
- **Görev:** 9 görüntüleme modu (Bugün/Yaklaşan/Geciken/Bana/Atadıklarım/Kanban/Günlük/Haftalık/Aylık takvim) · görev kartı (öncelik renk + bağlı kayıt link + atayan→atanan avatar + son tarih + yorum/ek sayısı + Tamamla/Ertele) · detay drawer 4 tab.
- **Chat:** Desktop sağ alt collapsed widget; expanded popup; tam ekran Mesaj Merkezi (sol thread + orta mesajlar + sağ context). Mobil fullscreen chat (Frame 25). Kayıt-bağlantılı thread başlıkta 📎 + bağlı kayıt etiketi.

### 2.9 Mobil Kurgular
- Tablo yasak; sadece kart akışı.
- Input ≥16px; touch target ≥44×44.
- Status bar 44 + home indicator 24 simüle.
- Risk/tab/chip yatay scroll.
- Sticky bottom action bar; FAB (+).
- Bottom sheet pattern filtreler için (planlandı, görsel ipucu mevcut).

---

## 3. FREEZE SONRASI DEĞİŞİKLİK PROSEDÜRÜ

| Tip | Tanım | Onay | Süreç |
|---|---|---|---|
| **Küçük düzeltme** | Tek frame içinde metin/spacing/ikon dokunuşu, durum sayısı güncelleme | Tasarım sahibi | Doğrudan `design-canvas.jsx` edit, audit log notu yeterli |
| **Orta revizyon** | Yeni frame ekleme, mevcut frame'in iki+ bölümünü yeniden kurgulama, badge ekleme | Yönetici onay | Sprint kararı + DESIGN_FREEZE_DECISION.md "değişiklik kayıt" bölümüne işle |
| **Büyük revizyon** | Renk paleti / tipografi / app shell / sol menü grup yapısı / 23 badge sistemi değişikliği | Yönetici + sürüm artışı | `_docs/_archive/DESIGN_FREEZE_v1.0.md` arşivle, yeni v1.1+ sürüm yayınla, anayasa Madde 11 güncelle |

---

## 4. FAZ 1 TEKNİK MİMARİ'YE AKTARILACAK NOTLAR

1. **Stack tercihi (D-016):** Django 5.x + Templates + HTMX + Alpine.js önerisi (server-rendered) — alternatif Django + DRF + React ayrıca değerlendirilebilir. Tasarımdaki tüm component'lar her iki yöntemde de uygulanabilir.
2. **CSS tokens:** `static/css/tokens.css` (PHASE0C_DEVELOPER_UI_HANDOFF.md Bölüm 4) tek kaynak gerçeği.
3. **PostgreSQL (D-015):** JSON kolonları gerekiyor (ImportDraft.ham_veri_json, AuditLog.eski/yeni_deger_json). PostgreSQL onaylanmalı.
4. **Hosting (D-017):** İzolasyon kuralı (Anayasa 1.5) gereği ayrı VPS önerilir.
5. **Eski yıllar (D-018):** 2020+ import edilecekse "geçmiş veri" flag'i ile otomatik görev/bildirim üretmemeli.
6. **WebSocket altyapısı:** Chat (Frame 25) Faz 11'de canlanacak, mimari planında Channels veya benzeri eklenmeli.
7. **PDF.js / Excel sheet preview:** Frame 04 Import Preview için client-side render.
8. **File storage:** Belge model `sha256` ile dedup; private storage (yetki kontrollü).
9. **Cron / scheduled jobs:** Görev şablonu otomatik üretimi (Frame 15) + bildirim T-30/T-15/T-7/T-3/T-1 + günlük 09:00 özet + gün sonu 17:30.
10. **Telegram gerçek aktivasyon:** Frame 16'da kapı kapalı; Super Admin onayı + Faz 12 implementasyon.

---

## 5. FAZ 2 UI İMPLEMENTASYONUNDA KORUNMASI GEREKENLER

| # | Korunacak |
|---|---|
| 5.1 | Dark mode YOK · `prefers-color-scheme: dark` media query eklenmeyecek |
| 5.2 | IBM Plex Sans + IBM Plex Mono · alternatif font değişimi yasak |
| 5.3 | Lacivert/indigo dominant · accent 4-5 noktada sınırlı |
| 5.4 | 23 badge + 6 ödeme yöntemi badge sistemi · ek durum eklenecekse karar registry'e |
| 5.5 | Sol menü grupları: Operasyon/Mülk-Şahıs/Şirket/Resmi-Banka/Sistem |
| 5.6 | Para `₺ 1.234,56` · Tarih `dd.MM.yyyy` · Locale TR |
| 5.7 | Mobile input ≥16px · touch target ≥44px · tablosuz |
| 5.8 | Import preview 3 panel + renk kodlu satır + 6 aksiyon |
| 5.9 | Bildirim 3 aşamalı kapı · Telegram gerçek default KAPALI |
| 5.10 | Sağ alt chat widget her sayfada (collapsed default · mobil fullscreen) |
| 5.11 | AuditLog her CRUD · TC/telefon log'da maskeli |
| 5.12 | Soft-delete · Hard-Delete sadece Super Admin (çift onay) |
| 5.13 | Empty state ikon + metin + CTA zorunlu |
| 5.14 | Kaydetmeden çıkış uyarısı · uzun formlarda alt sticky save bar |
| 5.15 | WCAG 2.1 AA kontrast · keyboard nav · ARIA |

---

## 6. FREEZE ONAY KAYDI

| Madde | Sahip | Tarih |
|---|---|---|
| Tasarım kapsamı | Tasarım sahibi | 2026-05-05 |
| Anayasa uyumu | Audit (Sprint 1H) | 2026-05-05 |
| Faz 1'e devir | Bekleniyor (Yönetici) | — |

---

**SON.** Bu doküman güncellendiğinde sürüm numarası artırılır ve önceki sürüm `_docs/_archive/` altına alınır.
