import { describe, it, expect } from 'vitest';
import {
  priceForMarketplace,
  buildSyncMessage,
  suspiciousPrice,
  __internal,
} from '../services/marketplace/price-stock.service';

const { chunk, collectOzonErrors } = __internal;

/**
 * VALYUTA — bu modulning eng xavfli joyi.
 *
 * Uzum UZS da, Ozon/WB/Yandex RUB da ishlaydi. 234 000 so'mni Ozon'ga
 * yuborsak, u 234 000 RUBL bo'lib qoladi: tovar ~100 barobar qimmatlashadi,
 * so'rov muvaffaqiyatli o'tadi va hech qanday xato ko'rinmaydi. Buni faqat
 * sotuvlar to'xtaganda sezish mumkin.
 *
 * Shuning uchun qoida qat'iy: boshqa valyutadagi narxga "tushish" YO'Q.
 */
describe('narx tanlash — valyuta xavfsizligi', () => {
  const uzumProduct = {
    attributes: { marketplace: 'UZUM', values: { price: '234000', oldPrice: '280000' } },
    basePrice: '234000',
    currency: 'UZS',
  };

  it("Uzum kartochkasining so'm narxini Ozon'ga YUBORMAYDI", () => {
    const out = priceForMarketplace(uzumProduct, 'OZON', 'RUB');
    expect(out.price).toBeUndefined();
    expect(out.reason).toContain('UZS');
    expect(out.reason).toContain('RUB');
  });

  it("o'sha kartochkani Uzum'ning o'ziga yuboradi", () => {
    const out = priceForMarketplace(uzumProduct, 'UZUM', 'UZS');
    expect(out.price).toBe(234000);
    expect(out.oldPrice).toBe(280000);
  });

  it("marketplace formasida kiritilgan narx birinchi o'rinda turadi", () => {
    const product = {
      attributes: {
        marketplace: 'UZUM',
        values: { price: '234000' },
        byMarketplace: { OZON: { price: '2400', oldPrice: '2900' } },
      },
      basePrice: '234000',
      currency: 'UZS',
    };
    const out = priceForMarketplace(product, 'OZON', 'RUB');
    expect(out.price).toBe(2400);
    expect(out.oldPrice).toBe(2900);
  });

  it("valyuta mos kelsa Product narxidan olinadi", () => {
    const product = { attributes: {}, basePrice: '1500', currency: 'RUB' };
    expect(priceForMarketplace(product, 'OZON', 'RUB').price).toBe(1500);
  });

  it("nol va manfiy narx yuborilmaydi", () => {
    for (const bad of ['0', '-100', '', 'salom']) {
      const product = { attributes: { byMarketplace: { OZON: { price: bad } } }, basePrice: '0', currency: 'RUB' };
      expect(priceForMarketplace(product, 'OZON', 'RUB').price, `narx: ${bad}`).toBeUndefined();
    }
  });

  it("vergul bilan yozilgan narx ham o'qiladi", () => {
    const product = { attributes: { byMarketplace: { WB: { price: '1500,50' } } }, basePrice: '0', currency: 'RUB' };
    expect(priceForMarketplace(product, 'WB', 'RUB').price).toBe(1500.5);
  });
});

describe('natija xabari', () => {
  const base = { pricesUpdated: 0, stocksUpdated: 0, failed: [], warnings: [] };

  it("hech narsa yuborilmasa buni aniq aytadi", () => {
    // Ilgari bu yerda " Ozon ga yuborildi" degan bo'sh xabar chiqardi
    expect(buildSyncMessage(base, 'Ozon')).not.toContain('yuborildi');
  });

  it('xatolar bo\'lsa ularni sanaydi', () => {
    const msg = buildSyncMessage(
      { ...base, failed: [{ productId: '1', title: 'x', reason: 'y' }] },
      'Ozon',
    );
    expect(msg).toContain('1 ta tovarda muammo');
  });

  it('ikkalasi ham ketgan bo\'lsa ikkalasini aytadi', () => {
    const msg = buildSyncMessage({ ...base, pricesUpdated: 3, stocksUpdated: 5 }, 'Ozon');
    expect(msg).toContain('3 ta narx');
    expect(msg).toContain('5 ta qoldiq');
  });
});

