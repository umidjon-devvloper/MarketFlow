/**
 * Bitta marketplace bo'yicha analitika yig'uvchi servis.
 *
 * Adapter interfeysi ustida ishlaydi — ya'ni UZUM, OZON, WB va YANDEX uchun
 * bir xil kodda hisoblanadi. Natija ham grafik chizish uchun, ham AI
 * maslahatchisiga kirish ma'lumoti sifatida ishlatiladi.
 */

import type { AdapterCreds, Marketplace, MarketplaceAdapter } from './adapter';

/** Kunlik kesim — grafik uchun */
export interface DailyPoint {
  date: string; // YYYY-MM-DD
  orders: number;
  revenue: number;
}

export interface TopProduct {
  sku: string;
  name?: string;
  qty: number;
  revenue: number;
  share: number; // umumiy daromaddagi ulushi, %
}

export interface StockAlert {
  sku: string;
  name?: string;
  amount: number;
}

export interface MarketplaceInsights {
  marketplace: Marketplace;
  currency: string;
  periodDays: number;
  totals: {
    orders: number;
    revenue: number;
    avgOrder: number;
    cancelled: number;
    itemsSold: number;
  };
  /** Oldingi shu uzunlikdagi davr bilan taqqoslash (%) */
  trend: {
    ordersPct: number | null;
    revenuePct: number | null;
  };
  daily: DailyPoint[];
  topProducts: TopProduct[];
  slowMovers: TopProduct[];
  outOfStock: StockAlert[];
  lowStock: StockAlert[];
  productsTotal: number | null;
  /** Ma'lumotning qaysi qismi olinmagani — foydalanuvchiga ochiq aytamiz */
  warnings: string[];
}

/**
 * Buyurtmalarni sahifalab yig'ish. Sahifa soni ataylab kam —
 * marketplace limitlariga urilmaslik analitikaning to'liqligidan muhimroq.
 */
const MAX_ORDER_PAGES = 3;
const ORDER_PAGE_SIZE = 100;
const LOW_STOCK_THRESHOLD = 5;

/** Xulosa olinmasa ishlatiladigan standart valyuta */
const DEFAULT_CURRENCY: Record<string, string> = {
  UZUM: 'UZS',
  OZON: 'RUB',
  WB: 'RUB',
  YANDEX: 'RUB',
};

/** Limitga urilgan bo'lsak — qolgan so'rovlarni umuman yubormaymiz */
function isRateLimited(err: any): boolean {
  return err?.status === 429 || /429|too many/i.test(err?.message || '');
}

function isCancelled(status?: string): boolean {
  if (!status) return false;
  return /cancel|отмен|CANCELLED|REJECTED|RETURNED/i.test(status);
}

function dayKey(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Davr ichidagi har bir kun uchun bo'sh nuqta — grafikda uzilish bo'lmasligi uchun */
function emptyDays(days: number): Map<string, DailyPoint> {
  const map = new Map<string, DailyPoint>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, orders: 0, revenue: 0 });
  }
  return map;
}

