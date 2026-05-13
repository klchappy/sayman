# SEED & LIFECYCLE POLİTİKASI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Sürüm:** 1.0
**Tarih:** 2026-05-06
**Durum:** BAĞLAYICI · Anayasa Madde 3.3 + 3.5 + 3.8 ile uyumlu

> Bu doküman, tüm sonraki fazlar için bağlayıcı seed ve lifecycle kurallarını tanımlar. Sapma sadece `_docs/_archive/` arşivli yeni sürüm + Yönetici onayı ile mümkündür.

---

## 1. TEMEL İLKE

> **Sistem yaşayan bir muhasebe operasyon sistemidir.** Bugün var olan kayıtlar yarın değişebilir, yenileri eklenebilir, eski kayıtlar pasife alınabilir. Hiçbir modül "mevcut Excel'deki kayıtlarla sınırlı" değildir.

---

## 2. SEED EDİLEBİLİR VERİLER

### ✅ İzinli (config / referans / başlangıç şablonu)

| Tip | Örnek | Komut |
|---|---|---|
| **Roller / Gruplar** | super_admin, yonetici, muhasebe_muduru, muhasebeci, personel, goruntuleyici | `seed_roles` (mevcut) |
| **SystemSetting varsayılanları** | PAYMENT_DEKONT_REQUIRED_THRESHOLD=5000 vs. | `seed_settings` (planlı) |
| **Referans listeleri** | Banka isimleri (Albaraka, Garanti, ...), Belediye isimleri (ileri faz), Kurum tipleri | İsteğe bağlı `seed_*` komutları |
| **Başlangıç master kayıtları (kullanıcı onayı ile)** | Aile bireyleri 5 şahıs + 10 şirket + 12 mülk listesi (D-022) | `seed_acme_master` (opsiyonel, **bilinçli kullanıcı çağrısı**) |
| **Rapor / bildirim şablonları** | NotificationRule presetleri (Faz 12) | İleri faz |
| **Görev şablonu (GorevSablonu)** | "SiteX ayın 17 ekstre indir" cron şablonu | Faz 10 |

