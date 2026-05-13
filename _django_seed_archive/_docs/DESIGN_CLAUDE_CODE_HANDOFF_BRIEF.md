# DESIGN — CLAUDE CODE HANDOFF BRIEF
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05
**Hedef:** Faz 1 (Teknik Mimari) ve Faz 2 (Scaffold + UI implementation) için Claude Code'a verilecek tasarım aktarım özeti.

> ⚠ **ÖNEMLİ:** `design-canvas.jsx` içindeki JSX **production kodu DEĞİLDİR**, sadece görsel referans/prototiptir. Faz 2'de stack kararına göre (Django Templates + HTMX veya Django + DRF + React) yeniden yazılacaktır. Inline `style={{...}}` prototiptir; production'da Tailwind / CSS Modules / styled-components.

---

## 1. PROJE ADI VE BAĞLAM

**MUHASEBE OPERASYON SİSTEMİ** — Acme şirketler grubu ve Aile bireyleri şahıs/ev/mülk muhasebe operasyonlarını tek çatıdan yöneten kurumsal Django web uygulaması. MVP-1 kapsamında 16 modül + master tablolar + chat (MVP-3).

---

## 2. DESIGN KAYNAKLARI

| Doküman | Konum | Önem |
|---|---|---|
| Master Anayasa | `_docs/PROJECT_ANAYASA.md` | **Bağlayıcı** |
| UI/UX Anayasası | `_docs/PHASE0C_UI_UX_ANAYASA.md` | **Bağlayıcı** |
| Developer UI Handoff (Faz 0C) | `_docs/PHASE0C_DEVELOPER_UI_HANDOFF.md` | Tokens + kurallar |
| Component Inventory | `_docs/DESIGN_COMPONENT_INVENTORY.md` | 49 component referans |
| Status Badge System | `_docs/DESIGN_STATUS_BADGE_SYSTEM.md` | 23 status + 6 yöntem |
| Mobile Audit | `_docs/DESIGN_MOBILE_AUDIT.md` | Mobil özet |
| Design Freeze | `_docs/DESIGN_FREEZE_DECISION.md` | Sürüm kontrolü |
| Design Canvas | `design-canvas.jsx` (root) | 26 frame görsel prototip |
| Final Audit | `_analysis/reports/SPRINT1H_FINAL_DESIGN_AUDIT.md` | 30 PASS, freeze hazır |

---

## 3. FREEZE EDİLEN FRAME LİSTESİ (26)

### Desktop (20)
| ID | Frame | Modül |
|---|---|---|
| 00 | Design System | Token + component katalog |
| 01 | App Shell | Topbar + SideNav + içerik şablon |
| 02 | Dashboard | Operasyon merkezi |
| 03 | Import Center | Yükleme + 3 adımlı stepper |
| 04 | Import Preview | 3 panel + onay/red |
| 05 | Fatura/Ödeme Listesi | DataTable + filter |
| 06 | Fatura/Ödeme Detay | 7 tab + drawer |
| 07 | Ödeme İşaretleme Modal | Form + dekont yükle |
| 08 | Abonelik & Taahhüt | Liste + taahhüt takvimi |
| 09 | SiteX Daire/Aidat | 5 daire + timeline + farklar + arşiv |
| 10 | Emlak Vergisi Grid | Mülk × yıl/dönem matrisi |
| 11 | Teminat Mektupları | Liste + komisyon timeline + risk chart |
| 12 | Resmi Ödemeler | BAĞKUR/SSK/BES/İTO grid + 5 kategori |
| 13 | Düzenli Ödemeler / Kira | Liste + ay matrisi önizleme |
| 14 | ETA/Papinet/Entegratör/Kontör | Liste + kontör bar + risk |
| 15 | Ajanda & Görev | 7 tab + drawer + kanban mini |
| 16 | Bildirim/Telegram | 4 aşamalı kapı + log + kanal |
| 17 | Raporlama / Export | Şablon + filtre + geçmiş |
| 18 | AuditLog | 9 kolon + drawer + trend |
| 19 | Yetki & Master | 9 tab + matris + simülasyon |

### Mobile (6) — iPhone Pro Max 430×932
| ID | Frame |
|---|---|
| 20 | Mobile Dashboard |
| 21 | Mobile Bugünkü Görevler |
| 22 | Mobile Ödeme Listesi |
| 23 | Mobile Ödeme Detay & Dekont |
| 24 | Mobile Import Kontrol |
| 25 | Mobile Chat Fullscreen |

---

## 4. UI TEMEL KARARLARI (KESİN)

| # | Karar |
|---|---|
| 4.1 | **Dark mode YOK.** Sadece light tema. `prefers-color-scheme: dark` media query eklenmez. |
| 4.2 | **Lacivert/indigo dominant + sınırlı altın aksent + sakin ERP karakteri.** |
| 4.3 | **Mobile-first responsive.** iPhone Pro Max 430×932 referans cihaz. |
| 4.4 | **Form input mobile minimum 16px** font (iOS auto-zoom önleme). |
| 4.5 | **Touch target minimum 44×44px.** |
| 4.6 | **Tablo mobile'de YASAK.** Otomatik kart akışına dönüş. |
| 4.7 | **Sol menü grupları sabit:** Operasyon / Mülk-Şahıs / Şirket / Resmi-Banka / Sistem. |
| 4.8 | **Para `₺ 1.234,56` · Tarih `dd.MM.yyyy` · Locale TR.** |
| 4.9 | **Sağ alt chat widget** her sayfada (collapsed default) · mobil fullscreen. |
| 4.10 | **WCAG 2.1 AA** kontrast + keyboard nav + ARIA zorunlu. |

