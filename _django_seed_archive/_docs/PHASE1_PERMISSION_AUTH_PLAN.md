# FAZ 1 — YETKİ & AUTH PLANI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

---

## 1. AUTH ALTYAPISI

### 1.1 Temel
- Django **built-in auth** (`django.contrib.auth`) baz alınır.
- `User` modeli: AbstractUser + custom `Profile` (telefon, avatar, tercihler).
- `Group` = Rol karşılığı.
- `Permission` = Django built-in permissions + custom permissions (`add_<model>`, `change_<model>`, `delete_<model>`, ek olarak `approve_<model>`, `export_<model>`).

### 1.2 2FA
- **MVP-1'de zorunlu değil** (D-016).
- Mimari hazır: `django-otp` veya `django-two-factor-auth` Faz 2'de hook noktası bırakılır.
- Profil sayfasında "2FA aç" butonu disabled + "Yakında" tooltip.
- AdminUser ve Super Admin için 2FA Faz 12+ aktif edilebilir.

### 1.3 Session
- Django session backend: PostgreSQL (default) veya Redis (gelecek).
- Session timeout: 12 saat (devamlı aktiflikle yenilenir).
- "Beni hatırla" 30 gün (opsiyonel checkbox).

### 1.4 Şifre politikası
- Min 10 karakter, 1 büyük + 1 rakam + 1 özel karakter.
- `django.contrib.auth.password_validation` strict ayarı.
- Şifre sıfırlama: e-posta link (Faz 2 SMTP konfig).

---

## 2. ROL TANIMI VE HİYERARŞİ

| Rol | Django Group | İş Sorumluluğu |
|---|---|---|
| **Super Admin** | `super_admin` | Sistem yönetimi, yetki atama, hard-delete, Telegram gerçek konfig |
| **Yönetici** | `yonetici` | Tüm modüller, son onay, raporlar |
| **Muhasebe Müdürü** | `muhasebe_muduru` | Tüm operasyonel modüller, görev atama, import onay |
| **Muhasebeci** | `muhasebeci` | Atanan modüllerde işlem, ödeme işaretleme, dekont yükleme |
| **Personel** | `personel` | Atanan görevler + sınırlı kayıt erişim |
| **Görüntüleyici** | `goruntuleyici` | Read-only, raporlar |
| **(MVP-2)** Muhasebeci+Export | `muhasebeci_export` | Muhasebeci + export yetkisi |

Hiyerarşi: Super Admin > Yönetici > Müdür > Muhasebeci > Personel > Görüntüleyici.

> **Not:** Hiyerarşi otomatik miras değildir. Her rolün izinleri açık tanımlanır (explicit > implicit).

---

## 3. PERMISSION HELPER YAPISI

```python
# apps/accounts/permissions.py

class PermissionMatrix:
    """Modül × eylem matrisi — hard-coded baseline."""

    MATRIX = {
        # (rol, app, eylem) -> True/False
        ("muhasebeci", "finance", "view"): True,
        ("muhasebeci", "finance", "add"): True,
        ("muhasebeci", "finance", "mark_paid"): True,
        ("muhasebeci", "finance", "approve_payment"): False,  # Müdür+
        ("muhasebeci", "imports", "upload"): True,
        ("muhasebeci", "imports", "commit"): False,  # Müdür+
        # ...
    }

def has_module_perm(user, app: str, action: str) -> bool:
    if user.is_superuser: return True
    for role in user.groups.values_list("name", flat=True):
        if PermissionMatrix.MATRIX.get((role, app, action)):
            return True
    return False
```

`apps.accounts.decorators`:
```python
@require_perm(app="finance", action="approve_payment")
def approve_payment_view(request, pk): ...
```

---

## 4. OBJECT-LEVEL PERMISSION

**MVP-1'de gerekli mi?** Kısmen.

