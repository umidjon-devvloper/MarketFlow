'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Yorug'/qorong'i rejim almashtirgich.
 *
 * Tanlov localStorage'da saqlanadi, <html> ga `dark` klassi qo'yiladi —
 * ranglar globals.css dagi CSS o'zgaruvchilaridan avtomatik keladi.
 * Sahifa ochilishida miltillamasligi uchun boshlang'ich klassni
 * app/layout.tsx dagi kichik skript qo'yadi.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('mf-theme', next ? 'dark' : 'light');
    } catch {
      // localStorage o'chirilgan bo'lsa ham ishlashda davom etadi
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Yorug' rejim" : "Qorong'i rejim"}
      className="w-10 h-10 rounded-full border border-line bg-paper text-ink-soft flex items-center justify-center transition hover:text-accent hover:border-accent/40 hover:-translate-y-0.5"
    >
      {dark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
    </button>
  );
}
