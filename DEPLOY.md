# 🚀 Sayman Deploy Kılavuzu

> Hedef: Sayman'ı `https://sayman.deploi.net` (web) ve `https://api.sayman.deploi.net` (api) üzerinden canlı.

Damga ile birebir aynı pattern: monorepo + Coolify + Cloudflare DNS + Supabase Postgres + GitHub webhook auto-deploy.

## Önkoşullar

- Cloudflare DNS yönetiminde `deploi.net` domain'i ✓
- Hetzner CX22+ sunucu + Coolify (`coolify.deploi.net`) ✓
- GitHub repo `klchappy/sayman` (`gh repo create` ile bu kurulumda oluşturuldu) ✓
- Yeni Supabase projesi ❌ (sen açacaksın — adım 1)

---

## Adım 1 — Supabase yeni proje aç

1. https://app.supabase.com → **New project**
2. Bilgiler:
   - **Name:** `sayman`
   - **Region:** `Frankfurt (eu-central-1)` (Hetzner'a yakın)
   - **Database password:** güvenli bir şifre belirle (örn. parola oluşturucu, ≥24 karakter)
3. Proje açıldıktan sonra (1-2 dakika) şu bilgileri kaydet:
   - Settings → API → **Project URL** (örn. `https://abcdef.supabase.co`)
   - Settings → API → **anon public** key
   - Settings → API → **service_role** key (çok gizli!)
   - Settings → Database → Connection string → **URI (pooled, port 6543)**
   - Settings → Database → Connection string → **Direct connection (port 5432)** — migration için

## Adım 2 — Lokal `.env` ile migration uygula

`.env` dosyasına Supabase bilgilerini yaz (örnek):

```bash
NODE_ENV=production

DATABASE_URL=postgres://postgres.YOUR-PROJECT:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgres://postgres.YOUR-PROJECT:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres

# (Faz B'de Auth eklenince doldurulacak — şimdilik boş kalabilir)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...

JWT_SECRET=<32+ karakter güvenli secret>
```

`JWT_SECRET` için: `openssl rand -hex 32` veya `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Sonra migrate + seed:

```powershell
cd C:\Users\kaank\sayman
pnpm install
pnpm db:generate    # Drizzle migration üretir (lokal'de zaten 0000_*.sql var)
pnpm db:migrate     # Supabase'e uygular (13 tablo + enum + index)
pnpm db:seed        # Kılıç Holding + 7 sektör tenant + admin user
```

## Adım 3 — Cloudflare DNS subdomain'leri

https://dash.cloudflare.com → deploi.net → DNS → Records → Add record

Ekle:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `sayman` | `<Hetzner IP>` (damga ile aynı sunucu) | DNS only (gri) |
| A | `api.sayman` | `<Hetzner IP>` | DNS only (gri) |

> Coolify SSL sertifikasını otomatik yönetir; Cloudflare proxy bu yüzden **kapalı** (gri bulut).

## Adım 4 — Coolify'da Sayman projesi ve servisleri

### 4.1 Yeni proje
1. Coolify → **Projects** → **+ New Project** → adı: `sayman`
2. Environment: `production`

### 4.2 `sayman-api` servisi
1. **+ New Resource** → **Public Repository** veya **GitHub App** → `klchappy/sayman`
2. **Branch:** `main`
3. **Build pack:** Dockerfile
4. **Dockerfile path:** `apps/api/Dockerfile`
5. **Build context:** `/` (monorepo root)
6. **Domain:** `https://api.sayman.deploi.net`
7. **Port (Ports Exposes):** `4300`
8. **Healthcheck:** Path `/v1/health/healthz`, Port `4300`
9. **Environment Variables:**

```
NODE_ENV=production
PORT=4300
CLIENT_URL=https://sayman.deploi.net

DATABASE_URL=<Supabase pooled URL — adım 1>
DIRECT_URL=<Supabase direct URL — adım 1>

SUPABASE_URL=<adım 1>
SUPABASE_ANON_KEY=<adım 1>
SUPABASE_SERVICE_ROLE_KEY=<adım 1>

JWT_SECRET=<adım 2 ile aynı>
LOG_LEVEL=info
```

Save → Deploy.

### 4.3 `sayman-web` servisi
1. **+ New Resource** → aynı repo `klchappy/sayman`
2. **Dockerfile path:** `apps/web/Dockerfile`
3. **Build context:** `/`
4. **Domain:** `https://sayman.deploi.net`
5. **Port:** `80`
6. **Healthcheck:** Path `/healthz`, Port `80`
7. **Build Arguments** (Configuration → Build → Build arguments — Vite build-time'da inject):

```
VITE_API_URL=https://api.sayman.deploi.net/v1
VITE_SUPABASE_URL=<adım 1>
VITE_SUPABASE_ANON_KEY=<adım 1>
```

> Bunlar **Build Arguments**, normal Environment Variables DEĞİL. Vite production build'inde `ARG` olarak alınır.

Save → Deploy.

### 4.4 Auto-deploy webhook
Coolify'da her servis için "GitHub Webhook" otomatik kurulur (GitHub App bağlıysa). Her `git push origin main` Coolify'da auto-build tetikler.

Kontrol: GitHub → Settings → Webhooks → Coolify URL'i görünmeli.

## Adım 5 — Supabase URL whitelist (Faz B'de Auth eklenince)

> **Not:** Şu an Sayman'da Auth yok (Faz B'de Supabase Auth eklenecek). Bu adım Faz B'de yapılacak.

Faz B sonrası: https://supabase.com/dashboard/project/YOUR-PROJECT/auth/url-configuration

- **Site URL:** `https://sayman.deploi.net`
- **Redirect URLs:**
  - `https://sayman.deploi.net/auth/callback`
  - `https://sayman.deploi.net/auth/reset-password`
  - `https://sayman.deploi.net/**`
  - `http://localhost:5278/**`

## Adım 6 — İlk smoke test

```bash
# API health
curl https://api.sayman.deploi.net/v1/health
# → {"status":"ok","db":"ok","ts":"..."}

# Web
curl -I https://sayman.deploi.net/
# → HTTP 200

# Healthz (Coolify'ın kullandığı endpoint)
curl https://sayman.deploi.net/healthz
# → ok
curl https://api.sayman.deploi.net/v1/health/healthz
# → ok

# Tenant API
curl https://api.sayman.deploi.net/v1/organizations
# → 1 organization (Kılıç Holding)
```

Tarayıcı: https://sayman.deploi.net → Kılıç Holding listede görünür → tık → 7 sektör kartı.

## Diğer projelerle çakışma kontrolü ✓

| Servis | Damga | Sayman |
|---|---|---|
| GitHub repo | klchappy/damga | klchappy/sayman |
| Web port (lokal) | 5273 | 5278 |
| API port (lokal) | 4100 | 4300 |
| Postgres (lokal) | 5433 | 5434 |
| Domain | damga.deploi.net + api.damga.deploi.net | sayman.deploi.net + api.sayman.deploi.net |
| Coolify proje | damga | sayman |
| Supabase proje | damga | sayman (yeni) |

Hiçbir kaynakta çakışma yok ✅

## Sorun çözme

- **API 503 / "DATABASE_URL gerekli":** Coolify env'de DATABASE_URL eksik veya yanlış format
- **Web 404 / blank screen:** Build args eksik — özellikle VITE_API_URL Coolify'da Build Arguments sekmesine yazılmış mı?
- **CORS hatası:** API `CLIENT_URL` env'i `https://sayman.deploi.net` olmalı (sondaki `/` olmadan)
- **`pnpm db:migrate` failed:** `DIRECT_URL` (port 5432) verilmedi veya yanlış; Supabase pooled (6543) ddl yapamaz
- **Healthcheck failed:** API 4300, Web 80; Coolify'da port doğru mu?

## Sonraki Adımlar (Faz B+)

- **Faz B:** Supabase Auth entegrasyonu, login sayfası, tenant switcher
- **Faz C:** Master data CRUD (Person/Company/Property + share_scope UI)
- **Faz D:** Fatura/Ödeme REST API + UI
- **Faz E:** Sektör konfig flag'leri runtime'da
- **Faz F:** Iyzico billing entegrasyonu
- **Faz G:** Production wildcard SSL (`*.sayman.deploi.net` ileride tenant subdomain'ler için)
- **Faz H:** Damga / Santral / Lokma API köprüleri (opsiyonel veri akışı)
