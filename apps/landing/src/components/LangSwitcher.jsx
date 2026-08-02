"use client";

import { useLang } from "./LangProvider";
import { LANGS } from "@/lib/i18n";

export default function LangSwitcher({ className = "" }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`flex items-center rounded-full border border-line bg-paper/70 backdrop-blur p-0.5 ${className}`}>
      {LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            aria-label={l.name}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-full text-[0.72rem] font-bold transition-all ${
              active ? "bg-accent text-white shadow-[0_2px_8px_-2px_rgba(108,71,255,0.4)]" : "text-muted hover:text-ink hover:bg-line-soft"
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
