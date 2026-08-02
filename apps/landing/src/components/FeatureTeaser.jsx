"use client";

import Reveal from "./Reveal";
import { useLang } from "./LangProvider";

const icons = [
  (<><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" /><path d="M19 14l.6 1.7L21.3 16.3l-1.7.6L19 18.6l-.6-1.7L16.7 16.3l1.7-.6L19 14z" /></>),
  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
];

export default function FeatureTeaser() {
  const { t } = useLang();
  return (
    <section className="max-w-[1300px] mx-auto px-5 md:px-12 py-20 md:py-28">
      <Reveal className="flex flex-wrap items-end justify-between gap-6 mb-12">
        <div className="max-w-[560px]">
          <p className="eyebrow">{t.features.eyebrow}</p>
          <h2 className="font-serif text-[1.9rem] md:text-[2.6rem] text-ink leading-tight">
            {t.features.titleA} <span className="text-gradient">{t.features.titleHi}</span>
          </h2>
        </div>
        <a href="/features" className="btn-ghost btn-sm">
          {t.features.seeAll}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {t.features.items.map((it, i) => (
          <Reveal key={i} style={{ transitionDelay: `${i * 90}ms` }}>
            <a href="/features" className="card p-6 h-full block hover:-translate-y-1 hover:shadow-card-hover group">
              <span className="inline-grid place-items-center w-11 h-11 rounded-xl bg-grad-brand text-white shadow-[0_8px_20px_-8px_rgba(108,71,255,0.6)] mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {icons[i]}
                </svg>
              </span>
              <h3 className="font-bold text-[1.05rem] text-ink">{it.title}</h3>
              <p className="text-ink-soft text-[0.92rem] mt-2 leading-relaxed">{it.text}</p>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

