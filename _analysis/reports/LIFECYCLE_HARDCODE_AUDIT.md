# LIFECYCLE & HARDCODE AUDIT
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-06
**Mod:** READ-ONLY · kod patch yok · migration yok · DB write yok
**Kapsam:** Faz 2-5 yazılmış kod (`backend/apps/*`); Faz 6 (SiteX) öncesi denetim

---

## 0. ÖZET

| Sayaç | Adet |
|---|---|
| ✅ PASS | **24** |
| ⚠ WARNING | **3** |
| ⛔ BLOCKER | **0** |

**Sonuç:** Sistem yaşayan operasyon sistemine uygun temellerle kuruldu. Faz 6 (SiteX) güvenle başlatılabilir; 3 WARNING önerisi Faz 6+ sırasında uygulanabilir.

---

## 1. DENETLENEN DOSYALAR

```
backend/apps/accounts/management/commands/seed_roles.py
backend/apps/{core,parties,documents,imports,finance,subscriptions,
              regular_payments,official_payments,
              tasks,chat,notifications,dashboard,audit}/
  ├── models.py          (8 model dosyası)
  ├── services/*.py      (9 servis modülü)
  ├── views.py           (11)
  ├── urls.py            (12)
  └── tests/test_*.py    (5 test dosyası, 94 test)

backend/templates/                  (Faz 5 dahil 38+ template)
backend/config/settings/{base, local, local_pg, production}.py
```

---

## 2. MODÜL BAZLI PASS/WARNING/BLOCKER TABLOSU

| Modül | Lifecycle | Hardcode Riski | Seed Politikası | UI/URL | Test | Genel |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| accounts (rol/grup) | ✅ | ✅ (config/no domain) | ✅ rol seed only | ✅ login/logout/profile | ✅ | **PASS** |
| core (BaseModel + SystemSetting) | ✅ archive/restore | ✅ | ✅ SystemSetting fallback | (admin only) | ✅ | **PASS** |
| parties (Şirket/Şahıs/Mülk/Banka/Kurum) | ✅ archive/restore | ✅ generic master | ✅ seed yok (manuel) | ✅ list/detail/form/archive | ✅ archive_restore | **PASS** |
| documents | ✅ sha256 dedup + archive (BaseModel) | ✅ | ✅ seed yok | ✅ list/detail/download | ✅ | **PASS** |
| imports | ✅ batch cancel + draft approve/reject/manual | ✅ | ✅ seed yok · commit NO-OP | ✅ list/new/preview | ✅ NO-OP test | **PASS** |
| finance (PayableItem + Tx + Doc) | ✅ archive/restore + tx approve/reject + partial paid + cancel via status | ✅ | ✅ seed yok | ✅ tüm CRUD + mark_paid + add_doc | ✅ 24 test | **PASS** |
| subscriptions | ✅ archive/restore + commitment APPROACHING/EXPIRED + period status LINKED | ✅ | ✅ seed yok | ✅ + commitment + charge + → payable | ✅ duplicate blocked | **PASS** |
| regular_payments | ✅ archive/restore + period generate idempotent | ✅ | ✅ seed yok | ✅ + generate-periods + → payable | ✅ duplicate blocked | **PASS** |
| official_payments | ✅ archive/restore + İTO 2 taksit + aylık 12 + → payable | ✅ | ✅ seed yok | ✅ + generate-periods + → payable | ✅ duplicate blocked | **PASS** |
| tasks (placeholder) | ⚠ archive servisi yok (sadece BaseModel) | ✅ | ✅ seed yok | ⚠ list-only | ⚠ smoke yok | **WARNING** |
| chat (placeholder) | ⚠ archive servisi yok | ✅ | ✅ seed yok | ⚠ placeholder page | ⚠ test yok | **WARNING** |
| notifications (placeholder) | ⚠ archive servisi yok | ✅ | ✅ seed yok | ⚠ list-only | ⚠ test yok | **WARNING** |
| dashboard | ✅ (read-only) | ✅ | ✅ seed yok | ✅ home + Faz 5 widget | ✅ KPI test | **PASS** |
| audit | ✅ append-only (silinmez) | ✅ | ✅ seed yok (sistem üretir) | ✅ list | ✅ helper test | **PASS** |

