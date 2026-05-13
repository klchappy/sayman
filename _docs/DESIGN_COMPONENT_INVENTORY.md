# DESIGN COMPONENT INVENTORY
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05
**Kaynak:** design-canvas.jsx (Sprint 1A-1G konsolide)

> Bu envanter Faz 2 UI implementasyonunda Storybook/Component library karşılığı oluşturmak için referanstır. JSX prototip "production kodu değildir, referanstır" — tüm props/state Faz 2'de finalize edilir.

---

## 1. LAYOUT / SHELL

| # | Component | Kullanıldığı Frame'ler | Amaç | Varyantlar | Responsive | Implementasyon Notu |
|---|---|---|---|---|---|---|
| 1 | **AppShell** | 01-19 (desktop) | TopBar + SideNav + İçerik kombinasyonu | desktop | <768px sol menü drawer'a | Container layout, slot'lu |
| 2 | **TopBar** | 01-19 (desktop) | Logo + arama + bildirim + Hızlı Oluştur + kullanıcı | default · sticky 56px | Mobile: ayrı `<MobileTopBar>` | `<TopBar>` desktop / `<MobileTopBar back?>` mobil |
| 3 | **SideNav** | 01-19 (desktop) | 5 grup + sayaç + active item | active=string · expanded/collapsed | Mobile: drawer (hamburger) | Grup başlığı + item listesi · active state brand-100 BG |
| 4 | **MobileTopBar** | 20-25 | Mobil 56px topbar | back?: bool · title · sub | — | Geri tuşu varsa logo gizli; bildirim 5 rozet |
| 5 | **MobileFrame** | 20-25 | iPhone Pro Max kapsayıcı | bg? | — | iOS status bar 44 + içerik + home indicator 24 |

---

## 2. WIDGET / VEYA CONTAİNER

| # | Component | Kullanıldığı Frame'ler | Amaç | Varyantlar | Responsive | Implementasyon Notu |
|---|---|---|---|---|---|---|
| 6 | **Card** | Tüm frame'ler | Genel kart konteyneri | pad (12-24) · style override | <768 padding daralır | radius lg, shadow sm, border 1px |
| 7 | **KpiCard** | 02, 05, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 | Üst KPI | label + value (mono?) + delta + ikon | mobile 2x2 | Click-through dashboard widget'a |
| 8 | **RiskCard** | 02, 14, 18 (kritik), 20 (mobile) | Risk göstergesi | sol kenar 4px renk + sayı + açıklama | yatay scroll mobile | "İncele" CTA, danger/warning border |
| 9 | **ReportCard** | 17 | Rapor şablon kartı | yetki rozet + format pill + Önizle/Export | desktop | Sprint 1F yeni, hover state lift |
| 10 | **PruvaDaireCard** | 09 | 5 daire kart grid | seçili state + status badge + ekstre/dekont mini chip | desktop | Tıklama timeline aç |
| 11 | **NotificationGate** | 16 | 4 aşamalı bildirim kapısı | aktif/kapalı + numara + status badge | desktop | Aşamalar arası ok ile bağlı; "Gerçek" pulse if KAPALI |

---

## 3. FORM ELEMENTLERİ

| # | Component | Kullanıldığı Frame'ler | Amaç | Varyantlar | Responsive | Implementasyon Notu |
|---|---|---|---|---|---|---|
| 12 | **Button** | Tüm frame'ler | Aksiyon | primary / secondary / ghost / danger / success / accent · sm/md/lg/xl | mobile minimum md (44px) | `<Btn variant size>` JSX |
| 13 | **Input** | 00, 06, 07, 17, 19, 23 | Tek satırlık veri girişi | default · error · disabled · loading · readonly | mobile fontSize 16 zorunlu | Label üstte + hint/error alanın altında |
| 14 | **Select** | 03, 06, 17, 23 | Açılır liste | searchable (>10 option) · multi (tag) | mobile native fallback | Türkçe locale label |
| 15 | **Textarea** | 06 (not), 23 | Çok satır metin | default · error | min height 72px desktop / 80 mobile | rows attribute |
| 16 | **DatePicker** | 06, 07, 17, 23 | Tarih seçici | dd.MM.yyyy locale TR | mobile native picker | Hızlı seçim chip'leri ("bugün", "+1 hafta") |
| 17 | **FileUploader** | 03, 07, 23 | Dekont/belge yükleme | drag-drop + browse · capture="camera" mobile | mobile camera CTA accent | sha256 hash gönder |
| 18 | **Checkbox** | 03, 07, 17, 19 | Tek/çoklu seçim | default · disabled | min 20×20 | Custom render brand-700 |

