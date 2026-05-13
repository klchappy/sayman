# PRODUCTION SMOKE TEST CHECKLIST

**Kullanım:** Canlı deploy sonrası, ilk kullanıcıya tanıtım yapmadan önce çalıştırılır.
**Hedef:** Hepsi ✅ olmalı. Tek bir ❌ varsa rollback değerlendirilir.

Tarih: ____________  ·  Sürüm tag: ____________  ·  Operatör: ____________

---

## A. Genel Sağlık

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| A1 | `https://<host>/accounts/login/` açılıyor | 200, OPS monogram, “Muhasebe Operasyonları Takip Sistemi” görünür | |
| A2 | Süper admin login | dashboard’a yönlenir | |
| A3 | `/dashboard/` widget’ları render | Faz 13 bildirim widget’ı dahil, “KAPALI” rozeti görünür | |
| A4 | CSS doğru yükleniyor | `/static/css/app.css` 200, IBM Plex font, dark mode YOK | |
| A5 | `view-source` HTML’de yasaklı kelime grep | Pruva / Acme / KE / HES / Santral / Inter / JetBrains → 0 | |
| A6 | Logout → login’e döner | | |
| A7 | `/admin/` 200 (super admin) | | |

## B. Seed Doğrulamaları

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| B1 | `python manage.py seed_roles` ikinci kez | “mevcut” mesajı, yeni rol 0 | |
| B2 | `python manage.py seed_settings` ikinci kez | idempotent | |
| B3 | `python manage.py seed_notification_rules` ikinci kez | 10 kural, yeni 0 | |
| B4 | Admin → Groups | 6 grup: super_admin, yonetici, muhasebe_muduru, muhasebeci, personel, goruntuleyici | |
| B5 | Admin → Notification Rules | 10 satır, hepsi `dry_run_only=True` | |

## C. Modül Akışları (manuel happy-path)

### C-Finance
| # | Adım | ✅/❌ |
|---|---|---|
| F1 | `/finance/payables/new/` ile fatura oluştur (4.000 TL) | |
| F2 | Ödeme işaretle (kısmi 2.000) → status PARTIAL | |
| F3 | 3.000 TL’lik dekont yükle (>5K eşik üstü test için 6.000’lik fatura aç) → dekont zorunluluğu çalışıyor | |
| F4 | 60.000 TL’lik fatura → çift onay zorunlu, viewer onaylayamaz | |
| F5 | AuditLog `/audit/` ekranında ilgili satırlar var | |

### C-Documents
| # | Adım | ✅/❌ |
|---|---|---|
| D1 | Belge yükle (PDF/JPG, <10 MB) | |
| D2 | Aynı dosyayı tekrar yükle → dedup, ikinci Document yaratılmaz | |
| D3 | İndirme linki (login’li) → 200, dosya iniyor | |
| D4 | Logout sonra `/documents/<id>/download/` → 302 login | |

### C-Tasks
| # | Adım | ✅/❌ |
|---|---|---|
| T1 | Görev oluştur (vade bugün) | |
| T2 | Yorum ekle | |
| T3 | Ek dosya yükle | |
| T4 | Dashboard agenda’da görünür | |

### C-Chat
| # | Adım | ✅/❌ |
|---|---|---|
| CH1 | Yeni thread aç (DIRECT, 1 katılımcı) | |
| CH2 | Mesaj gönder | |
| CH3 | Üçüncü kullanıcı (non-participant) ile login → thread URL’i 403 | |
| CH4 | Widget badge unread sayısı doğru | |

### C-Reports
| # | Adım | ✅/❌ |
|---|---|---|
| R1 | `/reports/` Report Center açılıyor | |
| R2 | Payable raporu preview → tablo geliyor | |
| R3 | XLSX export → 200, dosya iniyor, İçinde TR karakter düzgün | |
| R4 | CSV export → 200, `;` delimiter, UTF-8 BOM | |
| R5 | Viewer hesabı export çalıştıramaz → 403 | |

