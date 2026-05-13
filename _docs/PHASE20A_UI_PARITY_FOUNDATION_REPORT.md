# PHASE 20-A / 20-B — UI PARITY FOUNDATION + DASHBOARD PILOT REPORT

**Tarih:** 2026-05-08
**Sınıflandırma:** ✅ **PASS (LOCAL)** — 5 yeni partial + CSS refinement + topbar/sidebar refine + dashboard refactor; 16/16 endpoint render PASS; production deploy ayrı faz

---

## 0. Yönetici Özeti

| Madde | Sonuç |
|---|---|
| Audit (prototype vs live ekranlar + local templates/CSS) | ✅ |
| 5 yeni reusable partial | ✅ (`page_header`, `breadcrumb`, `kpi_card`, `filter_row`, `preview_panel`) |
| CSS refinements (additive, +257 satır) | ✅ — page-header, eyebrow, filter-row/chip, preview-panel, list-with-preview, sidebar active indicator, topbar search/user-chip, faz-badge sade, KPI color accents, mobile breakpoints |
| Topbar refine | ✅ gerçek search input + user chip (avatar + name + role) |
| Sidebar refine | ✅ duplicate brand block kaldırıldı + sol kenar accent indicator (CSS `::before`) |
| Dashboard refactor | ✅ page_header + kpi_card partial; **6 user-facing "Faz X" badge kaldırıldı** |
| `manage.py check` | ✅ 0 issues |
| `makemigrations --dry-run --check` | ✅ no changes |
| Django test client 16/16 path smoke | ✅ tümü 200 (sentetik render, lokal SQLite) |
| Dashboard HTML markers (page-header / eyebrow / page-title / user-chip / topbar-search) | ✅ hepsi var |
| Mid-flight bug + fix | ✅ `{# … %}` Django comment recursion (`{% include … %}` örneği gerçekten include ediyordu) → `{% comment %}…{% endcomment %}` ile düzeltildi |
| Production deploy | ❌ **bu fazda yok** (lokal commit; deploy ayrı Faz 20-X) |
| Santral / Araç dokunma | ❌ yok |
| Domain logic / URL / migration | ❌ değişmedi |

---

## 1. Audit Özeti

### Prototype vs Live (27 ekran görüntüsü incelendi)

**Prototype dili (DESIGN V2):**
- OPS + branding (sidebar üstünde), topbar tam genişlikte
- Topbar: arama input solda, "+ Hızlı Oluştur" CTA, kullanıcı chip (avatar + ad + rol)
- Page header: eyebrow (uppercase) + büyük başlık + sağda aksiyonlar
- KPI grid: 4 kart, sayı odaklı, mono numerik, hint metni
- Filter chips: pill style, label + select
- Tablo: kompakt, lines style
- Sağ preview panel: 360px sticky, başlık + meta + aksiyon
- Status badge: yaklaşıyor (sarı), aktif (mavi/yeşil), geciken (kırmızı), tamamlandı (yeşil)

