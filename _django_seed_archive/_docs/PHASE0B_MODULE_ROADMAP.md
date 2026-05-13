# FAZ 0B — MODÜL YOL HARİTASI (FAZLAR)
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

> Her fazın **amaç / girdi / çıktı / sınır / test gereksinimi / onay kapısı** açık tanımlanmıştır. Bir faz tamamlanıp **onay kapısı** geçilmeden bir sonrakine başlanmaz.

---

## FAZ 0A — VERİ KAYNAĞI ENVANTERİ ✅ TAMAMLANDI
- **Çıktı:** `_analysis/reports/PHASE0A_*.md`, `_docs/PHASE0A_FINAL_REPORT.md`.

## FAZ 0B — MASTER PROJE ANAYASASI 🟢 BU FAZ
- **Amaç:** Anayasa + karar defteri + MVP scope + roadmap + Claude Design input + final rapor.
- **Girdi:** Faz 0A çıktıları.
- **Çıktı:** `_docs/PROJECT_ANAYASA.md` ve 4 destek dosyası + final rapor.
- **Sınır:** Kod yok, Django yok.
- **Test:** Yok (doküman fazı).
- **Onay kapısı:** Kullanıcı **D-001, D-013, D-022** kararlarını onaylar.

---

## FAZ 0C — CLAUDE DESIGN UI/UX SİSTEMİ
- **Amaç:** 104 ekranın tasarım sistemine dökülmesi.
- **Girdi:** `PHASE0B_CLAUDE_DESIGN_INPUT.md` + ekran listesi + UI prensipleri.
- **Çıktı:** Design tokens, component kütüphanesi, ilk parti 10 ekran (D-013 onayına göre).
- **Sınır:** Kod yok; sadece tasarım.
- **Test:** Yok.
- **Onay kapısı:** Yönetici design'ı onaylar; renk/tipografi/grid kesinleşir.

---

## FAZ 0D — DESIGN ÇIKTI KONTROLÜ
- **Amaç:** Tasarımın anayasa ile tutarlılık denetimi.
- **Girdi:** Faz 0C çıktıları + `PROJECT_ANAYASA.md`.
- **Çıktı:** Uyumsuzluk raporu, düzeltme listesi.
- **Sınır:** Tasarım dokunabilir; kod yok.
- **Test:** Erişilebilirlik (WCAG AA), mobil 3 cihaz, dark mode olmadığının doğrulanması.
- **Onay kapısı:** "Tüm ekranlar anayasa ile uyumlu" onayı.

---

## FAZ 1 — TEKNİK MİMARİ PLAN
- **Amaç:** Stack seçimi, klasör yapısı, paket listesi, DB schema sketch'i.
- **Girdi:** Anayasa + MVP scope + Decision register (D-015..D-017).
- **Çıktı:** `_docs/TECH_ARCHITECTURE.md`, ER diyagram, Docker compose taslak, CI/CD plan.
- **Sınır:** Henüz kod yok.
- **Test:** Mimari review (peer + yönetici).
- **Onay kapısı:** Veritabanı, auth, hosting kararları kesinleşir.

---