---

## 5. KULLANILACAK FONTLAR

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

:root {
  --font-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}
```

- **UI metin / başlık / buton:** IBM Plex Sans
- **Veri / tutar / tarih / no / kod / dönem:** IBM Plex Mono
- **YASAK:** Inter, JetBrains Mono, Roboto, sans-serif default

> Self-host önerilir (KVKK + offline). Subset: `latin-ext` (Türkçe karakter).

---

## 6. RENK TOKENLARI

```css
:root {
  /* Brand — Lacivert/Indigo */
  --brand-900: #0F2540;
  --brand-700: #1E3A5F;
  --brand-500: #3B5F8A;
  --brand-300: #A8BBD3;
  --brand-100: #E8EEF6;

  /* Aksent — Altın (sınırlı) */
  --accent-500: #D4A93C;
  --accent-100: #FAF1D6;

  /* Nötr */
  --neutral-0: #FFFFFF;
  --neutral-50: #F8F9FA;
  --neutral-100: #F1F3F5;
  --neutral-200: #E5E7EB;
  --neutral-400: #9CA3AF;
  --neutral-600: #4B5563;
  --neutral-900: #1A1A1A;

  /* Semantic — sadece status/badge */
  --success-500: #16A34A; --success-100: #DCFCE7;
  --warning-500: #F59E0B; --warning-100: #FEF3C7;
  --danger-500:  #DC2626; --danger-100:  #FEE2E2;
  --info-500:    #2563EB; --info-100:    #DBEAFE;
  --orange-500:  #F97316; --orange-100:  #FFEDD5;
  --purple-500:  #7C3AED; --purple-100:  #EDE9FE;
}
```

---

## 7. COMPONENT ÖNCELİĞİ (Faz 2 implementation sırası)

### P0 — Foundation (Hafta 1-2)
AppShell, TopBar, SideNav, MobileTopBar, MobileFrame, Card, Button, StatusTag, PayMethodTag, Input, Select, Textarea, DatePicker, FileUploader, Modal, Drawer, EmptyState, Skeleton, Toast, Alert, Avatar.

### P1 — Data + Listing (Hafta 3)
DataTable, MobileCard, KpiCard, RiskCard, FilterBar, Chip, Tabs, Stepper, Pagination, ChatWidgetCollapsed, MobileChatFab, BottomSheet.

### P2 — Modül-spesifik (Hafta 4-5)
ImportPreviewLayout, ImportRowCard, MappingEditor, TaskCard, TaskDetailDrawer, AuditTimeline, EmlakGrid, MonthTimelineGrid, KontorBar, PruvaDaireCard, KomisyonTimeline.

### P3 — Real-time + ileri (Hafta 6+)
KanbanBoard, ChatFullscreen (WebSocket), MessageList, MessageInput, ThreadContext, NotificationGate, PermissionMatrix, ReportCard.

---

## 8. İLK İMPLEMENTASYON SIRASI (Faz 2 Scaffold)

**Hedef:** Login + Dashboard'un boş halini canlıya almak (Day 5'e kadar).

1. **Day 1:** Django projesi + tokens.css + base.html + IBM Plex font self-host.
2. **Day 2:** AppShell + TopBar + SideNav + 5 grup statik nav (route placeholder).
3. **Day 3:** Login sayfası + auth (Django built-in).
4. **Day 4:** Dashboard skeleton + 4 KPI placeholder + EmptyState.
5. **Day 5:** ChatWidgetCollapsed (sağ alt görünür placeholder, henüz aktif değil) + Toast + Modal foundation.

Ardından Faz 3 (Import Merkezi) → Faz 4 (Fatura/Ödeme) → ... PROJECT_ANAYASA Madde 5 sırası.

---

## 9. CSS / TOKEN ÖNERİSİ

Tek dosya: `static/css/tokens.css` veya `tailwind.config.js` (extend.colors).

**Tailwind tercih edilirse:**
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: { 100: '#E8EEF6', 300: '#A8BBD3', 500: '#3B5F8A', 700: '#1E3A5F', 900: '#0F2540' },
        accent: { 100: '#FAF1D6', 500: '#D4A93C' },
        // ...
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '6px', md: '8px', lg: '12px', xl: '16px' },
    },
  },
};
```