---

## 4. VERİ GÖSTERİMİ

| # | Component | Kullanıldığı Frame'ler | Amaç | Varyantlar | Responsive | Implementasyon Notu |
|---|---|---|---|---|---|---|
| 19 | **DataTable** | 03, 04, 05, 06, 08, 10, 11, 12, 13, 14, 15, 17, 18, 19 | Çok kolon liste | header sticky · sıralama · seçim · toplu aksiyon | <768 → MobileCard akışı | Virtualization >500 row |
| 20 | **MobileCard** | 20-24 | Mobil tek satır kart | basic / detail / action-rich | sadece <768 | Tablo yerine — zorunlu pattern |
| 21 | **EmlakGrid** | 10 | Mülk × yıl-dönem matrisi | sticky 1. kolon + 2. row hover | desktop only (mobile=satır kart) | Hücre içi tutar + mini badge |
| 22 | **MonthTimelineGrid** | 09, 13 | 12 ay × N kayıt grid | renk kodlu hücre · durum legend | desktop | SiteX + Düzenli Ödemeler |
| 23 | **AuditTimeline** | 06 (Audit tab), 09, 11, 18, 19 | İşlem zaman çizelgesi | dot + zaman + kullanıcı + eylem | mobile dikey | JSON diff renk kodlu |
| 24 | **PermissionMatrix** | 19 | Modül × yetki ızgarası | ✓/⛔/— hücre | desktop only | dikey header text rotate |
| 25 | **KontorBar** | 14 | Kontör kullanım progress | kalan/toplam + eşik dikey marker | desktop · mobile dikey hizalı | %92+ kırmızı, <eşik pulse |

---

## 5. STATUS / FEEDBACK

| # | Component | Kullanıldığı Frame'ler | Amaç | Varyantlar | Responsive | Implementasyon Notu |
|---|---|---|---|---|---|---|
| 26 | **StatusTag** | Tüm frame'ler | 23 durum badge | success / warning / orange / danger / info / neutral / purple · pulse? | mobile 22px height (`<MStatusTag>`) | DESIGN_STATUS_BADGE_SYSTEM.md referans |
| 27 | **PayMethodTag** | 04, 05, 06, 12, 13, 22 | Ödeme yöntemi | Otomatik/EFT/Havale/Kredi Kartı/Elden/Nakit | mobile aynı | 6 sabit varyant |
| 28 | **Alert / Banner** | 03, 07, 09, 10, 14, 16, 22, 23, 24 | Sayfa içi uyarı | info/success/warning/danger | mobile tam genişlik | Sol kenar 4px renk |
| 29 | **Toast** | (planlandı) | Geçici bildirim | info/success/warning/danger | mobile bottom sheet | Auto-dismiss 5s success/info, 8s warning, manuel danger |
| 30 | **Skeleton** | (planlandı) | Loading state | text/card/table | tüm boyutlar | shimmer 1.4s |
| 31 | **EmptyState** | 00, 02 (no-data), liste ekranları | Boş veri | ikon + metin + CTA | mobile centered | Her liste ekranında zorunlu |

---

## 6. NAVİGASYON / OVERLAY

| # | Component | Kullanıldığı Frame'ler | Amaç | Varyantlar | Responsive | Implementasyon Notu |
|---|---|---|---|---|---|---|
| 32 | **Tabs** | 06, 09, 15, 18, 19, 21, 23 | Sekme | underline · sayaç rozet | mobile yatay scroll | Active brand-700 border 2px |
| 33 | **Stepper** | 03, 16 (4-aşamalı kapı) | Adımlı süreç | numbered · status renkli | mobile dikey alternatif | "1→2→3" ile bağlı |
| 34 | **Chip / FilterChip** | 04, 05, 17, 20, 21, 22 | Seçilebilir etiket | active/passive · sayaç | yatay scroll mobile | Toggle group ile |
| 35 | **FilterBar** | 05, 08, 10, 11, 12, 13, 14, 17, 18 | Filtre ribbonu | arama + dropdown'lar + toggle + temizle | <768 drawer'a | Sticky on scroll opsiyonel |
| 36 | **Modal** | 07 | Merkez popup | sm/md/lg/xl · destructive variant | mobile fullscreen ≤640 | ESC + overlay click + X |
| 37 | **Drawer** | 05, 06, 08, 09, 10, 11, 12, 13, 14, 15, 17, 18, 19 | Yan panel detay | sm 360 / md 480 / lg 720 · sağ/sol | mobile fullscreen | Header sticky + footer sticky |
| 38 | **BottomSheet** | (planlandı 20-24 filtre) | Mobil alt panel | full-height / partial | sadece mobile | Filtre + aksiyon menüleri |