### C-Notifications
| # | Adım | ✅/❌ |
|---|---|---|
| N1 | `/notifications/` dashboard “Gerçek Telegram: KAPALI” rozeti var | |
| N2 | Manager dry-run çalıştır → log’lar oluşur, hepsi `dry_run=True` | |
| N3 | Viewer dry-run POST → 403 | |
| N4 | Telegram Test sayfası → simulate → masked chat_id (`12*****89` benzeri) | |
| N5 | Log detail sayfası → raw token / chat_id YOK | |
| N6 | `send_telegram_notification` çağrılırsa status=SUPPRESSED (admin shell test) | |

### C-Site Aidatları (pruva)
| # | Adım | ✅/❌ |
|---|---|---|
| SA1 | Sidebar “🏢 Site Aidatları” linki → `/pruva/` (URL pruva, **UI Site Aidatları**) | |
| SA2 | Yeni daire ekle | |
| SA3 | Ekstre oluştur → Payable’a bağla | |

### C-Properties (Emlak)
| # | Adım | ✅/❌ |
|---|---|---|
| P1 | Mülk + vergi yılı + taksit oluştur | |
| P2 | Taksit → Payable bağla | |

### C-Guarantees
| # | Adım | ✅/❌ |
|---|---|---|
| G1 | Teminat oluştur → komisyon → Payable bağla | |
| G2 | İade işlemi | |

### C-Integrators
| # | Adım | ✅/❌ |
|---|---|---|
| I1 | Hizmet + sözleşme + kontör oluştur | |
| I2 | Kontör kritik eşik altına in → bildirim listesinde kritik | |

## D. Güvenlik / Izolasyon

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| S1 | viewer hesap → finance/payables/new POST | 403 | |
| S2 | viewer → reports export | 403 | |
| S3 | viewer → notifications dry-run-run POST | 403 | |
| S4 | logout → /documents/<id>/download/ | 302 login | |
| S5 | non-participant → /chat/threads/<id>/ | 403 | |
| S6 | HTML kaynak grep → raw token / chat_id | 0 occurrence | |
| S7 | Outbound network — Telegram bot URL | bağlantı YOK (tcpdump / netstat) | |
| S8 | Outbound network — SMTP | bağlantı YOK | |
| S9 | `/admin/` viewer hesap | login sayfasına / 403 | |
| S10 | `Set-Cookie` `Secure` ve `HttpOnly` set | her ikisi de var | |
| S11 | `Strict-Transport-Security` header | 1 yıl, includeSubDomains, preload | |
| S12 | HTTP → HTTPS redirect | 301 | |

## E. Uçtan Uca Performans (kaba)

| # | Adım | Hedef | ✅/❌ |
|---|---|---|---|
| E1 | Dashboard ilk yükleme | <1.5 s | |
| E2 | Rapor preview (1000 satır) | <3 s | |
| E3 | XLSX export 1000 satır | <5 s | |
| E4 | Belge upload 50 MB | <30 s | |

## F. Backup Drill

| # | Adım | ✅/❌ |
|---|---|---|
| BK1 | `slc-backup.timer` aktif (`systemctl list-timers`) | |
| BK2 | Manuel `slc-backup.service` start → `/var/backups/...` altında dump + media tar oluştu | |
| BK3 | Test restore (staging DB) → tablolar tutarlı | |

---

## Sonuç

| Toplam | ✅ | ❌ |
|---|---|---|
| Genel | __ / 7 | __ |
| Seed | __ / 5 | __ |
| Modüller | __ / ~30 | __ |
| Güvenlik | __ / 12 | __ |
| Perf | __ / 4 | __ |
| Backup | __ / 3 | __ |

**Karar:**
- ☐ TÜMÜ YEŞİL → kullanıcı tanıtımına geç
- ☐ KÜÇÜK ❌ → log + hızlı patch + tekrar smoke
- ☐ KRİTİK ❌ → ROLLBACK (`_docs/PRODUCTION_DEPLOYMENT_PLAN.md` §16)

İmza: ____________________
