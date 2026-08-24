'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  LayoutDashboard,
  LayoutGrid,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Store,
  Users,
  Sparkles,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/RemoteImage';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Package;
  /** Yonida raqam ko'rsatiladigan bo'lsa */
  badge?: 'products';
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: 'Boshqaruv',
    items: [
      { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
      { href: '/dashboard/products', label: 'Mahsulotlar', icon: Package, badge: 'products' },
      { href: '/dashboard/listings', label: 'Kartochkalar', icon: LayoutGrid },
      { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ShoppingCart },
      { href: '/dashboard/analytics', label: 'Tahlil', icon: BarChart3 },
      { href: '/dashboard/marketplaces', label: "Marketplace'lar", icon: Store },
    ],
  },
  {
    label: 'Tashkilot',
    items: [
      { href: '/dashboard/team', label: 'Jamoa', icon: Users },
      { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
    ],
  },
];

const STORAGE_KEY = 'mf-sidebar-collapsed';

interface SidebarProps {
  /** Mobil rejimda panel ochiqmi */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, currentOrgId, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  // Tanlov localStorage'da — birinchi renderda server bilan mos bo'lishi uchun effektda o'qiymiz
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // localStorage yopiq bo'lsa yig'ilmagan holatda qolaveradi
    }
  }, []);

  // Sahifa almashganda mobil panel yopilsin
  useEffect(() => {
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Esc bilan yopish
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseMobile();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  const { data: productCount } = useQuery({
    queryKey: ['products-count', currentOrgId],
    queryFn: async () => (await api.get('/products', { params: { limit: 1 } })).data.pagination.total as number,
    enabled: !!currentOrgId,
    staleTime: 60 * 1000,
  });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // saqlanmasa ham ishlashda davom etadi
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const badgeValue = (item: NavItem) => (item.badge === 'products' ? productCount : undefined);

  return (
    <>
      {/* Mobil qoraytirgich */}
      <div
        onClick={onCloseMobile}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-paper/80 backdrop-blur-xl border-r border-line',
          'transition-[width,transform] duration-300 ease-out',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          collapsed ? 'w-[78px]' : 'w-[264px]',
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        {/* ---------- Logo ---------- */}
        <div className={cn('flex items-center h-[72px] flex-shrink-0', collapsed ? 'justify-center px-2' : 'px-5')}>
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-grad-brand shadow-btn flex items-center justify-center flex-shrink-0">
              <Package className="w-[18px] h-[18px] text-white" />
            </span>
            {!collapsed && (
              <span className="text-[19px] font-bold tracking-tight truncate">
                Market<span className="text-accent">Flow</span>
              </span>
            )}
          </Link>

          {/* Mobil yopish tugmasi */}
          {!collapsed && (
            <button
              onClick={onCloseMobile}
              className="ml-auto p-2 -mr-2 rounded-lg text-muted hover:bg-panel hover:text-ink transition lg:hidden"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ---------- Tashkilot ---------- */}
        <div className={cn('flex-shrink-0 pb-4', collapsed ? 'px-3' : 'px-4')}>
          {collapsed ? (
            <button
              onClick={toggleCollapsed}
              className="w-full h-11 rounded-full border border-line bg-paper flex items-center justify-center text-accent hover:border-accent/40 transition"
              title="Tashkilotni almashtirish"
            >
              <Store className="w-[18px] h-[18px]" />
            </button>
          ) : (
            <OrgSwitcher />
          )}
        </div>

        {/* ---------- Navigatsiya ---------- */}
        <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden pb-2', collapsed ? 'px-3' : 'px-3')}>
          {SECTIONS.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              {collapsed ? (
                <div className="h-px bg-line mx-2 mb-3" />
              ) : (
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {section.label}
                </p>
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  // '/dashboard' faqat aniq moslikda faol — aks holda hamma sahifada yonib turadi
                  const isActive =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname === item.href || pathname.startsWith(item.href + '/');
                  const badge = badgeValue(item);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex items-center rounded-full text-[14px] font-medium transition',
                        collapsed ? 'justify-center h-11 w-11 mx-auto' : 'gap-3 px-4 py-2.5',
                        isActive
                          ? 'bg-accent-soft text-accent shadow-[0_1px_2px_rgba(108,71,255,0.08)]'
                          : 'text-ink-soft hover:bg-panel hover:text-ink',
                      )}
                    >
                      {/* Faol holat chizig'i */}
                      {isActive && (
                        <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent" />
                      )}

                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />

                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {badge !== undefined && badge > 0 && (
                            <span
                              className={cn(
                                'ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
                                isActive ? 'bg-accent text-white' : 'bg-panel text-muted',
                              )}
                            >
                              {badge}
                            </span>
                          )}
                        </>
                      )}

                      {/* Yig'ilgan holatdagi maslahat oynasi */}
                      {collapsed && (
                        <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-paper opacity-0 shadow-card transition group-hover:opacity-100">
                          {item.label}
                          {badge !== undefined && badge > 0 && ` · ${badge}`}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ---------- Pro reklama ---------- */}
        {!collapsed && (
          <div className="flex-shrink-0 px-4 pb-3">
            <Link
              href="/dashboard/settings"
              className="block rounded-[20px] bg-grad-brand p-4 text-white shadow-btn transition hover:shadow-btn-hover hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">Pro rejaga o'tish</p>
                  <p className="text-[11px] text-white/75 leading-tight mt-0.5">
                    Ko'proq imkoniyatlar oching
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/80 flex-shrink-0" />
              </div>
            </Link>
          </div>
        )}

        {/* ---------- Foydalanuvchi ---------- */}
        <div className={cn('flex-shrink-0 border-t border-line', collapsed ? 'p-3' : 'px-4 py-4')}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Avatar
                src={user?.avatar}
                name={user?.fullName}
                className="w-9 h-9 rounded-full bg-accent-soft text-accent text-xs font-bold"
              />
              <button
                onClick={handleLogout}
                title="Chiqish"
                className="w-9 h-9 rounded-full border border-line flex items-center justify-center text-red-600 transition hover:border-red-500/40 hover:bg-red-500/5"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  src={user?.avatar}
                  name={user?.fullName}
                  className="w-9 h-9 rounded-full bg-accent-soft text-accent text-xs font-bold flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.fullName}</p>
                  <p className="text-[11px] text-muted truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-full border border-line text-sm font-medium text-red-600 transition hover:border-red-500/40 hover:bg-red-500/5"
              >
                <LogOut className="w-4 h-4" />
                Chiqish
              </button>
            </>
          )}
        </div>

        {/* ---------- Yig'ish tugmasi (faqat kattа ekranda) ---------- */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Panelni ochish' : "Panelni yig'ish"}
          className="hidden lg:flex absolute -right-3 top-[30px] w-6 h-6 rounded-full border border-line bg-paper text-muted items-center justify-center shadow-soft transition hover:text-accent hover:border-accent/40 hover:scale-110"
        >
          {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </aside>
    </>
  );
}
