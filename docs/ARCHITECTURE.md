# Sayman — Mimari

> Çoklu kiracılı muhasebe operasyon platformunun mimari kararları.
> Bu doküman okuyucuya **NE'yi nasıl yaptığımızı ve NEDEN** anlatır.

---

## 1. Çoklu kiracılık modeli

Üç katmanlı izolasyon:

```
Organization (Kılıç Holding)              ← şirketler grubu, billing kökü
  └── Tenant (Tekstil, Enerji, İnşaat...) ← her şirket kendi izole verisi
        └── Subsidiary (İstanbul, Genel)  ← tenant içi bölünme (opsiyonel)
```

### Veri kapsamları

| Tablo | Scope | Sebep |
|---|---|---|
| `users`, `organizations`, `user_organization_roles` | global | auth tarafı |
| `tenants` | organization | bir org birden fazla şirket içerir |
| `persons`, `companies`, `properties`, `banks`, `institutions` | **organization** + `share_scope` | master data org içinde paylaşılır, `share_scope` ile tenant filtrelenir |
| `payable_items`, `sales_invoices`, `payments`, `employees`, `fixed_assets`, `payroll_runs`, `tasks` | **tenant** | finansal veri tenant'a kilitlenmiş |
| `audit_log`, `notifications` | tenant + user | gözlem |

### Tenant context resolve

İstek `tenant-context` middleware'den geçer:
1. `X-Sayman-Org: kilic` header'ı → `saymanContext.orgSlug`
2. `X-Sayman-Tenant: tekstil` header'ı → `saymanContext.tenantSlug`
3. Alternatif: `<tenant>.<org>.sayman.deploi.net` subdomain
4. Sonra `requireOrg`/`requireTenant` middleware'i kullanıcının yetkili olduğunu doğrular

---

## 2. Aggregate mode ("Tüm Şirketler")

Admin/yönetici roller "tüm tenant'ları birlikte" okuyabilir — denetim, raporlama için.

**Mekanizma:**
- Frontend: `localStorage['sayman-active']` → `{ aggregate: true, tenantSlug: null }`
- Frontend axios interceptor: `X-Sayman-Aggregate: 1` header'ı ekler
- Backend: `requireTenantOrAggregate` middleware
  - Tenant header varsa: tek tenant okuma + mutation izinli
  - Yoksa + aggregate=1 + admin: `req.aggregateTenantIds = [...visibleTenants]` set eder, **sadece okuma**
- `tenantScope(req, column)` helper otomatik `inArray(column, ids)` veya `eq(column, id)` üretir

**Kural:**
- Yazma (POST/PUT/DELETE) endpoint'leri `requireTenant` kullanır → aggregate'te çalışmaz, kullanıcı tenant seçmelidir
- Okuma (GET) endpoint'leri `requireTenantOrAggregate` kullanır
- Review Queue gibi cross-tenant ekranlar `?scope=org` query parametresi ile org-wide okumaya geçer
- Liste sayfaları aggregate'te her satıra `tenant_name` badge'i gösterir (kullanıcı hangi şirketten geldiğini bilsin)

---

## 3. Permissions ve roller

**7 rol:** `super_admin`, `organization_admin`, `yonetici`, `muhasebeci`, `denetci`, `personel`, `musavir`

**Permission matrisi:** `packages/shared/src/roles.ts → ROLE_PERMISSIONS`

**3 middleware seviyesi:**
- `requireAuth` — geçerli JWT (Supabase veya local)
- `requireOrg` — kullanıcı org üyesi + `req.activeOrgSlug` set
- `requireTenant` — yukarıdakiler + tenant context + `req.activeTenantId` set
- `requireTenantOrAggregate` — `requireTenant` veya aggregate fallback (read-only)
- `requirePerm('action.target')` — permission tablosuna karşı kontrol

**Tenant override:** `user_tenant_overrides` tablosu kullanıcının bir tenant'ta farklı role/deny olmasını destekler.

---

## 4. Audit log

