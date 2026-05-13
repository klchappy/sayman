# FAZ 0A — NORMALİZE VERİ MODELİ TASLAĞI
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Faz:** 0A — Normalize veri modeli (read-only taslak)
**Tarih:** 2026-05-05

> **ÖNEMLİ:** Aşağıdaki taslak Excel matrislerini birebir TAKLİT ETMEZ. Tüm "kişi × ay" matrisleri "long-format" (her satır = 1 dönemsel kayıt) yapıya dönüştürülmüştür. Bu dosya kod değildir; alanlar Türkçe-İngilizce karışık tanım amaçlıdır. Faz 1/2'de Django model olarak finalize edilir.

---

## 0. ORTAK ALANLAR (BaseModel)

Tüm modeller şunları içerir:

```
id                BigInt PK
created_at        DateTime
updated_at        DateTime
created_by        FK → User (nullable for system import)
updated_by        FK → User
is_active         Bool default True
notes             Text nullable
```

---

## 1. KİŞİ / ŞİRKET / MÜLK ÇEKİRDEK

### 1.1 `Sahis`
```
ad_soyad          CharField
tc_no             CharField(11) unique nullable
telefon, email
dogum_tarihi      Date nullable
aile_grubu        CharField (ACME_AILESI vb.)
```

### 1.2 `Sirket`
```
unvan             CharField
kisa_ad           CharField   (ACME_TEKSTIL, BETA_BRODE, KC_IPLIK, ACME_ENERJI_KISIK, ACME_ENERJI_YENICE, MAKYAPI, MDT, FMK, BETA_OTEL ...)
vergi_dairesi
vergi_no
sicil_no                       (İTO sicil)
adres
yetkili_sahis     FK → Sahis nullable
```

### 1.3 `Mulk`
```
isim              CharField   (örn. "SiteX A4 Daire 17", "Yeniçe HES Bina")
mulk_tipi         enum (DAIRE, OFIS, FABRIKA, OTEL, ARSA, EV)
sahibi_sahis      FK → Sahis nullable
sahibi_sirket     FK → Sirket nullable
adres
belediye          CharField
ilce
sicil_no                       (Belediye sicil)
emlak_vergi_no
pruva34_daire_kodu CharField nullable  (A4.17, B2.28 ...)
```

### 1.4 `Banka`
```
ad   (ALBARAKA, GARANTI, YAPIKREDI, ...)
kisa_kod
```

---

## 2. FATURA / ÖDEME ÇEKİRDEK

### 2.1 `Fatura`
```
fatura_no         CharField nullable
fatura_tarihi     Date
son_odeme_tarihi  Date
donem_yyyymm      CharField(6)   (örn. "202501")
tutar             Decimal(14,2)
kdv_dahil_mi      Bool
kurum             FK → Kurum (TTNet, CK Boğaziçi, İGDAŞ, İSKİ, Belediye, ...)
ait_oldugu_sahis  FK → Sahis nullable
ait_oldugu_sirket FK → Sirket nullable
ait_oldugu_mulk   FK → Mulk nullable
abonelik          FK → Abonelik nullable
hizmet_tipi       enum (ELEKTRIK, DOGALGAZ, SU, INTERNET, EV_TELEFON, CEP_TELEFON, FAX, AIDAT, KIRA, EMLAK, BAGKUR, ITO, BES, SSK, KONTOR, DIGER)
fatura_durumu     enum (BEKLIYOR, ODENMIS, GECIKMIS, IPTAL)
belge             FK → Belge nullable
import_batch      FK → ImportBatch nullable
```

### 2.2 `Odeme`
```
fatura            FK → Fatura nullable    (faturasız ödeme için nullable)
odeme_tarihi      Date
tutar             Decimal(14,2)
yontem            enum (OTOMATIK_TALIMAT, ELDEN, EFT, HAVALE, KREDI_KARTI, NAKIT, BANKA_HAVALE)
banka             FK → Banka nullable
hesap_no          CharField nullable
dekont            FK → Belge nullable
durum             enum (TASLAK, ONAYLANDI, IPTAL)
mutabakat_durumu  enum (BEKLIYOR, MUTABIK, FARKLI)
odeyen_kullanici  FK → User nullable
```

