# Sayman

Multi-tenant muhasebe operasyon SaaS platformu.

**Production:** https://sayman.deploi.net · API: https://api.sayman.deploi.net/v1

---

## Mimari

- **Frontend** (`apps/web`): Vite + React 18 + Tailwind + TanStack Query + Zustand + react-router 7
- **Backend** (`apps/api`): Express + TypeScript + Drizzle ORM 0.45 + node-postgres + pino
- **DB**: PostgreSQL (Supabase Pro)
- **Storage**: Supabase Storage bucket `sayman-attachments`
- **Mail**: Resend (`noreply@sayman.deploi.net`, verified domain)
- **Cron**: `node-cron` in-process, Europe/Istanbul TZ
- **Deploy**: Coolify (Hetzner CX22 + Cloudflare DNS)

## Çoklu kiracılık (multi-tenant)

3 katman:

```
Organization (Kılıç Holding)
  └── Tenant (Kılıç İnşaat, Kılıç Tekstil, ...)
        └── Subsidiary (İstanbul Şubesi, Genel Müdürlük, ...)  -- opsiyonel
```

- **Tenant header**: `X-Sayman-Org: kilic`, `X-Sayman-Tenant: insaat`
- **Subdomain alternatif**: `*.sayman.deploi.net` DNS wildcard hazır (routing manuel kurulum)
- Master data (`persons`, `companies`, `properties`) **organization-scope** + `share_scope` ile tenant filtrelemesi
- Finance/ödeme/teminat **tenant-scope** + opsiyonel `subsidiary_id`

## Sektörler

`tekstil / enerji / insaat / gayrimenkul / kisisel / sanayi / hukuk / diger`

Her sektörün **default açık modülleri** vardır (`packages/shared/src/sectors.ts → SECTOR_DEFAULT_MODULES`). Tenant oluşturulurken bu set kopyalanır, sonra UI'dan elle değiştirilebilir.

## Modüller (14)

`finance, subscriptions, regular_payments, official_payments, pruva, properties, guarantees, integrators, imports, notifications, tasks, chat, dashboard, reports`

## Roller (7)

`super_admin, organization_admin, yonetici, muhasebeci, denetci, personel, musavir`

Permission matrisi: `packages/shared/src/roles.ts → ROLE_PERMISSIONS`.

---

## Lokal kurulum

```bash
git clone https://github.com/klchappy/sayman.git
cd sayman
pnpm install
cp .env.example .env
# DATABASE_URL, JWT_SECRET, RESEND_API_KEY, vb. doldur
pnpm db:migrate
pnpm dev   # Web :5278 + API :4300
```

## Geliştirme komutları

| Komut | Açıklama |
|---|---|
| `pnpm dev` | Web + API paralel |
| `pnpm typecheck` | Tüm paketler tip kontrolü |
| `pnpm db:generate` | Drizzle schema → migration SQL |
| `pnpm db:migrate` | Migration uygula |
| `pnpm db:seed` | Kılıç Holding + 7 tenant seed |
| `pnpm db:studio` | Drizzle Studio (DB GUI) |

## API yüzey özeti

| Alan | Endpoint örnek |
|---|---|
| Auth | `/v1/auth/local/sign-in`, `/auth/local/sign-up-org`, `/auth/logout`, `/auth/sessions` |
| Me | `/v1/me`, `/users/me/permissions`, `/users/me/telegram` |
| Org/Tenant | `/v1/organizations`, `/tenants` (CRUD) |
| Master data | `/v1/persons`, `/companies`, `/properties`, `/banks`, `/institutions` |
| Finance | `/v1/payables`, `/payments` |
| Yinelenen | `/v1/subscriptions`, `/regular-payments`, `/official-payments`, `/guarantees` |
| Operasyon | `/v1/tasks`, `/notifications`, `/security/audit` |
| Kullanıcı yönetimi | `/v1/users`, `/users/invite`, `/users/accept-invite` |
| Import | `/v1/import/:resource` (CSV/XLSX/JSON), `/import/resources` |
| e-Fatura | `/v1/efatura/parse`, `/efatura/import`, `/efatura/import-zip` |
| Attachments | `/v1/attachments` (Supabase Storage) |
| API Tokens | `/v1/api-tokens` (programmatic erişim) |
| Webhooks | `/v1/webhooks` (outbound, HMAC imzalı) |
| PDF | `/v1/pdf/payable/:id`, `/pdf/guarantee/:id` |
| Reports | `/v1/reports/monthly-summary`, `/reports/guarantees-summary` |
| Search | `/v1/search?q=...` (Cmd+K) |
| FX Rates | `/v1/fx-rates/latest`, `/fx-rates/:currency` |
| Realtime | `/v1/realtime/notifications` (SSE) |
| Dashboard | `/v1/dashboard/summary` |
| Docs | `/v1/docs` (Swagger UI), `/v1/openapi.json` |

