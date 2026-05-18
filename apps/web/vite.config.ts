import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Lokal dev'de workspace root .env'i oku; production build'de Dockerfile
  // ENV ile set edilmiş process.env.VITE_API_URL'i tercih et.
  const root = path.resolve(__dirname, '../..');
  const fileEnv = loadEnv(mode, root, '');
  const apiUrl = process.env.VITE_API_URL ?? fileEnv.VITE_API_URL ?? 'http://localhost:4300/v1';

  return {
    plugins: [react()],
    server: {
      port: 5278,
      host: true,
      strictPort: true,
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    build: {
      // Vendor chunk'ları ayır: hot path'te tekrar tekrar download'lanmasın.
      // Sayfaların kendi lazy chunk'ları zaten App.tsx React.lazy ile ayrılıyor.
      rollupOptions: {
        output: {
          // Vendor splits — initial bundle'ı düşür, hot path cache hit oranını yükselt.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-query': ['@tanstack/react-query', 'zustand'],
            'vendor-charts': ['recharts'],
            'vendor-icons': ['lucide-react'],
            'vendor-axios': ['axios'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-sentry': ['@sentry/react'],
            // xlsx ~500KB; sadece import edilen sayfalarda chunk olarak yüklenir
            'vendor-xlsx': ['xlsx'],
          },
        },
      },
      chunkSizeWarningLimit: 700,
    },
  };
});
