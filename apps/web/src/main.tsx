import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

// Sentry init — env yoksa no-op
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60s stale (eski: 30s) — çoğu liste real-time değil
      staleTime: 60_000,
      // 30dk gc (eski: 5dk default) — kullanıcı geri gelince anlık render
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      // Network hata durumunda 2 retry (eski default: 3) — daha hızlı feedback
      retry: 2,
    },
    mutations: {
      // Mutation default retry kapalı (idempotent olmayanlar için tehlikeli)
      retry: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ConfirmDialogProvider>
            <App />
          </ConfirmDialogProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