Tam liste: https://api.sayman.deploi.net/v1/docs

## Cron jobs (TZ Europe/Istanbul)

| Saat | İş |
|---|---|
| Daily 03:00 | `generate-periods` — kira/guarantee/resmi-ödeme periyotları 3 ay ileri |
| Daily 09:00 | `send-reminders` — T-60/T-30/T-7 commitment + T-7/T-1 ödeme uyarısı (mail + telegram) |
| Hourly :05 | `update-statuses` — pending → approaching → overdue |
| Daily 16:00 | `fetch-fx-rates` — TCMB kapanış kurları |
| Every minute | `deliver-webhooks` — kuyrukta bekleyen webhook POST + retry |

Manuel tetik: `POST /v1/jobs/run-now/:job` (super_admin).

## Programmatic erişim

```bash
# Security sayfasından "Yeni Token Üret"
TOKEN=st_xxxxxxxxxxxx

curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Sayman-Org: kilic" \
     -H "X-Sayman-Tenant: insaat" \
     https://api.sayman.deploi.net/v1/payables
```

**Webhooks**: Security → Webhook Endpoints → Yeni. HMAC-SHA256 imza `X-Sayman-Signature` header'da. Receiver doğrulama:

```js
const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const ok = req.headers['x-sayman-signature'] === `sha256=${expected}`;
```

## Dosya yapısı

```
sayman/
├── apps/
│   ├── api/    (@sayman/api)
│   │   └── src/
│   │       ├── config/        env, logger
│   │       ├── lib/           email, telegram, sentry, webhooks, helpers
│   │       ├── middleware/    auth, tenant-context, permission, rate-limit
│   │       ├── jobs/          cron (generate-periods, reminders, fx, webhooks, ...)
│   │       └── routes/        25+ route file
│   └── web/    (@sayman/web)
│       └── src/
│           ├── components/    AppShell, CommandPalette, AttachmentBox, ErrorBoundary
│           ├── lib/           api, auth, use-subsidiaries
│           └── pages/         30+ sayfa
├── packages/
│   ├── db/     (@sayman/db) Drizzle schema + migrations (10+)
│   └── shared/ (@sayman/shared) zod + enum + role/module matrisleri
├── scripts/
│   ├── smoke-master-data.mjs  prod uçtan uca test (60+ step)
│   └── coolify-set-envs.mjs   env push helper
└── infra/
    └── docker-compose.yml     lokal Postgres 16
```

## Test

```bash
node scripts/smoke-master-data.mjs   # Production smoke test
```

Auth, master data, finance, yinelenen, kullanıcı yönetimi, import (CSV/XLSX), e-fatura, dashboard, cron jobs, search, PDF, attachments, API tokens — hepsi prod'a karşı test edilir.

## Deploy

GitHub'a push → Coolify webhook tetikler → auto-deploy.

Manuel:
```bash
curl -X POST "https://coolify.deploi.net/api/v1/deploy?uuid=xdy5msb04a8pq8iyz21n0lnf" \
  -H "Authorization: Bearer $COOLIFY_TOKEN"
```

## Konfigürasyon

`.env` (opsiyonel olanlar yoksa **graceful fallback** moduna geçer):

```
# Zorunlu
DATABASE_URL=postgresql://...
JWT_SECRET=<min-32-char>

# Mail gateway (opsiyonel — yoksa "fallback_link" mode)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@your-domain.com

# Telegram bildirim (opsiyonel)
TELEGRAM_BOT_TOKEN=<bot-token>

# Hata izleme (opsiyonel)
SENTRY_DSN=https://...

# Supabase Storage (attachments için zorunlu)
SUPABASE_URL=https://....supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Public URL'ler (mail/davet linki için)
PUBLIC_WEB_URL=https://sayman.deploi.net
```

## Lisans

Proprietary — Kaan Kılıç, 2026.
