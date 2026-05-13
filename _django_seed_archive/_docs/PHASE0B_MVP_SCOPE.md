# FAZ 0B — MVP KAPSAM DOSYASI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

> Üç katman: **MVP-1** (ilk canlı sürüm), **MVP-2** (yakın dönem), **LATER** (ileri vadeli).

---

## A. MVP-1 — İLK CANLI SÜRÜM (16 modül)

### A.1 Yetki ve Kullanıcı Yönetimi (#21)
- **Gerekçe:** Her şeyden önce — diğer modüllerin yetki kontrolü buna bağlı.
- **Bağımlılık:** —
- **Risk:** Düşük (Django built-in).
- **Veri kaynağı:** Manuel kullanıcı girişi.
- **Tasarım ihtiyacı:** Kullanıcı listesi, ekle/düzenle, rol matrisi.

### A.2 AuditLog (#20)
- **Gerekçe:** Her CRUD'un izlenmesi — KVKK + iç denetim.
- **Bağımlılık:** —
- **Risk:** Düşük.
- **Veri kaynağı:** Sistem üretir.
- **Tasarım ihtiyacı:** Liste, kayıt zaman çizelgesi.

### A.3 Çekirdek Master (Sahis/Sirket/Mulk/Banka/Kurum)
- **Gerekçe:** Tüm kayıtların temeli.
- **Bağımlılık:** Yetki.
- **Risk:** Düşük (manuel onay).
- **Veri kaynağı:** Manuel + Şirket Abonelik Excel'inden seed.
- **Tasarım ihtiyacı:** 5 master tablosu CRUD.

### A.4 Import Merkezi (#18)
- **Gerekçe:** Tüm Excel/RAR göçü için zorunlu omurga.
- **Bağımlılık:** Çekirdek master.
- **Risk:** Yüksek (mapping hatası → veri kalitesi).
- **Veri kaynağı:** 12 dosya.
- **Tasarım ihtiyacı:** Yükleme, mapping editor, ön izleme, hata, onay, geçmiş, rollback.

### A.5 Fatura Takip (#2)
- **Gerekçe:** Operasyon merkezi.
- **Bağımlılık:** Çekirdek + Abonelik.
- **Risk:** Orta (mapping & dedup).
- **Veri kaynağı:** Şirket/Ev Abonelik + Ödemeler Çizelgeleri.
- **Tasarım ihtiyacı:** Liste, detay, ekle, ödeme bağla.

### A.6 Ödeme Takip (#4)
- **Gerekçe:** Faturayla eşleşen ödemeler.
- **Bağımlılık:** Fatura + Banka.
- **Risk:** Orta.
- **Veri kaynağı:** Tüm ödeme Excel'leri.
- **Tasarım ihtiyacı:** Liste (matris/tablo), detay, mutabakat, eksik dekont.

### A.7 Otomatik Ödemeler (#5)
- **Gerekçe:** Banka talimatlı kalemler ayrı izlenir.
- **Bağımlılık:** Abonelik.
- **Risk:** Düşük.
- **Veri kaynağı:** EV/ŞAHIS/ŞİRKET ABONELİKLERİ.
- **Tasarım ihtiyacı:** Talimat listesi.

### A.8 Ev / Şahıs Otomatik (#8)
- **Gerekçe:** Aile bireyleri akış görünümü.
- **Bağımlılık:** A.7.
- **Risk:** Düşük.

### A.9 Abonelik & Taahhüt (#7)
- **Gerekçe:** Taahhüt bitişi kritik.
- **Bağımlılık:** Çekirdek + Kurum.
- **Risk:** Orta.
- **Veri kaynağı:** ŞİRKET/EV ABONELİKLERİ.

### A.10 SiteX (#9)
- **Gerekçe:** Aylık 5 daire × 2 PDF düzenli akış. Çok aktif iş.
- **Bağımlılık:** Mülk + Belge.
- **Risk:** Yüksek (PDF hacmi, regex parse).
- **Veri kaynağı:** SITEX.rar (277 dosya).
- **Tasarım ihtiyacı:** Daire kart, daire detay, ekstre PDF, aidat farkı, yıllık belge arşiv.

### A.11 Emlak Vergisi (#10)
- **Gerekçe:** Yılda 2 dönem zorunlu ödeme.
- **Bağımlılık:** Mülk + Belge.
- **Risk:** Yüksek (heterojen PDF/JPG).
- **Veri kaynağı:** EMLAK 2024.rar + 2025.rar + ÖDEMELER TAKİP "EMLAK".
- **Tasarım ihtiyacı:** Mülk × yıl × dönem grid, belediye filtre.

### A.12 Teminat Mektupları (#11)
- **Gerekçe:** Finansal kritik kalem.
- **Bağımlılık:** Sirket + Banka.
- **Risk:** Yüksek (heterojen sheet, finansal).
- **Veri kaynağı:** TEMİNAT MEKTUPLARI Excel.
- **Tasarım ihtiyacı:** Liste, detay, komisyon takvimi, iade.

### A.13 Resmi Ödemeler (#13)
- **Gerekçe:** BAĞKUR + İTO + SSK + BES.
- **Bağımlılık:** Sahis + Sirket.
- **Risk:** Orta.
- **Veri kaynağı:** BAĞKUR, İTO, ÖDEMELER TAKİP Bağkur sheet.

### A.14 Düzenli Ödemeler / Kira (#12)
- **Gerekçe:** Şirketler arası kira düzenli.
- **Bağımlılık:** Sirket.
- **Risk:** Orta.
- **Veri kaynağı:** ÖDEMELER TAKİP Kira sheet'leri (2020-2026).

