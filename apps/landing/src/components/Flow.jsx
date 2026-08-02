"use client";

import Reveal from "./Reveal";
import { useLang } from "./LangProvider";

const markets = [
  { label: "Uzum Market", logo: "/logos/uzum.jpg", c: "#8b5cf6", w: "88%" },
  { label: "Ozon", logo: "/logos/ozon.jpg", c: "#2f88ff", w: "70%" },
  { label: "Wildberries", logo: "/logos/wildberries.jpg", c: "#e0189c", w: "94%" },
  { label: "Yandex Market", logo: "/logos/yandex.jpg", c: "#f5b301", w: "78%" },
];

const icons = [
  (<><path d="M12 16V5M12 5l-4 4M12 5l4 4" /><path d="M5 16v2a2 2 0 002 2h10a2 2 0 002-2v-2" /></>),
  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />,
  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />,
];

function ImgPlaceholder() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-muted/50">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function UploadVisual() {
  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="aspect-[5/3] rounded-lg bg-paper grid place-items-center mb-2.5"><ImgPlaceholder /></div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-accent-soft text-accent grid place-items-center shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
        </span>
        <span className="text-[0.78rem] text-ink font-medium flex-1 truncate">krossovka.jpg</span>
        <span className="text-green-500"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-paper overflow-hidden">
        <div className="h-full rounded-full bg-grad-brand bar-loop" style={{ "--w": "100%" }} />
      </div>
    </div>
  );
}

function AiVisual({ label }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-3.5">
      <div className="font-mono text-[0.72rem] text-accent flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> {label}
      </div>
      {markets.map((m, i) => (
        <div key={m.label} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
          <img src={m.logo} alt="" width={20} height={20} className="w-5 h-5 rounded-md shrink-0" />
          <span className="flex-1 h-2 rounded-full bg-paper overflow-hidden">
            <span className="block h-full rounded-full bar-loop" style={{ "--w": m.w, backgroundColor: m.c, animationDelay: `${i * 0.25}s` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function PublishVisual({ label }) {
  return (
    <div className="flex flex-col gap-2">
      {markets.map((m, i) => (
        <div key={m.label} className="pop-in flex items-center gap-2.5 rounded-lg border border-line bg-panel px-3 py-2" style={{ animationDelay: `${i * 0.15}s` }}>
          <img src={m.logo} alt="" width={24} height={24} className="w-6 h-6 rounded-md shrink-0" />
          <span className="text-[0.8rem] font-medium text-ink flex-1">{m.label}</span>
          <span className="flex items-center gap-1.5 text-[0.68rem] font-medium text-green-600 dark:text-green-400">
            {label}
            <span className="w-5 h-5 rounded-full bg-green-500/15 grid place-items-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Connector({ flip }) {
  const d = "M40 8 C40 110, 220 40, 220 150";
  return (
    <div className="flex justify-center my-3 md:my-4 relative z-0">
      <svg width="260" height="158" viewBox="0 0 260 158" fill="none" className={flip ? "-scale-x-100" : ""}>
        <path d={d} stroke="rgb(var(--c-line))" strokeWidth="2.5" strokeLinecap="round" />
        <path d={d} stroke="#8b6dff" strokeWidth="6" strokeOpacity="0.18" strokeLinecap="round" style={{ filter: "blur(3px)" }} />
        <path d={d} stroke="#8b6dff" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 10" className="neon-path" />
        <g>
          <circle r="6" fill="#8b6dff" opacity="0.45" style={{ filter: "blur(2px)" }} />
          <circle r="3" fill="#fff" />
          <animateMotion dur="2.6s" repeatCount="indefinite" path={d} />
        </g>
      </svg>
    </div>
  );
}

export default function Flow() {
  const { t } = useLang();
  const visuals = [<UploadVisual key="u" />, <AiVisual key="a" label={t.flow.analysing} />, <PublishVisual key="p" label={t.flow.published} />];

  return (
    <section id="how" className="max-w-[980px] mx-auto px-5 md:px-12 py-20 md:py-28">
      <Reveal className="text-center max-w-[640px] mx-auto mb-14">
        <p className="eyebrow justify-center">{t.flow.eyebrow}</p>
        <h2 className="font-serif text-[1.9rem] md:text-[2.6rem] text-ink leading-tight">
          {t.flow.titleA} <span className="text-gradient">{t.flow.titleHi}</span> {t.flow.titleB}
        </h2>
        <p className="text-ink-soft mt-4 text-[1.02rem]">{t.flow.subtitle}</p>
      </Reveal>

      <div className="relative">
        {t.flow.steps.map((s, i) => {
          const right = i % 2 === 1;
          const n = `0${i + 1}`;
          return (
            <div key={i}>
              <Reveal className={`md:w-[82%] ${right ? "md:ml-auto" : ""}`} style={{ transitionDelay: `${i * 80}ms` }}>
                <div className={`card p-6 md:p-7 flex flex-col gap-6 sm:items-center ${right ? "sm:flex-row-reverse" : "sm:flex-row"} hover:shadow-card-hover transition-shadow`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-12 h-12 rounded-2xl bg-grad-brand text-white grid place-items-center shadow-glow shrink-0">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[i]}</svg>
                      </span>
                      <span className="font-mono text-[0.72rem] text-accent tracking-wide">{t.flow.stepWord} {n}</span>
                    </div>
                    <h3 className="font-serif text-[1.3rem] text-ink">{s.title}</h3>
                    <p className="text-ink-soft text-[0.92rem] mt-2 leading-relaxed max-w-[340px]">{s.desc}</p>
                  </div>
                  <div className="w-full sm:w-[250px] shrink-0">{visuals[i]}</div>
                </div>
              </Reveal>
              {i < t.flow.steps.length - 1 && <Connector flip={right} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
