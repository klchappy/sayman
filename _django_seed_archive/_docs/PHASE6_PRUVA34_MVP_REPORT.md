# FAZ 6 — SITEX DAIRE / AIDAT MANUAL MVP RAPORU
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Sürüm:** 0.6.0-faz6-pruva
**Tarih:** 2026-05-07
**Durum:** ✅ TAMAMLANDI · 136/136 test PASS

---

## 1. KAPSAM

Faz 6, SiteX sitesindeki bağımsız bölümler için aylık aidat ekstresi
takibi, aidat farkı kayıtları ve site geneli belgelerin yönetimi
yeteneğini ekler. Manual-first MVP — hiçbir kayıt cron veya import
yoluyla otomatik commit edilmez.

Bu fazda iki lifecycle yaması (W-1, W-2) da uygulanmıştır.

---

## 2. UYGULANAN ÖZELLİKLER

### 2.1 W-1 Patch · `cancel_payable`
**Dosya:** `apps/finance/services/payments.py`

- `PayableItem.status = CANCELLED` — soft state, `is_active` korunur (tarihçe).
- `notes` alanına iptal sebebi eklenir.
- `PENDING_APPROVAL` ödeme transaction'ı varsa iptal **bloklanır**
  (önce reject/approve edilmeli).
- `PAID` durumdaki kayıt iptal edilemez (önce arşivle).
- Tekrar çağrıda idempotent.
- `add_partial_payment` / `mark_paid` `CANCELLED|ARCHIVED` durumda block.
- AuditLog `UPDATE` · `metadata.event=CANCEL_PAYABLE`.

### 2.2 W-2 Patch · `seed_settings` komutu
**Dosya:** `apps/core/management/commands/seed_settings.py`

Idempotent SystemSetting varsayılanları:

| Anahtar | Değer | Tip |
|---|---|---|
| `PAYMENT_DEKONT_REQUIRED_THRESHOLD` | `5000` | DECIMAL |
| `PAYMENT_DOUBLE_APPROVAL_THRESHOLD` | `50000` | DECIMAL |
| `DEFAULT_CURRENCY` | `TRY` | STRING |

- Mevcut setting **overwrite EDİLMEZ**.
- AuditLog `SEED`.

### 2.3 `apps.pruva` — yeni Django app

**5 model:**

| Model | Açıklama |
|---|---|
| `PruvaUnit` | Bağımsız bölüm (kod unique, sınırsız genişleme) |
| `PruvaStatement` | Aylık ekstre (`unique(unit, year, month)`) |
| `PruvaStatementDocument` | Statement ↔ Document ara tablosu |
| `PruvaAidatDifference` | Aidat farkı / şahıs–şirket mahsuplaşma |
| `PruvaSiteDocument` | Site geneli belge (bütçe, denetim vb.) |

**8 enum:** `UnitOwnerType`, `UnitUsageType`, `UnitStatus`, `StatementStatus`,
`StatementSource`, `StatementDocumentRole`, `AidatDifferenceDirection`,
`AidatDifferenceStatus`, `SiteDocumentType`.

**Servis fonksiyonları** (`apps/pruva/services/pruva.py`):
`create_unit`, `update_unit`, `archive_unit`, `restore_unit`, `mark_unit_sold`,
`default_due_date`, `calculate_statement_total`, `create_statement`,
`update_statement`, `cancel_statement`, `attach_statement_document`,
`create_payable_from_statement`, `mark_statement_paid_from_payable`,
`create_aidat_difference`, `cancel_aidat_difference`, `attach_site_document`.

**URL'ler** (17 endpoint, namespace `pruva`):
- `/pruva/` dashboard
- `/pruva/units/new/`, `/pruva/units/<pk>/[edit|archive|mark-sold]/`
- `/pruva/units/<pk>/statements/new/`
- `/pruva/statements/<pk>/[edit|cancel|create-payable|documents/upload]/`
- `/pruva/differences/[new|<pk>/cancel/]`
- `/pruva/site-documents/[new]/`

**Templates** (`backend/templates/pruva/`, 9 dosya):
`dashboard.html`, `unit_form.html`, `unit_detail.html`, `statement_form.html`,
`statement_detail.html`, `statement_document_upload.html`,
`aidat_difference_list.html`, `aidat_difference_form.html`,
`site_document_list.html`, `site_document_form.html`.

**Management komutu:** `seed_pruva_units` — 5 başlangıç dairesini
(A4.17, A4.22, A4.25, B2.28, B3.31) idempotent oluşturur. Hiçbir iş
kuralı bu kodlara hardcode bağlanmamıştır.

