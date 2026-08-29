import { describe, it, expect } from 'vitest';
import { __internal, CharcSpec } from '../services/ai/vision.service';

const { sanitizeCharcs } = __internal;

/**
 * Kategoriya xususiyatlarini marketplace qat'iy tekshiradi: son so'ralgan joyga
 * matn yozilsa yoki ruxsat etilganidan ko'p qiymat yuborilsa — kartochka rad
 * etiladi. AI esa ikkalasini ham qilib qo'yadi, shuning uchun tozalanadi.
 */
const charc = (over: Partial<CharcSpec> = {}): CharcSpec => ({
  id: 1,
  name: 'Rang',
  type: 'string',
  required: false,
  maxCount: 1,
  ...over,
});

describe('AI to\'ldirgan kategoriya xususiyatlari', () => {
  it('oddiy matn qiymatini oladi', () => {
    const { charcValues } = sanitizeCharcs([charc()], { '1': ' bej ' });
    expect(charcValues['1']).toBe('bej');
  });

  it('son so\'ralgan joyga matn kelsa o\'tkazib yuboradi va eslatadi', () => {
    const { charcValues, notes } = sanitizeCharcs(
      [charc({ id: 7, name: 'Og\'irlik', type: 'number' })],
      { '7': 'og\'ir' },
    );
    expect(charcValues['7']).toBeUndefined();
    expect(notes[0]).toContain("Og'irlik");
  });

  it('sondan ortiqcha belgilarni tozalaydi', () => {
    const { charcValues } = sanitizeCharcs(
      [charc({ id: 7, type: 'number' })],
      { '7': '250 g' },
    );
    expect(charcValues['7']).toBe('250');
  });

  it('maxCount dan ortiq qiymatni kesadi', () => {
    const { charcValues, notes } = sanitizeCharcs(
      [charc({ id: 3, name: 'Vid zastejki', maxCount: 2 })],
      { '3': 'tugma, zamok, ip, ilgak' },
    );
    expect(charcValues['3']).toBe('tugma, zamok');
    expect(notes.some((n) => n.includes('2 tagacha'))).toBe(true);
  });

  it('massiv kelsa vergul bilan qo\'shadi', () => {
    const { charcValues } = sanitizeCharcs([charc({ id: 5, maxCount: 3 })], {
      '5': ['qora', 'oq'],
    });
    expect(charcValues['5']).toBe('qora, oq');
  });

  it('bo\'sh, null va "-" qiymatlarni tashlab ketadi', () => {
    const { charcValues } = sanitizeCharcs(
      [charc({ id: 1 }), charc({ id: 2 }), charc({ id: 3 })],
      { '1': '', '2': 'null', '3': '-' },
    );
    expect(Object.keys(charcValues)).toHaveLength(0);
  });

  it('AI javobida yo\'q xususiyatga tegmaydi', () => {
    const { charcValues } = sanitizeCharcs([charc({ id: 9 })], {});
    expect(charcValues).toEqual({});
  });
});
