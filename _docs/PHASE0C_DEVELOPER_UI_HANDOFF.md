# FAZ 0C — GELİŞTİRİCİ UI HANDOFF
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05
**Hedef Kullanıcı:** Faz 2 (scaffold) ve sonraki fazlarda kod yazacak geliştiriciler.
**Durum:** Faz 0C UI/UX anayasasının kod tarafı uygulama rehberi.

---

## 1. STACK ÖNERİSİ (Faz 1'de finalize)

- **Backend:** Django 5.x (Python 3.12+)
- **Frontend:** Django templates + HTMX + Alpine.js (server-side rendered, **SPA değil**) — alternatif: Django + DRF + React (Faz 1 kararı, D-016 ile birlikte).
- **CSS framework:** Tailwind CSS (custom config + design tokens).
- **Component library:** Tailwind UI / shadcn-ui benzeri, Türkçe ihtiyaçlara özel custom set.
- **PDF render:** PDF.js (client-side).
- **Excel parse:** openpyxl (server-side).
- **Date:** Day.js TR locale.
- **Icon:** Lucide.

> Stack kararı `D-016` (auth) ve `D-017` (hosting) ile birlikte Faz 1'de kesinleşir.

---

## 2. KLASÖR YAPISI ÖNERİSİ

```
backend/
├── apps/
│   ├── core/              # ortak base model, mixin, audit
│   ├── accounts/          # User, Rol, Yetki
│   ├── master/            # Sahis, Sirket, Mulk, Banka, Kurum
│   ├── fatura/
│   ├── odeme/
│   ├── abonelik/
│   ├── pruva34/
│   ├── emlak/
│   ├── teminat/
│   ├── kira/
│   ├── resmi/
│   ├── entegrator/
│   ├── ajanda/            # Görev sistemi
│   ├── chat/              # MVP-3
│   ├── bildirim/
│   ├── importmerkez/
│   ├── rapor/
│   └── audit/
├── static/
│   ├── css/
│   │   └── tokens.css     # Design tokens (Bölüm 4)
│   └── js/
├── templates/
│   ├── base.html
│   ├── components/        # _button.html, _card.html, _badge.html, vb.
│   └── <app>/
└── config/
```

---

## 3. COMPONENT İSİMLENDİRME

### 3.1 Template (Django partial) konvansiyonu
```
templates/components/_button.html
templates/components/_card.html
templates/components/_badge.html
templates/components/_status_tag.html
templates/components/_data_table.html
templates/components/_mobile_list_card.html
templates/components/_filter_bar.html
templates/components/_kpi_card.html
templates/components/_risk_card.html
templates/components/_empty_state.html
templates/components/_modal.html
templates/components/_drawer.html
templates/components/_toast.html
templates/components/_alert.html
templates/components/_tabs.html
templates/components/_stepper.html
templates/components/_chip.html
templates/components/_file_uploader.html
templates/components/_avatar.html
templates/components/_audit_timeline.html
templates/components/_pagination.html
```

### 3.2 Modül-spesifik component'lar
```
templates/importmerkez/_preview_layout.html      # 3 panel
templates/importmerkez/_mapping_editor.html
templates/importmerkez/_row_editor.html
templates/importmerkez/_renkli_satir.html
templates/ajanda/_task_card.html
templates/ajanda/_task_detail_drawer.html
templates/ajanda/_task_timeline.html
templates/ajanda/_kanban_board.html
templates/ajanda/_calendar_day.html
templates/ajanda/_calendar_week.html
templates/ajanda/_calendar_month.html
templates/chat/_widget.html
templates/chat/_message_list.html
templates/chat/_message_input.html
templates/chat/_thread_context.html
templates/pruva34/_daire_card.html
templates/pruva34/_month_timeline.html
templates/pruva34/_ekstre_pdf_viewer.html
templates/emlak/_grid.html
templates/abonelik/_taahhut_calendar.html
templates/teminat/_komisyon_timeline.html
```

