import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bell,
  Building,
  Building2,
  CheckSquare,
  FileText,
  FileUp,
  Home,
  HomeIcon,
  Landmark,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  X,
  Receipt,
  Repeat,
  Search,
  Shield,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MODULE_DESCRIPTIONS, type Module } from '@sayman/shared';
import { api, bindActiveAccessor } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CommandPalette } from './CommandPalette';
import { TenantSwitcher } from './TenantSwitcher';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  requires?: Module; // sektör modülü adı — aktif tenant'ta yoksa hide
  group?: string;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, requires: 'dashboard' },
  { to: '/payables', label: 'Faturalar', icon: Receipt, requires: 'finance', group: 'Finans' },
  {
    to: '/subscriptions',
    label: 'Abonelikler',
    icon: Repeat,
    requires: 'subscriptions',
    group: 'Finans',
  },
  {
    to: '/regular-payments',
    label: 'Kira & Düzenli',
    icon: HomeIcon,
    requires: 'regular_payments',
    group: 'Finans',
  },
  {
    to: '/official-payments',
    label: 'Resmi Ödemeler',
    icon: Landmark,
    requires: 'official_payments',
    group: 'Finans',
  },
  {
    to: '/guarantees',
    label: 'Teminat Mektupları',
    icon: ShieldCheck,
    requires: 'guarantees',
    group: 'Finans',
  },

  { to: '/tasks', label: 'Görevler', icon: CheckSquare, requires: 'tasks' },
  { to: '/notifications', label: 'Bildirimler', icon: Bell },

  // Master data — group başlığı altında
  { to: '/master-data/persons', label: 'Şahıslar', icon: Users, group: 'Master Data' },
  { to: '/master-data/companies', label: 'Şirketler', icon: Building2, group: 'Master Data' },
  {
    to: '/master-data/properties',
    label: 'Mülkler',
    icon: Home,
    group: 'Master Data',
    requires: 'properties',
  },
  { to: '/master-data/banks', label: 'Bankalar', icon: Landmark, group: 'Master Data' },
  { to: '/master-data/institutions', label: 'Kurumlar', icon: Building, group: 'Master Data' },
  { to: '/subsidiaries', label: 'Yan Şirketler', icon: Network, group: 'Master Data' },

  { to: '/orgs', label: 'Organizasyonlar', icon: Layers, group: 'Sistem' },
  { to: '/users', label: 'Kullanıcılar', icon: UserCog, group: 'Sistem' },
  { to: '/import', label: 'Toplu Yükleme', icon: FileUp, group: 'Sistem', requires: 'imports' },
  { to: '/ocr', label: 'OCR (Belge Oku)', icon: FileText, group: 'Sistem' },
  { to: '/audit', label: 'Denetim Kayıtları', icon: Activity, group: 'Sistem' },
  { to: '/security', label: 'Güvenlik', icon: Shield, group: 'Sistem' },
];

interface TenantInfo {
  slug: string;
  effective_modules: string[];
}

