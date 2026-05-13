# FAZ 3 — IMPORT MERKEZİ TEMELİ RAPORU
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 3 — Documents + Imports temel altyapısı
**Tarih:** 2026-05-05
**Durum:** TAMAMLANDI · 41/41 test PASS · Faz 4 için hazır

---

## 1. OLUŞTURULAN APP'LER (2)

| App | Sorumluluk |
|---|---|
| `apps.documents` | sha256 dedup'lı belge/dosya yönetimi, private storage, yetki kontrollü download |
| `apps.imports` | ImportBatch / SourceFile / DraftRecord / DraftField / Log / MappingProfile + Excel parser + workflow servisleri |

---

## 2. MODEL LİSTESİ (7 yeni model)

### apps.documents
| Model | Alanlar (özet) | Faz 3 |
|---|---|---|
| `Document` | title, original_filename, file (private), file_size, **sha256 unique**, mime_type, extension, document_type (8 enum), source (3 enum), related_*, uploaded_by, is_private, metadata JSON, BaseModel | ✅ |

### apps.imports
| Model | Alanlar (özet) |
|---|---|
| `ImportBatch` | **batch_id UUID**, title, source_type/target_module enum, **status** (DRAFT/PARSED/NEEDS_REVIEW/APPROVED/COMMITTED/FAILED/CANCELLED), parsed_at, approved_at, committed_at, **rollback_until**, count'lar (row/ok/warning/error/manual), historical_data, metadata |
| `ImportSourceFile` | batch FK, document FK, sheet_name, file_role, row_count, status |
| `ImportDraftRecord` | batch + source_file FK, source_row_number, **record_key**, target_model, **suggested_action** (CREATE/UPDATE/SKIP/MANUAL_REVIEW), **validation_status** (OK/WARNING/ERROR/MANUAL_REVIEW), **status** (DRAFT/APPROVED/REJECTED/COMMITTED), display_title, **raw_data + normalized_data JSONB**, validation_messages JSON, created_object_* placeholder |
| `ImportDraftField` | granular alan log (Faz 3 opsiyonel) |
| `ImportLog` | batch FK, level, code, message, context JSONB |
| `ImportMappingProfile` | name unique, source_type, target_module, mapping JSON |

---

## 3. MIGRATION LİSTESİ

```
documents     [X] 0001_initial    (Document)
imports       [X] 0001_initial    (6 model + 2 index)
```

Toplam Faz 3 yeni migration: **2** (uygulanmış).

---

## 4. URL LİSTESİ

```
# Documents
/documents/                                       → liste
/documents/<int:pk>/                              → detay
/documents/<int:pk>/download/                     → yetki kontrollü download

# Imports
/imports/                                         → batch listesi
/imports/new/                                     → yeni import (form)
/imports/<uuid:batch_id>/                         → batch detay
/imports/<uuid:batch_id>/preview/                 → 3 panel preview + filter chips
/imports/<uuid:batch_id>/cancel/                  → POST iptal
/imports/<uuid:batch_id>/records/<int:pk>/        → draft detay (raw + validation)
/imports/<uuid:batch_id>/records/<int:pk>/approve/  → POST
/imports/<uuid:batch_id>/records/<int:pk>/reject/   → POST
/imports/<uuid:batch_id>/records/<int:pk>/manual/   → POST
```

---

## 5. TEMPLATE LİSTESİ (7 yeni)

```
templates/imports/
  ├── list.html        (KPI rozet + 9 kolon batch tablo + empty state)
  ├── new.html         (4 alan form + Anayasa Madde 7 uyarı)
  ├── detail.html      (4 KPI + 2 panel + 20-log + iptal butonu)
  ├── preview.html     (özet + filter chips + sol/sağ split + renk kodlu satırlar + 3 aksiyon buton/satır)
  └── record_detail.html  (raw_data + normalized_data + validation messages + 3 CTA)

templates/documents/
  ├── list.html        (8 kolon belge tablo + indir butonu)
  └── detail.html      (sha256 + meta tablo + indir)
```

---

## 6. SERVİS LİSTESİ

