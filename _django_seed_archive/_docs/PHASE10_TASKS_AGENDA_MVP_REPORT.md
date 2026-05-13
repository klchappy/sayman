# Faz 10 — Ajanda / Görev Yönetimi + Dashboard Uyarıları MVP Raporu

**Statü:** ✅ TAMAMLANDI
**Tarih:** 2026-05-07
**Kapsam:** Sistemi kayıt-takip aracından **ajanda/görev sürücülü muhasebe operasyon platformuna** dönüştüren manual-first MVP.
**Anayasa Maddesi:** 1.5 (izolasyon) · 3.4 (commit yok) · 3.8 (soft-delete) · 11 (DESIGN_FREEZE) · UI Identity Reset baseline.
**Test:** `python manage.py check` ✅ · `makemigrations --dry-run --check` → `No changes detected` ✅ · **281/281 PASS** (önceki 248 + 33 yeni Faz 10 testi).

---

## 1. Hedef

Faz 10'un tek cümlelik amacı: muhasebe operasyon ekibinin tüm açık iş yükü (kim, ne yapacak, ne zamana kadar, hangi domain kaydına bağlı) tek noktadan görülecek; yaşam döngüsü değişmez bir log'a düşecek; dashboard yalnız KPI değil, **bugünkü görevler / gecikmeler / kritik öncelikler** için bir alarm panosu olacak.

Faz 12 (bildirim/Telegram) ve cron/scheduler bu fazın **dışında** — Faz 10 yalnız domain modelleri + servisler + UI + audit.

---

## 2. Yeni & Genişleyen Modeller

| Model | Özellik | Notu |
|-------|--------|------|
| **Task** (zenginleştirildi) | title, description, assigned_to, created_by, priority(LOW/NORMAL/HIGH/CRITICAL), status(OPEN/IN_PROGRESS/WAITING/POSTPONED/COMPLETED/CANCELLED), source(MANUAL/SYSTEM/IMPORT/OTHER), due_date, due_time, completed_at, completed_by, postponed_until, cancelled_at, cancelled_by, related_app/model/object_id/title | Eski enum (NEW/DEFERRED/DONE/URGENT) **veri kaybetmeden** migration ile dönüştürüldü. |
| **TaskComment** | task, author, body, is_system | Erteleme/iptal sebepleri otomatik sistem yorumu olarak düşüyor. |
| **TaskAttachment** | task, document(FK→Document), uploaded_by | UniqueConstraint(task, document); SHA-256 dedup `Document.get_or_create_from_file` üzerinden. |
| **TaskEvent** | task, event_type(10), actor, summary, metadata(JSON), created_at | Değişmez yaşam döngüsü log'u — her mutator yazar. |

```python
class TaskEventType(TextChoices):
    CREATED, UPDATED, ASSIGNED, STATUS_CHANGED, POSTPONED,
    COMPLETED, CANCELLED, REOPENED, COMMENTED, ATTACHMENT_ADDED
```

### Migration

`apps/tasks/migrations/0002_phase10_tasks_enrichment.py`:
- 3 yeni model oluşturuldu.
- Task'a 9 yeni alan eklendi.
- 11 alan AlterField ile yeni semantik altına alındı.
- 2 yeni Index eklendi (status+due_date, related triplet).
- **RunPython data migration** mevcut kayıtları taşır:
  `NEW→OPEN, DEFERRED→POSTPONED, DONE→COMPLETED, URGENT→CRITICAL`.
- Reverse fonksiyonu da tanımlı (idempotent geri alma).
- Yan etki: `apps.dashboard.views`'de `status="DONE"` referansı `"COMPLETED"` ile, dashboard template'ında `URGENT` referansı `CRITICAL` ile güncellendi.

---

## 3. Servisler (`apps/tasks/services/tasks.py`)

16 fonksiyon. **Hepsi** AuditLog + TaskEvent yazar; tümü `@transaction.atomic`; semantik invariant'lar `ValidationError` ile zorlanır.

| Fonksiyon | Davranış |
|----------|----------|
| `create_task(...)` | OPEN durumunda yeni görev — boş başlık reddedilir; assigned_to varsa ASSIGNED event. |
| `update_task(task, **fields)` | Beyaz liste alanları (title, description, priority, due_date, due_time, related_title) — terminal görev reddedilir. |
| `assign_task(task, assignee)` | Atama değişimi → ASSIGNED event; idempotent. |
| `change_status(task, new_status)` | Generic geçiş — terminal'den geçiş yasak (reopen kullanılır). |
| `start_task(task)` | OPEN/WAITING → IN_PROGRESS. |
| `postpone_task(task, postponed_until, reason)` | due_date'i ileri al, status=POSTPONED. Tarih bugün/öncesiyse `ValidationError`. Sebep verilirse system comment. |
| `complete_task(task)` | Çift-tamamlama yasak; iptal görev tamamlanamaz; completed_at + completed_by yazar. |
| `cancel_task(task, reason)` | Approve role kontrolü view katmanında; tamamlanan iptal edilemez. |
| `reopen_task(task)` | Sadece COMPLETED/CANCELLED → OPEN; terminal alanları temizler. |
| `add_comment(task, body)` | Boş yorum reddedilir; COMMENTED event. |
| `attach_document(task, file/document)` | İki mod: dosya yükleme (SHA-256 dedup) veya mevcut Document bağla. UniqueConstraint(task, document). |
| `create_task_for_object(obj, ...)` | Generic relation ile bağlı görev. |
| `get_tasks_for_object(obj, include_terminal=False)` | Aktif (veya tüm) bağlı görevler. |
| `get_today_tasks_for_user(user)` | Bugün vadeli + geciken aktif görevler. |
| `get_overdue_tasks(user=None)` | due_date < today + aktif. |
| `get_upcoming_tasks(user=None, days=7)` | due_date ∈ [today, today+days] + aktif. |