describe('partiyalarga bo\'lish', () => {
  it('marketplace chegarasidan oshmaydi', () => {
    const batches = chunk(Array.from({ length: 250 }, (_, i) => i), 100);
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
  });

  it("bo'sh ro'yxatda partiya yaratmaydi", () => {
    expect(chunk([], 100)).toEqual([]);
  });
});

describe('Ozon javobidagi xatolarni ajratish', () => {
  const batch = [
    { productId: 'p1', title: 'Ko\'ylak', sku: 'SHIRT-1' },
    { productId: 'p2', title: 'Shim', sku: 'PANTS-1' },
  ];

  it("faqat xato bergan tovarni ro'yxatga qo'shadi", () => {
    const result = { pricesUpdated: 0, stocksUpdated: 0, failed: [] as any[], warnings: [] };
    collectOzonErrors(
      {
        result: [
          { offer_id: 'SHIRT-1', updated: true, errors: [] },
          { offer_id: 'PANTS-1', updated: false, errors: [{ message: 'Товар не найден' }] },
        ],
      },
      batch,
      result,
    );
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].productId).toBe('p2');
    expect(result.failed[0].reason).toBe('Товар не найден');
  });

  it("javob shakli kutilmagan bo'lsa yiqilmaydi", () => {
    const result = { pricesUpdated: 0, stocksUpdated: 0, failed: [] as any[], warnings: [] };
    for (const raw of [null, {}, { result: null }, { result: [{}] }]) {
      expect(() => collectOzonErrors(raw, batch, result)).not.toThrow();
    }
    expect(result.failed).toHaveLength(0);
  });
});

/**
 * Valyuta to'sig'i "narxni boshqa valyutadan olib kelish"ni to'xtatadi, lekin
 * sotuvchi ikkala kartochkaga ham qo'lda bir xil raqam yozsa ishlamaydi —
 * qiymat "o'sha marketplace uchun kiritilgan" hisoblanadi.
 *
 * Amalda bu ko'p uchraydi: Uzum kartochkasidan nusxa olib, narxni
 * o'zgartirishni unutish. Bloklamaymiz, lekin aytamiz.
 */
describe('shubhali narx — bir xil raqam, boshqa valyuta', () => {
  it("Uzum va Ozon'da bir xil raqam bo'lsa ogohlantiradi", () => {
    const attrs = {
      byMarketplace: {
        UZUM: { price: '12213' },
        OZON: { price: '12213' },
      },
    };
    const warn = suspiciousPrice(attrs, 'OZON', 12213);
    expect(warn).toBeTruthy();
    expect(warn).toContain('UZS');
    expect(warn).toContain('RUB');
  });

  it("bir xil valyutadagi bozorlarda ogohlantirmaydi", () => {
    // Ozon va WB ikkalasi ham RUB — bir xil narx mutlaqo normal
    const attrs = { byMarketplace: { OZON: { price: '1500' }, WB: { price: '1500' } } };
    expect(suspiciousPrice(attrs, 'WB', 1500)).toBeNull();
  });

  it("narxlar farq qilsa ogohlantirmaydi", () => {
    const attrs = { byMarketplace: { UZUM: { price: '234000' }, OZON: { price: '2400' } } };
    expect(suspiciousPrice(attrs, 'OZON', 2400)).toBeNull();
  });

  it("byMarketplace bo'sh yoki yo'q bo'lsa yiqilmaydi", () => {
    for (const attrs of [null, undefined, {}, { byMarketplace: {} }]) {
      expect(suspiciousPrice(attrs, 'OZON', 100)).toBeNull();
    }
  });
});
