# FAZ 1 — DJANGO APP PLANI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

> Bu doküman Django app yapısını, her app'in sorumluluk alanını, içerdiği modelleri/views/services/management commands ve MVP önceliğini tanımlar.

---

## 1. APP HARİTASI ÖZETİ

| App | MVP | Faz | Bağımlılık |
|---|---|---|---|
| `apps.core` | MVP-1 | Faz 2 | — |
| `apps.audit` | MVP-1 | Faz 2 | core |
| `apps.accounts` | MVP-1 | Faz 2 | core |
| `apps.parties` | MVP-1 | Faz 2 | core, audit |
| `apps.documents` | MVP-1 | Faz 2 | core, audit |
| `apps.imports` | MVP-1 | Faz 3 | core, parties, documents, audit |
| `apps.finance` | MVP-1 | Faz 4 | core, parties, documents, imports |
| `apps.subscriptions` | MVP-1 | Faz 5 | finance, parties |
| `apps.pruva` | MVP-1 | Faz 6 | parties (Mülk), finance, documents |
| `apps.properties` | MVP-1 | Faz 7 | parties (Mülk), documents |
| `apps.guarantees` | MVP-1 | Faz 8 | parties, documents, finance |
| `apps.official_payments` | MVP-1 | (Faz 4 paralel) | parties, finance |
| `apps.tasks` | MVP-1 | Faz 10 | accounts, audit |
| `apps.notifications` | MVP-1 | Faz 12 | tasks |
| `apps.dashboard` | MVP-1 | Faz 4-13 | tüm read |
| `apps.integrators` | MVP-2 | Faz 9 | parties, documents |
| `apps.chat` | MVP-3 | Faz 11 | accounts |
| `apps.reports` | MVP-2 | Faz 13 | tüm read |

---

## 2. APP DETAYLARI

### 2.1 `apps.core`
- **Amaç:** Tüm modellerin miras alacağı temel sınıflar, mixin, helper.
- **Modeller:** `BaseModel` (abstract), `SoftDeleteMixin`, `TimestampMixin`, `AuditMixin`.
- **Views/templates:** Yok (utility).
- **Services:** `format_money_tr()`, `format_date_tr()`, `mask_tc()`, `mask_phone()`, `make_yyyymm()`, `parse_yyyymm()`.
- **Management:** `seed_demo` (LATER, opsiyonel demo veri).
- **Test:** SoftDelete davranışı, format helper'lar.
- **MVP:** MVP-1.

