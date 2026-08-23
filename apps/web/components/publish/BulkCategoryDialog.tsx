'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Tag, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { CategoryPicker, CategoryOption } from '@/components/CategoryPicker';
import { useToast } from '@/components/Toast';

interface BulkCategoryDialogProps {
  marketplace: string;
  marketplaceName: string;
  /** Kategoriya qo'yiladigan mahsulotlar */
  productIds: string[];
  onClose: () => void;
  /** Muvaffaqiyatdan keyin — ro'yxatni yangilash uchun */
  onApplied: (readyCount: number) => void;
}

interface ApplyResult {
  updated: number;
  ready: string[];
  stillMissing: Array<{ productId: string; title: string; missing: string[] }>;
  message: string;
}

/**
 * Bir nechta kartochkaga bitta kategoriyani birdan qo'yish.
 *
 * Nega kerak: bir turdagi tovarlar (masalan 40 ta ko'ylak) bir xil
 * kategoriyaga tushadi. Har birini sehrgarda alohida ochib tanlash —
 * bir xil ishni 40 marta takrorlash demak.
 *
 * Server tomonda faqat `categoryId` yozilmaydi: kartochka boshqa marketplace
 * uchun to'ldirilgan bo'lsa, qolgan maydonlar ham ko'chiriladi (birliklar
 * o'girilib). Shuning uchun natijada "nechtasi joylashga tayyor bo'ldi"
 * deb aniq javob qaytaradi.
 */
export function BulkCategoryDialog({
  marketplace,
  marketplaceName,
  productIds,
  onClose,
  onApplied,
}: BulkCategoryDialogProps) {
  const toast = useToast();
  const [picked, setPicked] = useState<CategoryOption | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc bilan yopish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, applying]);

  const apply = async () => {
    if (!picked) return;
    setApplying(true);
    try {
      const { data } = await api.post<ApplyResult>('/cards/bulk-category', {
        marketplace,
        productIds,
        categoryId: picked.id,
        typeId: picked.typeId,
        name: picked.name,
      });
      setResult(data);
      onApplied(data.ready.length);
    } catch (err: any) {
      toast('error', err.response?.data?.error || "Kategoriyani qo'yib bo'lmadi");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-category-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !applying && onClose()}
        aria-hidden="true"
      />

      <div ref={dialogRef} className="relative card p-6 w-full max-w-lg animate-fade-up">
        <button
          onClick={onClose}
          disabled={applying}
          aria-label="Yopish"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted transition hover:bg-panel hover:text-ink disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        {result ? (
          // ── Natija ──────────────────────────────────────
          <>
            <div className="flex gap-3.5 mb-5">
              <span className="w-11 h-11 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div className="min-w-0">
                <h2 id="bulk-category-title" className="font-semibold text-[17px]">
                  {result.updated} ta kartochka yangilandi
                </h2>
                <p className="text-sm text-ink-soft mt-1">
                  {result.ready.length > 0 && (
                    <>
                      <b>{result.ready.length} tasi</b> {marketplaceName} ga joylashga tayyor.{' '}
                    </>
                  )}
                  {result.stillMissing.length > 0 && (
                    <>{result.stillMissing.length} tasida boshqa maydonlar yetishmayapti.</>
                  )}
                </p>
              </div>
            </div>

            {result.stillMissing.length > 0 && (
              <div className="rounded-[18px] border border-amber-500/30 bg-amber-500/10 p-4 mb-5 max-h-52 overflow-y-auto">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Hali to&apos;liq emas
                </p>
                <ul className="space-y-1.5">
                  {result.stillMissing.map((item) => (
                    <li key={item.productId} className="text-xs">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-muted"> — {item.missing.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={onClose} className="btn-primary w-full">
              Yopish
            </button>
          </>
        ) : (
          // ── Tanlash ─────────────────────────────────────
          <>
            <div className="flex gap-3.5 mb-5">
              <span className="w-11 h-11 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                <Tag className="w-5 h-5 text-accent" />
              </span>
              <div className="min-w-0">
                <h2 id="bulk-category-title" className="font-semibold text-[17px] leading-snug">
                  {productIds.length} ta kartochkaga bitta kategoriya
                </h2>
                <p className="text-sm text-ink-soft mt-1">
                  {marketplaceName} katalogidan tanlang — u barcha tanlangan kartochkalarga
                  qo&apos;yiladi. Boshqa maydonlar mavjud kartochkadan ko&apos;chiriladi.
                </p>
              </div>
            </div>

            <label className="block text-sm font-medium mb-1.5">
              Kategoriya <span className="text-red-500">*</span>
            </label>
            <CategoryPicker
              marketplace={marketplace}
              value={picked?.name ?? ''}
              categoryId={picked?.id ?? ''}
              onSelect={setPicked}
            />

            {picked && (
              <p className="text-xs text-muted mt-2">
                Tanlandi: <span className="font-medium text-ink">{picked.path}</span>
              </p>
            )}

            <div className="flex gap-2.5 mt-6">
              <button onClick={onClose} disabled={applying} className="btn-ghost btn-sm flex-1">
                Bekor qilish
              </button>
              <button
                onClick={apply}
                disabled={!picked || applying}
                className="btn-primary btn-sm flex-1 disabled:opacity-50"
              >
                {applying && <Loader2 className="w-4 h-4 animate-spin" />}
                Hammasiga qo&apos;yish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
