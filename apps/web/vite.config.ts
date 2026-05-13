import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // workspace root'taki .env'i oku (apps/web'de .env yok)
  const root = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, root, '');
  return {
    plugins: [react()],
    server: {
      port: 5278,
      host: true,
      strictPort: true,
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL ?? 'http://localhost:4300/v1'),
    },
  };
});
