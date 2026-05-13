# FAZ 0A — CLAUDE DESIGN EKRAN LİSTESİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 0A — Tasarım brief'i (Faz 0C için input)
**Tarih:** 2026-05-05

> Bu doküman Claude Design'da çizilecek ekranların kapsam listesidir. Renk paleti, grid sistemi ve component standartları Faz 0C'de finalize edilir.

---

## 1. GLOBAL STANDARTLAR (Faz 0C'de finalize)

| Standart | Önerilen |
|---|---|
| Layout | Sol menü (collapse) + üst topbar + içerik + sağ alt chat widget |
| Grid | 12 kolon, 16px gutter |
| Tipografi | Inter / IBM Plex Sans (Türkçe karakter desteği) |
| Renk teması | Kurumsal lacivert + beyaz; durum renkleri: yeşil (ödendi), sarı (bekliyor), kırmızı (geciken), gri (iptal) |
| Component'lar | Button, Input, Select, DatePicker (TR), DataTable, Tag/Badge, Card, Modal, Drawer, Tabs, Stepper, FilterBar, Toast, EmptyState, FileUploader, KPI Card |
| Bildirim rozeti | Topbar zil ikonu + sayı |
| Para formatı | `₺ 1.234,56` (TR locale) |
| Tarih formatı | `dd.MM.yyyy` |
| Mobil | Önce dashboard + görev + chat (rest read-only mobile) |

---

## 2. ANA EKRAN LİSTESİ

### 2.1 Authentication & Profil
1. Login
2. Şifre sıfırlama
3. Kullanıcı profili
4. Bildirim tercihleri
5. Telegram bağlama (per kullanıcı)

### 2.2 Dashboard
6. Ana Dashboard (KPI kartları + bugünkü görevler + yaklaşan ödemeler + uyarılar)
7. Bugün widget — geciken/bugün/yaklaşan
8. Yaklaşan teminat komisyonları widget
9. Kontör eşik altı widget
10. Eksik dekont widget
11. Import bekleyenler widget
12. SiteX aylık özet widget

### 2.3 Fatura
13. Fatura listesi (filtre: şirket/dönem/durum/kurum/hizmet)
14. Fatura detay
15. Fatura ekle/düzenle modal
16. Fatura → Ödeme bağlama drawer

### 2.4 Ödeme
17. Ödeme listesi (matris ay görünümü ↔ tablo görünümü toggle)
18. Ödeme detay
19. Ödeme ekle/düzenle
20. Mutabakat ekranı (banka hareket ↔ ödeme eşleme)
21. Eksik dekont listesi
22. Ödeme yöntemi raporu (Otomatik/Elden/EFT/Kart pie + tablo)

