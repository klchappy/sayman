# FAZ 0C — EKRAN BRIEF'İ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

> Bu doküman: **Dashboard kurgusu** + **İlk 10 ekran detaylı brief** + **MVP-1 16 modül için ekran haritası** + **Import/Ajanda/Chat/Mobil UI kurguları** içerir.

---

# BÖLÜM A — DASHBOARD KURGUSU (DETAYLI)

## A.1 Layout
- **Üst topbar (56px):** logo + sol menü toggle + arama (Cmd+K) + bildirim zili (rozet) + hızlı oluştur (+) + kullanıcı menüsü (avatar).
- **Sol menü (240px):** modül grupları (Operasyon / Mülk-Şahıs / Şirket / Resmi-Banka / Sistem). Aktif item brand-700 BG.
- **İçerik alanı:** 24px padding, 12 kolon grid.
- **Sağ alt:** Chat widget (collapse default).

## A.2 Üst KPI Kartları (4 kart yatay, mobile 2x2)
1. **Bugün Ödenecek** — toplam tutar + sayı, tıklama → bugünkü ödeme listesi.
2. **Bu Ay Geciken** — sayı + toplam gecikmiş tutar, tıklama → geciken liste.
3. **Bu Ay Tamamlanan/Bekleyen Görev** — oran (% bar), tıklama → ajanda.
4. **Eksik Dekont** — sayı, tıklama → eksik dekont liste.

## A.3 Risk Kartları (yatay slider veya 3-4 kart, kırmızı sol kenar)
- **Kontör Eşik Altı** (Faz B'de aktif)
- **Sözleşme Bitişi Yaklaşan** (T-30)
- **Teminat Komisyonu Yaklaşan** (T-7)
- **SiteX Eksik Ekstre** (bu ay daire ekstresi yok)
- **Kritik Bildirim** (acil seviyede tetiklenmiş)

## A.4 Ana Widget Grid (responsive, 2x4 desktop, 1 col mobile)

### W1 — Bugünkü Görevlerim
- Üst 5 görev, badge (öncelik + durum), bağlı kayıt link.
- "Tümünü gör" → Ajanda.

### W2 — Yaklaşan Ödemeler (T-7)
- Liste: kurum/açıklama + son ödeme tarihi + tutar + yöntem badge.
- Tıklama → ödeme detayı.

### W3 — SiteX Bu Ay Özeti
- 5 daire mini grid: daire kodu + ay durumu (yeşil/sarı/kırmızı/gri).
- Tıklama → SiteX daire dashboard.

### W4 — Import Bekleyenler
- Aktif ImportBatch listesi: dosya adı + hedef modül + durum + toplam/hata sayısı.
- "Onaya devam" CTA.

### W5 — Yaklaşan Taahhüt Bitişleri
- T-60 içindekiler: abonelik + bitiş tarihi + paket + aksiyon ("Yenile" / "İptal").

### W6 — Emlak Vergisi Yaklaşan Taksit
- Aktif dönem (1 veya 2) için ödenmemişler: mülk + tutar + son tarih.

### W7 — Son AuditLog Hareketleri (Yönetici görür)
- Son 10 kritik aksiyon: kullanıcı + eylem + zaman.

### W8 — Bildirimler / Mention'lar
- Son 5 bildirim, okunmamış vurgu.

## A.5 Mobil Dashboard
- KPI kartları 2x2.
- Risk kartları yatay scroll.
- Widget'lar tek kolon, collapse/expand.
- Sol menü → drawer (hamburger).
- Topbar arama → tam ekran modal.

---

# BÖLÜM B — İLK 10 EKRAN DETAYLI BRIEF

## EKRAN 1 — Ana Dashboard
**Yukarıdaki Bölüm A'da detaylandırıldı.** Kullanıcı rolü: tüm roller (içerik role'e göre filtrelenir). Yetersiz veride empty state: "Henüz veri yok. İlk import'u başlatın." + [Import] CTA.

---

## EKRAN 2 — Import Merkezi / Dosya Yükleme

### Amaç
Kullanıcı Excel/PDF/RAR/klasör yüklemesi yapar; mapping seçer veya oluşturur; ImportBatch başlatır.

### Roller
- Yükleme: Yönetici / Müdür / Muhasebeci.
- Onay: Yönetici / Müdür.