### 2.3 `Kurum`
```
ad                             (TTNET, TÜRK TELEKOM, TURKCELL, CK BOĞAZIÇI, İGDAŞ, İSKİ, ALBARAKA, GARANTİ, FATIH BELEDIYESI, ...)
kurum_tipi        enum (TELEKOM, ELEKTRIK, DOGALGAZ, SU, BANKA, BELEDIYE, ENTEGRATOR, SGK, ITO, DIGER)
```

---

## 3. ABONELİK / TAAHHÜT

### 3.1 `Abonelik`
```
mulk              FK → Mulk nullable
sahip_sahis       FK → Sahis nullable
sahip_sirket      FK → Sirket nullable
hizmet_tipi       enum (modul 2.1 ile aynı)
kurum             FK → Kurum
hesap_no          CharField
hizmet_no         CharField nullable
tesisat_no        CharField nullable
telefon_no        CharField nullable
adres             Text
paket_adi         CharField (örn. "EV AVANTAJ 100", "İŞTE GÜÇLENDİREN KAMPANYA_5")
paket_tutar       Decimal(14,2) nullable
otomatik_odeme_aktif  Bool
otomatik_odeme_banka  FK → Banka nullable
durum             enum (AKTIF, IPTAL, ASKIDA, TAAHHUT_BEKLIYOR)
```

### 3.2 `Taahhut`
```
abonelik          FK → Abonelik
baslangic_tarihi  Date
bitis_tarihi      Date
kampanya_adi      CharField
ceza_tutari       Decimal nullable
hatirlat_tarihleri JSON  [T-60, T-30, T-7]
```

---

## 4. SITEX (ALT-MODÜL)

### 4.1 `SiteXDaire`
```
daire_kodu        CharField unique  (A4.17, A4.22, A4.25, B2.28, B3.31)
blok              CharField
kat               CharField
mulk              FK → Mulk
sahip_sahis       FK → Sahis        (Test, Kaan, Ali, Mehmet Ali ...)
```

### 4.2 `SiteXEkstre`
```
daire             FK → SiteXDaire
yyyymm            CharField(6)
ekstre_belgesi    FK → Belge        (PDF)
bildirim_yazisi   FK → Belge nullable
aidat_tutari      Decimal(14,2)
gider_tutari      Decimal(14,2)
toplam_tutar      Decimal(14,2)
son_odeme_tarihi  Date
durum             enum (BEKLIYOR, ODENMIS, GECIKMIS, KISMI)
unique_together   (daire, yyyymm)
```

### 4.3 `SiteXAidatFarki`
```
daire             FK → SiteXDaire
yyyymm
fark_tutari       Decimal
aciklama          Text
durum             enum (BEKLIYOR, MUTABIK)
```

### 4.4 `SiteXYillikBelge`
```
yil               Integer
belge_tipi        enum (BUTCE, DENETIM_RAPORU, EK_BUTCE, ISLETME_MALIYETLERI, GENEL_KURUL_TUTANAGI, FAALIYET_RAPORU)
belge             FK → Belge
```

---

## 5. EMLAK VERGİSİ

### 5.1 `EmlakVergisi`
```
mulk              FK → Mulk
yil               Integer
donem             enum (DONEM_1, DONEM_2)
tutar             Decimal(14,2)
son_odeme_tarihi  Date
odeme_durumu      enum (ODENMIS, ODENMEDI, KISMI, ITIRAZLI)
odeme             FK → Odeme nullable
borc_dokumu       FK → Belge nullable
makbuz            FK → Belge nullable
unique_together   (mulk, yil, donem)
```

---

## 6. TEMİNAT MEKTUPLARI

