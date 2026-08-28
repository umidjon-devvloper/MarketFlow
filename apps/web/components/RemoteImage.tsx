'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';

/**
 * Rasm ko'rsatish — optimizatsiya bilan, lekin hech qachon sinmaydigan.
 *
 * Nega oddiy <img> yaramaydi: mahsulot rasmlari sotuvchi yuklagan asl fayllar,
 * ko'pincha bir necha megabayt. Ro'yxatda ular 40–64 px da ko'rsatiladi, ya'ni
 * har sahifada ortiqcha o'nlab megabayt yuklanadi va joylashuv sakraydi.
 *
 * Nega next/image ni to'g'ridan-to'g'ri ishlatmaymiz: u faqat
 * `next.config.js` dagi remotePatterns ro'yxatidagi hostlarni optimallashtiradi,
 * qolganlarida 400 qaytarib rasmni BUTUNLAY yo'q qiladi. Bizda esa manzillar
 * turli joydan keladi — UploadThing, o'z API'miz, marketplace CDN'lari.
 * Shuning uchun xato bo'lsa oddiy <img> ga tushamiz: rasm baribir ko'rinadi,
 * faqat optimallashtirilmagan holda.
 */

interface RemoteImageProps {
  src?: string | null;
  alt: string;
  /** Tashqi konteyner klasslari — o'lchamni shu yerda bering (w-10 h-10) */
  className?: string;
  /** object-fit. Logotiplar uchun 'contain', suratlar uchun 'cover' */
  fit?: 'cover' | 'contain';
  /**
   * Brauzerga rasm qanchalik katta ko'rsatilishini aytadi.
   * Kichik nishonchalar uchun aniq piksel berish eng foydali —
   * shunda 4 MB lik surat o'rniga 64 px lik nusxa keladi.
   */
  sizes?: string;
  /** Sahifadagi asosiy rasm bo'lsa (LCP) */
  priority?: boolean;
  /** Rasm bo'lmaganda ko'rsatiladigan element */
  fallback?: React.ReactNode;
}

export function RemoteImage({
  src,
  alt,
  className = '',
  fit = 'cover',
  sizes = '96px',
  priority,
  fallback,
}: RemoteImageProps) {
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);

  // `inline-block` shart: o'rov elementi <span>, ya'ni oddiy holatda inline —
  // inline elementga esa w-28 h-28 kabi o'lcham berilmaydi va rasm nolga siqilib
  // qoladi. Flex konteyner ichida bo'lsa brauzer uni o'zi blok qiladi, shuning
  // uchun xato faqat oddiy blok ota-element ichida ko'rinardi (masalan rasm
  // moslashtirish qadamidagi "Asl → Wildberries" ustunlari).
  // Ikki display klassini bitta qatorga qo'shmaymiz: qaysi biri g'olib bo'lishi
  // Tailwind chiqargan CSS tartibiga bog'liq bo'lib qolardi. Har shoxobcha o'z
  // display'ini o'zi beradi.
  const box = `relative overflow-hidden align-middle ${className}`;
  const objectFit = fit === 'contain' ? 'object-contain' : 'object-cover';

  if (!src || missing) {
    return (
      <span className={`${box} bg-panel inline-flex items-center justify-center`}>
        {fallback ?? <ImageOff className="w-1/3 h-1/3 text-muted/50" aria-hidden="true" />}
      </span>
    );
  }

  // Optimizator bu hostni qabul qilmadi — asl manzilni o'zini ko'rsatamiz
  if (failed) {
    return (
      <span className={`${box} inline-block`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setMissing(true)}
          className={`w-full h-full ${objectFit}`}
        />
      </span>
    );
  }

  return (
    <span className={`${box} inline-block`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onError={() => setFailed(true)}
        className={objectFit}
      />
    </span>
  );
}

/**
 * Foydalanuvchi yoki tashkilot avatari.
 * Rasm bo'lmasa bosh harflar ko'rsatiladi — bo'sh kulrang doiradan yaxshiroq.
 */
export function Avatar({
  src,
  name,
  className = '',
}: {
  src?: string | null;
  name?: string;
  className?: string;
}) {
  const initials = (name || 'MF')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (!src) {
    return <span className={`${className} flex items-center justify-center`}>{initials}</span>;
  }

  return (
    <RemoteImage
      src={src}
      alt={name || ''}
      className={className}
      fit="cover"
      sizes="48px"
      fallback={<span className="text-xs font-bold">{initials}</span>}
    />
  );
}
