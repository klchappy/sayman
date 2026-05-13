# FAZ 0C — CLAUDE DESIGN'A VERİLECEK NİHAİ PROMPT
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05
**Kullanım:** Bu dosyanın içeriği aşağıdaki "PROMPT BAŞLANGIÇ" / "PROMPT BİTİŞ" işaretleri arasındaki bölümü Claude Design'a doğrudan girdi olarak verilebilir.

---

## 📋 PROMPT BAŞLANGIÇ

Sen profesyonel bir UI/UX tasarımcısısın. **MUHASEBE OPERASYON SİSTEMİ** adlı kurumsal bir muhasebe operasyon yazılımı için tam bir design system + ilk parti 10 ekran tasarımı yapacaksın.

---

### 🎯 PROJE VİZYONU

Bu sistem **sadece bir fatura takip aracı değil**, Acme şirketler grubu ve Aile bireyleri şahıs/mülklerinin muhasebe ve finans operasyonlarını **tek çatıdan yöneten bir operasyon merkezidir**. Muhasebe ekibi (müdür + 3 muhasebeci + yönetici) günlük işlerini, ödemelerini, fatura/abonelik/teminat/emlak/SiteX/resmi ödemeler/kira gibi kalemlerini, görev ve mesajlaşmalarını bu sistemden yürütür.

Ürün sloganı (iç): "**Tek ekrandan, eksiksiz, denetlenebilir muhasebe operasyonu.**"

---

### 🧭 TASARIM PRENSİPLERİ (KESİN)

1. **Dark mode YOK.** Tek tema: light, beyaz arka plan + kurumsal lacivert vurgu. Dark mode toggle çizilmesin.
2. **Kurumsal, sade, modern, profesyonel** görünüm. Banking/fintech disiplinine yakın ama soğuk değil.
3. **Kart tabanlı dashboard.** KPI + risk + widget'lar.
4. **Mobil baştan zorunlu.** iPhone Pro Max (430×932) dahil 3 cihaz boyutu test.
5. **Mobilde tablo değil kart akışı.**
6. **Form input mobile minimum 16px** font (iOS auto-zoom önleme).
7. **Buton touch target minimum 44×44px.**
8. **Empty state** zorunlu (ikon + metin + CTA).
9. **Filter bar + arama + tarih aralığı** her liste ekranında.
10. **Üst ve alt kaydet butonu** uzun formlarda; kaydetmeden çıkış uyarısı.
11. **Status badge sistemi** renkli ve ikonlu.
12. **Import preview ekranlarında** sol belge önizleme + sağ veri doğrulama layout.
13. **Ajanda ve chat widget** operasyonun parçası (her sayfada erişilebilir).
14. **WCAG AA** kontrast ve erişilebilirlik.

---

### 🎨 RENK PALETİ

**Birincil (Brand — kurumsal lacivert):**
- `--brand-900`: #0F2540 (en koyu)
- `--brand-700`: #1E3A5F (primary)
- `--brand-500`: #3B5F8A
- `--brand-300`: #A8BBD3
- `--brand-100`: #E8EEF6 (BG vurgu)

**Aksent (altın — sınırlı):**
- `--accent-500`: #D4A93C
- `--accent-100`: #FAF1D6

**Nötr:**
- BG sayfa: #F8F9FA
- BG kart: #FFFFFF
- Border: #E5E7EB
- Metin birincil: #1A1A1A
- Metin ikincil: #4B5563
- Placeholder: #9CA3AF

**Durum (semantic):**
- Başarı / Ödendi: yeşil #16A34A / BG #DCFCE7
- Uyarı / Bekliyor: sarı #F59E0B / BG #FEF3C7
- Tehlike / Gecikti: kırmızı #DC2626 / BG #FEE2E2
- Bilgi / Taslak: mavi #2563EB / BG #DBEAFE
- Nötr / İptal-Pasif: gri #9CA3AF
- Manuel doğrulama: mor #7C3AED / BG #EDE9FE
- Yaklaşan: turuncu #F97316 / BG #FFEDD5

