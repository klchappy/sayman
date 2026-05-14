/**
 * ERP adapter registry — provider → adapter.
 */
import type { ErpAdapter } from './types';
import { logoAdapter } from './logo';
import { manualAdapter } from './manual';
import { parasutAdapter } from './parasut';

export * from './types';

const ADAPTERS: Record<string, ErpAdapter> = {
  parasut: parasutAdapter,
  logo: logoAdapter,
  manual: manualAdapter,
};

export function getAdapter(provider: string): ErpAdapter | null {
  return ADAPTERS[provider] ?? null;
}

export function listAdapters(): Array<{ provider: string; label: string }> {
  return Object.values(ADAPTERS).map((a) => ({
    provider: a.provider,
    label: a.label,
  }));
}

export function adapterConfigFields(provider: string) {
  return ADAPTERS[provider]?.configFields ?? [];
}
