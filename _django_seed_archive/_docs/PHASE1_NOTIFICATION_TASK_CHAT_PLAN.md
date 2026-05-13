# FAZ 1 — GÖREV / BİLDİRİM / CHAT MİMARİSİ
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

---

## 1. GENEL FELSEFE

3 alt sistem birbirine entegre çalışır:

```
            ┌──────────────────────────────────────────────┐
Tetikleyici │ Cron · Kullanıcı aksiyonu · Sistem olayı     │
            └──────────────┬───────────────────────────────┘
                           ↓
                  ┌──────────────────┐
                  │ NotificationRule │
                  └────────┬─────────┘
                           ↓
       ┌───────────────────┴───────────────────┐
       ↓                                       ↓
  Görev üretimi                      Bildirim üretimi
  (apps.tasks.Gorev)                 (apps.notifications.NotificationLog)
       ↓                                       ↓
  Atanan kullanıcı                  Dashboard / Telegram (3 aşamalı kapı)
       ↓
  Görev tamamlanınca → bağlı kayıt audit + (opsiyonel) Bildirim
```

**Polimorfik bağ:** Görev, Chat ve Bildirim her biri `(bagli_app, bagli_model, bagli_id)` ile herhangi bir kayda bağlanabilir.

---

## 2. GÖREV (TASK) MİMARİSİ

### 2.1 Model
PHASE1_DATA_MODEL_PLAN.md J. bölümü. Özet:
- `Gorev`, `GorevYorumu`, `GorevEki`, `GorevGecmisi`, `GorevSablonu`.

### 2.2 Otomatik Görev Üretimi
```python
# apps/tasks/services/auto_creator.py
def auto_create_tasks():
    """Cron 00:30 — gece görev üretici."""
    for sablon in GorevSablonu.objects.filter(aktif=True):
        rule = sablon.tetikleyici_kural
        # örn: {"tip": "T_MINUS_DAYS", "alan": "son_odeme_tarihi", "gun": 7}
        target_qs = build_target_queryset(sablon, rule)
        for obj in target_qs:
            existing = Gorev.objects.filter(
                sablon=sablon,
                bagli_app=obj._meta.app_label,
                bagli_model=obj._meta.model_name,
                bagli_id=obj.id,
            ).exists()
            if not existing:  # idempotency
                Gorev.objects.create(...)
```

**Idempotency anahtarı:** `(sablon, bagli_app, bagli_model, bagli_id, donem_yyyymm?)`.

### 2.3 Görev Şablonları (seed)
| Şablon | Tetikleyici | Atanan |
|---|---|---|
| Fatura T-3 ödeme | `son_odeme_tarihi - 3 gün` | Atanan muhasebeci (modüle göre) |
| SiteX ekstre indir | `ayın 17'si` | Atanan muhasebeci |
| SiteX aidat öde T-3 | `son_odeme_tarihi - 3 gün` | Atanan muhasebeci |
| Emlak 1.taksit T-15 | Mayıs 15 | Müdür |
| Emlak 2.taksit T-15 | Kasım 15 | Müdür |
| Teminat komisyon T-7 | `donem_baslangic - 7 gün` | Müdür |
| BAĞKUR aylık T-3 | Ay sonu - 3 | Atanan |
| İTO 1.taksit T-15 | 15 Haziran | Müdür |
| İTO 2.taksit T-15 | 16 Ekim | Müdür |
| Sözleşme bitiş T-60 | `bitis_tarihi - 60 gün` | Yönetici |
| Kontör eşik altı | `bakiye < kritik_esik` | Atanan |
| Eksik dekont | Ödeme var, dekont yok, tutar > eşik | Atanan |
| Geciken görev günlük özet | 09:00 | Yönetici (toplu) |
| Tamamlanmamış günlük | 17:30 | Atanan kullanıcı |

