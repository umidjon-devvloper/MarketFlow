'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * So'rov xatosini ko'rsatuvchi banner.
 *
 * Nega kerak: `useQuery` da `data = []` deb standart qiymat berilsa, xato
 * bilan bo'sh natija bir xil ko'rinadi — ekran shunchaki "hech narsa yo'q"
 * deydi va sabab yashirin qoladi. Shu banner aynan shuni oldini oladi.
 */
export function QueryError({
  error,
  onRetry,
  className = '',
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const status = (error as any)?.response?.status;
  const message =
    (error as any)?.response?.data?.error || (error as Error)?.message || 'Nomaʼlum xato';

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium text-red-900">
          {status === 429
            ? "So'rovlar limitiga yetdik"
            : "Ma'lumotni yuklab bo'lmadi"}
        </p>
        <p className="text-red-700 dark:text-red-300 mt-0.5 break-words">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-sm text-red-700 dark:text-red-300 hover:bg-red-100 flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Qayta
        </button>
      )}
    </div>
  );
}
