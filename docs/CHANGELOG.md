# CHANGELOG

> Önemli değişiklikler ve audit sweep'leri. Tarih sırasında en yeniden eskiye.

---

## 2026-05-16 — Sistem-geneli derin audit (5 paralel ajan)

### Eklenenler
- **Otomatik destek talebi sistemi** (`support_tickets` tablosu + `/destek` sayfası + `/v1/support/tickets`)
  - Frontend `ErrorBoundary` crash'inde otomatik ticket POST
  - Backend `errorHandler` 500 hatasında otomatik ticket
  - Manuel ticket modal (bug/feature_request/question)
  - Admin için "Çözüldü" kısa-yolu + internal_notes
  - 1 saat içinde aynı title → dedup (occurrences++)
- **Bulk approve/reject** Review Queue'da (max 500 kayıt per batch, ConfirmDialog korumalı)
- **Aggregate tenant_name badge'i** 6 liste sayfasında (`Employees`, `FixedAssets`, `Stock`, `Tasks`, `Checks`, `SalesInvoices`)
- **Türkçe header desteği** Smart Import CSV/XLSX'te (`TR_HEADER_ALIASES`)
- **Smart Import preview→commit cache** (`lib/preview-cache.ts`, SHA256 hash, 5dk TTL, LRU)
- **Inbound webhook idempotency** (`X-Idempotency-Key` header + DB-level unique index, header yoksa HMAC imzası fallback)
- **WhatsApp Meta signature verification** (`x-hub-signature-256` + raw body capture)
- **Status transition state machine** (sales_invoices, fixed_assets, payroll_runs)
- **Onay Bekleyenler default scope=org** (kullanıcı tüm org'daki bekleyenleri tek ekranda görür)

### Düzeltildi (kritik)
- **Lost update race condition** — `payments.ts` POST → `SELECT FOR UPDATE` lock (paralel 10 ödeme = 0 kayıp)
- **Payroll approve/mark-paid** race → SELECT FOR UPDATE + status guard
- **Payment-approvals approve** race → SELECT FOR UPDATE + tek transaction
- **Review Queue merge** → tek transaction (count + delete race fix)
- **Run-depreciation cron** → duplicate check tx içinde (paralel job yarış)
- **Generate-periods cron** (regular + official) → profil başına transaction
- **ERP sync** → `pg_try_advisory_lock` ile concurrent sync engelleme
- **Customer return müşteri borcu** → saleDebt/shippedDebt/pendingShipDebt artık düşürülür
- **Stocktake race** → status check transaction içinde

### Audit log eklendi (27 endpoint)
- `sales_invoices` (POST/PATCH/DELETE)
- `fixed_assets` (POST/PATCH/DELETE/dispose)
- `employees` (POST/PATCH/DELETE)
- `budgets` (POST/PATCH/DELETE)
- `payment_approvals` cancel
- `payroll` approve/mark_paid
- `master_data` × 5 (banks, companies, institutions, persons, properties) × 3 mutation
- Review queue bulk-approve/reject

### Cache invalidation kapsamı genişletildi
- Smart Import commit → 7 cache key (review-queue + summary + payables + companies + cari-list + inbox)
- Review Queue approve/reject → 8 cache key
- PayableDetail addPayment → inbox + cari-list ek
- Payroll mutations → payroll-summary

### Frontend dayanıklılık (14 sayfa)
`onError` handler eklendi: `master-data/*`, `FixedAssets`, `Employees`, `Subsidiaries`, `Payroll`, `Budgets`, `Checks`, `Stock`, `TenantsManagement`, `CollectionReminders`. API error mesajı parse edilip kullanıcıya gösterilir.

### AI hardening
- `ai-assistant.ts callClaude` → 45s AbortController timeout
- `ai-explain.ts` → 30s timeout + rule-based fallback
- `ai-summary.ts /today` → 5/saat rate limit
- `semantic-search.ts` → 30/dakika rate limit (Voyage maliyet)

### File security
- ZIP/RAR uncompressed limit: 10MB/file + 100MB/total (pre-flight)
- Smart Import `cache_key` zod regex validation (SHA256 hex)
- Attachments `req.body` zod schema (uuid + max-len)

### Permissions / audit
- 4 GET endpoint try/catch + next(err) (ai-status, integrations-status, users/me/permissions, whatsapp/status)
- `customer-portal` `/portal/:token` → IP başına 20/dakika rate limit (token brute-force)

### Kaldırılanlar
- `_django_seed_archive/` (4 MB legacy)
- `apps/web/src/lib/supabase.ts` (orphan)
- `apps/api/src/routes/import.ts` (eski bulk endpoint — Smart Import zaten yapıyor)
- Web app'ten "Bulk" ve "e-Fatura" tab'leri (Smart Import tek-tab oldu)

### Performance
- N+1 fix: `budgets` GET + comparison (10 query → 1 GROUP BY)
- Payroll item batch insert (N round-trip → 1)
- 25 GET endpoint aggregate'e uyumlu (`tenantScope` helper)
- 20 frontend sayfa aggregate query enable

---

## 2026-05-16 (earlier) — Aggregate mode foundation

- `requireTenantOrAggregate` middleware
- `tenantScope(req, column)` helper
- 25 GET endpoint conversion
- 20 frontend sayfa conversion (`enabled: !!tenantSlug || aggregate`)
- `localStorage['sayman-active']` aggregate flag
- Axios interceptor `X-Sayman-Aggregate: 1` header
- TenantSwitcher "Tüm Şirketler" seçeneği

---

## 2026-05-16 (earliest) — Smart Import sistem refactor

- 3-tab → 1-tab (Bulk + e-Fatura tab'leri kaldırıldı)
- Türkçe header alias map
- ZIP > 100 truncation uyarısı
- Auto-supplier resolve flow
- Tenant routing by recipient VKN
- Preview cache + cache_key
- Smart Import sonuç ekranında tenant_routing.mismatch uyarısı

---

## Geçmiş

Önceki tarihlere bakmak için: `git log --oneline --since=2026-05-01`
