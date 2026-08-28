import { describe, it, expect } from 'vitest';
import { normalizeAdvice, PriceAdviceInput } from '../services/ai/price-advisor.service';

/**
 * AI javobiga ishonib bo'lmaydi: min/max ni almashtirib yuborishi, tannarxdan
 * past narx berishi yoki sotuvchi narx kiritmagan bo'lsa ham "narxingiz qimmat"
 * deb xulosa chiqarishi mumkin. Bu testlar shu uchta holatni ushlab turadi.
 */

const base: PriceAdviceInput = {
  marketplaceName: 'Wildberries',
  currency: 'RUB',
  title: "Bolalar ko'ylagi",
};

describe('AI narx javobini tozalash', () => {
  it('min/max almashib kelsa tartibga soladi', () => {
    const out = normalizeAdvice({ min: 3000, recommended: 1500, max: 900 }, base);
    expect(out.min).toBe(900);
    expect(out.recommended).toBe(1500);
    expect(out.max).toBe(3000);
  });

  it('tannarxdan past tavsiyani tannarx darajasiga ko\'taradi', () => {
    const out = normalizeAdvice(
      { min: 800, recommended: 900, max: 1200 },
      { ...base, costPrice: 1000 },
    );
    expect(out.recommended).toBe(1000);
    expect(out.min).toBeGreaterThanOrEqual(1000);
    expect(out.warnings.some((w) => w.includes('tannarx'))).toBe(true);
  });

  it("sotuvchi narx kiritmagan bo'lsa xulosa qaytarmaydi", () => {
    const out = normalizeAdvice(
      { min: 900, recommended: 1200, max: 1500, verdict: { level: 'high', message: 'qimmat' } },
      base,
    );
    expect(out.verdict).toBeNull();
  });

  it('narx kiritilgan bo\'lsa xulosani saqlaydi', () => {
    const out = normalizeAdvice(
      { min: 900, recommended: 1200, max: 1500, verdict: { level: 'high', message: 'qimmat' } },
      { ...base, currentPrice: 2400 },
    );
    expect(out.verdict).toEqual({ level: 'high', message: 'qimmat' });
  });

  it('raqobatchi narxi yo\'q bo\'lsa ogohlantiradi', () => {
    const out = normalizeAdvice({ min: 900, recommended: 1200, max: 1500 }, base);
    expect(out.warnings.some((w) => w.includes('Raqobatchi'))).toBe(true);
    expect(out.confidence).toBe('low');
  });

  it('boshqa valyutadagi raqobatchi hisobga olinmaydi', () => {
    const out = normalizeAdvice(
      { min: 900, recommended: 1200, max: 1500 },
      {
        ...base,
        competitors: [{ label: 'Uzum do\'koni', price: 250000, currency: 'UZS' }],
      },
    );
    // UZS raqobatchi RUB tavsiyaga asos bo'lolmaydi — "raqobatchi yo'q" deb hisoblanadi
    expect(out.warnings.some((w) => w.includes('Raqobatchi'))).toBe(true);
    expect(out.currency).toBe('RUB');
  });

  it("raqobatchi yo'q bo'lsa AI aytgan yuqori ishonchni pasaytiradi", () => {
    const out = normalizeAdvice(
      { min: 900, recommended: 1200, max: 1500, confidence: 'high' },
      base,
    );
    expect(out.confidence).toBe('low');
  });

  it("raqobatchi bor bo'lsa AI bergan ishonch saqlanadi", () => {
    const out = normalizeAdvice(
      { min: 900, recommended: 1200, max: 1500, confidence: 'high' },
      { ...base, competitors: [{ label: 'WB raqobatchi', price: 1300, currency: 'RUB' }] },
    );
    expect(out.confidence).toBe('high');
    expect(out.warnings.some((w) => w.includes('Raqobatchi'))).toBe(false);
  });

  it('narx umuman kelmasa xato beradi', () => {
    expect(() => normalizeAdvice({ summary: 'bilmadim' }, base)).toThrow();
  });
});
