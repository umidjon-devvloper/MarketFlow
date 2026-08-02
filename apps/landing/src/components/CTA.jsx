"use client";

import { useRef } from "react";
import Reveal from "./Reveal";
import { useLang } from "./LangProvider";

const particles = [
  { l: "8%", t: "22%", s: 8, d: "0s" },
  { l: "18%", t: "70%", s: 5, d: "1.2s" },
  { l: "32%", t: "30%", s: 6, d: "0.5s" },
  { l: "46%", t: "78%", s: 4, d: "1.8s" },
  { l: "60%", t: "20%", s: 7, d: "0.9s" },
  { l: "72%", t: "62%", s: 5, d: "2.1s" },
  { l: "85%", t: "34%", s: 9, d: "0.3s" },
  { l: "92%", t: "72%", s: 5, d: "1.5s" },
];

function MagneticButton({ children, href, className = "" }) {
  const ref = useRef(null);
  function onMove(e) {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${x * 0.35}px, ${y * 0.45}px)`;
  }
  function onLeave() {
    if (ref.current) ref.current.style.transform = "";
  }
  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`transition-transform duration-200 ${className}`}
    >
      {children}
    </a>
  );
}

export default function CTA() {
  const { t } = useLang();
  return (
    <section className="max-w-[1300px] mx-auto px-5 md:px-12 py-12 md:py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-[34px] bg-grad-brand bg-[length:200%_200%] animate-gradient-x px-6 md:px-16 py-16 md:py-24 text-center">
          {/* floating particles */}
          {particles.map((p, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white/40 blur-[1px] animate-floaty"
              style={{ left: p.l, top: p.t, width: p.s, height: p.s, animationDelay: p.d }}
            />
          ))}
          {/* soft glow blobs */}
          <div className="pointer-events-none absolute -top-20 -left-10 w-72 h-72 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 w-80 h-80 rounded-full bg-electric/30 blur-3xl" />

          <div className="relative">
            <h2 className="font-serif text-[2rem] md:text-[3rem] font-semibold text-white leading-[1.08] max-w-[760px] mx-auto">
              {t.cta.title}
            </h2>
            <p className="text-white/85 mt-5 text-[1.05rem] max-w-[540px] mx-auto">
              {t.cta.subtitle}
            </p>
            <div className="mt-9 flex justify-center">
              <MagneticButton
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white text-accent font-bold px-8 py-4 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.4)] hover:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)]"
              >
                {t.cta.button}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </MagneticButton>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