### Layout (3 adımlı stepper)
**Step 1 — Dosya Yükleme**
- Büyük drag-drop alanı (`<FileUploader>`) + browse.
- Hedef modül seçici: `<Select>` (Fatura / Ödeme / Abonelik / SiteX / Emlak / Teminat / Kira / Resmi / Entegratör).
- Dosya tipi otomatik tespit + önerilen mapping şablonu.
- Önceki ImportBatch'lerden örnek geri yükle butonu.

**Step 2 — Mapping**
- Sol: Excel kolon listesi (kaynak).
- Sağ: model alan listesi (hedef).
- Drag-drop veya dropdown eşleme.
- Kayıtlı mapping şablonu seç/kaydet.
- Test parse: ilk 5 satır önizleme.

**Step 3 — Önizleme** → Ekran 3'e geçer.

### Aksiyon butonları
- "İleri" / "Geri" / "İptal" / "Şablon olarak kaydet".

### Modal'lar
- Mapping şablonu kaydet (ad + açıklama).
- Dosya değiştir uyarısı (mapping resetlenir).

### Empty state
- "Henüz import yok. İlk dosyanızı yükleyin." + drag alan.

### Mobil
- Stepper tek kolon. Mapping ekranı dropdown bazlı (drag-drop yerine).

### Status badge
- Batch durumu: Yüklendi / Önizleme / Onay Bekliyor / Onaylandı / Reddedildi / Kısmi Hata.

