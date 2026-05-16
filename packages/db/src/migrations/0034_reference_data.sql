-- Türkiye'deki tüm bankalar, resmi kurumlar ve devlet kurumları için
-- sistem-geneli referans tablolar. Tüm tenant'lar okuyabilir.

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS reference_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eft_code text,
  swift_code text,
  name text NOT NULL,
  short_name text NOT NULL,
  sector text NOT NULL DEFAULT 'commercial',
  is_state_bank boolean NOT NULL DEFAULT false,
  is_participation boolean NOT NULL DEFAULT false,
  website text,
  customer_service_phone text,
  logo_url text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_banks_eft ON reference_banks(eft_code) WHERE eft_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ref_banks_swift ON reference_banks(swift_code);
CREATE INDEX IF NOT EXISTS idx_ref_banks_sector ON reference_banks(sector);
CREATE INDEX IF NOT EXISTS idx_ref_banks_name ON reference_banks(short_name);

CREATE TABLE IF NOT EXISTS reference_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  category text NOT NULL,
  parent_ministry text,
  website text,
  phone text,
  email text,
  address text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_institutions_code ON reference_institutions(code);
CREATE INDEX IF NOT EXISTS idx_ref_institutions_category ON reference_institutions(category);
CREATE INDEX IF NOT EXISTS idx_ref_institutions_name ON reference_institutions(short_name);

CREATE TABLE IF NOT EXISTS reference_government_agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  agency_type text NOT NULL DEFAULT 'ministry',
  website text,
  phone text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_gov_code ON reference_government_agencies(code);
CREATE INDEX IF NOT EXISTS idx_ref_gov_type ON reference_government_agencies(agency_type);

-- ============================================================================
-- SEED DATA — TÜRKİYE BANKALARI
-- Kaynak: TCMB EFT katılımcı listesi + TBB üye listesi
-- ============================================================================

-- KAMU BANKALARI (Devlet)
INSERT INTO reference_banks (eft_code, swift_code, name, short_name, sector, is_state_bank, website, customer_service_phone, sort_order) VALUES
  ('00010', 'TCZBTR2A', 'T.C. Ziraat Bankası A.Ş.', 'Ziraat Bankası', 'state', true, 'https://www.ziraatbank.com.tr', '0850 220 00 00', 1),
  ('00012', 'TVBATR2A', 'Türkiye Halk Bankası A.Ş.', 'Halkbank', 'state', true, 'https://www.halkbank.com.tr', '0850 222 04 00', 2),
  ('00015', 'TVBATR2A', 'Türkiye Vakıflar Bankası T.A.O.', 'Vakıfbank', 'state', true, 'https://www.vakifbank.com.tr', '0850 222 07 24', 3)
ON CONFLICT (eft_code) DO NOTHING;

