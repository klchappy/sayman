# FAZ 0C — UI/UX TASARIM ANAYASASI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Sürüm:** 1.0
**Tarih:** 2026-05-05
**Bağlayıcılık:** PROJECT_ANAYASA.md Madde 11'in genişletilmiş hâli — Faz 0D ve sonrası için bağlayıcı.

---

## 1. TASARIM PRENSİPLERİ (KESİN)

| # | Prensip |
|---|---|
| 1.1 | **Dark mode YOK.** Sadece light tema. Tasarımda dark mode toggle çizilmez. |
| 1.2 | Kurumsal, sade, modern, beyaz arka planlı, profesyonel görünüm. |
| 1.3 | **Kart tabanlı dashboard.** KPI ve risk kartları üstte, widget grid altta. |
| 1.4 | Profesyonel status badge sistemi (renkli rozet + ikon + metin). |
| 1.5 | **Mobilde tablo değil kart.** Tüm veri tabloları responsive olarak kart akışına dönüşür. |
| 1.6 | iPhone Pro Max (430×932) dahil 3 cihaz boyutu zorunlu test edilir. |
| 1.7 | Input/Select/Textarea mobile minimum **16px** font-size (iOS auto-zoom önleme). |
| 1.8 | Buton touch target minimum **44×44px**. |
| 1.9 | Kaydetmeden çıkış uyarısı (`beforeunload` + modal). |
| 1.10 | Uzun formlarda üst ve alt **ikili kaydet butonu** standardı. |
| 1.11 | Boş durum (empty state) zorunlu: ikon + açıklama + CTA butonu. |
| 1.12 | Filtre bar + arama + tarih aralığı + modül filtresi her liste ekranında. |
| 1.13 | Modal/onay standardı: yıkıcı (kırmızı), onay (mavi/lacivert), iptal (gri). |
| 1.14 | Import preview: **sol belge önizleme + sağ veri doğrulama** standart layout. |
| 1.15 | Ajanda ve chat **operasyon parçası** — widget olarak her sayfada erişilebilir. |
| 1.16 | Para `₺ 1.234,56`, tarih `dd.MM.yyyy`, locale TR. |
| 1.17 | Tüm form alanlarında inline validation + alan altında hata mesajı. |
| 1.18 | Loading state için skeleton screen tercih edilir (spinner ikinci tercih). |
| 1.19 | Erişilebilirlik: WCAG 2.1 AA hedefi (kontrast, keyboard navigation, ARIA). |
| 1.20 | Araç Takip Sistemi modern Acme UI çizgisinden ilham; ancak bu proje **kendi kimliğini** taşır (muhasebe odaklı, daha sakin renk dengesi). |

---

## 2. TASARIM DİLİ

### 2.1 Renk Paleti

#### Birincil (Brand)
- `--brand-900`: `#0F2540` (kurumsal lacivert — koyu)
- `--brand-700`: `#1E3A5F` (kurumsal lacivert — primary)
- `--brand-500`: `#3B5F8A` (lacivert — orta)
- `--brand-300`: `#A8BBD3` (lacivert — açık)
- `--brand-100`: `#E8EEF6` (lacivert — bg vurgu)

#### Aksent (Acme sarısı/altın — opsiyonel)
- `--accent-500`: `#D4A93C` (altın aksent — sınırlı kullanım)
- `--accent-100`: `#FAF1D6` (altın bg açık)

#### Nötr (Yüzey/metin)
- `--neutral-0`: `#FFFFFF` (yüzey — kart arka)
- `--neutral-50`: `#F8F9FA` (sayfa arka)
- `--neutral-100`: `#F1F3F5` (hover)
- `--neutral-200`: `#E5E7EB` (sınır)
- `--neutral-400`: `#9CA3AF` (placeholder, ikon pasif)
- `--neutral-600`: `#4B5563` (metin ikincil)
- `--neutral-900`: `#1A1A1A` (metin birincil)

#### Durum (Semantic)
- `--success-500`: `#16A34A` / `--success-100`: `#DCFCE7`
- `--warning-500`: `#F59E0B` / `--warning-100`: `#FEF3C7`
- `--danger-500`: `#DC2626` / `--danger-100`: `#FEE2E2`
- `--info-500`: `#2563EB` / `--info-100`: `#DBEAFE`
- `--neutral-tag`: `#9CA3AF` (iptal/pasif)
- `--purple-500`: `#7C3AED` / `--purple-100`: `#EDE9FE` (manuel doğrulama)