### 6.1 `TeminatMektubu`
```
sirket            FK → Sirket             (Acme Enerji / Beta Tekstil / Acme Tekstil)
banka             FK → Banka
mektup_no         CharField unique
mektup_tipi       enum (FIZIKI, ELEKTRONIK)
veriliste_tarihi  Date
hangi_kuruma      CharField   (EPİAŞ, TEİAŞ, CK BOĞAZİÇİ, FATIH BELEDIYESI vs.)
hes_kapsami       enum nullable (KISIK, YENICE, ORTAK)
tutar             Decimal(14,2)
para_birimi       CharField default "TRY"
komisyon_orani    Decimal(5,3)
komisyon_tutari   Decimal(14,2)
komisyon_periyodu enum (AYLIK, 3_AYLIK, 6_AYLIK, YILLIK)
durum             enum (AKTIF, IADE_EDILDI, SURESI_DOLDU)
iade_tarihi       Date nullable
```

### 6.2 `TeminatKomisyonOdemesi`
```
mektup            FK → TeminatMektubu
donem_baslangic   Date
donem_bitis       Date
tutar             Decimal
odeme             FK → Odeme nullable
durum             enum (BEKLIYOR, ODENDI, GECIKTI)
```

---

## 7. RESMİ ÖDEMELER

### 7.1 `ResmiOdeme`
```
tip               enum (BAGKUR, SSK, BES, ITO, KGK, GELIR_VERGI, KDV, MTV, DIGER)
sahis             FK → Sahis nullable
sirket            FK → Sirket nullable
yyyymm            CharField(6) nullable
yil               Integer nullable
taksit_no         Integer nullable    (İTO için 1/2)
tutar             Decimal
son_odeme_tarihi  Date
durum             enum (BEKLIYOR, ODENMIS, GECIKMIS)
odeme             FK → Odeme nullable
belge             FK → Belge nullable
```

---

## 8. KİRA

### 8.1 `KiraSozlesmesi`
```
kiraci_sirket     FK → Sirket
kiralayan_sirket  FK → Sirket
mulk              FK → Mulk nullable
baslangic_tarihi  Date
bitis_tarihi      Date nullable
odeme_gunu        Integer (1-31)
durum             enum (AKTIF, BITTI, FESIH)
```

### 8.2 `KiraDonemTutar`
```
sozlesme          FK → KiraSozlesmesi
yil               Integer
aylik_tutar       Decimal
artis_orani       Decimal nullable
unique_together   (sozlesme, yil)
```

### 8.3 `KiraOdeme`
```
sozlesme          FK → KiraSozlesmesi
yyyymm
beklenen_tutar    Decimal
odeme             FK → Odeme nullable
durum             enum (BEKLIYOR, ODENDI, GECIKTI)
unique_together   (sozlesme, yyyymm)
```

---

## 9. ETA / PAPİNET / ENTEGRATÖR / KONTÖR

### 9.1 `Entegrator`
```
ad   (PAPINET, EDM, ETA, FORIBA, ...)
kurum             FK → Kurum
```

### 9.2 `EntegratorSozlesme`
```
entegrator        FK → Entegrator
sirket            FK → Sirket
sozlesme_no       CharField nullable
baslangic_tarihi  Date
bitis_tarihi      Date
yillik_tutar      Decimal nullable
durum             enum (AKTIF, BITTI, YENILENDI)
belge             FK → Belge
```

### 9.3 `KontorBakiye`
```
sirket            FK → Sirket
entegrator        FK → Entegrator
bakiye            Integer
guncelleme_tarihi Date
kritik_esik       Integer default 500
unique_together   (sirket, entegrator)
```

### 9.4 `KontorHareket`
```
bakiye            FK → KontorBakiye
tarih             Date
hareket_tipi      enum (YUKLEME, KULLANIM, TRANSFER, IPTAL)
miktar            Integer
fatura            FK → Fatura nullable
```

---

## 10. AJANDA / GÖREV

### 10.1 `Gorev`
```
baslik            CharField
aciklama          Text
atayan            FK → User
atanan            FK → User
oncelik           enum (DUSUK, NORMAL, YUKSEK, ACIL)
durum             enum (YENI, BASLADI, BEKLIYOR, ERTELENDI, TAMAMLANDI, IPTAL)
son_tarih         DateTime
tamamlanma_tarihi DateTime nullable
erteleme_tarihi   DateTime nullable
erteleme_sebebi   Text nullable
bagli_model       CharField     (Generic FK app+model)
bagli_id          BigInt
otomatik_uretildi Bool default False
sablon            FK → GorevSablonu nullable
```