-- ÖZEL TİCARİ BANKALAR
INSERT INTO reference_banks (eft_code, swift_code, name, short_name, sector, website, customer_service_phone, sort_order) VALUES
  ('00064', 'ISBKTRIS', 'Türkiye İş Bankası A.Ş.', 'İş Bankası', 'commercial', 'https://www.isbank.com.tr', '0850 724 0 724', 10),
  ('00046', 'AKBKTRIS', 'Akbank T.A.Ş.', 'Akbank', 'commercial', 'https://www.akbank.com', '0850 222 25 25', 11),
  ('00062', 'TGBATRIS', 'Türkiye Garanti Bankası A.Ş.', 'Garanti BBVA', 'commercial', 'https://www.garantibbva.com.tr', '0850 222 0 333', 12),
  ('00067', 'YAPITRIS', 'Yapı ve Kredi Bankası A.Ş.', 'Yapı Kredi', 'commercial', 'https://www.yapikredi.com.tr', '0850 222 0 444', 13),
  ('00134', 'DENITRIS', 'Denizbank A.Ş.', 'Denizbank', 'commercial', 'https://www.denizbank.com', '0850 222 0 800', 14),
  ('00111', 'QNBATRIS', 'QNB Finansbank A.Ş.', 'QNB Finansbank', 'commercial', 'https://www.qnbfinansbank.com', '0850 222 0 900', 15),
  ('00125', 'TEBUTRIS', 'Türk Ekonomi Bankası A.Ş.', 'TEB', 'commercial', 'https://www.teb.com.tr', '0850 200 0 666', 16),
  ('00099', 'INGBTRIS', 'ING Bank A.Ş.', 'ING', 'commercial', 'https://www.ing.com.tr', '0850 222 0 600', 17),
  ('00123', 'HSBCTRIX', 'HSBC Bank A.Ş.', 'HSBC', 'commercial', 'https://www.hsbc.com.tr', '0850 211 0 111', 18),
  ('00059', 'SEKETRIS', 'Şekerbank T.A.Ş.', 'Şekerbank', 'commercial', 'https://www.sekerbank.com.tr', '0850 222 78 78', 19),
  ('00135', 'ANADTRIS', 'Anadolubank A.Ş.', 'Anadolubank', 'commercial', 'https://www.anadolubank.com.tr', '0850 222 60 60', 20),
  ('00132', 'TKBNTRIS', 'Burgan Bank A.Ş.', 'Burgan Bank', 'commercial', 'https://www.burgan.com.tr', '0850 222 99 22', 21),
  ('00103', 'FBHLTRIS', 'Fibabanka A.Ş.', 'Fibabanka', 'commercial', 'https://www.fibabanka.com.tr', '0850 222 80 80', 22),
  ('00146', 'ICBKTRIS', 'ICBC Turkey Bank A.Ş.', 'ICBC Turkey', 'commercial', 'https://www.icbc.com.tr', '0850 211 1 222', 23),
  ('00124', 'ALTNTRIS', 'Alternatifbank A.Ş.', 'Alternatifbank', 'commercial', 'https://www.alternatifbank.com.tr', '0850 222 95 95', 24),
  ('00203', 'TSPATRIS', 'Turkland Bank A.Ş.', 'Turkland Bank', 'commercial', 'https://www.tbank.com.tr', '0212 368 34 34', 25),
  ('00109', 'CITITRIS', 'Citibank A.Ş.', 'Citibank', 'foreign', 'https://www.citibank.com.tr', '0212 319 49 00', 26)
ON CONFLICT (eft_code) DO NOTHING;

-- KATILIM BANKALARI
INSERT INTO reference_banks (eft_code, swift_code, name, short_name, sector, is_participation, website, customer_service_phone, sort_order) VALUES
  ('00203', 'KTEFTRIS', 'Kuveyt Türk Katılım Bankası A.Ş.', 'Kuveyt Türk', 'participation', true, 'https://www.kuveytturk.com.tr', '0850 251 0 444', 30),
  ('00206', 'ALBATRIS', 'Albaraka Türk Katılım Bankası A.Ş.', 'Albaraka Türk', 'participation', true, 'https://www.albaraka.com.tr', '0850 222 56 67', 31),
  ('00205', 'AFKBTRIS', 'Türkiye Finans Katılım Bankası A.Ş.', 'Türkiye Finans', 'participation', true, 'https://www.turkiyefinans.com.tr', '0850 222 22 44', 32),
  ('00210', 'VAKFTRIS', 'Vakıf Katılım Bankası A.Ş.', 'Vakıf Katılım', 'participation', true, 'https://www.vakifkatilim.com.tr', '0850 724 09 24', 33),
  ('00209', 'ZRKTTRIS', 'Ziraat Katılım Bankası A.Ş.', 'Ziraat Katılım', 'participation', true, 'https://www.ziraatkatilim.com.tr', '0850 220 50 00', 34),
  ('00211', 'TEKBTRIS', 'Türkiye Emlak Katılım Bankası A.Ş.', 'Emlak Katılım', 'participation', true, 'https://www.emlakkatilim.com.tr', '0850 222 65 65', 35)
