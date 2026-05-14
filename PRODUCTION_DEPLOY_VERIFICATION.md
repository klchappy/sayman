# Sayman Production Deploy — Verification Raporu

**Tarih:** 2026-05-14
**Sonuç:** ✅ **PASS** — sayman.deploi.net + api.sayman.deploi.net canlı

---

## 🔗 Production URL'leri

| Servis | URL | Healthcheck |
|---|---|---|
| Web | https://sayman.deploi.net | `/healthz` → `ok` |
| API | https://api.sayman.deploi.net | `/v1/health` → `{"status":"ok","db":"ok"}` |

## 🧪 Smoke Test (canlı, doğrulanmış)

```bash
curl https://api.sayman.deploi.net/v1/health
# {"status":"ok","db":"ok","ts":"2026-05-14T08:18:31.886Z"}

curl https://api.sayman.deploi.net/v1/health/healthz
# ok

curl https://sayman.deploi.net/healthz
# ok

curl https://api.sayman.deploi.net/v1/organizations
# {"data":[{"name":"Kılıç Holding","slug":"kilic","plan":"pro",...}],"count":1}

curl -I https://sayman.deploi.net/
# HTTP/1.1 200 OK
# <title>Sayman — Muhasebe Operasyon Platformu</title>
```

## 🏗 Altyapı Bileşenleri

### Supabase (Pro plan, eu-central-1)
- **Project:** `sayman` (ref: `dfbevcemusawhibymiqg`)
- **DB:** PostgreSQL 17.6 (pooled @ 6543, direct @ 5432)
- **Tablolar:** 13 (organizations, tenants, users, user_organization_roles, user_tenant_overrides, banks, institutions, persons, companies, properties, payable_items, payment_transactions, audit_log)
- **Seed:** Kılıç Holding + 7 sektör tenant + admin user

### Cloudflare DNS (zone: deploi.net)
- A `sayman.deploi.net` → 46.225.25.177 (DNS only, proxy kapalı)
- A `api.sayman.deploi.net` → 46.225.25.177 (DNS only)
- SSL: Coolify Traefik Let's Encrypt otomatik

### Coolify (proje: sayman, env: production)
- **Project UUID:** `cx03zy9ltxfm1xe368pd9qe9`
- **sayman-api** (UUID: `xdy5msb04a8pq8iyz21n0lnf`)
  - Dockerfile: `/apps/api/Dockerfile`
  - Port: 4300 (Traefik → 443)
  - Healthcheck: `/v1/health/healthz`
  - Env: 10 değişken (DATABASE_URL, SUPABASE_*, JWT_SECRET, vs.)
- **sayman-web** (UUID: `h13pbw7v6ffepm2ak0y2msmp`)
  - Dockerfile: `/apps/web/Dockerfile` (Vite build + nginx)
  - Port: 80
  - Healthcheck: `/healthz`
  - Build args: 3 (VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

### GitHub
- Repo: [klchappy/sayman](https://github.com/klchappy/sayman) (public)
- Branch: `main`
- Auto-deploy: Coolify webhook her push'da build tetikler

## 📝 Geriye Dönük: Deploy Sırasında Yaşananlar

1. ✅ Supabase Pro yükseltme (free 2-proje limiti aşıldı, kullanıcı Pro'ya geçti)
2. ✅ tahminio Supabase projesi silindi (arşivliydi)
3. ✅ Yeni Supabase sayman projesi yaratıldı (Management API ile)
4. ✅ Drizzle migrate + seed lokal'den Supabase'e yapıldı
5. ✅ Cloudflare API token üretildi + 2 A kayıt eklendi
6. ✅ Coolify API token + sayman projesi + 2 application + env'ler bulk
7. ❌ İlk 2 deploy: clone fail (private repo)
8. ❌ 3. deploy: git_repository field'ında URL prefix bug
9. ✅ Repo public yapıldı (Damga pattern'i)
10. ✅ git_repository = `klchappy/sayman` (sadece owner/repo)
11. ✅ Build başarılı, healthcheck PASS

## 🎯 Şu An Çalışan

- Multi-tenant Sayman ana sayfa: organizations listesi
- Tenant detay sayfası (`/orgs/kilic`): 7 sektör kartı + sektör başına aktif modüller
- API endpoint'leri: `/v1/health`, `/v1/me`, `/v1/organizations`, `/v1/tenants`
- Login ekranı: Supabase Auth (henüz user yok — Faz B'de dashboard'dan ilk user yaratılır)

## 🔜 Sıradaki Adım

- **İlk Supabase user yarat** (https://supabase.com/dashboard/project/dfbevcemusawhibymiqg/auth/users → Add user)
- `auth_user_id`'yi `public.users` tablosundaki `kaanklc498@gmail.com` ile bağla (SQL)
- Login → Sayman dashboard
- **Faz C:** Master data CRUD (Person/Company/Property + `share_scope[]` UI)