**Django Templates + Tailwind kombinasyonu önerilir** (HTMX ile birlikte; React'a gerek yok başlangıçta).

---

## 10. RESPONSIVE BREAKPOINT ÖNERİSİ

| Breakpoint | Değer | Kullanım |
|---|---|---|
| `sm` | 640px | Mobile küçük cihaz |
| `md` | 768px | **Tablo→Kart switch** (kritik) |
| `lg` | 1024px | Sol menü 240px expanded |
| `xl` | 1280px | Drawer + content rahat |
| `2xl` | 1536px | Max-width 1440 ortala |

**Mobile-first:** default <640, sonra `md:`, `lg:`, `xl:` modifier'ları.

---

## 11. MOBİL KURALLAR (DESIGN_MOBILE_AUDIT.md özeti)

- Tablo yasak — `<MobileCard>` akışı.
- Input fontSize 16 zorunlu (`@media (max-width: 768px) { input { font-size: 16px; } }`).
- Touch target ≥44×44 her interaktif element.
- Sticky bottom action bar uzun formlarda.
- FAB (+) liste ekranlarında sağ alt 80px üstte (chat FAB ile çakışmasın).
- Modal/Drawer ≤640px fullscreen (`@media (max-width: 640px) { ... position: fixed; inset: 0; }`).
- Capture="camera" attribute dekont fotoğraf input'unda.
- iOS safe-area: `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)`.
- Reduced-motion: `@media (prefers-reduced-motion: reduce) { animation-duration: 0ms; }`.

---

## 12. TEST / SMOKE KONTROL LİSTESİ

Her sayfa/component implement edildiğinde:

- [ ] 3 viewport (390 / 768 / 1440) görsel test
- [ ] Klavye nav (Tab, Enter, ESC, F2)
- [ ] Focus ring görünür her butonda
- [ ] ARIA label icon-only butonlarda
- [ ] Form: required validation + error mesajı + loading state
- [ ] Empty state ikon + metin + CTA mevcut
- [ ] Loading skeleton mevcut
- [ ] Error state (API hatası) gösteriliyor
- [ ] Modal/Drawer ESC + overlay click kapatır (yıkıcı modal istisnası)
- [ ] Mobile modal/drawer fullscreen
- [ ] Tablo mobile'de kart akışına dönüyor
- [ ] StatusTag ikon + metin + renk birlikte (renk-only YASAK)
- [ ] Para format `₺ 1.234,56` mono font
- [ ] Tarih format `dd.MM.yyyy` mono font
- [ ] Mobile input 16px font
- [ ] Touch target ≥44×44 axe DevTools test
- [ ] **Dark mode YOK** (negatif test — `prefers-color-scheme: dark` değer farkı yok)
- [ ] AuditLog kayıt yazılıyor (CRUD sonrası)
- [ ] Soft-delete davranışı (silme yerine `is_active=False`)
- [ ] WCAG kontrast otomatik tool (axe)
- [ ] Türkçe karakter ş/ğ/ı/İ/ç/ö/ü doğru render
- [ ] Reduced-motion testi
- [ ] ⌘K arama açılıyor
- [ ] Chat widget sağ altta görünür (mobile FAB)
- [ ] Çıkışta "kaydetmedin" uyarısı (form değiştiyse)

---

## 13. YASAK PATTERNLER (Negative Constraints)

❌ Dark mode toggle / `prefers-color-scheme: dark` CSS
❌ Inter font / JetBrains Mono font
❌ Mobile'de `<table>` veya grid-tablo
❌ Touch target <44px (sadece dekoratif)
❌ Mobile input font <16px
❌ "Sadece renk ile bilgi iletme" — ikon eşliği zorunlu
❌ Sayfa BG'sinde geniş semantic dolgu (success/warning/danger)
❌ Hard-delete (Super Admin istisnası dışında)
❌ Render edilmeyen modal stack (max 2 katman)
❌ `outline: none` focus state (zorunlu görünür ring)
❌ Sınırsız Telegram gönderim (3 aşamalı kapı, gerçek default kapalı)

---

## 14. NEGATİF UYARI — JSX PROTOTİP

> 🚫 **`design-canvas.jsx` içindeki kod doğrudan production'a kopyalanmaz.**
>
> - Inline `style={{ ... }}` örneği — production'da Tailwind utility class veya CSS Modules.
> - Hardcoded data dizileri — production'da Django context veya API.
> - Single-file React — production'da Django Templates + bileşenler veya React proje yapısı.
> - Görsel doğruluk **referanstır**, yapı/state/props Faz 2'de finalize edilir.

Tasarım çizimi → semantic HTML + erişilebilir component + production state yönetimi yolculuğu Faz 2'nin işidir.

---

## 15. FAZ 1'DE NETLEŞTİRİLECEK KARARLAR

(Faz 1 başlamadan önce)
- **D-015** PostgreSQL onayı
- **D-016** Auth: Django built-in + 2FA?
- **D-017** Hosting: ayrı VPS (izolasyon)
- **D-018** Eski yıllar import (2020+ flag'li)

(Faz 2 başlamadan önce)
- **D-008** Çift onaylı ödeme tutar eşiği
- **D-011** Zorunlu dekont tutar eşiği
- **D-021** Tutar eşik değerleri (örn. 5K / 50K TL)

---

**SON.** Faz 1 ve Faz 2 ekibi (Claude Code) bu dokümanı + freeze dosyalarını referans alacaktır.
