"use client";

import Reveal from "./Reveal";
import Counter from "./Counter";
import { useLang } from "./LangProvider";

const nums = [
  { to: 4, suffix: "" },
  { to: 30, suffix: "s" },
  { to: 90, suffix: "%" },
  { to: 12, suffix: "K+" },
];

export default function Metrics() {
  const { t } = useLang();
  return (
    <section className="max-w-[1300px] mx-auto px-5 md:px-12 py-10 md:py-14">
      <Reveal>
        <div className="glass rounded-[26px] px-6 md:px-10 py-8 grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-4">
          {nums.map((m, i) => (
            <div key={i} className={`text-center lg:text-left ${i > 0 ? "lg:border-l lg:border-line lg:pl-8" : ""}`}>
              <div className="font-sans text-[2.4rem] md:text-[2.8rem] font-extrabold leading-none text-gradient">
                <Counter to={m.to} suffix={m.suffix} />
              </div>
              <div className="mt-2 text-[0.92rem] font-semibold text-ink">{t.metrics[i].label}</div>
              <div className="text-[0.78rem] text-muted mt-0.5">{t.metrics[i].note}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

