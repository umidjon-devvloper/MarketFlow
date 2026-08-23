import { describe, it, expect } from 'vitest';
import { MARKETPLACE_SPECS } from '../services/marketplace/specs';
import { prefillForMarketplace } from '../services/marketplace/prefill';

/**
 * Bu yerdagi eng xavfli xato — o'lchov birligini o'girmasdan ko'chirish.
 * Uzum qadoqni mm da so'raydi, WB esa sm da: 300 mm ni 300 sm deb yuborsak,
 * yetkazib berish narxi 10 barobar noto'g'ri hisoblanadi.
 */
describe('marketplace o\'rtasida maydonlarni ko\'chirish', () => {
  const uzumValues = {
    category: 'Kiyim-kechak',
    title: "Erkaklar ko'ylagi, katak, oq, paxta, kunlik kiyim uchun juda qulay va yumshoq",
    brand: 'CottonPro',
    description: "Yumshoq paxta ko'ylak",
    color: 'Oq',
    material: '100% paxta',
    country: "O'zbekiston",
    price: '189000',
    stock: '50',
    weight: '300',
    packLength: '300',
    packWidth: '200',
    packHeight: '50',
  };

  const product = { title: uzumValues.title, basePrice: '189000', stock: 50 };

  it('mm dan sm ga o\'giradi (Uzum → WB)', () => {
    const r = prefillForMarketplace(uzumValues, MARKETPLACE_SPECS.UZUM, product, MARKETPLACE_SPECS.WB);
    expect(r.values.packLength).toBe('30');
    expect(r.values.packWidth).toBe('20');
    expect(r.values.packHeight).toBe('5');
  });

  it("grammdan kilogrammga o'giradi (Uzum → Yandex)", () => {
    const r = prefillForMarketplace(uzumValues, MARKETPLACE_SPECS.UZUM, product, MARKETPLACE_SPECS.YANDEX);
    expect(r.values.weight).toBe('0.3');
  });

  it("bir xil birlikda o'girmaydi (Uzum → Ozon, ikkalasi ham mm)", () => {
    const r = prefillForMarketplace(uzumValues, MARKETPLACE_SPECS.UZUM, product, MARKETPLACE_SPECS.OZON);
    expect(r.values.packLength).toBe('300');
    expect(r.values.weight).toBe('300');
  });

  it("o'girilgan qiymatlar 'tekshiring' ro'yxatiga tushadi", () => {
    const r = prefillForMarketplace(uzumValues, MARKETPLACE_SPECS.UZUM, product, MARKETPLACE_SPECS.WB);
    expect(r.needsReview.some((n) => n.key === 'packLength' && n.reason.includes('sm'))).toBe(true);
  });

  it("uzun nom qisqartirilmaydi, lekin ogohlantiriladi (WB 60 belgi)", () => {
    const r = prefillForMarketplace(uzumValues, MARKETPLACE_SPECS.UZUM, product, MARKETPLACE_SPECS.WB);
    expect(r.values.title).toBe(uzumValues.title); // jimgina kesilmadi
    expect(r.needsReview.some((n) => n.key === 'title' && n.reason.includes('60'))).toBe(true);
  });

  it("faqat maqsad marketplace'da bor maydonlar ko'chadi", () => {
    const withMxik = { ...uzumValues, mxik: '01001001001000000' };
    const r = prefillForMarketplace(withMxik, MARKETPLACE_SPECS.UZUM, product, MARKETPLACE_SPECS.OZON);
    // MXIK faqat O'zbekiston uchun — Ozon'da bunday maydon yo'q
    expect(r.values.mxik).toBeUndefined();
  });

  it("to'ldirilmagan majburiy maydonlar ro'yxatlanadi", () => {
    const r = prefillForMarketplace(uzumValues, MARKETPLACE_SPECS.UZUM, product, MARKETPLACE_SPECS.YANDEX);
    // Yandex barkodni majburiy qiladi, Uzum esa yo'q
    expect(r.missing.some((m) => m.key === 'barcode')).toBe(true);
  });

  it("ro'yxatda yo'q variant ko'chirilmaydi", () => {
    const r = prefillForMarketplace(
      { ...uzumValues, country: 'Mars' },
      MARKETPLACE_SPECS.UZUM,
      product,
      MARKETPLACE_SPECS.OZON,
    );
    expect(r.values.country).toBeUndefined();
    expect(r.needsReview.some((n) => n.key === 'country')).toBe(true);
  });

  it("manba spec noma'lum bo'lsa ham ishlaydi", () => {
    const r = prefillForMarketplace(uzumValues, null, product, MARKETPLACE_SPECS.OZON);
    expect(r.values.title).toBeTruthy();
    expect(r.copied.length).toBeGreaterThan(0);
  });
});
