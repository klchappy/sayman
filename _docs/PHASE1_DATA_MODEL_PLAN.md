# FAZ 1 — VERİ MODELİ PLANI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05

> Faz 0A normalize model taslağının (PHASE0A_NORMALIZED_MODEL_DRAFT.md) teknik finalize edilmesi: alan tipleri, unique constraint'ler, index önerileri, soft-delete davranışı, import ilişkisi, MVP önceliği.

---

## A. ORTAK ÇEKİRDEK

### A.1 BaseModel (abstract — `apps.core`)
- Alanlar: `id` BigAutoField PK, `created_at` DateTime auto, `updated_at` DateTime auto, `created_by` FK→User null, `updated_by` FK→User null, `is_active` Bool default True db_index, `deleted_at` DateTime null, `deleted_by` FK→User null, `delete_reason` Text blank, `notes` Text blank.
- Soft-delete: `objects = SoftDeleteManager()` (is_active=True default), `all_objects = Manager()`.
- `delete()` override → soft. `force_delete()` Super Admin only.
- **MVP-1.**

### A.2 `Sirket` (apps.parties)
- Alanlar: unvan CharField, kisa_kod CharField unique, vergi_dairesi, vergi_no CharField(11) unique, sicil_no CharField (İTO sicil), adres Text, yetkili_sahis FK→Sahis null.
- Index: `kisa_kod`, `sicil_no`.
- Status enum: `AKTIF / IPTAL / TASFIYE_HALINDE`.
- **MVP-1.**

### A.3 `Sahis` (apps.parties)
- Alanlar: ad_soyad CharField, tc_no CharField(11) unique encrypted, telefon CharField(20) encrypted, email EmailField, dogum_tarihi Date null, aile_grubu CharField (örn. ACME).
- TC ve telefon: `django-fernet-fields` veya Postgres `pgcrypto`.
- Index: `aile_grubu`, `ad_soyad` (trigram için pg_trgm).
- **MVP-1.**

### A.4 `Mulk` (apps.parties — kanonik konum)
- Alanlar: isim CharField, mulk_tipi enum (DAIRE/OFIS/FABRIKA/OTEL/ARSA/EV/OTEL_ODA), sahibi_sahis FK null, sahibi_sirket FK null, adres, belediye CharField, ilce CharField, sicil_no CharField (belediye sicil), emlak_vergi_no CharField, pruva34_daire_kodu CharField null unique sparse (A4.17, B2.28).
- Validasyon: `sahibi_sahis OR sahibi_sirket` zorunlu.
- Index: `belediye`, `sicil_no`, `pruva34_daire_kodu`.
- **MVP-1.**

### A.5 `Banka` (apps.parties)
- Alanlar: ad CharField unique, kisa_kod CharField unique, swift CharField null.
- Seed: ALBARAKA, GARANTI, YAPIKREDI, IS_BANKASI, VAKIFBANK, ZIRAAT, AKBANK, etc.
- **MVP-1.**

### A.6 `Kurum` (apps.parties — hizmet sağlayıcı)
- Alanlar: ad CharField, kurum_tipi enum (TELEKOM/ELEKTRIK/DOGALGAZ/SU/BANKA/BELEDIYE/ENTEGRATOR/SGK/ITO/DIGER).
- Seed: TTNET, TÜRK TELEKOM, TURKCELL, CK BOĞAZIÇI, İGDAŞ, İSKİ, FATIH BELEDIYESI, BAKIRKÖY BELEDIYESI, BAYRAMPAŞA BELEDIYESI, MANISA-ŞEHZADELER, vb.
- **MVP-1.**

