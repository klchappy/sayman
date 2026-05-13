# UI Identity Reset Patch — Seed Design V2 Uyum Raporu

**Statü:** ✅ TAMAMLANDI
**Tarih:** 2026-05-07
**Kapsam:** Faz 1–9 boyunca üretilmiş Django template / static UI parçalarının yeni OPS kimliğine uyarlanması.
**Anayasa Maddesi:** 1.5 (izolasyon) · 3.4 (commit yok) · 11 (DESIGN_FREEZE — light only / IBM Plex / dark mode yok).
**Test:** _full suite koşusu rapor sonunda eklenecek_ · `python manage.py check` PASS · `python manage.py makemigrations --dry-run --check` → `No changes detected`.

---

## 1. Amaç

Faz 1–9 boyunca aktif UI'da kalan eski marka çağrışımlarını ("Acme", "SiteX") ve eski "üretim" gibi enerji-tonlu kelimeleri temizleyip; ürünü tek tip Seed Design V2 kimliği altında konumlandırmak. Faz 10 (Ajanda/Görev) öncesi tüm canlı ekranların aynı çatıyı paylaşması.

> Kapsam yalnız UI: template / static / layout. **Model, migration, servis logic, import commit davranışı değişmedi.**

---

## 2. Yeni Kimlik

| Alan | Değer |
|------|-------|
| Logo / monogram | **OPS** (yuvarlatılmış kare, indigo/lacivert dolgu, beyaz harfler) |
| Ürün adı | **Muhasebe Operasyonları Takip Sistemi** |
| Alt başlık | **OPERASYON MERKEZİ** |
| Tema | Light theme only (indigo / slate ERP tonu) |
| Font | IBM Plex Sans + IBM Plex Mono (Inter / JetBrains yasak) |
| Mobil | 16px input · 44px touch target (mevcut korundu) |

`config/settings/base.py` içindeki `BRAND` sözlüğü genişletildi:

```python
BRAND = {
    "name": "Muhasebe Operasyonları Takip Sistemi",
    "short": "Muhasebe Operasyonları",
    "monogram": "OPS",
    "subtitle": "OPERASYON MERKEZİ",
    "version": "0.2.0-ui-identity-reset",
}
```

`apps.core.context_processors` zaten `BRAND` ve `BRAND_NAME`'i template'lere geçiriyor — yeni alanlar otomatik tüm template'lerde erişilebilir.

---

## 3. Değiştirilen Dosyalar

### Layout / kimlik
| Dosya | Değişiklik |
|-------|-----------|
| `config/settings/base.py` | `BRAND` sözlüğü OPS kimliğine güncellendi (`name`, `short`, `monogram`, `subtitle`) |
| `templates/base.html` | `<title>` fallback `BRAND.name` |
| `templates/includes/topbar.html` | "K" rozeti yerine `OPS` monogram + ad + alt başlık (`brand-block` / `brand-mono` / `brand-text`) |
| `templates/includes/sidebar.html` | Yeniden yazıldı: OPS monogram başlık bloğu + 4 grup (**Operasyon / Mülk & Şahıs / Finans & Banka / Sistem**); "SiteX" → "Site Aidatları" |
| `static/css/app.css` | Top comment OPS kimliğine; `brand-block / brand-mono / brand-text / sidenav-brand / brand-mono-sm / sidenav-brand-text / sidenav-brand-name / sidenav-brand-sub` token-uyumlu stiller eklendi |

### Dashboard
| Dosya | Değişiklik |
|-------|-----------|
| `templates/dashboard/home.html` | Başlık: `Muhasebe Operasyon Merkezi` → `Operasyon Merkezi`; `<title>`: `BRAND.name`; "SiteX Daire / Aidat" widget başlığı → "Site Aidatları"; "Aktif Daire" → "Aktif Bağımsız Bölüm"; "üretim" → "oluşturma" |

### Pruva (label-only patch — app/model adları korundu)
10 template güncellendi: `aidat_difference_form/list`, `dashboard`, `site_document_form/list`, `statement_detail/document_upload/form`, `unit_detail/form` — tüm `SiteX` user-facing metinleri `Site Aidatları` ile değiştirildi (caption, h1, page title).

### Diğer modül placeholderları
| Dosya | Değişiklik |
|-------|-----------|
| `templates/tasks/list.html` | "Otomatik görev üretimi" → "Otomatik görev oluşturma" (× 2) |
| `templates/notifications/list.html` | "Bildirim üretimi Faz 12'de…" → "Bildirim akışı Faz 12'de…" |

### Test
| Dosya | Değişiklik |
|-------|-----------|
| `tests/test_ui_identity.py` | **YENİ** — 11 test: yasak kelime taraması, CSS sözleşmesi (Plex var, Inter/JetBrains/dark-mode yok), dashboard render kontratı (OPS monogram, ürün adı, OPERASYON MERKEZİ, Site Aidatları, Pruva yok, eski URL anchorları korundu) |

---

## 4. Sidebar Etiket Eşleşmesi

| Grup | Önce | Sonra |
|------|------|-------|
| **Operasyon** | Dashboard, Fatura & Ödeme, Abonelikler, Düzenli Ödemeler, Import Merkezi, Belgeler, Ajanda & Görev | Dashboard, Fatura & Ödeme, Abonelikler, Düzenli Ödemeler, Resmi Ödemeler |
| **Mülk-Şahıs / Mülk & Şahıs** | SiteX, Emlak Vergisi, Şahıslar | **Site Aidatları**, Emlak Vergisi, Şahıslar, Şirketler, Mülkler |
| **Şirket** | Şirketler, Mülkler, Entegratör/Kontör | _grup kaldırıldı, içerik dağıtıldı_ |
| **Resmi-Banka / Finans & Banka** | Teminat Mektupları, Resmi Ödemeler, Bankalar, Kurumlar | Teminat Mektupları, **Entegratör & Kontör**, Bankalar, Kurumlar |
| **Sistem** | Bildirim/Telegram, Raporlama, AuditLog, Master Tablolar | **Import Merkezi, Ajanda & Görevler**, Belgeler, Raporlama, AuditLog, Bildirimler, **Yönetim** |

