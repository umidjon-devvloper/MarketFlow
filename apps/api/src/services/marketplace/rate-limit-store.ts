/**
 * Tezlik cheklovining BAZADAGI qismi.
 *
 * Xotiradagi cheklovchi (rate-limit.ts) bitta jarayon ichida ishlaydi. Ilova
 * serverless muhitda joylashtirilgan: har so'rov yangi jarayonda bajariladi
 * va hisoblagich har safar noldan boshlanadi — ya'ni u yerda cheklov umuman
 * ishlamaydi. Marketplace limitlari esa qat'iy: WB rasm biriktirish
 * endpointi daqiqasiga BITTA so'rov beradi (x-ratelimit-limit: 1), buyurtma
 * va qoldiq endpointlari ham shunga yaqin.
 *
 * Shuning uchun "keyingi so'rovga ruxsat" vaqti bazada saqlanadi va barcha
 * nusxalar uchun umumiy bo'ladi.
 *
 * Baza yetib bo'lmasa (jadval yo'q, ulanish yo'q) — cheklov jimgina
 * o'tkazib yuboriladi: ish to'xtab qolgandan ko'ra xotiradagi cheklov bilan
 * davom etgani yaxshiroq.
 */

import { prisma } from '../../utils/prisma';

export interface Reservation {
  /** So'rov yuborish mumkinmi */
  ok: boolean;
  /** Ruxsatgacha qancha qolgani (ok=false bo'lganda) */
  waitMs: number;
}

const ALLOWED: Reservation = { ok: true, waitMs: 0 };

/** Baza ishlamasa har so'rovda urinib, loglarni to'ldirmaymiz */
let storeBroken = false;

/**
 * Kalit uchun navbatdagi o'rinni band qiladi.
 *
 * Atomar: yozuv faqat vaqti kelgan bo'lsa yangilanadi. Ikki nusxa bir
 * vaqtda so'rasa, faqat bittasi ruxsat oladi — shart baza tomonida
 * tekshiriladi, shuning uchun poyga holati yo'q.
 */
export async function reserveSlot(key: string, gapMs: number): Promise<Reservation> {
  if (storeBroken || gapMs <= 0) return ALLOWED;

  try {
    const rows = await prisma.$queryRaw<Array<{ nextAllowedAt: Date }>>`
      INSERT INTO "RateLimit" ("key", "nextAllowedAt", "updatedAt")
      VALUES (${key}, NOW() + (${gapMs} || ' milliseconds')::interval, NOW())
      ON CONFLICT ("key") DO UPDATE
        SET "nextAllowedAt" = NOW() + (${gapMs} || ' milliseconds')::interval,
            "updatedAt" = NOW()
        WHERE "RateLimit"."nextAllowedAt" <= NOW()
      RETURNING "nextAllowedAt"
    `;

    if (rows.length) return ALLOWED;

    // Band — qancha kutish kerakligini aytamiz
    const current = await prisma.rateLimit.findUnique({
      where: { key },
      select: { nextAllowedAt: true },
    });
    const waitMs = Math.max(0, (current?.nextAllowedAt?.getTime() ?? 0) - Date.now());
    return { ok: waitMs === 0, waitMs };
  } catch (err) {
    // Jadval hali yaratilmagan bo'lishi mumkin (prisma db push qilinmagan)
    storeBroken = true;
    console.warn(
      "Tezlik cheklovi bazada ishlamadi — xotiradagisi bilan davom etamiz. " +
        "Jadvalni yaratish uchun: npm run prisma:push",
      (err as Error)?.message,
    );
    return ALLOWED;
  }
}

/** Testlar uchun: keyingi urinishda bazani qayta sinaydi */
export function resetRateLimitStore(): void {
  storeBroken = false;
}
