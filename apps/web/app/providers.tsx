'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  // Sahifalar orasida o'tishda ma'lumot keshda qoladi — "Yuklanmoqda..."
  // faqat birinchi ochilishda ko'rinadi, keyin fonda yangilanadi.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            // 429 (marketplace limiti) da qayta urinish faqat holatni yomonlashtiradi
            retry: (failureCount, error: any) =>
              error?.response?.status === 429 ? false : failureCount < 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
