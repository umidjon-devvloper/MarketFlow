'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Store,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { cn } from '@/lib/utils';

const menu = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
  { href: '/dashboard/products', label: 'Mahsulotlar', icon: Package },
  { href: '/dashboard/marketplaces', label: 'Marketplace\'lar', icon: Store },
  { href: '/dashboard/analytics', label: 'Analitika', icon: BarChart3 },
  { href: '/dashboard/team', label: 'Jamoa', icon: Users },
  { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, organizations, logout } = useAuthStore();
  // Zustand persist localStorage'dan keyin yuklanadi — server render bilan
  // mos kelishi uchun birinchi renderda hech narsa ko'rsatmaymiz.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
    } else if (organizations.length === 0) {
      router.push('/dashboard/organizations/new');
    }
  }, [hydrated, isAuthenticated, organizations, router]);

  if (!hydrated || !isAuthenticated) return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="text-xl font-bold block mb-3">
            Market<span className="text-blue-600">Flow</span>
          </Link>
          <OrgSwitcher />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            // '/dashboard' faqat aniq moslikda faol — aks holda hamma sahifada yonib turadi
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <div className="text-sm mb-3">
            <p className="font-medium">{user?.fullName}</p>
            <p className="text-slate-500 text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Chiqish
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