### 2.5 Abonelik & Taahhüt
23. Abonelik listesi
24. Abonelik detay (paket, taahhüt geçmişi, fatura geçmişi tab'ları)
25. Abonelik ekle/düzenle
26. Taahhüt bitiş takvimi (ay görünümü)
27. İptal süreç ekranı

### 2.6 Şahıs / Mülk / Şirket
28. Şahıs listesi
29. Şahıs detay (mülkler, abonelikler, ödemeler tab)
30. Şirket listesi
31. Şirket detay (abonelikler, kiralar, teminat, resmi ödemeler tab)
32. Mülk listesi
33. Mülk detay (emlak vergisi, abonelikler, fatura, görev tab)

### 2.7 SiteX
34. SiteX ana ekran (5 daire kartı + KPI)
35. Daire detay (yıl-ay timeline)
36. Aylık ekstre görüntüleyici (PDF embed + alanlar)
37. Aidat farkları tablosu
38. Yıllık belgeler arşivi (bütçe, denetim, faaliyet)

### 2.8 Emlak Vergisi
39. Emlak vergisi ana liste (mülk × yıl × dönem grid)
40. Mülk detay (emlak vergisi tarihçesi)
41. Belge yükleme (borç dökümü, makbuz)
42. Belediye bazlı görünüm

### 2.9 Teminat Mektupları
43. Teminat mektubu listesi (aktif/iade tab)
44. Teminat detay (komisyon takvimi)
45. Komisyon ödemeleri ekranı
46. Yeni mektup ekle
47. İade işlemi modal

### 2.10 Resmi Ödemeler
48. Resmi ödeme listesi (tip filtresi)
49. BAĞKUR şahıs × ay grid
50. İTO şirket × yıl × taksit grid
51. SSK / BES / vergi ekranları

### 2.11 ETA / Papinet / Entegratör / Kontör
52. Entegratör listesi
53. Şirket × Entegratör matrisi
54. Sözleşme bitiş takvimi
55. Kontör bakiye dashboard
56. Kontör hareket geçmişi
57. Fatura arşivi (entegratör bazlı)

### 2.12 Kira / Düzenli Ödemeler
58. Kira sözleşmesi listesi
59. Kira detay (yıllık tutar geçmişi + aylık ödeme)
60. Kira artış değerlendirme ekranı

### 2.13 Ajanda & Görev
61. Bugünkü işler
62. Haftalık takvim
63. Aylık takvim
64. Geciken görevler
65. Kişi bazlı görev panosu (kanban)
66. Görev detay (yorum, dosya, geçmiş, erteleme)
67. Görev şablonu yönetimi (otomatik üretim kuralları)

### 2.14 Chat / Mesajlaşma
68. Sağ alt chat widget (collapsed/expanded)
69. Mesaj merkezi tam ekran
70. Birebir thread
71. Grup thread
72. Kayıt-bağlantılı thread (örn. "SiteX A4.17 - 2026-03 ekstre" thread'i)
73. Mesaj arama
74. Mention notification

### 2.15 Bildirim
75. Bildirim merkezi (topbar dropdown + tam liste)
76. Bildirim ayarları (kanal × tip matrisi)
77. Telegram dry-run görüntüleme
78. Telegram test gönderim
79. NotificationLog audit

### 2.16 Import Merkezi
80. Yeni import (dosya tipi seçici + hedef modül)
81. Mapping ekranı (Excel kolon → model alan eşleştirme)
82. Ön izleme tablosu (yeşil=ok, sarı=uyarı, kırmızı=hata)
83. Hata listesi & düzeltme
84. Onay ekranı (özet + commit)
85. Import geçmişi
86. ImportBatch detay (rollback opsiyonu)
87. PDF/RAR yükleme + klasör parse ön izleme
88. PDF OCR ön izleme (faz 2)

### 2.17 Raporlama
89. Rapor seçici
90. Rapor parametreleri
91. Rapor önizleme
92. Excel/PDF export
93. Zamanlanmış rapor yönetimi

### 2.18 AuditLog
94. Genel audit log
95. Kayıt bazlı zaman çizelgesi (her kayıt sayfasında "Geçmiş" tab)

### 2.19 Yetki / Kullanıcı
96. Kullanıcı listesi
97. Kullanıcı ekle/düzenle (rol atama)
98. Rol & yetki matrisi
99. Aktif oturumlar

### 2.20 Sistem Ayarları
100. Şirket / banka / kurum tablosu yönetimi
101. Telegram konfig
102. Görev şablonu yönetimi
103. E-posta SMTP konfig
104. Yedek/restore

---

## 3. MOBİL (FAZ 11+ ESKETCH)

| # | Ekran |
|---|---|
| M1 | Mobil dashboard |
| M2 | Bugünkü görevler |
| M3 | Görev detay + tamamla |
| M4 | Bildirim listesi |
| M5 | Chat widget (full screen) |
| M6 | Ödeme okuma listesi (read-only) |
| M7 | Belge fotoğraf çekme & yükleme (dekont, makbuz) |

---

## 4. ÖZEL COMPONENT İHTİYAÇLARI

| Component | Notlar |
|---|---|
| Ay matrisi tablosu | 12 kolon (OCAK..ARALIK) + tarih + tutar 2 satır per kayıt; mobile'da scroll |
| KPI Card | Sayı + delta + ikon + drill-down link |
| Status Tag | Renk-kodlu durum etiketleri (ödendi/bekliyor/geciken/iptal/taslak/onay-bekliyor) |
| Belge Önizleyici | PDF embed + meta panel + onay/red butonu |
| Mapping Editor | Excel kolon listesi (sol) ↔ model alan listesi (sağ) drag-drop |
| Aylık Ödeme Grid | SiteX daire×ay matrisi (ödeme durumu renkli hücre) |
| Filter Bar | Çoklu filtre + kayıtlı görünüm + reset |
| Quick-Note | Her detay sayfasında sağda hızlı not + dosya ekleme |
| Activity Feed | Her detay sayfasında alt panel — audit + chat + görev birleşik akış |
| Telegram Test Drawer | "Dry-run mesajını gör" → "Test grubuna gönder" → "Gerçek gönder" stepper |

---

## 5. CLAUDE DESIGN'A GİRMEDEN ÖNCE KESİNLEŞMESİ GEREKEN KARARLAR

1. **Renk paleti** (kurumsal lacivert mi, başka mı?)
2. **Logo** ve marka kimliği
3. **Sol menü grupları** (modüller hangi grup başlıkları altında? Önerimiz: Operasyon / Mülk & Şahıs / Şirket / Resmi & Bankacılık / Sistem)
4. **Türkçe terim sözlüğü** (Ödeme/Tahsilat ayrımı yapılacak mı? "Kayıt" mı "Belge" mi?)
5. **Dashboard widget öncelik sırası** (yöneticiye sorulmalı)
6. **Mobil scope** — sadece görev+chat mi yoksa read-only tüm modüller mi?
7. **Chat widget davranışı** — her sayfada mı, sadece dashboard ve detay sayfalarında mı?
8. **Para birimi** sadece TRY mi, USD/EUR de gelecek mi?

---
