'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Tasdiqlash oynasi.
 *
 * Brauzerning `confirm()` i butun dizaynni bir zumda "shablon sayt" darajasiga
 * tushiradi — ayniqsa o'chirish kabi eng keskin lahzada. Ustiga u temaga
 * bo'ysunmaydi, matnini formatlab bo'lmaydi va nima o'chayotganini
 * ko'rsatolmaydi.
 *
 * Ishlatish:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: '...', danger: true }))) return;
 */

export interface ConfirmOptions {
  title: string;
  /** Qo'shimcha tushuntirish — nima yo'qoladi, qaytarib bo'ladimi */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Qaytarib bo'lmaydigan amal — tugma qizil bo'ladi */
  danger?: boolean;
}

type Resolver = (ok: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm faqat ConfirmProvider ichida ishlaydi');
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  // Ochilganda fokus tasdiqlash tugmasiga o'tadi
  useEffect(() => {
    if (options) confirmButtonRef.current?.focus();
  }, [options]);

  // Esc — bekor qilish; Tab — fokus oyna ichida qoladi
  useEffect(() => {
    if (!options) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
        return;
      }
      if (e.key !== 'Tab') return;

      // Fokus tuzog'i: oyna ochiq ekan, orqadagi sahifaga o'tib bo'lmaydi
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {options && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => close(false)}
            aria-hidden="true"
          />

          <div
            ref={dialogRef}
            className="relative card p-6 w-full max-w-md animate-fade-up"
          >
            <div className="flex gap-3.5">
              <span
                className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                  options.danger ? 'bg-red-500/10' : 'bg-accent-soft'
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 ${
                    options.danger ? 'text-red-600 dark:text-red-400' : 'text-accent'
                  }`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="font-semibold text-[17px] leading-snug">
                  {options.title}
                </h2>
                {options.description && (
                  <p className="text-sm text-ink-soft mt-1.5">{options.description}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2.5 mt-6">
              <button onClick={() => close(false)} className="btn-ghost btn-sm flex-1">
                {options.cancelLabel || 'Bekor qilish'}
              </button>
              <button
                ref={confirmButtonRef}
                onClick={() => close(true)}
                className={
                  options.danger
                    ? 'btn btn-sm flex-1 text-white font-semibold bg-red-600 hover:bg-red-700 transition'
                    : 'btn-primary btn-sm flex-1'
                }
              >
                {options.confirmLabel || 'Ha, davom etish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
