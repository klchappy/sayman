# DESIGN STATUS BADGE SYSTEM
**Proje:** MUHASEBE OPERASYON SİSTEMİ
**Tarih:** 2026-05-05
**Format:** pill (radius full) · 24px height (mobile 22) · ikon 14px + UPPERCASE 12px metin (mobile 10) · letter-spacing 0.04em

---

## 1. STATUS BADGE'LER (23 durum)

| # | Durum | BG | FG | Modüller | Anlamı | İkon (Lucide) | Kullanım Notu |
|---|---|---|---|---|---|---|---|
| 1 | **BEKLİYOR** | warning-100 `#FEF3C7` | warning-500 `#F59E0B` | Fatura, Ödeme, SiteX, Emlak, Resmi, Düzenli | Ödeme bekleniyor, son tarih henüz gelmedi | `Clock` | Default state ödenmemiş kayıt için |
| 2 | **YAKLAŞIYOR** | orange-100 `#FFEDD5` | orange-500 `#F97316` | Fatura, Ödeme, SiteX, Emlak, Teminat, Resmi, Abonelik, Entegratör | T-7 içinde son tarih | `AlertCircle` | T-3'te görev tetiklenir |
| 3 | **GECİKTİ** | danger-100 `#FEE2E2` | danger-500 `#DC2626` | Fatura, Ödeme, SiteX, Emlak, Teminat, Resmi, Düzenli | Son tarih geçti, ödenmedi | `AlertTriangle` | Pulse animasyon önerilir |
| 4 | **ÖDENDİ** | success-100 `#DCFCE7` | success-500 `#16A34A` | Fatura, Ödeme, SiteX, Emlak, Teminat, Resmi, Düzenli | Tamamlanmış ödeme | `CheckCircle2` | Final state |
| 5 | **KISMİ ÖDENDİ** | success-100 `#DCFCE7` (yeşil-koyu fg `#0F766E`) | `#0F766E` | Ödeme | Eksik tutar var | `Pie` | Kalan tutar drawer'da gösterilir |
| 6 | **İPTAL** | neutral `#F1F3F5` | muted `#9CA3AF` | Fatura, Abonelik, Teminat, Görev | Kayıt iptal edildi | `XCircle` | Soft-delete sonrası label |
| 7 | **PASİF** | neutral `#F1F3F5` | muted `#9CA3AF` | Abonelik, Master | Soft-delete arşiv | `EyeOff` | Filtreden gizli default |
| 8 | **ARŞİV** | neutral `#F1F3F5` | muted `#9CA3AF` | Görev, Belge, ImportBatch | Tamamlanmış/geçmiş | `Archive` | Yıllık temizlik sonrası |
| 9 | **KONTROL GEREKLİ** | purple-100 `#EDE9FE` | purple-500 `#7C3AED` | Import, SiteX farkı, Resmi, Düzenli | Manuel doğrulama bekliyor | `ShieldAlert` | Onay zorunlu state |
| 10 | **TASLAK** | info-100 `#DBEAFE` | info-500 `#2563EB` | Fatura, Ödeme, Düzenli, Resmi | Kaydedilmemiş/onay bekleniyor | `FileEdit` | Import draft state |
| 11 | **ONAYLANDI** | success-100 `#DCFCE7` | success-500 `#16A34A` | Import, Görev | Onay süreci tamamlandı | `BadgeCheck` | ImportBatch.committed |
| 12 | **IMPORT BEKLİYOR** | info-100 `#DBEAFE` | info-500 `#2563EB` | Import, Dashboard widget | Onay bekleyen import | `Upload` | Müdür/Yönetici görevi |
| 13 | **DEKONT EKSİK** | orange-100 `#FFEDD5` | orange-500 `#F97316` | Fatura, Ödeme | Ödendi ama dekont yok | `FileMinus` | 5K+ TL üzeri zorunlu |
| 14 | **FATURA EKSİK** | orange-100 `#FFEDD5` | orange-500 `#F97316` | Ödeme, Düzenli | Ödeme var fatura yok | `FileWarning` | İade hatırlatma |
| 15 | **GÖREV AÇIK** | info-100 `#DBEAFE` | info-500 `#2563EB` | Ajanda | Aktif/atanmış görev | `ListTodo` | Default new task |
| 16 | **GÖREV TAMAMLANDI** | success-100 `#DCFCE7` | success-500 `#16A34A` | Ajanda | Bitirilmiş görev | `CheckSquare` | Audit'lenir |
| 17 | **GÖREV ERTELENDİ** | warning-100 `#FEF3C7` | warning-500 `#F59E0B` | Ajanda | Yeni tarihe çekilmiş | `Clock4` | Sebep zorunlu |
| 18 | **KRİTİK** | danger-100 `#FEE2E2` | danger-500 `#DC2626` | AuditLog, Bildirim, Kontör | Acil dikkat gerekli | `Siren` | Pulse zorunlu |
| 19 | **AKTİF** | success-100 `#DCFCE7` | success-500 `#16A34A` | Abonelik, Teminat, Entegratör, Kullanıcı | Yürürlükte/canlı | `CircleDot` | Default canlı state |
| 20 | **YENİLENDİ** | info-100 `#DBEAFE` | info-500 `#2563EB` | Teminat, Abonelik, Entegratör | Sözleşme yenilendi | `RefreshCw` | Yenileme tarihi audit'te |
| 21 | **İADE EDİLDİ** | neutral `#F1F3F5` | muted `#9CA3AF` | Teminat | Mektup iade edildi, kapanmış | `RotateCcw` | Iade tarihi zorunlu |
| 22 | **KOMİSYON YAKLAŞAN** | orange-100 `#FFEDD5` | orange-500 `#F97316` | Teminat | T-7 komisyon ödemesi | `Banknote` | Otomatik bildirim |
| 23 | **KONTÖR KRİTİK** | danger-100 `#FEE2E2` | danger-500 `#DC2626` | Entegratör/Kontör | <eşik kontör (örn. <500) | `BatteryLow` | Pulse + acil bildirim |

