import { describe, it, expect } from 'vitest';
import { exactMatch, parseChoice } from '../services/ai/category-match.service';

/**
 * AI kategoriya NOMINI aytadi, joylash uchun esa katalog ID kerak edi —
 * sotuvchi uni qo'lda qidirishi shart edi va "bir bosishda to'ldirish"
 * shu yerda uzilardi.
 */
describe('kategoriya moslashtirish', () => {
  const options = [
    { id: '192', name: 'Футболки', path: 'Одежда/Футболки' },
    { id: '219', name: 'Футболки-поло', path: 'Одежда/Футболки-поло' },
    { id: '70', name: 'Сарафаны', path: 'Одежда/Сарафаны' },
  ];

  it('aynan nom bo\'yicha topadi', () => {
    expect(exactMatch('Футболки', options)?.id).toBe('192');
    expect(exactMatch('футболки-поло', options)?.id).toBe('219');
  });

  it('registr va ё ni farq qilmaydi', () => {
    expect(exactMatch('САРАФАНЫ', options)?.id).toBe('70');
  });

  it('mos kelmasa null', () => {
    expect(exactMatch('Куртки', options)).toBeNull();
  });

  it('javobdagi raqamni ajratadi', () => {
    expect(parseChoice('1', 3)).toBe(1);
    expect(parseChoice(' 2 ', 3)).toBe(2);
    expect(parseChoice('Javob: 0', 3)).toBe(0);
  });

  it('ro\'yxatdan tashqari raqamni rad etadi', () => {
    // Model "-1" (mos yo'q) yoki ro'yxatdan katta raqam qaytarsa, tasodifiy
    // kategoriya tanlanib qolmasin
    expect(parseChoice('-1', 3)).toBeNull();
    expect(parseChoice('7', 3)).toBeNull();
    expect(parseChoice('javob yo\'q', 3)).toBeNull();
  });
});