### 2.4 Görev Durumları
`YENI → BASLADI → BEKLIYOR → ERTELENDI → TAMAMLANDI / IPTAL`.
- Erteleme: yeni tarih + sebep zorunlu, audit'lenir.
- Tamamlama: bağlı kayıt için zorunlu işlem (örn. dekont) varsa "Önce dekont yükleyin" uyarısı.

### 2.5 Yorumlar / Dosya / Geçmiş
- `GorevYorumu`: zaman + kullanıcı + metin + `@mention` (auto-link).
- `GorevEki`: `Belge` referansı.
- `GorevGecmisi`: her aksiyon (atama, durum, erteleme, yorum, ek) loglanır → drawer'da timeline.

### 2.6 Kayıt Bağlantılı Görev
Bir kaydın detay sayfasında (Frame 06 vs.) "Görevler" tab'ı:
```python
related_tasks = Gorev.objects.filter(
    bagli_app=record._meta.app_label,
    bagli_model=record._meta.model_name,
    bagli_id=record.id,
    is_active=True,
)
```

---

## 3. BİLDİRİM (NOTIFICATION) MİMARİSİ

### 3.1 Model
- `NotificationRule` (kural tanımı)
- `NotificationLog` (her üretim — kullanıcı görür)
- `NotificationDeliveryAttempt` (kanal başına gönderim denemesi)
- `TelegramKonfig` (singleton — bot token + mode)
- `TelegramKanal` (kanal listesi — Muhasebe Grubu / Yönetici Grubu / Test)

### 3.2 4 Aşamalı Kapı (Anayasa Madde 8)

```
┌────────────────────────────────────────────────────────┐
│ 1. SISTEM_ICI    [her zaman aktif] — Dashboard widget  │
│ 2. NOTIFICATION_LOG + DRY_RUN  [admin görür]           │
│ 3. TELEGRAM_TEST [Super Admin onayı]                   │
│ 4. TELEGRAM_GERCEK [KAPALI default]                    │
└────────────────────────────────────────────────────────┘
```

```python
# apps/notifications/services/dispatcher.py
def dispatch(rule, target, context, user):
    log = NotificationLog.objects.create(
        rule=rule, hedef_app=target._meta.app_label,
        hedef_model=target._meta.model_name, hedef_id=target.id,
        kullanici=user, mesaj_baslik=..., mesaj_govde=...,
        kanal=SISTEM_ICI, durum=GONDERILDI,
    )

    # 2. NotificationLog (zaten oluşturuldu)
    # 3. Dry-run (TelegramKonfig.mod=DRY_RUN ise simulate)
    if TelegramKonfig.get_solo().mod >= DRY_RUN:
        produce_telegram_dry_run(log)
    # 4. Test (mod=TEST ise test kanalına gönder)
    if TelegramKonfig.get_solo().mod >= TEST:
        send_to_telegram(log, kanal="test")
    # 5. Gerçek (mod=GERCEK ise üretim kanalına)
    if TelegramKonfig.get_solo().mod == GERCEK:
        send_to_telegram(log, kanal=resolve_kanal(rule, target))
```

### 3.3 Bildirim Kuralları (seed)
PHASE1_IMPORT_ARCHITECTURE_PLAN.md / Anayasa Madde 8.2 tablosu uygulanır.

