'use client';

/**
 * TN VED tanlagichi.
 *
 * Nega ro'yxat: TN VED — bojxona kodi va sotuvchi uni o'zi topa olmaydi.
 * Ustiga WB kodni PREDMET bo'yicha tekshiradi: polo uchun to'g'ri kod
 * sarafan kategoriyasida qabul qilinmaydi ("Invalid HS code. Value doesn't
 * match the directory"). Shuning uchun ro'yxat WB dan, tanlangan
 * kategoriyaga qarab olinadi.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface TnvedItem {
  tnved: string;
  isKiz?: boolean;
}

export function TnvedPicker({
  marketplace,
  categoryId,
  value,
  onChange,
  className,
}: {
  marketplace: string;
  categoryId: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tnved', marketplace, categoryId],
    enabled: !!categoryId,
    staleTime: 12 * 60 * 60 * 1000,
    queryFn: async () =>
      (
        await api.get(`/cards/categories/${marketplace}/tnved`, {
          params: { subjectId: categoryId },
        })
      ).data.items as TnvedItem[],
  });

  // Kategoriyada bitta kod bo'lsa tanlashning ma'nosi yo'q — o'zi qo'yiladi
  useEffect(() => {
    if (!value && data?.length === 1) onChange(data[0].tnved);
  }, [data, value, onChange]);

  if (!categoryId) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Avval kategoriyani tanlang"
        className={className}
      />
    );
  }

  if (isLoading) {
    return (
      <div className={`${className} flex items-center gap-2 text-muted`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Kodlar yuklanmoqda...
      </div>
    );
  }

  // Ro'yxat kelmasa qo'lda kiritishni to'smaymiz — joylashda baribir
  // tekshiriladi va aniq xabar beriladi
  if (isError || !data?.length) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="10 ta raqam"
        className={className}
      />
    );
  }

  const known = data.some((item) => item.tnved === value);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">Tanlang... ({data.length} ta kod)</option>
      {/* Eski qiymat ro'yxatda bo'lmasa ham ko'rinib tursin — sotuvchi
          nima yozilganini bilsin va ataylab almashtirsin */}
      {value && !known && <option value={value}>{value} — bu kategoriyaga mos emas</option>}
      {data.map((item) => (
        <option key={item.tnved} value={item.tnved}>
          {item.tnved}
          {item.isKiz ? ' · Chesniy znak talab qiladi' : ''}
        </option>
      ))}
    </select>
  );
}
