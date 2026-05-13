# DESIGN MOBILE AUDIT
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05
**Kapsam:** Mobile Frame 20-25 (iPhone Pro Max 430×932)

---

## 1. AUDİT SONUÇ TABLOSU

| # | Kontrol | Beklenen | Frame 20 Dashboard | Frame 21 Görev | Frame 22 Liste | Frame 23 Detay | Frame 24 Import | Frame 25 Chat | Sonuç |
|---|---|---|---|---|---|---|---|---|:-:|
| 1 | **430×932 taşma** | 0 yatay scroll | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 2 | **Input ≥16px** | mobile zorunlu | arama 16 | filtre buton text 13 (display only) | arama 16 | tarih/tutar/not 16 | — | input "Mesaj... @" 16 | PASS |
| 3 | **Touch target ≥44px** | tüm aksiyon | topbar 44, FAB 56 | tab 36+padding=44, Tamamla 36+pad=44, FAB 56 | filtre buton 44, sticky 48 | sticky 48-52, dekont 48 | tab chip 36+pad, sticky 48 | input 44, gönder 44, topbar 44 | PASS |
| 4 | **Tablo yok** | sadece kart | KPI 2x2 + risk scroll + Card listesi | Card görev | Card ödeme | form + Card | Card import satır | thread Card listesi | PASS |
| 5 | **Risk yatay scroll** | scroll-snap | ✅ 4 risk kartı yatay | — | — | — | — | — | PASS |
| 6 | **Tab/chip yatay scroll** | overflow-x: auto | bottom tab fix | ✅ 5 tab | ✅ 5 chip + filtre | ✅ 6 tab | ✅ 4 chip tab | — | PASS |
| 7 | **Bottom sticky action** | flexShrink 0 | bottom nav 64px | — | sticky 3-buton 48 | sticky 2-buton 52+48 | sticky 2-buton 48 | — (input bar zaten alt) | PASS |
| 8 | **FAB kullanımı** | yeni kayıt için | Chat FAB 56 | Yeni Görev FAB 56 (altın) + Chat FAB 56 | Chat FAB 56 | — (action bar var) | — | — | PASS |
| 9 | **Chat fullscreen** | mobil özel | — (FAB) | — (FAB) | — (FAB) | — (FAB) | — | ✅ Frame 25 fullscreen | PASS |
| 10 | **Dekont fotoğraf çek CTA** | mobile camera | — | — | — | ✅ "📷 Fotoğraf Çek" altın 48px | — | — | PASS |
| 11 | **Import mapping desktop önerisi** | uyarı banner | — | — | — | — | ✅ "Mapping için masaüstü önerilir" warning banner | — | PASS |
| 12 | **Safe-area simülasyonu** | iOS notch + home | ✅ status bar 44 + home 24 | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 13 | **Görev swipe ipucu** | sağ kaydır=tamamla / sol=ertele | — | ✅ "← Ertele · Tamamla →" caption + 2. kart üzerinde swipe görsel ipucu (sağ kenar yeşil ✓) | — | — | — | — | PASS |

**Toplam:** 13 kontrol · **13 PASS · 0 WARNING · 0 BLOCKER**

---

## 2. EK MOBİL DETAY KONTROLLERİ

| Kontrol | Sonuç | Not |
|---|---|---|
| iOS status bar 44px (saat + sinyal + batarya) | ✅ | brand-900 BG + IBM Plex Mono saat |
| iOS home indicator 24px | ✅ | 134×5 ink çizgi alt orta |
| Bottom tab bar (Frame 20) | ✅ | 5 tab × 64px height, active brand-700 üst border |
| Hamburger menü | ✅ | 44×44 sağ üst, drawer'a açılır (planlı) |
| Bildirim zili rozet | ✅ | Topbar 44×44 + 14×14 kırmızı sayı rozet |
| Avatar boyutları mobil | ✅ | 22-28px (kart içi), 36-40px (drawer) |
| Sticky bar gölge/separator | ✅ | borderTop `1px ${T.border}` |
| Input radius mobile | ✅ | 10-12px (44-48 height ile uyumlu) |
| Modal mobile fullscreen | ⚠ Planlandı | Frame 25 fullscreen olarak tasarlandı; diğer modal'lar Faz 2 implementation'da `<640px` fullscreen |
| Bottom sheet pattern | ⚠ Planlandı | "Filtre" butonları görsel ipucu, açılış davranışı Faz 2'de |
| Pull-to-refresh | ⚠ Planlandı | Faz 2/3 implementation |
| Offline banner | ⚠ Planlandı | navigator.onLine false durumu için Faz 2 |
| Reduced-motion media query | ⚠ Planlandı | Faz 2 CSS implementation |