### A.7 `Belge` (apps.documents)
- Alanlar: dosya FileField (private storage), ad CharField, tip CharField (PDF/JPG/XLSX/...), boyut BigInt, sha256 CharField(64) unique, ozel_sinif enum (FATURA/DEKONT/EKSTRE/EMLAK_BORC/EMLAK_MAKBUZ/TEMINAT/SOZLESME/OCR_KAYNAK/CHAT_EK/IMPORT_KAYNAK), yukleyen FK→User, ait_oldugu_sirket FK null, ait_oldugu_sahis FK null, ait_oldugu_mulk FK null.
- Unique: `sha256` (dedup zorunlu).
- Index: `(ozel_sinif, created_at)`.
- **MVP-1.**

---

## B. FATURA / ÖDEME

### B.1 `Fatura` (apps.finance)
- Alanlar: fatura_no CharField null, fatura_tarihi Date null, son_odeme_tarihi Date, donem_yyyymm CharField(6) check `^[0-9]{6}$`, tutar Decimal(14,2), kdv_dahil Bool, kurum FK→Kurum, ait_oldugu_sahis FK null, ait_oldugu_sirket FK null, ait_oldugu_mulk FK null, abonelik FK→Abonelik null, hizmet_tipi enum (ELEKTRIK/DOGALGAZ/SU/INTERNET/EV_TELEFON/CEP_TELEFON/FAX/AIDAT/KIRA/EMLAK/BAGKUR/ITO/BES/SSK/KONTOR/DIGER), durum enum (BEKLIYOR/ODENMIS/GECIKMIS/IPTAL/KISMI), belge FK→Belge null, import_batch FK→ImportBatch null.
- Unique: `(abonelik, donem_yyyymm)` partial (abonelik IS NOT NULL) — idempotency.
- Index: `(durum, son_odeme_tarihi)`, `(donem_yyyymm)`.
- **MVP-1.**

### B.2 `FaturaKalemi` (apps.finance)
- Alanlar: fatura FK, kalem_adi CharField, miktar Decimal(10,2), birim_fiyat Decimal(14,2), kdv_orani Decimal(5,2), tutar Decimal(14,2).
- **MVP-1** (basit fatura için kullanılmayabilir, abonelikli faturalarda gerekir).

### B.3 `Odeme` (apps.finance)
- Alanlar: fatura FK null (faturasız ödeme için), odeme_tarihi Date, tutar Decimal(14,2), yontem enum (OTOMATIK_TALIMAT/ELDEN/EFT/HAVALE/KREDI_KARTI/NAKIT), banka FK→Banka null, hesap_no CharField null, dekont FK→Belge null, durum enum (TASLAK/ONAYLANDI/IPTAL), mutabakat_durumu enum (BEKLIYOR/MUTABIK/FARKLI), odeyen_kullanici FK→User null, gecikme_gun Integer default 0.
- Index: `(fatura, odeme_tarihi)`, `(yontem, durum)`.
- **MVP-1.**

---

## C. ABONELİK / TAAHHÜT

### C.1 `Abonelik` (apps.subscriptions)
- Alanlar: mulk FK null, sahip_sahis FK null, sahip_sirket FK null, hizmet_tipi (B.1 ile aynı), kurum FK, hesap_no CharField, hizmet_no CharField null, tesisat_no CharField null, telefon_no CharField null, adres Text, paket_adi CharField, paket_tutar Decimal(14,2) null, otomatik_odeme_aktif Bool, otomatik_odeme_banka FK→Banka null, durum enum (AKTIF/IPTAL/ASKIDA/TAAHHUT_BEKLIYOR/IPTAL_DILEKCESI).
- Unique: `(kurum, hesap_no)` partial (hesap_no IS NOT NULL).
- Index: `(durum, otomatik_odeme_aktif)`, `paket_tutar`.
- **MVP-1.**

### C.2 `Taahhut` (apps.subscriptions)
- Alanlar: abonelik FK, baslangic_tarihi Date, bitis_tarihi Date, kampanya_adi CharField, ceza_tutari Decimal null, hatirlat_tarihleri JSONField (örn. `[60, 30, 7]` gün T-).
- Index: `bitis_tarihi`.
- **MVP-1.**