URL namespace ve `href`'ler korundu — `subscriptions:list`, `regular_payments:list`, `official_payments:list`, `pruva:dashboard`, `properties:dashboard`, `guarantees:list`, `integrators:list`, `imports:list`, `tasks:list`, `documents:list`, `audit:list`, `notifications:list`, `parties:index`, `parties:list slug=...`. Mevcut Faz 5/8/9 sidebar testleri (URL anchor bekleyenler) etkilenmedi.

---

## 5. Yasak Kelime Taraması

`templates/`, `static/`, `apps/**/templates/` taranan terimler:

| Terim | Bulundu mu? | Notu |
|-------|-------------|------|
| `Acme` / `ACME` | ❌ | Aktif UI'da yok |
| `KE` (kelime sınırı) | ❌ | (Marka çağrışımı yok) |
| `HES` (kelime sınırı) | ❌ | — |
| `Santral` | ❌ | — |
| `Yenice` | ❌ | — |
| `Kısık` | ❌ | — |
| `enerji santrali` | ❌ | — |
| `üretim` | ❌ | "görev üretimi" / "bildirim üretimi" → "oluşturma / akış" rephrased |
| `Pruva` / `SiteX` | ❌ | Tüm 10 pruva template + dashboard widget label değiştirildi |

> Backend app/model adları (`apps.pruva`, `PruvaUnit`, `PruvaStatement`, `PruvaAidatDifference`, `PruvaSiteDocument`) **korundu** — spec gereği bu patch UI metinleri için. Veritabanı şeması ve servisler değişmedi.

---

## 6. CSS / Font / Dark Mode

`static/css/app.css`:
- IBM Plex Sans + IBM Plex Mono `--font-sans / --font-mono` token'ları korundu.
- Yeni `brand-block`, `brand-mono`, `sidenav-brand`, `brand-mono-sm` stilleri eklendi (yalnız token kullanımı, hardcoded renk yok).
- Top comment "MUHASEBE OPERASYON SİSTEMİ" → "Muhasebe Operasyonları Takip Sistemi · Operasyon Merkezi · Seed Design V2".
- Aktif kuralda `prefers-color-scheme: dark` yok (sadece "yasak" yorumunda kalıntı — test comment-stripped grep ile doğruluyor).
- `Inter` / `JetBrains` referansı yok.

---

## 7. Test Sonucu

| Komut | Sonuç |
|-------|-------|
| `python manage.py check` | ✅ `System check identified no issues (0 silenced).` |
| `python manage.py makemigrations --dry-run --check` | ✅ `No changes detected` |
| `python manage.py test tests.test_ui_identity` | ✅ **11/11 PASS** |
| `python manage.py test` (tam suite) | ✅ **248/248 PASS** (önceki 237 + 11 yeni UI identity testi, sıfır regresyon) |

> Önceki sidebar/widget testleri (`test_phase5.test_sidebar_links_exist`, `test_phase8.SidebarAndWidgetTest`, `test_phase9.SidebarAndWidgetTest`) URL anchor bekliyordu → korundu, hepsi PASS.

---

## 8. Anayasa / Sınır Teyitleri

| Sınır | Durum |
|-------|-------|
| Model değişikliği yok | ✅ |
| Migration yok | ✅ (`makemigrations --dry-run` boş) |
| DB write yok | ✅ |
| Domain servis logic değişikliği yok | ✅ |
| Import commit davranışı değişmedi | ✅ (yalnız UI patch) |
| Telegram / cron / mail yok | ✅ |
| Prod deploy yok | ✅ |
| Commit / push yok | ✅ |
| Kaynak Excel / RAR / PDF dosyalarına dokunulmadı | ✅ |
| Design canvas dosyalarına dokunulmadı | ✅ |
| Testler korundu | ✅ (önceki 237 PASS, 11 yeni eklendi) |

---

## 9. Açık Kalanlar

- Backend `apps.pruva` namespace adı korundu (model/class adları); UI dışında uzun vadeli rename ayrı bir iş başlığı olabilir. Bu patch'in kapsamı dışında.
- `_docs/PHASE6_SITEX_MVP_REPORT.md` ve diğer geçmiş faz raporlarındaki "SiteX" / "Acme" referansları geçmişin parçası olarak korundu (spec izinli).
- Faz 10 (Ajanda / Görev) zaman tetikleyicisi (`T-3 / T-7 / T-15`) UI'sı bu patch'te dokunulmadı; Faz 10 implementation'ında OPS kimliği baseline alınacak.
- Topbar'daki "Bildirimler" linki artık sidebar'da da Sistem grubunda — tutarlılık sağlandı.

---

## 10. Sonuç

UI Identity Reset Patch hedefe ulaştı. OPS monogram, "Muhasebe Operasyonları Takip Sistemi" ürün adı ve "OPERASYON MERKEZİ" alt başlığı topbar + sidebar + dashboard üzerinden tüm authenticated sayfalarda render olur. Eski marka/enerji/SiteX çağrışımları aktif UI dosyalarından temizlendi. CSS sözleşmesi (light-only / IBM Plex / Inter-JetBrains-dark-mode yok) test edildi. Domain davranışı, migration ve servis logic'i hiç değişmedi.

**FİNAL KARAR: UI IDENTITY RESET PASS — Faz 10'a geçilebilir.**
