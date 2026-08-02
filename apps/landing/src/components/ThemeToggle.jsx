"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }) {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch (e) {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Kunduzgi rejim" : "Tungi rejim"}
      title={dark ? "Kunduzgi rejim" : "Tungi rejim"}
      className={`relative w-10 h-10 rounded-full border border-line bg-paper/70 backdrop-blur grid place-items-center text-ink-soft hover:text-accent hover:border-accent/40 transition-all duration-300 overflow-hidden ${className}`}
    >
      {/* avoid hydration flash: render neutral until mounted */}
      <span
        className={`absolute transition-all duration-500 ${
          mounted && dark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
        }`}
      >
        {/* sun */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      <span
        className={`absolute transition-all duration-500 ${
          mounted && dark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
        }`}
      >
        {/* moon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
        </svg>
      </span>
    </button>
  );
}