### 3.3 React/Vue alternatif konvansiyonu (D-016 kararına göre)
```
src/components/
├── primitives/    # Button, Input, Select, Card, Badge, Modal, Drawer, ...
├── data/          # DataTable, MobileListCard, FilterBar, EmptyState, ...
├── layout/        # TopBar, SideNav, PageContainer, ...
├── importmerkez/
├── ajanda/
├── chat/
└── ...
```

---

## 4. CSS TOKEN ÖNERİSİ

`static/css/tokens.css`:

```css
:root {
  /* Brand */
  --brand-900: #0F2540;
  --brand-700: #1E3A5F;
  --brand-500: #3B5F8A;
  --brand-300: #A8BBD3;
  --brand-100: #E8EEF6;

  /* Accent */
  --accent-500: #D4A93C;
  --accent-100: #FAF1D6;

  /* Neutral */
  --neutral-0: #FFFFFF;
  --neutral-50: #F8F9FA;
  --neutral-100: #F1F3F5;
  --neutral-200: #E5E7EB;
  --neutral-400: #9CA3AF;
  --neutral-600: #4B5563;
  --neutral-900: #1A1A1A;

  /* Semantic */
  --success-500: #16A34A;
  --success-100: #DCFCE7;
  --warning-500: #F59E0B;
  --warning-100: #FEF3C7;
  --danger-500: #DC2626;
  --danger-100: #FEE2E2;
  --info-500: #2563EB;
  --info-100: #DBEAFE;
  --orange-500: #F97316;
  --orange-100: #FFEDD5;
  --purple-500: #7C3AED;
  --purple-100: #EDE9FE;

  /* Spacing */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px;
  --sp-12: 48px; --sp-16: 64px;

  /* Radius */
  --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-xl: 16px; --r-full: 9999px;

  /* Shadow */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 2px 6px rgba(15,37,64,0.06);
  --shadow-md: 0 6px 16px rgba(15,37,64,0.10);
  --shadow-lg: 0 16px 32px rgba(15,37,64,0.16);
  --shadow-xl: 0 24px 56px rgba(15,37,64,0.20);

  /* Typography */
  --font-sans: 'Inter', 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', monospace;

  /* Z-index */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal-overlay: 900;
  --z-modal: 950;
  --z-toast: 1000;
  --z-chat-widget: 1100;
}

/* Dark mode YASAK — bu blok ASLA eklenmez:
@media (prefers-color-scheme: dark) { ... }   ← YOK
*/
```

---

## 5. LAYOUT KURALLARI