### `apps/imports/services/excel_parser.py`
- `list_sheets(file_obj)` — sheet adı listesi
- `iter_sheet_rows(...)` — satır iterator (limit'li)
- `is_empty_row(...)` — boş satır kontrolü
- `detect_header(rows)` — heuristic: ilk en az 2 dolu hücreli satır
- `parse_workbook_to_drafts(...)` — **ana parser**: Workbook → ImportSourceFile + ImportDraftRecord'lar (header satırı atlanır, boş satır SKIP, dolu satır MANUAL_REVIEW default)

### `apps/imports/services/import_service.py`
- `create_import_batch(...)` — Batch + Log + AuditLog
- `attach_source_file(...)` — Document'i batch'e bağla
- `parse_excel_to_drafts(...)` — atomic: Document.file → drafts + recalculate
- `recalculate_batch_counts(batch)` — ok/warning/error/manual sayaçları + status
- `approve_draft_record(draft, user)` — draft.status=APPROVED + audit
- `reject_draft_record(draft, user, reason)` — draft.status=REJECTED + reject_reason metadata
- `mark_manual_review(draft, user, message)` — validation_status=MANUAL_REVIEW + mesaj append
- `cancel_batch(batch, user, reason)` — batch.status=CANCELLED
- `commit_batch(batch, user, only_ok=False)` — **Faz 3: SAFE NO-OP** (Faz 4'te aktive edilecek)
- `rollback_batch(batch, user)` — placeholder (Faz 4'te 24 saat penceresi)

---

## 7. IMPORT FLOW ÖZETİ

```
[1] /imports/new/  →  ImportUploadForm
                       ↓
                       Document.get_or_create_from_file(sha256 dedup)
                       ↓
                       create_import_batch(user, source_type, target_module, ...)
                       ↓
                       attach_source_file(batch, document)
                       ↓
                       parse_excel_to_drafts (Excel ise)
                          ├─ openpyxl ile sheet'leri oku
                          ├─ Header tahmin et
                          ├─ Boş satır SKIP
                          ├─ Header satırı atla
                          └─ Her dolu satır → ImportDraftRecord(MANUAL_REVIEW)
                       ↓
                       recalculate_batch_counts → status NEEDS_REVIEW
                       ↓
                       ImportLog: BATCH_CREATED, FILE_ATTACHED, SHEET_PARSED, PARSED
                       ↓
                       AuditLog: CREATE (Document), CREATE (Batch), UPDATE (Batch parse)
                       ↓
                       Redirect → /imports/<batch_id>/

[2] /imports/<batch_id>/preview/
                       Filter chips: Tümü / OK / Uyarı / Hata / Manuel
                       Renk kodlu satır listesi
                       Approve / Reject / Manual buttons → POST → recalculate
                       ↓
                       audit_log her aksiyonda

[3] commit_batch (Faz 3 NO-OP)
                       ImportLog: COMMIT_BLOCKED
                       Domain kayıt YARATILMAZ
                       Faz 4'te MODULE_COMMITTERS dispatch eklenecek
```

---

## 8. ÖZEL YETENEKLER

| Özellik | Durum |
|---|---|
| **sha256 dedup** | ✅ `Document.get_or_create_from_file()` aynı içerikli dosyayı tek kayıt yapar |
| **Private storage** | ✅ `MEDIA_ROOT/private/documents/<sha256_first2>/<sha256>.<ext>` (Faz 14 nginx X-Accel) |
| **Yetki kontrollü download** | ✅ LoginRequiredMixin + audit yazımı |
| **JSONB raw + normalized_data** | ✅ PostgreSQL JSONB (SQLite'da JSON; Faz 14'te PG zorunlu) |
| **UUID batch_id** | ✅ URL'lerde UUID kullanılıyor |
| **historical_data flag** (D-018) | ✅ form alanı + model alanı |
| **24 saat rollback penceresi** | ✅ `rollback_until` alanı (Faz 4'te aktif) |
| **AuditLog her aksiyonda** | ✅ CREATE/UPDATE/ARCHIVE eylemleri |
| **Onaysız domain commit yok** | ✅ `commit_batch` no-op |

---

## 9. AUDIT LOG ENTEGRASYONU

| Aksiyon | AuditLog |
|---|---|
| Document upload | `CREATE` action, model_name=document |
| ImportBatch create | `CREATE` action, model_name=importbatch |
| Excel parse | `UPDATE` action, metadata={sheet_count, total_rows, draft_count, skipped_empty} |
| Draft approve | `UPDATE` action, summary "Draft onaylandı: #N" |
| Draft reject | `UPDATE` action, metadata={reject_reason} |
| Draft manual review | `UPDATE` action |
| Batch cancel | `ARCHIVE` action, metadata={reason} |
| Document download | `VIEW` action |
| commit_batch (no-op) | `VIEW` action, metadata={phase:3, domain_commit:False} |

---

## 10. TEST SONUÇLARI

```
$ python manage.py test tests
.........................................
----------------------------------------------------------------------
Ran 41 tests in 16.54s
OK
```

| Dosya | Test Sayısı | Sonuç |
|---|---|---|
| `tests/test_smoke.py` (Faz 2) | 22 | ✅ |
| `tests/test_documents.py` (Faz 3) | 6 | ✅ |
| `tests/test_imports.py` (Faz 3) | 13 | ✅ |
| **Toplam** | **41** | **✅ 41/41 PASS** |

### Faz 3 test başlıkları
- `DocumentSha256Test`: compute_sha256, dedup, farklı içerik farklı doc
- `DocumentDownloadTest`: anon redirect, auth download, list login required
- `CreateImportBatchTest`: batch + log + audit yazımı
- `ExcelParserTest`: 3-satır xlsx fixture → 3 draft (header atlandı, boş skipped) + counts recalc
- `DraftActionsTest`: approve / reject / manual review / cancel
- `CommitNoOpTest`: domain kayıt **yaratılmadığı** doğrulaması
- `RecalculateCountsTest`: status değişiminde sayaç güncellemesi
- `ImportViewSmokeTest`: list/new GET+POST, preview render

---

## 11. SINIRLAR (Faz 3 sözleşmesi)

| Yasak | Durum |
|---|---|
| Gerçek domain kaydı (Fatura/Ödeme/SiteX/...) | ❌ — `commit_batch` no-op |
| Telegram gerçek gönderim | ❌ |
| OCR / PDF tam parse | ❌ — Faz 3 yalnız Excel |
| RAR extract pipeline | ❌ — Faz 3'te placeholder, parse edilmez |
| Mapping editor UI | ❌ — model var, UI Faz 4 |
| Kaynak Excel/RAR/PDF değişikliği | ❌ — kaynaklara dokunulmadı |
| Diğer Acme projelerine müdahale | ❌ |
| Commit/push/deploy | ❌ |

---

## 12. AÇIK KALANLAR (Faz 4+)

| Madde | Faz |
|---|---|
| Modül-spesifik validator (Fatura/Ödeme/SiteX/Emlak/Teminat/Resmi) | Faz 4-9 |
| `MODULE_COMMITTERS` dispatch — gerçek domain commit | Faz 4 |
| Rollback 24 saat penceresi (gerçek silme) | Faz 4 |
| Mapping editor UI (drag-drop) | Faz 4 |
| Kayıtlı mapping profile (kullanıcı seçimi) | Faz 4 |
| RAR extract → klasör/dosya parse pipeline | Faz 6 (SiteX) |
| PDF metadata + OCR (Faz 7 emlak / MVP-2) | Faz 7+/MVP-2 |
| Idempotency `(abonelik, donem_yyyymm)` natural key | Faz 4 |
| Heterojen sheet parser (Teminat — şirket bazlı) | Faz 8 |
| Import Excel export (preview tablosu) | Faz 13 |
| Bulk approval ("Tümünü Onayla / Sadece Yeşilleri") sticky bar | Faz 4 (UI) |

---

## 13. FAZ 4'E GEÇİŞ KRİTERLERİ

✅ `manage.py check` PASS
✅ Migrations uygulandı (documents 0001, imports 0001)
✅ Document sha256 dedup test'i PASS
✅ Excel parser fixture test'i PASS
✅ ImportBatch / Draft / Log akışı PASS
✅ Approve / Reject / Manual / Cancel aksiyonları PASS
✅ commit_batch domain commit yapmıyor (NO-OP test PASS)
✅ Audit yazıyor
✅ 41/41 test PASS
✅ Diğer projelere dokunulmadı, kaynaklar değişmedi, commit/push/deploy yok

**Faz 4 (Fatura / Ödeme MVP) başlatılabilir.**

### Faz 4 ilk adımları (öneri)
1. `apps.finance` (Fatura, Odeme, OdemeBelgesi, FaturaKalemi).
2. `apps.official_payments` (ResmiOdeme — BAĞKUR/SSK/İTO/BES enum).
3. Modül validator: `imports/validators/invoice_validator.py` — `INVOICE` target_module için raw_data → normalized_data.
4. Modül committer: `imports/committers/invoice_committer.py` — onaylı draft → Fatura/Odeme yarat.
5. `commit_batch` dispatch ekle.
6. Rollback gerçek implementation (24 saat penceresi + soft-delete).
7. Frame 04 mapping editor + bulk action bar UI.

---

## 14. ROLLBACK NOTU

Faz 3'ü geri almak için:

```bash
# Migration'ı geri al
python manage.py migrate documents zero
python manage.py migrate imports zero
# Migration dosyaları + kod
rm -rf apps/documents apps/imports
rm -rf templates/documents templates/imports
# settings'ten apps.documents + apps.imports'u çıkar
# config/urls.py'den documents + imports include'unu çıkar
# tests/test_documents.py + test_imports.py sil
```

`apps.parties` / `apps.audit` / Faz 2 yapısı korunur.

---

**SON.** Faz 3 Import Merkezi temeli tamam. Faz 4 (Fatura/Ödeme MVP) için hazır.
