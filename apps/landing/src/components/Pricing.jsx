import Reveal from "./Reveal";

const plans = [
  {
    name: "Boshlang'ich",
    price: "Bepul",
    period: "",
    desc: "Sinab ko'rish uchun.",
    features: ["Oyiga 5 ta e'lon", "1 ta bozor", "Asosiy AI kontent", "Qo'lda nusxalash"],
    cta: "Bepul boshlash",
    featured: false,
  },
  {
    name: "Pro",
    price: "149 000",
    period: "so'm / oy",
    desc: "Faol sotuvchilar uchun.",
    features: ["Cheksiz e'lon", "4 ta bozor", "Avto joylashtirish", "Aqlli narxlash", "Ustuvor AI tahlil"],
    cta: "Pro'ni tanlash",
    featured: true,
  },
  {
    name: "Biznes",
    price: "449 000",
    period: "so'm / oy",
    desc: "Jamoa va do'konlar uchun.",
    features: ["Pro'dagi hammasi", "Jamoaviy kirish", "API integratsiya", "Kengaytirilgan tahlil", "Shaxsiy menejer"],
    cta: "Bog'lanish",
    featured: false,
  },
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="shrink-0 text-accent">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="max-w-[1300px] mx-auto px-5 md:px-12 pt-32 md:pt-40 pb-20 md:pb-28">
      <Reveal className="max-w-[640px] mb-12 mx-auto text-center">
        <p className="eyebrow justify-center">Narxlar</p>
        <h2 className="font-serif text-[1.9rem] md:text-[2.6rem] text-ink leading-tight">
          Biznesingizga mos <span className="text-gradient">reja</span>
        </h2>
        <p className="text-ink-soft mt-4 text-[1.02rem]">
          Bepul boshlang, kerak bo'lganda kengaytiring. Yashirin to'lovlar yo'q.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {plans.map((p, i) => (
          <Reveal key={p.name} style={{ transitionDelay: `${i * 100}ms` }}>
            {p.featured ? (
              <div className="relative rounded-[26px] p-[1.5px] bg-grad-brand bg-[length:200%_200%] animate-gradient-x shadow-card-hover md:-mt-4">
                <div className="rounded-[25px] bg-paper p-7">
                  <PlanInner p={p} />
                </div>
              </div>
            ) : (
              <div className="card p-7 hover:-translate-y-1 transition-transform">
                <PlanInner p={p} />
              </div>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function PlanInner({ p }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[1.15rem] text-ink">{p.name}</h3>
        {p.featured && (
          <span className="text-[0.68rem] font-mono uppercase tracking-wide text-white bg-grad-brand rounded-full px-2.5 py-1">
            Tavsiya
          </span>
        )}
      </div>
      <p className="text-[0.86rem] text-muted mt-1.5">{p.desc}</p>
      <div className="mt-5 flex items-end gap-1.5">
        <span className={`font-extrabold leading-none text-ink ${p.period ? "text-[2.4rem]" : "text-[2rem]"}`}>
          {p.price}
        </span>
        {p.period && <span className="text-[0.82rem] text-muted mb-1">{p.period}</span>}
      </div>
      <a
        href="/register"
        className={`mt-6 w-full ${p.featured ? "btn-primary relative overflow-visible" : "btn-ghost"}`}
      >
        {p.featured && <span className="absolute inset-0 rounded-full bg-accent/40 blur-lg -z-10 animate-pulse" />}
        {p.cta}
      </a>
      <ul className="flex flex-col gap-3 mt-7">
        {p.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[0.88rem] text-ink-soft">
            <Check />
            {f}
          </li>
        ))}
      </ul>
    </>
  );
}

