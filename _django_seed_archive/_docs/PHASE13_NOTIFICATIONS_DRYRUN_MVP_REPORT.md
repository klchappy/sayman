# Faz 13 — Bildirim Merkezi / Telegram Dry-run MVP Raporu

**Durum:** TAMAMLANDI
**Tarih:** 2026-05-07
**Test:** 413/413 PASS (önceki 371 + Faz 13 yeni 42)
**`manage.py check`:** PASS
**`makemigrations --dry-run --check`:** PASS

---

## 1. Kapsam

Faz 13, sistem genelindeki domain verilerini (PayableItem, Task, SubscriptionCommitment, PruvaStatement [user-facing **Site Aidatları**], PropertyTaxInstallment, GuaranteeCommissionPeriod, CreditPackage) tarayıp **dry-run** bildirim adayları üreten ve bunları suppress / cancel / mark-ready kapısı + **gerçek-gönderim-yok** Telegram simülasyonuyla yöneten Bildirim Merkezi'ni ekler.

**Anayasa Madde 8 (4 aşamalı kapı):** 1) Dashboard aday → 2) Dry-run log → 3) Test simülasyonu → 4) **Gerçek Telegram: KAPALI**.

**Hard guard'lar:** Telegram/SMTP/HTTP isteği yok, `requests`/`urllib`/`http.client` import yok, Celery/APScheduler/cron yok, `apps.imports` `NotificationLog` yaratmaz.

---

## 2. Modeller

`apps.notifications.models` (mevcut `NotificationLog` veri kaybetmeden genişletildi):

| Model | Alanlar (özet) |
|---|---|
| `NotificationCategory` | PAYABLE, TASK, SUBSCRIPTION, SITE_DUES, PROPERTY_TAX, GUARANTEE, INTEGRATOR, REPORT, SYSTEM, OTHER |
| `NotificationTriggerType` | DUE_DATE, OVERDUE, STATUS_CHANGE, THRESHOLD, MANUAL, OTHER |
| `NotificationChannel` | DASHBOARD, TELEGRAM, EMAIL, SYSTEM (+ legacy) |
| `NotificationSeverity` | INFO, WARNING, CRITICAL |
| `NotificationStatus` | PENDING, **DRY_RUN**, **TEST**, **READY**, SENT, **FAILED**, **SUPPRESSED**, **CANCELLED**, MUTED, SCHEDULED |
| `NotificationRule` | name, code unique, category, trigger_type, channel, days_before, is_active, **dry_run_only** (default True), severity, title_template, message_template, metadata JSON, created_by |
| `NotificationLog` (genişletilmiş) | rule FK, category, severity, level (legacy), channel, status, title, message, related_app/model/object_id/title, target_user, **target_chat_id (maskeli)**, **dry_run** (default True), **real_send_allowed** (default False), error_message, metadata, indeksler |
| `NotificationPreference` | user, category, dashboard_enabled, telegram_enabled, email_enabled, muted, unique(user,category) |

`NotificationLog.masked_chat_id` — chat id'yi `12******89` formatında maskeleyen property.

Migration `0002_notificationlog_category_..._notificationrule` uygulandı; `--check --dry-run` temiz.

---

## 3. Seed (Idempotent)

`python manage.py seed_notification_rules` — 10 rule:

`PAYABLE_DUE_T7`, `PAYABLE_OVERDUE`, `TASK_DUE_TODAY`, `TASK_OVERDUE`, `SUBSCRIPTION_COMMITMENT_T30`, `SITE_DUES_DUE_T3`, `PROPERTY_TAX_T15`, `GUARANTEE_COMMISSION_T7`, `INTEGRATOR_CREDIT_CRITICAL`, `REPORT_EXPORT_FAILED`.

- Hepsi `dry_run_only=True`, `is_active=True`, `channel=DASHBOARD`.
- Mevcut kuralı **overwrite etmez** (idempotent).
- Hiç **NotificationLog** seed edilmez.
- Her yaratılan kural için `AuditLog(action="SEED")`.

---

## 4. Servisler

`apps.notifications.services.notifications`:

- **Permission**: `_can_run_dry_run` — superuser veya `can_approve` (yonetici/muhasebe_muduru/super_admin). Viewer ve muhasebeci dry-run ÇALIŞTIRAMAZ.
- **render_notification**: `title_template`/`message_template` `.format()` — **`token`/`chat_id`/`bot_token` context'ten silinir**, render edilmez.
- **create_notification_log**: dedup için `metadata.fingerprint`; AuditLog yazar.
- **Builders** (8 adet, tüm spec kategorileri):
  - `build_due_payable_notifications(days=7)` — yaklaşan
  - `build_overdue_payable_notifications()` — geciken
  - `build_task_due_notifications()` — bugün/geciken görev (severity'i akıllıca seçer)
  - `build_subscription_commitment_notifications(days=30)`
  - `build_site_dues_notifications(days=3)` — **user-facing label "Site Aidatları"**
  - `build_property_tax_notifications(days=15)`
  - `build_guarantee_commission_notifications(days=7)`
  - `build_integrator_credit_notifications()` — CRITICAL/EXHAUSTED kontör paketleri
- **Dedup**: `_fingerprint(rule_code|app|model|object_id|date)` ⇒ `NotificationLog.metadata__fingerprint=fp`. Aynı dry-run ikinci kez çalışınca yeni log üretmez.
- **Orchestrator**: `run_notification_dry_run(category=None, days=7, user=...)` — kategori filtreli, AuditLog yazar, kategori başına builder hatasını yakalar.
- **State transitions** (atomic, audit'li): `mark_notification_ready`, `suppress_notification(reason)`, `cancel_notification`.
- **Telegram**:
  - `simulate_telegram_message(notification)` → `{preview_text, masked_chat_id, real_send: False, warning}`. **Hiç HTTP yok.**
  - `send_telegram_notification(notification)` — **GERÇEK GÖNDERİM YOK.** `dry_run` veya `real_send_allowed=False` ise log → `SUPPRESSED`. Gerçek-send-allowed olsa bile bu MVP'de no-op kalır + audit yazar.

---

## 5. URL'ler & View'lar

`/notifications/` namespace altında 14 endpoint:

| URL | View | Yetki |
|---|---|---|
| `dashboard` | `NotificationDashboardView` | login |
| `legacy/` (eski list) | `NotificationListView` | login |
| `rules/`, `rules/new/`, `rules/<pk>/`, `rules/<pk>/edit/` | RuleList/Create/Detail/Edit | login (create/edit: writer) |
| `logs/`, `logs/<pk>/` | LogList/LogDetail | login |
| `logs/<pk>/suppress\|cancel\|ready/` | POST actions | login + manager/admin |
| `dry-run/`, `dry-run/run/` | `DryRunView` | login + manager/admin |
| `telegram-test/` | `TelegramTestView` | login + manager/admin |
| `preferences/` | `PreferencesView` | login |

Sidebar `🔔 Bildirimler` artık `notifications:dashboard`'a gider; namespace highlighting korundu.

---

## 6. Şablonlar

`templates/notifications/` (10 dosya): `dashboard.html`, `rule_list.html`, `rule_form.html`, `rule_detail.html`, `log_list.html`, `log_detail.html`, `dry_run.html`, `dry_run_result.html`, `telegram_test.html`, `preferences.html` (+ legacy `list.html`).

UI özellikleri:
- **Light-only**, IBM Plex Sans/Mono, indigo/slate.
- Her ekranda **"Gerçek Telegram: KAPALI"** rozeti.
- `log_detail` ve `telegram_test` yalnız `masked_chat_id` render eder; `target_chat_id` raw değildir; `BOT_TOKEN` yoktur.
- 4 aşamalı kapı dashboard'da gösteriliyor.

---

## 7. Dashboard Entegrasyonu

`apps.dashboard.views.DashboardHomeView` artık `phase13_notifications` ctx'i hesaplıyor:
- `recent` (5 son log)
- `dry_run_count`, `suppressed_count`, `failed_count`, `critical_count`
- `real_send_open: False`

Önceki "Bildirimler placeholder" kart kaldırıldı; yerine **Faz 13 widget'ı** geldi: 4 KPI + son loglar listesi + "Gerçek Telegram: KAPALI" notu.

Eski `recent_notifications` ctx'i de korunuyor (geriye uyum için).

---

## 8. Yetki Matrisi

| Rol | Logları gör | Dashboard | Dry-run | Suppress/Cancel/Ready | Telegram simülasyon | Gerçek gönderim |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| viewer (`goruntuleyici`) | ✅ list (read-only) | ✅ | ❌ 403 | ❌ | ❌ | ❌ |
| muhasebeci | ✅ | ✅ | ❌ 403 | ❌ | ❌ | ❌ |
| muhasebe_muduru / yonetici | ✅ | ✅ | ✅ | ✅ | ✅ (simulation only) | ❌ |
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Faz 13 sınırı) |

`AuditLog`: dry-run, log create, suppress, cancel, ready, telegram-attempt, seed — hepsi yazılıyor.

---

## 9. Test Özeti

`backend/tests/test_phase13.py` — **42 test**, 19 sınıf:

- SeedRulesTest (4) — creates / idempotent / does_not_create_logs / writes_audit
- RuleCrudTest (1)
- RenderTest (1) — token/chat_id render edilmiyor
- CreateLogTest (2) — default dry_run / audit
- DueOverduePayableTest (3) — due / overdue / dedup
- TaskDueTest (1) — today + overdue severity
- SiteDuesTest (1) — **user-facing label "Site Aidatları"** + "Pruva" yok
- PropertyTaxTest (1)
- GuaranteeCommissionTest (1)
- IntegratorCreditTest (1)
- SubscriptionCommitmentTest (1)
- DryRunOrchestratorTest (4) — all categories / viewer 403 / muhasebeci 403 / manager OK
- StateTransitionTest (3) — ready / suppress(reason) / cancel
- TelegramSafeNoopTest (4) — masked + no real_send / suppressed when not allowed / dry_run suppressed / no HTTP
- ViewerCannotDryRunTest (1)
- ManagerCanDryRunTest (1)
- DashboardViewsTest (2) — notifications dashboard + telegram test KAPALI rozeti
- LogActionsHttpTest (1)
- MainDashboardWidgetTest (1) — "Faz 13" + "Bildirim Merkezi" + "KAPALI"
- UiContractTest (3) — yasak terim yok / dark-mode yok / raw chat-id render yok
- NoOpGuardTest (4) — Telegram/SMTP yok / Celery/scheduler yok / `requests`/`urllib` yok / imports → NotificationLog yaratmıyor
- MakemigrationsCleanTest (1)

**Proje toplam: 413 test (önceki 371 + 42).**

---

## 10. Yasaklar Doğrulaması

| Yasak | Durum |
|---|:---:|
| Gerçek Telegram gönderimi | ✅ yok (no-op + SUPPRESSED) |
| `requests` / `urllib` / `http.client` import | ✅ yok |
| `send_mail` / `smtplib` | ✅ yok |
| Celery / APScheduler / cron / BackgroundScheduler | ✅ yok |
| Token/chat_id raw render | ✅ yok (masked_chat_id) |
| Dark-mode (`prefers-color-scheme`) | ✅ yok |
| `Pruva` / `Acme` / `Inter` / `JetBrains` UI sızıntısı | ✅ yok (Site Aidatları) |
| `apps.imports` → NotificationLog yaratımı | ✅ yok |
| Üretim deploy / commit-push | ✅ yapılmadı |
| Kaynak Excel/RAR/PDF değişimi | ✅ yapılmadı |
| Design canvas değişimi | ✅ yapılmadı |

---

## 11. Açık Kalanlar / Production Readiness Önerisi

- **Gerçek Telegram gönderimi:** Ayrı faz konusu. Devreye alma şartları:
  1. Super-admin onayı + dual approval
  2. Bot token environment değişkeninde, hiçbir yerde log'lanmaz
  3. Rate-limit / per-user opt-in (NotificationPreference.telegram_enabled=True)
  4. `real_send_allowed=True` ve `dry_run=False` kapısı
  5. Outbound HTTP yalnız allowlisted host (api.telegram.org)
  6. End-to-end test (mock bot)
- **Scheduler:** Bu MVP manuel dry-run; spec'te cron yok. Faz 14+'te cron yerine "trigger UI" + "manual sweep" yeterli. Eğer otomasyon gelecekse Celery yerine Django Q veya OS-level cron tartışması yapılmalı.
- **PAYMENTS / REGULAR_PAYMENTS / OFFICIAL_PAYMENTS / COMBINED rule'ları:** Eklemek için yalnız `_BUILDERS` dict'ine yeni builder + seed rule yeterli.
- **Email kanalı:** `email_enabled` alanı modelde var ama kanal devrede değil — Faz 13'te scope dışı.
- **Per-user dispatch:** `target_user` filtreleme şu an pasif; `NotificationPreference.muted` runtime check ileride.

---

## 12. Sınırlar (Faz 13 spec teyidi)

- Bu faz **lokal geliştirme + test + rapor** fazıdır.
- Üretim sunucuya bağlanılmadı.
- Commit / push / deploy yapılmadı.
- Telegram gerçek gönderimi YOK.
- SMTP/mail YOK.
- Cron/scheduler YOK.
- Başka proje klasörlerine dokunulmadı.
