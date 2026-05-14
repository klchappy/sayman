import { Building2, Coins, Layers, LayoutDashboard, LogOut, Receipt, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { bindActiveAccessor } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TenantSwitcher } from './TenantSwitcher';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/payables', label: 'Faturalar', icon: Receipt },
  { to: '/master-data/persons', label: 'Şahıslar', icon: Users },
  { to: '/master-data/companies', label: 'Şirketler', icon: Building2 },
  { to: '/orgs', label: 'Organizasyonlar', icon: Layers },
];

export function AppShell() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.me);
  const signOut = useAuth((s) => s.signOut);
  const active = useAuth((s) => s.active);

  // Axios accessor'ı auth store'a bağla (her request'te active org/tenant kullanılsın)
  useEffect(() => {
    bindActiveAccessor(() => useAuth.getState().active);
  }, []);

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-full flex bg-brand-50">
      {/* Sidebar */}
      <aside className="w-60 bg-brand-900 text-white flex flex-col">
        <div className="p-5 border-b border-brand-800">
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
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
        {/* Topbar */}
        <header className="bg-white border-b border-brand-100 px-6 py-3 flex items-center justify-between">
          <TenantSwitcher />
          <div className="text-xs text-brand-400">
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

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
