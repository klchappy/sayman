import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const ONBOARDING_DISMISSED_KEY = 'sayman.onboarding_dismissed';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const initialized = useAuth((s) => s.initialized);
  const session = useAuth((s) => s.session);
  const localToken = useAuth((s) => s.localToken);
  const init = useAuth((s) => s.init);
  const active = useAuth((s) => s.active);
  const location = useLocation();

  useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  // İlk kez login olan kullanıcıyı /onboarding'e yönlendir
  // — sadece /login dışındaki ilk girişte tetikle, bir kez dismiss edilirse tekrar etme
  const authed = !!session || !!localToken;
  const dismissed =
    typeof window !== 'undefined' &&
    localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true';
  const onOnboardingRoute = location.pathname === '/onboarding';

  const tenantsQ = useQuery({
    queryKey: ['tenants-onboarding-check', active.orgSlug],
    enabled: authed && !!active.orgSlug && !dismissed && !onOnboardingRoute,
    queryFn: async () => {
      const res = await api.get<{ data: Array<unknown> }>(`/tenants?org=${active.orgSlug}`);
      return res.data.data;
    },
  });

  if (!initialized) {
    return (
      <div className="min-h-full grid place-items-center text-brand-500 dark:text-slate-400 text-sm">
        Yükleniyor…
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Hiç tenant yok + dismiss edilmedi → onboarding
  if (
    tenantsQ.data &&
    tenantsQ.data.length === 0 &&
    !onOnboardingRoute &&
    !dismissed
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function dismissOnboarding() {
  localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
}
