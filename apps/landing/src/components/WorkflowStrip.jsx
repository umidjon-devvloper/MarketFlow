import Reveal from "./Reveal";

const nodes = [
  { t: "Yuklash", icon: <><path d="M12 16V5M12 5l-4 4M12 5l4 4" /><path d="M5 16v2a2 2 0 002 2h10a2 2 0 002-2v-2" /></> },
  { t: "AI tahlil", icon: <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" /> },
  { t: "Bozorga moslash", icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></> },
  { t: "Joylashtirish", icon: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /> },
];

export default function WorkflowStrip() {
  return (
    <section className="max-w-[1300px] mx-auto px-5 md:px-12 py-16 md:py-24">
      <Reveal className="text-center max-w-[620px] mx-auto mb-14">
        <p className="eyebrow justify-center">AI quvuri</p>
        <h2 className="font-serif text-[1.7rem] md:text-[2.3rem] text-ink leading-tight">
          Ma'lumot <span className="text-gradient">oqimi</span> qanday kechadi
        </h2>
      </Reveal>

      <Reveal>
        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4">
          {/* animated flowing line behind (desktop) */}
          <div className="hidden md:block absolute left-[12%] right-[12%] top-9 h-[3px] rounded-full bg-line overflow-hidden">
            <div className="absolute inset-0 flow-shimmer opacity-80" />
            <div className="absolute inset-y-0 w-1/3 bg-grad-brand opacity-40 rounded-full animate-[wfslide_3.5s_linear_infinite]" />
          </div>

          {nodes.map((n, i) => (
            <div key={n.t} className="relative flex flex-col items-center text-center">
              <span className="relative z-10 w-[72px] h-[72px] rounded-2xl bg-paper border border-line shadow-card grid place-items-center text-accent">
                <span className="absolute inset-0 rounded-2xl bg-accent/10 blur-md animate-pulse" style={{ animationDelay: `${i * 0.4}s` }} />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="relative">
                  {n.icon}
                </svg>
              </span>
              <span className="mt-4 font-mono text-[0.68rem] text-muted">0{i + 1}</span>
              <span className="mt-1 font-semibold text-ink text-[0.98rem]">{n.t}</span>
              {/* mobile connector */}
              {i < nodes.length - 1 && (
                <span className="md:hidden mt-6 w-[3px] h-8 rounded-full bg-gradient-to-b from-accent/60 to-transparent" />
              )}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