ON CONFLICT (eft_code) DO NOTHING;

-- KALKINMA VE YATIRIM BANKALARI
INSERT INTO reference_banks (eft_code, swift_code, name, short_name, sector, is_state_bank, website, customer_service_phone, sort_order) VALUES
  ('00029', 'TKBSTRIS', 'Türkiye Kalkınma ve Yatırım Bankası A.Ş.', 'Kalkınma Bankası', 'development', true, 'https://www.kalkinma.com.tr', '0212 315 35 00', 50),
  ('00013', 'EXTRTRIA', 'Türkiye İhracat Kredi Bankası A.Ş. (Türk Eximbank)', 'Türk Eximbank', 'development', true, 'https://www.eximbank.gov.tr', '0850 200 55 00', 51),
  ('00014', 'ILBKTRIS', 'İller Bankası A.Ş.', 'İller Bankası', 'development', true, 'https://www.ilbank.gov.tr', '0312 508 70 00', 52)
ON CONFLICT (eft_code) DO NOTHING;

-- YABANCI BANKALAR
INSERT INTO reference_banks (eft_code, swift_code, name, short_name, sector, website, sort_order) VALUES
  ('00118', 'DEUTTRIS', 'Deutsche Bank A.Ş.', 'Deutsche Bank', 'foreign', 'https://www.db.com', 60),
  ('00098', 'CHASTRIS', 'JPMorgan Chase Bank N.A. Merkezi Columbus Ohio İstanbul Türkiye Şubesi', 'JPMorgan Chase', 'foreign', 'https://www.jpmorganchase.com', 61),
  ('00115', 'BNPATR2I', 'BNP Paribas A.Ş.', 'BNP Paribas', 'foreign', 'https://www.bnpparibas.com.tr', 62)
ON CONFLICT (eft_code) DO NOTHING;

-- ============================================================================
-- SEED DATA — TÜRKİYE RESMİ KURUMLARI (vergi, SGK, oda, vs.)
-- ============================================================================

-- VERGI / GELIR İDARESİ
INSERT INTO reference_institutions (code, name, short_name, category, parent_ministry, website, phone, sort_order) VALUES
  ('gib', 'Gelir İdaresi Başkanlığı', 'GİB', 'tax', 'Hazine ve Maliye Bakanlığı', 'https://www.gib.gov.tr', '189', 1),
  ('vergi_dairesi', 'Vergi Daireleri Başkanlıkları (genel)', 'Vergi Dairesi', 'tax', 'Hazine ve Maliye Bakanlığı', 'https://www.gib.gov.tr/vergi-dairesi-iletisim-bilgileri', '189', 2),
  ('mtv', 'Motorlu Taşıtlar Vergisi (MTV)', 'MTV', 'tax', 'Hazine ve Maliye Bakanlığı', 'https://www.gib.gov.tr', '189', 3)
ON CONFLICT (code) DO NOTHING;

-- SOSYAL GÜVENLİK
INSERT INTO reference_institutions (code, name, short_name, category, parent_ministry, website, phone, sort_order) VALUES
  ('sgk', 'Sosyal Güvenlik Kurumu', 'SGK', 'social_security', 'Çalışma ve Sosyal Güvenlik Bakanlığı', 'https://www.sgk.gov.tr', '170', 10),
  ('bagkur', 'BAĞ-KUR (SGK 4/B Esnaf/Bağımsız)', 'BAĞKUR', 'social_security', 'Çalışma ve Sosyal Güvenlik Bakanlığı', 'https://www.sgk.gov.tr', '170', 11),
  ('iskur', 'Türkiye İş Kurumu', 'İŞKUR', 'social_security', 'Çalışma ve Sosyal Güvenlik Bakanlığı', 'https://www.iskur.gov.tr', '170', 12)
ON CONFLICT (code) DO NOTHING;

