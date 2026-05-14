# @sayman/mobile

Sayman'ın iOS + Android wrapper'ı. Capacitor 6 ile native shell, içeriği canlı `https://sayman.deploi.net` üzerinden alır.

## İlk kurulum

```bash
cd apps/mobile
pnpm install
# Native projeleri oluştur (ilk seferlik)
pnpm cap add ios
pnpm cap add android
```

## Geliştirme akışı

```bash
# 1. Web build'i taze tut (config.webDir = ../web/dist)
pnpm --filter @sayman/web build

# 2. Capacitor sync — native projeleri yeniden yapılandır
pnpm --filter @sayman/mobile sync

# 3. Native IDE'yi aç
pnpm --filter @sayman/mobile ios:open      # macOS + Xcode
pnpm --filter @sayman/mobile android:open  # Android Studio
```

## Push notifications

`capacitor.config.ts` içinde `@capacitor/push-notifications` zaten registered. iOS için APNs Key + Android için FCM Service Account dosyası native projeye eklenmeli.

API'den push gönderimi için ayrı bir endpoint açılacak (faz P+1):
- `POST /v1/push/register-token` — cihaz tokenını kullanıcıya bağlar
- `POST /v1/push/test` — test push (admin)

## Production server URL

Webview tek başına `https://sayman.deploi.net` üzerinden çalışır — yani app store onaylı bir build, web tarafı her zaman güncel kalır. Bu **hybrid** yaklaşımı:
- ✅ Web tarafında her deploy → app'te de görünür
- ✅ App store onayı sadece native değişiklikte gerekli (icon, splash, push setup, vb.)
- ⚠️ App store reviewer "sadece bir webview" demediği sürece sorun yok — bunun için sayman'a özgü native özellikler ekleyeceğiz (push, biometric login, share extension).
