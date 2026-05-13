# Faz 11 — Chat Widget / Mesaj Merkezi MVP Raporu

**Tarih:** 2026-05-07
**Statü:** ✅ TAMAMLANDI

## Kapsam

DB-backed (WebSocket / Channels YOK), kayıt-bağlı, görev-bağlı, dosya-ekli kurumsal sohbet altyapısı:
- 5 model (ChatThread, ChatParticipant, ChatMessage, ChatAttachment, ChatEvent — ChatEvent immutable)
- 18 servis fonksiyonu (`apps/chat/services/chat.py`)
- 4 form, 17 URL endpoint, 1 inclusion templatetag (`related_chat_panel`)
- 8 yeni/yenilenen template (message_center / thread_list / thread_form / thread_detail / widget / _object_chat_panel + widget placeholder güncellendi + `chat/center.html` korunuyor)
- 12 domain detay sayfasında chat paneli (PayableItem, Task, PruvaStatement, PropertyTaxInstallment, GuaranteeLetter, GuaranteeCommissionPeriod, SoftwareService, ServiceContract, CreditPackage, Subscription, RegularPaymentProfile, OfficialPaymentProfile)
- Dashboard'da `phase11_chat` mini widget (okunmamış / aktif konu / kayıt-bağlı / görev-bağlı + son 3 konu)
- Görev detayında "Görev için Chat Aç" butonu + bağlı konu paneli
- Document SHA-256 dedup + AuditLog + ChatEvent her mutator'da

## Yeni Modeller

| Model | Notlar |
|---|---|
| `ChatThread` | DIRECT/GROUP/RECORD/TASK/SYSTEM · ACTIVE/ARCHIVED/CLOSED · related_app/model/object_id/title · last_message_at/preview |
| `ChatParticipant` | OWNER/MEMBER/VIEWER · last_read_at · muted · `unique(thread,user)` |
| `ChatMessage` | TEXT/SYSTEM/FILE/EVENT · SENT/EDITED/DELETED · reply_to self FK · sent_at indexed |
| `ChatAttachment` | message + Document FK · `unique(message,document)` |
| `ChatEvent` | 9 event_type · immutable · indexed |

## Migrasyon

`apps/chat/migrations/0002_chatattachment_chatevent_chatparticipant_and_more.py`:
- RunPython `_migrate_legacy_thread_types`: `BIREBIR→DIRECT`, `GRUP→GROUP`, `KAYIT_BAGLI→RECORD` (forward + reverse)
- 3 yeni model + ChatThread yeni alanlar + indexler

## 18 Servis Fonksiyonu

```
create_thread, create_direct_thread, create_record_thread, create_task_thread,
get_or_create_record_thread, get_or_create_task_thread,
add_participant, remove_participant,
send_message, reply_message, soft_delete_message, attach_document_to_message,
mark_thread_read, get_unread_count,
get_user_threads, get_thread_messages, get_threads_for_object,
close_thread, archive_thread, user_can_view_thread
```

Tüm mutator'lar `@transaction.atomic`; ChatEvent + AuditLog yazar.

## URL'ler

`/chat/`, `/chat/threads/`, `threads/new/`, `threads/<pk>/`, `threads/create-for-object/`, `threads/create-for-task/<task_id>/`, `threads/<pk>/send|attach|read|close|archive/`, `messages/<pk>/reply|delete/`, `widget/`, `widget/unread/`, `widget/threads/`, `widget/threads/<pk>/messages/` (JSON poll — WebSocket YOK).

## İzin Modeli

- `can_write` → konu açma + mesaj gönderme (katılımcı olmak şart)
- Owner / `can_approve` / superuser → katılımcı ekle/çıkar + close/archive
- Sender → kendi mesajını silebilir; admin/manager force delete

## Dashboard / Domain Entegrasyon

- 12 detay template'inde `{% related_chat_panel <obj> %}` (Phase 10 task panelinden hemen sonra)
- Görev detayında "💬 Görev için Chat Aç" linki (yetki + non-terminal)
- Dashboard `phase11_chat` ctx + Faz 11 etiketli kart
- `templates/includes/chat_widget_placeholder.html` → gerçek okunmamış sayısı (`chat_unread_count` simple_tag)

## Test

`backend/tests/test_phase11.py` — **43 test** / **9 test sınıfı**:

| Sınıf | Test | İçerik |
|---|---|---|
| ThreadCreateTest | 7 | create + direct dedup + record/task linking + permission |
| ParticipantTest | 3 | add/remove + unique + non-participant view |
| MessageLifecycleTest | 8 | send/reply/soft-delete + permission + archived guard |
| AttachmentTest | 3 | SHA-256 dedup + unique constraint + event |
| ReadUnreadTest | 3 | unread count + mark_read + own message excluded |
| QueryTest | 3 | get_user_threads / get_thread_messages / get_threads_for_object |
| ThreadStateTest | 2 | close + archive |
| PermissionTest | 2 | viewer 403 + writer 302 |
| WidgetEndpointTest | 3 | widget/unread + widget/threads + widget/thread/messages JSON |
| DashboardRenderTest | 1 | Faz 11 kartı render |
| DomainPanelIncludeTest | 2 | PayableItem + Task chat link |
| UiContractTest | 2 | yasak terim + dark-mode yok |
| NoOpGuardTest | 4 | NO WebSocket/Channels · NO Telegram/SMTP · NO celery/scheduler · imports → chat YOK |

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| `python manage.py check` | `0 silenced` |
| `python manage.py makemigrations --dry-run --check` | `No changes detected` |
| Tam test suite | **324/324 PASS** (281 önceki + 43 Faz 11) |

## Yasaklar (Hard Constraints) — Hepsi Kontrol Edildi

- ❌ WebSocket / Channels / Daphne / `channels.routing` — testle doğrulandı
- ❌ Telegram / mail send / smtp — testle doğrulandı
- ❌ Celery / APScheduler / cron — testle doğrulandı
- ❌ Prod deploy / commit / push — yapılmadı
- ❌ `apps.imports` chat üretmiyor — testle doğrulandı

## Sonuç

Faz 11 — Chat Widget / Mesaj Merkezi MVP başarıyla tamamlandı. Seed Design V2 uyumlu, light-only, IBM Plex Sans/Mono. Faz 12 (bildirim alt yapısı) veya Faz 13 (raporlama) için sağlam baseline.
