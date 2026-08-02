"use client";

import { useLang } from "./LangProvider";

const socials = [
  { name: "Telegram", path: "M22 4L11 13M22 4l-7 18-4-9-9-4 20-5z" },
  { name: "Instagram", path: "M16 3H8a5 5 0 00-5 5v8a5 5 0 005 5h8a5 5 0 005-5V8a5 5 0 00-5-5zm-4 5a4 4 0 110 8 4 4 0 010-8zm4.5-.5h.01" },
  { name: "YouTube", path: "M22 12s0-3.5-.4-5a2.6 2.6 0 00-1.8-1.8C18 5 12 5 12 5s-6 0-7.8.2A2.6 2.6 0 002.4 7C2 8.5 2 12 2 12s0 3.5.4 5a2.6 2.6 0 001.8 1.8C6 19 12 19 12 19s6 0 7.8-.2a2.6 2.6 0 001.8-1.8c.4-1.5.4-5 .4-5zM10 15V9l5 3-5 3z" },
];

export default function Footer() {
  const { t } = useLang();
  const productLinks = [
    ["/#how", t.nav.how],
    ["/features", t.nav.features],
    ["/demo", t.nav.demo],
    ["/pricing", t.nav.pricing],
  ];

  return (
    <footer className="relative border-t border-line pt-14 pb-10 mt-6 bg-paper/60 backdrop-blur-sm">
      <div className="max-w-[1300px] mx-auto px-5 md:px-12">
        <div className="flex justify-between flex-wrap gap-10">
          <div className="max-w-[300px]">
            <div className="flex items-center gap-2.5 font-serif text-lg font-bold mb-3 text-ink">
              <span className="w-7 h-7 rounded-lg bg-grad-brand grid grid-cols-2 gap-[3px] p-[5px]">
                <span className="rounded-[2px] bg-white/95" />
                <span className="rounded-[2px] bg-white/45" />
                <span className="rounded-[2px] bg-white/45" />
                <span className="rounded-[2px] bg-white/95" />
              </span>
              Market<span className="text-gradient">Flow</span>
            </div>
            <p className="text-muted text-[0.88rem]">{t.footer.tagline}</p>
            <div className="flex gap-2.5 mt-5">
              {socials.map((s) => (
                <a
                  key={s.name}
                  href="#"
                  aria-label={s.name}
                  className="w-9 h-9 rounded-lg border border-line bg-paper grid place-items-center text-muted hover:text-white hover:bg-grad-brand hover:border-transparent hover:-translate-y-0.5 transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="flex gap-12 flex-wrap">
            <div>
              <h4 className="font-mono text-[0.72rem] text-muted uppercase tracking-wide mb-3.5">{t.footer.product}</h4>
              {productLinks.map(([h, label]) => (
                <a key={h} href={h} className="block text-[0.9rem] mb-2.5 text-ink-soft hover:text-accent transition-colors">{label}</a>
              ))}
            </div>
            <div>
              <h4 className="font-mono text-[0.72rem] text-muted uppercase tracking-wide mb-3.5">{t.footer.account}</h4>
              <a href="/login" className="block text-[0.9rem] mb-2.5 text-ink-soft hover:text-accent transition-colors">{t.nav.login}</a>
              <a href="/register" className="block text-[0.9rem] mb-2.5 text-ink-soft hover:text-accent transition-colors">{t.footer.signup}</a>
              <a href="/dashboard" className="block text-[0.9rem] mb-2.5 text-ink-soft hover:text-accent transition-colors">{t.footer.dash}</a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-line text-[0.8rem] text-muted flex justify-between items-center flex-wrap gap-3">
          <span>© 2026 MarketFlow. {t.footer.rights}</span>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-accent transition-colors">{t.footer.privacy}</a>
            <a href="#" className="hover:text-accent transition-colors">{t.footer.terms}</a>
            <a href="#top" aria-label="Top" className="w-9 h-9 rounded-lg border border-line bg-paper grid place-items-center hover:text-accent hover:-translate-y-0.5 transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