### 10.2 `GorevYorumu`
```
gorev             FK → Gorev
kullanici         FK → User
yorum             Text
zaman             DateTime
```

### 10.3 `GorevEki`
```
gorev             FK → Gorev
belge             FK → Belge
yukleyen          FK → User
```

### 10.4 `GorevGecmisi` (audit)
```
gorev             FK → Gorev
kullanici         FK → User
eylem             enum (OLUSTURULDU, ATAMA_DEGISTI, DURUM_DEGISTI, ERTELENDI, YORUM, EK_EKLENDI, TAMAMLANDI)
detay_json        JSON
zaman             DateTime
```

### 10.5 `GorevSablonu`
```
ad
hangi_model       CharField   (örn. EmlakVergisi, SiteXEkstre, ResmiOdeme)
tetikleyici_kural JSON         (örn. {"tip": "T_MINUS_DAYS", "alan": "son_odeme_tarihi", "gun": 7})
varsayilan_atanan FK → User nullable
oncelik           enum
```

---

## 11. CHAT

### 11.1 `ChatThread`
```
baslik            CharField nullable
tip               enum (BIREBIR, GRUP, KAYIT_BAGLI)
bagli_model       CharField nullable
bagli_id          BigInt nullable
olusturan         FK → User
```

### 11.2 `ChatParticipant`
```
thread            FK → ChatThread
kullanici         FK → User
rol               enum (UYE, ADMIN)
katildi           DateTime
ayrildi           DateTime nullable
unique_together   (thread, kullanici)
```

### 11.3 `ChatMessage`
```
thread            FK → ChatThread
gonderen          FK → User
icerik            Text
zaman             DateTime
ek                FK → Belge nullable
silindi           Bool
```

### 11.4 `ChatOkundu`
```
mesaj             FK → ChatMessage
kullanici         FK → User
zaman             DateTime
unique_together   (mesaj, kullanici)
```

---

## 12. IMPORT / DOSYA / LOG

### 12.1 `ImportBatch`
```
tip               enum (EXCEL, PDF, RAR, KLASOR)
hedef_modul       CharField   (FATURA, ODEME, EMLAK, SITEX, TEMINAT, ABONELIK, RESMI, KIRA)
kaynak_dosya      FileField
yukleyen          FK → User
durum             enum (YUKLENDI, ON_IZLEME, ONAY_BEKLIYOR, ONAYLANDI, REDDEDILDI, KISMI_HATA)
toplam_satir      Integer
basarili_satir    Integer
hatali_satir      Integer
notlar            Text
```

### 12.2 `ImportDraft`
```
batch             FK → ImportBatch
satir_no          Integer
ham_veri_json     JSON
parse_edilmis_json JSON
mapping_uyarisi   Text nullable
durum             enum (TASLAK, ONAYLANDI, REDDEDILDI, HATA)
hedef_kayit_app   CharField nullable
hedef_kayit_id    BigInt nullable      (onaylanınca yaratılan kayıt FK)
```

### 12.3 `ImportLog`
```
batch             FK → ImportBatch
zaman             DateTime
kullanici         FK → User
eylem             enum (UPLOAD, PARSE, MAPPING, PREVIEW, APPROVE, REJECT, COMMIT, ROLLBACK)
detay_json        JSON
```

### 12.4 `ImportMapping` (kaydedilebilir mapping şablonu)
```
ad
hedef_modul
kaynak_yapi       CharField   (örn. "ev_abonelikleri_kisi_sheet_v1")
mapping_json      JSON        (kolon → alan eşleşmesi)
```

### 12.5 `Belge` (genel dosya)
```
dosya             FileField
ad                CharField
tip               enum (PDF, JPG, PNG, XLSX, DOC, DIGER)
boyut             Integer
sha256            CharField
yukleyen          FK → User
ozel_sinif        enum nullable (FATURA, DEKONT, EKSTRE, EMLAK_BORC, EMLAK_MAKBUZ, TEMINAT_MEKTUBU, SOZLESME, OCR_KAYNAK)
```

