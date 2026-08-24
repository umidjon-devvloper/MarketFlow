/**
 * Raqobatchi narx kuzatuvi
 *
 * Sotuvchi bergan ochiq mahsulot havolasidan narxni o'qiydi. Havolani
 * sotuvchi kiritadi (o'z tanlovi va mas'uliyati) — biz "hamma raqobatchini"
 * ko'r-ko'rona qidirmaymiz, chunki bir xil tovar turli sotuvchida turli nom
 * bilan turadi va avtomatik moslashtirsak yanglish taqqoslash chiqadi.
 *
 * Narx sahifaning OpenGraph / JSON-LD meta ma'lumotidan olinadi — bu barcha
 * yirik marketplace mahsulot sahifalarida bor. Baъzan narx faqat brauzerda
 * (JS bilan) chiziladi va meta'da bo'lmaydi — bunda "narx o'qilmadi" deb
 * halol aytamiz, 0 deb ko'rsatmaymiz.
 *
 * VALYUTA: raqobatchi o'z bozori valyutasida (uzum.uz — UZS, .ru — RUB).
 * O'zining narxi bilan solishtirish faqat valyuta mos kelganda.
 */

import { Marketplace } from '@prisma/client';

export interface CompetitorSource {
  marketplace: Marketplace;
  currency: 'UZS' | 'RUB';
}

/**
 * Havola hostidan qaysi marketplace ekanini aniqlash.
 * Noma'lum host — kuzatib bo'lmaydi (qaysi valyuta ekani ham noma'lum).
 */
export function detectMarketplace(url: string): CompetitorSource | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (host.includes('uzum.uz')) return { marketplace: 'UZUM', currency: 'UZS' };
  if (host.includes('wildberries.') || host.includes('wb.ru')) return { marketplace: 'WB', currency: 'RUB' };
  if (host.includes('ozon.')) return { marketplace: 'OZON', currency: 'RUB' };
  if (host.includes('market.yandex.') || host.includes('yandex.'))
    return { marketplace: 'YANDEX', currency: 'RUB' };

  return null;
}

export interface CompetitorPrice {
  price: number;
  currency: string;
  title?: string;
}

/** Sahifadan narx, valyuta va nomni ajratib olish */
export function parsePrice(html: string, fallbackCurrency: string): CompetitorPrice | null {
  const price = extractPrice(html);
  if (price === null) return null;

  const title =
    match(html, /<meta property="og:title" content="([^"]+)"/) ||
    match(html, /<meta name="title" content="([^"]+)"/) ||
    undefined;

  const currency =
    match(html, /<meta property="(?:og|product):price:currency" content="([^"]+)"/) ||
    match(html, /"priceCurrency"\s*:\s*"([^"]+)"/) ||
    fallbackCurrency;

  return { price, currency: normalizeCurrency(currency, fallbackCurrency), title };
}

function match(html: string, re: RegExp): string | undefined {
  return html.match(re)?.[1]?.trim();
}