### Görev/bildirim/chat ilişkisi
- Onay bekleyen ImportBatch için "Import onayla" görevi otomatik üretilir (Müdür'e atanır).

### Geliştirici notları
- `<ImportStepper>` component (3 adım).
- `<MappingEditor>` component.
- `<FileUploader>` reusable.
- ImportBatch CRUD için drawer detay.

---

## EKRAN 3 — Import Ön İzleme & Onay

### Amaç
ImportDraft satırlarını incele, hataları düzelt, onayla → kesin kayıtlar oluşur.

### Roller
- Görüntü: Yükleyen + Müdür + Yönetici.
- Onay: Müdür / Yönetici.

### Layout
- **Header:** ImportBatch özeti (dosya adı + hedef modül + toplam/yeşil/sarı/kırmızı/mor satır sayısı + tahmini commit süresi).
- **Sol (kolaplama):** Belge önizleme (PDF/Excel sheet).
- **Orta:** ImportDraft tablosu — renkli satır, inline edit.
- **Sağ panel:** Seçili satır detayı + uyarı/hata + manuel düzeltme alanları + "Bu satırı taslakta bırak" / "Onayla" / "Reddet".

### Filtreler
- Sadece hatalı satırlar / Sadece uyarılar / Tümü.
- Hedef alan filtresi.
- Arama.

### Aksiyon Butonları (alt sticky)
- **Tümünü Onayla** (yeşilleri commit'le)
- **Sadece Yeşilleri Onayla**
- **Reddet ve Geri Dön**
- **Mapping'e Dön**
- **Taslakta Bırak** (sonra devam et)
- **Rollback** (onay sonrası geri al)

### Modal'lar
- Onay öncesi son özet modal: "X satır kesin kayda dönüştürülecek. Devam?" [Onayla] [İptal]
- Reddet: sebep yazma zorunlu.

### Empty state
- "Tüm satırlar başarılı! Onaylamak için tıklayın."

### Mobil
- Tek panel (sol belge gizli, sağ panel drawer'a). Sekmeler: Özet / Satırlar / Hatalar / Belge.

### Status / Badge
- Satır: ✅ ok / ⚠️ uyarı / ❌ hata / 🟣 kontrol gerekli.

### Görev/bildirim/chat
- Hatalı satır → "Satırı düzelt" görevi.
- Commit sonrası AuditLog: `IMPORT_APPROVE`.
- Reddet → "Reddedilmiş import" bildirimi yükleyene.

### Geliştirici notları
- `<ImportPreviewLayout>` (3 panel).
- `<ImportRowEditor>` (sağ panel).
- Renk kodlu satır react-table extension.
- Commit async; progress bar.

---

## EKRAN 4 — Fatura / Ödeme Listesi

### Amaç
Tüm faturalar ve ödemeler tek tabloda, filtre + arama + matris/tablo toggle.

### Roller
- Görüntü: tüm operasyon rolleri.
- Düzenleme: Müdür / Muhasebeci.

### Layout
- **Filter Bar:** Şirket / Şahıs / Mülk / Kurum / Hizmet Tipi / Dönem (yyyymm) / Durum / Yöntem / Tutar aralığı / Arama.
- **Toggle:** Tablo görünümü ↔ **Ay Matrisi görünümü** (12 kolon OCAK..ARALIK).
- **Tablo:** Fatura no / Tarih / Son Ödeme / Kurum / Açıklama / Tutar / Durum badge / Yöntem badge / Aksiyon ("Ödeme Bağla", "Detay", "Düzenle").
- **Toplu aksiyon barı:** Seçili satırlar için "Ödendi işaretle", "Excel'e aktar", "Görev oluştur".

### Aksiyon Butonları (sayfa üst)
- **+ Yeni Fatura**
- **+ Yeni Ödeme**
- **Import**
- **Excel'e aktar**

### Modal'lar
- Hızlı ödeme işaretle (tarih + tutar + yöntem + dekont).
- Ödeme bağla drawer.

### Empty state
- "Filtreye uyan kayıt yok." veya "Henüz fatura yok. + Ekle veya Import."

### Mobil
- Tablo → kart akışı: başlık (kurum + açıklama) + sağda durum badge + alt: tutar + son ödeme + yöntem badge + ">" detay.
- Filter bar → drawer'a.

### Status badge kullanımı
- Fatura durumu (Bekliyor/Ödendi/Gecikmiş/İptal/Kısmi).
- Ödeme yöntemi badge (renkli pill: Otomatik=Mavi, Elden=Sarı, EFT=Yeşil, Kart=Mor, Havale=Açık mavi).
- Dekont eksik turuncu badge.

### Görev/bildirim/chat
- Satır long-press / "..." menü: Görev oluştur / Chat aç / İptal et.
- T-7 yaklaşan otomatik bildirim.

### Geliştirici notları
- `<DataTable>` + `<MatrixView>` toggle.
- Virtualized table (>500 satır).
- Mobil `<MobileListCard>` reusable.

---

## EKRAN 5 — Fatura / Ödeme Detay

### Amaç
Tek bir fatura/ödeme kaydının tüm verisi + bağlı görev/chat/dekont/audit.

### Roller
- Tüm operasyon rolleri.

### Layout
- **Header:** Fatura no + kurum + tutar + durum badge + son ödeme + sağda aksiyonlar (Düzenle / Ödeme Bağla / İptal / Görev Oluştur / Chat Aç).
- **Tab'lar:**
  1. **Genel** — temel alanlar, fatura belgesi önizleme.
  2. **Ödemeler** — bu faturaya bağlı tüm ödemeler tablosu + dekontlar.
  3. **Görevler** — bu kayda bağlı tüm görevler.
  4. **Chat** — kayıt-bağlantılı thread.
  5. **Audit** — değişiklik geçmişi (zaman çizelgesi).
  6. **İlişkili** — abonelik, mülk, şahıs/şirket linkleri.

### Aksiyon Butonları
- Üst sticky: Düzenle / Sil (soft) / İptal et.
- Alt sticky (form modunda): Kaydet / Vazgeç.

### Modal'lar
- Düzenleme drawer (form).
- Soft-delete onay modal (sebep zorunlu).
- Dekont yükle modal.

### Empty state
- "Bu faturaya henüz ödeme bağlı değil." [+ Ödeme Bağla]

### Mobil
- Tab'lar yatay scroll.
- Ana bilgi kart, alt collapse panel'lar.

### Görev/bildirim/chat
- Sağ üst "Görev Oluştur" — bağlı kayıt otomatik dolu.
- "Chat Aç" → kayıt-bağlantılı thread (yoksa oluştur).

### Geliştirici notları
- `<RecordDetailLayout>` (header + tabs + sticky actions).
- `<AuditTimeline>` reusable.
- `<RelatedRecords>` reusable.

---

## EKRAN 6 — Abonelik & Taahhüt Listesi

### Amaç
Tüm abonelikleri liste + taahhüt bitiş takvimi.

### Roller
- Tüm operasyon rolleri.

### Layout
- **Toggle:** Liste ↔ **Taahhüt Takvimi (ay görünümü)**.
- **Filter Bar:** Şirket / Mülk / Kurum / Hizmet tipi / Banka / Durum / Taahhüt bitiş aralığı.
- **Tablo:** Hizmet tipi + Kurum + Hesap no + Sahip + Paket + Paket tutar + Otomatik mi (✓ / ✗) + Taahhüt bitiş + Durum badge + Aksiyon.
- **Taahhüt Takvimi:** Ay grid; hücrede o ay biten abonelik sayısı + tıklama → o ay liste.

### Aksiyon Butonları
- + Yeni Abonelik / + Taahhüt Yenile / Import.

### Modal'lar
- İptal süreci başlat (sebep + tarih + dilekçe yüklendi mi).

### Empty state
- "Henüz abonelik yok. Şirket/Ev abonelikler Excel'i import edin."

### Mobil
- Kart akışı: ikon (hizmet tipi) + kurum + paket + sağda taahhüt kalan gün badge.

### Status badge
- Aktif / Askıda / İptal / Taahhüt Yaklaşan (T-60/30/7) / Pasif.

### Görev/bildirim/chat
- T-60/T-30/T-7 otomatik görev (abonelik sahibine).

### Geliştirici notları
- `<TaahhutCalendar>` heatmap.
- Abonelik form: hizmet tipi → kurum → paket dropdown'ları kademeli.

---

## EKRAN 7 — SiteX Daire / Aidat Dashboard

### Amaç
5 daire için yıl-ay timeline + ekstre PDF + aidat farkı + yıllık belgeler.

### Roller
- Müdür / Yönetici / Muhasebeci. Daire sahibi şahıs (varsa user) sadece kendi dairesini.

### Layout
- **Üst:** 5 daire kartı (A4.17, A4.22, A4.25, B2.28, B3.31). Kart: daire kodu + sahip + bu ay durum badge (yeşil/sarı/kırmızı/gri) + bu ay aidat tutarı.
- **Tıklama → Daire Detay:**
  - **Header:** daire kodu + sahip + adres + "Bu ay öde" CTA.
  - **Timeline (yıl-ay):** her ay hücresi: aidat + gider + toplam + durum + ekstre PDF link + bildirim yazısı link.
  - **Aidat Farkı tablosu:** farklı tutar varsa.
  - **Yıllık Belgeler:** bütçe / denetim raporu / faaliyet raporu / genel kurul tutanağı / işletme maliyetleri.

### Filter
- Yıl seçici (2024 / 2025 / 2026).
- Daire seçici (tüm / belirli).

### Aksiyon Butonları
- + Ekstre Yükle (RAR / PDF).
- + Aidat Farkı Ekle.
- Excel'e aktar.

### Modal'lar
- Ekstre PDF görüntüleyici modal (büyük).
- Aidat farkı mutabakat modal.

### Empty state
- "Daire için ekstre yok. RAR import et veya PDF yükle."

### Mobil
- 5 daire 2x3 grid. Detayda timeline yatay scroll veya tek ay kart akışı.

### Status badge
- Ay durumu: Ödendi / Bekliyor / Gecikmiş / Kısmi / Eksik Ekstre.

### Görev/bildirim/chat
- Ayın 17'sinde "Ekstre indir" görevi her daire için.
- Ayın 20'si T-3 "Aidat öde" görevi.
- Aidat farkı varsa "Mutabakat" görevi.

### Geliştirici notları
- `<DaireCard>`, `<MonthTimelineGrid>`, `<EkstrePdfViewer>` (PDF.js embed).
- SiteX daire master read-only seed.

---

## EKRAN 8 — Emlak Vergisi / Mülk Takip

### Amaç
Tüm mülkler × yıl × dönem (1/2) emlak vergisi grid'i.

### Roller
- Müdür / Yönetici / Muhasebeci.

### Layout
- **Filter Bar:** Belediye / Mülk tipi / Sahip / Yıl / Dönem / Durum.
- **Grid view (master tablo):**
  - Satırlar: Mülk (isim + belediye + sicil).
  - Kolonlar: 2024-D1, 2024-D2, 2025-D1, 2025-D2, 2026-D1, 2026-D2 ...
  - Hücre: tutar + durum badge (Ödendi/Bekliyor/Gecikmiş) + tıklama → detay.
- **Mülk detay drawer:**
  - Header: mülk + belediye + sicil + sahip.
  - Yıl-dönem zaman çizelgesi: tutar + durum + makbuz + borç dökümü PDF.
  - Belge yükleme.

### Aksiyon Butonları
- + Yeni Mülk
- + Emlak Vergisi Ekle
- Import (RAR)
- Excel'e aktar

### Modal'lar
- Belge yükle (borç dökümü / makbuz).
- Ödeme işaretle.

### Empty state
- "Henüz mülk yok. + Yeni Mülk veya Import."

### Mobil
- Mülk listesi kart akışı, dönem grid yerine son 2 dönem kart önizleme.

### Status badge
- Ödendi / Ödenmedi / Kısmi / İtirazlı.

### Görev/bildirim/chat
- 1.taksit Mayıs sonu T-15 görev.
- 2.taksit Kasım sonu T-15 görev.
- Belge eksikse "Borç dökümü yükle" görevi.

### Geliştirici notları
- `<EmlakGrid>` (sticky header + sticky first col).
- Belediye filter chip seçici.

---

## EKRAN 9 — Ajanda — Bugünkü Görevlerim

### Amaç
Kullanıcının o gün yapması gereken görevleri tek ekrandan görmesi.

### Roller
- Tüm kullanıcılar (kendi görevleri).

### Layout
- **Üst:** Bugün, Yaklaşan, Geciken, Bana atananlar, Benim atadıklarım — tab'lar.
- **Liste:** Görev kartı (öncelik renk + başlık + bağlı kayıt + son tarih + atanan avatar + yorum sayısı + ek sayısı).
- **Sağ panel (geniş ekran):** Seçili görev detay drawer.
- **Filter:** Öncelik / Durum / Bağlı modül / Atanan.

### Aksiyon Butonları
- + Yeni Görev
- "Tamamla" (görev kartı üzerinde checkbox).
- Hızlı erteleme (yarın / 1 hafta / özel tarih).

### Modal'lar
- Görev detay drawer (yorum thread + dosya + geçmiş + bağlı kayıt).
- Erteleme modal (sebep zorunlu).

### Empty state
- "Bugün için görev yok 🎉" + alt: "Önümüzdeki 7 günde X görev var."

### Mobil
- Kart akışı. Tab'lar yatay scroll.
- Tap → görev detay tam ekran drawer.

### Status badge
- Öncelik: Düşük (gri) / Normal (mavi) / Yüksek (turuncu) / Acil (kırmızı pulse).
- Durum: Yeni / Başladı / Bekliyor / Ertelendi / Tamamlandı.

### Görev/bildirim/chat
- Görev → bağlı kayıt link.
- Görev içinde yorum thread (chat ile entegre değil, GorevYorumu).
- @mention bildirimi.

### Geliştirici notları
- `<TaskCard>`, `<TaskDetailDrawer>`, `<TaskTimeline>`.
- Drag-drop yeniden sıralama (öncelik).

---

## EKRAN 10 — Sağ Alt Chat Widget + Mesaj Merkezi

### Amaç
Operasyon kayıtlarına bağlanabilir kurumsal chat (MVP-3 — Faz 0C'de design hazır, geliştirme sonra).

### Roller
- Tüm kullanıcılar (yetkiye göre thread görünür).

### Layout — Widget
- Sağ alt sabit (16px margin).
- **Collapsed:** zarf ikonu (44×44) + okunmamış mesaj rozet.
- **Expanded (360×500):** üst başlık + thread listesi → seçince mesaj listesi.
- "Tam ekran" ikonu → Mesaj Merkezi sayfasına geçer.

### Layout — Mesaj Merkezi (full page)
- **Sol (320px):** Thread listesi + arama + filtre (Birebir / Grup / Kayıt-Bağlantılı / Mention'larım / Okunmamış).
- **Orta:** Aktif thread mesaj akışı + input bar (dosya + emoji + mention + gönder).
- **Sağ (320px) opsiyonel:** Thread context (bağlı kayıt detayı, katılımcılar, dosya listesi).

### Aksiyon Butonları
- + Yeni Mesaj (kullanıcı seç + grup mu birebir mi).
- Thread'i kayda bağla (drawer: kayıt seç).
- Sessize al / Arşivle / Çık (grup'tan).

### Modal'lar
- Yeni mesaj başlat.
- Dosya yükle.
- Bağlı kayıt seçici.

### Empty state
- "Henüz mesaj yok. Bir kayıt veya kullanıcıyla konuşma başlatın."

### Mobil
- Widget mobile'de collapsed → tıklayınca **tam ekran** chat.
- Mesaj Merkezi mobile'de tek kolon (thread listesi → tıklama → mesaj akışı).

### Status badge
- Mesaj okundu (mavi tik), iletildi (gri tik).
- Thread'de okunmamış sayısı (kırmızı rozet).
- Mention badge.

### Görev/bildirim/chat ilişkisi
- Mention → bildirim merkezi.
- Kayıt-bağlantılı thread → kayıt detay sayfasında "Chat" tab'ında aynı thread görünür.
- Görev içinden "Chat'te tartış" butonu.

### Geliştirici notları
- `<ChatWidget>` (collapsed/expanded).
- `<MessageList>`, `<MessageInput>`, `<ThreadContext>`.
- WebSocket bağlantı (Faz 11).
- Optimistic update + retry.

---

# BÖLÜM C — MVP-1 16 MODÜL EKRAN HARİTASI

| # | Modül | Liste | Detay | Form | Import | Rapor | Dashboard Widget | Mobil | Chat/Görev |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | Dashboard | — | — | — | — | — | (kendisi) | ✅ | — |
| 2 | Fatura Takip | ✅ | ✅ | ✅ (drawer) | ✅ | ✅ | "Yaklaşan ödemeler" | Kart akışı | Bağ ✅ |
| 3 | Ödeme Takip | ✅ (matris/tablo) | ✅ | ✅ | ✅ | ✅ | "Bugün öde", "Eksik dekont" | Kart | Bağ ✅ |
| 4 | Import Merkezi | ✅ (batch geçmiş) | ✅ (preview Ekran 3) | — | (kendisi) | — | "Import bekleyen" | Sekmeli | Görev ✅ |
| 5 | Abonelik & Taahhüt | ✅ + Takvim | ✅ | ✅ | ✅ | ✅ | "Yaklaşan taahhüt" | Kart | Bağ ✅ |
| 6 | SiteX | ✅ (5 daire kart) | ✅ (timeline) | ✅ | ✅ (RAR) | ✅ | "SiteX ay özeti" | 2x3 grid | Görev + Chat ✅ |
| 7 | Emlak Vergisi | ✅ (mülk×dönem grid) | ✅ (drawer) | ✅ | ✅ (RAR) | ✅ | "Emlak yaklaşan" | Mülk kart | Görev ✅ |
| 8 | Teminat Mektupları | ✅ (aktif/iade) | ✅ (komisyon takvimi) | ✅ | ✅ | ✅ | "Komisyon yaklaşan" | Kart | Görev ✅ |
| 9 | Düzenli Ödemeler / Kira | ✅ | ✅ (yıllık tutar) | ✅ | ✅ | ✅ | (içerik dashboard'a) | Kart | Görev ✅ |
| 10 | Resmi Ödemeler | ✅ (BAĞKUR/İTO/SSK/BES grid'leri) | ✅ | ✅ | ✅ | ✅ | "Resmi yaklaşan" | Tip seçici + kart | Görev ✅ |
| 11 | ETA/Papinet/Entegratör/Kontör | ✅ + Sözleşme takvimi | ✅ | ✅ | ✅ | ✅ | "Kontör eşik altı", "Sözleşme bitişi" | Kart | Görev ✅ |
| 12 | Ajanda & Görev | ✅ (Bugün/Hafta/Ay) | ✅ (drawer) | ✅ | — | ✅ | "Bugünkü görevler" | Tam ekran | (kendisi) |
| 13 | Chat Widget | (Mesaj Merkezi) | (Thread) | + Yeni Mesaj | — | — | (widget) | Tam ekran | (kendisi) |
| 14 | Bildirim / Telegram | ✅ | ✅ (log) | + Telegram Konfig | — | ✅ | (zil rozet) | Kart | — |
| 15 | Raporlama | (Şablon listesi) | (Rapor önizleme) | + Rapor üret | — | (kendisi) | — | Liste | — |
| 16 | AuditLog / Yetki | ✅ + Kullanıcı CRUD | ✅ (zaman çizelgesi) | + Kullanıcı / Rol | — | ✅ | (Yönetici widget) | Liste | — |

---

# BÖLÜM D — IMPORT PREVIEW UI KURGUSU (DETAY)

## D.1 Excel Import Preview
- Sol: Excel sheet listesi + seçili sheet'in ilk 50 satır görünümü (read-only).
- Sağ: Mapping uygulanmış ImportDraft satırları.
- Çift tıklama satır → sağ panel düzenleme.
- Sheet bazlı toplu reddet.

## D.2 PDF Import Preview
- Sol: PDF.js embed (zoom + sayfa nav).
- Sağ: Çıkarılan alan paneli (filename parse + opsiyonel OCR).
- Alan üzerine tıklama → PDF'te ilgili region highlight (OCR varsa).
- "Manuel doldur" alanı.

## D.3 RAR / Klasör Import Preview
- Sol: Klasör ağacı (expandable) + dosya listesi.
- Sağ: Her dosya için parse edilmiş metadata (yıl/ay/daire/belediye/şahıs).
- Toplu işaretleme + filtreleme (şu klasörü atla).

## D.4 Renk Kodlu Satır Sistemi
- 🟢 Yeşil: Tüm zorunlu alanlar dolu, dedup ok.
- 🟡 Sarı: Uyarı (örn. tutar 0, "X" işareti varsayımı).
- 🔴 Kırmızı: Zorunlu alan eksik / format hatası / referans bulunamadı.
- 🟣 Mor: Manuel doğrulama gerekli (örn. yeni şirket/şahıs eşleşmesi).

## D.5 Aksiyon Akışı
1. Tümünü onayla → onay modal → commit (progress bar).
2. Sadece yeşilleri onayla → kalanlar taslakta kalır.
3. Reddet (sebep zorunlu) → batch durumu REDDEDILDI.
4. Mapping'e dön → Step 2'ye.
5. Taslakta bırak → kapat, sonra devam et.
6. Rollback (commit sonrası 24 saat içinde) → tüm yaratılan kayıtlar soft-delete.

## D.6 ImportLog Görünümü
- Aksiyon zaman çizelgesi: UPLOAD → PARSE → MAPPING → PREVIEW → APPROVE → COMMIT.
- Her aksiyon için kullanıcı + zaman + detay JSON.

## D.7 Mobil Import
- Yükleme: dosya seç + hedef modül dropdown.
- Mapping: zorunlu desktop (mobile uyarı: "Mapping için masaüstü kullanın.").
- Önizleme: özet + hata sayısı + "Masaüstünden devam et" linki. Mobilde sadece "tümünü onayla" basit aksiyon.

---

# BÖLÜM E — AJANDA / GÖREV UI KURGUSU (DETAY)

## E.1 Ekran modları
- **Bugünkü görevlerim** (ana — Ekran 9)
- **Yaklaşan görevlerim** (sonraki 7 gün)
- **Geciken görevlerim** (son tarih geçmiş)
- **Bana atananlar** (kişi filtresi: ben)
- **Benim atadıklarım** (kişi filtresi: ben → diğer)
- **Kişi bazlı görev takibi** (Yönetici/Müdür: tüm kullanıcılar kanban)
- **Günlük takvim** (saatli)
- **Haftalık takvim** (kişi swimlane veya tek user)
- **Aylık takvim** (heatmap)

## E.2 Görev Kartı
- Sol kenar 4px renk: öncelik.
- Üst: başlık (semibold).
- Orta: bağlı kayıt link (örn. "SiteX / A4.17 / 2026-04 ekstre").
- Alt: avatars (atayan + atanan) + son tarih badge + yorum sayısı 💬 + ek sayısı 📎.

## E.3 Görev Detay Drawer
- Header: başlık + öncelik + durum + sağ üst aksiyonlar (Tamamla / Ertele / Düzenle / Sil).
- Body tab'ları:
  - **Genel:** Açıklama + bağlı kayıt + atayan/atanan + son tarih + öncelik + şablon kaynağı.
  - **Yorumlar:** thread (timestamp + user avatar + metin + dosya), input bar.
  - **Dosyalar:** ek listesi + yükle.
  - **İşlem Geçmişi:** GorevGecmisi zaman çizelgesi.

## E.4 Erteleme
- Modal: yeni tarih + sebep (zorunlu) + bilgi: "Bu işlem audit'lenir."

## E.5 Tamamlama
- Tek tıkla checkbox veya buton.
- Eğer bağlı kayıt için zorunlu işlem (örn. dekont) varsa "Önce dekont yükleyin" uyarısı.

## E.6 Mobil Görev
- Tab'lar yatay scroll.
- Görev kartları tek kolon.
- Tap → tam ekran drawer.
- Swipe right: Tamamla. Swipe left: Ertele.
- "+" floating action button (yeni görev).

## E.7 Kanban (Yönetici/Müdür kişi bazlı)
- Sütunlar: Yeni / Başladı / Bekliyor / Ertelendi / Tamamlandı.
- Drag-drop ile durum değiştir (mobile: tap → durum modal).
- Kullanıcı filtresi (kim).

---

# BÖLÜM F — CHAT WIDGET UI KURGUSU (DETAY)

## F.1 Sağ Alt Widget
- Sabit; collapse default.
- 16px margin sağ alt.
- Z-index 1000.
- Açma: tıklama → 320ms ease.
- Mobile: tıklama → tam ekran chat.

## F.2 Birebir Mesaj
- Thread başlığı: kullanıcı adı + avatar + online indicator.
- Mesaj balonları: gönderen sağda (brand-100 BG), alıcı solda (neutral-100 BG).
- Zaman saat olarak (24 saat içinde "saat:dakika", öncesi tarih).

## F.3 Grup Mesajı
- Thread başlığı: grup adı + üye sayısı.
- Mesajda gönderen avatar + ad yazılı.

## F.4 Görev/Kayıt-Bağlantılı Sohbet
- Thread başlığı: 📎 ikon + bağlı kayıt etiketi (örn. "SiteX / A4.17 / 2026-04").
- Üstte sticky context kartı: özet bilgi + "Kayıt aç" butonu.

## F.5 Chat Inbox (Mesaj Merkezi)
- Sol: thread listesi (son mesaj önizleme + zaman + okunmamış rozet).
- Orta: aktif thread.
- Sağ (opsiyonel): context paneli (bağlı kayıt detayı / katılımcılar / paylaşılan dosyalar).

## F.6 Okundu Bilgisi
- Tek gri tik: gönderildi.
- İki gri tik: iletildi.
- İki mavi tik: okundu (alıcının görme zamanı).

## F.7 Dosya Eki
- Drag-drop chat input'una.
- Önizleme inline (resim/PDF) + indir.
- 25 MB max.

## F.8 Bildirim Rozeti
- Topbar zil + chat widget zarf.
- Sayı görünür (>9 ise "9+").

## F.9 Mobil Chat
- Tam ekran.
- Üst: geri ok + thread başlığı.
- Alt: input bar + dosya/emoji butonları.
- Mesajlar smooth scroll.

## F.10 Chat Arama
- Thread arama (başlık).
- Mesaj içi arama (filtre: tarih, gönderen, dosya).

## F.11 Yetki Sınırları
- Bir kullanıcı sadece üye olduğu thread'leri görür.
- Kayıt-bağlantılı thread: kayda erişim yetkisi olanlar görür.
- Thread'den çıkma audit'lenir.

---

# BÖLÜM G — MOBİL UI STANDARTLARI (DETAY)

| # | Kural |
|---|---|
| G.1 | iPhone Pro Max (430×932), iPad Mini (744×1133), masaüstü 1440+ test. |
| G.2 | 390px ve 430px viewport: tüm kritik fonksiyonlar erişilebilir. |
| G.3 | Touch target minimum 44×44px (Apple HIG). |
| G.4 | Form input minimum 16px font (iOS auto-zoom önleme). |
| G.5 | Tablo → kart akışı (responsive breakpoint <768px). |
| G.6 | Sticky aksiyon bar: form ekranlarında alt sticky kaydet/iptal butonları. |
| G.7 | Modal mobile'de tam ekran (≤640px). Drawer da mobile'de tam ekran. |
| G.8 | Chat mobile'de fullscreen. |
| G.9 | Import preview mobile'de sekmeli görünüm: Özet / Satırlar / Hatalar / Belge. |
| G.10 | Takvim mobile'de tek gün veya tek hafta default; ay görünümü heatmap. |
| G.11 | Hamburger sol menü. Topbar minimal. |
| G.12 | Floating action button (+) yeni kayıt için liste ekranlarında. |
| G.13 | Swipe gesture'lar: görev tamamla/ertele, mesaj sil. |
| G.14 | Dosya yükleme: capture="camera" attribute (dekont fotoğraf). |
| G.15 | Bottom sheet pattern modal yerine bazı senaryolarda (filtre). |
| G.16 | Status bar safe-area: padding top/bottom otomatik. |
| G.17 | Skeleton loading mobile'de daha agresif (yavaş ağ). |
| G.18 | Offline indicator: bağlantı kesilince üst banner. |

---