`audit_log` tablosu her kritik mutation için bir kayıt tutar:
```typescript
await auditFromRequest(req, {
  organization_id, actor_user_id, actor_email,
  action: 'payable.create',        // resource.action
  target_type: 'payable_items',
  target_id: row.id,
  details: { ... },                 // değişiklik context'i
});
```

**Kural:**
- HER POST/PUT/PATCH/DELETE handler'ı audit yazmalı
- Audit yazımı **best-effort** — audit fail olursa response başarısız olmaz (audit.ts içinde try/catch)
- Sensitive fields (password, token, secret) `after_data` içine YAZMAZ
- Otomatik action enum mapping: `.create → create`, `.delete → delete`, `auth.login → login`, vb.

---

## 5. Data integrity: transaction ve lock pattern

### `$transaction` zorunluluğu

İki+ mutation aynı handler'da yapılırsa **mutlaka `$transaction`** içinde olmalı:

```typescript
const result = await db.transaction(async (tx) => {
  await tx.insert(X).values({...});
  await tx.update(Y).set({...}).where(...);
  return ...;
});
```

Aksi halde kısmi failure orphan kayıt bırakır.

### `SELECT ... FOR UPDATE` (concurrent mutation guard)

Status machine (payroll runs, payment approvals, payable_items.paid_amount) veya counter benzeri concurrent erişim varsa:

```typescript
await db.transaction(async (tx) => {
  const lockRes = await tx.execute(sql`
    SELECT id, status, paid_amount FROM table
    WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
    FOR UPDATE
  `);
  const row = (lockRes as any).rows?.[0];
  // ... validation ve update
});
```

PG default isolation `READ COMMITTED` → plain `SELECT` snapshot okur, paralel transaction'lar aynı eski değeri görür. `FOR UPDATE` row-level lock alır.