/** Turli marketplace turli belgida beradi — bir nechta naqshni ketma-ket sinaymiz */
function extractPrice(html: string): number | null {
  const patterns = [
    /<meta property="(?:og|product):price:amount" content="([\d.,\s]+)"/,
    /"price"\s*:\s*"?([\d.,\s]+?)"?[,}]/,
    /"salePriceU?"\s*:\s*"?([\d.]+)"?/, // WB (kopeykada bo'lishi mumkin)
    /"finalPrice"\s*:\s*"?([\d.]+)"?/,
  ];

  for (const re of patterns) {
    const raw = html.match(re)?.[1];
    if (!raw) continue;
    // Bo'shliq va mingliklarni tozalab songa aylantiramiz
    const num = Number(raw.replace(/\s/g, '').replace(/,/g, '.').replace(/\.(?=\d{3}\b)/g, ''));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function normalizeCurrency(value: string, fallback: string): string {
  // Kichik harfga keltiramiz — belgilar kirill (сум/руб) va lotin (so'm)
  // aralash keladi, toUpperCase kirillni buzib qo'yardi
  const v = value.toLowerCase();
  if (v.includes('uzs') || v.includes('сум') || v.includes("so'm") || v.includes('som')) return 'UZS';
  if (v.includes('rub') || v.includes('rur') || v.includes('₽') || v.includes('руб')) return 'RUB';
  return fallback;
}

/** Ochiq sahifadan narxni o'qish */
export async function fetchCompetitorPrice(url: string): Promise<CompetitorPrice> {
  const source = detectMarketplace(url);
  if (!source) {
    throw new Error(
      "Havola tanilmadi. Uzum, Wildberries, Ozon yoki Yandex Market mahsulot havolasini kiriting.",
    );
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'uz,ru;q=0.9,en;q=0.8',
      },
    });
  } catch (err: any) {
    throw new Error(`Sahifaga ulanib bo'lmadi: ${err?.message || 'tarmoq xatosi'}`);
  }

  if (!res.ok) {
    throw new Error(`Sahifa ochilmadi (${res.status}) — havola to'g'riligini tekshiring`);
  }

  const html = await res.text();
  const parsed = parsePrice(html, source.currency);
  if (!parsed) {
    throw new Error(
      "Narxni o'qib bo'lmadi — sahifada narx brauzerda chiziladigan bo'lishi mumkin. " +
        'Boshqa (masalan mahsulotning to\'g\'ridan-to\'g\'ri) havolasini sinang.',
    );
  }
  return parsed;
}

// ─── TAQQOSLASH (sof, testlanadi) ────────────────────────

export type Verdict = 'cheaper' | 'pricier' | 'same' | 'incomparable';

export interface PriceComparison {
  verdict: Verdict;
  /** Raqobatchi qancha arzon/qimmat (o'z narxiga nisbatan foiz), agar taqqoslansa */
  diffPct: number | null;
  reason?: string;
}

/**
 * Raqobatchi narxini o'zinikiga solishtirish.
 *
 * Faqat bir xil valyutada: UZS narxni RUB bilan taqqoslash ma'nosiz va
 * "arzon" degan yanglish xulosa berardi. Valyuta mos kelmasa — incomparable.
 */
export function priceVerdict(
  ownPrice: number | null | undefined,
  ownCurrency: string | null | undefined,
  compPrice: number | null | undefined,
  compCurrency: string | null | undefined,
): PriceComparison {
  if (!ownPrice || !compPrice) {
    return { verdict: 'incomparable', diffPct: null, reason: 'narx yetarli emas' };
  }
  if (!ownCurrency || !compCurrency || ownCurrency !== compCurrency) {
    return {
      verdict: 'incomparable',
      diffPct: null,
      reason: `valyuta har xil (${ownCurrency ?? '—'} va ${compCurrency ?? '—'})`,
    };
  }

  const diffPct = Math.round(((compPrice - ownPrice) / ownPrice) * 1000) / 10;
  if (compPrice < ownPrice) return { verdict: 'cheaper', diffPct };
  if (compPrice > ownPrice) return { verdict: 'pricier', diffPct };
  return { verdict: 'same', diffPct: 0 };
}

/** Narx tarixiga nuqta qo'shish, oxirgi 60 tasini saqlab */
export function appendHistory(
  history: unknown,
  point: { date: string; price: number },
): Array<{ date: string; price: number }> {
  const list = Array.isArray(history) ? (history as Array<{ date: string; price: number }>) : [];
  // Shu kunga yozuv bo'lsa yangilaymiz, aks holda qo'shamiz
  const existing = list.findIndex((h) => h.date === point.date);
  if (existing >= 0) list[existing] = point;
  else list.push(point);
  return list.slice(-60);
}

export const __internal = { extractPrice, normalizeCurrency };
