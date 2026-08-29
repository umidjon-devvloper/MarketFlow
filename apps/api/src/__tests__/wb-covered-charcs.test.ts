import { describe, it, expect } from 'vitest';
import { charcKey, isCoveredCharc } from '../services/marketplace/categories.service';

/**
 * WB paket og'irligini endi faqat dimensions.weightBrutto orqali qabul qiladi.
 * Xarakteristika sifatida yuborilsa butun kartochka 400 bilan rad etiladi:
 * "Weight with packaging should now be specified in
 *  variants[i].dimensions[j].weightBrutto in kilograms".
 *
 * Filtr bor edi, lekin WB nomni o'lchov birligi bilan beradi —
 * "Вес товара с упаковкой (г)" — va qavs tufayli ro'yxatga tushmay,
 * maydon formada takror chiqib qolgan edi.
 */
describe("WB: qat'iy maydon bilan qoplangan xarakteristikalar", () => {
  it("o'lchov birligi qavsda bo'lsa ham og'irlikni taniydi", () => {
    expect(isCoveredCharc('Вес товара с упаковкой (г)')).toBe(true);
    expect(isCoveredCharc('Вес товара с упаковкой')).toBe(true);
    expect(isCoveredCharc('Вес товара без упаковки (г)')).toBe(true);
  });

  it('paket gabaritlarini ham taniydi', () => {
    expect(isCoveredCharc('Высота упаковки (см)')).toBe(true);
    expect(isCoveredCharc('Ширина упаковки (см)')).toBe(true);
    expect(isCoveredCharc('Длина упаковки (см)')).toBe(true);
  });

  it("boshqa qat'iy maydonlar ham ro'yxatda", () => {
    expect(isCoveredCharc('Бренд')).toBe(true);
    expect(isCoveredCharc('Состав')).toBe(true);
    expect(isCoveredCharc('Страна производства')).toBe(true);
  });

  it('oddiy xarakteristikaga tegmaydi', () => {
    expect(isCoveredCharc('Вид застежки')).toBe(false);
    expect(isCoveredCharc('Вырез горловины')).toBe(false);
    expect(isCoveredCharc('Вес нетто (г)')).toBe(false);
  });

  it('kalit qavs va registrni bir xillashtiradi', () => {
    expect(charcKey('Вес товара с упаковкой (г)')).toBe('вес товара с упаковкой');
    expect(charcKey('ВЕС ТОВАРА С УПАКОВКОЙ')).toBe('вес товара с упаковкой');
  });
});
