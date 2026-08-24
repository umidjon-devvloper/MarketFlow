/**
 * Trend ma'lumotini grafik uchun tayyorlash
 *
 * Backend /sync/trend har (kun, marketplace) juftligi uchun alohida qator
 * qaytaradi. Recharts esa kun bo'yicha guruhlangan qatorlarni kutadi:
 *   [{ date, UZUM: 5, OZON: 3, ... }]
 *
 * VALYUTA TUZOG'I: daromad UZS va RUB da keladi. Ularni bitta o'qqa qo'yish
 * mumkin emas — 234 000 so'm yonida 2 400 rubl ko'rinmay ketadi. Shuning
 * uchun daromad grafigida faqat BITTA valyuta ko'rsatiladi (bozor tanlanadi),
 * buyurtma va qoldiq esa birliksiz, birlashtirsa bo'ladi.
 */

export type MarketplaceId = 'UZUM' | 'OZON' | 'WB' | 'YANDEX';

export interface TrendRow {
  date: string;
  marketplace: MarketplaceId;
  orders: number;
  revenue: number;
  currency: string;
  totalStock: number;
  outOfStock: number;
}

export interface PivotPoint {
  date: string;
  [marketplace: string]: number | string;
}

/**
 * Bir metrikani kun bo'yicha jadvalga aylantirish.
 * Har kunda har bir bozor uchun ustun bo'ladi; ma'lumot yo'q kunda 0.
 */
export function pivotByDate(
  rows: TrendRow[],
  metric: 'orders' | 'revenue' | 'totalStock' | 'outOfStock',
  marketplaces: MarketplaceId[],
): PivotPoint[] {
  const byDate = new Map<string, PivotPoint>();

  for (const row of rows) {
    let point = byDate.get(row.date);
    if (!point) {
      point = { date: row.date };
      for (const mp of marketplaces) point[mp] = 0;
      byDate.set(row.date, point);
    }
    if (marketplaces.includes(row.marketplace)) {
      point[row.marketplace] = row[metric];
    }
  }

  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export interface MarketplaceTotals {
  marketplace: MarketplaceId;
  orders: number;
  revenue: number;
  currency: string;
  /** Oxirgi kesimdagi qoldiq (yig'indi emas — joriy holat) */
  latestStock: number;
  outOfStock: number;
}

/**
 * Marketplace bo'yicha yakuniy raqamlar.
 *
 * Buyurtma va daromad — oyna bo'yicha YIG'INDI. Qoldiq esa oxirgi kesimdan
 * olinadi: qoldiqni kunlar bo'yicha qo'shish ma'nosiz (u zaxira, oqim emas).
 */
export function marketplaceTotals(
  rows: TrendRow[],
  marketplaces: MarketplaceId[],
): MarketplaceTotals[] {
  return marketplaces.map((mp) => {
    const mpRows = rows.filter((r) => r.marketplace === mp).sort((a, b) => a.date.localeCompare(b.date));
    const latest = mpRows[mpRows.length - 1];
    return {
      marketplace: mp,
      orders: mpRows.reduce((sum, r) => sum + r.orders, 0),
      revenue: mpRows.reduce((sum, r) => sum + r.revenue, 0),
      currency: latest?.currency ?? (mp === 'UZUM' ? 'UZS' : 'RUB'),
      latestStock: latest?.totalStock ?? 0,
      outOfStock: latest?.outOfStock ?? 0,
    };
  });
}
