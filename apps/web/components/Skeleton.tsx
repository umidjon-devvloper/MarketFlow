/**
 * Yuklanish holatlari.
 *
 * Ilovada ikki xil uslub yonma-yon yashardi: bir qismida chiroyli skeleton,
 * boshqasida oddiy "Yuklanmoqda..." matni. Kutish vaqti bir xil, lekin
 * skeleton bilan sahifa tezroq ochilgandek tuyuladi va joylashuv sakramaydi —
 * matn kelganda hamma narsa o'z o'rnida qoladi.
 */

interface SkeletonProps {
  className?: string;
}

/** Bitta to'rtburchak — o'zingiz o'lcham berasiz */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`bg-panel rounded animate-pulse ${className}`} aria-hidden="true" />;
}

/** Matn qatorlari — oxirgisi qisqaroq, haqiqiy paragrafdek ko'rinsin */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

/** Jadval/ro'yxat qatorlari — rasm + matn + o'ng tomonda raqam */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="p-4 flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-20 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Kartalar to'ri */
export function SkeletonCards({ count = 4, height = 'h-[190px]' }: { count?: number; height?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`card ${height} animate-pulse`} aria-hidden="true" />
      ))}
    </>
  );
}

/**
 * Butun sahifa yuklanayotgani.
 * `label` ekran o'quvchi uchun — ko'zga ko'rinmaydi, lekin eshitiladi.
 */
export function SkeletonPage({ label = 'Yuklanmoqda' }: { label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className="space-y-3 mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="card p-6 space-y-4">
        <SkeletonText lines={2} />
        <SkeletonRows rows={4} />
      </div>
    </div>
  );
}
