import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const ONBOARDING_DISMISSED_KEY = 'sayman.onboarding_dismissed';

interface TenantInfo {
  slug: string;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const initialized = useAuth((s) => s.initialized);
  const session = useAuth((s) => s.session);
  const localToken = useAuth((s) => s.localToken);
  const init = useAuth((s) => s.init);
  const active = useAuth((s) => s.active);
  const isAdmin = useAuth((s) => s.isAdmin());
  const setActive = useAuth((s) => s.setActive);
  const location = useLocation();

  useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  const authed = !!session || !!localToken;
  const dismissed =
    typeof window !== 'undefined' &&
    localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true';
  const onOnboardingRoute = location.pathname === '/onboarding';

  const tenantsQ = useQuery({
    queryKey: ['tenants-list', active.orgSlug],
    enabled: authed && !!active.orgSlug && !onOnboardingRoute,
    queryFn: async () => {
      const res = await api.get<{ data: TenantInfo[] }>(`/tenants?org=${active.orgSlug}`);
      return res.data.data;
    },
  });

  // Admin için tenant otomatik seçimi: tenant seçilmemişse ilk tenant otomatik atanır
  useEffect(() => {
    if (
      authed &&
      isAdmin &&
      !active.tenantSlug &&
      tenantsQ.data &&
      tenantsQ.data.length > 0
    ) {
      setActive({ tenantSlug: tenantsQ.data[0]!.slug });
    }
  }, [authed, isAdmin, active.tenantSlug, tenantsQ.data, setActive]);

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

  // Admin için tenant otomatik seçim bekleniyor: ekran flicker'ını önle.
  if (
    isAdmin &&
    !active.tenantSlug &&
    tenantsQ.data &&
    tenantsQ.data.length > 0 &&
    !onOnboardingRoute
  ) {
    return (
      <div className="min-h-full grid place-items-center text-brand-500 dark:text-slate-400 text-sm">
        <div className="text-center">
          <div className="size-8 mx-auto mb-2 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          Tenant yükleniyor…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function dismissOnboarding() {
  localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
}
