"use client";

import Reveal from "./Reveal";

function TiltCard({ className = "", children, glassTop = true }) {
  function onMove(e) {
    const card = e.currentTarget;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-4px)`;
  }
  function onLeave(e) {
    e.currentTarget.style.transform = "";
  }
  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`bento p-6 [transform-style:preserve-3d] [transition:transform_.2s_ease,box-shadow_.3s_ease,opacity_.7s] ${className}`}
    >
      {glassTop && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent opacity-60 dark:from-white/[0.06]" />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

function Icon({ children }) {
  return (
    <span className="inline-grid place-items-center w-11 h-11 rounded-xl bg-grad-brand text-white shadow-[0_8px_20px_-8px_rgba(108,71,255,0.6)] mb-4">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

export default function BentoFeatures() {
  return (
    <section id="features" className="max-w-[1300px] mx-auto px-5 md:px-12 pt-32 md:pt-40 pb-20 md:pb-28">
      <Reveal className="max-w-[640px] mb-12">
        <p className="eyebrow">Imkoniyatlar</p>
        <h2 className="font-serif text-[1.9rem] md:text-[2.6rem] text-ink leading-tight">
          Sotuvni tezlashtiruvchi <span className="text-gradient">AI vositalar</span>
        </h2>
        <p className="text-ink-soft mt-4 text-[1.02rem]">
          Bir platformada — narxdan tortib avtomatik joylashtirishgacha bo'lgan
          barcha kerakli imkoniyatlar.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Featured — AI content */}
        <Reveal className="lg:col-span-2" style={{ transitionDelay: "0ms" }}>
          <TiltCard className="h-full min-h-[230px] flex flex-col">
            <Icon>
              <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
              <path d="M19 14l.6 1.7L21.3 16.3l-1.7.6L19 18.6l-.6-1.7L16.7 16.3l1.7-.6L19 14z" />
            </Icon>
            <h3 className="font-bold text-[1.2rem] text-ink">AI kontent generatsiyasi</h3>
            <p className="text-ink-soft text-[0.92rem] mt-2 max-w-[420px]">
              Sarlavha, tavsif va xususiyatlar bir zumda — har bozorning to'g'ri
              tili va uslubida tayyorlanadi.
            </p>
            <div className="mt-auto pt-5 grid sm:grid-cols-2 gap-2.5">
              {["Erkaklar krossovkasi, mesh material…", "Кроссовки мужские, лёгкие…"].map((t, i) => (
                <div key={i} className="rounded-xl border border-line bg-panel/70 px-3.5 py-2.5">
                  <div className="font-mono text-[0.62rem] uppercase tracking-wide text-muted mb-1">
                    {i === 0 ? "Uzum · sarlavha" : "Ozon · заголовок"}
                  </div>
                  <div className="text-[0.78rem] text-ink-soft leading-snug">{t}</div>
                </div>
              ))}
            </div>
          </TiltCard>
        </Reveal>

        {/* Smart pricing */}
        <Reveal style={{ transitionDelay: "90ms" }}>
          <TiltCard className="h-full">
            <Icon>
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </Icon>
            <h3 className="font-bold text-[1.1rem] text-ink">Aqlli narx</h3>
            <p className="text-ink-soft text-[0.9rem] mt-2">
              Har bozor uchun raqobatbardosh narx oralig'ini taklif qiladi.
            </p>
          </TiltCard>
        </Reveal>

        {/* Marketplace optimization */}
        <Reveal style={{ transitionDelay: "120ms" }}>
          <TiltCard className="h-full">
            <Icon>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
            </Icon>
            <h3 className="font-bold text-[1.1rem] text-ink">Bozorga moslash</h3>
            <p className="text-ink-soft text-[0.9rem] mt-2">
              Sarlavha, kalit so'z va kadr har platforma talabiga moslanadi.
            </p>
          </TiltCard>
        </Reveal>

        {/* Auto publishing */}
        <Reveal style={{ transitionDelay: "150ms" }}>
          <TiltCard className="h-full">
            <Icon>
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </Icon>
            <h3 className="font-bold text-[1.1rem] text-ink">Avto joylashtirish</h3>
            <p className="text-ink-soft text-[0.9rem] mt-2">
              Hisobni ulang — tayyor e'lonlar avtomatik yuklanadi.
            </p>
          </TiltCard>
        </Reveal>

        {/* Analytics */}
        <Reveal style={{ transitionDelay: "180ms" }}>
          <TiltCard className="h-full">
            <Icon>
              <path d="M3 3v18h18" />
              <path d="M7 14l3-4 3 3 5-6" />
            </Icon>
            <h3 className="font-bold text-[1.1rem] text-ink">Tahlil</h3>
            <p className="text-ink-soft text-[0.9rem] mt-2">
              Narx va talab dinamikasini bitta panelda kuzating.
            </p>
          </TiltCard>
        </Reveal>

        {/* Multi-platform sync — wide */}
        <Reveal className="lg:col-span-3" style={{ transitionDelay: "120ms" }}>
          <TiltCard className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
            <div>
              <Icon>
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0115-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 01-15 6.7L3 16" />
              </Icon>
              <h3 className="font-bold text-[1.2rem] text-ink">Ko'p platformali sinxronizatsiya</h3>
              <p className="text-ink-soft text-[0.92rem] mt-2 max-w-[460px]">
                Barcha bozorlar bitta joydan boshqariladi — narx, holat va matnlar
                doimo birxil.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {[
                { l: "U", c: "#8b5cf6", d: "0s" },
                { l: "O", c: "#2f88ff", d: "0.4s" },
                { l: "W", c: "#e0189c", d: "0.8s" },
                { l: "Y", c: "#f5b301", d: "1.2s" },
              ].map((m) => (
                <span
                  key={m.l}
                  className="w-12 h-12 rounded-xl grid place-items-center font-serif font-bold text-white shadow-soft animate-floaty"
                  style={{ backgroundColor: m.c, animationDelay: m.d }}
                >
                  {m.l}
                </span>
              ))}
            </div>
          </TiltCard>
        </Reveal>
      </div>
    </section>
  );
}