| # | Kural |
|---|---|
| 5.1 | `<TopBar>` 56px sabit, sticky top. |
| 5.2 | `<SideNav>` 240px expanded / 64px collapsed; mobile drawer. |
| 5.3 | `<PageContainer>` max-width 1440px, padding 24px (desktop) / 16px (mobile). |
| 5.4 | Sticky table header tüm DataTable'larda. |
| 5.5 | Detail page sticky bottom action bar form modunda. |
| 5.6 | Sağ alt `<ChatWidget>` z-index 1100, her sayfada include. |
| 5.7 | Modal overlay z-index 900, modal 950. |
| 5.8 | Toast z-index 1000 (chat'ten alt). |
| 5.9 | Breadcrumb topbar altında 36px, mobile gizli. |
| 5.10 | Mobile bottom nav YOK (sol menü drawer ile yeterli). |

---

## 6. FORM KURALLARI

| # | Kural |
|---|---|
| 6.1 | Label üstte (12px caption uppercase weight 600). |
| 6.2 | Required `*` kırmızı yıldız. |
| 6.3 | Hint alan altında (12px neutral-600). |
| 6.4 | Hata mesajı alan altında (12px danger-500). |
| 6.5 | Input height: sm 32 / md 40 / lg 48. Mobile minimum md. |
| 6.6 | Mobil input font-size **16px** (zorunlu — `font-size: max(14px, 16px)`). |
| 6.7 | DatePicker TR locale, format `dd.MM.yyyy`. |
| 6.8 | NumericInput: para için thousand separator nokta, decimal virgül. |
| 6.9 | FileUploader: drag-drop alanı 200px min height, browse butonu, dosya listesi alta. |
| 6.10 | Form submit Enter tuşu ile (textarea hariç). |
| 6.11 | Disabled state: BG `--neutral-100`, cursor not-allowed. |
| 6.12 | Loading state: input disabled + sağda spinner. |
| 6.13 | Inline validation: focus dışına çıkışta + submit'te. |
| 6.14 | Form değişti flag: kaydetmeden çıkışta `beforeunload` + Django modal. |
| 6.15 | Sticky bottom bar: uzun formlarda alt kaydet/iptal sticky. |
| 6.16 | Üst kaydet butonu: form 3+ section'lı ise üstte de. |
| 6.17 | Para alanı mono font + sağa hizalı. |
| 6.18 | Tarih alanı: hızlı seçim ("bugün", "yarın", "1 hafta sonra" chip'leri). |
| 6.19 | Multi-select: tag preview + Tümünü seç/temizle. |
| 6.20 | Search-in-select: 10+ option ise zorunlu. |

---

## 7. BADGE KURALLARI

```html
<!-- _status_tag.html -->
<span class="status-tag status-tag--{{ variant }}">
  {% icon name=icon size=14 %}
  <span>{{ label }}</span>
</span>
```

```css
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border-radius: var(--r-full);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.status-tag--success { background: var(--success-100); color: var(--success-500); }
.status-tag--warning { background: var(--warning-100); color: var(--warning-500); }
.status-tag--danger  { background: var(--danger-100);  color: var(--danger-500);  }
.status-tag--info    { background: var(--info-100);    color: var(--info-500);    }
.status-tag--neutral { background: var(--neutral-100); color: var(--neutral-600); }
.status-tag--orange  { background: var(--orange-100);  color: var(--orange-500);  }
.status-tag--purple  { background: var(--purple-100);  color: var(--purple-500);  }
.status-tag--critical { animation: pulse 1.5s infinite; }
```

23 durum için variant mapping:
- success: Ödendi, Onaylandı, Görev Tamamlandı, Aktif
- warning: Bekliyor, Görev Ertelendi
- orange: Yaklaşıyor, Dekont Eksik, Fatura Eksik, Komisyon Yaklaşan
- danger: Gecikti, Kontör Kritik, Kritik (pulse)
- info: Taslak, Import Bekliyor, Görev Açık, Yenilendi
- neutral: İptal, Pasif, Arşiv, İade Edildi
- purple: Kontrol Gerekli
- success-alt: Kısmi Ödendi (yeşil-koyu varyant)

---

## 8. MODAL KURALLARI

| # | Kural |
|---|---|
| 8.1 | Overlay: `rgba(15,37,64,0.5)` + backdrop-blur(2px). |
| 8.2 | Container max-w: sm 480 / md 640 / lg 800 / xl 1024. |
| 8.3 | Header: başlık + close (X 24px). Body: scroll. Footer: sağa hizalı butonlar. |
| 8.4 | ESC + overlay click + X kapatır. **Yıkıcı modallarda overlay click kapatmaz**, sadece X veya İptal. |
| 8.5 | Mobile (<640px) tam ekran. |
| 8.6 | Form modalında submit Enter; Cancel ESC. |
| 8.7 | Animasyon: 220ms fade + 4px y-translate. |
| 8.8 | Modal stack desteği (modal içinde modal): max 2 katman. |
| 8.9 | Focus trap içeride (tab keyboard). |
| 8.10 | Açılırken focus ilk input'a; kapanırken trigger butonuna. |

---

## 9. DRAWER KURALLARI

| # | Kural |
|---|---|
| 9.1 | Sağdan veya soldan kayar. |
| 9.2 | Genişlik: sm 360 / md 480 / lg 720. |
| 9.3 | Detay drawer'lar (görev, fatura quick-view) sağdan. |
| 9.4 | Mapping editor / Mesaj Merkezi context paneli soldan. |
| 9.5 | Mobile tam ekran. |
| 9.6 | Animasyon: 320ms slide. |
| 9.7 | Header sticky + footer sticky aksiyonlar. |

---

## 10. IMPORT PREVIEW KURALLARI

| # | Kural |
|---|---|
| 10.1 | 3 panel grid (header + sol + orta + sağ + alt sticky bar). |
| 10.2 | Sol panel collapsible (320px expanded / 0px collapsed). |
| 10.3 | Sağ panel sticky (360px). |
| 10.4 | Renkli satır: sol kenar 4px renk + tüm satır 8% tonu BG. |
| 10.5 | Inline edit: çift tıklama → input açılır; Enter kaydet, ESC iptal. |
| 10.6 | Toplu seçim: header checkbox + satır checkbox. |
| 10.7 | Filter chips: "Sadece hatalı / Sadece uyarılar / Tümü" toggle group. |
| 10.8 | Alt sticky bar 64px height. |
| 10.9 | Commit progress modal: progress bar + iptal butonu. |
| 10.10 | Rollback: 24 saat içinde butona aktif; sonrasında disabled + tooltip "Süre doldu". |
| 10.11 | Mobile: Tabs (Özet / Satırlar / Hatalar / Belge), tek panel. |
| 10.12 | Belge önizleme: PDF.js iframe veya Excel sheet preview iframe. |

---

## 11. CHAT WIDGET KURALLARI

| # | Kural |
|---|---|
| 11.1 | Sağ alt sabit, 16px margin. z-index 1100. |
| 11.2 | Collapsed: 56×56 zarf butonu + okunmamış rozet (kırmızı 18×18 sayı). |
| 11.3 | Expanded: 360×500 popup, shadow-xl, radius lg. |
| 11.4 | "Tam ekran" ikonu → `/mesajlar/` rotasyon. |
| 11.5 | Mobile: tap collapsed → tam ekran chat (drawer). |
| 11.6 | WebSocket bağlantı (Faz 11). |
| 11.7 | Optimistic update + retry kuyruğu. |
| 11.8 | Mesaj balonu: max-w 70%, kenarlar yuvarlak (radius lg, gönderen tarafı aşağı corner küçük). |
| 11.9 | Okundu indicator: gri tik / mavi tik. |
| 11.10 | Mention `@user` autocomplete dropdown. |
| 11.11 | Dosya drag-drop input alanına. |
| 11.12 | Kayıt-bağlantılı thread sticky context kart en üstte. |

---

## 12. MOBİL KURALLAR

| # | Kural |
|---|---|
| 12.1 | Breakpoint: sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536. |
| 12.2 | <768px: tablo → kart akışı (`<MobileListCard>`). |
| 12.3 | Form input: `font-size: 16px` zorunlu (CSS rule). |
| 12.4 | Touch target ≥44×44px. |
| 12.5 | FAB (+ floating action button) liste ekranlarında sağ alt 80px+ chat widget üstünde. |
| 12.6 | Bottom sheet: filtreler ve alt action menüler için. |
| 12.7 | Swipe gesture'lar görev kartında (Hammer.js veya touch event). |
| 12.8 | `<input type="file" capture="camera">` dekont fotoğraf. |
| 12.9 | iOS safe-area: `env(safe-area-inset-top/bottom)`. |
| 12.10 | Tab listesi yatay scroll (`overflow-x-auto`). |
| 12.11 | Modal/drawer ≤640px tam ekran. |
| 12.12 | Skeleton loading mobile'de zorunlu (yavaş ağ). |
| 12.13 | Offline banner: navigator.onLine false ise üst sticky kırmızı banner. |
| 12.14 | Pull-to-refresh listelerde (opsiyonel, Faz 13+). |

---

## 13. ACCESSIBILITY NOTLARI

| # | Kural |
|---|---|
| 13.1 | WCAG 2.1 AA hedef. |
| 13.2 | Kontrast: metin/BG ≥4.5:1, büyük metin ≥3:1, UI element ≥3:1. |
| 13.3 | Focus ring: 2px `--brand-500` outline + 2px offset. Hiçbir yerde `outline:none` kullanılmaz. |
| 13.4 | Tüm icon-only butonlarda `aria-label`. |
| 13.5 | Form `<label for="id">` zorunlu. |
| 13.6 | Toast `role="status"` (info/success), `role="alert"` (warning/danger). |
| 13.7 | Modal `role="dialog"` + `aria-modal="true"` + `aria-labelledby`. |
| 13.8 | Tab navigation mantıklı sıra. |
| 13.9 | Skip-to-content link en üstte (görünmez, focus'ta görünür). |
| 13.10 | Klavye kısayolları: Cmd/Ctrl+K (arama), ESC (kapat), Enter (submit). |
| 13.11 | Screen reader: `aria-live` regions toast ve loading için. |
| 13.12 | Reduced motion: `@media (prefers-reduced-motion: reduce)` ile animasyon süreleri 0ms'e iner. |
| 13.13 | Renk + ikon (sadece renk ile bilgi iletilmez — badge'lerde ikon zorunlu). |

---

## 14. SMOKE TEST / KONTROL LİSTESİ

Her ekran/component implement edildiğinde:

- [ ] 3 viewport (mobile 390, tablet 768, desktop 1440) görsel test.
- [ ] Klavye ile gezinme tüm interaktif öğeler erişilebilir.
- [ ] Focus ring her butonda görünür.
- [ ] ARIA label var icon-only butonlarda.
- [ ] Form: required validation, error mesajı, loading state.
- [ ] Empty state çizimi var.
- [ ] Loading state skeleton var.
- [ ] Error state (server hatası) gösteriliyor.
- [ ] Modal/drawer ESC, overlay click, X ile kapatılır (yıkıcı modal istisnası).
- [ ] Mobile'de modal tam ekran.
- [ ] Tablo mobile'de kart akışına döner.
- [ ] Status badge ikon + metin + renk.
- [ ] Para format `₺ 1.234,56`.
- [ ] Tarih format `dd.MM.yyyy`.
- [ ] Input mobile'de 16px font.
- [ ] Touch target ≥44px.
- [ ] Dark mode varyantı **YOK** (negatif test).
- [ ] AuditLog yazılıyor (CRUD aksiyonu sonrası).
- [ ] Soft-delete davranışı (silme yerine `is_active=False`).
- [ ] WCAG kontrast doğrulandı (otomatik tool: axe DevTools).
- [ ] Türkçe karakter ş/ğ/ı/İ/ç/ö/ü her yerde doğru.
- [ ] Reduced-motion test edildi.
- [ ] Cmd+K arama açılıyor.
- [ ] Chat widget sağ altta görünür ve collapse default.

---

## 15. STORYBOOK / DOKÜMANTASYON

Faz 2'de `_docs/UI_COMPONENTS.md` veya storybook benzeri bir doküman tutulur. Her component için:
- İsim
- Anatomi diyagramı (görsel)
- Variant/state listesi
- Props/template variable tablosu
- Kullanım örneği (kod)
- Erişilebilirlik notu

---

## 16. PERFORMANS KURALLARI

| # | Kural |
|---|---|
| 16.1 | İlk paint hedef <2sn (3G). |
| 16.2 | Lazy load: PDF.js, Chart.js, Chat WebSocket. |
| 16.3 | Image lazy `loading="lazy"`. |
| 16.4 | Font subset (Türkçe latin-ext). |
| 16.5 | Tablo virtualization >500 satır. |
| 16.6 | API response gzip + ETag. |
| 16.7 | Skeleton hemen render (CSS only). |

---