-- TİCARET / SANAYİ ODALARI
INSERT INTO reference_institutions (code, name, short_name, category, parent_ministry, website, phone, sort_order) VALUES
  ('tobb', 'Türkiye Odalar ve Borsalar Birliği', 'TOBB', 'chamber', 'Ticaret Bakanlığı', 'https://www.tobb.org.tr', '0312 218 20 00', 20),
  ('ito', 'İstanbul Ticaret Odası', 'İTO', 'chamber', 'Ticaret Bakanlığı', 'https://www.ito.org.tr', '0212 455 60 00', 21),
  ('iso', 'İstanbul Sanayi Odası', 'İSO', 'chamber', 'Ticaret Bakanlığı', 'https://www.iso.org.tr', '0212 252 29 00', 22),
  ('aso', 'Ankara Sanayi Odası', 'ASO', 'chamber', 'Ticaret Bakanlığı', 'https://www.aso.org.tr', '0312 417 12 00', 23),
  ('ato', 'Ankara Ticaret Odası', 'ATO', 'chamber', 'Ticaret Bakanlığı', 'https://www.atonet.org.tr', '0312 285 79 50', 24),
  ('izto', 'İzmir Ticaret Odası', 'İZTO', 'chamber', 'Ticaret Bakanlığı', 'https://www.izto.org.tr', '0232 498 46 00', 25),
  ('ebso', 'Ege Bölgesi Sanayi Odası', 'EBSO', 'chamber', 'Ticaret Bakanlığı', 'https://www.ebso.org.tr', '0232 455 29 00', 26),
  ('btso', 'Bursa Ticaret ve Sanayi Odası', 'BTSO', 'chamber', 'Ticaret Bakanlığı', 'https://www.btso.org.tr', '0224 220 33 33', 27),
  ('kayso', 'Kayseri Sanayi Odası', 'KAYSO', 'chamber', 'Ticaret Bakanlığı', 'https://www.kayso.org.tr', '0352 245 33 95', 28),
  ('konyaso', 'Konya Sanayi Odası', 'KONYASO', 'chamber', 'Ticaret Bakanlığı', 'https://www.kso.org.tr', '0332 251 56 80', 29)
ON CONFLICT (code) DO NOTHING;

-- MESLEKİ KURULUŞLAR
INSERT INTO reference_institutions (code, name, short_name, category, parent_ministry, website, phone, sort_order) VALUES
  ('turmob', 'Türkiye Serbest Muhasebeci Mali Müşavirler ve Yeminli Mali Müşavirler Odaları Birliği', 'TÜRMOB', 'professional', NULL, 'https://www.turmob.org.tr', '0312 232 50 60', 40),
  ('tbb', 'Türkiye Bankalar Birliği', 'TBB', 'professional', NULL, 'https://www.tbb.org.tr', '0212 282 09 73', 41),
  ('tkbb', 'Türkiye Katılım Bankaları Birliği', 'TKBB', 'professional', NULL, 'https://www.tkbb.org.tr', '0212 320 90 00', 42),
  ('tmsf', 'Tasarruf Mevduatı Sigorta Fonu', 'TMSF', 'professional', 'Hazine ve Maliye Bakanlığı', 'https://www.tmsf.org.tr', '0850 222 80 88', 43),
  ('kgk', 'Kamu Gözetimi, Muhasebe ve Denetim Standartları Kurumu', 'KGK', 'professional', NULL, 'https://www.kgk.gov.tr', '0312 253 13 00', 44),
  ('spk', 'Sermaye Piyasası Kurulu', 'SPK', 'professional', NULL, 'https://www.spk.gov.tr', '0312 292 90 90', 45),
  ('bddk', 'Bankacılık Düzenleme ve Denetleme Kurumu', 'BDDK', 'professional', NULL, 'https://www.bddk.org.tr', '0212 214 50 00', 46),
  ('tcmb', 'Türkiye Cumhuriyet Merkez Bankası', 'TCMB', 'professional', NULL, 'https://www.tcmb.gov.tr', '0312 507 50 00', 47),
  ('epdk', 'Enerji Piyasası Düzenleme Kurumu', 'EPDK', 'professional', NULL, 'https://www.epdk.gov.tr', '0312 201 40 00', 48),
  ('rtuk', 'Radyo ve Televizyon Üst Kurulu', 'RTÜK', 'professional', NULL, 'https://www.rtuk.gov.tr', '0312 397 10 00', 49),
  ('btk', 'Bilgi Teknolojileri ve İletişim Kurumu', 'BTK', 'professional', NULL, 'https://www.btk.gov.tr', '0312 294 72 00', 50)
