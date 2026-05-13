# FAZ 0B — MASTER ANAYASA FİNAL RAPORU
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 0B — Master Proje Anayasası
**Tarih:** 2026-05-05
**Durum:** TAMAMLANDI → Faz 0C'ye hazır (D-001, D-013, D-022 onayı sonrası)

---

## 1. OKUNAN FAZ 0A DOSYALARI

| Dosya | Konum |
|---|---|
| Final Rapor | `_docs/PHASE0A_FINAL_REPORT.md` |
| Veri Kaynağı Envanteri | `_analysis/reports/PHASE0A_DATA_SOURCE_INVENTORY.md` |
| Modül Haritası | `_analysis/reports/PHASE0A_MODULE_MAP.md` |
| Normalize Model Taslağı | `_analysis/model_drafts/PHASE0A_NORMALIZED_MODEL_DRAFT.md` |
| Design Ekran Listesi | `_analysis/design_brief/PHASE0A_DESIGN_SCREEN_LIST.md` |
| Hash/Size Raporu | `_analysis/import_inventory/SOURCE_FILES_HASH_REPORT.md` |

> Tüm 6 dosya read-only sentezlendi. Hiçbir dosyaya yazılmadı.

---

## 2. OLUŞTURULAN FAZ 0B DOSYALARI

| Dosya | Amaç |
|---|---|
| `_docs/PROJECT_ANAYASA.md` | **Ana doküman** — sonraki tüm fazların referansı (15 madde) |
| `_docs/PHASE0B_DECISION_REGISTER.md` | 25 açık karar listesi, kullanıcı onayı bekleyen |
| `_docs/PHASE0B_MVP_SCOPE.md` | MVP-1 (16 modül) / MVP-2 (6) / LATER (8) detayı + DoD |
| `_docs/PHASE0B_MODULE_ROADMAP.md` | Faz 0B → 14 yol haritası, her faz onay kapısı dahil |
| `_docs/PHASE0B_CLAUDE_DESIGN_INPUT.md` | Faz 0C'ye temel input (UI prensipleri + ekran listesi + dashboard/mobil/import/chat beklentileri) |
| `_analysis/reports/PHASE0B_MASTER_ANAYASA_REPORT.md` | **Bu dosya** — faz final raporu |

> Hedef dosyaların hiçbiri önceden mevcut değildi; backup gerekmedi.

---

## 3. ANA KARARLAR (ANAYASA'DA SABİTLENDİ)

| # | Karar | Anayasa Maddesi |
|---|---|---|
| K1 | Excel görüntüsü taklit edilmeyecek; long-format normalize | 3.1, 3.2, 3.16 |
| K2 | Onaysız kesin kayıt yok (ImportBatch → Draft → onay) | 3.3, 3.4, 7 |
| K3 | Her CRUD AuditLog'a yazılır | 3.5, 6.14 |
| K4 | Telegram 3-aşamalı (dry-run → test → gerçek) | 3.7, 8 |
| K5 | Fiziksel silme yasak (soft-delete + arşiv); Super Admin istisnası audit ile | 3.8, 6.16, 12.6 |
| K6 | Görev/chat/belge polimorfik bağlanır | 3.9 |
| K7 | Mobil baştan zorunlu | 3.10, 11.5-11.8 |
| K8 | Dark mode YOK | 3.13, 11.1 |
| K9 | Diğer Acme projelerinden tam izolasyon | 1.5, 3.14 |
| K10 | KVKK: TC/telefon log'da maskelenir | 3.19, 12.1 |
| K11 | Yedekleme: günlük DB + haftalık dosya | 3.20, 12.2 |
| K12 | Anayasa değişiklik prosedürü tanımlı | 15 |

---

## 4. MVP ÖNERİSİ

**MVP-1: 16 modül + çekirdek master.** Yetki, Audit, Master CRUD, Import, Fatura, Ödeme, Otomatik Ödemeler, Ev/Şahıs, Abonelik+Taahhüt, SiteX, Emlak, Teminat, Resmi, Kira, Ajanda+Görev, Bildirim (Telegram dry-run modunda), Dashboard.

**MVP-2:** PDF OCR, Elden/EFT/Kart Detay, ETA/Papinet/Entegratör, Raporlama, Telegram gerçek aktivasyonu, PWA.

**MVP-3:** Kurumsal Chat.

**LATER:** Banka API, SiteX portal otomatik indirme, kontör API, SSO, native mobile, çoklu para birimi, BI/trend.

> Detay: `_docs/PHASE0B_MVP_SCOPE.md`.

---

## 5. RİSKLER (Faz 0A'dan miras + Faz 0B yeni)