### C.3 `Kampanya` (apps.subscriptions) — sözleşme paketi master
- **MVP-2.**

---

## D. SITEX

### D.1 `SiteXDaire` (apps.pruva)
- Alanlar: daire_kodu CharField(8) unique (A4.17, A4.22, A4.25, B2.28, B3.31), blok CharField(2), kat CharField(3), mulk OneToOne→Mulk, sahip_sahis FK→Sahis, son_odeme_gunu_default Integer default 20.
- Seed: 5 sabit daire.
- **MVP-1.**

### D.2 `SiteXEkstre` (apps.pruva)
- Alanlar: daire FK, yyyymm CharField(6), ekstre_belgesi FK→Belge null, bildirim_yazisi FK→Belge null, aidat_tutari Decimal(14,2), gider_tutari Decimal(14,2) default 0, gecmis_borc Decimal(14,2) default 0, toplam_tutar (calculated), son_odeme_tarihi Date, durum enum (BEKLIYOR/ODENMIS/GECIKMIS/KISMI/EKSIK_EKSTRE).
- Unique: `(daire, yyyymm)`.
- Index: `(durum, son_odeme_tarihi)`.
- **MVP-1.**

### D.3 `SiteXAidatFarki` (apps.pruva)
- Alanlar: daire FK, yyyymm CharField(6), beklenen_tutar, yatan_tutar, fark_tutari (calculated), aciklama Text, durum enum (BEKLIYOR/MUTABIK/AYIKLAMA_GEREKLI).
- **MVP-1.**

### D.4 `SiteXYillikBelge` (apps.pruva)
- Alanlar: yil Integer, belge_tipi enum (BUTCE/DENETIM_RAPORU/EK_BUTCE/ISLETME_MALIYETLERI/GENEL_KURUL_TUTANAGI/FAALIYET_RAPORU/TAPU/DIGER), belge FK→Belge.
- **MVP-1.**

---

## E. EMLAK VERGİSİ

### E.1 `Belediye` (apps.properties)
- Alanlar: ad CharField unique, il, ilce.
- Seed: Bakırköy, Fatih, Bayrampaşa, Beyoğlu, Esenyurt, Manisa-Şehzadeler, Yalova-Termal, Zeytinburnu.
- **MVP-1.**

### E.2 `EmlakVergisi` (apps.properties)
- Alanlar: mulk FK→Mulk, belediye FK→Belediye, yil Integer, donem enum (DONEM_1/DONEM_2), tutar Decimal(14,2), son_odeme_tarihi Date, odeme_durumu enum (ODENMIS/ODENMEDI/KISMI/ITIRAZLI), odeme FK→Odeme null, borc_dokumu FK→Belge null, makbuz FK→Belge null.
- Unique: `(mulk, yil, donem)`.
- Index: `(yil, donem, odeme_durumu)`.
- **MVP-1.**

---

## F. TEMİNAT MEKTUPLARI

### F.1 `TeminatMektubu` (apps.guarantees)
- Alanlar: sirket FK, banka FK, mektup_no CharField, mektup_tipi enum (FIZIKI/ELEKTRONIK), veriliste_tarihi Date, hangi_kuruma CharField, is_aciklamasi CharField, hes_kapsami enum null (KISIK/YENICE/ORTAK/NA), tutar Decimal(14,2), para_birimi CharField default "TRY", komisyon_orani Decimal(5,3), komisyon_periyodu enum (AYLIK/3_AYLIK/6_AYLIK/YILLIK/TEK_SEFER), durum enum (AKTIF/IADE_EDILDI/SURESI_DOLDU/YENILENDI), iade_tarihi Date null, iade_aciklamasi Text.
- Unique: `(banka, mektup_no)`.
- Index: `(durum, son_odeme_tarihi_calc)`.
- **MVP-1.**

