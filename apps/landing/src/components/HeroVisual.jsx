"use client";

import { useEffect, useRef } from "react";

// Connection cables: cube edge -> card edge (coords in 520x470 user space)
const lines = [
  { key: "uzum", color: "#8b5cf6", d: "M180 248 Q 150 195 150 152", end: [150, 152], dur: "2.6s", begin: "0s" },
  { key: "ozon", color: "#2f88ff", d: "M340 248 Q 382 188 378 130", end: [378, 130], dur: "2.9s", begin: "0.5s" },
  { key: "wb", color: "#e0189c", d: "M180 330 Q 158 332 140 330", end: [140, 330], dur: "2.4s", begin: "0.9s" },
  { key: "yandex", color: "#f5b301", d: "M340 338 Q 368 348 372 352", end: [372, 352], dur: "3.1s", begin: "0.3s" },
];

const cards = [
  { key: "uzum", label: "Uzum Market", price: "245 000 so'm", logo: "/logos/uzum.jpg", pos: { left: "26%", top: "22%" }, delay: "0s" },
  { key: "ozon", label: "Ozon", price: "238 000 so'm", logo: "/logos/ozon.jpg", pos: { left: "75%", top: "19%" }, delay: "1.1s" },
  { key: "wb", label: "Wildberries", price: "252 000 so'm", logo: "/logos/wildberries.jpg", pos: { left: "24%", top: "78%" }, delay: "1.8s" },
  { key: "yandex", label: "Yandex Market", price: "241 000 so'm", logo: "/logos/yandex.jpg", pos: { left: "76%", top: "83%" }, delay: "0.6s" },
];

export default function HeroVisual() {
  const wrapRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
    };
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty("--px", cx.toFixed(4));
      el.style.setProperty("--py", cy.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      el.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full max-w-[520px] mx-auto aspect-[520/470]"
      style={{ "--px": 0, "--py": 0 }}
      aria-hidden="true"
    >
      {/* soft container */}
      <div className="absolute inset-0 rounded-[34px] bg-paper/40 border border-line backdrop-blur-[2px] shadow-[0_40px_90px_-50px_rgba(108,71,255,0.55)]" />

      {/* glow base under cube */}
      <div className="absolute left-1/2 top-[58%] w-[55%] h-[26%] -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" />

      {/* SVG layer (parallax: gentle) */}
      <div
        className="absolute inset-0"
        style={{ transform: "translate(calc(var(--px) * 10px), calc(var(--py) * 10px))" }}
      >
        <svg viewBox="0 0 520 470" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
          <defs>
            <linearGradient id="cubeTop" x1="180" y1="208" x2="340" y2="288" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#bda9ff" />
              <stop offset="1" stopColor="#8b6dff" />
            </linearGradient>
            <linearGradient id="cubeLeft" x1="180" y1="248" x2="260" y2="380" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#6c47ff" />
              <stop offset="1" stopColor="#5232d6" />
            </linearGradient>
            <linearGradient id="cubeRight" x1="340" y1="248" x2="260" y2="380" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#4d3ed6" />
              <stop offset="1" stopColor="#382aa8" />
            </linearGradient>
            <linearGradient id="topSheen" x1="180" y1="208" x2="340" y2="288" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
            {lines.map((l) => (
              <linearGradient key={l.key} id={`ln-${l.key}`} x1="260" y1="248" x2={l.end[0]} y2={l.end[1]} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#8b6dff" />
                <stop offset="1" stopColor={l.color} />
              </linearGradient>
            ))}
          </defs>

          {/* sonar rings */}
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx="260"
              cy="252"
              r="120"
              fill="none"
              stroke="rgb(108 71 255 / 0.5)"
              strokeWidth="1.4"
              className="sonar"
              style={{ animationDelay: `${i * 1.1}s`, transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))}

          {/* connection cables */}
          {lines.map((l) => (
            <g key={l.key}>
              {/* glow */}
              <path d={l.d} fill="none" stroke={l.color} strokeWidth="6" strokeOpacity="0.18" strokeLinecap="round" filter="url(#softGlow)" />
              {/* crisp gradient line */}
              <path d={l.d} fill="none" stroke={`url(#ln-${l.key})`} strokeWidth="2.2" strokeLinecap="round" />
              {/* flowing dashes */}
              <path className="neon-path" d={l.d} stroke="#ffffff" strokeOpacity="0.85" style={{ animationDelay: l.begin }} />
            </g>
          ))}

          {/* CUBE */}
          <g className="cube-float" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            {/* faces */}
            <polygon points="180,248 260,288 260,380 180,340" fill="url(#cubeLeft)" />
            <polygon points="340,248 260,288 260,380 340,340" fill="url(#cubeRight)" />
            <polygon points="260,208 340,248 260,288 180,248" fill="url(#cubeTop)" />
            {/* top sheen */}
            <polygon points="260,208 340,248 260,288 180,248" fill="url(#topSheen)" opacity="0.35" className="sheen" />
            {/* edge highlights */}
            <path d="M260 208 L340 248 M260 208 L180 248" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.2" fill="none" />
            <path d="M180 248 L180 340 M340 248 L340 340 M260 288 L260 380" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" fill="none" />
            <path d="M180 340 L260 380 L340 340" stroke="#000000" strokeOpacity="0.18" strokeWidth="1" fill="none" />
          </g>

          {/* endpoint nodes + traveling pulses */}
          {lines.map((l) => (
            <g key={`n-${l.key}`}>
              <circle cx={l.end[0]} cy={l.end[1]} r="7" fill={l.color} opacity="0.25" filter="url(#softGlow)" />
              <circle cx={l.end[0]} cy={l.end[1]} r="3" fill="#fff" stroke={l.color} strokeWidth="1.5" />
              <g>
                <circle r="6" fill={l.color} opacity="0.5" filter="url(#softGlow)" />
                <circle r="2.6" fill="#ffffff" />
                <animateMotion dur={l.dur} begin={l.begin} repeatCount="indefinite" path={l.d} />
              </g>
            </g>
          ))}
        </svg>

        {/* upload badge on top of the cube (crisp HTML) */}
        <div className="absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-14 h-14 rounded-2xl bg-grad-brand grid place-items-center shadow-[0_14px_34px_-8px_rgba(108,71,255,0.8)]">
            <span className="absolute inset-0 rounded-2xl bg-accent/50 blur-xl -z-10 animate-pulse" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V5M12 5l-4 4M12 5l4 4" />
              <path d="M5 16v2a2 2 0 002 2h10a2 2 0 002-2v-2" />
            </svg>
          </div>
        </div>
      </div>

      {/* floating marketplace cards (parallax: stronger, opposite) */}
      <div
        className="absolute inset-0"
        style={{ transform: "translate(calc(var(--px) * -22px), calc(var(--py) * -22px))" }}
      >
        {cards.map((c) => (
          <div
            key={c.key}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={c.pos}
          >
            <div className="glass rounded-2xl px-3.5 py-3 w-[155px] animate-floaty" style={{ animationDelay: c.delay }}>
              <div className="flex items-center gap-2.5">
                <img src={c.logo} alt={c.label} width={32} height={32} className="w-8 h-8 rounded-lg shadow-soft" />
                <span className="text-[0.82rem] font-bold text-ink leading-tight">{c.label}</span>
              </div>
              <div className="mt-2 font-mono text-[0.72rem] text-muted">{c.price}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