---

### ✏️ TİPOGRAFİ

- **Font:** Inter (öncelik), IBM Plex Sans (yedek). Türkçe karakter desteği zorunlu.
- **Mono:** JetBrains Mono (sayı/hesap no için).
- **Hiyerarşi:**
  - h1 28/36 700 / h2 24/32 700 / h3 20/28 600 / h4 18/26 600
  - body 14/22 400 / body-lg 16/24 400 / body-sm 13/20 400 / caption 12/18 500
  - **Mobil input minimum 16px** (zorunlu).

---

### 📐 SPACING / RADIUS / SHADOW

- 4px baz: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64
- Radius: sm 6 / md 8 / lg 12 / xl 16 / full 9999
- Shadow xs, sm, md, lg, xl (yumuşak lacivert tonlu)
- Grid: 12 col 16gut (≥1024), 8 col (768-1023), 4 col (≤767)
- Sol menü 240px / 64px collapsed; topbar 56px sabit

---

### 🧱 MVP-1 MODÜLLER (16)

1. Dashboard / Muhasebe Operasyon Merkezi
2. Fatura Takip
3. Ödeme Takip
4. Import Merkezi
5. Abonelik & Taahhüt
6. SiteX (5 daire site yönetimi)
7. Emlak Vergisi & Mülk
8. Teminat Mektupları
9. Düzenli Ödemeler / Kira
10. Resmi Ödemeler (BAĞKUR / SSK / İTO / BES)
11. ETA / Papinet / Entegratör / Kontör
12. Ajanda & Görev
13. Chat Widget (MVP-3 ama design hazır)
14. Bildirim / Telegram Merkezi
15. Raporlama / Excel Export
16. AuditLog / Yetki Yönetimi

**Sol menü grupları:** Operasyon / Mülk-Şahıs / Şirket / Resmi-Banka / Sistem.

---

### 🎯 İLK PARTİ — TASARLANACAK 10 EKRAN