### Kurallar
- Her seed komutu **idempotent** olmalı (`get_or_create` pattern'i).
- Her seed işlemi `AuditLog(action="SEED")` yazmalı.
- Seed komutu çalıştırıldıktan sonra silinmesi gerekiyorsa: hard-delete sadece Super Admin + sebep + audit.

---

## 3. SEED EDİLEMEZ VERİLER

### ⛔ YASAK (gerçek operasyon kayıtları)

| Tip | Neden |
|---|---|
| **Fatura (PayableItem) — gerçek tutar/tarih** | Kullanıcının manuel veya import-ile-onay yoluyla yaratması gerekir |
| **Ödeme (PaymentTransaction)** | Para hareketi sahteleyemez |
| **Dekont (PayableDocument with role=RECEIPT)** | Belge sha256 dedup gerektirir, fake dosya yaratılamaz |
| **Abonelik dönem borcu (SubscriptionPeriodCharge)** | Yaratıldığında PayableItem'a bağlanma yolu açar — manuel kontrollü olmalı |
| **SiteX aylık ekstre / aidat** | (Faz 6) Daire başına yıllık 60 ekstre — hiç biri seed edilemez |
| **Emlak vergisi taksiti** | (Faz 7) Belediye tahakkuku resmi belgeden gelir |
| **Teminat mektubu** | (Faz 8) Banka belgesi |
| **Komisyon ödemesi** | (Faz 8) Banka belgesi |
| **Kontör alımı** | (Faz 9) Entegratör belgesi |
| **Görev (Task)** | Cron veya kullanıcı atar |
| **Chat mesajı (ChatMessage)** | Gerçek kullanıcı yazar |
| **NotificationLog örnek kaydı** | Sistem üretir |
| **AuditLog satırı** | Sistem yazar (asla manuel) |

---

## 4. GERÇEK OPERASYON KAYITLARININ NASIL OLUŞACAĞI

### 4.1 Yollar
| Yol | Açıklama | Faz |
|---|---|---|
| **Manuel kayıt** | Kullanıcı UI'dan formla girer (Frame 06 + 2.4 PayableItem detayı, Frame 07 ödeme modal) | Faz 4+ aktif |
| **Import preview + onay** | Excel/PDF/RAR yükle → ImportDraftRecord → onay → domain commit | Faz 3 (NO-OP), Faz 4+ committer dispatch ileri faz |
| **Period → PayableItem** | SubscriptionPeriodCharge / RegularPaymentPeriod / OfficialPaymentPeriod kullanıcı butonu ile PayableItem'a dönüşür | Faz 5+ aktif |
| **Otomatik görev üretimi** | GorevSablonu cron (T-N kuralı) | Faz 10 |
| **Bildirim üretimi** | NotificationRule cron + state-change | Faz 12 |
| **Webhook (LATER)** | Banka API entegrasyonu | LATER (Anayasa MVP-3+) |

### 4.2 Onaysız kesin kayıt YOK
**Anayasa Madde 3.4** (zorunlu): Import edilen veri kullanıcı onayı olmadan kesin domain kaydına dönüşmez. Tüm import'lar **ImportDraftRecord** olarak kalır; onay sonrası modüle özel committer çalışır (Faz 4 sonrasında dispatch eklenecek).

### 4.3 Onaysız servis çağrısı yok (kod düzeyinde)
Servisler her zaman `user` parametresi alır:
```python
create_payable(user=request.user, ...)
add_partial_payment(payable=p, user=request.user, ...)
mark_paid(payable=p, user=request.user, ...)
```
`user` kimlik doğrulanmadan servis çağrılamaz (LoginRequiredMixin tüm view'larda).

---

## 5. PASİFLEŞTİRME / ARŞİVLEME KURALI

### 5.1 Soft-delete varsayılan (Anayasa 3.8)
Tüm `BaseModel` mirası modellerde:
- `is_active = BooleanField(default=True)`
- `archived_at = DateTimeField(null=True)`
- `archived_by = FK→User(null=True)`
- `archive_reason = TextField()`

### 5.2 Pasifleştirme metodu
```python
instance.archive(actor=user, reason="Müşteri ile ilişki kapandı")
# is_active=False, archived_at=now, archived_by=user, archive_reason set
```

### 5.3 Geri alma metodu
```python
instance.restore(actor=user)
```

### 5.4 Hard-delete istisnası (Anayasa 12.6)
- Sadece **Super Admin**.
- Çift onay + zorunlu sebep + AuditLog kritik kayıt.
- View'larda `path` olarak yok (delete URL bilinçli olarak yazılmadı).
- `instance.delete()` Django'nun hard-delete'i — sadece shell/admin'de Super Admin tarafından.

---

## 6. SATILDI / İADE / YENİLENDİ / İPTAL DURUMLARI

### 6.1 Mülk satıldı (Faz 7+)
- `PropertyAsset.status = "SOLD"` (yeni alan, Faz 7).
- `is_active=False` opsiyonel (eski referansları korumak için aktif tutulabilir).
- Audit + sebep + tarih + alıcı bilgisi notes alanında.
- Bağlı kayıtlar (EmlakVergisi geçmişi) pasifleştirilmez — tarihçe kayıtlı kalır.

### 6.2 SiteX dairesi satıldı (Faz 6+)
- `SiteXDaire.status = "SOLD"` veya `Mulk.status = "SOLD"` (Faz 6'da netleşecek).
- Eski ekstreler ve aidat farkları pasif edilmez (audit + tarihçe).
- Yeni daire eklemek için: yeni `Mulk` + yeni `SiteXDaire`.

### 6.3 Teminat mektubu (Faz 8)
- `TeminatMektubu.durum`: AKTIF / IADE_EDILDI / SURESI_DOLDU / YENILENDI
- İade: `iade_tarihi` + sebep zorunlu.
- Yenileme: yeni mektup → `previous_letter` FK ile bağ + eski `durum=YENILENDI`.

### 6.4 Abonelik iptal
- `Subscription.status = "CANCELLED"` (manuel veya iptal süreci sonrası).
- `is_active=False` opsiyonel.
- Bağlı `SubscriptionCommitment.status = "CANCELLED"`.
- Geçmiş `SubscriptionPeriodCharge` kayıtları korunur.

### 6.5 Fatura iptal
- `PayableItem.status = "CANCELLED"`.
- Sebep `notes` veya `archive_reason`'a yazılır.
- Bağlı `PaymentTransaction` kayıtları durumu değişmez (audit).

### 6.6 Görev iptal/yeniden açma (Faz 10)
- `Task.status = "CANCELLED"` veya `"NEW"` (yeniden açma).
- Servis fonksiyonu Faz 10'da eklenecek.

---

## 7. SUPER ADMIN HARD-DELETE İSTİSNASI

| Madde | Kural |
|---|---|
| Yetki | Sadece Super Admin (`groups__name=super_admin` veya `is_superuser`) |
| Sebep | Zorunlu (`delete_reason` text alanı) |
| Çift onay | Yönetici 5 dk içinde de onaylamalı (LATER) |
| Audit | Kritik kayıt (`action=HARD_DELETE`, `kritik=True`) |
| AuditLog | **Asla silinmez** — hard-delete bile audit kaydı bırakır (audit immutable) |
| URL | UI'da YOK — sadece Django shell veya admin |
| Use case | Test/yanlış import temizliği, KVKK silme talebi |

---

## 8. AUDITLOG ZORUNLULUĞU

### 8.1 Yazılması zorunlu eylemler
| Eylem | App / Model | Action |
|---|---|---|
| Master kayıt yarat/güncelle/archive/restore | parties.* | CREATE/UPDATE/ARCHIVE/RESTORE |
| Document upload + download | documents.Document | CREATE / VIEW |
| Import batch yarat / parse / approve / reject / commit / rollback / cancel | imports.* | CREATE / UPDATE / ARCHIVE |
| PayableItem tüm CRUD + mark_paid + add_doc | finance.* | CREATE / UPDATE / ARCHIVE / RESTORE |
| PaymentTransaction approve / reject | finance.* | UPDATE |
| Subscription / RegularProfile / OfficialProfile CRUD | 3 app | CREATE / UPDATE / ARCHIVE / RESTORE |
| Period → PayableItem | finance.period_link | CREATE |
| Period generation (12 ay / yıllık) | regular/official | CREATE (toplu sayım metadata) |
| Login / Logout | accounts.LoginView/LogoutView | LOGIN / LOGOUT |
| Yetki değişikliği (rol atama) | accounts | PERMISSION_CHANGE (kritik) |
| Hard-delete | her model | HARD_DELETE (kritik) |
| Seed komutları | management | SEED |

### 8.2 KVKK maskeleme (Anayasa 12.1)
AuditLog metadata JSON'unda **TC, telefon, IBAN** maskelenmelidir:
- TC: ilk 3 + son 4 görünür (`mask_tc()` helper)
- Telefon: son 4 görünür (`mask_phone()`)
- Şifre / token / API key: hiç loglanmaz

### 8.3 Saklama
- AuditLog **2 yıl minimum** (Anayasa 12.7).
- LATER: yıllık arşiv (sıkıştırılmış parquet/JSON).

---

## 9. POLİTİKA UYGULAMA SORUMLULUĞU

| Pozisyon | Sorumluluk |
|---|---|
| Geliştirici | Yeni servis fonksiyonu yazarken `audit_log()` çağrısı zorunlu |
| Geliştirici | `BaseModel` miras alma kural — yeni domain modelinde concrete soft-delete |
| Geliştirici | Enum eklerken `OTHER` opsiyonu unutmama |
| Geliştirici | Test'e archive/restore + duplicate-blocked + viewer 403 ekleme |
| Yönetici | Hard-delete onayı + Telegram gerçek mod açma onayı |
| Super Admin | Sistem ayarları (SystemSetting) + rol yönetimi + hard-delete |

---

**SON.** Bu politika anayasanın doğal uzantısıdır.
