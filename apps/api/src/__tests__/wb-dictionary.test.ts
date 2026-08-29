import { describe, it, expect } from 'vitest';
import {
  candidatesFor,
  extractNames,
  pickFromDirectory,
} from '../services/marketplace/wb-dictionary.service';

/**
 * Formadagi tanlov ro'yxatlari o'zbekcha, WB esa o'z lug'atidagi ruscha
 * qiymatni kutadi. "Erkaklar" deb yuborilsa kartochka yaratiladi, lekin WB
 * kabinetida katak qizil bo'lib qoladi va tovar sotuvga chiqmaydi — xato
 * bizga qaytmaydi, shuning uchun buni faqat kabinetda ko'rish mumkin edi.
 *
 * Haqiqiy WB javoblari (2026-08-29 da tekshirilgan):
 *   kinds     -> ["Мужской","Женский","Детский","Девочки", ...]
 *   countries -> [{ id, name: "Турция", fullName: "..." }, ...]
 */
describe('WB lug\'ati', () => {
  it('jinsni ruscha nomga o\'giradi', () => {
    const kinds = ['Мужской', 'Женский', 'Детский', 'Девочки', 'Мальчики'];
    expect(pickFromDirectory(candidatesFor('Erkaklar'), kinds)).toBe('Мужской');
    expect(pickFromDirectory(candidatesFor('Ayollar'), kinds)).toBe('Женский');
    expect(pickFromDirectory(candidatesFor("O'g'il bolalar"), kinds)).toBe('Мальчики');
    expect(pickFromDirectory(candidatesFor('Qiz bolalar'), kinds)).toBe('Девочки');
  });

  it('davlatni obyektli ma\'lumotnomadan topadi', () => {
    const raw = [
      { id: 1, name: 'Турция', fullName: 'Турецкая Республика' },
      { id: 2, name: 'Узбекистан', fullName: 'Республика Узбекистан' },
    ];
    const names = extractNames(raw);
    expect(pickFromDirectory(candidatesFor('Turkiya'), names)).toBe('Турция');
    expect(pickFromDirectory(candidatesFor("O'zbekiston"), names)).toBe('Узбекистан');
  });

  it('mavsumni topadi va registrga qarab qolmaydi', () => {
    const seasons = ['лето', 'зима', 'демисезон', 'всесезон'];
    expect(pickFromDirectory(candidatesFor('Yoz'), seasons)).toBe('лето');
    expect(pickFromDirectory(candidatesFor('Qish'), seasons)).toBe('зима');
    expect(pickFromDirectory(candidatesFor('Demi-mavsum'), seasons)).toBe('демисезон');
  });

  it('ma\'lumotnomada bo\'lmagan qiymat uchun null qaytaradi', () => {
    // "Унисекс" WB kinds ro'yxatida yo'q — taxminiy qiymat yuboriladi va
    // sotuvchi ogohlantiriladi, jimgina noto'g'ri qiymat ketmaydi
    expect(pickFromDirectory(candidatesFor('Unisex'), ['Мужской', 'Женский'])).toBeNull();
  });

  it('ro\'yxatda yo\'q qiymatni o\'zini qaytaradi', () => {
    expect(candidatesFor('Boshqa')).toEqual(['Boshqa']);
  });

  it('matnli va obyektli ma\'lumotnomani bir xil o\'qiydi', () => {
    expect(extractNames(['Мужской', 'Женский'])).toEqual(['Мужской', 'Женский']);
    expect(extractNames([{ name: 'Турция' }, { fullName: 'Италия' }])).toEqual(['Турция', 'Италия']);
    expect(extractNames(null)).toEqual([]);
  });
});
