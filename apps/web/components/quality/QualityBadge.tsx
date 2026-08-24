'use client';

export type QualityGrade = 'zaif' | 'o‘rtacha' | 'yaxshi' | 'a‘lo';

export interface QualityFactor {
  key: string;
  label: string;
  points: number;
  max: number;
  status: 'ok' | 'partial' | 'empty';
  hint?: string;
}

export interface QualityScore {
  score: number;
  grade: QualityGrade;
  factors: QualityFactor[];
  topSuggestion?: string;
}

/** Baho darajasiga qarab rang — semantik, brend rangidan alohida */
function toneClasses(score: number): { ring: string; text: string } {
  if (score >= 90) return { ring: 'text-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 70) return { ring: 'text-accent', text: 'text-accent' };
  if (score >= 45) return { ring: 'text-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  return { ring: 'text-red-500', text: 'text-red-600 dark:text-red-400' };
}

/**
 * Aylanma ko'rsatkich — ro'yxatda va sehrgarda ballni bir qarashda ko'rsatadi.
 * Rang darajani bildiradi (qizil→zaif, yashil→a'lo), raqamdan ko'ra tezroq o'qiladi.
 */
export function QualityRing({ score, size = 44 }: { score: number; size?: number }) {
  const tone = toneClasses(score);
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <span
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Sifat bahosi: ${score} / 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="text-line"
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={`${tone.ring} transition-[stroke-dashoffset] duration-500`}
          stroke="currentColor"
        />
      </svg>
      <span
        className={`absolute text-[11px] font-bold tabular-nums ${tone.text}`}
        style={{ fontSize: size < 40 ? 10 : 12 }}
      >
        {score}
      </span>
    </span>
  );
}

/** Ixcham yorliq — ro'yxat qatorlari uchun */
export function QualityPill({ quality }: { quality: QualityScore }) {
  const tone = toneClasses(quality.score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone.text}`}
      title={quality.topSuggestion || `Sifat: ${quality.grade}`}
    >
      <QualityRing score={quality.score} size={34} />
      <span className="hidden sm:inline">{quality.grade}</span>
    </span>
  );
}

/**
 * To'liq panel — sehrgarda, omillar taqsimoti bilan.
 * Sotuvchi qaysi omil ball yo'qotayotganini va nima qilish kerakligini ko'radi.
 */
export function QualityPanel({ quality }: { quality: QualityScore }) {
  const tone = toneClasses(quality.score);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-4 mb-4">
        <QualityRing score={quality.score} size={56} />
        <div className="min-w-0">
          <p className="font-semibold">
            Sifat bahosi: <span className={tone.text}>{quality.grade}</span>
          </p>
          <p className="text-xs text-muted mt-0.5">
            Marketplace kartochkani shunga o‘xshash mezon bo‘yicha reytinglaydi —
            baho qancha yuqori bo‘lsa, qidiruvdagi o‘rin shuncha yaxshi.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {quality.factors.map((f) => {
          const pct = f.max ? Math.round((f.points / f.max) * 100) : 100;
          const barColor =
            f.status === 'ok'
              ? 'bg-emerald-500'
              : f.status === 'partial'
                ? 'bg-amber-500'
                : 'bg-red-500';
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink-soft">{f.label}</span>
                <span className="text-muted tabular-nums">
                  {f.points}/{f.max}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-panel overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-[width] duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {f.hint && <p className="text-[11px] text-muted mt-1">{f.hint}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
