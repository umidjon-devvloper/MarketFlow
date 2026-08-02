"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { dict, DEFAULT_LANG } from "@/lib/i18n";

const Ctx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang");
      if (saved && dict[saved]) {
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {}
  }, []);

  const setLang = (l) => {
    if (!dict[l]) return;
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
    document.documentElement.lang = l;
  };

  return <Ctx.Provider value={{ lang, setLang, t: dict[lang] }}>{children}</Ctx.Provider>;
}

export function useLang() {
  const c = useContext(Ctx);
  if (!c) return { lang: DEFAULT_LANG, setLang: () => {}, t: dict[DEFAULT_LANG] };
  return c;
}
