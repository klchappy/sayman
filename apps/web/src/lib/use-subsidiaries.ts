import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

export interface SubsidiaryOption {
  id: string;
  name: string;
  code: string | null;
  parent_subsidiary_id: string | null;
  is_active: boolean;
}

/**
 * Aktif tenant'taki subsidiary listesi — Form'larda dropdown için.
 * Tenant yoksa boş array döner.
 */
export function useSubsidiaries() {
  const active = useAuth((s) => s.active);

  return useQuery({
    queryKey: ['subsidiaries-for-form', active.orgSlug, active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: SubsidiaryOption[] }>('/subsidiaries');
      return res.data.data.filter((s) => s.is_active);
    },
  });
}
