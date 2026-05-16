# Sayman — Kullanıcı İş Akışları

> Sistemde **gerçekte nasıl iş yapılır**. Kim hangi düğmeye basar, sistem ne döner, sonraki adım nedir.
> Bu dokümanı **kullanıcı eğitiminde** ve **yeni geliştirici onboarding'inde** kullan.

---

## 1. Yeni şirket / tenant oluşturma

**Kim:** super_admin, organization_admin, yonetici

**Adımlar:**
1. Sol menü → **Şirketler** (`/sirketler`)
2. **+ Yeni Şirket** butonu
3. Modal: ad, sektör (8 seçenek), VKN
4. **Oluştur** → tenant yaratılır + sektöre göre default modüller atanır
5. Yeni tenant **TenantSwitcher** dropdown'ında görünür

**Backend etkileri:**
- `tenants` tablosu: yeni satır
- `audit_log`: `action='tenant.create'`
- Sektörün default aktif modülleri `active_modules` jsonb'sine kopyalanır (`packages/shared/sectors.ts → SECTOR_DEFAULT_MODULES`)
- Aktif kullanıcı otomatik o tenant'a `tenant_overrides` ile yetkilendirilmez — sadece super_admin/admin görür

**Aktif/pasif toggle (soft delete):**
- Pasif tenant TenantSwitcher'da görünmez ama verisi kalır
- super_admin **kalıcı sil** butonuyla cascade silebilir (uyarı modal'ı, "tenant adını yaz" prompt)

---

## 2. Akıllı Yükleme (Smart Import)

**Tek dosya akışı — XML, CSV, XLSX, ZIP, RAR, PDF, görsel**

### Akıllı Yükleme — e-Fatura XML

1. `/import` → "Akıllı Yükleme" tab'ı (default)
2. Dropzone'a `.xml` bırak → backend parse
3. **Önizleme paneli:** fatura no, tarih, tutar, tedarikçi, alıcı VKN
4. ⚠️ Eğer alıcı VKN aktif tenant'tan farklı bir tenant'a eşleşirse **amber uyarı**: "Fatura BAŞKA tenant'a yazılacak"
5. **İçeriye Aktar** → backend commit:
   - Otomatik tenant routing
   - Tedarikçi yoksa otomatik açma (`needs_review=true`)
   - Fatura `needs_review=true` ile `payable_items`'a yazılır
   - `uniq_payable_invoice` index ile **idempotent** (aynı invoice_no 2x → skipped)
6. Sonuç ekranı: "Onay Bekleyenler'e Git →" link

### Akıllı Yükleme — CSV/XLSX (Türkçe header)

1. Aynı sayfa, `.csv` veya `.xlsx` bırak
2. Backend header'ları normalize eder: `baslik→title, tutar→amount, tedarikci_adi→supplier_name, vade→due_date`
3. **Resource detection:** header'lara göre `payables`, `companies`, `persons`, vb. otomatik tespit
4. Önizleme: ilk 5 satır + valid/invalid sayısı
5. **İçeriye Aktar** → bulk insert:
   - `payables` ise: her satır için auto-supplier (company) + `needs_review=true`
   - Diğer resource'lar: org/tenant-scope insert
   - **Tek transaction** (auto-supplier + bulk insert atomik)
6. Sonuç: "X kayıt + Y yeni tedarikçi (doğrulama bekliyor)"

### Akıllı Yükleme — ZIP / RAR (e-Fatura arşivi)

1. ZIP içinde `.xml` dosyalar
2. Backend ZIP'i açar, max **100 XML / 100MB total / 10MB per file**
3. Önizleme: kaç XML var, hangileri
4. Eğer >100 XML: amber uyarı "İlk 100 işlenecek, geri kalan için yeni ZIP yükle"
5. **İçeriye Aktar** → her XML için tenant routing + supplier resolve + insert
6. Sonuç: `success / duplicate / failed` sayıları + her dosyanın detayı

### Preview→Commit cache

Önizleme → commit arasında dosya tekrar upload edilmez:
- Preview response'unda `cache_key` (SHA256) döner
- Commit `{ cache_key }` JSON gönderir (file yok)
- Cache miss (5dk TTL) → backend 410 döner → frontend otomatik file ile fallback

---

## 3. Onay Bekleyenler (Review Queue)

**Otomatik yaratılan tüm kayıtlar burada toplanır:**
- Smart Import'tan gelen faturalar + tedarikçiler
- e-Fatura webhook'lardan gelen
- Inbound webhook ile yaratılan kayıtlar

### Sayfa açıldığında

- Default scope: **`org`** (tüm tenant'lardaki bekleyenler)
- Toggle: "Bu Tenant / Tüm Tenant'lar (Org)"
- 4 tab: Gelen Faturalar / Satış Faturaları / Şirketler / Şahıslar
- Her kart: kategori ikonu (`smart_import_csv`, `efatura`, `inbound_webhook`), tenant_name badge, durum

### Onay/Red operasyonları

**Tekil onay** (satır başına):
- "Onayla" → `needs_review=false`, kayıt aktif listede görünür
- "Reddet" → DB'den hard delete (geri alınamaz!)
- Şirket: ek olarak "Birleştir" → başka bir şirketle merge (payable.company_id taşır, source silinir)

**Toplu onay/red** (üst bar):
- Sol checkbox + master "Tümünü seç (N)"
- "Toplu Onayla (X)" / "Toplu Reddet (X)" butonları
- ConfirmDialog modal (red için kırmızı/danger)
- Max 500 kayıt per batch
- Aggregate mode'da bile çalışır (her kayıt kendi tenant'ında işlenir)

### Cache invalidation

Onay/red sonrası şu cache'ler invalidate edilir:
- `review-queue`, `review-queue-summary-*`
- `payables`, `sales-invoices`, `cari-list`
- `companies`, `persons`

Sol menü badge'i + dashboard banner anlık güncellenir.

---

## 4. Fatura → Ödeme → Onay (çift onay akışı)

### Manuel fatura ekleme

1. Faturalar (`/payables`) → **+ Yeni Fatura**
2. Form: tedarikçi/kategori/tutar/vade
3. Submit → `payable_items` insert + audit + cari hesap etkilenir
4. Default: `needs_review=false` (manuel ekleme güvenilir)

### Ödeme kaydı

**Düşük tutar (< 50.000 TRY):** doğrudan
1. Fatura detayı → **Ödeme Ekle**
2. paid_at + amount + method → `POST /v1/payments`
3. Backend SELECT FOR UPDATE ile payable'ı lock'lar, paid_amount günceller
4. Status otomatik: `paid_amount >= amount → paid`, `>0 → partial_paid`
5. Cache invalidate: `payable, payables, inbox, cari-list`

**Yüksek tutar (≥ 50.000 TRY):** çift onay
1. Kullanıcı `POST /v1/payment-approvals` ile **öneri** açar
2. Admin (kendi başlatmadığı sürece — segregation of duties) `POST /payment-approvals/:id/approve`
3. Backend SELECT FOR UPDATE + tek transaction: approval status değiştir + asıl `payment_transactions` insert
4. Audit: `payment_approval.approve`

### Lost update protection

10 paralel ödeme × 500 TRY = 5000 → tam doğru hesaplanır (SELECT FOR UPDATE).
Önceden 9 ödeme kaybolurdu (E2E testte yakalandı).

---

## 5. Bordro (Payroll)

**Aylık periyot:**
1. `/payroll` → "Yeni Bordro" → period seç (YYYY-MM)
2. Backend tek transaction'da:
   - `payroll_runs` insert (status=`draft`)
   - Tüm aktif employee'ler için `calculatePayroll()` (SGK, gelir vergisi, AGİ, damga, agi)
   - Tüm `payroll_items` batch insert (N round-trip yerine 1)
   - `payroll_runs` total alanları update
3. Audit + frontend cache invalidate

**Status machine:** `draft → approved → paid`

**Onay (`/payroll/runs/:id/approve`):**
- requireRole: yonetici/admin/super_admin
- SELECT FOR UPDATE + status check (sadece draft onaylanabilir)
- Status → `approved`

**Ödendi işle (`/payroll/runs/:id/mark-paid`):**
- SELECT FOR UPDATE + status check (sadece approved → paid)
- Status → `paid`, paid_at set

**Silme:** sadece draft silinebilir (transaction içi guard)

---

## 6. Demirbaş (Fixed Assets)

**Status:** `active → sold | disposed | written_off`

**Yaşam döngüsü:**
1. **Oluştur:** purchase_cost + useful_life_months + depreciation_method (`straight_line` veya `declining_balance`)
2. **Aylık amortisman** (cron `run-depreciation` her ayın 1'inde):
   - Her active asset için `calculateMonthlyDepreciation()` çağır
   - `depreciation_entries` insert + `fixed_assets.accumulated_depreciation` update
   - **Tek transaction** + duplicate check tx içinde (paralel cron job yarış engellendi)
3. **Elden çıkarma (`/dispose`):**
   - Yalnız `status='active'` demirbaş elden çıkarılabilir
   - Body: `status` (sold/disposed/written_off) + disposed_at + disposal_proceeds
   - Validation guard: aksi halde `400 INVALID_TRANSITION`

---

## 7. Yinelenen ödemeler (Regular Payments)

`regular_payment_profiles` (örn. Kira "Beşiktaş 3+1 — 15000 TL/ay, her ayın 5'i") sonsuza dek devam eden taahhütler.

**Cron `generate-periods`** her gece 03:00:
- Her aktif profil için `regularPaymentPeriods` 3 ay ileri üretir
- `annual_increase_rate` varsa `next_increase_date` geçince otomatik artır
- Tek profilin tüm period'ları **tek transaction** (mid-job crash → atomik rollback)

Aynı pattern `official_payment_profiles` (vergi, SGK, BAĞKUR) için.

---

## 8. Bütçe (Budgets)

Aylık/quarterly/yıllık plan: "Mayıs 2026 elektrik = 5000 TL"

**Liste sayfası** (`/budgets`):
- Her budget için **gerçekleşen tutar** = aynı periyot + kategori için `payable_items.amount` toplamı
- N+1 önlenmiş: tüm budget'lar için **tek GROUP BY** sorgusu (range bazlı bucket)
- Kullanım %, aşılma bayrağı

**Aşılma uyarısı** (cron):
- `alert_threshold_pct` (default 80) geçilince `alerted_at` set + notification

---

## 9. Cari hesaplar (ERP sync)

`cari_accounts` tedarikçi/müşteri ledger'ı (ERP'den gelir veya manuel).

**ERP push (`/sales-invoices/:id/push/:connId`):**
- Drizzle adapter (`getAdapter(provider)`) çağrılır
- Başarılı: invoice.erp_external_id set, `erp_push_status='pushed'`
- Audit + invoice update **tek transaction**

**ERP full sync (`runFullSync`):**
- `pg_try_advisory_lock(connectionId)` ile aynı connection için iki sync paralel çalışamaz
- Cari + movement + invoice + stock pull
- `erp_sync_logs` tablosu progress takip

---

## 10. Otomatik destek talebi

**3 yol:**

### 1. Frontend React crash → otomatik
- `ErrorBoundary.componentDidCatch` POST `/v1/support/tickets/auto-error`
- Title = error.name + message, error_context = url + stack + component_stack + user_agent
- 10/5dk rate limit + 1 saat içinde aynı title dedup (occurrences++)
- Kullanıcı "Bir şeyler ters gitti" ekranında "✓ Destek talebi otomatik açıldı" görür

### 2. Backend 500 → otomatik
- `errorHandler` middleware'inde `openAutoTicket()` best-effort
- Response'a `auto_support_ticket: true` flag eklenir
- User org+route_path+stack ile ticket açılır, audit'e düşmez (audit zaten log yapıyor)

### 3. Manuel → kullanıcı
- `/destek` sayfası → "+ Yeni Talep" modal
- Title + kategori (bug/feature_request/question) + öncelik + açıklama

### Yönetim

- Kullanıcı kendi ticket'larını görür
- Admin (super_admin/organization_admin) tüm org ticket'larını görür + `internal_notes`
- "Çözüldü" kısa-yol butonu → status `resolved`, resolved_at set
- Status: `open → in_progress → resolved → closed`

---

## 11. Çoklu şirket görünümü (Aggregate)

**Admin "Tüm Şirketler"i seçtiğinde:**
- TenantSwitcher → "Tüm Şirketler (toplu)"
- `localStorage['sayman-active']` → `aggregate: true, tenantSlug: null`
- Axios interceptor `X-Sayman-Aggregate: 1` header'ı ekler
- 25 GET endpoint org'daki tüm tenant'ların datasını döner
- Liste sayfaları her satıra `tenant_name` badge'i gösterir

**Yapamadıkları (kasten):**
- Yazma (POST/PUT/DELETE) — kullanıcı tenant seçmek zorunda
- Subsidiaries, BulkCategorize, Import sayfaları — tenant-specific write akışları

**Niye böyle?**
- Holding sahibi: tüm şirketlerin nakit pozisyonunu tek ekranda görmek ister
- Muhasebeci: cross-tenant fatura tarayabilir ama yanlış tenant'a yazma riskini sıfırlamalı

---

## 12. Bildirimler (Notifications)

3 kaynak:
1. **Cron events** (vade yaklaşıyor, bütçe aşıldı)
2. **Direct triggers** (yeni atanan görev, paylaşılan rapor)
3. **Multi-channel push** (in-app + email/Resend + Telegram bot + WhatsApp Meta)

**Akış:**
- `lib/notify.ts → notify({event, toUser/toRole, data})`
- `notifications` tablosu insert
- Kullanıcı tercihine göre email/telegram/whatsapp send (best-effort)
- Frontend SSE (`/v1/realtime/notifications`) ile real-time stream

---

## 13. Cron jobs (tüm liste)

| Saat | İş | Açıklama |
|---|---|---|
| 03:00 daily | `generate-periods` | regular + official + guarantee period'ları 3 ay ileri |
| 07:00 daily | `generate-ai-summary` | tenant başına günlük AI özet (LLM çağrısı) |
| 09:00 daily | `send-reminders` | T-60/T-30/T-7 commitment + T-7/T-1 ödeme uyarısı |
| 09:30 daily | `send-collection-reminders` | tahsilat hatırlatma kuralları |
| 10:00 daily | `detect-anomalies` | tutar/zaman pattern anomali tespiti |
| 16:00 daily | `fetch-fx-rates` | TCMB kapanış kurları |
| Hourly :05 | `update-statuses` | pending → approaching → overdue |
| Hourly :30 | `embed-payables` | semantic search için pgvector embedding |
| Every minute | `deliver-webhooks` | outbound webhook delivery queue |
| 1st of month | `run-depreciation` | aylık amortisman |

Manuel tetik: `POST /v1/jobs/run-now/:job` (super_admin).

---

## 14. Performance kuralları

- **N+1 yok:** budgets (E2E'de fix), her LIST endpoint'i tek query veya tek GROUP BY
- **Connection pool:** node-postgres default (10 connection per process)
- **Cache key tenant-aware:** her React Query key tenant_slug + aggregate state içerir
- **Polling sınırlı:** review-queue badge 30s, inbox 60s, dashboard 60s
- **Rate limit kritik endpoint'lerde:**
  - AI summary: 5/saat per user
  - Semantic search: 30/dakika per user
  - Smart Import auto-error: 10/5dk
  - Customer portal: 20/dakika per IP
  - Auth sign-in: 5/dakika per email + 20/dakika per IP

---

## 15. Production deploy

1. `git push origin main` → GitHub
2. Coolify GitHub webhook tetiklenir
3. Coolify:
   - `sayman-web` container build (Vite production bundle)
   - `sayman-api` container build (tsc + node)
   - `pnpm db:migrate` ile yeni migration'lar uygulanır
   - Health check geçince traffic switch
4. `sayman.deploi.net` + `api.sayman.deploi.net` artık yeni versiyonda

Build hatası olursa Coolify dashboard'da kırmızı görünür. Rollback: önceki commit'e revert + push veya Coolify'dan eski deployment'ı yeniden aktive et.

---

## 16. Veri yedekleme

Supabase otomatik daily backup + 7 gün retention.

Manuel snapshot: `pg_dump` ile lokal alınabilir.

Disaster recovery: yeni Supabase projesi aç → backup restore → `DATABASE_URL` güncelle → Coolify env update → redeploy. Hedef RTO: <2 saat, RPO: <24 saat.
