# Faz 9 — ETA / Papinet / EDM / Entegratör / Kontör · Manual MVP Raporu

**Statü:** ✅ TAMAMLANDI
**Tarih:** 2026-05-07
**Anayasa Maddesi:** 1.5 (izolasyon), 3.4 (onaysız domain commit yok), 3.5 (audit), 3.8 (soft-delete), 3.16 (yyyy long-format), 11 (DESIGN_FREEZE).
**Test:** 237/237 PASS · `python manage.py check` PASS · `python manage.py migrate` PASS.

---

## 1. Kapsam

Faz 9, MUHASEBE OPERASYON SİSTEMİ'nin **Entegratör Yazılım Hizmetleri & Kontör Paketleri Manual MVP**'sidir. Hedef: ETA, Papinet, EDM, Dijital Gezegen vb. sağlayıcılar altında yazılım hizmetlerinin (e-Fatura, e-Arşiv, e-İrsaliye, e-Defter, defter saklama, sürüm yenileme, kontör paketi) yaşam döngüsünü, sözleşme yenileme zincirini, kontör tüketim takibini, kritik/tükenmiş kontör uyarılarını ve PayableItem entegrasyonunu eksiksiz manuel olarak işleten modüldür.

> **Manual MVP felsefesi:** Telegram, cron, otomatik scraping, Excel/PDF/RAR/ZIP ayrıştırma YOKTUR. PAPINET/* kaynak dosyalarına dokunulmadı. Kullanıcı UI'dan girer; servisler hesaplar.

---

## 2. apps.integrators — 4 Model

| Model | Önemli Alanlar | Unique | Notlar |
|-------|----------------|--------|--------|
| `SoftwareService` | owner_company/person, provider_name, provider_type, service_type, title, customer_no, account_no, status, notes | — | 5 status (ACTIVE/PASSIVE/CANCELLED/RENEWED/NEEDS_REVIEW); 5 sağlayıcı tipi (ETA/PAPINET/EDM/DIGITAL_PLANET/OTHER); 9 hizmet tipi |
| `ServiceContract` | service FK CASCADE, contract_type, title, start_date, end_date, renewal_date, amount, currency, payable (O2O SET_NULL), status, renewed_from/to (self FK), notes | (service, title, start_date) | 7 status (DRAFT/ACTIVE/APPROACHING/EXPIRED/RENEWED/CANCELLED/NEEDS_REVIEW); `due_date` property = renewal_date or end_date or today |
| `CreditPackage` | service FK, package_name, purchase_date, total_credits, remaining_credits, critical_threshold (default 100), amount, currency, payable (O2O SET_NULL), status, notes | (service, package_name, purchase_date) | 5 status (ACTIVE/CRITICAL/EXHAUSTED/CANCELLED/NEEDS_REVIEW); `usage_percentage` property |
| `IntegratorDocument` | service?, contract?, credit_package?, document (PROTECT), document_role, uploaded_by | (service, contract, credit_package, document, document_role) | 7 rol (CONTRACT/TARIFF/INVOICE/RECEIPT/CREDIT_PURCHASE/RENEWAL_DOCUMENT/OTHER) |

`ServiceContract` ve `CreditPackage`, PayableItem köprüsü için `owner_type/company/person/amount/currency/due_date` property'lerine sahiptir → `apps.finance.services.period_link.create_payable_from_period` doğrudan kullanılabilir.

---

## 3. Servisler — `services/integrators.py`

| Fonksiyon | Sözleşme |
|-----------|----------|
| `create_service` | Yeni hizmet + audit |
| `update_service` | Diff + audit |
| `archive_service / restore_service` | Soft-delete |
| `cancel_service` | status=CANCELLED + audit |
| `create_contract` | service CANCELLED/PASSIVE ise blok |
| `update_contract` | Diff + audit |
| `cancel_contract` | status=CANCELLED; payable cascade `cancel_payable` |
| `renew_contract` | Yeni sözleşme oluşturur; old.status=RENEWED, old.renewed_to=new, new.renewed_from=old; closed sözleşme yenilenemez |
| `calculate_contract_status` | renewal_date < today → EXPIRED, ≤30 gün → APPROACHING |
| `create_credit_package` | remaining default = total; `calculate_credit_status` ile başlangıç status |
| `update_credit_usage(remaining)` | 0 ≤ remaining ≤ total validasyon; status yeniden hesap |
| `cancel_credit_package` | status=CANCELLED; payable cascade |
| `calculate_credit_status` | remaining ≤ 0 → EXHAUSTED, ≤ threshold → CRITICAL, aksi ACTIVE |
| `create_payable_from_contract` | İdempotent; CANCELLED/RENEWED contract veya CANCELLED service'te blok; başlık `"Entegratör Sözleşme — {service.title} — {contract.title}"`, kategori `INTEGRATOR_CONTRACT` |
| `create_payable_from_credit_package` | İdempotent; CANCELLED package/service'te blok; başlık `"Kontör Paketi — {service.title} — {package.package_name}"`, kategori `CREDIT_PACKAGE` |
| `attach_integrator_document` | get_or_create dedup; service/contract/credit_package'tan biri zorunlu |

**Audit Coverage:** Tüm mutator servisler `audit_log(actor, action, target_type, target_id, payload)` çağırır.

---

## 4. UI / URL — 22 Endpoint

```
/integrators/                                    → list (+ KPI'lar + filtre)
/integrators/new/                                → create (WriteMixin)
/integrators/<pk>/                               → detail
/integrators/<pk>/edit/                          → update (WriteMixin)
/integrators/<pk>/archive/                       → archive (WriteMixin)
/integrators/<pk>/restore/                       → restore (WriteMixin)
/integrators/<pk>/cancel/                        → cancel (ApproveMixin)
/integrators/<pk>/contracts/new/                 → contract_create (WriteMixin)
/integrators/contracts/<pk>/                     → contract_detail
/integrators/contracts/<pk>/edit/                → contract_update (WriteMixin)
/integrators/contracts/<pk>/renew/               → contract_renew (ApproveMixin)
/integrators/contracts/<pk>/cancel/              → contract_cancel (ApproveMixin)
/integrators/contracts/<pk>/create-payable/      → contract_create_payable (WriteMixin)
/integrators/<pk>/credits/new/                   → credit_create (WriteMixin)
/integrators/credits/<pk>/                       → credit_detail
/integrators/credits/<pk>/edit/                  → credit_update (WriteMixin)
/integrators/credits/<pk>/usage/                 → credit_usage_update (WriteMixin)
/integrators/credits/<pk>/cancel/                → credit_cancel (ApproveMixin)
/integrators/credits/<pk>/create-payable/        → credit_create_payable (WriteMixin)
/integrators/<pk>/documents/upload/              → service_add_document (WriteMixin)
/integrators/contracts/<pk>/documents/upload/    → contract_add_document (WriteMixin)
/integrators/credits/<pk>/documents/upload/      → credit_add_document (WriteMixin)
```

**Şablonlar (10):** service_list, service_form, service_detail, contract_form, contract_detail, contract_renew, credit_package_form, credit_package_detail, credit_usage_update, document_upload.

**Yetki ayrımı (Anayasa 3.4):**
- **WriteMixin** (`can_write`): create/update/archive/restore/document/payable/credit_usage
- **ApproveMixin** (`can_approve`): cancel/renew — geri alınamaz lifecycle aksiyonları için yönetici yetkisi gerekir

Sidebar `🔌 Entegratör / Kontör` linki placeholder'dan `integrators:list`'e güncellendi.

---

## 5. Dashboard Entegrasyonu

`apps.dashboard.views.DashboardHomeView` içine `phase9_integrators` context'i eklendi:
- **active_services** — ACTIVE statüde hizmet sayısı
- **approaching_contracts** — sonraki 30 gün içinde yenilenmesi gereken sözleşmeler (ilk 5)
- **critical_credits** — CRITICAL/EXHAUSTED kontör paketleri (ilk 5)
- **exhausted_count** — EXHAUSTED kontör paketi sayısı
- **linked_payables** — payable'a bağlanmış sözleşme + kontör paketi sayısı

`templates/dashboard/home.html` Faz 9 widget bloğu `phase8_guarantee` sonrasında, "Yaklaşan Ödemeler" öncesinde yerleştirildi. Risk kartı **"Kontör Kritik"** artık placeholder değil; canlı CreditPackage sorgusu üzerinden EXHAUSTED varsa `danger`, sadece CRITICAL varsa `warning` rengi alır.

---

## 6. Test Kanıtı

`tests/test_phase9.py` · **38 test PASS** · 10 test class:

- `ServiceLifecycleTest` (4) — create_writes_audit, update, archive_restore, cancel_sets_status
- `ContractTest` (8) — create, update, blocked_for_cancelled_service (ValidationError), status_approaching (≤30g), status_expired, renew_links_old_new, renew_blocked_when_closed, cancel
- `CreditPackageTest` (7) — create, update_remaining, critical_threshold (≤ threshold → CRITICAL), exhausted (=0 → EXHAUSTED), remaining_cannot_exceed_total, cancel, calculate_helper
- `PayableLinkTest` (7) — create_from_contract (12000.00, INTEGRATOR_CONTRACT), idempotent_contract, from_credit (CREDIT_PACKAGE), idempotent_credit, cancelled_contract_blocks, cancelled_credit_blocks, finance_thresholds (60K → her iki flag True)
- `DocumentTest` (2) — sha256 dedup, CREDIT_PURCHASE attach
- `PermissionTest` (3) — viewer 403 create, muhasebeci 403 contract_renew, super_admin 200 contract_renew
- `ListViewTest` (1) — list smoke (KPI render)
- `SidebarAndWidgetTest` (2) — sidebar `/integrators/` aktif + widget render
- `DesignContractTest` (1) — `templates/integrators/` altında dark mode / Inter / JetBrains yok
- `NoOpGuardTest` (3) — apps/integrators altında import command yok, telegram yok, imports.commit SoftwareService yaratmıyor

**Tam suite:** **237/237 PASS** (önceki 199 + Faz 9: 38).

```
$ python manage.py test
Ran 237 tests in 151.847s
OK
```

---

## 7. Anayasa Uyumu

| Madde | Kontrol | Sonuç |
|-------|---------|-------|
| 1.5 (izolasyon) | Kaynak PAPINET/* dosyaları okunmadı/değiştirilmedi; gerçek sağlayıcı/sözleşme/tutar koda gömülmedi | ✅ |
| 3.4 (onaysız commit yok) | cancel/renew için ApproveMixin (can_approve) zorunlu | ✅ |
| 3.5 (audit) | Tüm 17+ service mutator audit_log yazıyor | ✅ |
| 3.8 (soft-delete) | BaseModel kalıtım, archive/restore destekli | ✅ |
| 3.16 (yyyy long-format) | Sözleşme/period etiketlerinde 4 haneli yıl + `YYYY-MM` formatı | ✅ |
| 11 (DESIGN_FREEZE) | Dark mode YOK, IBM Plex var, Inter/JetBrains YOK | ✅ |

**Hardcode YOK:** Faz 9'da tek bir gerçek sağlayıcı, müşteri no, sözleşme no, kontör adedi koda gömülmedi. Tüm domain veriler UI'dan girilir.

**NO-OP imports:** `apps.imports.commit` SoftwareService/ServiceContract/CreditPackage yaratmaz; Faz 9 testi bunu doğrular. Hiçbir Excel/PDF/RAR/ZIP ayrıştırma kodu eklenmedi.

---

## 8. Sonuç

Faz 9 Manual MVP **production-ready** durumdadır. 4 model + 17+ servis + 22 URL + 10 şablon + dashboard widget ile entegratör yaşam döngüsü (hizmet → sözleşme → kontör paketi → PayableItem köprüsü → yenileme zinciri / kontör tüketim takibi) eksiksiz manuel olarak çalışır. PayableItem entegrasyonu Faz 5/6/7/8 ile aynı `period_link` helper üzerinden idempotent şekilde devrededir; 5K dekont ve 50K çift onay eşikleri otomatik uygulanır. Yenileme zinciri (`renewed_from/to` self FK) sözleşme tarihçesini kalıcı korur. Kontör status motoru (ACTIVE → CRITICAL → EXHAUSTED) `critical_threshold` parametresi üzerinden çalışır.

**Sonraki Faz:** TBD — Faz 9 bağımsız tamamlandı; sonraki adım kullanıcı önceliğine göre belirlenecek.
