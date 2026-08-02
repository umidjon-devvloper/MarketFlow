"use client";

import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import LangSwitcher from "./LangSwitcher";
import { useLang } from "./LangProvider";

export default function Header() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const nav = [
    { href: "/#how", label: t.nav.how, match: "/" },
    { href: "/features", label: t.nav.features, match: "/features" },
    { href: "/demo", label: t.nav.demo, match: "/demo" },
    { href: "/pricing", label: t.nav.pricing, match: "/pricing" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 animate-fade-down">
      <header
        className={`mt-3 w-full max-w-[1300px] rounded-2xl border border-line backdrop-blur-2xl transition-all duration-500 ${
          scrolled
            ? "bg-paper/95 shadow-[0_10px_40px_-12px_rgba(16,18,27,0.12)] dark:shadow-[0_12px_44px_-12px_rgba(0,0,0,0.6)] py-2.5"
            : "bg-paper/80 shadow-[0_2px_14px_-6px_rgba(16,18,27,0.06)] py-3.5"
        }`}
      >
        <div className="px-4 md:px-6 flex items-center justify-between relative">
          <a href="/" className="flex items-center gap-2.5 font-serif text-[1.1rem] md:text-lg font-bold text-ink shrink-0">
            <span className="w-7 h-7 rounded-lg bg-grad-brand grid grid-cols-2 gap-[3px] p-[5px]">
              <span className="rounded-[2px] bg-white/95" />
              <span className="rounded-[2px] bg-white/45" />
              <span className="rounded-[2px] bg-white/45" />
              <span className="rounded-[2px] bg-white/95" />
            </span>
            <span>Market<span className="text-gradient">Flow</span></span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center justify-center flex-1 gap-6 xl:gap-8 text-sm px-4">
            {nav.map((n) => {
              const active = n.match !== "/" && pathname === n.match;
              return (
                <a
                  key={n.href}
                  href={n.href}
                  className={`navlink transition-colors ${active ? "text-accent font-semibold" : "text-ink-soft hover:text-accent font-medium"}`}
                >
                  {n.label}
                </a>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <LangSwitcher />
            <ThemeToggle />
            <a href="/login" className="btn-ghost btn-sm">{t.nav.login}</a>
            <a href="/register" className="btn-primary btn-sm">
              {t.nav.try}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          {/* Mobile/Tablet Actions */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <a href="/register" className="hidden sm:inline-flex btn-primary btn-sm">
              {t.nav.try}
            </a>
            <button
              className="p-1.5 text-ink hover:bg-line-soft rounded-lg transition-colors"
              aria-label="Menyu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Dropdown Menu */}
          {open && (
            <div className="absolute top-full left-0 right-0 mt-3 glass bg-paper/95 rounded-2xl p-4 flex flex-col gap-1 lg:hidden text-sm shadow-2xl mx-0 border border-line animate-fade-down origin-top">
              <div className="flex flex-col gap-1 mb-2">
                {nav.map((n) => (
                  <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-xl text-ink-soft hover:bg-accent-soft hover:text-accent font-medium transition-colors">
                    {n.label}
                  </a>
                ))}
              </div>
              
              <div className="h-px w-full bg-line/60 my-1" />
              
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-ink-soft font-medium">Til / Язык</span>
                <LangSwitcher />
              </div>
              
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-ink-soft font-medium">Mavzu / Тема</span>
                <ThemeToggle />
              </div>
              
              <div className="h-px w-full bg-line/60 my-2" />
              
              <div className="flex flex-col sm:flex-row gap-2 mt-1 px-2">
                <a href="/login" onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center py-3">
                  {t.nav.login}
                </a>
                <a href="/register" onClick={() => setOpen(false)} className="btn-primary sm:hidden flex-1 justify-center py-3">
                  {t.nav.try}
                </a>
              </div>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