### 4.1 Gerekli alanlar
| Senaryo | Çözüm |
|---|---|
| Bir muhasebeci yalnız atandığı görevleri görür | `Gorev.atanan == user` filter (queryset level) |
| Bir muhasebeci yalnız bağlı oldu kişi/şirketin faturalarını görür | **MVP-1'de yok** — tüm muhasebeciler tüm faturaları görür (D-005 onayı). LATER |
| SiteX daire sahibi şahsi user → sadece kendi dairesi | LATER |
| Chat thread görünürlüğü | `ChatParticipant` join — kullanıcı katılımcı değilse 403 |

### 4.2 Kullanılacak kütüphane
- **MVP-1:** Custom queryset filter `model.objects.for_user(user)` pattern.
- **MVP-2:** `django-guardian` değerlendirilebilir (object-level Django built-in).

---

## 5. MODÜL BAZLI YETKİ MATRİSİ

| Modül \ Rol | S.Admin | Yön. | Müd. | Muh. | Pers. | Gört. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard | V | V | V | V | (kendi) | V |
| Fatura — Görüntüle | V | V | V | V | ⛔ | V |
| Fatura — Ekle | V | V | V | V | ⛔ | ⛔ |
| Fatura — Düzenle | V | V | V | V | ⛔ | ⛔ |
| Fatura — Soft-Delete | V | V | V | ⛔ | ⛔ | ⛔ |
| Fatura — Hard-Delete | V (audit) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Ödeme — İşaretle | V | V | V | V | ⛔ | ⛔ |
| Ödeme — Nihai Onay (>eşik) | V | V | V | ⛔ | ⛔ | ⛔ |
| Import — Yükle | V | V | V | V | ⛔ | ⛔ |
| Import — Commit | V | V | V | ⛔ | ⛔ | ⛔ |
| Import — Rollback | V | V | V | ⛔ | ⛔ | ⛔ |
| SiteX — Görüntüle/Ekle/Düzenle | V | V | V | V | ⛔ | V (only V) |
| SiteX — Aidat Farkı Mutabakat | V | V | V | V | ⛔ | ⛔ |
| Emlak Vergisi | V | V | V | V | ⛔ | V |
| Teminat — Görüntüle | V | V | V | V | ⛔ | V |
| Teminat — Komisyon Öde | V | V | V | V | ⛔ | ⛔ |
| Teminat — Yenile/İade | V | V | V | ⛔ | ⛔ | ⛔ |
| Resmi Ödemeler | V | V | V | V | ⛔ | V |
| Entegratör/Kontör | V | V | V | V | ⛔ | V |
| Görev — Atama | V | V | V | (sınırlı) | ⛔ | ⛔ |
| Görev — Tamamlama | V | V | V | V | V (atanan) | ⛔ |
| Chat — Görüntüle | V | V | V | V | V (sınırlı) | ⛔ |
| Chat — Mesaj Gönder | V | V | V | V | V | ⛔ |
| Bildirim Ayarları | V | (kendi) | (kendi) | (kendi) | (kendi) | (kendi) |
| Telegram Konfig | V | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Telegram Gerçek Açma | V (çift onay) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Rapor — Görüntüle | V | V | V | V | (sınırlı) | V |
| Rapor — Excel Export | V | V | V | V (Muhasebeci+Export) | ⛔ | ⚠ (D-010 karar) |
| AuditLog — Görüntüle | V | V | (sınırlı) | ⛔ | ⛔ | ⛔ |
| Yetki Yönetimi | V | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Master Tablolar | V | V | V | (sınırlı) | ⛔ | V |

V = İzin var · ⛔ = Yasak.

---

## 6. KRİTİK İZİN ALANLARI (sadece Super Admin)

| Aksiyon | Gerekçe |
|---|---|
| Hard-Delete (kalıcı silme) | Soft-delete varsayılan, Anayasa 3.8 |
| Telegram Gerçek Gönderim Açma | Anayasa 8 / Madde 3.7 |
| Rol/Group Atama | Yetki devamlılığı |
| `TelegramKonfig` token değiştirme | Güvenlik |
| AuditLog'a manuel insert | Yasak (sadece sistem) |
| Sistem ayarları (env, secret) | Sunucu seviyesi |