**NO Telegram/SMTP/cron/Celery import.** Test (`TaskNoOpGuardTest`) bunu güvence altına alır.

---

## 4. Form / View / URL

### Forms (`apps/tasks/forms.py`)
1. `TaskForm` (ModelForm: title, description, assigned_to, priority, due_date, due_time)
2. `TaskStatusForm` (manuel status değişimi)
3. `TaskPostponeForm` (postponed_until + reason)
4. `TaskCommentForm` (body)
5. `TaskAttachmentForm` (file + opsiyonel title)

### URLs (17 endpoint, `apps/tasks/urls.py`)
- `tasks:list` `tasks:today` `tasks:upcoming` `tasks:overdue`
- `tasks:assigned_to_me` `tasks:created_by_me`
- `tasks:create` `tasks:create_for_object`
- `tasks:detail` `tasks:edit`
- `tasks:start` `tasks:postpone` `tasks:complete` `tasks:cancel` `tasks:reopen`
- `tasks:comment` `tasks:attach`

### Permission Patternları
- **WriteMixin** (UserPassesTestMixin + `can_write`) — create / edit / start / postpone / attach.
- **ApproveMixin** (`can_approve`) — cancel / reopen.
- **TaskCompleteView**: yazma yetkisi VEYA atanan kişi (`assigned_to == request.user`) — personel rolü kendi görevini tamamlayabilir.
- Görüntüleyici: yalnız okuma.

### Admin
4 model için ayrı ModelAdmin; TaskEvent salt-okunur; Task'ta completed_/cancelled_ alanları read-only.

---

## 5. Templates (Seed Design V2)

`backend/templates/tasks/`:
- `task_list.html` — filtre barı (status/priority/atama) + öncelik renkli rozetler + ⚠ gecikme bayrağı + üst hızlı navigasyon (Bugün/Gecikmiş/Yaklaşan/Bana/Oluşturduğum).
- `task_today.html` — 3 kart: Geciken / Bugünkü / Yaklaşan(7g).
- `task_form.html` — yeni / düzenleme; bağlı kayıt info bandı.
- `task_detail.html` — durum/öncelik rozetleri, aksiyon butonları (Başlat / Tamamla / Ertele / İptal / Yeniden Aç / Düzenle), erteleme formu, yorum listesi + form, belge listesi + upload, son 30 olay.
- `_object_tasks_panel.html` — domain detay sayfaları için reusable include partial.

Tüm template'ler IBM Plex / light-only / yasak kelime testlerini geçer.

---

## 6. Dashboard Entegrasyonu

`apps/dashboard/views.py` + `templates/dashboard/home.html`:
- "Bugünkü Görevlerim" kartı yeni status/priority enum'una geçti (`CRITICAL` rengi `danger`).
- Kart altına 3'lü mini KPI grid eklendi: **Bugün / Geciken / Kritik**.
- `phase10_tasks` ctx: today_count, overdue_count, upcoming_count, critical_count, assigned_to_me_count, recent_events.
- `tamam` KPI hesabı: `status="DONE"` → `status="COMPLETED"` migration sonrası geçerli.

---

## 7. Domain Entegrasyonu

`apps/tasks/templatetags/tasks_tags.py` → `{% related_tasks_panel obj %}` inclusion tag.

11 detay sayfasına eklendi:

| App | Template | Variable |
|-----|----------|----------|
| finance | payable_detail.html | payable |
| subscriptions | subscription_detail.html | subscription |
| regular_payments | profile_detail.html | profile |
| official_payments | profile_detail.html | profile |
| pruva | statement_detail.html | statement |
| properties | installment_detail.html | installment |
| guarantees | guarantee_detail.html | guarantee |
| guarantees | commission_period_detail.html | period |
| integrators | service_detail.html | service |
| integrators | contract_detail.html | contract |
| integrators | credit_package_detail.html | package |