**Uygulandığı yerler:**
- `payments.ts POST /payments` — paid_amount lost update fix (E2E'de yakalandı)
- `payroll.ts approve/mark-paid` — status race
- `payment-approvals.ts approve` — pending → approved race
- `cargo-invoice` benzer pattern

### Cron / job concurrency

`lib/erp/runner.ts` `pg_try_advisory_lock(connectionId)` ile aynı connection için iki sync'in çakışmasını engeller. Tüm cron'lar single-instance varsayımı (future: BullMQ migration).

---

## 6. State machine: status transitions

Bazı status alanları yalnız belirli geçişlere izin verir:

| Resource | Geçiş kuralları |
|---|---|
| `payroll_runs` | `draft → approved → paid` (ileri-yönlü, geri dönüş yok) |
| `sales_invoices` | `draft → sent → partial_paid → paid` veya herhangi state'ten `cancelled` (paid+cancelled kilitli) |
| `fixed_assets.status` | yalnız `active` durumdaki demirbaş `dispose` edilebilir → `sold / disposed / written_off` |
| `payment_approvals` | `pending → approved` veya `pending → rejected` (kararlanmış olan değişmez) |

Kullanıcı yanlış geçiş denerse `400 INVALID_TRANSITION`.

---

## 7. Cache invalidation stratejisi

### Frontend (React Query)

**Cache key formatı:** `[entity, ...scope, ...filters]`
- Tenant-aware: `['payables', active.tenantSlug, active.aggregate, filters]`
- Aggregate switch ettiğinde cache invalid olur

**Mutation sonrası invalidation:**
- Smart Import commit → `review-queue, review-queue-summary-*, payables, companies, cari-list, inbox`
- Payment add → `payable[id], payables, inbox, cari-list`
- Review Queue approve/reject → 8 cache key (org-wide etki)
- Bulk approve/reject → aynı

**Banner/badge query'leri** kısa polling (`refetchInterval: 30s`) + mutation sonrası invalidation hibridi.

### Backend cache

- `lib/preview-cache.ts` — Smart Import preview→commit arası file cache (SHA256 hash, 5dk TTL, LRU)
- Tenant cross-leak yok: `cachePreview(hash, tenantId, userId, value)` tenant+user scope
- Production'da Redis'e taşınabilir, single-process için `Map` yeterli

---

## 8. Smart Import sistemi

Tek dosya akışı: **Önizleme → Onay → Otomatik Yönlendirme**

### Akış

```
1. Kullanıcı dosya bırakır (XML/CSV/XLSX/ZIP/PDF/IMG, max 30MB)
2. POST /v1/smart-import → server type detect + parse
   ZIP/RAR: 10MB/file + 100MB/total uncompressed limit
3. Response: cache_key (SHA256) + parsed preview
4. Kullanıcı "İçeriye Aktar" tıklar
5. POST /v1/smart-import?commit=true { cache_key }
   (file 2. defa upload edilmez — cache hit)
6. Backend:
   - XML/UBL: alıcı VKN → tenant routing
   - CSV: header normalize (Türkçe→İngilizce) → resource detect
   - ZIP: her XML için 1-5 adımları tekrarla (max 100 per batch)
7. Tüm yeni payable + auto-created supplier → needs_review=true
8. Frontend Review Queue cache invalidate edilir
9. Kullanıcı /destek? Hayır, /review-queue'da onaylar
```

### Auto-routing

`resolveTenantByRecipient(orgId, recipientVKN, activeTenantId)`:
- Alıcı VKN org içindeki bir tenant'ın `tax_number`'ı ile eşleşiyorsa → o tenant
- Eşleşmezse → aktif tenant + uyarı banner (UI'da gösterilir)
- `tenant_routing.mismatch` flag frontend'e döner, kullanıcıya "fatura ŞU tenant'a yazıldı" gösterilir

### Auto-supplier

`resolveOrCreateCompany(orgId, hint, tx)`:
1. `tax_number` ile kesin eşleşme
2. Yoksa case-insensitive name match
3. Yoksa yeni company yarat (`needs_review=true, auto_created_source='efatura'`)

### Türkçe header desteği

`TR_HEADER_ALIASES` map (`ad→name, tutar→amount, vergi_no→tax_number, vade→due_date, ...`) + `normalizeHeader()` Türkçe karakterleri ASCII'ye çevirir. Detection ve insert ikisi de normalize edilmiş anahtarlar üzerinden çalışır.

---

## 9. Review Queue (Onay Bekleyenler)

Auto-created kayıtlar (Smart Import, e-Fatura, inbound webhook) `needs_review=true` ile başlar. Faturalar/Şirketler listesinde **gizlenir** (`needs_review=false` filtre). Kullanıcı `/review-queue` sayfasında tek tek onaylar veya reddeder.

**Tasarım kuralları:**
- Default scope: `org` (kullanıcı hangi tenant'ta olursa olsun org'daki tüm bekleyenleri görür)
- Toggle: "Bu Tenant / Tüm Tenant'lar (Org)"
- Toplu onayla / toplu reddet: 500 kayıta kadar batch
- Approve endpoint'i kaydın kendi tenant_id'sini DB'den okur → aggregate mode'da da çalışır
- Şirket merge: payable.company_id taşı + count + delete tek transaction (race fix)

---

## 10. Otomatik destek talebi

**3 katmanlı:**
1. **Frontend ErrorBoundary**: React crash'inde `POST /support/tickets/auto-error` (10/5dk rate limit + 1 saat içinde aynı title dedup)
2. **Backend errorHandler middleware**: 500 hatasında `openAutoTicket()` (best-effort, response'u beklemez)
3. **Manuel**: `/destek` sayfası → modal (title + kategori + öncelik + açıklama)

**Schema:** `support_tickets` (org-scope, optional tenant, optional user, error_context jsonb, internal_notes admin-only)

**Status machine:** `open → in_progress → resolved → closed`. Admin "Çözüldü" ile kısa-yol kapatma.

---

## 11. Webhooks (outbound + inbound)

### Outbound

`webhook_endpoints` tablosu → her event tipi için subscriber URL + HMAC secret. Event yaratıldığında `webhook_deliveries` kuyruğa eklenir, `deliver-webhooks` cron her dakika POST'lar. Retry: 3 deneme, exponential backoff.

Receiver doğrulama:
```js
const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const ok = req.headers['x-sayman-signature'] === `sha256=${expected}`;
```

### Inbound

`inbound_webhook_endpoints` (her endpoint için slug + secret + event_type). `POST /v1/inbound/:slug` HMAC doğrular, `event_type`'a göre işler.

**Idempotency:**
- Caller `X-Idempotency-Key` header gönderirse DB-level unique index (`uniq_inbound_idempotency`)
- Header yoksa HMAC imzasını fallback idempotency key olarak kullan → aynı body 2. çağrı duplicate kabul edilir

### WhatsApp Meta webhook

`POST /v1/whatsapp/inbound` `x-hub-signature-256` HMAC ile doğrulanır (raw body capture index.ts'te `express.json` verify callback). Dev modda `WHATSAPP_APP_SECRET` yoksa warning + atla, production'da zorunlu.

---

## 12. AI integration

3 endpoint:
- `POST /v1/ai/ask` — Claude Haiku 4.5 tool-use (query_payables, query_guarantees, sum_by_supplier, ...). 45s AbortController timeout.
- `POST /v1/ai/explain` — bir payable için 6-aylık tedarikçi geçmişi + Claude açıklama. 30s timeout + rule-based fallback.
- `GET /v1/ai/summary/today` — günlük özet (lazy regenerate, 5/saat rate limit)
- `GET /v1/search/semantic` — Voyage embedding + pgvector cosine similarity (30/dakika rate limit)

**LLM PII koruması:** notlar/metadata stripping policy `lib/embeddings.ts` ve `ai-assistant.ts` içinde — sensitive field'lar (bank_account, national_id) embedding/prompt'a girmemeli. (TODO: zorunlu policy enforcement)

---

## 13. Stack özet

| Katman | Teknoloji |
|---|---|
| Frontend | Vite + React 18 + TanStack Query + Zustand + react-router 7 |
| Backend | Express 4 + TypeScript + Drizzle ORM 0.45 + node-postgres + pino |
| DB | PostgreSQL 16 + pgvector extension |
| Storage | Supabase Storage (`sayman-attachments` bucket) |
| Mail | Resend (verified domain `noreply@sayman.deploi.net`) |
| Cron | `node-cron` in-process, TZ Europe/Istanbul |
| LLM | Anthropic Claude Haiku 4.5 + Voyage embeddings |
| Cache/limit | Upstash Redis (varsa) + in-memory fallback |
| Auth | Local JWT + Supabase JWT (legacy) — `auth_accounts` + `auth_sessions` |
| Validation | Zod (request body + query) |
| Logging | pino + Sentry (errors only, opt-in) |
| Deploy | Coolify + Hetzner CX22 + Cloudflare DNS |

---

## 14. Kararlar ve trade-off'lar

| Karar | Trade-off | Sebep |
|---|---|---|
| Drizzle yerine Prisma değil | Daha az tip safety, daha hızlı setup | Tek dosya migration kontrolü + raw SQL kolaylığı |
| Express 4 (5 değil) | Async error otomatik forward değil → her route try/catch | Production-stable, mevcut middleware ecosystem |
| In-memory cron (BullMQ değil) | Tek instance varsayımı, horizontal scale yok | MVP; QStash/BullMQ migration yolu hazır |
| `node-cron` (Coolify scheduler değil) | Process restart cron sayacını sıfırlar | App içinde test kolaylığı, single-instance |
| ZIP bomb limit 100MB | Büyük arşivler reddedilir | DoS koruması, normal kullanım için yeterli |
| Cache TTL 5dk (preview) | Kullanıcı 5dk geç commit yaparsa file fallback | Memory bounded, normal flow için yeterli |
| Hard delete bazı tablolarda (companies, persons review queue) | FK cascade'i manuel doğrulama gerekir | Review queue'da yanlış yaratılan kayıt sürekli durmasın |
| `needs_review=true` Smart Import default | Kullanıcı her kayıt için onay vermek zorunda | Yanlış auto-router veya yanlış parsing kalıcı veri kirletmesin |
