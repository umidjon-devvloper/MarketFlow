/**
 * Sotuv analitikasi — o'sish va eng ko'p sotilgan tovarlar
 *
 * Manba: MarketplaceOrder (diskret buyurtmalar), MarketplaceSnapshot EMAS.
 *
 * Nega snapshot emas: snapshot.orders — marketplace summary'sidan olingan
 * ROLLING 30 kunlik yig'indi (har kuni takrorlanadi). Uni kunlar bo'yicha
 * qo'shsa bir buyurtma o'nlab marta sanaladi. Diskret buyurtmalarning esa
 * o'z sanasi (orderedAt) bor — ikki oynani taqqoslash aniq bo'ladi.
 *
 * IKKI QOIDA:
 * 1. Bekor qilingan buyurtmalar hisobga olinmaydi — ular sotuv emas.
 * 2. Daromad valyuta bo'yicha alohida yig'iladi: UZS va RUB ni qo'shib
 *    bo'lmaydi. "Jami daromad" degan bitta raqam yo'q, {UZS, RUB} bor.
 */

export interface OrderItemLike {
  sku?: string;
  name?: string;
  qty?: number;
  price?: number;
}

export interface OrderLike {
  marketplace: string;
  status: string | null;
  total: number;
  currency: string;
  items: OrderItemLike[];
}

/** Buyurtma bekor qilinganmi — har bozor o'z atamasini ishlatadi */
export function isCancelled(status: string | null | undefined): boolean {
  // Qaytarish/vozvrat ham kiradi: pul qaytgan bo'lsa bu sotuv emas.
  // Ruscha va inglizcha atamalar birga ("возврат" va "return").
  return /cancel|отмен|bekor|reject|возврат|return|refund/i.test(status || '');
}

// ─── O'SISH (ikki oynani taqqoslash) ─────────────────────

export interface WindowTotals {
  /** Bekor qilinmagan buyurtmalar soni */
  orders: number;
  /** Valyuta → daromad. Aralashtirilmaydi */
  revenueByCurrency: Record<string, number>;
}

export function windowTotals(orders: OrderLike[]): WindowTotals {
  const out: WindowTotals = { orders: 0, revenueByCurrency: {} };
  for (const o of orders) {
    if (isCancelled(o.status)) continue;
    out.orders++;
    out.revenueByCurrency[o.currency] = (out.revenueByCurrency[o.currency] ?? 0) + o.total;
  }
  return out;
}

export interface Delta {
  current: number;
  previous: number;
  /** Foizli o'zgarish. Oldingi 0 bo'lsa null (bo'linma aniqlanmagan) */
  changePct: number | null;
}

function delta(current: number, previous: number): Delta {
  const changePct = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
  return { current, previous, changePct };
}

export interface GrowthResult {
  orders: Delta;
  /** Har valyuta uchun alohida delta */
  revenue: Record<string, Delta>;
}

/**
 * Joriy va oldingi oyna bo'yicha o'sish.
 * Ikkala ro'yxat ham chaqiruvchi tomonda sana bo'yicha filtrlangan bo'ladi.
 */
export function computeGrowth(current: OrderLike[], previous: OrderLike[]): GrowthResult {
  const cur = windowTotals(current);
  const prev = windowTotals(previous);

  const currencies = new Set([
    ...Object.keys(cur.revenueByCurrency),
    ...Object.keys(prev.revenueByCurrency),
  ]);

  const revenue: Record<string, Delta> = {};
  for (const c of currencies) {
    revenue[c] = delta(cur.revenueByCurrency[c] ?? 0, prev.revenueByCurrency[c] ?? 0);
  }

  return { orders: delta(cur.orders, prev.orders), revenue };
}

// ─── ENG KO'P SOTILGAN TOVARLAR ──────────────────────────

export interface TopProduct {
  /** Guruh kaliti — sku bo'lsa sku, bo'lmasa nom */
  key: string;
  sku?: string;
  name: string;
  marketplace: string;
  currency: string;
  /** Sotilgan dona */
  qty: number;
  /** Shu tovardan tushgan daromad (o'z valyutasida) */
  revenue: number;
  /** Nechta buyurtmada uchradi */
  orderCount: number;
}

/**
 * Buyurtma pozitsiyalarini tovar bo'yicha jamlash.
 *
 * Guruh kaliti — marketplace + sku (yoki nom). Nega marketplace ham kalitda:
 * bir xil artikul turli bozorda turli valyutada sotiladi, ularni bitta
 * qatorga qo'shsak daromad valyutasi aralashadi.
 */
export function aggregateTopProducts(orders: OrderLike[], limit = 10): TopProduct[] {
  const map = new Map<string, TopProduct>();

  for (const order of orders) {
    if (isCancelled(order.status)) continue;

    for (const item of order.items || []) {
      const sku = (item.sku || '').trim();
      const name = (item.name || '').trim();
      if (!sku && !name) continue;

      const id = sku || name;
      const key = `${order.marketplace}|${id}`;
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;

      let row = map.get(key);
      if (!row) {
        row = {
          key,
          sku: sku || undefined,
          name: name || sku,
          marketplace: order.marketplace,
          currency: order.currency,
          qty: 0,
          revenue: 0,
          orderCount: 0,
        };
        map.set(key, row);
      }
      row.qty += qty;
      row.revenue += price * qty;
      row.orderCount++;
      if (!row.name && name) row.name = name;
    }
  }

  return [...map.values()]
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, limit);
}