### 2.2 `apps.audit`
- **Amaç:** Tüm CRUD aksiyonlarını kayıt altına alma.
- **Modeller:** `AuditLog(user, model, kayit_id, eylem, eski_json, yeni_json, modul, ip, ua, zaman)`.
- **Views/templates:** AuditLog liste + detay drawer (Frame 18).
- **Services:** `record_audit(user, instance, action, old, new)`, `diff_dict(old, new)`.
- **Middleware:** `AuditLogMiddleware` (request.user yakala, signal hook'la).
- **Management:** `audit_export` (Excel), `audit_purge` (>2 yıl LATER).
- **Test:** CRUD audit yazımı, TC maskeleme, hard-delete log'u.
- **MVP:** MVP-1 (her şeyden önce middleware kurulur).

### 2.3 `apps.accounts`
- **Amaç:** User, Group/Role, Permission, profil.
- **Modeller:** `User` (proxy veya custom AbstractUser), `Profile`, `RoleDefinition` (Django Group ile birlikte).
- **Views/templates:** Login, profil, kullanıcı listesi (Frame 19), şifre sıfırla.
- **Services:** `has_module_perm(user, app, action)`, `simulate_permission(user, record, action)` (Frame 19 simülasyonu).
- **Management:** `create_roles`, `bootstrap_users` (Anayasa 4.2 listesi).
- **Test:** Permission helper'lar, role hiyerarşisi.
- **MVP:** MVP-1.
- **Bağımlılık:** core.

### 2.4 `apps.parties`
- **Amaç:** Sahis (Şahıs), Sirket, Mulk, Banka, Kurum master tabloları.
- **Modeller:** `Sahis`, `Sirket`, `Mulk`, `Banka`, `Kurum`.
- **Views/templates:** Master CRUD (Frame 19'un Şirketler/Şahıslar/Mülkler tab'ları).
- **Services:** `find_or_create_sahis(tc, ad)`, `match_kurum(name)` — import sırasında fuzzy match.
- **Management:** `seed_master` (manuel onaylı seed: 5 şahıs + 10 şirket + 12 mülk).
- **Test:** Unique constraint (TC, vergi no, sicil), fuzzy match, master uyarı (manuel doğrulama).
- **MVP:** MVP-1.
- **Bağımlılık:** core, audit.

### 2.5 `apps.documents`
- **Amaç:** Belge/dosya yönetimi (sha256 dedup, private storage).
- **Modeller:** `Belge` (file, sha256, tip, ozel_sinif, sirket/sahis/mulk FK opsiyonel).
- **Views/templates:** Belge upload, indir (yetki kontrollü), önizleme (PDF.js).
- **Services:** `store_file(file)`, `compute_sha256(file)`, `get_or_create_belge(file)`.
- **Storage:** `private` storage class — nginx X-Accel-Redirect.
- **Test:** Dedup (aynı sha256 → mevcut Belge), MIME whitelist, boyut limiti.
- **MVP:** MVP-1.

### 2.6 `apps.imports`
- **Amaç:** Excel/PDF/RAR/Klasör import pipeline.
- **Modeller:** `ImportBatch`, `ImportSourceFile`, `ImportDraftRecord`, `ImportDraftField`, `ImportLog`, `ImportMappingProfile`.
- **Views/templates:** Frame 03 (Center), Frame 04 (Preview), Frame 24 (Mobile).
- **Services:** `excel_parser(file, mapping)`, `pdf_meta_parser(file)`, `rar_extractor(file)`, `commit_batch(batch)`, `rollback_batch(batch, user)`.
- **Management:** `import_dry_run <file> --target <module>`, `import_rollback <batch_id>`.
- **Test:** Dry-run, commit, rollback, idempotency (aynı dosya tekrar yükleme).
- **MVP:** MVP-1 omurga.
- **Bağımlılık:** core, parties, documents, audit, hedef modüller.

### 2.7 `apps.finance`
- **Amaç:** Fatura + Ödeme.
- **Modeller:** `Fatura`, `FaturaKalemi`, `Odeme`, `OdemeYontemi` (enum), `OdemeBelgesi` (M2M Belge), `OdemeMutabakat`.
- **Views/templates:** Frame 05/06/07/22/23.
- **Services:** `mark_paid(fatura, tutar, tarih, yontem, dekont, kullanici)`, `link_payment(fatura, odeme)`, `is_dekont_required(tutar)` (D-011 eşik).
- **Management:** `finance_aging_report`, `finance_export <yyyymm>`.
- **Test:** Ödeme işaretleme, kısmi ödeme, dekont zorunluluk eşiği, audit yazımı.
- **MVP:** MVP-1.

### 2.8 `apps.subscriptions`
- **Amaç:** Abonelik + Taahhüt + Otomatik ödeme talimatı.
- **Modeller:** `Abonelik`, `Taahhut`, `Kampanya`, `OtomatikOdemeTalimati`.
- **Views/templates:** Frame 08.
- **Services:** `taahhut_bitis_check()` (cron), `iptal_sureci_baslat(abonelik)`.
- **Management:** `taahhut_calendar_export`.
- **Test:** Taahhüt T-60/T-30/T-7 görev üretimi, "X" iptal varsayımı parse.
- **MVP:** MVP-1.

### 2.9 `apps.pruva`
- **Amaç:** SiteX site (5 daire) aidat/gider/ekstre.
- **Modeller:** `SiteXDaire`, `SiteXEkstre`, `SiteXAidat`, `SiteXGider`, `SiteXAidatFarki`, `SiteXYillikBelge`.
- **Views/templates:** Frame 09.
- **Services:** `parse_ekstre_filename(path)` (regex `PRUVA\YYYY-MM\<DAIRE>.pdf`), `compute_aidat_farki(daire, yyyymm)`.
- **Management:** `pruva_import_rar <path>`, `pruva_aidat_check`.
- **Test:** RAR parse, daire kodu eşleme, aidat farkı hesabı.
- **MVP:** MVP-1.

### 2.10 `apps.properties`
- **Amaç:** Mülk + EmlakVergisi.
- **Modeller:** `Mulk` (parties'tan miras alabilir veya burada tutulabilir; **karar:** parties.Mulk merkezi, bu app sadece `EmlakVergisi`+`Belediye`+belge), `Belediye`, `EmlakVergisi`, `EmlakBelgesi`.
- **Views/templates:** Frame 10.
- **Services:** `emlak_grid(yil_baslangic, yil_bitis)`, `mark_emlak_paid(emlak, makbuz)`.
- **Management:** `emlak_import_rar <path>`, `emlak_taksit_calendar`.
- **Test:** Yıl-dönem unique, makbuz upload, T-15 görev üretimi.
- **MVP:** MVP-1.

### 2.11 `apps.guarantees`
- **Amaç:** Teminat mektupları + komisyon.
- **Modeller:** `TeminatMektubu`, `TeminatKomisyonOdemesi`, `TeminatIade`.
- **Views/templates:** Frame 11.
- **Services:** `next_komisyon_tarihi(mektup)`, `iade_et(mektup, tarih)`.
- **Management:** `guarantee_renewal_check`, `commission_export`.
- **Test:** Heterojen sheet parse (Acme Enerji vs Beta vs Tekstil), iade durumu.
- **MVP:** MVP-1.

### 2.12 `apps.official_payments`
- **Amaç:** BAĞKUR / SSK / İTO / BES / vergi.
- **Modeller:** `ResmiOdeme`, `ResmiOdemeTipi` (enum), `ResmiOdemeDonemi`.
- **Views/templates:** Frame 12.
- **Services:** `bagkur_aylik_uret()` (cron), `ito_taksit_uret(yil)`.
- **Management:** `official_calendar_export`.
- **Test:** İTO 1./2.taksit kuralı, BAĞKUR aylık otomasyon.
- **MVP:** MVP-1.

### 2.13 `apps.integrators` (MVP-2 — Faz 9)
- **Amaç:** ETA/Papinet/EDM/Digital Planet + kontör.
- **Modeller:** `Entegrator`, `EntegratorSozlesme`, `KontorBakiye`, `KontorHareket`, `KontorKampanya`, `EntegratorFatura`.
- **Views/templates:** Frame 14.
- **Services:** `kontor_kritik_check()` (cron), `sozlesme_bitis_check()`.
- **Management:** `papinet_import_rar`.
- **Test:** Kontör eşik altı bildirim, sözleşme T-60 görev.
- **MVP:** MVP-2.

### 2.14 `apps.tasks`
- **Amaç:** Görev/ajanda yönetimi.
- **Modeller:** `Gorev`, `GorevYorumu`, `GorevEki`, `GorevGecmisi`, `GorevSablonu`.
- **Views/templates:** Frame 15, 21.
- **Services:** `auto_create_tasks()` (cron, gece 00:30), `complete_task()`, `defer_task(yeni_tarih, sebep)`.
- **Management:** `task_overdue_summary` (cron 09:00), `task_eod_check` (17:30).
- **Test:** Otomatik üretim idempotency, erteleme audit, swipe gesture (UI test).
- **MVP:** MVP-1.

### 2.15 `apps.chat` (MVP-3 — Faz 11)
- **Amaç:** Kayıt-bağlantılı kurumsal chat.
- **Modeller:** `ChatThread`, `ChatParticipant`, `ChatMessage`, `ChatAttachment`, `ChatReadState`.
- **Views/templates:** Frame 25 fullscreen + collapsed widget.
- **Services:** WebSocket consumer (Channels), `mark_read(message, user)`, `mention_resolve(text)`.
- **Management:** `chat_archive_old` (>1 yıl LATER).
- **Test:** Real-time mesaj, okundu, mention, yetki.
- **MVP:** MVP-3.

### 2.16 `apps.notifications`
- **Amaç:** Bildirim üretimi + Telegram entegrasyonu.
- **Modeller:** `NotificationRule`, `NotificationLog`, `NotificationDeliveryAttempt`, `TelegramKonfig`, `TelegramKanal`.
- **Views/templates:** Frame 16.
- **Services:** `produce_notification(rule, target, context)`, `send_telegram(log, mod)` (mod: dry-run/test/gercek).
- **Management:** `notification_t_minus_check` (cron), `telegram_test_send`.
- **Test:** Dry-run yazımı, gerçek gönderim KAPALI doğrulaması, hata retry.
- **MVP:** MVP-1 (gerçek Telegram Faz 12'de açılır).

### 2.17 `apps.dashboard`
- **Amaç:** Frame 02 ve Frame 20 widget aggregator.
- **Modeller:** Yok (read-only views, opsiyonel `WidgetTercih`).
- **Views/templates:** Dashboard ana sayfa, widget partials.
- **Services:** `kpi_bugun_odenecek()`, `kpi_bu_ay_geciken()`, `risk_kontor_kritik()`, `widget_pruva_ay_ozet()`.
- **MVP:** MVP-1.

### 2.18 `apps.reports` (MVP-2 — Faz 13)
- **Amaç:** Rapor şablonu + Excel/PDF export.
- **Modeller:** `RaporSablonu`, `RaporCalistirma`, `RaporExportDosya`.
- **Views/templates:** Frame 17.
- **Services:** `run_report(sablon, params, format)`, `schedule_report(sablon, cron)`.
- **Management:** `report_run <sablon_id>`.
- **Test:** Excel/PDF doğrulama, planlı rapor cron.
- **MVP:** MVP-2.

---

## 3. APP-PROCESSES BAĞIMLILIK GRAFİĞİ

```
core ← audit ← accounts ← parties ← documents
                                      ↓
                                    imports
                                      ↓
        ┌────────┬────────┬────────┬──────┴──────┬────────┬────────┐
     finance subscriptions pruva properties guarantees official integrators
        ↓         ↓          ↓        ↓           ↓         ↓         ↓
    └─────────────────────── tasks ─────────────────────────┘
                                ↓
                          notifications
                                ↓
                            dashboard ← reports ← chat
```

Yatay bağımlılık: `tasks` ← tüm modüller (Generic FK).

---

## 4. INSTALL ORDER (Faz 2 başlangıç)

1. core
2. audit
3. accounts
4. parties
5. documents
6. (Faz 3) imports
7. (Faz 4) finance + official_payments
8. (Faz 5) subscriptions
9. (Faz 6) pruva
10. (Faz 7) properties
11. (Faz 8) guarantees
12. (Faz 9 — MVP-2) integrators
13. (Faz 10) tasks
14. (Faz 12) notifications
15. dashboard
16. (Faz 13) reports
17. (Faz 11 — MVP-3) chat

---

## 5. TEST KAPSAMI ÖZET

| App | Hedef Coverage MVP-1 | Hedef MVP-2 |
|---|---|---|
| core, audit | %85 | %90 |
| accounts | %75 | %85 |
| parties, documents | %70 | %80 |
| imports | %80 (kritik) | %85 |
| finance, official_payments | %75 | %85 |
| subscriptions, pruva, properties, guarantees | %65 | %75 |
| tasks, notifications | %70 | %80 |
| chat (MVP-3) | — | %60 |
| reports | — | %60 |
| dashboard | %50 (smoke) | %70 |

**Genel hedef MVP-1: %60+, MVP-2: %75+** (Anayasa Madde 14.5).

---
