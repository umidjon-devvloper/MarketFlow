"use client";

import { useEffect, useRef, useState } from "react";
import Reveal from "./Reveal";
import FieldRow from "./FieldRow";
import Typewriter from "./Typewriter";
import { marketOrder, marketData, marketColorClasses, marketLogos } from "@/lib/marketData";

const STEPS = [
  "Rasm tahlil qilinmoqda…",
  "Mos kategoriya aniqlanmoqda…",
  "Bozorlar narxi solishtirilmoqda…",
  "Matn va kadr tayyorlanmoqda…",
];

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#f6f6fb"/><circle cx="300" cy="240" r="90" fill="none" stroke="#b3b7c4" stroke-width="3"/><path d="M150 460 L260 330 L340 400 L420 300 L480 460 Z" fill="none" stroke="#b3b7c4" stroke-width="3" stroke-linejoin="round"/><text x="300" y="540" fill="#9499a8" font-family="monospace" font-size="16" text-anchor="middle">namuna mahsulot rasmi</text></svg>`;

export default function DemoSection() {
  const [imageSrc, setImageSrc] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | scanning | done
  const [scanStep, setScanStep] = useState(0);
  const [activeMarket, setActiveMarket] = useState("uzum");
  const [dragging, setDragging] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [mode, setMode] = useState("file"); // file | url
  const [url, setUrl] = useState("");
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  function startFlow(src) {
    setImageSrc(src);
    setPhase("scanning");
    setScanStep(0);
    setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  useEffect(() => {
    if (phase !== "scanning") return;
    if (scanStep >= STEPS.length - 1) {
      const t = setTimeout(() => setPhase("done"), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setScanStep((s) => s + 1), 550);
    return () => clearTimeout(t);
  }, [phase, scanStep]);

  function handleFile(file) {
    if (!file || !file.type?.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => startFlow(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleSample() {
    startFlow("data:image/svg+xml;utf8," + encodeURIComponent(SAMPLE_SVG));
  }

  function copyAll() {
    const m = marketData[activeMarket];
    const text = [
      m.title,
      "",
      `Kategoriya: ${m.category}`,
      `Narx: ${m.price}`,
      `Kalit so'z: ${m.keywords}`,
      "",
      "Tavsif:",
      m.description,
      "",
      "Xususiyatlar:",
      ...m.specs.map(([k, v]) => `${k}: ${v}`),
    ].join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 1400);
  }

  const m = marketData[activeMarket];

  return (
    <section id="demo" className="max-w-[1300px] mx-auto px-5 md:px-12 pt-32 md:pt-40 pb-20 md:pb-28">
      <Reveal className="max-w-[640px] mb-12">
        <p className="eyebrow">Demo</p>
        <h2 className="font-serif text-[1.8rem] md:text-[2.5rem] text-ink">
          O'z mahsulotingizda sinab ko'ring
        </h2>
        <p className="text-ink-soft mt-3.5 text-[1.02rem]">
          Bu — frontend namunasi, shuning uchun natijalar haqiqiy AI tahlili emas,
          balki tizim ishga tushgandan keyin qanday ko'rinishini ko'rsatadi.
        </p>
      </Reveal>

      <Reveal>
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-7 items-start">
          {/* left: upload */}
          <div>
            {/* tabs */}
            <div className="flex gap-6 mb-4 border-b border-line">
              {[
                ["file", "Rasm yuklash"],
                ["url", "Bog'lama orqali (URL)"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  className={`relative pb-2.5 text-[0.86rem] font-semibold transition-colors ${
                    mode === k ? "text-accent" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                  {mode === k && (
                    <span className="absolute left-0 -bottom-px h-0.5 w-full rounded-full bg-grad-brand" />
                  )}
                </button>
              ))}
            </div>

            {mode === "file" ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFile(e.dataTransfer.files[0]);
                }}
                className={`border-[1.5px] border-dashed rounded-[18px] px-6 py-8 text-center cursor-pointer transition-colors ${
                  dragging ? "border-accent bg-accent-soft" : "border-line bg-paper hover:border-accent/40"
                }`}
              >
                <span className="mx-auto mb-3.5 grid place-items-center w-14 h-14 rounded-2xl bg-accent-soft text-accent">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                    <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
                  </svg>
                </span>
                <p className="text-[0.92rem] text-ink-soft">
                  <strong className="text-ink">Mahsulot fotosini</strong> shu yerga
                  tashlang
                </p>
                <div className="mt-2.5 text-[0.85rem] text-ink-soft">
                  yoki{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="text-accent font-bold underline underline-offset-[3px]"
                  >
                    fayl tanlang
                  </button>{" "}
                  ·{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSample();
                    }}
                    className="text-accent font-bold underline underline-offset-[3px]"
                  >
                    namunani ko'ring
                  </button>
                </div>
                <p className="mt-3.5 font-mono text-[0.72rem] text-muted">
                  JPG, PNG, WEBP · Maks. 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="rounded-[18px] border border-line bg-paper p-5">
                <label htmlFor="urlInput" className="block text-[0.78rem] text-muted mb-2 font-mono">
                  Mahsulot rasmining havolasi
                </label>
                <input
                  id="urlInput"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…/mahsulot.jpg"
                  className="w-full bg-panel border border-line rounded-xl px-3.5 py-3 text-[0.9rem] text-ink placeholder:text-muted/70 focus:border-accent focus:bg-paper focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => (url ? startFlow(url) : handleSample())}
                  className="btn-primary btn-sm w-full mt-3"
                >
                  Tahlil qilish
                </button>
                <p className="mt-3 font-mono text-[0.72rem] text-muted text-center">
                  yoki{" "}
                  <button type="button" onClick={handleSample} className="text-accent font-bold underline underline-offset-[3px]">
                    namunani ko'ring
                  </button>
                </p>
              </div>
            )}

            {imageSrc && (
              <div
                ref={previewRef}
                className="mt-4 rounded-[18px] overflow-hidden bg-paper border border-line shadow-card"
              >
                <div className="relative aspect-square bg-panel">
                  <img
                    src={imageSrc}
                    alt="Yuklangan mahsulot rasmi"
                    className="w-full h-full object-cover"
                  />
                  {phase === "scanning" && (
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/80 flex flex-col items-center justify-end p-4 gap-2.5">
                      <div className="absolute left-0 right-0 h-0.5 bg-accent shadow-[0_0_16px_rgba(108,71,255,.9)] animate-scanmove" />
                      <div className="font-mono text-[0.78rem] text-white text-center">
                        {STEPS[scanStep]}
                      </div>
                      <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-300"
                          style={{ width: `${((scanStep + 1) / STEPS.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* right: results */}
          <div className={`min-h-[520px] rounded-[18px] border bg-paper p-2 transition-shadow duration-500 ${phase === "done" ? "border-accent/30 shadow-glow" : "border-line shadow-card"}`}>
            {phase !== "done" ? (
              <div className="min-h-[500px] flex flex-col items-center justify-center gap-9 p-6 text-center">
                {/* orbiting AI hub */}
                <div className="relative w-[260px] h-[260px]">
                  {/* rotating rings */}
                  <div className="absolute inset-0 rounded-full border border-line animate-spin-slow" />
                  <div className="absolute inset-7 rounded-full border border-dashed border-accent/25 animate-spin-slow [animation-direction:reverse]" />
                  {/* connecting glow */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-accent/15 blur-2xl" />

                  {/* center AI core */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="relative w-[88px] h-[88px] rounded-[26px] bg-grad-brand grid place-items-center shadow-glow animate-floaty">
                      <span className="absolute inset-0 rounded-[26px] bg-accent/40 blur-xl -z-10 animate-pulse" />
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
                        <path d="M19 14l.6 1.7L21.3 16.3l-1.7.6L19 18.6l-.6-1.7L16.7 16.3l1.7-.6L19 14z" />
                      </svg>
                    </div>
                  </div>

                  {/* marketplace logos around the core */}
                  {[
                    { key: "uzum", pos: "left-1/2 -top-2 -translate-x-1/2", d: "0s" },
                    { key: "ozon", pos: "-right-2 top-1/2 -translate-y-1/2", d: "0.6s" },
                    { key: "wb", pos: "left-1/2 -bottom-2 -translate-x-1/2", d: "1.2s" },
                    { key: "yandex", pos: "-left-2 top-1/2 -translate-y-1/2", d: "1.8s" },
                  ].map((o) => (
                    <div key={o.key} className={`absolute ${o.pos}`}>
                      <div className="w-12 h-12 rounded-2xl bg-paper border border-line shadow-card grid place-items-center animate-floaty" style={{ animationDelay: o.d }}>
                        <img src={marketLogos[o.key]} alt="" width={30} height={30} className="w-[30px] h-[30px] rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="max-w-[320px]">
                  <strong className="block font-serif text-ink text-[1.25rem] mb-2">
                    Natijalar shu yerda paydo bo'ladi
                  </strong>
                  <span className="text-[0.9rem] text-muted">
                    Chapdan mahsulot rasmini yuklang — AI to'rt bozor uchun sarlavha,
                    narx va tavsifni alohida tayyorlaydi.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="pop-in text-[0.8rem] text-ink-soft bg-accent-soft border border-accent/15 rounded-[10px] px-3.5 py-2.5 mb-5 font-mono">
                  <b className="text-accent">Namuna natija.</b> Backend ulanganda AI
                  haqiqiy tahlil asosida ma'lumot beradi.
                </div>

                <div className="pop-in flex gap-2.5 overflow-x-auto pb-1 mb-5" style={{ animationDelay: "0.08s" }}>
                  {marketOrder.map((key) => {
                    const tm = marketData[key];
                    const tc = marketColorClasses[key];
                    const selected = key === activeMarket;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveMarket(key)}
                        aria-selected={selected}
                        className={`flex-none flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-[10px] border text-[0.85rem] font-bold border-t-[3px] transition-all ${tc.border} ${
                          selected
                            ? "text-ink bg-paper border-x-line border-b-line shadow-soft -translate-y-0.5"
                            : "text-muted bg-panel border-x-transparent border-b-transparent hover:text-ink"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${tc.bg}`} />
                        {tm.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
                  <div className="pop-in" style={{ animationDelay: "0.16s" }}>
                    <div
                      className="relative rounded-xl overflow-hidden bg-panel border border-line"
                      style={{ aspectRatio: m.ar }}
                    >
                      <img
                        src={imageSrc}
                        alt="AI tavsiya etilgan kadr"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 w-[18px] h-[18px] border-2 border-white border-r-0 border-b-0 drop-shadow" />
                      <span className="absolute top-2 right-2 w-[18px] h-[18px] border-2 border-white border-l-0 border-b-0 drop-shadow" />
                      <span className="absolute bottom-2 left-2 w-[18px] h-[18px] border-2 border-white border-r-0 border-t-0 drop-shadow" />
                      <span className="absolute bottom-2 right-2 w-[18px] h-[18px] border-2 border-white border-l-0 border-t-0 drop-shadow" />
                    </div>
                    <p className="text-[0.78rem] text-muted mt-2.5 leading-relaxed">
                      {m.frameNote}
                    </p>
                    <span className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] text-ink-soft bg-panel border border-line rounded-full px-2.5 py-1 mt-2.5">
                      Til: {m.lang}
                    </span>
                  </div>

                  <div className="pop-in" style={{ animationDelay: "0.24s" }}>
                    <div className="inline-flex flex-col gap-0.5 bg-accent-soft border border-accent/15 rounded-xl px-4 py-3 mb-4">
                      <span className="font-mono text-[1.15rem] font-semibold text-ink">{m.price}</span>
                      <span className="text-[0.78rem] text-ink-soft max-w-[380px]">{m.priceNote}</span>
                    </div>

                    <FieldRow
                      label="Sarlavha"
                      value={m.title}
                      node={<Typewriter key={activeMarket} text={m.title} className="text-ink" />}
                    />
                    <FieldRow label="Kategoriya" value={m.category} />
                    <FieldRow label="Kalit so'z" value={m.keywords} />
                    <FieldRow label="Tavsif" value={m.description} />

                    <div className="py-3">
                      <div className="font-mono text-[0.74rem] uppercase tracking-wider text-muted mb-2.5">
                        Xususiyat
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {m.specs.map(([k, v]) => (
                          <div
                            key={k}
                            className="bg-panel border border-line rounded-lg px-3 py-2 text-[0.82rem] text-ink-soft"
                          >
                            <b className="block text-muted text-[0.68rem] uppercase tracking-wide mb-0.5 font-mono">
                              {k}
                            </b>
                            {v}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-5">
                  <button onClick={copyAll} className={`btn-primary btn-sm ${allCopied ? "opacity-80" : ""}`}>
                    {allCopied ? "Nusxalandi ✓" : "Hammasini nusxalash"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

