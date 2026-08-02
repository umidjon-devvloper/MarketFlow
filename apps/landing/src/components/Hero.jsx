"use client";

import HeroVisual from "./HeroVisual";
import { useLang } from "./LangProvider";

export default function Hero() {
  const { t } = useLang();
  return (
    <section id="top" className="relative max-w-[1300px] mx-auto px-5 md:px-12 pt-32 md:pt-40 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-[1.02fr_.98fr] gap-12 md:gap-10 items-center">
        <div>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 backdrop-blur px-3.5 py-1.5 text-[0.74rem] font-medium text-ink-soft shadow-soft mb-6 animate-fade-down"
            style={{ animationDelay: "0ms" }}
          >
            <span className="text-accent text-[1.1rem] leading-none mb-[2px]">+</span> {t.hero.badge || "AI yordamchisi bilan"}
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse ml-0.5" />
          </span>

          <h1
            className="font-serif font-semibold leading-[1.04] tracking-tight text-[2.5rem] md:text-[3.7rem] text-ink animate-fade-up"
            style={{ animationDelay: "150ms", animationFillMode: "both" }}
          >
            {t.hero.titleA}{" "}
            <span className="text-gradient text-gradient-anim not-italic">{t.hero.titleHi}</span>{" "}
            {t.hero.titleB}
          </h1>

          <p
            className="mt-5 text-[1.08rem] text-ink-soft max-w-[520px] leading-relaxed animate-fade-up"
            style={{ animationDelay: "300ms", animationFillMode: "both" }}
          >
            {t.hero.subtitle}
          </p>

          <div
            className="flex gap-3.5 mt-8 flex-wrap animate-fade-up"
            style={{ animationDelay: "450ms", animationFillMode: "both" }}
          >
            <a href="/demo" className="btn-primary">
              {t.hero.ctaTry}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a href="#how" className="btn-ghost">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {t.hero.ctaHow}
            </a>
          </div>

          <div
            className="flex items-center gap-2.5 mt-7 text-[0.82rem] text-muted animate-fade-up"
            style={{ animationDelay: "600ms", animationFillMode: "both" }}
          >
            <div className="flex -space-x-2">
              {["#8b5cf6", "#2f88ff", "#e0189c", "#f5b301"].map((c) => (
                <span key={c} className="w-6 h-6 rounded-full border-2 border-canvas" style={{ backgroundColor: c }} />
              ))}
            </div>
            {t.hero.trust}
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

