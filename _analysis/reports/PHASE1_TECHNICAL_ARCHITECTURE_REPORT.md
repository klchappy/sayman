# FAZ 1 — TEKNİK MİMARİ FİNAL RAPORU
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 1 — Teknik Mimari Plan
**Tarih:** 2026-05-05
**Durum:** TAMAMLANDI · Faz 2 Base Scaffold için hazır

---

## 1. OKUNAN DOSYALAR (12)

| Dosya | Konum |
|---|---|
| Master Anayasa | `_docs/PROJECT_ANAYASA.md` |
| MVP Scope | `_docs/PHASE0B_MVP_SCOPE.md` |
| Modül Roadmap | `_docs/PHASE0B_MODULE_ROADMAP.md` |
| Design Freeze | `_docs/DESIGN_FREEZE_DECISION.md` |
| Component Inventory | `_docs/DESIGN_COMPONENT_INVENTORY.md` |
| Status Badge | `_docs/DESIGN_STATUS_BADGE_SYSTEM.md` |
| Mobile Audit | `_docs/DESIGN_MOBILE_AUDIT.md` |
| Claude Code Handoff | `_docs/DESIGN_CLAUDE_CODE_HANDOFF_BRIEF.md` |
| Final Design Audit | `_analysis/reports/SPRINT1H_FINAL_DESIGN_AUDIT.md` |
| Normalize Model Taslağı | `_analysis/model_drafts/PHASE0A_NORMALIZED_MODEL_DRAFT.md` |
| Modül Haritası | `_analysis/reports/PHASE0A_MODULE_MAP.md` |
| Veri Kaynağı Envanteri | `_analysis/reports/PHASE0A_DATA_SOURCE_INVENTORY.md` |

---

## 2. OLUŞTURULAN DOSYALAR (9)

| # | Dosya | İçerik Özeti |
|---|---|---|
| 1 | `_docs/PHASE1_TECHNICAL_ARCHITECTURE.md` | Stack (Django 5 + PostgreSQL 15 + Redis + Channels + HTMX) · 14 bölüm: app yapısı, settings, media/static, log, audit, notif, çok yıllı veri, soft-delete, idempotency, atomic, kapasite, izolasyon |
| 2 | `_docs/PHASE1_DJANGO_APP_PLAN.md` | 18 Django app · her app için amaç + model + view + service + management + test + MVP + bağımlılık tablosu · install order |
| 3 | `_docs/PHASE1_DATA_MODEL_PLAN.md` | A-M ana model aileleri · ~38 MVP-1 model + 5 MVP-2 + 5 MVP-3 = ~48 model · unique constraint tablosu · soft-delete davranışı · index önerileri |
| 4 | `_docs/PHASE1_PERMISSION_AUTH_PLAN.md` | Django built-in auth + 6 rol · permission helper · object-level (kısmen MVP-1) · 30+ satırlı modül × rol matrisi · 2FA mimari hook · seed plan |
| 5 | `_docs/PHASE1_IMPORT_ARCHITECTURE_PLAN.md` | 10 adımlı pipeline · idempotency anahtarları · hata sınıfları (4 kategori, 12+ kod) · 14 import sırası (D-018 2024-2026 odaklı) · "geçmiş veri" flag · 10 mapping profile |
| 6 | `_docs/PHASE1_NOTIFICATION_TASK_CHAT_PLAN.md` | Görev + Bildirim + Chat entegrasyonu · 14 görev şablonu seed · 4 aşamalı bildirim kapısı + retry · WebSocket Channels · kayıt-bağlantılı thread |
| 7 | `_docs/PHASE1_DEPLOYMENT_ARCHITECTURE_PLAN.md` | Ayrı VPS + path yapısı + 4 systemd service + nginx konfig + env/secret + backup (günlük/haftalık/aylık) + deploy/rollback + güvenlik checklist |
| 8 | `_docs/PHASE1_TEST_STRATEGY.md` | 14 test grubu · 100+ örnek test adı · 18 kritik acceptance criteria · pytest+factory_boy · CI pipeline · DR drill |
| 9 | `_analysis/reports/PHASE1_TECHNICAL_ARCHITECTURE_REPORT.md` | **Bu dosya** — final rapor |