---

## 13. BİLDİRİM

### 13.1 `Bildirim`
```
kullanici         FK → User
baslik
mesaj
seviye            enum (INFO, UYARI, ACIL)
bagli_model       CharField nullable
bagli_id          BigInt nullable
okundu            Bool
zaman             DateTime
```

### 13.2 `NotificationLog`
```
bildirim          FK → Bildirim
kanal             enum (SISTEM_ICI, EMAIL, TELEGRAM_DRY_RUN, TELEGRAM_TEST, TELEGRAM_GERCEK)
durum             enum (BEKLIYOR, GONDERILDI, BASARISIZ)
hata              Text nullable
zaman             DateTime
```

### 13.3 `TelegramKonfig`
```
bot_token         CharField (encrypted)
chat_id           CharField
mod               enum (DRY_RUN, TEST, GERCEK)
```

---

## 14. AUDIT

### 14.1 `AuditLog`
```
kullanici         FK → User nullable    (sistem aksiyonu için null)
zaman             DateTime
ip                CharField nullable
model             CharField     (app_label.ModelName)
kayit_id          BigInt
eylem             enum (CREATE, UPDATE, DELETE, IMPORT_APPROVE, IMPORT_REJECT, LOGIN, LOGOUT, EXPORT)
eski_deger_json   JSON nullable
yeni_deger_json   JSON nullable
modul             CharField     (FATURA, ODEME, ...)
```

---

## 15. EXCEL ↔ MODEL EŞLEME ÖZETİ

| Excel | Source Pattern | Hedef Model(ler) |
|---|---|---|
| BAĞKUR | (Şahıs, OCAK..ARALIK) | `ResmiOdeme(tip=BAGKUR, sahis, yyyymm, tutar, odeme)` |
| EV ABONELİKLERİ — meta sheet | (Hesap No, Kurum, Paket Tutar, Taahhüt Bitiş) | `Abonelik` + `Taahhut` |
| EV ABONELİKLERİ — kişi tab | (Firma, Hesap, OCAK..ARALIK Son Ödeme & Tutar) | `Fatura` + `Odeme` per (abonelik, yyyymm) |
| ŞAHISLAR OTOMATİK ÖDEME | Aynı | Aynı |
| ŞİRKET ABONELİKLERİ | (Hesap, Hizmet, Kurum, Firma, Paket, Taahhüt Bitiş) | `Abonelik` + `Taahhut` |
| ÖDEMELER OTOMATİKLER VE ELDEN | Şirket sheet → (Hizmet, OCAK..ARALIK Son Ödeme & Tutar) | `Fatura` + `Odeme` |
| ÖDEMELER TAKİP ÇİZELGESİ KİRALAR | Yıl sheet → (Şirket, OCAK..ARALIK tarih) | `KiraSozlesmesi` + `KiraDonemTutar` + `KiraOdeme` |
| ÖDEMELER TAKİP — EMLAK sheet | (Firma, Belediye, Vergi/Sicil, Tutar, Durum) | `Mulk` + `EmlakVergisi` |
| İTO aidat çizelgesi | Yıl sheet → (Sicil, Firma, Tutar, 1.taksit, 2.taksit) | `ResmiOdeme(tip=ITO, sirket, taksit_no, tutar)` |
| TEMİNAT MEKTUPLARI | Şirket sheet → (Banka, Mektup No, Tutar, Komisyon, Tarih) | `TeminatMektubu` + `TeminatKomisyonOdemesi` |
| EMLAK VERGİLERİ rar | Klasör adı (1.DÖNEM/2.DÖNEM) + dosya adı (Belediye + Kişi) | `EmlakVergisi` + `Belge(ozel_sinif=EMLAK_BORC/MAKBUZ)` |
| PAPİNET rar | Alt klasör (entegratör/şirket) + dosya adı | `EntegratorSozlesme` veya `Fatura` + `Belge` |
| SITEX rar | `PRUVA\YYYY-MM\<DAIRE>.pdf` | `SiteXEkstre(daire, yyyymm)` + `Belge` |

---
