"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { useLang } from "./LangProvider";

const items = [
  { q: "Bitta rasmdan to'rt bozorga e'lon — bu vaqtimni haqiqatan tejadi.", n: "Dilnoza R.", r: "Uzum sotuvchisi", c: "#8b5cf6" },
  { q: "Ozon uchun ruscha matnlarni o'zi yozib beradi, sifati havas qilarli.", n: "Sardor K.", r: "Ozon seller", c: "#2f88ff" },
  { q: "Narx tavsiyalari aniq chiqdi — birinchi oydayoq savdo o'sdi.", n: "Kamola T.", r: "Wildberries", c: "#e0189c" },
  { q: "Endi har bozorga alohida o'tirib yozmayman. Hammasi avtomatik.", n: "Jasur M.", r: "Ko'p platforma", c: "#f5b301" },
  { q: "Jamoa bilan ishlash ancha tezlashdi, kontent bir xil sifatda.", n: "Nigora A.", r: "Biznes hisob", c: "#4f46e5" },
  { q: "Kadr tavsiyasi zo'r — endi qaysi rasm kerakligini o'ylamayman.", n: "Bekzod X.", r: "Uzum + Ozon", c: "#2bd4a0" },
];

function Card({ q, n, r, c }) {
  return (
    <div className="w-[330px] shrink-0 card p-6 transition-transform duration-300 hover:-translate-y-1.5">
      <div className="flex gap-0.5 text-yellow-400 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
          </svg>
        ))}
      </div>
      <p className="text-ink text-[0.95rem] leading-relaxed">“{q}”</p>
      <div className="flex items-center gap-3 mt-5">
        <span className="w-9 h-9 rounded-full grid place-items-center text-white text-[0.8rem] font-bold" style={{ backgroundColor: c }}>
          {n.charAt(0)}
        </span>
        <div>
          <div className="text-[0.85rem] font-semibold text-ink">{n}</div>
          <div className="text-[0.74rem] text-muted">{r}</div>
        </div>
      </div>
    </div>
  );
}

export default function Testimonials() {
  const { t } = useLang();
  const [paused, setPaused] = useState(false);
  const loop = [...items, ...items];

  return (
    <section className="py-20 md:py-28 overflow-hidden">
      <Reveal className="max-w-[1300px] mx-auto px-5 md:px-12 mb-12 text-center">
        <p className="eyebrow justify-center">{t.testi.eyebrow}</p>
        <h2 className="font-serif text-[1.9rem] md:text-[2.6rem] text-ink leading-tight">
          {t.testi.titleA} <span className="text-gradient">{t.testi.titleHi}</span>{t.testi.titleB}
        </h2>
      </Reveal>

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* edge fades */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 md:w-28 z-10 bg-gradient-to-r from-canvas to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 md:w-28 z-10 bg-gradient-to-l from-canvas to-transparent" />

        <div
          className="flex gap-5 w-max"
          style={{ animation: "marquee 44s linear infinite", animationPlayState: paused ? "paused" : "running" }}
        >
          {loop.map((it, i) => (
            <Card key={i} {...it} />
          ))}
        </div>
      </div>
    </section>
  );
}

