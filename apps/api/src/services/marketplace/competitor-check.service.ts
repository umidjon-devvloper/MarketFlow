/**
 * Raqobatchi narxini o'qib, bazaga yozadigan qatlam.
 *
 * Sof mantiq (narx ajratish, taqqoslash) competitor.service.ts da — bu yerda
 * faqat Prisma bilan ishlash: kuzatuvni o'qish, narxni yangilash, tarixni
 * to'ldirish va "arzonlashdi" holatini aniqlash.
 *
 * VALYUTA: o'z narxi sifatida shu marketplace uchun kiritilgan Listing narxi
 * olinadi (uzum → UZS, .ru → RUB). Shunda taqqoslash doim bir valyutada
 * bo'ladi — basePrice (odatda UZS) ni RUB bilan solishtirib qo'ymaymiz.
 */

import { Marketplace } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import {
  fetchCompetitorPrice,
  priceVerdict,
  appendHistory,
  PriceComparison,
} from './competitor.service';

export interface WatchCheckResult {
  id: string;
  url: string;
  label: string | null;
  ok: boolean;
  price?: number;
  currency?: string;
  title?: string;
  error?: string;
  /** O'z narxiga nisbatan (bir valyutada bo'lsa) */
  comparison?: PriceComparison;
  /** Oldingi o'qishga nisbatan arzonlashdimi */
  priceDropped?: boolean;
  dropPct?: number;
}

function currencyOf(mp: Marketplace): 'UZS' | 'RUB' {
  return mp === 'UZUM' ? 'UZS' : 'RUB';
}

/** Kuzatuvga bog'langan mahsulotning shu bozordagi narxi (bir valyutada taqqoslash uchun) */
async function ownPriceFor(
  productId: string | null,
  marketplace: Marketplace,
): Promise<{ price: number; currency: string } | null> {
  if (!productId) return null;
  const listing = await prisma.listing.findUnique({
    where: { productId_marketplace: { productId, marketplace } },
    select: { price: true, discountPrice: true },
  });
  if (!listing) return null;
  // Amaldagi narx — chegirmali bo'lsa o'sha, aks holda asosiy
  const price = Number(listing.discountPrice ?? listing.price);
  if (!price) return null;
  return { price, currency: currencyOf(marketplace) };
}

/** Bitta kuzatuvni tekshirish (narxni o'qib, bazaga yozadi) */
export async function checkOneWatch(watchId: string): Promise<WatchCheckResult> {
  const watch = await prisma.competitorWatch.findUnique({
    where: { id: watchId },
    select: {
      id: true,
      url: true,
      label: true,
      marketplace: true,
      productId: true,
      lastPrice: true,
      history: true,
    },
  });
  if (!watch) throw new Error('Kuzatuv topilmadi');

  const base: WatchCheckResult = { id: watch.id, url: watch.url, label: watch.label, ok: false };

  let fetched;
  try {
    fetched = await fetchCompetitorPrice(watch.url);
  } catch (err: any) {
    const error = err?.message || "Narx o'qilmadi";
    await prisma.competitorWatch.update({
      where: { id: watch.id },
      data: { lastCheckedAt: new Date(), lastError: error },
    });
    return { ...base, error };
  }

  // Oldingi narxga nisbatan arzonlashish (doim bir manba, bir valyuta)
  const prev = watch.lastPrice != null ? Number(watch.lastPrice) : null;
  let priceDropped = false;
  let dropPct: number | undefined;
  if (prev != null && fetched.price < prev) {
    priceDropped = true;
    dropPct = Math.round(((prev - fetched.price) / prev) * 1000) / 10;
  }

  const today = new Date().toISOString().slice(0, 10);
  const history = appendHistory(watch.history, { date: today, price: fetched.price });

  await prisma.competitorWatch.update({
    where: { id: watch.id },
    data: {
      lastPrice: fetched.price,
      lastCurrency: fetched.currency,
      lastTitle: fetched.title ?? null,
      lastCheckedAt: new Date(),
      lastError: null,
      history,
    },
  });

  // O'z narxi bilan taqqoslash (bir valyutada bo'lsagina)
  const own = await ownPriceFor(watch.productId, watch.marketplace);
  const comparison = own
    ? priceVerdict(own.price, own.currency, fetched.price, fetched.currency)
    : undefined;

  return {
    ...base,
    ok: true,
    price: fetched.price,
    currency: fetched.currency,
    title: fetched.title,
    comparison,
    priceDropped,
    dropPct,
  };
}

/** Tashkilotning barcha kuzatuvlarini ketma-ket tekshirish */
export async function checkOrganizationCompetitors(
  organizationId: string,
): Promise<WatchCheckResult[]> {
  const watches = await prisma.competitorWatch.findMany({
    where: { organizationId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  const results: WatchCheckResult[] = [];
  for (const w of watches) {
    try {
      // Ketma-ket — bir xil hostga tez-tez urilmaslik uchun
      results.push(await checkOneWatch(w.id));
    } catch (err: any) {
      results.push({ id: w.id, url: '', label: null, ok: false, error: err?.message });
    }
  }
  return results;
}

/** Barcha faol tashkilotlar (cron uchun) */
export async function checkAllCompetitors(): Promise<{ orgs: number; checked: number; dropped: number }> {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true, competitorWatches: { some: {} } },
    select: { id: true },
  });

  let checked = 0;
  let dropped = 0;
  for (const org of orgs) {
    try {
      const results = await checkOrganizationCompetitors(org.id);
      checked += results.filter((r) => r.ok).length;
      dropped += results.filter((r) => r.priceDropped).length;
    } catch (err: any) {
      console.error(`Raqobatchi tekshiruvi (${org.id}) xato: ${err?.message}`);
    }
  }
  return { orgs: orgs.length, checked, dropped };
}
