import { describe, it, expect } from 'vitest';
import {
  isCancelled,
  windowTotals,
  computeGrowth,
  aggregateTopProducts,
  OrderLike,
} from '../services/analytics/sales.service';

const order = (o: Partial<OrderLike>): OrderLike => ({
  marketplace: 'WB',
  status: 'NEW',
  total: 0,
  currency: 'RUB',
  items: [],
  ...o,
});

describe('sotuv analitikasi — bekor qilingan buyurtma', () => {
  it("turli bozor atamalarini taniydi", () => {
    for (const s of ['CANCELED', 'CANCELLED', 'Отменён', 'bekor qilindi', 'RETURNED', 'возврат']) {
      expect(isCancelled(s), s).toBe(true);
    }
  });
  it("faol buyurtmalarni bekor deb hisoblamaydi", () => {
    for (const s of ['NEW', 'PROCESSING', 'Собран', 'delivered', null]) {
      expect(isCancelled(s), String(s)).toBe(false);
    }
  });
});

describe('oyna yig‘indisi', () => {
  it('bekor qilinganni sanamaydi va valyutani aralashtirmaydi', () => {
    const t = windowTotals([
      order({ total: 100, currency: 'RUB' }),
      order({ total: 200, currency: 'RUB', status: 'CANCELED' }), // hisobga olinmaydi
      order({ marketplace: 'UZUM', total: 50000, currency: 'UZS' }),
    ]);
    expect(t.orders).toBe(2);
    expect(t.revenueByCurrency).toEqual({ RUB: 100, UZS: 50000 });
  });
});

describe('o‘sish', () => {
  it('foizni to‘g‘ri hisoblaydi', () => {
    const g = computeGrowth(
      [order({ total: 150, currency: 'RUB' }), order({ total: 50, currency: 'RUB' })],
      [order({ total: 100, currency: 'RUB' })],
    );
    expect(g.orders).toEqual({ current: 2, previous: 1, changePct: 100 });
    expect(g.revenue.RUB).toEqual({ current: 200, previous: 100, changePct: 100 });
  });

  it("oldingi davr 0 bo‘lsa foiz null (bo‘linma aniqlanmagan)", () => {
    const g = computeGrowth([order({ total: 100, currency: 'RUB' })], []);
    expect(g.orders.changePct).toBeNull();
    expect(g.revenue.RUB.changePct).toBeNull();
  });

  it("kamayishni manfiy foiz bilan ko‘rsatadi", () => {
    const g = computeGrowth([order({})], [order({}), order({}), order({}), order({})]);
    expect(g.orders.changePct).toBe(-75);
  });
});

describe('eng ko‘p sotilgan tovarlar', () => {
  const orders: OrderLike[] = [
    order({ items: [{ sku: 'SHIRT-1', name: 'Ko‘ylak', qty: 2, price: 500 }] }),
    order({ items: [{ sku: 'SHIRT-1', name: 'Ko‘ylak', qty: 3, price: 500 }] }),
    order({ items: [{ sku: 'PANTS-1', name: 'Shim', qty: 1, price: 800 }] }),
    order({ status: 'CANCELED', items: [{ sku: 'SHIRT-1', qty: 10, price: 500 }] }), // sanalmaydi
  ];

  it('artikul bo‘yicha jamlaydi va soni bo‘yicha saralaydi', () => {
    const top = aggregateTopProducts(orders);
    expect(top).toHaveLength(2);
    expect(top[0].sku).toBe('SHIRT-1');
    expect(top[0].qty).toBe(5); // 2+3, bekor qilingan 10 hisobga olinmaydi
    expect(top[0].revenue).toBe(2500);
    expect(top[0].orderCount).toBe(2);
  });

  it("bir xil artikul turli bozorda alohida qatorda (valyuta aralashmasin)", () => {
    const top = aggregateTopProducts([
      order({ marketplace: 'WB', currency: 'RUB', items: [{ sku: 'A', qty: 1, price: 100 }] }),
      order({ marketplace: 'UZUM', currency: 'UZS', items: [{ sku: 'A', qty: 1, price: 50000 }] }),
    ]);
    expect(top).toHaveLength(2);
    expect(new Set(top.map((t) => t.currency))).toEqual(new Set(['RUB', 'UZS']));
  });

  it('limitdan oshmaydi', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      order({ items: [{ sku: `S${i}`, qty: 1, price: 10 }] }),
    );
    expect(aggregateTopProducts(many, 5)).toHaveLength(5);
  });

  it("sku bo‘lmasa nom bo‘yicha guruhlaydi", () => {
    const top = aggregateTopProducts([
      order({ items: [{ name: 'Nomsiz tovar', qty: 1, price: 10 }] }),
      order({ items: [{ name: 'Nomsiz tovar', qty: 2, price: 10 }] }),
    ]);
    expect(top).toHaveLength(1);
    expect(top[0].qty).toBe(3);
  });
});
