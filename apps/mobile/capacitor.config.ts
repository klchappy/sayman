import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Sayman mobile — Capacitor wrapper.
 *
 * MVP yaklaşımı: webDir prod web build'inin dist'idir (apps/web/dist).
 * App login + dashboard'a doğrudan webview ile bağlanır.
 *
 * Geliştirme akışı:
 *   1. pnpm --filter @sayman/web build           (apps/web/dist üretir)
 *   2. pnpm --filter @sayman/mobile install
 *   3. pnpm --filter @sayman/mobile sync         (native projeleri günceller)
 *   4. pnpm --filter @sayman/mobile ios:open     (Xcode açar — `pod install` ardından)
 *   5. (Android için Android Studio) pnpm --filter @sayman/mobile android:open
 *
 * Production wire: server.url = https://sayman.deploi.net → live reload yerine
 * canlı API'ye bağlanır. webview tek başına bir browser'dır.
 */
const config: CapacitorConfig = {
  appId: 'net.deploi.sayman',
  appName: 'Sayman',
  webDir: '../web/dist',
  server: {
    url: 'https://sayman.deploi.net',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    scheme: 'Sayman',
    contentInset: 'always',
  },
  android: {
    backgroundColor: '#0f172a',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#f97316',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
