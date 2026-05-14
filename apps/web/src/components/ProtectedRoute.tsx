import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const initialized = useAuth((s) => s.initialized);
  const session = useAuth((s) => s.session);
  const localToken = useAuth((s) => s.localToken);
  const init = useAuth((s) => s.init);
  const location = useLocation();

  useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  if (!initialized) {
    return (
      <div className="min-h-full grid place-items-center text-brand-500 text-sm">Yükleniyor…</div>
    );
  }

  // Hibrit: Supabase session veya local token varsa giriş yapılmış say
  const authed = !!session || !!localToken;
  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