---

## 7. YETKİ SİMÜLASYONU (Frame 19)

```python
# apps/accounts/services/simulator.py
def simulate_permission(user, target_app, target_id, action):
    """
    Frame 19'daki Yetki Simülasyonu kartı için.
    Returns: {action: ALLOWED|DENIED|PARTIAL, reason: str}
    """
    result = {}
    for action_name in ["view", "edit", "export", "delete"]:
        allowed = has_module_perm(user, target_app, action_name)
        if allowed:
            # object-level check
            obj = get_object(target_app, target_id)
            if can_access_object(user, obj):
                result[action_name] = {"status": "ALLOWED"}
            else:
                result[action_name] = {"status": "DENIED", "reason": "object-level"}
        else:
            result[action_name] = {"status": "DENIED", "reason": "role"}
    return result
```

---

## 8. AUDIT'LE ENTEGRASYON

Her yetki değişikliği:
- `AuditLog(eylem=PERMISSION_CHANGE, kritik=True, eski/yeni group listesi)`.
- Frame 18'de "Kritik İşlemler" widget'ında görünür.

Yetkisiz erişim denemesi:
- 403 yanıtı + `AuditLog(eylem=PERMISSION_DENIED)` (opsiyonel — DDoS önlemi için throttle).

---

## 9. SEED PLAN

`apps.accounts.management.commands.bootstrap_users`:
```bash
python manage.py bootstrap_users
```

Yarattığı kullanıcılar (D-022 + Anayasa 4.2):
| Kullanıcı | Email | Rol | Geçici Şifre |
|---|---|---|---|
| superadmin | super@muhasebe.local | super_admin | random, env'e yazar |
| yonetici | yonetici@... | yonetici | random |
| muhasebe_muduru | mudur@... | muhasebe_muduru | random |
| ayse | ayse@... | muhasebeci | random |
| erdal | erdal@... | muhasebeci | random |
| melek | melek@... | muhasebeci | random |

İlk girişte şifre değiştirme zorunlu (`PasswordChangeRequiredMiddleware`).

---

## 10. 2FA İLERİ NOTU (MVP-2+)

- **Adım 1 (MVP-2):** Super Admin için zorunlu 2FA (TOTP — Google Authenticator).
- **Adım 2:** Yönetici + Muh. Müdürü için opsiyonel.
- **Adım 3:** Tüm kullanıcılar opsiyonel.
- **Adım 4 (LATER):** WebAuthn / FIDO2 desteği.

Mimari: `django-two-factor-auth` (Django Channels uyumlu) entegrasyonu Faz 2'de placeholder olarak konumlandırılır; aktif edilmez.

---

## 11. SESSION VE GİRİŞ GÜVENLİĞİ

- HTTPS zorunlu (`SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`).
- HSTS preload.
- Login throttle: 5 başarısız → 5 dk lockout (`django-axes`).
- Login + Logout AuditLog'a yazılır.
- IP whitelist (opsiyonel, prod admin için).

---

## 12. KULLANICI YAŞAM DÖNGÜSÜ

| Aksiyon | Süreç |
|---|---|
| Yeni kullanıcı | Super Admin yaratır → e-posta davet → ilk giriş şifre değiştir |
| Kullanıcı çıkışı | Soft-disable (`User.is_active=False`) → tüm session sonlandır |
| Kullanıcı değişikliği (rol) | Super Admin → AuditLog kritik kayıt |
| Şifre sıfırlama | Self-service e-posta link (token 1 saat geçerli) |
| Hesap kilitleme | Throttle veya Super Admin manuel |

---

**SON.** Bu plan Faz 2'de `apps.accounts` implementasyonunun bağlayıcı referansıdır.
