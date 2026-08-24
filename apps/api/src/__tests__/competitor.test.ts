import { describe, it, expect } from 'vitest';
import {
  detectMarketplace,
  parsePrice,
  priceVerdict,
  appendHistory,
  __internal,
} from '../services/marketplace/competitor.service';

/**
 * Eng muhim tekshiruv — VALYUTA XAVFSIZLIGI. UZS narxni RUB bilan
 * "arzon/qimmat" deb solishtirish sotuvchini yanglishtiradi (100 000 so'm
 * 1 000 rubldan "qimmat" ko'rinadi). Shuning uchun valyuta mos kelmasa
 * hech qachon hukm chiqarmaymiz.
 */
describe('raqobatchi — host aniqlash', () => {
  it("uzum.uz → UZUM/UZS", () => {
    expect(detectMarketplace('https://uzum.uz/uz/product/test-123')).toEqual({
      marketplace: 'UZUM',
      currency: 'UZS',
    });
  });
  it('wildberries.ru → WB/RUB', () => {
    expect(detectMarketplace('https://www.wildberries.ru/catalog/123/detail.aspx')).toEqual({
      marketplace: 'WB',
      currency: 'RUB',
    });
  });
  it('ozon.ru → OZON/RUB', () => {
    expect(detectMarketplace('https://www.ozon.ru/product/test-456')).toEqual({
      marketplace: 'OZON',
      currency: 'RUB',
    });
  });
  it('market.yandex.ru → YANDEX/RUB', () => {
    expect(detectMarketplace('https://market.yandex.ru/product--test/789')).toEqual({
      marketplace: 'YANDEX',
      currency: 'RUB',
    });
  });
  it("noma'lum host → null", () => {
    expect(detectMarketplace('https://aliexpress.com/item/1')).toBeNull();
  });
  it("buzuq havola → null", () => {
    expect(detectMarketplace('shunchaki matn')).toBeNull();
  });
});

describe('raqobatchi — narx ajratish', () => {
  it('og:price:amount meta dan', () => {
    const html = '<meta property="og:price:amount" content="149990">';
    expect(__internal.extractPrice(html)).toBe(149990);
  });
  it('JSON-LD price dan', () => {
    const html = '{"@type":"Product","offers":{"price":"2499.00","priceCurrency":"RUB"}}';
    expect(__internal.extractPrice(html)).toBe(2499);
  });
  it("narx yo'q bo'lsa null", () => {
    expect(__internal.extractPrice('<html><body>narx yo\'q</body></html>')).toBeNull();
  });
  it('parsePrice nom va valyutani ham oladi', () => {
    const html =
      '<meta property="og:title" content="Test tovar"><meta property="og:price:amount" content="500000"><meta property="og:price:currency" content="UZS">';
    expect(parsePrice(html, 'RUB')).toEqual({ price: 500000, currency: 'UZS', title: 'Test tovar' });
  });
  it("valyuta topilmasa host fallback ishlaydi", () => {
    const html = '<meta property="og:price:amount" content="1000">';
    expect(parsePrice(html, 'RUB')?.currency).toBe('RUB');
  });
});

describe('raqobatchi — valyuta normalizatsiyasi', () => {
  it("сум/UZS → UZS", () => {
    expect(__internal.normalizeCurrency('СУМ', 'RUB')).toBe('UZS');
    expect(__internal.normalizeCurrency('uzs', 'RUB')).toBe('UZS');
  });
  it('руб/₽/RUB → RUB', () => {
    expect(__internal.normalizeCurrency('руб.', 'UZS')).toBe('RUB');
    expect(__internal.normalizeCurrency('₽', 'UZS')).toBe('RUB');
  });
  it("tanilmasa fallback", () => {
    expect(__internal.normalizeCurrency('$', 'UZS')).toBe('UZS');
  });
});

describe('raqobatchi — narx hukmi (valyuta xavfsizligi)', () => {
  it('bir valyutada: raqobatchi arzon', () => {
    const v = priceVerdict(100000, 'UZS', 90000, 'UZS');
    expect(v.verdict).toBe('cheaper');
    expect(v.diffPct).toBe(-10);
  });
  it('bir valyutada: raqobatchi qimmat', () => {
    const v = priceVerdict(100000, 'UZS', 120000, 'UZS');
    expect(v.verdict).toBe('pricier');
    expect(v.diffPct).toBe(20);
  });
  it('bir valyutada: teng', () => {
    expect(priceVerdict(1000, 'RUB', 1000, 'RUB').verdict).toBe('same');
  });
  it('VALYUTA HAR XIL → hukm chiqmaydi', () => {
    const v = priceVerdict(100000, 'UZS', 1000, 'RUB');
    expect(v.verdict).toBe('incomparable');
    expect(v.diffPct).toBeNull();
  });
  it("narx yetishmasa → incomparable", () => {
    expect(priceVerdict(null, 'UZS', 1000, 'UZS').verdict).toBe('incomparable');
    expect(priceVerdict(1000, 'UZS', null, 'UZS').verdict).toBe('incomparable');
  });
});

describe('raqobatchi — narx tarixi', () => {
  it("yangi nuqta qo'shadi", () => {
    const h = appendHistory([], { date: '2026-01-01', price: 100 });
    expect(h).toEqual([{ date: '2026-01-01', price: 100 }]);
  });
  it("shu kun yozuvini yangilaydi", () => {
    let h = appendHistory([], { date: '2026-01-01', price: 100 });
    h = appendHistory(h, { date: '2026-01-01', price: 90 });
    expect(h).toEqual([{ date: '2026-01-01', price: 90 }]);
  });
  it('oxirgi 60 nuqta saqlanadi', () => {
    let h: any = [];
    for (let i = 0; i < 70; i++) {
      const d = `2026-01-${String((i % 28) + 1).padStart(2, '0')}`;
      h = appendHistory(h, { date: `${d}-${i}` as any, price: i });
    }
    expect(h.length).toBe(60);
    expect(h[h.length - 1].price).toBe(69);
  });
  it("buzuq tarix (null) bilan ham ishlaydi", () => {
    expect(appendHistory(null, { date: '2026-01-01', price: 5 })).toEqual([
      { date: '2026-01-01', price: 5 },
    ]);
  });
});