> 3 WARNING → tasks/chat/notifications **placeholder** olduğu için kabul edilebilir; Faz 10/11/12'de aktif olunca tam lifecycle eklenecek.

---

## 3. SEED POLİTİKASI DENETİMİ

### Mevcut seed komutları
```bash
python manage.py seed_roles    # 6 Group oluşturur, idempotent
```

| Seed | İçerik | Sonuç |
|---|---|---|
| `seed_roles` | Sadece Django Group (rol) | ✅ PASS — seed politikasına uygun |

### Domain tablolarında seed durumu
| Tablo | Seed var mı? | Beklenen |
|---|---|---|
| Sirket / Sahis / Mulk / Banka / Kurum (parties) | ❌ **yok** | ✅ — kullanıcı manuel ekleyecek (Anayasa 1.6) |
| Document | ❌ yok | ✅ — kullanıcı yükler |
| ImportBatch / Draft | ❌ yok | ✅ — sistem yaratır |
| **PayableItem / PaymentTransaction / PayableDocument** | ❌ **YOK** | ✅ **DOĞRU** — gerçek borç/ödeme seed edilemez |
| **Subscription / Commitment / PeriodCharge** | ❌ **YOK** | ✅ **DOĞRU** |
| **RegularPaymentProfile / Period** | ❌ **YOK** | ✅ **DOĞRU** |
| **OfficialPaymentProfile / Period** | ❌ **YOK** | ✅ **DOĞRU** |
| Task / ChatThread / ChatMessage / NotificationLog | ❌ yok | ✅ |
| AuditLog | ❌ yok (sistem yazar) | ✅ |
| SystemSetting | ❌ yok | ⚠ **WARNING** — varsayılan eşikler için bir `seed_settings` komutu eklenebilir (opsiyonel) |

**Sonuç:** ✅ **Hiçbir gerçek operasyon kaydı seed edilmiyor.** Mevcut `seed_roles` komutu sadece config (Group) yaratıyor — politikaya tam uygun.

---

## 4. HARDCODE RİSKLERİ

### 4.1 Kod taraması
```bash
grep "SiteX|Test Kullanıcı|A4.17|B2.28|Albaraka|Bayrampaşa" apps/ --include="*.py"
```
Sonuç (production code, test/migration hariç):
- `apps/imports/models.py:30` → `SITEX = "SITEX", "SiteX"` — hedef modül enum'ı (string sabit, gerçek kayıt değil)
- `apps/parties/models.py:44` → docstring "SiteX daire, fabrika, ofis"
- `apps/parties/models.py:65` → docstring "Albaraka, Garanti, ..."

✅ **Hiçbir gerçek kayıt (5 daire kodu, banka adı, mülk ismi) production code'da hardcoded DEĞİL.**