## FAZ 2 — BASE SCAFFOLD
- **Amaç:** Django projesi başlatma, çekirdek master modeller, yetki, AuditLog, Belge.
- **Girdi:** Faz 1 mimari.
- **Çıktı:**
  - Django projesi (boş app shell)
  - Çekirdek master tabloları (Sahis, Sirket, Mulk, Banka, Kurum)
  - User + Rol + Yetki
  - AuditLog middleware
  - Belge model + dosya saklama
  - Soft-delete mixin
  - İlk migration
  - Tasarım sisteminin kod implementasyonu (component'lar)
- **Sınır:** Operasyon modülleri yok. Import yok.
- **Test:** Unit testler (CRUD + soft-delete + audit).
- **Onay kapısı:** Login + master CRUD + AuditLog kayıt yazıyor.

---

## FAZ 3 — IMPORT MERKEZİ
- **Amaç:** ImportBatch/Draft/Log + Excel/PDF/RAR pipeline'ları + ön izleme/onay UI.
- **Girdi:** Çekirdek master + Belge.
- **Çıktı:**
  - 5 model (`ImportBatch`, `ImportDraft`, `ImportLog`, `ImportMapping`, `ImportHata`)
  - Excel pipeline (openpyxl)
  - PDF metadata pipeline
  - RAR/klasör pipeline
  - Mapping editor UI
  - Ön izleme/onay/rollback UI
- **Sınır:** Hedef modüller henüz yok — test "kuru" hedef olarak Sahis/Sirket master seed import'u ile yapılır.
- **Test:** End-to-end (örnek Excel → preview → commit → rollback).
- **Onay kapısı:** Şirket/Sahis master 1 Excel'den başarılı import edildi.

---

## FAZ 4 — FATURA / ÖDEME MVP
- **Amaç:** Fatura + Odeme + OdemeBelgesi + mutabakat.
- **Girdi:** Çekirdek + Import.
- **Çıktı:** Fatura/Ödeme model, ekranlar, ödeme yöntemi enum, mutabakat ekranı, eksik dekont uyarı.
- **Sınır:** Abonelik henüz yok (faturalar manuel kuruma bağlı).
- **Test:** Fatura→Ödeme bağlama, mutabakat, soft-delete, audit.
- **Onay kapısı:** ÖDEMELER OTOMATİKLER VE ELDEN Excel'i import edildi, faturalar görünür.

---

## FAZ 5 — ABONELİK / TAAHHÜT
- **Amaç:** Abonelik + Taahhüt + Otomatik Ödemeler + Ev/Şahıs.
- **Girdi:** Faz 4.
- **Çıktı:** Abonelik master, taahhüt takvimi, otomatik talimat, kişi bazlı görünüm.
- **Test:** Taahhüt bitiş bildirimi tetikleniyor mu (dry-run).
- **Onay kapısı:** ŞİRKET ABONELİKLERİ + EV ABONELİKLERİ import edildi.

---

## FAZ 6 — SITEX
- **Amaç:** 5 daire master + ekstre + aidat farkı + yıllık belge.
- **Girdi:** Mülk + Belge + Import.
- **Çıktı:** SiteX 4-5 model, daire detay UI, RAR import (klasör+dosyaadı parse).
- **Test:** SITEX.rar test örneği başarıyla import.
- **Onay kapısı:** 5 daire için 2026-01..2026-04 ekstreleri görünür.

---

## FAZ 7 — EMLAK VERGİSİ
- **Amaç:** EmlakVergisi + Mülk emlak alanları + EMLAK rar import.
- **Çıktı:** Mülk × yıl × dönem grid, belediye filtre, belge yükleme.
- **Test:** EMLAK 2024.rar + 2025.rar import.
- **Onay kapısı:** Mülk listesi tamamlandı, 2024-2025 emlak kayıtları görünür.

---

## FAZ 8 — TEMİNAT MEKTUPLARI
- **Amaç:** TeminatMektubu + Komisyon + İade + heterojen sheet parser.
- **Çıktı:** 3 model, liste, detay, komisyon takvimi.
- **Test:** TEMİNAT MEKTUPLARI Excel 4 sheet'ten ayrı parse.
- **Onay kapısı:** Aktif/iade mektup ayrımı doğru, komisyon takvimi çalışıyor.

---

## FAZ 9 — ETA / PAPİNET / ENTEGRATÖR / KONTÖR
- **Amaç:** 5 model + sözleşme + kontör + PAPİNET.rar arşiv.
- **Çıktı:** Entegratör listesi, sözleşme takvimi, kontör bakiye.
- **Test:** PAPİNET.rar import + EDM XLSX kontör kampanya.
- **Onay kapısı:** Sözleşme bitiş takvimi + kontör eşik altı uyarısı çalışıyor.

> **NOT:** Faz 9 MVP-2'de. MVP-1 yayınlanmadan önce Faz 4-8 + 10-13 + 17 tamamlanmalıdır.

---

## FAZ 10 — AJANDA / GÖREV
- **Amaç:** 5 görev modeli + 9 ekran + GorevSablonu cron.
- **Çıktı:** Görev CRUD, kanban, takvimler, otomatik üretim cron, polimorfik bağ.
- **Test:** Otomatik görev cron tetikleniyor; duplicate üretmiyor.
- **Onay kapısı:** Tüm modüllerden görev üretimi çalışıyor (SiteX, Emlak, Teminat, Resmi, vb.).

---

## FAZ 11 — CHAT (MVP-3 — LATER, sırayla 12'den sonra)
- **Amaç:** ChatThread/Message/Participant + WebSocket + widget.
- **Çıktı:** 5 model, sağ alt widget, mesaj merkezi, kayıt-bağlantılı thread.
- **Test:** Real-time mesaj, okundu, mention.
- **Onay kapısı:** SiteX ekstresi üzerinden thread açılıyor + mention bildirimi geliyor.

> **NOT:** Bu faz **MVP-3**'tedir. MVP-1 canlısı sonra başlatılır.

---

## FAZ 12 — BİLDİRİM / TELEGRAM
- **Amaç:** NotificationLog + 3 aşamalı Telegram (dry-run → test → gerçek) + cron'lar.
- **Çıktı:** Bildirim merkezi tam, Telegram bot konfig, tüm tetikleyiciler aktif.
- **Test:** Dry-run mesajları üretiliyor, test grubuna gidiyor, gerçek **kapalı** kontrol.
- **Onay kapısı:** Yönetici "gerçek Telegram aç" düğmesini bilinçli olarak basar.

---

## FAZ 13 — RAPORLAMA / EXPORT
- **Amaç:** RaporSablonu + Excel/PDF export + zamanlanmış rapor.
- **Çıktı:** 10+ rapor şablonu (aylık ödeme özeti, taahhüt bitişi, eksik dekont, vb.).
- **Test:** Export doğruluğu (sample karşılaştırma).
- **Onay kapısı:** Yönetici aylık raporu Excel'de alabiliyor.

---

## FAZ 14 — PROD DEPLOY / STABİLİZASYON
- **Amaç:** Üretim sunucu kurulum, SSL, yedekleme, monitoring, eğitim.
- **Çıktı:** Live URL, kullanım kılavuzu, eğitim videosu, hot-fix süreci, on-call planı.
- **Test:** Yük testi (örn. 1000 fatura, 100 eşzamanlı kullanıcı varsayımı), DR drill (yedek restore).
- **Onay kapısı:** **MVP-1 PRODUCTION GO-LIVE.**

---

## ÖZET FAZ TAKVİMİ (T-Shirt Tahmini)

| Faz | Tahmini Süre |
|---|---|
| 0B (bu faz) | 1 gün |
| 0C (Claude Design) | 1-2 hafta |
| 0D | 2-3 gün |
| 1 (mimari) | 3-5 gün |
| 2 (scaffold) | 1-2 hafta |
| 3 (import) | 2-3 hafta |
| 4 (fatura/ödeme) | 1-2 hafta |
| 5 (abonelik) | 1 hafta |
| 6 (SiteX) | 1-2 hafta |
| 7 (emlak) | 1 hafta |
| 8 (teminat) | 1 hafta |
| 10 (ajanda/görev) | 2 hafta |
| 12 (bildirim/telegram) | 1-2 hafta |
| 13 (rapor) | 1 hafta |
| 14 (deploy) | 1 hafta |
| **MVP-1 toplamı** | **~3-4 ay** |
| 9 (entegratör) — MVP-2 | 1-2 hafta |
| 11 (chat) — MVP-3 | 2-3 hafta |

> Tahminler bağlayıcı değil, sıra ve onay kapıları bağlayıcıdır.