function pct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function buildInsights(
  adapter: MarketplaceAdapter,
  creds: AdapterCreds,
  marketplace: Marketplace,
  days: number,
): Promise<MarketplaceInsights> {
  const warnings: string[] = [];
  /** Limitga urilgach boshqa so'rov yubormaslik uchun bayroq */
  let limitHit = false;

  // ── Buyurtmalar (davr bilan cheklanmagan API'lar ham bor — o'zimiz filtrlaymiz)
  const orders: Awaited<ReturnType<MarketplaceAdapter['getOrders']>>['items'] = [];
  // Uzum kabi API'lar katta sahifani rad etadi ("Illegal argument") — chegarani hurmat qilamiz
  const pageSize = Math.min(ORDER_PAGE_SIZE, adapter.maxPageSize ?? ORDER_PAGE_SIZE);
  const pageLimit = Math.max(MAX_ORDER_PAGES, Math.ceil(300 / pageSize));
  try {
    // Oldingi davr bilan taqqoslash uchun ikki barobar oyna kerak
    for (let page = 0; page < pageLimit; page++) {
      const chunk = await adapter.getOrders(creds, { page, size: pageSize, days: days * 2 });
      orders.push(...chunk.items);
      if (chunk.items.length < pageSize) break;
    }
  } catch (err: any) {
    limitHit = isRateLimited(err);
    warnings.push(`Buyurtmalar olinmadi: ${err?.message || 'xato'}`);
  }

  const from = new Date();
  from.setDate(from.getDate() - days);
  const prevFrom = new Date();
  prevFrom.setDate(prevFrom.getDate() - days * 2);

  const daily = emptyDays(days);
  let revenue = 0;
  let cancelled = 0;
  let itemsSold = 0;
  let prevOrders = 0;
  let prevRevenue = 0;

  const byProduct = new Map<string, TopProduct>();
  let inPeriod = 0;

  for (const o of orders) {
    const when = o.date ? new Date(o.date) : null;
    const total = o.total ?? 0;

    // Oldingi davr — faqat taqqoslash uchun
    if (when && when >= prevFrom && when < from) {
      prevOrders += 1;
      if (!isCancelled(o.status)) prevRevenue += total;
      continue;
    }
    if (when && when < prevFrom) continue;

    inPeriod += 1;
    if (isCancelled(o.status)) {
      cancelled += 1;
      continue;
    }

    revenue += total;
    const key = dayKey(o.date);
    if (key && daily.has(key)) {
      const point = daily.get(key)!;
      point.orders += 1;
      point.revenue += total;
    }

    for (const item of o.items || []) {
      const id = item.sku || item.name || 'noma\'lum';
      const entry = byProduct.get(id) || { sku: item.sku, name: item.name, qty: 0, revenue: 0, share: 0 };
      entry.name = entry.name || item.name;
      entry.qty += item.qty || 1;
      entry.revenue += (item.price ?? 0) * (item.qty || 1);
      byProduct.set(id, entry);
    }
  }

  if (!orders.length && !warnings.length) {
    warnings.push(`So'nggi ${days} kun ichida buyurtma topilmadi`);
  }

  // Pozitsiya narxi yo'q bo'lsa (ba'zi API'lar bermaydi) — daromadni buyurtmadan taqsimlamaymiz,
  // shunchaki soni bo'yicha tartiblaymiz
  const products = [...byProduct.values()];
  itemsSold = products.reduce((sum, p) => sum + p.qty, 0);
  const productRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  for (const p of products) {
    p.share = productRevenue ? Math.round((p.revenue / productRevenue) * 1000) / 10 : 0;
  }

  const byQty = [...products].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const topProducts = byQty.slice(0, 10);
  const slowMovers = [...byQty].reverse().slice(0, 5);

  // ── Qoldiqlar
  const outOfStock: StockAlert[] = [];
  const lowStock: StockAlert[] = [];
  if (limitHit) {
    warnings.push("Qoldiqlar so'ralmadi — marketplace limitiga urildik");
  } else {
    try {
      const stocks = await adapter.getStocks(creds, {
        page: 0,
        size: Math.min(200, adapter.maxPageSize ?? 200),
      });
      for (const s of stocks.items) {
        if (s.amount <= 0) outOfStock.push({ sku: s.sku, name: s.name, amount: s.amount });
        else if (s.amount <= LOW_STOCK_THRESHOLD)
          lowStock.push({ sku: s.sku, name: s.name, amount: s.amount });
      }
    } catch (err: any) {
      limitHit = limitHit || isRateLimited(err);
      warnings.push(`Qoldiqlar olinmadi: ${err?.message || 'xato'}`);
    }
  }

  // ── Valyuta va umumiy mahsulotlar soni.
  // Xulosa faqat kerak bo'lganda so'raladi: buyurtmalardan hech narsa chiqmasa —
  // aks holda bu ortiqcha so'rov bo'lib, limitni tezroq tugatadi.
  let productsTotal: number | null = null;
  let currency = DEFAULT_CURRENCY[marketplace] || 'UZS';
  const needSummary = !limitHit && (inPeriod === 0 || revenue === 0);
  if (needSummary) {
    try {
      const summary = await adapter.getSummary(creds, days);
      currency = summary.currency;
      // Xulosadagi raqamlar ishonchliroq bo'lsa (masalan WB sotuvlar), ularni afzal ko'ramiz
      if (!inPeriod && summary.orders) {
        inPeriod = summary.orders;
        revenue = summary.revenue;
        warnings.push("Kunlik kesim mavjud emas — faqat umumiy xulosa ko'rsatilgan");
      }
    } catch (err: any) {
      limitHit = limitHit || isRateLimited(err);
      warnings.push(`Xulosa olinmadi: ${err?.message || 'xato'}`);
    }
  }
  if (!limitHit) {
    try {
      const prods = await adapter.getProducts(creds, { page: 0, size: 1 });
      productsTotal = prods.total ?? null;
    } catch {
      // majburiy emas
    }
  }

  const activeOrders = inPeriod - cancelled;
  return {
    marketplace,
    currency,
    periodDays: days,
    totals: {
      orders: inPeriod,
      revenue: Math.round(revenue),
      avgOrder: activeOrders > 0 ? Math.round(revenue / activeOrders) : 0,
      cancelled,
      itemsSold,
    },
    trend: {
      ordersPct: pct(inPeriod, prevOrders),
      revenuePct: pct(revenue, prevRevenue),
    },
    daily: [...daily.values()],
    topProducts,
    slowMovers,
    outOfStock: outOfStock.slice(0, 20),
    lowStock: lowStock.slice(0, 20),
    productsTotal,
    warnings,
  };
}
