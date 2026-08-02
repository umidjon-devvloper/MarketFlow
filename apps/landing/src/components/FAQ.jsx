"use client";

import { useState } from "react";
import Reveal from "./Reveal";

const faqs = [
  { q: "MarketFlow qanday ishlaydi?", a: "Mahsulot rasmini yuklaysiz — AI uni tahlil qilib, har bir bozor (Uzum, Ozon, Wildberries, Yandex) uchun alohida sarlavha, tavsif, narx va kadr tavsiyasini tayyorlaydi." },
  { q: "Bepul reja nimani o'z ichiga oladi?", a: "Oyiga 5 ta e'lon, 1 ta bozor va asosiy AI kontent. Karta talab qilinmaydi." },
  { q: "Hisobimni ulasam xavfsizmi?", a: "Ma'lumotlaringiz shifrlangan holda saqlanadi va faqat e'lonlarni joylash uchun ishlatiladi. Istalgan vaqtda uzib qo'yishingiz mumkin." },
  { q: "Qaysi tillarda kontent tayyorlanadi?", a: "Uzum uchun o'zbekcha, Ozon/Wildberries/Yandex uchun ruscha — har bozorning auditoriyasiga mos." },
  { q: "Rejani keyin o'zgartira olamanmi?", a: "Ha, istalgan vaqtda yuqori yoki past rejaga o'tishingiz mumkin. To'lov farqi avtomatik hisoblanadi." },
];

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
        aria-expanded={open}
      >
        <span className="font-semibold text-ink text-[0.98rem]">{q}</span>
        <span className={`shrink-0 text-accent transition-transform duration-300 ${open ? "rotate-45" : ""}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
        </span>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-ink-soft text-[0.92rem] leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  return (
    <section className="max-w-[760px] mx-auto px-5 md:px-12 py-16 md:py-24">
      <Reveal className="text-center mb-10">
        <p className="eyebrow justify-center">Savol-javob</p>
        <h2 className="font-serif text-[1.7rem] md:text-[2.3rem] text-ink">Tez-tez beriladigan savollar</h2>
      </Reveal>
      <Reveal className="flex flex-col gap-3">
        {faqs.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </Reveal>
    </section>
  );
}
