'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast faqat ToastProvider ichida ishlaydi');
  return ctx.toast;
}

const ICONS = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />,
  error: <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-accent flex-shrink-0" />,
};

// Shaffof ranglar ataylab: qattiq `border-emerald-500/30` qorong'i rejimda
// oqarib, kartaning chegarasi yo'qoladi
const BORDERS = {
  success: 'border-emerald-500/30',
  error: 'border-red-500/30',
  info: 'border-accent/30',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto card border ${BORDERS[t.type]} p-3.5 flex items-start gap-2.5 animate-fade-up`}
          >
            {ICONS[t.type]}
            <p className="text-sm flex-1 break-words">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Xabarni yopish"
              className="text-muted hover:text-ink transition flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