### 2.2 Tipografi
- **Font ailesi:** Inter (öncelik), IBM Plex Sans (yedek), system-ui (fallback)
- **Mono:** JetBrains Mono / IBM Plex Mono (sayı, kod, hesap no)
- **Hierarchy:**
  - `h1`: 28px / 36 line / 700
  - `h2`: 24px / 32 / 700
  - `h3`: 20px / 28 / 600
  - `h4`: 18px / 26 / 600
  - `body`: 14px / 22 / 400
  - `body-lg`: 16px / 24 / 400
  - `body-sm`: 13px / 20 / 400
  - `caption`: 12px / 18 / 500
  - **Mobil input/select/textarea:** minimum 16px (zorunlu).
- Türkçe karakter desteği zorunlu (ş, ğ, ı, İ, ç, ö, ü).

### 2.3 Spacing
4px baz ızgara: `2 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`.
Component padding genelde 16px (sm) / 20px (md) / 24px (lg).

### 2.4 Border Radius
- `--r-sm`: 6px (badge, küçük input)
- `--r-md`: 8px (buton, input)
- `--r-lg`: 12px (kart, modal)
- `--r-xl`: 16px (büyük modal, drawer)
- `--r-full`: 9999px (pill, avatar)

### 2.5 Shadow / Elevation
- `--shadow-xs`: `0 1px 2px rgba(0,0,0,0.05)` — input
- `--shadow-sm`: `0 2px 6px rgba(15,37,64,0.06)` — kart
- `--shadow-md`: `0 6px 16px rgba(15,37,64,0.10)` — popover, drawer
- `--shadow-lg`: `0 16px 32px rgba(15,37,64,0.16)` — modal
- `--shadow-xl`: `0 24px 56px rgba(15,37,64,0.20)` — chat widget expanded

### 2.6 Grid / Layout
- 12 kolon, 16px gutter (≥1024px)
- 8 kolon (768-1023px)
- 4 kolon (≤767px)
- Maksimum içerik genişliği: 1440px
- Sol menü: 240px expanded / 64px collapsed
- Topbar: 56px sabit
- Sayfa padding: 24px (desktop) / 16px (mobile)

---

## 3. COMPONENT STANDARTLARI

### 3.1 Kart (`Card`)
- BG: `--neutral-0`, border: `1px solid --neutral-200`, radius: `--r-lg`, shadow: `--shadow-sm`.
- İç padding: 20px (md), 24px (lg).
- Header: başlık (h4) + sağ aksiyon butonu/dropdown.
- Body: ana içerik.
- Footer: opsiyonel; sağa hizalı aksiyonlar.

### 3.2 Buton (`Button`)
| Variant | BG | Metin | Sınır | Kullanım |
|---|---|---|---|---|
| `primary` | `--brand-700` | white | — | Ana aksiyon (Kaydet, Onayla) |
| `secondary` | `--neutral-0` | `--brand-700` | `--brand-700` | İkincil |
| `ghost` | transparent | `--neutral-600` | — | Tablo aksiyon, mini |
| `danger` | `--danger-500` | white | — | Sil, reddet |
| `success` | `--success-500` | white | — | Onayla (yeşil tercih edilen yerlerde) |
| `link` | transparent | `--brand-700` | — | Inline link |

Boyutlar: `sm` (32px), `md` (40px), `lg` (48px), `xl` (56px). Mobile minimum `md` (44px target ile).
Loading state: spinner + disabled. İkon-buton minimum 44×44px.

### 3.3 Form
- Label üstte; alan altında hint, hata mesajı.
- Required `*` kırmızı.
- Disabled `--neutral-100` BG.
- Inline validation: focus dışına çıkınca; submit'te tüm alanlar.
- Error border: `--danger-500`. Hata metni: `--danger-500`, 12px.
- DatePicker: TR locale, format `dd.MM.yyyy`, takvim popover (mobile native picker fallback).
- Select: searchable (>10 seçenek), multi-select tag preview.
- File uploader: drag-drop alanı + browse buton + dosya listesi.

