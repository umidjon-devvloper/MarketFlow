"use client";

import { useEffect, useRef } from "react";

const particles = [
  { l: "12%", t: "20%", s: 6, d: "0s" },
  { l: "26%", t: "70%", s: 4, d: "1.4s" },
  { l: "44%", t: "32%", s: 5, d: "0.7s" },
  { l: "62%", t: "78%", s: 7, d: "2.1s" },
  { l: "78%", t: "24%", s: 4, d: "1s" },
  { l: "88%", t: "60%", s: 6, d: "0.4s" },
  { l: "35%", t: "12%", s: 3, d: "1.8s" },
  { l: "70%", t: "48%", s: 5, d: "2.6s" },
];

/**
 * Global animated background:
 *  - mesh gradient + noise (CSS)
 *  - drifting gradient orbs that ALSO parallax to the mouse
 *  - floating particles (opposite parallax)
 *  - eased cursor spotlight + precise interactive ring
 */
export default function Background() {
  const rootRef = useRef(null);
  const glowRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    const ring = ringRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;

    let tx = window.innerWidth * 0.5;
    let ty = window.innerHeight * 0.3;
    let gx = tx, gy = ty;
    let nmx = 0, nmy = 0; // normalized -0.5..0.5
    let cmx = 0, cmy = 0;
    let raf = 0;

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      nmx = e.clientX / window.innerWidth - 0.5;
      nmy = e.clientY / window.innerHeight - 0.5;
      if (ring) {
        ring.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%) scale(${
          ring.dataset.active === "1" ? 1.9 : 1
        })`;
      }
    };
    const onOver = (e) => {
      if (e.target.closest("a, button, [role='button'], input, label, select")) ring.dataset.active = "1";
    };
    const onOut = (e) => {
      if (e.target.closest("a, button, [role='button'], input, label, select")) ring.dataset.active = "0";
    };

    if (reduce) {
      if (glow) glow.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      return;
    }

    const tick = () => {
      gx += (tx - gx) * 0.09;
      gy += (ty - gy) * 0.09;
      cmx += (nmx - cmx) * 0.06;
      cmy += (nmy - cmy) * 0.06;
      if (glow) glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      root.style.setProperty("--mx", cmx.toFixed(4));
      root.style.setProperty("--my", cmy.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    if (fine && ring) {
      window.addEventListener("pointerover", onOver, { passive: true });
      window.addEventListener("pointerout", onOut, { passive: true });
    }
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerout", onOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={rootRef}
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{ "--mx": 0, "--my": 0 }}
        aria-hidden="true"
      >
        {/* mesh + noise */}
        <div className="absolute inset-0 mesh-bg" />
        <div className="absolute inset-0 noise" />

        {/* moving grid (subtle parallax) */}
        <div
          className="absolute inset-0 grid-fade"
          style={{ transform: "translate(calc(var(--mx) * 14px), calc(var(--my) * 14px))" }}
        />

        {/* rotating aurora + drifting orbs (mouse parallax) */}
        <div
          className="absolute inset-0"
          style={{ transform: "translate(calc(var(--mx) * 42px), calc(var(--my) * 42px))" }}
        >
          <div className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] rounded-full aurora" />
          <div className="absolute left-[62%] top-[64%] -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full aurora-2" />
          <div className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-accent/25 blur-[110px] animate-drift1" />
          <div className="absolute top-1/2 -right-40 w-[520px] h-[520px] rounded-full bg-electric/20 blur-[110px] animate-drift2" />
          <div className="absolute -bottom-52 left-1/4 w-[480px] h-[480px] rounded-full bg-indigo/20 blur-[110px] animate-floaty-slow" />
          <div className="absolute top-[18%] right-1/4 w-[360px] h-[360px] rounded-full bg-wb/10 blur-[120px] animate-floaty" />
        </div>

        {/* floating particles (opposite parallax) */}
        <div
          className="absolute inset-0"
          style={{ transform: "translate(calc(var(--mx) * -46px), calc(var(--my) * -46px))" }}
        >
          {particles.map((p, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-accent/40 twinkle"
              style={{ left: p.l, top: p.t, width: p.s, height: p.s, animationDelay: p.d }}
            />
          ))}
        </div>

        {/* cursor spotlight */}
        <div
          ref={glowRef}
          className="absolute -left-[320px] -top-[320px] w-[640px] h-[640px] will-change-transform"
          style={{
            background:
              "radial-gradient(circle, rgba(108,71,255,0.20) 0%, rgba(139,109,255,0.09) 35%, rgba(108,71,255,0) 68%)",
            filter: "blur(28px)",
          }}
        />
      </div>

      {/* precise interactive ring */}
      <div
        ref={ringRef}
        data-active="0"
        aria-hidden="true"
        className="hidden md:block pointer-events-none fixed left-0 top-0 z-[200] w-8 h-8 rounded-full border border-accent/50 bg-accent/5 transition-[width,height,background-color,border-color] duration-200 will-change-transform"
        style={{ transform: "translate(-50%, -50%)" }}
      />
    </>
  );
}