export function AppShell() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const signOut = useAuth((s) => s.signOut);
  const active = useAuth((s) => s.active);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Axios accessor'ı auth store'a bağla
  useEffect(() => {
    bindActiveAccessor(() => useAuth.getState().active);
  }, []);

  // Route değiştiğinde mobile nav'i kapat
  const location = useLocation();
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Aktif tenant'ın modules'unu çek (Faz E filtreleme)
  const tenantsQuery = useQuery({
    queryKey: ['tenants-for-menu', active.orgSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: TenantInfo[] }>(`/tenants?org=${active.orgSlug}`);
      return res.data.data;
    },
  });
  const activeTenant = tenantsQuery.data?.find((t) => t.slug === active.tenantSlug);
  const activeModules = new Set(activeTenant?.effective_modules ?? []);

  /**
   * Item görünür mü?
   *   - requires yok → her zaman göster
   *   - tenant seçili değil + requires var → göster (master data, dashboard için yumuşak)
   *   - requires var + module aktif tenant'ta yok → gizle
   */
  function isVisible(item: NavItem): boolean {
    if (!item.requires) return true;
    if (!active.tenantSlug) return true; // tenant seçilmemişse hepsi gözüksün
    return activeModules.has(item.requires);
  }

  // Group'lara böl
  const grouped = navItems.reduce<Record<string, NavItem[]>>((acc, it) => {
    if (!isVisible(it)) return acc;
    const key = it.group ?? '__top__';
    (acc[key] ??= []).push(it);
    return acc;
  }, {});

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-full flex bg-brand-50">
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar — mobile: drawer / desktop: static */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-brand-900 text-white flex flex-col transition-transform lg:transform-none ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-brand-800 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="size-9 rounded-lg bg-white/10 grid place-items-center text-sm font-semibold">
              Sy
            </div>
            <div>
              <p className="font-semibold tracking-tight">Sayman</p>
              <p className="text-[10px] uppercase tracking-wider text-brand-200">
                Muhasebe Operasyon
              </p>
            </div>
          </Link>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden text-brand-200 hover:text-white"
            aria-label="Menüyü kapat"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
          {/* Top-level items (group'suz) */}
          {grouped['__top__'] && (
            <div className="space-y-0.5">
              {grouped['__top__'].map((item) => (
                <NavLinkItem key={item.to} item={item} />
              ))}
            </div>
          )}

          {/* Group'lu items */}
          {Object.entries(grouped)
            .filter(([k]) => k !== '__top__')
            .map(([groupName, items]) => (
              <div key={groupName} className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider text-brand-400 px-3 py-1">
                  {groupName}
                </p>
                {items.map((item) => (
                  <NavLinkItem key={item.to} item={item} />
                ))}
              </div>
            ))}
        </nav>

        <div className="p-3 border-t border-brand-800">
          {me && (
            <div className="text-xs text-brand-200 mb-2 px-1">
              <p className="font-medium text-white truncate">{me.user.full_name}</p>
              <p className="truncate">{me.user.email}</p>
            </div>
          )}
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-200 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-4" />
            Çıkış
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-brand-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-2 -ml-2 text-brand-700 hover:bg-brand-50 rounded"
            aria-label="Menüyü aç"
          >
            <Menu className="size-5" />
          </button>
          <TenantSwitcher />
          <SearchTrigger />
          <div className="text-xs text-brand-400 hidden md:block">
            {active.orgSlug && active.tenantSlug ? (
              <span className="font-mono">
                {active.tenantSlug}.{active.orgSlug}.sayman
              </span>
            ) : active.orgSlug ? (
              <span className="font-mono">{active.orgSlug}.sayman (tenant seçilmedi)</span>
            ) : (
              <span>Tenant seçilmedi</span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

function SearchTrigger() {
  return (
    <button
      onClick={() => {
        // CommandPalette useEffect ile Cmd+K dinler — programmatic trigger için
        // ayrıca açılabilen versiyon için global event veya context kullanılabilir.
        // En basit: ctrl+k tuş kombinasyonunu simüle et
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }),
        );
      }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-200 hover:border-brand-300 text-sm text-brand-500 hover:text-brand-700 transition flex-1 max-w-md"
    >
      <Search className="size-4" />
      <span className="hidden sm:inline">Ara...</span>
      <kbd className="ml-auto text-xs font-mono px-1.5 py-0.5 bg-brand-50 rounded text-brand-400 hidden sm:inline">
        Ctrl K
      </kbd>
    </button>
  );
}

function NavLinkItem({ item }: { item: NavItem }) {
  const tooltip = item.requires ? MODULE_DESCRIPTIONS[item.requires] : undefined;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={tooltip}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
          isActive
            ? 'bg-white/15 text-white'
            : 'text-brand-200 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <item.icon className="size-4" />
      {item.label}
    </NavLink>
  );
}