Her detay sayfası artık:
1. Bağlı aktif görevleri gösterir.
2. "+ Görev Oluştur" linki: `tasks:create_for_object?app=…&model=…&object_id=…&related_title=…&title=…` — başlık prefilled, generic relation otomatik dolu.

`TaskDomainPanelIncludeTest` 11 dosyada `{% load tasks_tags %}` + `{% related_tasks_panel %}` varlığını doğrular.

---

## 8. Test Sonucu

| Suite | Test |
|-------|------|
| Önceki (Faz 1–9 + UI Identity Reset) | 248 |
| **Faz 10 (yeni)** | **33** |
| **TOPLAM** | **281** |

```
Ran 281 tests in 203.195s — OK
```

### Faz 10 test dağılımı

| Sınıf | Test |
|-------|------|
| `TaskLifecycleTest` | 11 (create + invalid title + start/complete + double-complete + cancel-then-complete + postpone validation + postpone happy + reopen + reopen-only-terminal + assign + update) |
| `TaskCommentAttachmentTest` | 4 (comment event + empty comment + sha-256 dedup + idempotent attach) |
| `TaskQueryTest` | 3 (today / overdue / upcoming) |
| `TaskGenericRelationTest` | 2 (create_for_object + filter active) |
| `TaskPermissionTest` | 5 (viewer-no-create + writer-can + assignee-complete + viewer-no-complete + only-approve-can-cancel) |
| `TaskDashboardRenderTest` | 1 (widget render) |
| `TaskUiContractTest` | 2 (list + today render + Pruva/Acme sızıntısı yok) |
| `TaskNoOpGuardTest` | 3 (no telegram/smtp/celery + no apscheduler/crontab + imports tasks bağımsız) |
| `TaskDomainPanelIncludeTest` | 1 (11 detay sayfası panel include) |
| **TOPLAM** | **33** |

### NO-OP / negatif kontroller

- `python manage.py makemigrations --dry-run --check` → `No changes detected`.
- `apps.imports.services` modülünden `apps.tasks` importu yok (test ile doğrulanır) — import commit Task üretmez.
- `apps.tasks.services.tasks` kaynağında `send_mail`, `smtp`, `telegram_bot`, `python-telegram`, `telebot` yok.
- `apps.tasks/**` altında `celery`, `apscheduler`, `crontab(` yok.
- UI Identity Reset (Faz 9 sonrası) kontrat testleri (forbidden-terms / IBM Plex / Inter-JetBrains-dark mode / OPS render) PASS — Faz 10 yeni dosyaları yasak kelime taramasından geçer.

---

## 9. Anayasa / Sınır Teyitleri

| Sınır | Durum |
|-------|-------|
| Yalnız `apps/tasks` + dashboard widget + 11 detail include + tek dashboard view satırı dokunuldu | ✅ |
| Migration + RunPython geri alınabilir | ✅ |
| AuditLog + TaskEvent her mutator'da yazılır | ✅ |
| Telegram / SMTP / mail / cron / scheduler / WebSocket chat kodu YOK | ✅ |
| Import commit davranışı değişmedi (`apps.imports` patch'lenmedi) | ✅ |
| Kaynak Excel / RAR / PDF / design canvas dosyalarına dokunulmadı | ✅ |
| OPS kimliği korundu (Acme/KE/HES/Santral/Yenice/Kısık/üretim/Pruva yok) | ✅ |
| Light-only + IBM Plex + Inter/JetBrains/dark-mode YOK | ✅ |
| Commit / push / deploy yok | ✅ |
| 248 önceki test → 281 (sıfır regresyon) | ✅ |

---

## 10. Açık Kalanlar

- Faz 11 (Belge yaşam döngüsü tamamlama) ile TaskAttachment'ın Document yaşam döngüsüne bağlanması derinleştirilebilir.
- Faz 12 (Bildirim & Telegram) açıldığında: `complete_task / postpone_task / cancel_task` event'leri NotificationLog'a yazılabilir; gerçek Telegram gönderimi şu an `OFF`.
- Otomatik T-3 / T-7 / T-15 görev üretimi — tetikleyici (cron) Anayasa'ya ek izin ile Faz 12+ kapsamında. Bu MVP yalnız manuel + `create_task_for_object` üzerinden.
- "Kanban panosu" UX iyileştirmesi (drag-drop) Faz 13+ raporlama ile birlikte değerlendirilebilir.

---

## 11. Sonuç

Faz 10 tamamlandı. Sistem artık ajanda/görev sürücülü: her domain kaydı → "+ Görev Oluştur" link'i ile ekibe iş yükü olarak çekilebilir, atama yapılabilir, ertelenebilir, tamamlanabilir; yaşam döngüsü TaskEvent + AuditLog'a düşer; dashboard bugün/geciken/kritik için canlı sayaçlar gösterir. Seed Design V2 kimliği bozulmadı; 281/281 test PASS; sıfır regresyon.

**FİNAL KARAR: FAZ 10 PASS — Faz 11 (Belge yaşam döngüsü) öncesi sağlam baseline.**
