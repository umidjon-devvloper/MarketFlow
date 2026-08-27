/**
 * WB kartochkalariga rasmni AVTOMATIK biriktirish.
 *
 * Nega alohida: WB kartochkani asinxron yaratadi — cards/upload "qabul qilindi"
 * deydi, kartochka esa ~30 daqiqagacha yaraladi. Media faqat nmID paydo
 * bo'lgach biriktiriladi. Ilgari bu faqat sotuvchi "Tekshirish"ni bosганда
 * bo'lardi — bossa, WB tayyor bo'lsa. Aks holda rasm hech qachon biriktirilmasdi.
 *
 * Bu cron PENDING WB listinglarni davriy tekshirib, WB tayyor bo'lgani hamon
 * rasmlarni o'zi biriktiradi va holatni yangilaydi.
 */

import { prisma } from '../../utils/prisma';
import { decrypt } from '../../utils/encryption';
import { finalizeWbCard } from './publish.service';

export interface FinalizeReport {
  checked: number;
  attached: number;
  stillPending: number;
  failed: number;
}

/**
 * PENDING WB kartochkalarni yakunlaydi.
 * @param minAgeMs — listing shu vaqtdан eski bo'lsagina tekshiriladi (WB'ga
 *                   yaratishga vaqt berish uchun; standart 10 daqiqa).
 */
export async function finalizePendingWbCards(opts: { minAgeMs?: number } = {}): Promise<FinalizeReport> {
  const minAge = opts.minAgeMs ?? 10 * 60_000;
  const cutoff = new Date(Date.now() - minAge);

  const pending = await prisma.listing.findMany({
    where: {
      marketplace: 'WB',
      status: 'PENDING',
      externalId: { not: null },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      externalId: true,
      product: {
        select: {
          organizationId: true,
          images: { select: { url: true, variant: true } },
        },
      },
    },
    orderBy: { updatedAt: 'asc' },
    take: 50,
  });

  const report: FinalizeReport = { checked: pending.length, attached: 0, stillPending: 0, failed: 0 };

  // Tashkilot kaliti bir marta ochilib keshlanadi
  const credCache = new Map<string, string | null>();

  for (const listing of pending) {
    const orgId = listing.product.organizationId;
    let apiKey = credCache.get(orgId);
    if (apiKey === undefined) {
      const cred = await prisma.userMarketplace.findFirst({
        where: { organizationId: orgId, marketplace: 'WB', isActive: true },
        select: { apiKey: true },
      });
      try {
        apiKey = cred ? decrypt(cred.apiKey) : null;
      } catch {
        apiKey = null; // kalit shifri ochilmadi — o'tkazamiz
      }
      credCache.set(orgId, apiKey);
    }
    if (!apiKey) continue;

    // WB uchun moslashtirilgan rasm bo'lsa — o'sha, aks holda asl rasmlar
    const adapted = listing.product.images.filter((i) => (i.variant as string) === 'WB');
    const imageUrls = (adapted.length ? adapted : listing.product.images).map((i) => i.url);

    try {
      const res = await finalizeWbCard(apiKey, listing.externalId!, imageUrls);
      if (res.success && !res.pending) {
        // Yaratildi (media biriktirildi yoki rasm yo'q) → PUBLISHED
        await prisma.listing.update({
          where: { id: listing.id },
          data: { status: 'PUBLISHED', lastSyncedAt: new Date() },
        });
        report.attached++;
      } else if (!res.success) {
        // WB rad etdi — sababni saqlaymiz
        await prisma.listing.update({
          where: { id: listing.id },
          data: { status: 'ERROR', errorMessage: res.message?.slice(0, 500) },
        });
        report.failed++;
      } else {
        // Hali yaratilmagan — keyingi safar qayta urinamiz
        report.stillPending++;
      }
    } catch {
      // Tarmoq/limit xatosi — holatni o'zgartirmaymiz, keyingi safar
      report.stillPending++;
    }
  }

  return report;
}