### Faz 0A'dan miras
- R1: Excel mapping yanlış kurulur → veri kalitesi
- R2: SiteX dosya adı convention değişimi → parser kırılması
- R3: Teminat heterojen sheet → atlanan mektup
- R4: Emlak OCR güvenilirliği düşük
- R5: "X" işareti yorumu yanlışsa otomatik talimat
- R6: Telegram yanlış grup
- R7: KVKK / TC ifşası
- R8: Eski veri için aktif görev üretimi
- R9: Fatura duplicate import
- R10: SiteX 277 dosya memory

### Faz 0B yeni
- R11: **Anayasa kararları onaylanmadan Faz 0C başlatılırsa** → tasarım yeniden çalışma riski
- R12: **Roller fazla katmanlı (6 rol)** → MVP-1 için karmaşık olabilir; basitleştirme önerilebilir
- R13: **Çoklu modül paralel geliştirme** → mimari tutarlılık riski (Faz 1'de adres edilmeli)
- R14: **Telegram bot token / encryption** → Faz 1'de secret management standardı
- R15: **Ajanda otomatik görev cron'u** duplicate üretimi → idempotency tasarımı kritik

---

## 6. KULLANICIDAN BEKLENEN KARARLAR

> Tam liste: `_docs/PHASE0B_DECISION_REGISTER.md` (25 madde)

### Faz 0C başlamadan önce (BLOKER)
- **D-001:** MVP modül listesi onayı
- **D-013:** İlk parti çizilecek 10 ekran onayı
- **D-022:** Şahıs/Şirket/Mülk master listesi onayı

### Faz 1 başlamadan önce (BLOKER)
- **D-015:** PostgreSQL onayı
- **D-016:** Auth mekanizması (Django + 2FA?)
- **D-017:** Hosting (ayrı VPS?)
- **D-018:** Eski yıllar (2020-2024) import edilecek mi?

### MVP-1 yayını öncesi (BLOKER)
- **D-008:** Ödeme onayı tek/iki kademe + tutar eşiği
- **D-011:** Dekont yükleme zorunluluğu eşiği
- **D-021:** Tutar eşik değerleri kesinleşmeli

### Yumuşak (faz içinde alınabilir)
- D-002 (ilk import sırası), D-003 (SiteX ödeme günü), D-004 (Telegram kanal), D-005 (görev atama), D-006 (chat MVP), D-007 (OCR seviye), D-009 (import onay), D-010 (rapor yetkisi), D-012 (silme), D-014 (domain), D-019 (dil/para), D-020 (mobil scope), D-023 (bildirim saatleri), D-024 (SiteX portal), D-025 (kontör API).

---

## 7. ÖZET — FAZ 0B BAŞARI KRİTERLERİ

✅ Faz 0A'dan 6 dosya okundu ve sentezlendi.
✅ `PROJECT_ANAYASA.md` oluşturuldu (15 madde, sonraki fazların referansı).
✅ Karar defteri (25 madde) oluşturuldu.
✅ MVP scope (3 katman + DoD) oluşturuldu.
✅ Modül roadmap (Faz 0B → 14, her fazda onay kapısı) oluşturuldu.
✅ Claude Design input dosyası oluşturuldu (Faz 0C'ye temel).
✅ Final rapor (bu dosya) oluşturuldu.

❌ Kod yazılmadı.
❌ Django/migration/DB/import yok.
❌ Telegram/mail gönderilmedi.
❌ Commit/push/deploy yok.
❌ Diğer Acme projelerine dokunulmadı.
❌ Kaynak Excel/RAR/PDF dosyalarına dokunulmadı.

---

## 8. ÖNERİLEN SONRAKİ FAZ

**Faz 0C — Claude Design UI/UX Sistemi.**

**Ön koşul:** D-001, D-013, D-022 kararlarının kullanıcı tarafından onaylanması.

**Faz 0C girdileri:**
- `_docs/PROJECT_ANAYASA.md` (Madde 11 UI/UX prensipleri)
- `_docs/PHASE0B_CLAUDE_DESIGN_INPUT.md` (temel design input)
- `_docs/PHASE0B_DECISION_REGISTER.md` (D-013 onayı sonrası ilk parti ekranlar)
- `_analysis/design_brief/PHASE0A_DESIGN_SCREEN_LIST.md` (104 ekran tam liste)

**Faz 0C beklenen çıktıları:**
- Renk paleti + tipografi + spacing tokens dokümantasyonu
- Component kütüphanesi (Button, Input, DataTable, Card, Badge, Modal, FilterBar, vb.)
- İlk parti 10 ekran tasarımı (yüksek-fidelity)
- Mobil 3 cihaz boyutu için responsive tasarım örnekleri
- Empty state, loading state, error state örnekleri
- Dashboard widget tasarımları
- Import preview ekranı detay tasarımı
- Görev detay drawer tasarımı

---

**SON.** Faz 0B tamamlandı. Kullanıcı onayı sonrası Faz 0C başlatılabilir.