**Mevcut live (production canlı):**
- ✅ Sidebar yapısı zaten prototype'a yakın (4 section, 17 nav item)
- ✅ Topbar OPS monogram + branding
- ✅ KPI kartları zaten var (`.kpi-card`, `.kpi-value` mono)
- ✅ Status badge var (7 variant)
- ✅ Tablo class `.kmt-table` zaten kompakt
- ❌ Page header partial yok (her template manuel `<h1>`)
- ❌ Filter chip styling yok (form'lar düz block)
- ❌ Preview panel pattern yok
- ❌ Topbar search input yok (yalnız 🔍 emoji button)
- ❌ User chip (avatar + ad + rol) yok (yalnız 2-harf square)
- ❌ Sidebar üstündeki duplicate brand block (topbar zaten gösteriyor)
- ❌ "Faz X" badge'leri user-facing UI'da çok belirgin

### Local audit bulguları

```
backend/templates/base.html              (36 lines)
backend/templates/includes/topbar.html   (23 → 36 lines)
backend/templates/includes/sidebar.html  (58 → 53 lines, duplicate brand kaldırıldı)
backend/static/css/app.css               (363 → 620 lines, +257 additive)
backend/templates/dashboard/home.html    (423 → 384 lines, FAZ badges removed)

YENI:
  backend/templates/includes/page_header.html
  backend/templates/includes/breadcrumb.html
  backend/templates/includes/kpi_card.html
  backend/templates/includes/filter_row.html       (placeholder, CSS only)
  backend/templates/includes/preview_panel.html
```

---

## 2. Faz 20-A — Foundation Patch

### 2.1 5 Yeni Partial

| Dosya | Amaç |
|---|---|
| `includes/page_header.html` | Eyebrow + başlık + subtitle. Aksiyonlar `.page-header-wrap` içinde sağ slot |
| `includes/breadcrumb.html` | Sadece eyebrow ("Operasyon / Fatura & Ödeme") |
| `includes/kpi_card.html` | Tek KPI kart (label + mono value + hint + color variant) |
| `includes/filter_row.html` | Placeholder + dökümantasyon (CSS-only, .filter-row + .filter-chip) |
| `includes/preview_panel.html` | Sağ preview iskelet — title + crumbs + subtitle + empty-state |

### 2.2 CSS Refinement (`app.css` +257 satır, additive)

```
/* === FAZ 20-A · UI PARITY PATCH (additive) === */

PAGE HEADER:
  .page-header-wrap, .page-header, .eyebrow, .page-title, .page-subtitle, .page-actions

FILTER ROW:
  .filter-row, .filter-chip, .filter-chip-label, .filter-chip-select

PREVIEW PANEL + LIST GRID:
  .list-with-preview (1fr 360px), .preview-panel (sticky top:72px),
  .preview-panel-header, .preview-panel-title, .preview-panel-subtitle,
  .preview-panel-row, .preview-panel-actions, .preview-panel-empty

SIDEBAR:
  .sidenav .nav-item.active::before  (sol kenar 3px accent indicator)

TOPBAR:
  .topbar .topbar-search (gerçek input)
  .topbar .topbar-search input
  .topbar .topbar-search-kbd (⌘K hint)
  .topbar .user-chip (avatar + name + role)

FAZ BADGE:
  .faz-badge (sade alternatif; status-tag yerine)

KPI ACCENTS:
  .kpi-card.kpi-warning/orange/danger/info/success .kpi-value { color }

LIST HELPERS:
  .list-toolbar, .list-meta

MOBILE:
  @media ≤1024px → list-with-preview kolon collapse
  @media ≤768px  → topbar-search/user-meta gizle, page-title sadeleştir
```

### 2.3 Topbar Refine

Önce: `🔍` emoji-button + 2-harf square user button
Sonra:
```html
<label class="topbar-search">
  <span>🔍</span>
  <input type="search" placeholder="Ara… kayıt, kişi, fatura no" disabled>
  <span class="topbar-search-kbd">⌘K</span>
</label>
...
<a href="..." class="user-chip">
  <span class="user-avatar">{{ user.username|slice:":2"|upper }}</span>
  <span class="user-meta">
    <span class="user-name">{{ user.get_full_name|default:user.username }}</span>
    <span class="user-role">{{ user.groups.first.name }}</span>
  </span>
</a>
```

**Disabled search input** — backend hookup ileride; placeholder + style prototype hissi verir, fonksiyonalite reddedilmez.

### 2.4 Sidebar Refine

- **Duplicate brand block kaldırıldı** (topbar zaten gösteriyor; sidebar üstünde 14 satır redundant kod silindi)
- **Active state visual indicator**: `.nav-item.active::before` ile sol kenarda 3px brand-700 accent (prototype hissi)

---

## 3. Faz 20-B — Dashboard Pilot

### Değişiklikler

1. **Page header partial** kullanıldı:
   ```django
   <div class="page-header-wrap">
     {% include "includes/page_header.html" with crumbs="OPERASYON / DASHBOARD" title="Operasyon Merkezi" subtitle=greeting_text %}
   </div>
   ```

2. **KPI kartları** `kpi_card.html` partial kullanıyor (4'lü grid, color-coded)

3. **6 user-facing "Faz X" badge kaldırıldı:**
   - `<span class="status-tag info" style="margin-left:6px;">Faz 7</span>` × 6 kez (Emlak Vergisi, Teminat, Entegratör, Raporlama, Mesajlar, Bildirim Merkezi card title'larından)
   - "Site Aidatları" card title'ından `Aktif` status-tag de kaldırıldı (gereksiz operasyonel)

4. **Mevcut domain logic / view context / URL / template tag** korundu (yalnız HTML structure ve markup değişti)

### Kalan minor:

- "Faz 8'de aktif" — view'da `risk_cards = [{'desc': "Faz 8'de aktif"}, ...]` data-driven string. Template değil, **view content** sorunu. Faz 20-B-2'ye ertelendi (operatör onayıyla view'da çoklu Faz X string güncellenir).

---

## 4. Mid-flight Bug + Fix

### Bug

İlk iki partial (`breadcrumb.html`, `page_header.html`) `RecursionError: maximum recursion depth exceeded` verdi. Sebep: Django'nun `{# … #}` template comment'i **tek satır**lık. Dosya başındaki çoklu satır docstring `{# … #}` içinde örnek kullanım için yazdığım `{% include "includes/breadcrumb.html" with crumbs="..." %}` satırı template parser tarafından **gerçek `{% include %}` direktif** olarak işlenip dosyayı **kendisini recursive include** etti (sonsuz döngü).

### Fix

`{# … #}` çoklu satır comment yerine `{% comment %} … {% endcomment %}` kullanıldı. `{% comment %}` blok template parser tarafından tamamen atlanır (içerideki tag'ler hiç parse edilmez). 5 partial'ın hepsinde uygulandı.

**Doğrulama:**
```
includes/breadcrumb.html      OK (59 chars)
includes/page_header.html     OK (177 chars)
includes/kpi_card.html        OK (146 chars)
includes/filter_row.html      OK (1 chars; placeholder)
includes/preview_panel.html   OK (181 chars)
```

---

## 5. Test Sonuçları

### `manage.py check`
```
System check identified no issues (0 silenced).
```

### `manage.py makemigrations --dry-run --check`
```
No changes detected
```

### Django test client smoke (16 path)

| Path | Status |
|---|---|
| `/dashboard/` | **200** — page-header ✓, eyebrow ✓, page-title ✓, user-chip ✓, topbar-search ✓ |
| `/master/`, `/documents/`, `/imports/`, `/subscriptions/`, `/regular-payments/`, `/official-payments/`, `/pruva/`, `/properties/`, `/guarantees/`, `/integrators/`, `/audit/`, `/notifications/`, `/tasks/`, `/chat/`, `/reports/` | hepsi **200** |

**16/16 → 200, 5xx yok.**

---

## 6. Sınır / No-op Doğrulaması

| Kural | Durum |
|---|---|
| Domain logic değiştirme | ❌ yok (yalnız HTML/CSS) |
| DB migration | ❌ yok |
| URL slug değişiklik | ❌ yok |
| Role/permission değişiklik | ❌ yok |
| Backend view logic | ❌ yok |
| Production deploy | ❌ bu fazda yok (lokal commit) |
| Santral / Araç dokunma | ❌ yok |
| Telegram / SMTP gerçek gönderim | ❌ kapalı |
| git push | ❌ yok |
| Dark mode CSS | ❌ eklenmedi (yasak korundu) |
| Inter / JetBrains font | ❌ eklenmedi (IBM Plex korundu) |
| Mobile-first dönüş | ❌ yok (desktop-first korundu) |
| Sidebar/topbar/base.html shell mantık değişimi | ❌ yok (sadece refine) |

---

## 7. Bilinen Küçük Farklar / Sonraki İş

### Bu fazda BIRAKILAN iş (operatör onayıyla sonraki fazlar):

| # | Kapsam | Faz |
|---|---|---|
| 1 | Fatura & Ödeme list parity (preview panel + filter chips + KPI grid) | **20-C** |
| 2 | Abonelikler list parity (KPI + table + preview panel) | **20-D** |
| 3 | Düzenli Ödemeler + Resmi Ödemeler list parity | **20-E** |
| 4 | Site Aidatları (pruva) + Emlak (properties) parity | **20-F** |
| 5 | Teminat + Entegratör + Tasks (split layout) parity | **20-G** |
| 6 | Belgeler + Raporlama + AuditLog + Yönetim parity | **20-H** |
| 7 | View'lardaki "Faz X" string'leri sadeleştirme (risk_cards.desc, vb.) | **20-B-2** |
| 8 | `/pruva/` URL slug → `/site-aidatlari/` rename + 301 redirect | **20-I** |
| 9 | Production deploy (`pre-production-mvp-ui-parity` tag + archive + nginx hookup) | **20-X** |
| 10 | Topbar search backend hookup (currently disabled placeholder) | **20-J** |
| 11 | "+ Hızlı Oluştur" backend hookup (currently `href="#"`) | **20-J** |

### Bilinen ufak detay:
- Lokal Django test client'ta `local.py` ile dashboard ilk önce `recursion error` verdi (`{# … %}` bug); fix sonrası 200. Bu bug **yalnız local SQLite test ortamında** görünmüştü; production'da Faz 19A-2'de aynı dashboard zaten 200 dönüyordu — yeni yazılan 2 partial'ın bug'ıydı, fix tamam.

---

## 8. Değişen Dosyalar Listesi

### Yeni
| Dosya | Satır |
|---|---|
| `backend/templates/includes/page_header.html` | 13 |
| `backend/templates/includes/breadcrumb.html` | 9 |
| `backend/templates/includes/kpi_card.html` | 10 |
| `backend/templates/includes/filter_row.html` | 8 (placeholder) |
| `backend/templates/includes/preview_panel.html` | 17 |

### Modified
| Dosya | Diff |
|---|---|
| `backend/static/css/app.css` | +257 satır (Faz 20-A patch) |
| `backend/templates/includes/topbar.html` | 23 → 36 satır (search input + user chip) |
| `backend/templates/includes/sidebar.html` | 58 → 53 satır (duplicate brand kaldırıldı) |
| `backend/templates/dashboard/home.html` | 423 → 384 satır (page_header/kpi_card partials + 6 FAZ badge kaldırıldı) |

---

## 9. Ekran Bazlı Parity İyileştirmeleri (bu fazda yapılan)

| Modül | Yapıldı |
|---|---|
| **Global shell** | ✅ Topbar real search + user chip; sidebar duplicate brand kaldırıldı, active indicator |
| **Dashboard / Operasyon Merkezi** | ✅ Page header partial, KPI partial, FAZ badge cleanup (6 adet) |
| Fatura & Ödeme | ⏳ Faz 20-C |
| Abonelikler | ⏳ Faz 20-D |
| Düzenli Ödemeler | ⏳ Faz 20-E |
| Resmi Ödemeler | ⏳ Faz 20-E |
| Site Aidatları | ⏳ Faz 20-F |
| Emlak Vergisi | ⏳ Faz 20-F |
| Teminat | ⏳ Faz 20-G |
| Entegratör & Kontör | ⏳ Faz 20-G |
| Ajanda & Görevler | ⏳ Faz 20-G |
| Belgeler | ⏳ Faz 20-H |
| Raporlama | ⏳ Faz 20-H |
| Yönetim | ⏳ Faz 20-H |
| AuditLog | ⏳ Faz 20-H |
| Master Tablolar | ⏳ Faz 20-H |

---

## 10. Final Karar

**Faz 20-A + 20-B (foundation + dashboard pilot) — PASS (LOCAL).**

Sistem prototype design dilini absorbe etmeye hazır. Foundation (5 partial + CSS) ve Dashboard pilot tamamlandı. Production deploy bu fazda yok — lokal commit ile devam, operatör onayıyla **Faz 20-C** (Fatura & Ödeme parity) başlatılır veya **Faz 20-X** ile mevcut 20-A+20-B production'a deploy edilir.

### Kabul Kriterleri Checklist

- [x] Sidebar + topbar + card system + table system tek tasarım diline oturmuş ✅ (foundation tamam)
- [x] Empty state'ler iyi görünmeli ✅ (mevcut sınıf korundu, yeni preview-panel-empty eklendi)
- [x] Typography, spacing ve renk sistemi prototype çizgisine yaklaşmış ✅
- [x] UI Türkçe ve kurumsal kalmalı ✅
- [x] Domain logic / URL / güvenlik / permission yapısı bozulmamalı ✅
- [x] Testler temiz ✅ (16/16 endpoint, 0 issues)
- [ ] Özellikle dashboard ve ana liste ekranlarında parity belirgin olmalı — **dashboard ✅, list ekranları Faz 20-C+**
- [ ] Sağ preview panel pattern'i uygun sayfalarda uygulanmış ✅ (foundation hazır, kullanım Faz 20-C+)

---

## 11. Önerilen Sonraki Adım

| Sıra | Faz | Kapsam |
|---|---|---|
| **1** | **20-X-pilot deploy** (opsiyonel) | Mevcut foundation + dashboard'ı production'a deploy edip canlıda görsel doğrulama yap; sonra sıra ile 20-C+ uygula |
| **2** | **20-C** | Fatura & Ödeme list parity (preview panel + filter chips + KPI grid) |
| **3** | **20-D-E-F-G-H** | Diğer 14 modül sırayla |
| **4** | **20-B-2** | View'lardaki "Faz X" string cleanup (risk_cards vb.) |
| **5** | **20-X-final** | Tam UI parity'li yeni archive + tag + production deploy |

Bu rapor lokal commit ile kapatılıyor. Operatör onayıyla 20-C veya 20-X-pilot ile devam.

🟢 **Foundation hazır, dashboard pilot tamam, production hâlâ stabil çalışıyor (canlıya hiçbir dokunuş yok).**