Tetikleyici tipleri:
- `T_MINUS_DAYS` (T-N gün)
- `DAY_OF_MONTH` (ayın N'i)
- `THRESHOLD` (örn. kontör <500)
- `STATE_CHANGE` (durum değişikliği)
- `EVENT` (sistem olayı, örn. import commit hatası)

### 3.4 Delivery Attempt + Retry
```python
class NotificationDeliveryAttempt:
    log = FK
    deneme_no = Integer  # 1, 2, 3
    kanal = enum
    sonuc = enum (SUCCESS/FAILED/PENDING)
    hata_mesaji = Text null
    zaman = DateTime
```

Telegram FAILED → exponential backoff: 1 dk, 5 dk, 15 dk → 3 deneme sonra durum=BASARISIZ + alert.

### 3.5 Telegram Bot Token Güvenliği
- `TelegramKonfig.bot_token`: encrypted (django-fernet-fields, master key env'den).
- Token değişikliği → AuditLog kritik.
- Token rotasyonu yıllık (LATER).

### 3.6 Mode Geçişleri (Faz 12)
```
DRY_RUN (default Faz 1-11) → TEST (Super Admin onayı) → GERCEK (çift onay + Yönetici onay + zaman damgası)
```

Mode değişikliği:
1. Super Admin "Telegram Modu Değiştir" butonu.
2. Confirmation modal: "Bu işlem audit'lenir. Devam?"
3. Çift onay: 5 dk içinde Yönetici de onaylamalı (LATER).
4. AuditLog kritik kayıt.

### 3.7 Kullanıcı Bildirim Tercihleri
- Profil → Bildirim Ayarları.
- Kanal × tip matrisi (Sistem içi / E-posta / Telegram).
- Sustur listesi (kayıt bazlı `NotificationMute(user, hedef_app, hedef_model, hedef_id, end_date)`).

---

## 4. CHAT MİMARİSİ (MVP-3 — Faz 11)

### 4.1 Model
- `ChatThread`, `ChatParticipant`, `ChatMessage`, `ChatAttachment`, `ChatReadState`.
- Thread tipleri: `BIREBIR / GRUP / KAYIT_BAGLI`.

### 4.2 Real-time
- **Django Channels** + Redis pubsub.
- WebSocket consumer: `apps/chat/consumers.py`.
- Mesaj gönderim: HTTP POST veya WS (her ikisi de desteklenir).
- Online indicator: Redis presence (key TTL 30 sn).
- Typing indicator: WS event (TTL 5 sn).

### 4.3 Yetki
- Bir kullanıcı sadece üye olduğu thread'leri görür (ChatParticipant join).
- Kayıt-bağlantılı thread: bağlı kayda erişim yetkisi olanlar görebilir (object-level perm Faz 11+).
- Thread'den çıkma: AuditLog'a yazılır.

### 4.4 Kayıt Bağlantılı Chat
```python
def get_or_create_record_thread(record, user):
    """Bir kayıt için thread döndürür, yoksa oluşturur."""
    thread, created = ChatThread.objects.get_or_create(
        tip=KAYIT_BAGLI,
        bagli_app=record._meta.app_label,
        bagli_model=record._meta.model_name,
        bagli_id=record.id,
        defaults={"olusturan": user, "baslik": f"{record}"},
    )
    if created:
        # Otomatik katılımcı: kayıtta yetkisi olan herkes
        for u in resolve_record_viewers(record):
            ChatParticipant.objects.create(thread=thread, kullanici=u)
    return thread
```

### 4.5 Widget vs Mesaj Merkezi
- **Widget (sağ alt collapsed):** her sayfada inline, expanded 360×500 popup.
- **Mesaj Merkezi:** `/mesajlar/` route — full screen (sol thread + orta mesaj + sağ context).
- Mobile: widget yerine FAB → tıklanınca tam ekran chat (Frame 25).

### 4.6 Mention
- `@kullanici_adi` autocomplete (typeahead).
- Mention edilen kullanıcı için: `NotificationLog(kanal=SISTEM_ICI)` + (Faz 12) Telegram.

### 4.7 Okundu / İletildi
- `ChatReadState(message, user, zaman)` — kullanıcı mesajı görüntüleyince yazılır.
- UI: tek tik (gönderildi), iki tik gri (iletildi - alıcının cihazına ulaştı), iki tik mavi (okundu).

### 4.8 Dosya Eki
- `ChatAttachment(message FK, belge FK→Belge)`.
- Drag-drop + browse.
- Maks 25 MB.
- Resim/PDF inline preview.

### 4.9 Arşiv
- 1 yıldan eski thread'ler arşive alınabilir (LATER).
- Mesaj silme: soft-delete (`silindi=True`); orijinal "Bu mesaj silindi" gösterilir.

---

## 5. ENTEGRASYON ÖRNEKLERİ

### 5.1 SiteX ödeme akışı
1. Cron 00:30 — `auto_create_tasks` → "SiteX A4.17 ödeme T-3" görevi (bağlı `SiteXEkstre`).
2. Aynı anda `dispatch(rule="pruva34_t3", target=ekstre)` → `NotificationLog(SISTEM_ICI)` + dry-run Telegram.
3. Atanan muhasebeci (Ayşe) görevi görür → ödeme yapar → `Odeme.objects.create()` + `mark_paid()`.
4. Görev kartında "Tamamla" → `Gorev.durum=TAMAMLANDI` + `SiteXEkstre.durum=ODENMIS`.
5. AuditLog: `record_audit(ayse, ekstre, "PAYMENT_MARKED")`.
6. Yöneticiye günlük 09:00 özet bildirimi: "1 SiteX ödemesi tamamlandı".

### 5.2 Teminat komisyon T-7
1. Cron sabah → `dispatch(rule="teminat_komisyon_t7", target=mektup)`.
2. Müdür dashboard'da "Komisyon Yaklaşan" risk kartı görür.
3. Görev: "Albaraka 71-D8-3842 komisyon ödemesi T-7" (Erdal'a atanır).
4. Ödeme yapılınca → `TeminatKomisyonOdemesi.durum=ODENDI` + `Odeme` bağlanır.
5. (Faz 12) Telegram: gerçek mod açık ise Müdür kanalına özet.

### 5.3 Kayıt-bağlantılı chat (örnek SiteX mutabakat)
1. Ayşe SiteX A4.17 / 2026-05 ekstre detay sayfasında.
2. "Aidat farkı 1.864 TL" gördü → "💬 Chat Aç" butonu → `get_or_create_record_thread(ekstre)`.
3. Chat widget açılır, başlık: "📎 SiteX / A4.17 / 2026-05 Ekstre".
4. Müdür (otomatik katılımcı) bildirim alır → cevap yazar.
5. Mesajlaşma → karara bağlanır → `SiteXAidatFarki(durum=MUTABIK)`.
6. Thread otomatik kapanmaz; gelecekteki mutabakatlarda da aynı thread'de devam eder.

---

## 6. PERFORMANS HEDEFLERİ

| İşlem | Hedef |
|---|---|
| Görev kart render (50 görev) | <500 ms |
| Bildirim üretim (1 kural × 100 hedef) | <2 sn |
| Telegram dispatch (10 mesaj) | <5 sn |
| Chat mesaj WS latency | <200 ms |
| Cron auto_create_tasks (tüm şablonlar) | <30 sn |

---

## 7. RİSKLER

| # | Risk | Mitigasyon |
|---|---|---|
| R1 | Cron duplicate görev üretimi | `(sablon, bagli, donem)` natural key + idempotency check |
| R2 | Telegram yanlış kanala spam | 4 aşamalı kapı + `mod=GERCEK` Super Admin only |
| R3 | Chat WebSocket scale (100+ eşzamanlı) | Channels + Redis pub/sub yeterli MVP-3 |
| R4 | Bildirim flood (kullanıcı yorgunluk) | Sustur listesi + günlük özet birleşik |
| R5 | Mesaj silindi → audit kaybı | Soft-delete; orijinal AuditLog'a yazılır |
| R6 | Mention edilen kullanıcı yetkisiz | Mention çözümleme + yetki kontrolü, yetkisizse görmez |

---

**SON.** Faz 10 (Görev), Faz 11 (Chat), Faz 12 (Bildirim/Telegram) bu planı izler.
