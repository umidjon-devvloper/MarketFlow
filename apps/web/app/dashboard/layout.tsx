'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Bell, Menu } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/Sidebar';
import { AppBackground } from '@/components/AppBackground';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar } from '@/components/RemoteImage';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, organizations } = useAuthStore();
  // Zustand persist localStorage'dan keyin yuklanadi — server render bilan
  // mos kelishi uchun birinchi renderda hech narsa ko'rsatmaymiz.
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // ⌘K / Ctrl+K — qidiruvga fokus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!hydrated || !isAuthenticated) return null;

  return (
    <div className="min-h-screen flex text-ink">
      <AppBackground />
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-[72px] flex-shrink-0 border-b border-line bg-paper/70 backdrop-blur-xl flex items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-10 h-10 rounded-full border border-line bg-paper flex items-center justify-center text-ink-soft transition hover:border-accent/40 hover:text-accent"
            aria-label="Menyu"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>

          <div className="relative flex-1 max-w-lg">
            <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Qidirish..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) router.push(`/dashboard/products?q=${encodeURIComponent(value)}`);
                }
                if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
              }}
              className="w-full h-11 pl-11 pr-16 rounded-full border border-line bg-paper/70 backdrop-blur text-sm placeholder:text-muted focus:outline-none focus:border-accent/50 transition"
            />
            <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted border border-line rounded px-1.5 py-0.5 bg-paper">
              ⌘ K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />

            <Link
              href="/dashboard/team"
              className="relative w-10 h-10 rounded-full border border-line bg-paper text-ink-soft flex items-center justify-center transition hover:text-accent hover:border-accent/40 hover:-translate-y-0.5"
              aria-label="Bildirishnomalar"
            >
              <Bell className="w-[18px] h-[18px]" />
            </Link>

            <Avatar
              src={user?.avatar}
              name={user?.fullName}
              className="w-10 h-10 rounded-full bg-grad-brand text-white text-xs font-bold flex-shrink-0"
            />
          </div>
        </header>

        <main className="flex-1">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