### F.2 `TeminatKomisyonOdemesi` (apps.guarantees)
- Alanlar: mektup FK, donem_baslangic Date, donem_bitis Date, tutar Decimal, odeme FK→Odeme null, durum enum (BEKLIYOR/ODENDI/GECIKTI).
- Unique: `(mektup, donem_baslangic)`.
- **MVP-1.**

### F.3 `TeminatIade` (apps.guarantees)
- Alanlar: mektup OneToOne, iade_tarihi Date, sebep Text, belge FK→Belge null.
- **MVP-1.**

---

## G. RESMİ ÖDEMELER

### G.1 `ResmiOdeme` (apps.official_payments)
- Alanlar: tip enum (BAGKUR/SSK/BES/ITO/KGK/GELIR_VERGI/KDV/MTV/DIGER), sahis FK null, sirket FK null, yyyymm CharField(6) null, yil Integer null, taksit_no Integer null (İTO için 1/2), tutar Decimal(14,2), son_odeme_tarihi Date, durum enum (BEKLIYOR/ODENMIS/GECIKMIS/TASLAK), odeme FK→Odeme null, belge FK→Belge null.
- Unique: `(tip, sahis, sirket, yyyymm, taksit_no)` — iki nullable destekli partial unique.
- **MVP-1.**

---

## H. ENTEGRATÖR / KONTÖR

### H.1 `Entegrator` (apps.integrators)
- Alanlar: ad CharField unique (PAPINET/EDM/ETA/DIGITAL_PLANET/FORIBA), kurum FK→Kurum.
- **MVP-2.**

### H.2 `EntegratorSozlesme` (apps.integrators)
- Alanlar: entegrator FK, sirket FK, sozlesme_no CharField null, baslangic_tarihi, bitis_tarihi, yillik_tutar Decimal null, durum enum (AKTIF/BITTI/YENILENDI), belge FK→Belge.
- **MVP-2.**

### H.3 `KontorBakiye` (apps.integrators)
- Alanlar: sirket FK, entegrator FK, hizmet_tipi (e-Fatura/e-Arşiv/e-İrsaliye), bakiye Integer, kritik_esik Integer default 500, son_guncelleme Date.
- Unique: `(sirket, entegrator, hizmet_tipi)`.
- **MVP-2.**

### H.4 `KontorHareket` (apps.integrators)
- Alanlar: bakiye FK, tarih Date, hareket_tipi enum (YUKLEME/KULLANIM/TRANSFER/IPTAL), miktar Integer, fatura FK→Fatura null.
- **MVP-2.**

---

## I. IMPORT

### I.1 `ImportBatch` (apps.imports)
- Alanlar: tip enum (EXCEL/PDF/RAR/KLASOR), hedef_modul CharField, kaynak_dosya FK→Belge, yukleyen FK→User, durum enum (YUKLENDI/ON_IZLEME/ONAY_BEKLIYOR/ONAYLANDI/REDDEDILDI/KISMI_HATA/ROLLBACK_EDILDI), mapping_profile FK→ImportMappingProfile null, toplam_satir Integer, basarili_satir Integer, hatali_satir Integer, uyari_satir Integer, kontrol_satir Integer, commit_zamani DateTime null, rollback_son_tarih DateTime null (commit + 24 saat).
- Index: `(durum, created_at)`.
- **MVP-1.**

### I.2 `ImportSourceFile` (apps.imports)
- Alanlar: batch FK, belge FK→Belge, sheet_adi CharField null (Excel için), sayfa_no Integer null (PDF), ham_satir_sayisi Integer.
- **MVP-1.**

### I.3 `ImportDraftRecord` (apps.imports)
- Alanlar: batch FK, source_file FK→ImportSourceFile, satir_no Integer, ham_veri_json JSONField (Postgres JSONB), parse_edilmis_json JSONField, durum enum (TASLAK/ONAY_BEKLIYOR/ONAYLANDI/REDDEDILDI/HATA/UYARI/KONTROL_GEREKLI), mapping_uyarisi Text null, hedef_kayit_app CharField null, hedef_kayit_id BigInt null.
- Index: `(batch, durum)`, GIN on `parse_edilmis_json`.
- **MVP-1.**