1. **Ana Dashboard** — KPI üst (4 kart) + risk kartları + 8 widget (Bugünkü Görevler, Yaklaşan Ödemeler, SiteX Ay Özeti, Import Bekleyen, Yaklaşan Taahhüt, Emlak Yaklaşan Taksit, Son AuditLog [Yönetici], Bildirimler).
2. **Import Merkezi / Dosya Yükleme** — 3 adımlı stepper: dosya yükle → mapping editor (sol kolon Excel sütunları, sağ model alanları, drag-drop eşleme) → önizleme.
3. **Import Ön İzleme & Onay** — 3 panel layout: header (özet sayılar) + sol (belge önizleme PDF/Excel) + orta (renk kodlu satır tablosu) + sağ (seçili satır düzeltme paneli) + alt sticky aksiyon bar (Tümünü Onayla / Sadece Yeşilleri / Reddet / Mapping'e Dön / Taslak).
4. **Fatura / Ödeme Listesi** — filter bar üstte + tablo/matris toggle (12 kolon ay matrisi opsiyonu) + tablo (kurum, son ödeme, tutar, durum badge, yöntem badge, dekont badge) + toplu aksiyon barı.
5. **Fatura / Ödeme Detay** — header (no + kurum + tutar + durum) + 6 tab (Genel, Ödemeler, Görevler, Chat, Audit, İlişkili) + sağ üstte aksiyon butonları (Düzenle, Ödeme Bağla, Görev Oluştur, Chat Aç).
6. **Abonelik & Taahhüt Listesi** — toggle: Liste ↔ Taahhüt Takvimi (ay heatmap). Tablo: hizmet tipi, kurum, paket, otomatik mi, taahhüt bitiş, durum badge.
7. **SiteX Daire / Aidat Dashboard** — 5 daire kart üstte (A4.17, A4.22, A4.25, B2.28, B3.31) + tıklama → daire detay: yıl-ay timeline grid (ay hücreleri durum renkli) + ekstre PDF viewer + aidat farkı tablosu + yıllık belgeler arşivi (bütçe, denetim, faaliyet raporu).
8. **Emlak Vergisi / Mülk Takip** — mülk × yıl-dönem grid (sticky header + sticky first col), hücrede tutar + durum badge. Mülk detay drawer: yıl-dönem timeline + makbuz/borç dökümü PDF.
9. **Ajanda — Bugünkü Görevlerim** — tab'lar (Bugün / Yaklaşan / Geciken / Bana atananlar / Benim atadıklarım) + görev kartları (öncelik renkli sol kenar, başlık, bağlı kayıt link, atayan/atanan avatar, son tarih, yorum/ek sayısı) + sağ panel görev detay drawer.
10. **Sağ Alt Chat Widget + Mesaj Merkezi** — collapsed (44×44 zarf + rozet) / expanded (360×500 popup: thread listesi + mesaj akışı + input). Tam ekran modu = Mesaj Merkezi: sol thread listesi + orta aktif thread + sağ context paneli (bağlı kayıt detayı). Kayıt-bağlantılı thread başlığı: 📎 + "SiteX / A4.17 / 2026-04 ekstre" gibi.

---

### 🏷️ STATUS BADGE SİSTEMİ

23 durum için renkli + ikonlu pill:

| Durum | Renk | İkon |
|---|---|---|
| Bekliyor | Sarı | Clock |
| Yaklaşıyor (T-7) | Turuncu | AlertCircle |
| Gecikti | Kırmızı | AlertTriangle |
| Ödendi | Yeşil | CheckCircle2 |
| Kısmi Ödendi | Yeşil-koyu | Pie |
| İptal | Gri | XCircle |
| Pasif | Gri açık | EyeOff |
| Arşiv | Gri açık | Archive |
| Kontrol Gerekli | Mor | ShieldAlert |
| Taslak | Mavi | FileEdit |
| Onaylandı | Yeşil | BadgeCheck |
| Import Bekliyor | Mavi | Upload |
| Dekont Eksik | Turuncu | FileMinus |
| Fatura Eksik | Turuncu | FileWarning |
| Görev Açık | Mavi | ListTodo |
| Görev Tamamlandı | Yeşil | CheckSquare |
| Görev Ertelendi | Sarı | Clock4 |
| Kritik | Kırmızı yoğun (pulse) | Siren |
| Aktif | Yeşil | CircleDot |
| Yenilendi | Mavi | RefreshCw |
| İade Edildi | Gri | RotateCcw |
| Komisyon Yaklaşan | Turuncu | Banknote |
| Kontör Kritik | Kırmızı yoğun | BatteryLow |

Format: pill (radius full), 24px height, ikon 14px + UPPERCASE 12px metin.

**Ödeme yöntemi badge** (ayrı): Otomatik (mavi), Elden (sarı), EFT (yeşil), Kredi Kartı (mor), Havale (açık mavi), Nakit (gri).

---

### 📊 DASHBOARD BEKLENTİSİ

**Üst (4 KPI kartı):**
- Bugün Ödenecek (toplam tutar + sayı)
- Bu Ay Geciken (sayı + tutar)
- Görev Tamamlanma (% bar)
- Eksik Dekont (sayı)

**Risk Kartları (yatay slider veya 3-4 kart, kırmızı sol kenar):**
- Kontör eşik altı, Sözleşme bitişi yaklaşan, Teminat komisyonu yaklaşan, SiteX eksik ekstre, Kritik bildirim.

**Widget Grid (2x4 desktop, 1 col mobile):**
W1 Bugünkü Görevlerim · W2 Yaklaşan Ödemeler (T-7) · W3 SiteX Bu Ay Özeti (5 daire mini grid) · W4 Import Bekleyenler · W5 Yaklaşan Taahhüt · W6 Emlak Yaklaşan Taksit · W7 Son AuditLog (Yönetici) · W8 Bildirimler.

**Mobil Dashboard:** KPI 2x2, risk yatay scroll, widget tek kolon.

---

### 📥 IMPORT PREVIEW BEKLENTİSİ

- **3 panel:** header (özet sayılar — yeşil/sarı/kırmızı/mor satır sayısı), sol (belge — PDF.js veya Excel sheet preview), orta (renk kodlu satır tablosu, inline edit), sağ (seçili satır detay düzeltme).
- **Renk kodlu satırlar:** yeşil ok / sarı uyarı / kırmızı hata / mor manuel doğrulama gerekli.
- **Alt sticky aksiyon bar:** Tümünü Onayla / Sadece Yeşilleri / Reddet (sebep zorunlu) / Mapping'e Dön / Taslakta Bırak.
- **Onay sonrası rollback** (24 saat içinde geri al).
- **Mobil:** sekmeli görünüm: Özet / Satırlar / Hatalar / Belge. Mapping desktop önerilir (mobil uyarı banner).

---

### 📅 AJANDA / GÖREV BEKLENTİSİ

- Sıradan takvim **değil**, görev yönetim sistemi.
- Ekran modları: Bugün, Yaklaşan, Geciken, Bana atananlar, Benim atadıklarım, Kişi bazlı kanban, Günlük takvim, Haftalık swimlane, Aylık heatmap.
- **Görev kartı:** sol kenar 4px (öncelik renk), başlık, bağlı kayıt link, atayan+atanan avatar, son tarih badge, yorum/ek sayısı.
- **Görev detay drawer:** Genel / Yorumlar (thread) / Dosyalar / İşlem Geçmişi tab'ları + üstte Tamamla/Ertele/Düzenle aksiyonları.
- **Erteleme:** modal'da yeni tarih + sebep zorunlu.
- **Mobil:** tab'lar yatay scroll, kart akışı, swipe right tamamla / left ertele, "+" floating action.
- **Kanban:** drag-drop durum (Yeni / Başladı / Bekliyor / Ertelendi / Tamamlandı).

---

### 💬 CHAT WIDGET BEKLENTİSİ

- Sağ alt sabit, collapse default (zarf 44×44 + rozet), expanded 360×500 popup.
- Birebir mesaj, grup mesajı, **kayıt-bağlantılı thread** (örn. "SiteX / A4.17 / 2026-04 ekstre" başlıklı).
- Mesaj merkezi tam ekran: sol thread listesi + orta aktif thread + sağ context paneli.
- Okundu (mavi tik), iletildi (gri tik).
- Dosya eki, mention `@`, emoji, dosya/resim inline preview.
- Mobile **fullscreen**.
- Bildirim rozeti topbar zilinde + chat zarfında.
- Kayıt-bağlantılı thread'in başlığında 📎 ikon + bağlı kayıt etiketi sticky context kart.

---

### 📱 MOBİL BEKLENTİSİ

- iPhone Pro Max (430×932), iPad Mini (744×1133), masaüstü 1440+ test.
- 390px ve 430px viewport tüm kritik fonksiyonlar erişilebilir.
- Tablo → kart akışı (responsive <768px).
- Form input minimum 16px font.
- Touch target minimum 44×44px.
- Hamburger sol menü (drawer).
- Modal/drawer ≤640px tam ekran.
- Floating action button (+) liste ekranlarında yeni kayıt.
- Bottom sheet pattern filtreler için.
- Swipe gesture: görev tamamla/ertele.
- Capture="camera" attribute dekont fotoğraf.
- Skeleton loading agresif (yavaş ağ varsayımı).
- Status bar safe-area padding.

---

### 🔧 GELİŞTİRİCİYE AKTARILACAK COMPONENT KURALLARI

Aşağıdaki component'lar tasarlanmalı ve dokümante edilmeli (storybook benzeri):
- `<Button>` (6 variant × 4 size)
- `<Input>`, `<Select>`, `<Textarea>`, `<DatePicker>` (TR locale), `<FileUploader>`
- `<Card>`, `<KpiCard>`, `<RiskCard>`
- `<DataTable>` + `<MobileListCard>` (responsive switch)
- `<Badge>`, `<StatusTag>` (23 durum)
- `<Modal>`, `<Drawer>`, `<Toast>`, `<Alert>`
- `<Tabs>`, `<Stepper>`, `<FilterBar>`, `<Chip>`
- `<EmptyState>`, `<Skeleton>`, `<LoadingSpinner>`
- `<ImportPreviewLayout>`, `<MappingEditor>`, `<ImportRowEditor>`
- `<TaskCard>`, `<TaskDetailDrawer>`, `<TaskTimeline>`, `<KanbanBoard>`
- `<ChatWidget>`, `<MessageList>`, `<MessageInput>`, `<ThreadContext>`
- `<EkstrePdfViewer>`, `<MonthTimelineGrid>`, `<DaireCard>`
- `<EmlakGrid>`, `<TaahhutCalendar>`, `<KomisyonTimeline>`
- `<AuditTimeline>`, `<RelatedRecords>`
- `<TopBar>`, `<SideNav>`, `<UserMenu>`, `<NotificationBell>`

Her component için:
- Anatomi diyagramı
- Variant'lar (variant matrix)
- State'ler (default / hover / active / focus / disabled / loading / error)
- Props tablosu
- Erişilebilirlik notu (ARIA, keyboard)
- Mobil davranış

---

### 📝 ÇIKTI BEKLENTİSİ

1. **Design Tokens** dosyası (renk, tipografi, spacing, shadow, radius).
2. **Component Library** — yukarıdaki component'lar için Figma/HTML çıktısı.
3. **10 Ekran (Yüksek Fidelity)** — desktop + tablet + mobile (3 boyut her ekran).
4. **Empty / Loading / Error State** her ekran için örnek.
5. **Etkileşim Notları** — modal/drawer akışları, hover, tıklama davranışı.
6. **Accessibility checklist** — WCAG AA kontrast, keyboard nav, ARIA.

**Çıkmasın:** Dark mode varyantı, native mobile app ekranları (web responsive yeterli), 3D efektler, gereksiz animasyon.

---

### 🔒 KESİN OLANLAR

- Para `₺ 1.234,56` formatı.
- Tarih `dd.MM.yyyy` formatı.
- Locale TR.
- Sol menü gruplaması: Operasyon / Mülk-Şahıs / Şirket / Resmi-Banka / Sistem.
- Topbar: arama (Cmd+K) + bildirim zili + hızlı oluştur (+) + kullanıcı menüsü.
- Sağ alt chat widget her sayfada görünür.

---

### ✅ KABUL KRİTERLERİ

- 10 ekranın 3 cihaz boyutu için tasarlanmış olması.
- 23 status badge'in görsel olarak dokümantasyonu.
- Dashboard'da 4 KPI + risk + 8 widget'ın tasarlanmış olması.
- Import preview'in 3 panel layout'u + renk kodlu satırlar + 6 aksiyon butonunun yer alması.
- Görev detay drawer'ın 4 tab + üst aksiyonlarla tasarlanmış olması.
- Chat widget collapse/expanded + tam ekran mesaj merkezi.
- Mobil tüm ekranlarda doğrulanmış (touch target ≥44px, font ≥16px input).
- Dark mode varyantı **YOK**.
- WCAG AA kontrast doğrulanmış.

---

## 📋 PROMPT BİTİŞ

---

## EK NOTLAR (PROMPT'A DAHİL DEĞİL)

- Bu prompt Faz 0C'nin nihai çıktısıdır.
- Claude Design oturumunda doğrudan kullanılabilir.
- Çıktı geldikten sonra **Faz 0D — Design çıktı kontrolü** fazında anayasa ile uyumluluk denetimi yapılır.
- 10 ekran tamamlandıktan sonra ikinci parti (master tablolar + abonelik detay + resmi ödemeler grid'i + bildirim merkezi + AuditLog timeline + yetki yönetimi + raporlama) ayrı bir prompt olarak verilir.