---

## 2. ÖDEME YÖNTEMİ BADGE'LERİ (6 yöntem)

| # | Yöntem | BG | FG | Anlamı | İkon | Kullanım |
|---|---|---|---|---|---|---|
| 1 | **OTOMATIK** | info-100 `#DBEAFE` | info-500 `#2563EB` | Banka talimatı (örn. Albaraka) | `Zap` | Default ev/şirket abonelik |
| 2 | **EFT** | success-100 `#DCFCE7` | success-500 `#16A34A` | Banka EFT havalesi | `ArrowRightLeft` | Manuel onaylı |
| 3 | **HAVALE** | `#E0F2FE` | `#0369A1` | Banka havalesi (aynı banka) | `ArrowRight` | Aynı bankaiçi |
| 4 | **KREDİ KARTI** | purple-100 `#EDE9FE` | purple-500 `#7C3AED` | Kredi kartı ödemesi | `CreditCard` | Domain, abonelik gibi |
| 5 | **ELDEN** | warning-100 `#FEF3C7` | warning-500 `#F59E0B` | Nakit/elden ödeme | `HandCoins` | Çardak aidat, noter, vb. |
| 6 | **NAKİT** | neutral `#F1F3F5` | ink-2 `#4B5563` | Nakit kasadan | `Banknote` | Küçük ödemeler |

---

## 3. KULLANIM KURALLARI

### 3.1 Tek bir kayıtta gösterilen badge sayısı
- **Liste ekranında:** maks 3 badge (durum + yöntem + dekont/görev sayacı)
- **Detay ekranında:** maks 5 (durum + alt durum + yöntem + flag'ler)
- **Mobil kart:** maks 4, kartın 2. satırında flexbox wrap

### 3.2 Pulse animasyon
- **Zorunlu:** KRİTİK, KONTÖR KRİTİK, GECİKTİ
- **Opsiyonel:** Komisyon Yaklaşan (T-1)
- **Yasak:** Diğer 19 durum (görsel kirlilik önleme)

### 3.3 Çakışan durumlar
| Senaryo | Hangi badge |
|---|---|
| Hem Geciken hem Dekont Eksik | İkisini ayrı ayrı göster (Geciken sol/birincil) |
| Tamamlandı + Audit log var | Tamamlandı (audit ayrı tab) |
| İptal + Eski görev | İptal (görev kartında üst düzey) |
| Aktif + Yenilendi | Aktif (Yenilendi son işlem rozeti olarak alt) |

### 3.4 Erişilebilirlik
- Renk + ikon kombinasyonu **zorunlu** — sadece renk ile bilgi iletmek yasak (renk körü uyumu).
- ARIA label: `aria-label="Durum: Bekliyor"` her badge'de.
- Kontrast oranı: text 12px ≥4.5:1 doğrulandı (BG-100 + FG-500 kombinasyonları AA geçer).

### 3.5 Mobil
- 22px height + 10px metin + 5px ikon dot → bölüm tasarımına uyum.
- Wrap: kartlar arasında `flexWrap: "wrap" gap: 6`.

### 3.6 Yeni durum eklemek
1. `DESIGN_FREEZE_DECISION.md` "Orta revizyon" prosedürü.
2. Karar registry'e madde ekle (D-XXX).
3. Anayasa Madde 11.4 update.
4. Bu dokümana satır ekle + design canvas Frame 00'a görsel.

---

## 4. RENK MANTIĞI ÖZET

| Renk | Anlam | Kullanım |
|---|---|---|
| 🟢 Yeşil (success) | Tamamlandı / canlı / başarılı | Ödendi, Onaylandı, Aktif, Görev Tamamlandı |
| 🟡 Sarı (warning) | Bekliyor / dikkat | Bekliyor, Görev Ertelendi |
| 🟠 Turuncu (orange) | Yaklaşan deadline / eksiklik | Yaklaşıyor, Dekont Eksik, Fatura Eksik, Komisyon Yaklaşan |
| 🔴 Kırmızı (danger) | Geciken / kritik / acil | Gecikti, Kritik, Kontör Kritik |
| ⚪ Gri (neutral) | İptal / pasif / arşiv | İptal, Pasif, Arşiv, İade Edildi, Nakit |
| 🔵 Mavi (info) | Bilgi / draft / yenilendi | Taslak, Import Bekliyor, Görev Açık, Yenilendi, Otomatik |
| 🟣 Mor (purple) | Manuel doğrulama / kart | Kontrol Gerekli, Kredi Kartı |

---

**SON.** Anayasa Madde 11.4 ile birlikte bağlayıcıdır.