> Hedef dosyaların hiçbiri önceden mevcut değildi; backup gerekmedi.

---

## 3. ANA MİMARİ KARARLAR

| # | Karar | Onay |
|---|---|---|
| K1 | **Stack:** Django 5.1+/Python 3.12+ / PostgreSQL 15+ / Redis 7+ / Celery / Channels / HTMX + Alpine + Tailwind | ✅ |
| K2 | **PostgreSQL** zorunlu (D-015); SQLite yalnız local test | ✅ |
| K3 | **Auth:** Django built-in + 6 Group; 2FA mimari hook bırakılır (D-016) | ✅ |
| K4 | **Hosting:** ayrı VPS, ayrı DB, ayrı user, ayrı systemd, ayrı nginx, ayrı env (D-017) | ✅ |
| K5 | **Import scope:** 2024-2026 odaklı; 2020-2023 LATER ikinci import (D-018) | ✅ |
| K6 | **18 Django app** — fonksiyonel ayrım: core/audit/accounts/parties/documents (foundation) + 13 modül app | ✅ |
| K7 | **~48 model** — Anayasa Madde 6 ile uyumlu · ~38 MVP-1 + 5 MVP-2 + 5 MVP-3 | ✅ |
| K8 | **Soft-delete** baseline; Hard-delete sadece Super Admin + sebep + audit | ✅ |
| K9 | **Idempotency** her kritik operasyonda doğal anahtar ile | ✅ |
| K10 | **Atomic transaction** zorunlu (import commit, ödeme işaretleme + audit) | ✅ |
| K11 | **AuditLog middleware** her CRUD'da yazar; TC/telefon maskeli | ✅ |
| K12 | **4 aşamalı bildirim kapısı** (Sistem içi → Dry-run → Test → Gerçek); Telegram gerçek default KAPALI | ✅ |
| K13 | **Kapasite varsayımı:** 4 vCPU/8 GB/200 GB SSD MVP-1'e yeterli | ✅ |
| K14 | **Backup:** günlük DB + haftalık media + aylık arşiv; restore drill çeyreklik | ✅ |
| K15 | **Deploy:** systemd + manuel deploy.sh (Docker MVP-2'de değerlendirilir) | ✅ |
| K16 | **Test coverage:** MVP-1 %60+, MVP-2 %75+ | ✅ |

---

## 4. APP YAPISI ÖZETİ

```
core ← audit ← accounts ← parties ← documents
                                      ↓
                                   imports (Faz 3)
                                      ↓
        finance / official_payments (Faz 4)
        subscriptions (Faz 5)
        pruva (Faz 6)
        properties (Faz 7)
        guarantees (Faz 8)
        integrators (Faz 9 — MVP-2)
                                      ↓
                              tasks (Faz 10) ← tüm modüller (Generic FK)
                                      ↓
                          notifications (Faz 12)
                                      ↓
                             dashboard ← reports (Faz 13) ← chat (Faz 11 — MVP-3)
```

**MVP-1:** 16 modül + master + audit + dashboard = 16 app aktif.
**MVP-2:** +integrators + reports.
**MVP-3:** +chat.

---

## 5. MODEL PLANI ÖZETİ

| Aile | Model Sayısı | MVP |
|---|---|---|
| A. Çekirdek (Sahis/Sirket/Mulk/Banka/Kurum/Belge/BaseModel) | 7 | MVP-1 |
| B. Fatura/Ödeme | 3 | MVP-1 |
| C. Abonelik/Taahhüt | 2 (+ Kampanya MVP-2) | MVP-1 |
| D. SiteX | 4 | MVP-1 |
| E. Emlak Vergisi | 2 | MVP-1 |
| F. Teminat | 3 | MVP-1 |
| G. Resmi Ödemeler | 1 (enum tip ile çoklu) | MVP-1 |
| H. Entegratör/Kontör | 5 | MVP-2 |
| I. Import | 6 | MVP-1 |
| J. Görev | 5 | MVP-1 |
| K. Chat | 5 | MVP-3 |
| L. Bildirim | 4 | MVP-1 |
| M. Audit | 1 | MVP-1 |

**Toplam:** ~48 model (38 MVP-1 + 5 MVP-2 + 5 MVP-3).

---

## 6. IMPORT PLANI ÖZETİ

### Pipeline (10 adım)
UPLOAD → PARSE → MAPPING → DRAFT GENERATION → VALIDATION → PREVIEW → CORRECTION → APPROVAL → COMMIT → ROLLBACK PENCERESİ (24 saat).

### Hata sınıfları
- **OK** (yeşil), **WARNING** (sarı), **ERROR** (kırmızı), **MANUAL** (mor — kullanıcı doğrulaması).

### İlk import sırası (14 adım, MVP-1)
1. Teminat Mektupları (banka master)
2. Şirket Abonelikleri (master)
3. Ev Abonelikleri meta sheet (master)
4. Şahıslar Otomatik Ödeme 2026 (Fatura/Ödeme)
5. Ev Abonelikleri 2025 (Fatura/Ödeme — `historical_data=True`)
6. Ödemeler Otomatikler ve Elden 2026 (Fatura/Ödeme)
7. Ödemeler Takip Çizelgesi Kira 2024-2026 (KiraSözleşmesi)
8. Ödemeler Takip Emlak sheet (Mülk + Emlak 2026)
9. İTO 2025-2026 (Resmi)
10. BAĞKUR 2025-2026 (Resmi)
11. Emlak 2024 RAR (Emlak + Belge)
12. Emlak 2025 RAR (Emlak + Belge)
13. SiteX RAR 2024-2026 (SiteX + Belge)
14. **MVP-2:** PAPİNET RAR (Entegratör)

> **2020-2023 LATER** — D-018 onayı.

---

## 7. PERMISSION PLANI ÖZETİ

- **6 Rol:** Super Admin / Yönetici / Muhasebe Müdürü / Muhasebeci / Personel / Görüntüleyici.
- **Yetki matrisi:** 30 satır × 6 sütun (modül × rol).
- **Kritik (Super Admin only):** Hard-delete, Telegram gerçek mod, rol atama, sistem ayarları.
- **Object-level perm:** MVP-1'de kısmen (görev + chat); diğerleri queryset filter pattern.
- **2FA:** Mimari hazır (django-two-factor-auth hook), MVP-1'de opsiyonel.
- **Yetki simülatörü:** Frame 19 — `simulate_permission(user, target, action)` servis.

---

## 8. DEPLOY PLANI ÖZETİ

- **Ayrı VPS** (`mop-prod-1`), Ubuntu 24.04 LTS, 4 vCPU/8 GB/200 GB.
- **4 systemd service:** muhasebe-web (Gunicorn 8001), -asgi (Uvicorn 8002), -worker (Celery), -beat (Celery beat).
- **nginx:** TLS Let's Encrypt, WebSocket /ws/ → ASGI, /static/ + /protected_media/ (X-Accel).
- **Env:** `/etc/muhasebe/env` chmod 600.
- **Backup:** günlük DB pg_dump + haftalık media rsync + aylık arşiv.
- **Deploy:** `deploy.sh` (release symlink swap + migrate + restart). Docker compose alternatif MVP-2.
- **Domain:** `mop.acme.com.tr` öneri (D-014 hâlâ açık, prod öncesi karar).
- **Monitoring:** healthz/readyz endpoint + UptimeRobot + cron watchdog.

---

## 9. TEST PLANI ÖZETİ

- **14 test grubu:** Model / Service / Permission / Import dry-run / Import commit / Idempotency / Notification / Task / Chat / UI smoke / Mobile smoke / AuditLog / Export / Management.
- **100+ örnek test adı** her grupta.
- **18 kritik acceptance** MVP-1 release için.
- **Coverage hedef:** MVP-1 %60+, MVP-2 %75+.
- **Tooling:** pytest + pytest-django + factory_boy + freezegun + responses + playwright (UI MVP-2).
- **CI:** lint + migrate + test + coverage check (PR merge gate).
- **DR drill:** çeyreklik manuel restore + smoke.

---

## 10. RİSKLER

| # | Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|---|
| R1 | Import mapping yanlış kurulur, veri kalitesi düşer | Yüksek | Yüksek | ImportDraft + onay zorunlu, rollback 24 saat, mapping profile testleri |
| R2 | SiteX RAR dosya adı convention değişimi | Orta | Orta | Robust regex + fallback "manuel atama" UI + monitoring |
| R3 | Teminat heterojen sheet → mektup atlanır | Orta | **Yüksek (finansal)** | Şirket bazlı parser + manuel doğrulama (mor) zorunlu |
| R4 | OCR güvenilirliği düşük (MVP-2) | Yüksek | Orta | OCR güven skoru < 0.85 → mor; manuel ekleme her zaman fallback |
| R5 | Telegram yanlış kanala gönderim | Düşük | Çok Yüksek | 4 aşamalı kapı + Super Admin only mod değişimi + audit |
| R6 | KVKK ihlali (TC log'da görünür) | Düşük | Çok Yüksek | TC/telefon maskeleme middleware + audit testi |
| R7 | Cron duplicate görev üretimi | Orta | Düşük | Idempotency natural key `(sablon, hedef, donem)` |
| R8 | RAR memory taşması (SiteX 277 dosya) | Düşük | Orta | Stream extract + Celery async + chunked |
| R9 | Migration breaking change → prod down | Düşük | Yüksek | Backward-compatible migration kuralı + 2 release'e bölme |
| R10 | Sunucu disk dolması (media + log) | Orta | Orta | Disk monitoring + log rotation + media archive policy |
| R11 | DB backup başarısız ama kimse fark etmiyor | Orta | Çok Yüksek | Backup cron sonuç bildirimi + restore drill |
| R12 | Şifre sıfırlama e-posta SMTP'si yok | Yüksek | Orta | Faz 2'de SMTP konfig zorunlu (ya kurumsal ya 3rd party) |
| R13 | İlk kullanıcı eğitimi yetersiz | Yüksek | Orta | Faz 14'te kullanım kılavuzu + eğitim videosu zorunlu |
| R14 | Geçmiş yıl veri import'u operasyonel akışı bozar | Orta | Yüksek | `historical_data=True` flag — görev/bildirim üretimi suppress |
| R15 | WebSocket scale (chat) | Düşük (MVP-3) | Düşük | Channels + Redis sufficient MVP-3 |

---

## 11. FAZ 2'YE GEÇMEDEN ÖNCE KULLANICI KARARI BEKLEYEN MADDELER

### 11.1 Bloker (Faz 2 başlamadan önce netleşmeli)
| ID | Konu | Öneri |
|---|---|---|
| **D-008** | Çift onaylı ödeme tutar eşiği | Önerimiz: 50.000 TL üzeri çift onay (Müdür + Yönetici) |
| **D-011** | Zorunlu dekont tutar eşiği | Önerimiz: 5.000 TL üzeri zorunlu dekont |
| **D-021** | Tutar eşiği değerleri (genel) | 5K dekont / 50K çift onay önerisi onay |

### 11.2 Yumuşak (Faz 2 sırasında alınabilir)
| ID | Konu |
|---|---|
| D-002 | İlk import sırası (14 adım önerisi onaylı sayılır) |
| D-003 | SiteX ödeme günü daire bazlı override |
| D-004 | Telegram gerçek aktivasyonu hangi kanala (Faz 12) |
| D-005 | Görev atama kuralları detayı |
| D-007 | OCR otomasyon seviyesi (MVP-2) |
| D-009 | Import commit yetki son detayı |
| D-010 | Görüntüleyici export yetkisi |
| D-014 | Domain adı kesinleşmeli (Faz 14 öncesi) |
| D-019 | Çoklu para birimi (LATER) |
| D-020 | Mobil PWA / native (LATER) |
| D-023 | Bildirim saatleri kullanıcı tercihi |
| D-024 | SiteX portal otomatik indirme (LATER) |
| D-025 | Kontör API entegrasyon (LATER) |

---

## 12. ÖZET — FAZ 1 BAŞARI KRİTERLERİ

✅ 12 önceki faz dosyası okundu ve sentezlendi.
✅ 9 teknik plan dokümanı yazıldı (8 plan + 1 rapor).
✅ Tüm bloker kararlar (D-015..D-018) entegre edildi.
✅ 18 Django app planlandı, bağımlılık grafiği çizildi.
✅ ~48 model planlandı, unique constraint tablosu hazır.
✅ Import pipeline 10 adım + 14 import sırası önerildi.
✅ Yetki matrisi 30 satır × 6 rol detaylandırıldı.
✅ Deploy mimarisi (systemd + nginx + backup) detaylandırıldı.
✅ Test stratejisi 14 grup + 18 kritik acceptance hazır.
✅ 15 risk identifiye edildi + mitigasyon planlandı.

❌ Kod yazılmadı.
❌ Django projesi başlatılmadı / migration yok / DB yok.
❌ Import yapılmadı / Telegram/mail gönderilmedi.
❌ Commit/push/deploy yok.
❌ Diğer Acme projelerine dokunulmadı.
❌ Kaynak Excel/RAR/PDF dosyalarına dokunulmadı.
❌ Design canvas dosyalarına dokunulmadı.

---

## 13. ÖNERİLEN SONRAKİ FAZ

**Faz 2 — Base Scaffold**

### Ön koşullar
- ✅ D-015, D-016, D-017, D-018 onaylı.
- ⚠ D-008, D-011, D-021 bekleyen — Faz 2 başlamadan önce karar.
- (Yumuşak) D-014 domain adı — Faz 14 öncesi yeterli.

### Faz 2 girdileri
- `_docs/PHASE1_TECHNICAL_ARCHITECTURE.md` (stack referansı)
- `_docs/PHASE1_DJANGO_APP_PLAN.md` (install order)
- `_docs/PHASE1_DATA_MODEL_PLAN.md` (model alanları)
- `_docs/PHASE1_PERMISSION_AUTH_PLAN.md` (yetki yapısı)
- `_docs/PHASE1_TEST_STRATEGY.md` (test setup)
- `_docs/DESIGN_CLAUDE_CODE_HANDOFF_BRIEF.md` (UI handoff)
- `design-canvas.jsx` (UI referans, prototip)

### Faz 2 çıktı beklentileri
1. Django projesi (`backend/` klasörü, manage.py, settings/{base,local,test,prod}.py).
2. PostgreSQL bağlantısı + ilk migration.
3. `apps.core` (BaseModel, soft-delete, helper).
4. `apps.audit` (middleware + AuditLog).
5. `apps.accounts` (User + 6 Group + bootstrap_users command).
6. `apps.parties` (5 master modeli + CRUD admin).
7. `apps.documents` (Belge + private storage + sha256).
8. Tailwind + IBM Plex font kurulumu + tokens.css.
9. AppShell + TopBar + SideNav (Frame 01) base template'i.
10. Login + Dashboard skeleton (Frame 02 boş).
11. ChatWidgetCollapsed placeholder (henüz aktif değil).
12. CI pipeline (lint + test + migrate check).
13. README + DEPLOYMENT.md (manuel deploy adımları).
14. İlk smoke test: login + master CRUD + audit yazımı.

### Faz 2 onay kapısı
- Login + master CRUD + AuditLog kayıt yazımı + soft-delete + 6 rol Group seed yeşil.
- Dashboard placeholder render.
- Tests yeşil (≥%50 coverage başlangıç).

**Faz 2 sonrası:** Faz 3 (Import Merkezi) → Faz 4 (Fatura/Ödeme) → MVP-1 yolculuğu (Anayasa Madde 5 sırası).

---

## 14. SON SÖZ

Faz 1 planlama tamamlandı. **Tasarım v1.0 + Mimari v1.0** birlikte kod yazımına yeşil ışık veriyor. D-008/D-011/D-021 onayı sonrası Faz 2 başlatılabilir.

**Tahmini Faz 2 süresi:** 1-2 hafta (PHASE0B_MODULE_ROADMAP.md).

**MVP-1 canlı tahmin:** Faz 2 başlangıcından **3-4 ay** sonra (Anayasa roadmap'i).

---

**SON.** Faz 2 Base Scaffold için hazır.