### A.15 Ajanda & Görev (#15)
- **Gerekçe:** Operasyon merkezinin kalbi.
- **Bağımlılık:** User.
- **Risk:** Orta (otomatik üretim cron).
- **Veri kaynağı:** Sistem üretir + manuel.
- **Tasarım ihtiyacı:** 9 ekran (bugün, takvimler, kanban, detay, şablon).

### A.16 Bildirim Merkezi (#17) — Telegram **dry-run modunda**
- **Gerekçe:** Sistem içi uyarı + NotificationLog. Telegram gerçek gönderim **Faz 12'de** açılır.
- **Bağımlılık:** Görev, tüm modüller.
- **Risk:** Düşük (gerçek Telegram kapalı kaldıkça).
- **Tasarım ihtiyacı:** Bildirim merkezi, ayar, dry-run görüntüleme.

### A.17 Dashboard (#1)
- **Gerekçe:** Tüm modüller bittikten sonra konsolide ekran.
- **Bağımlılık:** Tüm modüller.
- **Risk:** Düşük (read-only).
- **Tasarım ihtiyacı:** KPI kart + 7 widget.

> **MVP-1 toplam:** 17 madde (Çekirdek master + 16 modül).

---

## B. MVP-2 — YAKIN DÖNEM (6 madde)

### B.1 PDF Fatura Import / OCR (#3)
- **Gerekçe:** Manuel yükleme yerine otomatik metadata.
- **Bağımlılık:** Import Merkezi (MVP-1).
- **Risk:** Çok Yüksek (OCR güvenilirliği).
- **Tasarım ihtiyacı:** OCR önizleme, düzeltme.

### B.2 Elden / EFT / Kart Detay (#6)
- **Gerekçe:** Ödeme yönteminden detaylı raporlama.
- **Bağımlılık:** Ödeme.
- **Risk:** Düşük.

### B.3 ETA / Papinet / Entegratör / Kontör (#14)
- **Gerekçe:** Sözleşme bitişi + kontör eşik takibi.
- **Bağımlılık:** Sirket + Belge.
- **Risk:** Yüksek.
- **Veri kaynağı:** PAPİNET.rar.

### B.4 Raporlama / Excel Export (#19)
- **Gerekçe:** Yöneticiye düzenli rapor.
- **Bağımlılık:** Tüm modüller.
- **Risk:** Orta.

### B.5 Telegram Gerçek Gönderim Aktivasyonu (Faz 12)
- **Gerekçe:** Bildirim merkezinin nihai aşaması.
- **Bağımlılık:** Bildirim Merkezi (MVP-1) + dry-run/test başarılı.
- **Risk:** Yüksek (yanlış grup, spam).

### B.6 PWA / Mobil Optimizasyon İleri Aşama
- **Gerekçe:** Saha kullanımı.
- **Bağımlılık:** Tüm UI tamamlanmış.
- **Risk:** Düşük.

---

## C. LATER — İLERİ VADELİ

### C.1 Kurumsal Chat / Mesajlaşma Widget (#16)
- **Gerekçe:** Operasyon kayıtları üzerinde sohbet.
- **Bağımlılık:** WebSocket + tüm modüller.
- **Risk:** Yüksek (real-time + UI kompleksitesi).
- **Tasarım ihtiyacı:** 7 ekran.

### C.2 Banka API Entegrasyonu
- Hesap hareketi otomatik çekme + ödeme mutabakatı.

### C.3 SiteX Site Portalından Otomatik Ekstre Indirme
- Aylık otomatik PDF çekme.

### C.4 Entegratör API'sından Kontör Bakiye Otomatik Güncelleme
- Papinet/EDM API.

### C.5 SSO / LDAP Entegrasyonu
- Diğer Acme projeleriyle ortak kimlik (izolasyon kuralı çerçevesinde).

### C.6 Native Mobile App
- iOS + Android.

### C.7 Çoklu Para Birimi (USD/EUR)
- Teminat ve döviz sözleşmeleri için.

### C.8 İş Zekası / Dashboard'da Trend Grafikleri
- Aylık-yıllık karşılaştırma, anomali tespiti.

---

## D. MVP-1 KABUL KRİTERLERİ (DEFINITION OF DONE)

MVP-1 canlıya çıkmadan önce:
- [ ] 17 madde tamamlandı, smoke test geçti.
- [ ] Çekirdek master (Sahis/Sirket/Mulk/Banka/Kurum) seed edilmiş ve onaylanmış.
- [ ] İlk import partisi (10 adım) en az %80 başarıyla tamamlanmış.
- [ ] AuditLog her CRUD'da yazıyor.
- [ ] Soft-delete tüm modellerde aktif.
- [ ] Yetki matrisi 6 rol için test edilmiş.
- [ ] Bildirim merkezi sistem içi + dry-run aktif (gerçek Telegram **kapalı**).
- [ ] Mobil responsive testleri 3 cihaz boyutunda geçti (iPhone Pro Max, iPad, masaüstü).
- [ ] Dashboard KPI'ları doğru veri çekiyor.
- [ ] Yedekleme cron'u kurulu (günlük DB + haftalık dosya).
- [ ] AuditLog'da TC/telefon maskeleme aktif.
- [ ] Kullanım kılavuzu (5-10 sayfa) hazır.
- [ ] Eğitim videosu (15-30 dk) hazır.

---