### I.4 `ImportDraftField` (apps.imports — opsiyonel granular)
- Alanlar: draft FK, alan_adi, ham_deger, parse_deger, hata_kodu null, hata_mesaji null.
- **MVP-1** (basit JSON yeterli olabilir, alan-alan mutasyon için ayrı tablo).

### I.5 `ImportLog` (apps.imports)
- Alanlar: batch FK, zaman, kullanici FK, eylem enum (UPLOAD/PARSE/MAPPING/PREVIEW/APPROVE/REJECT/COMMIT/ROLLBACK), detay_json.
- **MVP-1.**

### I.6 `ImportMappingProfile` (apps.imports)
- Alanlar: ad, hedef_modul, kaynak_yapi CharField (örn. ev_abonelikleri_kisi_sheet_v1), mapping_json, owner FK→User, paylasimli Bool default False.
- **MVP-1.**

---

## J. GÖREV

### J.1 `Gorev` (apps.tasks)
- Alanlar: baslik CharField, aciklama Text, atayan FK→User, atanan FK→User, oncelik enum (DUSUK/NORMAL/YUKSEK/ACIL), durum enum (YENI/BASLADI/BEKLIYOR/ERTELENDI/TAMAMLANDI/IPTAL), son_tarih DateTime, tamamlanma_tarihi DateTime null, erteleme_tarihi DateTime null, erteleme_sebebi Text null, bagli_app CharField, bagli_model CharField, bagli_id BigInt, otomatik_uretildi Bool, sablon FK→GorevSablonu null.
- Index: `(atanan, durum, son_tarih)`, `(bagli_app, bagli_model, bagli_id)`.
- **MVP-1.**

### J.2 `GorevYorumu`, `GorevEki`, `GorevGecmisi`, `GorevSablonu` — Faz 0A taslağı ile aynı.
- **MVP-1.**

---

## K. CHAT (MVP-3)

### K.1 `ChatThread`
- Alanlar: baslik CharField null, tip enum (BIREBIR/GRUP/KAYIT_BAGLI), bagli_app/bagli_model/bagli_id (KAYIT_BAGLI için), olusturan FK→User.
- Index: `(bagli_app, bagli_model, bagli_id)`.
- **MVP-3.**

### K.2 `ChatParticipant`, `ChatMessage`, `ChatAttachment`, `ChatReadState`
- Faz 0A taslağı. **MVP-3.**

---

## L. BİLDİRİM

### L.1 `NotificationRule` (apps.notifications)
- Alanlar: ad, modul CharField, hedef_model CharField, tetikleyici_kural JSONField (örn. `{"tip":"T_MINUS","alan":"son_odeme_tarihi","gun":7}`), kanallar JSONField (`["sistem", "telegram"]`), aktif Bool.
- **MVP-1.**

### L.2 `NotificationLog`
- Alanlar: rule FK, hedef_app, hedef_model, hedef_id, kullanici FK→User null, mesaj_baslik, mesaj_govde Text, kanal enum (SISTEM_ICI/EMAIL/TELEGRAM_DRY_RUN/TELEGRAM_TEST/TELEGRAM_GERCEK), durum enum (BEKLIYOR/GONDERILDI/BASARISIZ/IPTAL), zaman.
- Index: `(durum, zaman)`, `(kullanici, okundu_mu)`.
- **MVP-1.**

### L.3 `NotificationDeliveryAttempt`
- Alanlar: log FK, deneme_no Integer, kanal, sonuc, hata_mesaji, zaman.
- **MVP-1.**

### L.4 `TelegramKonfig`
- Alanlar: bot_token (encrypted), chat_id, mod enum (DRY_RUN/TEST/GERCEK), aktif Bool.
- Singleton (only one row).
- **MVP-1.**

---

## M. AUDIT

