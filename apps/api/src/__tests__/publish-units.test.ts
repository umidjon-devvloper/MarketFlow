import { describe, it, expect } from 'vitest';
import { __internal } from '../services/marketplace/publish.service';
import { MARKETPLACE_SPECS, findField } from '../services/marketplace/specs';

const { toApiUnits, normalizeName, vatToOzon } = __internal;

/**
 * Nega bu testlar bor:
 *
 * Har bir marketplace kartochka maydonlarini o'z shabloni birligida so'raydi
 * (WB — gramm), API esa boshqasini kutadi (WB — kilogramm). Farqni o'girmasak
 * 500 g li tovar 500 kg bo'lib ketadi. Bunday xato hech qayerda ko'rinmaydi:
 * so'rov muvaffaqiyatli o'tadi, tovar joylanadi, faqat yetkazib berish tarifi
 * xato hisoblanadi. Shuning uchun har bir yo'nalish alohida tekshiriladi.
 */
describe("publish — o'lchov birliklari", () => {
  it('WB: og\'irlik grammdan kilogrammga o\'giriladi', () => {
    const spec = MARKETPLACE_SPECS.WB;
    expect(findField(spec, 'weight')?.unit, 'WB spec og\'irligi grammda bo\'lishi kerak').toBe('g');
    expect(toApiUnits(spec, { weight: '500' }, 'weight', 'kg')).toBe(0.5);
    expect(toApiUnits(spec, { weight: '1200' }, 'weight', 'kg')).toBe(1.2);
  });

  it("WB: qadoq o'lchamlari allaqachon santimetrda — o'girilmaydi", () => {
    const spec = MARKETPLACE_SPECS.WB;
    expect(findField(spec, 'packLength')?.unit).toBe('sm');
    expect(toApiUnits(spec, { packLength: '30' }, 'packLength', 'sm')).toBe(30);
  });

  it("Ozon: gramm va millimetr — o'girish shart emas", () => {
    const spec = MARKETPLACE_SPECS.OZON;
    expect(toApiUnits(spec, { weight: '500' }, 'weight', 'g')).toBe(500);
    expect(toApiUnits(spec, { packLength: '300' }, 'packLength', 'mm')).toBe(300);
  });

  it("Yandex: og'irlik allaqachon kilogrammda", () => {
    const spec = MARKETPLACE_SPECS.YANDEX;
    expect(findField(spec, 'weight')?.unit).toBe('kg');
    expect(toApiUnits(spec, { weight: '0.5' }, 'weight', 'kg')).toBe(0.5);
  });

  it("Uzum: millimetrdan santimetrga (Excel'dan boshqa bozorga ko'chirishda)", () => {
    const spec = MARKETPLACE_SPECS.UZUM;
    expect(toApiUnits(spec, { packLength: '300' }, 'packLength', 'sm')).toBe(30);
  });

  it("suzuvchi nuqta xatosi yig'ilmaydi", () => {
    const spec = MARKETPLACE_SPECS.UZUM;
    // 3 * 0.1 = 0.30000000000000004 — yaxlitlanmasa marketplace'ga shu ketardi
    expect(toApiUnits(spec, { packLength: '3' }, 'packLength', 'sm')).toBe(0.3);
  });

  it("noma'lum o'girish qoidasida jim qolmaydi, xato tashlaydi", () => {
    const spec = MARKETPLACE_SPECS.WB;
    expect(() => toApiUnits(spec, { weight: '1' }, 'weight', 'funt')).toThrow(/UNIT_FACTORS/);
  });

  it("bo'sh qiymat 0 beradi, NaN emas", () => {
    const spec = MARKETPLACE_SPECS.WB;
    expect(toApiUnits(spec, {}, 'weight', 'kg')).toBe(0);
    expect(toApiUnits(spec, { weight: 'salom' }, 'weight', 'kg')).toBe(0);
  });

  it("vergul bilan yozilgan son ham o'qiladi", () => {
    const spec = MARKETPLACE_SPECS.YANDEX;
    expect(toApiUnits(spec, { weight: '1,5' }, 'weight', 'kg')).toBe(1.5);
  });
});

describe('publish — nom moslashtirish', () => {
  it("registr, 'ё' va tinish belgilari e'tiborga olinmaydi", () => {
    expect(normalizeName('Цвет товара')).toBe(normalizeName('цвет  ТОВАРА'));
    expect(normalizeName('Ёмкость')).toBe(normalizeName('Емкость'));
    expect(normalizeName('ТН ВЭД')).toBe(normalizeName('тн-вэд'));
  });
});

describe('publish — QQS formati', () => {
  it("Ozon QQS ni ulush sifatida kutadi", () => {
    expect(vatToOzon({ vat: '20%' })).toBe('0.2');
    expect(vatToOzon({ vat: '10%' })).toBe('0.1');
    expect(vatToOzon({ vat: '0%' })).toBe('0');
    // Uzum'dan ko'chirilgan 12% Ozon ro'yxatida yo'q — 0 ga tushadi
    expect(vatToOzon({ vat: '12%' })).toBe('0');
  });
});