ON CONFLICT (code) DO NOTHING;

-- BELEDİYELER (Büyükşehir — örnek)
INSERT INTO reference_institutions (code, name, short_name, category, website, sort_order) VALUES
  ('ibb', 'İstanbul Büyükşehir Belediyesi', 'İBB', 'municipality', 'https://www.ibb.istanbul', 60),
  ('abb', 'Ankara Büyükşehir Belediyesi', 'ABB', 'municipality', 'https://www.ankara.bel.tr', 61),
  ('izmir_bb', 'İzmir Büyükşehir Belediyesi', 'İzBB', 'municipality', 'https://www.izmir.bel.tr', 62),
  ('bursa_bb', 'Bursa Büyükşehir Belediyesi', 'BurBB', 'municipality', 'https://www.bursa.bel.tr', 63),
  ('antalya_bb', 'Antalya Büyükşehir Belediyesi', 'AntBB', 'municipality', 'https://www.antalya.bel.tr', 64),
  ('adana_bb', 'Adana Büyükşehir Belediyesi', 'AdaBB', 'municipality', 'https://www.adana.bel.tr', 65),
  ('konya_bb', 'Konya Büyükşehir Belediyesi', 'KonBB', 'municipality', 'https://www.konya.bel.tr', 66),
  ('gaziantep_bb', 'Gaziantep Büyükşehir Belediyesi', 'GazBB', 'municipality', 'https://www.gaziantep.bel.tr', 67),
  ('kayseri_bb', 'Kayseri Büyükşehir Belediyesi', 'KayBB', 'municipality', 'https://www.kayseri.bel.tr', 68),
  ('mersin_bb', 'Mersin Büyükşehir Belediyesi', 'MerBB', 'municipality', 'https://www.mersin.bel.tr', 69)
ON CONFLICT (code) DO NOTHING;

-- NOTER / ADLI
INSERT INTO reference_institutions (code, name, short_name, category, website, phone, sort_order) VALUES
  ('tnb', 'Türkiye Noterler Birliği', 'TNB', 'notary', 'https://www.tnb.org.tr', '0312 425 19 00', 70),
  ('uyap', 'Ulusal Yargı Ağı Bilişim Sistemi', 'UYAP', 'judicial', 'https://www.uyap.gov.tr', NULL, 71),
  ('icra_dairesi', 'İcra Daireleri (Adli Sicil)', 'İcra Dairesi', 'judicial', 'https://www.adlisicil.adalet.gov.tr', NULL, 72)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SEED DATA — DEVLET KURUMLARI (Bakanlıklar)
-- ============================================================================