### 2.4 Dashboard widget + sidebar
- Sidebar: SiteX menü item aktif edildi (önceden "Faz 6'da aktif" placeholder).
- Dashboard ana sayfa: 4 sayılı SiteX özeti kartı eklendi
  (Aktif Daire / Satıldı / Açık Ekstre / Açık Aidat Farkı).

### 2.5 Period → PayableItem entegrasyonu
- `PruvaStatement` → `apps.finance.services.period_link.create_payable_from_period`
  ile bağlanır.
- 5K/50K eşikleri (W-2 SystemSetting) otomatik uygulanır.
- Idempotent: aynı statement için ikinci çağrı mevcut payable'ı döner.

---

## 3. SINIRSIZ GENİŞLEME GÜVENCESİ

Sistem 5 daireyle SINIRLI DEĞİLDİR:

- `seed_pruva_units` SADECE master kayıt yaratır; servis/iş kurallarında
  daire kodu yoktur.
- UI'dan yeni daire eklenebilir (`/pruva/units/new/`).
- `default_due_day` her daire bazında override edilebilir.
- `mark_unit_sold` tarihçeyi korur (eski ekstreler ve farklar pasif olmaz).
- `archive_unit` / `restore_unit` soft-delete (Anayasa 3.8).
- Test `test_sixth_unit_can_be_added` 6. daire eklemeyi doğrular.

---

## 4. ANAYASA UYUMU

| Madde | Kontrol | Sonuç |
|---|---|---|
| 1.5 | İzolasyon | ✅ apps.pruva yalnızca core/audit/parties/documents/finance bağımlı |
| 3.4 | Onaysız domain commit yok | ✅ Tüm CRUD `user` parametresi alır; import'tan üretim yok |
| 3.5 | AuditLog her aksiyon | ✅ create/update/archive/restore/cancel/seed/mark_sold |
| 3.8 | Soft-delete | ✅ `BaseModel` mirası; archive/restore servis metodları |
| 3.16 | yyyymm long-format | ✅ `period_label = 'YYYY-MM'` |
| 3.18 | Belge dedup | ✅ Document.get_or_create_from_file SHA-256 |
| 8 | Bildirim 4 aşamalı kapı | (Faz 12'de aktif olacak) |
| 11 | UI sözleşmesi | ✅ IBM Plex + lacivert + dark mode yok |

---

## 5. TEST SONUÇLARI

| Suite | Faz 5 | Faz 6 |
|---|---|---|
| test_smoke.py | 22 | 22 |
| test_documents.py | 6 | 6 |
| test_imports.py | 13 | 13 |
| test_finance.py | 24 | 24 |
| test_phase5.py | 29 | 29 |
| **test_phase6.py** | — | **42** |
| **TOPLAM** | **94** | **136 ✅** |

Tüm testler PASS, `manage.py check` 0 issue.

---

## 6. SAYISAL ÖZET

| Metrik | Faz 5 | Faz 6 |
|---|---|---|
| Django app | 14 | **15** (+1 pruva) |
| Domain modeller | 26 | **31** (+5) |
| Migrations | 12 | **13** (+1) |
| Templates | 38 | **48** (+10) |
| Tests | 94 | **136** (+42) |
| URL endpoints | 60 | **77** (+17) |
| Yeni servis | 9 | **10** (+1: pruva) |
| Yeni management komutu | seed_roles | **+ seed_settings, seed_pruva_units** |

---

## 7. SINIRLAR

| Yasaklı | Yapıldı mı? |
|---|---|
| Telegram | ❌ |
| Cron / GorevSablonu | ❌ |
| Import commit → domain kayıt | ❌ (NO-OP testi geçer) |
| Hardcoded daire bazlı iş kuralı | ❌ (servis kodu kontrol) |
| Source Excel/RAR/PDF değişimi | ❌ |
| Design canvas modifikasyonu | ❌ |
| Diğer Acme projeleri etkisi | ❌ |
| Commit/push/deploy | ❌ |

---

## 8. SONUÇ

✅ **Faz 6 manual-first MVP başarıyla tamamlandı.**
- 1 yeni app + 5 model + 1 migration
- 17 URL + 10 template
- 42 yeni test (toplam 136)
- W-1 + W-2 lifecycle yamaları aktif
- 0 BLOCKER

**Faz 7 (Emlak vergisi) başlatılabilir.**