---

## 3. KOMPONENT MOBİL DAVRANIŞ ÖZETİ

| Component | Mobile Davranış |
|---|---|
| TopBar | `<MobileTopBar>` 56px + back? logo? + bildirim zili 44 + hamburger 44 |
| SideNav | Drawer (hamburger ile açılır, planlı) |
| DataTable | `<MobileCard>` akışına dönüşür (otomatik switch <768px) |
| Modal | <640px fullscreen (Faz 2) |
| Drawer | <640px fullscreen (Faz 2) |
| ChatWidget | Collapse FAB → tıklanınca Frame 25 fullscreen chat |
| Filter Bar | Bottom sheet pattern (planlı) |
| Tabs | overflow-x: auto + scroll-snap (uygulandı) |
| Form | Input fontSize 16, button minHeight 48-52 sticky bottom |
| Avatar zinciri | atayan→atanan kompakt 22-28px |
| Status badge | `<MStatusTag>` 22px height + 10px metin |

---

## 4. RİSK / İYİLEŞTİRME ÖNERİLERİ (Faz 2 implementation için)

| # | Risk | Öneri |
|---|---|---|
| R1 | Modal mobile fullscreen JSX'te tam temsil edilmedi (Frame 25 dışında) | Faz 2 CSS: `@media (max-width: 640px) { modal: position fixed inset 0 }` |
| R2 | Bottom sheet animation tasarımı yok | Faz 2 component lib: spring-animated bottom sheet (240ms) |
| R3 | Görev swipe gesture görsel ipucu var ama implementation yok | Faz 2: Hammer.js veya touch event ile swipeleft/right |
| R4 | iOS keyboard ekran sıkışması (Frame 23 form) | Faz 2: viewport `interactive-widget=resizes-content` meta |
| R5 | PWA install prompt ekranı yok | Faz 2/3'te değerlendirilebilir (LATER) |
| R6 | Push notification permission UX akışı yok | Faz 12 Telegram + browser push birlikte |
| R7 | Mobile arama Cmd+K yerine "Ara..." inputu — fonksiyon eşdeğeri | Faz 2: aynı global search backend'i kullansın |
| R8 | Frame 25 thread listesi + aktif thread aynı sayfada (split view) — gerçek kullanım navigation tabanlı | Faz 11: `/mesajlar` route + `/mesajlar/:id` split / detail layout |

---

## 5. TEST CİHAZ MATRİSİ (Faz 2 QA için)

| Cihaz | Viewport | Test Frame'leri |
|---|---|---|
| iPhone Pro Max | 430×932 | Tüm 6 mobil frame (referans) |
| iPhone 14 | 390×844 | 20-25 (430→390 daralma testi) |
| iPad Mini | 744×1133 | Desktop frame'lerin küçük versiyon kontrolü |
| Galaxy S | 412×915 | Android Chrome render farkı |
| Masaüstü 1440 | 1440×900 | Tüm 20 desktop frame referansı |
| Masaüstü 1920 | 1920×1080 | Max-width 1440 + center test |

---

## 6. ANAYASA UYUM (Madde 11.5-11.8 mobil)

| Madde | Beklenen | Kontrol | Sonuç |
|---|---|---|---|
| 11.5 | Mobil uyum baştan zorunlu | 6 mobil frame tasarlandı, anayasa açıkça gösteriyor | ✅ |
| 11.6 | Input minimum 16px | 6/6 frame'de mobile input fontSize 16 | ✅ |
| 11.7 | Touch target ≥44×44 | 6/6 frame'de aksiyon butonları 44+ | ✅ |
| 11.8 | Tablo yerine kart | 6/6 frame'de tablo yok, kart akışı | ✅ |

---

**SONUÇ:** Mobil tasarım anayasa ile tam uyumlu, 13 kontrol PASS, 0 BLOCKER. Faz 2 implementation'a hazır. Faz 2'de eklenecek 8 risk maddesi yukarıda listelendi.
