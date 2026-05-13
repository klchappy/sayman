# FAZ 0B — KARAR DEFTERİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05
**Amaç:** Anayasa onaylanmadan/uygulanmadan önce kullanıcıdan karar bekleyen tüm açık konular.

> Karar verildikten sonra bu dosyada **DURUM**, **KARAR**, **KARAR VEREN**, **KARAR TARİHİ** alanları doldurulur. Anayasa'ya yansıyan kararlar `PROJECT_ANAYASA.md`'de versiyon güncellemesiyle işlenir.

---

## D-001 — İlk MVP Modül Listesi
- **Soru:** Anayasa Madde 5'teki MVP-1 listesi (16 modül) onaylanıyor mu? Çıkarılması/eklenmesi gereken modül var mı?
- **Önerilen:** Yetki, Dashboard, Fatura, Ödeme, Otomatik Ödemeler, Ev/Şahıs, Abonelik+Taahhüt, SiteX, Emlak, Teminat, Resmi Ödemeler, Kira, Ajanda+Görev, Bildirim (Telegram'sız), Import, Audit. **Chat MVP-3'e**, **PDF OCR MVP-2'ye**, **Raporlama Excel export MVP-2'ye**.
- **Etki:** Faz 4-13 sırası ve süresi.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-002 — İlk Import Hangi Dosyalardan Başlasın?
- **Soru:** Faz 0A'da önerilen 10 adımlık göç sırası kabul mü? İlk hangi 3 dosyayla başlanır?
- **Önerilen başlangıç:** (a) ŞİRKET ABONELİKLERİ + EV ABONELİKLERİ meta sheet → master abonelik, (b) SITEX daire master + 2026 ekstreleri, (c) Şahıs/ev otomatik ödeme 2025-2026.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-003 — SiteX Varsayılan Son Ödeme Günü
- **Soru:** SiteX ödeme günü kesin ayın **20'si** mi, daire bazında değişebiliyor mu?
- **Gözlem:** Veride 19-22 arası dağılmış (Test B3.31: 22'si, Kaan B2.28: 22'si, A4 daireleri 17-25). **Daire bazlı override**, varsayılan 20 önerilir.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-004 — Telegram İlk Aşamada Kimlere Gidecek?
- **Soru:** Telegram gerçek gönderimi (Faz 12'de açılır) ilk aşamada hangi kanala gider?
- **Seçenekler:** (a) Yönetici özel chat, (b) Muhasebe ekibi grubu, (c) Modül bazlı ayrı gruplar.
- **Önerilen:** Tek "Muhasebe Operasyon" grubu + acil bildirimler için "Acil" alt grubu.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-005 — Görev Atama Rolleri
- **Soru:** Kim kime görev atayabilir?
- **Önerilen:** Yönetici → herkese; Muh. Müdürü → muhasebeciler ve personele; Muhasebeci → kendi alt görevlerini personele; Personel → atayamaz.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-006 — Chat MVP'ye Dahil mi?
- **Soru:** Kurumsal chat MVP-1'e mi MVP-2'ye mi MVP-3'e mi?
- **Önerilen:** **MVP-3**. MVP-1'de görev yorumları yeterli. Chat ayrı bir kompleks modül; UI/UX ve real-time altyapı gerektirir.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-007 — PDF OCR Otomasyon Seviyesi
- **Soru:** İlk fazda PDF OCR ne kadar otomatik?
- **Seçenekler:** (a) Sıfır OCR — sadece manuel yükleme + alan girişi, (b) Sadece dosyaadı/metadata parse, (c) Tam OCR + alan ekstraksiyon.
- **Önerilen:** **(b)** — MVP-1'de dosyaadı + metadata parse. OCR MVP-2'de.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-008 — Gerçek Ödeme Onayı Kim Yapar?
- **Soru:** "Ödeme yapıldı" → kesin işaretleme yetkisi kimde?
- **Seçenekler:** (a) Muhasebeci işaretleyebilir; (b) Müdür onayı zorunlu; (c) İki kademeli (muhasebeci işaretler → müdür onaylar).
- **Önerilen:** **(a)** muhasebeci işaretleyebilir, fakat tutar X TL üzeri ödemeler için **(c)** iki kademeli zorunlu (tutar eşiği belirlenmeli).
- **Durum:** ⏳ KARAR BEKLİYOR — Eşik tutarı netleştirilmeli.

## D-009 — Import Onayı Kimde?
- **Soru:** Import commit (kesin kayıt yaratma) yetkisi kimlerde?
- **Önerilen:** Yönetici + Muh. Müdürü. Muhasebeci yükler/önizler ama commit edemez.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-010 — Rapor / Export Yetkisi
- **Soru:** Excel/PDF export yetkisi kimlerde? Salt görüntüleyici export edebilir mi?
- **Önerilen:** Yönetici, Müdür, Muhasebeci ✅. Personel sınırlı. Salt görüntüleyici ❓ (büyük olasılıkla ⛔ — KVKK).
- **Durum:** ⏳ KARAR BEKLİYOR

## D-011 — Fatura/Dekont Yükleme Zorunlu mu?
- **Soru:** Ödeme işaretlerken dekont eklemek zorunlu mu?
- **Önerilen:** Tutar X TL üzeri için zorunlu (eşik kararlaştırılmalı; örn. 5.000 TL). Diğer durumlarda öneri ama zorunlu değil.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-012 — Fiziksel Silme Tamamen Yasak mı?
- **Soru:** Soft-delete + arşiv her durumda mı, yoksa Super Admin için kontrollü hard-delete istisnası var mı?
- **Önerilen:** Soft-delete varsayılan. Super Admin **çift onay + sebep + audit log** ile hard-delete yapabilir (yanlış import temizliği için).
- **Durum:** ⏳ KARAR BEKLİYOR (Anayasa Madde 3.8'e işlendi — onay bekliyor)

## D-013 — Claude Design'da Öncelikli Çizilecek Ekranlar
- **Soru:** Faz 0C'de hangi ekranlar ilk parti çizilsin?
- **Önerilen ilk parti (10):** Ana Dashboard, Login, Fatura listesi+detay, Ödeme listesi, SiteX daire detay, Emlak vergisi grid, Teminat detay, Görev detay, Import preview, Bildirim merkezi.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-014 — Domain / Prod Adı
- **Soru:** Üretim domain adı ne olacak? (örn. `muhasebe.acme.local`, `mop.acme.com.tr`, vb.)
- **Etki:** Faz 14 deploy. Şimdilik bekleyebilir.
- **Durum:** ⏳ İLERİDE

## D-015 — Veritabanı Seçimi
- **Soru:** PostgreSQL onaylı mı?
- **Önerilen:** PostgreSQL (15+) — JSON alan desteği import için kritik.
- **Durum:** ⏳ KARAR BEKLİYOR (Faz 1 başlamadan)

## D-016 — Auth Mekanizması
- **Soru:** Django built-in mi, SSO mu, 2FA?
- **Önerilen:** MVP-1: Django built-in + opsiyonel TOTP 2FA. SSO sonra.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-017 — Hosting / Sunucu
- **Soru:** Aynı sunucu (diğer Acme projeleriyle) mi, ayrı VPS mi?
- **Önerilen (Anayasa 1.5 izolasyon kuralı):** Ayrı VPS önerilir. Minimum ayrı DB schema zorunlu.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-018 — Eski Yıllar (2020-2024) Import Edilecek mi?
- **Soru:** Sadece 2025+ mi, yoksa tarihçe için 2020+ tüm veri mi?
- **Önerilen:** Tarihçe için **2020+** ama "geçmiş veri" flagiyle (otomatik görev/bildirim üretmesin).
- **Durum:** ⏳ KARAR BEKLİYOR

## D-019 — Çoklu Dil / Para Birimi
- **Soru:** Sadece TR + TRY mi?
- **Önerilen:** Sadece TR + TRY (MVP-1). USD/EUR ileride teminat/sözleşme için değerlendirilir.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-020 — Mobil Uygulama Scope'u
- **Soru:** Sadece web responsive mi, native app da gelecek mi?
- **Önerilen:** Web responsive yeterli. Native PWA opsiyonu Faz 13+ değerlendirilir.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-021 — Tutar Eşik Değerleri (D-008 / D-011 ile bağlantılı)
- **Soru:** "Çift onaylı ödeme" ve "Zorunlu dekont" tutar eşikleri kaç TL?
- **Önerilen:** 5.000 TL (zorunlu dekont), 50.000 TL (çift onay). Anayasa'da değil ayar tablosunda saklanmalı.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-022 — Şahıs/Şirket/Mülk Master Listesi Onayı
- **Soru:** Faz 0A'dan çıkan listeler kesinleşti mi?
- **Şahıs (5):** Mehmet Rahim Acme, Mehmet Ali Acme, Ali Acme, Test Kullanıcı, Kaan Acme (+ BAĞKUR'da Tal'in, Mehriban, Meliha, Semra Aydar)
- **Şirket (~10):** Acme Enerji (Yeniçe HES, Kısık), Acme Tekstil, Beta Tekstil, KC İplik, MakYapı, MDT, FMK, Beta Otel, KC Enerji
- **Mülk:** SiteX 5 daire + Yeniçe HES + Kısık + Yeniçe bina + Florya ev + ofis/fabrikalar
- **Durum:** ⏳ KARAR BEKLİYOR — eksik veya hata var mı?

## D-023 — Bildirim Saatleri
- **Soru:** Geciken görev günlük özeti saat 09:00, gün sonu 17:30 — bu saatler doğru mu?
- **Önerilen:** 09:00 ve 17:30 — kullanıcı tercihinden değiştirilebilir.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-024 — SiteX Ekstre Otomatik Indirme
- **Soru:** SiteX site portalından otomatik ekstre indirme entegrasyonu MVP'ye dahil mi?
- **Önerilen:** **Hayır.** Manuel yükleme + klasör import yeterli. Otomatik indirme Faz 13+.
- **Durum:** ⏳ KARAR BEKLİYOR

## D-025 — Kontör Bakiye Güncelleme Mekanizması
- **Soru:** Kontör bakiye manuel mi, entegratör API'sından mı?
- **Önerilen:** MVP-2: manuel (PAPİNET XLSX import). API entegrasyonu LATER.
- **Durum:** ⏳ KARAR BEKLİYOR

---

## TOPLAM
- **25 açık karar.**
- Anayasa'nın "kesin" maddeleri (kapsam, izolasyon, prensipler, import kuralı, soft-delete, dark mode yok, vb.) Faz 0A'dan miras ve değişmez.
- Aşağıdaki kararlar onaylanmadan **Faz 0C başlatılmamalıdır:** D-001, D-013, D-022.
- Aşağıdaki kararlar onaylanmadan **Faz 1 (teknik mimari) başlatılmamalıdır:** D-015, D-016, D-017, D-018.