### M.1 `AuditLog` (apps.audit)
- Alanlar: kullanici FK→User null, zaman DateTime, ip CharField null, user_agent Text null, model CharField, kayit_id BigInt, eylem enum (CREATE/UPDATE/DELETE/SOFT_DELETE/IMPORT_APPROVE/IMPORT_REJECT/IMPORT_ROLLBACK/LOGIN/LOGOUT/EXPORT/PERMISSION_CHANGE/HARD_DELETE), eski_deger_json JSONB null, yeni_deger_json JSONB null, modul CharField, kritik Bool default False.
- Index: `(kullanici, zaman)`, `(model, kayit_id)`, `(kritik, zaman)`, GIN on `yeni_deger_json`.
- Saklama: 2 yıl minimum (Anayasa 12.7).
- **MVP-1.**

---

## N. UNIQUE CONSTRAİNT ÖZET

| Model | Unique |
|---|---|
| Sirket | (vergi_no), (kisa_kod) |
| Sahis | (tc_no encrypted hash) |
| Mulk | (pruva34_daire_kodu) partial |
| Belge | (sha256) |
| Fatura | (abonelik, donem_yyyymm) partial |
| Abonelik | (kurum, hesap_no) partial |
| SiteXDaire | (daire_kodu) |
| SiteXEkstre | (daire, yyyymm) |
| EmlakVergisi | (mulk, yil, donem) |
| TeminatMektubu | (banka, mektup_no) |
| TeminatKomisyonOdemesi | (mektup, donem_baslangic) |
| ResmiOdeme | (tip, sahis OR sirket, yyyymm, taksit_no) |
| KontorBakiye | (sirket, entegrator, hizmet_tipi) |
| ImportMappingProfile | (ad, owner) |
| Gorev | — (otomatik üretim için sablon+hedef+donem ayrı index) |
| AuditLog | — (sadece index) |

---

## O. SOFT-DELETE / ARCHIVE DAVRANIŞI

| Model Grubu | Soft | Hard | Arşiv |
|---|---|---|---|
| Master (Sirket, Sahis, Mulk, Banka, Kurum) | ✅ | Super Admin only | — |
| Fatura, Odeme | ✅ | Super Admin + sebep | LATER (yıllık) |
| Abonelik, Taahhut | ✅ | Yasak | — |
| SiteX* | ✅ | Yasak | — |
| EmlakVergisi | ✅ | Yasak | — |
| TeminatMektubu | ✅ (durum=IADE) | Yasak | — |
| ResmiOdeme | ✅ | Yasak | — |
| Gorev (tamamlanan) | ✅ | — | yıllık arşiv (LATER) |
| Belge | ⚠ Belge kaydı soft, dosya 30 gün sonra silinebilir (LATER) | Super Admin | — |
| AuditLog | ❌ HİÇ silinmez | — | 2+ yıl saklama, sonra LATER taşıma |
| ImportBatch | ✅ (rollback sonrası) | — | yıllık |

---

## P. IMPORT İLE İLİŞKİ

Her model'in `import_batch FK→ImportBatch null` veya `import_draft FK→ImportDraftRecord null` alanı olabilir (kaynağı bilmek için).

`Belge.ozel_sinif=IMPORT_KAYNAK` yüklenen Excel/RAR dosyasının kalıcı arşivi.

---

## Q. MVP-1 GİREN MODEL SAYISI

- A. Çekirdek: 7
- B. Fatura/Ödeme: 3
- C. Abonelik: 2 (Kampanya MVP-2)
- D. SiteX: 4
- E. Emlak: 2
- F. Teminat: 3
- G. Resmi: 1
- I. Import: 6
- J. Görev: 5
- L. Bildirim: 4
- M. Audit: 1

**MVP-1 toplam ~38 model.** MVP-2 +5 (Entegratör/Kontör), MVP-3 +5 (Chat) = ~48 model genel.

---

**SON.** Faz 2 Base Scaffold'da bu plan doğrultusunda Django modelleri yazılır.
