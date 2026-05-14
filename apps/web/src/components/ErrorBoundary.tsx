/**
 * Top-level React Error Boundary.
 *
 * Çöken bir component tüm UI'ı patlatmasın — graceful "Bir şeyler ters gitti"
 * ekranı + reload butonu. Sentry varsa otomatik raporlar.
 */
import * as Sentry from '@sentry/react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Sentry varsa raporla
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-full grid place-items-center p-8 bg-brand-50">
          <div className="card max-w-md text-center">
            <AlertCircle className="size-12 mx-auto text-red-500 mb-3" />
            <h1 className="text-xl font-semibold text-brand-900 mb-2">Bir şeyler ters gitti</h1>
            <p className="text-sm text-brand-600 mb-4">
              Hata kaydedildi. Sayfayı yenileyerek devam edebilirsin.
            </p>
            {this.state.error && (
              <details className="text-left mb-4 text-xs">
                <summary className="cursor-pointer text-brand-500">Teknik detay</summary>
                <pre className="bg-brand-50 p-2 rounded mt-2 overflow-x-auto whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <RotateCw className="size-4" />
                Sayfayı Yenile
              </button>
              <button
                onClick={this.reset}
                className="border border-brand-200 hover:bg-brand-50 text-brand-700 px-4 py-2 rounded-lg text-sm"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