---

## 7. ÖZEL MODÜL COMPONENT'LARI

| # | Component | Kullanıldığı Frame'ler | Amaç | Varyantlar | Responsive | Implementasyon Notu |
|---|---|---|---|---|---|---|
| 39 | **ImportPreviewLayout** | 04 | 3 panel import preview | header + sol/orta/sağ + alt sticky | mobile sekmeli (Frame 24) | Sol collapsible 320px |
| 40 | **ImportRowCard** | 24 | Mobile import satır kartı | renk kodlu (ok/uyarı/hata/kontrol) + 3-buton aksiyon | sadece mobile | Frame 04 satır row'unun mobile karşılığı |
| 41 | **TaskCard** | 02, 15, 21 | Görev kartı | öncelik renk + bağlı kayıt + avatar zinciri | mobile swipe gesture | Hızlı aksiyon Tamamla/Ertele |
| 42 | **TaskDetailDrawer** | 15 | Görev detay paneli | 4 tab (Genel/Yorumlar/Dosya/Geçmiş) | mobile fullscreen drawer | Erteleme modal stack |
| 43 | **KanbanBoard** | 15 (mini), 19 (planlı) | 5 kolon kanban | drag-drop · mobile tap-to-move | mobile yatay scroll | Yeni/Başladı/Bekliyor/Ertelendi/Tamamlandı |
| 44 | **ChatWidgetCollapsed** | 01-19 (desktop) | Sağ alt 56×56 zarf | rozet sayı | desktop · mobile yerine `MobileChatFab` | z-index 1100 |
| 45 | **MobileChatFab** | 20-24 | Mobil sağ alt 56×56 zarf | rozet | sadece mobile | Tıklayınca Frame 25 fullscreen |
| 46 | **ChatFullscreen** | 25 | Mobil tam ekran chat | thread list + aktif thread + input | sadece mobile | WebSocket Faz 11 |
| 47 | **ChatThreadContext** | 25 (sticky context kart) | Kayıt-bağlantılı thread başlığı | 📎 + bağlı kayıt + Kayda Git | desktop+mobile | Bağlı kayıt detayına link |

---

## 8. AVATAR / İCONOGRAFİ

| # | Component | Kullanıldığı Frame'ler | Amaç | Varyantlar | Responsive | Implementasyon Notu |
|---|---|---|---|---|---|---|
| 48 | **Avatar** | 02, 05, 06, 15, 18, 19, 21, 25 | Kullanıcı initials | xs (24) / sm (32) / md (40) / lg (56) | tüm boyutlar | Hash-based BG renk |
| 49 | **Icon (Lucide)** | Tüm frame'ler | Sistem ikonları | bell/search/plus/msg/upload/file | 14-32px | Inline SVG (prototip) → Lucide React Faz 2 |

---

## 9. İLK İMPLEMENTASYON ÖNCELİĞİ (Faz 2)

**Kritik (P0):** AppShell, TopBar, SideNav, Card, Button, StatusTag, PayMethodTag, Input, Modal, Drawer, EmptyState, Skeleton, Toast.

**Yüksek (P1):** DataTable, MobileCard, KpiCard, RiskCard, FilterBar, Tabs, Chip, FileUploader, ChatWidgetCollapsed, MobileTopBar, MobileFrame.

**Orta (P2):** Stepper, ImportPreviewLayout, TaskCard, TaskDetailDrawer, AuditTimeline, EmlakGrid, MonthTimelineGrid, KontorBar.

**Geç (P3):** KanbanBoard, ChatFullscreen, BottomSheet, NotificationGate, PermissionMatrix, ReportCard, PruvaDaireCard.

---

## 10. KOMPONENT KULLANIM SIKLIĞI (frame sayısına göre)

| Sıralama | Component | Kullanım |
|---|---|---|
| 1 | Card | 26 frame |
| 2 | StatusTag | 26 frame |
| 3 | Button | 26 frame |
| 4 | TopBar (desktop+mobil) | 26 frame |
| 5 | SideNav | 20 frame (desktop) |
| 6 | ChatWidgetCollapsed/MobileChatFab | 25 frame (Frame 25 fullscreen) |
| 7 | DataTable | 14 frame |
| 8 | KpiCard | 15 frame |
| 9 | FilterBar | 9 frame |
| 10 | Drawer | 13 frame |
| 11 | Tabs | 7 frame |
| 12 | PayMethodTag | 6 frame |

---

**SON.** Faz 2'de bu envanter Storybook/component library kataloğuna dönüşecektir.