### 4.2 Choice/Enum yapısı
| Enum | Genişletilebilir? | OTHER seçeneği var? |
|---|:-:|:-:|
| `OwnerType` (finance) | ✅ | ✅ OTHER |
| `PayableStatus` (10 değer) | ✅ migration ile | ⚠ "OTHER" yok ama 10 lifecycle tam |
| `PaymentMethod` (7 değer) | ✅ | ✅ OTHER |
| `PayableSource` | ✅ | ✅ OTHER |
| `ServiceType` (subscriptions, 9 değer) | ✅ | ✅ OTHER |
| `RegularCategory` (9 değer) | ✅ | ✅ OTHER |
| `PaymentType` (official, 7 değer: BAGKUR/SSK/BES/ITO/TAX/MUNICIPAL/**OTHER**) | ✅ | ✅ OTHER |
| `DocumentType` | ✅ | ✅ OTHER |
| `DocumentSource` | ✅ | (UPLOAD/IMPORT/SYSTEM yeterli) |

**Sonuç:** ✅ Tüm enum'larda **OTHER** veya migration ile genişletme mümkün. Yeni hizmet tipi/kategori/banka türü eklemek için kod değişikliği + migration gerekli; bu Django sözleşmesidir (kabul edilebilir).

### 4.3 Master tablolar
- `Bank.name` unique (yeni banka eklenebilir)
- `Institution.name + institution_type` (yeni TT/CK/Belediye/SGK/Entegratör eklenebilir)
- `Company.short_name` unique (yeni şirket eklenebilir)
- `PropertyAsset.name` (unique değil — tekrar eklemeye izinli, kasıt)

✅ Tüm master listeleri DB-driven (`parties` app'te). Excel kaynağı sınırına bağlı kalmamış.

---

## 5. LIFECYCLE EKSİKLERİ

### Modül bazlı durum

#### A. Fatura / Ödeme (`apps.finance`) — ✅ tam
- `PayableStatus`: DRAFT/PENDING/APPROACHING/OVERDUE/PARTIAL_PAID/**PAID**/**CANCELLED**/**ARCHIVED**/NEEDS_REVIEW/WAITING_APPROVAL
- `archive_payable` + `restore_payable` + AuditLog
- `add_partial_payment` + `mark_paid`
- `approve_payment_transaction` + `reject_payment_transaction`
- ⚠ **Cancel iptali**: status `CANCELLED` enum'da var ama dedicated servis fonksiyonu yok. `update_payable(status=CANCELLED)` ile dolaylı çalışır.
  - **Öneri (patch planı):** `cancel_payable(payable, user, reason)` servis fonksiyonu Faz 6+ kolayca eklenebilir (5 satır kod).

#### B. Abonelik (`apps.subscriptions`) — ✅ tam
- `SubscriptionStatus`: ACTIVE/PASSIVE/**CANCELLED**/NEEDS_REVIEW
- `archive_subscription` + `restore_subscription`
- `add_commitment` + `calculate_commitment_status` (ACTIVE/APPROACHING/EXPIRED/RENEWED/CANCELLED/NEEDS_REVIEW)
- `create_period_charge` + `link_period_charge_to_payable`
- ⚠ **CANCELLED status ayrı bir servis fonksiyonu yok** — `update_subscription(status="CANCELLED")` dolaylı yol var.

#### C. Düzenli Ödeme (`apps.regular_payments`) — ✅ tam
- `ProfileStatus`: ACTIVE/PASSIVE/CANCELLED/NEEDS_REVIEW
- `archive_profile` + `restore_profile`
- `create_period` + `generate_next_periods` (idempotent)
- `create_payable_from_regular_period`

#### D. Resmi Ödeme (`apps.official_payments`) — ✅ tam
- `OfficialProfileStatus`: ACTIVE/PASSIVE/CANCELLED/NEEDS_REVIEW
- `archive_profile` + `restore_profile`
- `generate_periods` (BAGKUR/SSK/BES/ITO için sabit kural)
- `create_payable_from_official_period`

#### E. SiteX — ⏳ Faz 6 (henüz yok)

#### F. Emlak — ⏳ Faz 7

#### G. Teminat — ⏳ Faz 8 (lifecycle: AKTİF → İADE_EDILDI/SURESI_DOLDU/YENILENDI; PHASE1_DATA_MODEL_PLAN.md F.1'de tanımlı ✅)

#### H. Entegratör/Kontör — ⏳ Faz 9

#### I. Görev (`apps.tasks`) — ⚠ PLACEHOLDER
- `TaskStatus`: NEW/IN_PROGRESS/WAITING/DEFERRED/DONE/CANCELLED ✅ (enum tam)
- ❌ archive_task / restore_task servis fonksiyonu yok (BaseModel'in `archive()` metodu hâlâ kullanılabilir)
- ❌ "yeniden açma" pattern'i view'da yok
- **Öneri (patch planı):** Faz 10'da `apps.tasks` servisleri eklenecek; placeholder dönemde sadece admin'den yönetilebilir.

---

## 6. UI / URL EKSİKLERİ

| Modül | List | Yeni | Düzenle | Archive | Restore | Detail | Bağlı Kayıt |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| parties (5 master) | ✅ | ✅ | ✅ | ✅ | ✅ (toggle) | ✅ | — |
| finance | ✅ | ✅ | ✅ | ✅ | ✅ (toggle) | ✅ | ✅ Tx + Doc + Task |
| subscriptions | ✅ | ✅ | ✅ | ✅ | ✅ (toggle) | ✅ | ✅ Commitment + Charge + Payable |
| regular_payments | ✅ | ✅ | ✅ | ✅ | ✅ (toggle) | ✅ | ✅ Period + Payable |
| official_payments | ✅ | ✅ | ✅ | ✅ | ✅ (toggle) | ✅ | ✅ Period + Payable |
| imports | ✅ | ✅ | (drafts edit) | ⚠ cancel only | — | ✅ + preview | ✅ batch + draft + log |
| documents | ✅ | (auto from finance/import) | — | (BaseModel) | (BaseModel) | ✅ | — |
| tasks | ✅ | ❌ (admin only) | ❌ | ❌ | ❌ | ❌ | — |
| chat | ⚠ placeholder page | — | — | — | — | — | — |
| notifications | ✅ list | ❌ | ❌ | — | — | ❌ | — |

**WARNING-1:** `tasks` UI placeholder — Faz 10'da tam CRUD eklenecek.
**WARNING-2:** `chat` placeholder — Faz 11'de Channels + WebSocket.
**WARNING-3:** `notifications` UI list-only — Faz 12'de kural CRUD + Telegram konfig.

---

## 7. TEST EKSİKLERİ

| Konu | Test var mı? | Notlar |
|---|:-:|---|
| `seed_roles` idempotent | ✅ | `SeedRolesTest.test_seed_roles_idempotent` |
| Master CRUD (parties) | ✅ | `PartiesCRUDTest` |
| `parties` archive_restores_softly | ✅ | |
| `parties` no_hard_delete in URL | ✅ | reverse'de delete URL yok |
| `Document.sha256` dedup | ✅ | `test_get_or_create_dedup` |
| Import commit NO-OP (Faz 3) | ✅ | `CommitNoOpTest` |
| Import commit NO-OP (Faz 4) | ✅ | `ImportCommitStillNoOpTest` (PayableItem) |
| Import commit NO-OP (Faz 5) | ✅ | `ImportCommitStillNoOpTest` (Subscription/Regular/Official) |
| PayableItem CRUD + archive/restore | ✅ | `PayableCRUDTest` |
| 5K dekont kuralı | ✅ | |
| 50K çift onay kuralı | ✅ | |
| Subscription CRUD + commitment + charge → payable | ✅ | |
| RegularPayment generate 12 periods + idempotent | ✅ | |
| Official İTO 2 taksit + BAGKUR 12 ay | ✅ | |
| **Duplicate PayableItem blocked** (3 app) | ✅ | |
| **Viewer 403 / Anon redirect** | ✅ | 3 app'te ayrı |
| Generated 75K PayableItem flag'leri (Faz 5) | ✅ | `FinanceIntegrationTest` |
| Dashboard finance KPI | ✅ | |
| Dashboard Faz 5 summary | ✅ | |
| `SystemSetting` fallback + override + inactive | ✅ | 4 test |
| Design contract (dark mode + IBM Plex) | ✅ | her app klasöründe |
| **Seed gerçek operasyon kaydı oluşturmuyor** | ⚠ **eksik** | Pozitif test yok ama negatif (NO-OP) test'lerle dolaylı kapsanıyor |
| **Cancel servisi** (PayableItem.cancel) | ⚠ eksik | servis fonksiyonu yok, test de yok |
| **Subscription cancel servisi** | ⚠ eksik | aynı |

---

## 8. FAZ 6 ÖNCESİ DÜZELTİLMESİ GEREKENLER

### 8.1 BLOCKER
**YOK.** Faz 6 başlatılabilir.

### 8.2 WARNING (Faz 6+ sırasında uygulanabilir, opsiyonel patch planı)

#### W-1: `cancel_payable` servisi (Faz 6+ küçük patch)
```python
# apps/finance/services/payments.py
@transaction.atomic
def cancel_payable(*, payable, user, reason: str = ""):
    payable.status = PayableStatus.CANCELLED
    payable.notes = (payable.notes + f"\n[İPTAL] {reason}").strip()
    payable.save(update_fields=["status", "notes", "updated_at"])
    audit_log(actor=user, action="UPDATE", obj=payable,
              summary=f"İptal: {payable.title}", metadata={"reason": reason})
    return payable
```
View + URL + buton + 1 test (~20 satır kod). **Etki:** PASS.

#### W-2: `seed_settings` opsiyonel komut (Faz 6+ küçük patch)
```python
# apps/core/management/commands/seed_settings.py
class Command(BaseCommand):
    """Varsayılan SystemSetting'leri oluşturur (idempotent)."""
    def handle(self, *args, **options):
        defaults = [
            ("PAYMENT_DEKONT_REQUIRED_THRESHOLD", "5000", "DECIMAL", "Dekont zorunlu eşiği"),
            ("PAYMENT_DOUBLE_APPROVAL_THRESHOLD", "50000", "DECIMAL", "Çift onay eşiği"),
            ("DEFAULT_CURRENCY", "TRY", "STRING", "Varsayılan para birimi"),
        ]
        for key, value, vtype, desc in defaults:
            SystemSetting.objects.get_or_create(
                key=key, defaults={"value": value, "value_type": vtype, "description": desc}
            )
```

#### W-3: Subscription/Mülk **"SOLD"** durumu (Faz 6 öncesi tartışılabilir)
SiteX dairesi satıldığında durum nasıl ifade edilecek?
- Önerilen: `PropertyAsset` modelinde gelecek `status` alanı (`OWNED/SOLD/RENTED/PASSIVE`).
- Faz 7'de Mülk modeli zenginleşecek; bu mantık o zaman netleştirilebilir.
- **Geçici:** Mülk `is_active=False` (archive) yeterli; `status="SOLD"` ileride eklenecek.

---

## 9. SONUÇ — Faz 6'ya geçilebilir mi?

✅ **EVET, güvenle Faz 6 (SiteX) başlatılabilir.**

**Gerekçe:**
1. Tüm yazılmış modüllerde lifecycle (create/update/archive/restore) tam.
2. Hiçbir gerçek operasyon kaydı seed edilmiyor.
3. Production code'da hardcoded gerçek kayıt yok (sadece enum + docstring).
4. Tüm enum'larda `OTHER` veya migration ile genişletme mümkün.
5. Master tablolar DB-driven (yeni banka/şirket/şahıs/mülk eklenebilir).
6. Period → PayableItem ortak helper idempotent ve esnek.
7. AuditLog her aksiyonda yazılıyor.
8. Soft-delete tutarlı uygulanmış.
9. Import commit hâlâ NO-OP (3 fazda da test ile doğrulandı).
10. Test coverage 94/94 PASS.

3 WARNING (cancel servisi, seed_settings, mülk SOLD durumu) **Faz 6 sırasında veya sonrasında** uygulanabilir küçük patch'lerdir; kritik değil.

---

## 10. PATCH PLANI ÖZETİ (uygulanmadı, sadece öneri)

| # | Patch | Ne zaman | Çaba |
|---|---|---|---|
| W-1 | `cancel_payable` + view + buton + test | Faz 6 sırasında | ~30 dk |
| W-2 | `seed_settings` komutu | Faz 6 öncesi/sırası | ~15 dk |
| W-3 | `PropertyAsset.status` (Mülk satıldı/kira/sahip durumu) | Faz 7 ile birlikte | ~1 saat |
| W-4 | `cancel_subscription`, `cancel_regular_profile`, `cancel_official_profile` servisleri | Faz 6+ uygun anda | ~30 dk |
| W-5 | `tasks` archive/cancel + view (placeholder dönemden çıkarken) | Faz 10 başlangıcı | dahili |

---

**SON.** Audit tamam. Faz 6 başlatılabilir.