INSERT INTO reference_government_agencies (code, name, short_name, agency_type, website, phone, sort_order) VALUES
  ('cumhurbaskanligi', 'T.C. Cumhurbaşkanlığı', 'Cumhurbaşkanlığı', 'presidential', 'https://www.tccb.gov.tr', '0312 525 55 55', 1),
  ('hazine_maliye', 'T.C. Hazine ve Maliye Bakanlığı', 'Hazine ve Maliye', 'ministry', 'https://www.hmb.gov.tr', '0312 415 29 00', 10),
  ('icisleri', 'T.C. İçişleri Bakanlığı', 'İçişleri', 'ministry', 'https://www.icisleri.gov.tr', '0312 422 40 00', 11),
  ('disisleri', 'T.C. Dışişleri Bakanlığı', 'Dışişleri', 'ministry', 'https://www.mfa.gov.tr', '0312 292 10 00', 12),
  ('adalet', 'T.C. Adalet Bakanlığı', 'Adalet', 'ministry', 'https://www.adalet.gov.tr', '0312 414 80 00', 13),
  ('milli_savunma', 'T.C. Milli Savunma Bakanlığı', 'Milli Savunma', 'ministry', 'https://www.msb.gov.tr', '0312 402 50 00', 14),
  ('milli_egitim', 'T.C. Milli Eğitim Bakanlığı', 'Milli Eğitim', 'ministry', 'https://www.meb.gov.tr', '0312 413 10 00', 15),
  ('saglik', 'T.C. Sağlık Bakanlığı', 'Sağlık', 'ministry', 'https://www.saglik.gov.tr', '184', 16),
  ('calisma', 'T.C. Çalışma ve Sosyal Güvenlik Bakanlığı', 'Çalışma', 'ministry', 'https://www.csgb.gov.tr', '170', 17),
  ('ticaret', 'T.C. Ticaret Bakanlığı', 'Ticaret', 'ministry', 'https://www.ticaret.gov.tr', '0312 204 75 00', 18),
  ('sanayi_teknoloji', 'T.C. Sanayi ve Teknoloji Bakanlığı', 'Sanayi ve Teknoloji', 'ministry', 'https://www.sanayi.gov.tr', '0312 201 50 00', 19),
  ('ulastirma', 'T.C. Ulaştırma ve Altyapı Bakanlığı', 'Ulaştırma', 'ministry', 'https://www.uab.gov.tr', '0312 203 10 00', 20),
  ('cevre_sehircilik', 'T.C. Çevre, Şehircilik ve İklim Değişikliği Bakanlığı', 'Çevre ve Şehircilik', 'ministry', 'https://www.csb.gov.tr', '181', 21),
  ('enerji', 'T.C. Enerji ve Tabii Kaynaklar Bakanlığı', 'Enerji', 'ministry', 'https://www.enerji.gov.tr', '0312 212 64 20', 22),
  ('tarim_orman', 'T.C. Tarım ve Orman Bakanlığı', 'Tarım ve Orman', 'ministry', 'https://www.tarimorman.gov.tr', '0312 287 33 60', 23),
  ('kultur_turizm', 'T.C. Kültür ve Turizm Bakanlığı', 'Kültür ve Turizm', 'ministry', 'https://www.ktb.gov.tr', '0312 470 70 00', 24),
  ('genclik_spor', 'T.C. Gençlik ve Spor Bakanlığı', 'Gençlik ve Spor', 'ministry', 'https://www.gsb.gov.tr', '0312 596 60 00', 25),
  ('aile', 'T.C. Aile ve Sosyal Hizmetler Bakanlığı', 'Aile ve Sosyal Hizmetler', 'ministry', 'https://www.aile.gov.tr', '183', 26),

  -- BAŞKANLIKLAR / OTORİTELER
  ('rekabet', 'Rekabet Kurumu', 'Rekabet Kurumu', 'authority', 'https://www.rekabet.gov.tr', '0312 291 44 44', 50),
  ('kalkinma_yatirim_ofisi', 'Cumhurbaşkanlığı Yatırım Ofisi', 'Yatırım Ofisi', 'authority', 'https://www.invest.gov.tr', '0312 413 89 00', 51),
  ('savunma_sanayii', 'Cumhurbaşkanlığı Savunma Sanayii Başkanlığı', 'SSB', 'authority', 'https://www.ssb.gov.tr', '0312 411 90 00', 52),
  ('diyanet', 'T.C. Diyanet İşleri Başkanlığı', 'Diyanet', 'authority', 'https://www.diyanet.gov.tr', '0312 295 70 00', 53),
  ('afad', 'Afet ve Acil Durum Yönetimi Başkanlığı', 'AFAD', 'authority', 'https://www.afad.gov.tr', '122', 54)
ON CONFLICT (code) DO NOTHING;