### 3.4 Tablo (`DataTable`)
- Header sticky (sayfa scroll'unda).
- Sütun sıralama, sütun gizle/göster, kolon genişlik resize.
- Satır seçimi (checkbox) + toplu aksiyon barı.
- Satır hover: `--neutral-50`.
- Pagination veya virtualized infinite scroll (>500 satır).
- **Mobile breakpoint'te kart akışına dönüş** (zorunlu).
- Boş durum: ikon + metin + CTA.

### 3.5 Mobil Kart (`MobileListCard`)
- Tek satır per kayıt.
- Üst satır: başlık (semibold) + sağda durum badge.
- Orta: 2 satır kritik bilgi (örn. tutar + son ödeme).
- Alt: meta (kurum/şirket) + sağda ">" ok ikonu (detaya git).
- Tap → detay sayfası. Long-press → quick actions menüsü.

### 3.6 Badge / Status Tag
- Pill (radius full) veya rounded square (`--r-sm`).
- Boyut: 24px height, 8px horizontal padding, 12px font.
- Renk paleti tablosu: Bölüm 4'te detay.

### 3.7 Alert / Banner
- 4 variant: `info | success | warning | danger`.
- Sol kenar 4px renkli border + arka 100-tonu BG.
- İkon + başlık + açıklama + opsiyonel kapat butonu.

### 3.8 Modal
- Overlay: `rgba(15,37,64,0.5)` blur.
- Container: max-w 480 (sm), 640 (md), 800 (lg). Radius `--r-lg`. Shadow `--shadow-lg`.
- Header: başlık + kapat (X). Body scroll'lu. Footer: sağa hizalı butonlar.
- Mobile: tam ekran (≤640px).
- ESC + overlay click + X kapatır. Yıkıcı modallarda overlay click kapatmaz.

### 3.9 Drawer / Sidebar
- Sağdan veya soldan kayan panel.
- Genişlik: 360 (sm), 480 (md), 720 (lg).
- Detay sayfaları için sağ drawer önerilir (görev detayı, fatura quick-view, mapping editor).
- Mobile: tam ekran.

### 3.10 Toast / Notification
- Sağ üst köşe.
- Otomatik kapatma 5 sn (success/info), 8 sn (warning), manuel (danger).
- Maks 3 toast aynı anda. FIFO.

### 3.11 Tabs
- Underline stili (modern, sade).
- Aktif: `--brand-700` border 2px alt. Pasif: `--neutral-600` metin.
- Mobile: yatay scroll.

### 3.12 Chip / Filter Tag
- Filtre bar'da seçili filtre göstergesi.
- "X" ile kaldırma. "Filtreleri temizle" butonu.

### 3.13 Empty State
- Merkezi hizalı: ikon (64px) + başlık + açıklama + CTA buton.
- Örn. "Henüz fatura yok. İlk faturayı ekleyin veya import edin." [Ekle] [Import]

### 3.14 KPI Card
- Üstte küçük etiket (caption, neutral-600).
- Ortada büyük sayı (28px / bold).
- Altta delta (örn. "↑ %12 geçen aya göre", yeşil/kırmızı).
- Sağ üstte modül ikonu.
- Tıklanabilir → ilgili modül liste ekranı.

### 3.15 Risk Card
- KPI'dan farklı: kırmızı/turuncu sol kenar 4px.
- Sayı + risk açıklaması ("3 kayıt komisyon ödemesi yaklaşıyor (T-7)").
- "Detay göster" link butonu.

### 3.16 Import Preview Component (kritik)
- 3 panel layout: header (özet) + sol (belge) + sağ (data table).
- Renkli satır işaretleri: yeşil (ok), sarı (uyarı), kırmızı (hata), mor (manuel doğrulama).
- Inline edit + sağ panel detay düzeltme.

### 3.17 Chat Widget (MVP-3)
- Sağ alt köşe sabit. Collapsed (zarf ikon + rozet) / Expanded (360×500 popup).
- Tam ekran toggle.
- Mobile: full-screen.

### 3.18 Calendar / Ajanda
- 3 mod: gün (saatli), hafta (kişi swimlane), ay (heatmap).
- Görev kartı: rengi öncelik göre.
- Tıklama → görev detay drawer.

### 3.19 File Uploader
- Drag-drop alan + browse.
- Yüklenen liste: thumbnail + ad + boyut + sil/önizle.
- PDF/JPG/XLSX/RAR tipi ikon farklı.

### 3.20 Avatar
- Yuvarlak. Boyut: xs (24), sm (32), md (40), lg (56).
- Fotoğraf yoksa initials + renkli BG (kullanıcı bazlı sabit hash rengi).

---

## 4. STATUS BADGE SİSTEMİ (TAM TABLO)

| # | Durum | Renk | İkon (lucide) | Kullanım |
|---|---|---|---|---|
| 1 | **Bekliyor** | Sarı `warning-500/100` | `Clock` | Ödeme bekleniyor |
| 2 | **Yaklaşıyor** | Turuncu `#F97316/100` | `AlertCircle` | T-7 içinde |
| 3 | **Gecikti** | Kırmızı `danger-500/100` | `AlertTriangle` | Son tarih geçti |
| 4 | **Ödendi** | Yeşil `success-500/100` | `CheckCircle2` | Tamamlanmış ödeme |
| 5 | **Kısmi Ödendi** | Yeşil-koyu (`#0F766E`) `100` | `Pie` | Eksik tutar var |
| 6 | **İptal** | Gri `neutral-tag` | `XCircle` | Kayıt iptal |
| 7 | **Pasif** | Gri açık `neutral-200` | `EyeOff` | Soft-delete arşiv |
| 8 | **Arşiv** | Gri açık | `Archive` | Tamamlanmış/geçmiş |
| 9 | **Kontrol Gerekli** | Mor `purple-500/100` | `ShieldAlert` | Manuel doğrulama bekliyor |
| 10 | **Taslak** | Mavi `info-500/100` | `FileEdit` | Kaydedilmemiş |
| 11 | **Onaylandı** | Yeşil `success-500/100` | `BadgeCheck` | Onaylanmış |
| 12 | **Import Bekliyor** | Mavi `info-500/100` | `Upload` | Onay bekliyor |
| 13 | **Dekont Eksik** | Turuncu `warning-500/100` | `FileMinus` | Ödeme var dekont yok |
| 14 | **Fatura Eksik** | Turuncu | `FileWarning` | Ödeme var fatura yok |
| 15 | **Görev Açık** | Mavi `info-500/100` | `ListTodo` | Aktif görev |
| 16 | **Görev Tamamlandı** | Yeşil `success-500/100` | `CheckSquare` | Tamamlanmış |
| 17 | **Görev Ertelendi** | Sarı `warning-500/100` | `Clock4` | Yeni tarihe |
| 18 | **Kritik** | Kırmızı (yoğun) | `Siren` | Acil dikkat |
| 19 | **Aktif** | Yeşil | `CircleDot` | Yürürlükte |
| 20 | **Yenilendi** | Mavi | `RefreshCw` | Sözleşme yenilendi |
| 21 | **İade Edildi** | Gri | `RotateCcw` | Teminat mektubu iade |
| 22 | **Komisyon Yaklaşan** | Turuncu | `Banknote` | T-7 komisyon |
| 23 | **Kontör Kritik** | Kırmızı (yoğun) | `BatteryLow` | <500 |

Badge format: `[ikon 14px] [METİN UPPERCASE 12px semibold]` — pill rounded full.

---

## 5. TIPOGRAFİ HİYERARŞİSİ KULLANIMI

| Yer | Stil |
|---|---|
| Sayfa başlığı | h1 |
| Bölüm başlığı | h2 |
| Kart başlığı | h4 |
| Tablo başlık | caption uppercase |
| Tablo hücre | body-sm |
| Form label | body-sm semibold |
| Form input | body |
| Mobile form input | body-lg (16px zorunlu) |
| KPI sayı | 28px bold |
| KPI etiket | caption uppercase |
| Para tutar | mono semibold |

---

## 6. ANIMASYON / GEÇİŞ

- Süreler: 150ms (micro), 220ms (default), 320ms (modal/drawer).
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Hover transitions: BG ve border 150ms.
- Skeleton: shimmer 1.4s.
- Reduced motion media query desteklenir.

---

## 7. ERİŞİLEBİLİRLİK

- WCAG 2.1 AA kontrast oranı (>4.5:1 metin, >3:1 büyük metin).
- Keyboard navigation: tab, enter, esc, ok tuşları, F2 inline edit.
- Focus ring görünür: 2px `--brand-500` outline + 2px offset.
- ARIA label tüm icon-only butonlarda.
- Form alanları `<label for>` zorunlu.
- Toast'lar `role="status"` veya `role="alert"`.

---
