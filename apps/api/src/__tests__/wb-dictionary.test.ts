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
    // WB kinds ro'yxatida atigi 5 qiymat bor va "Унисекс" ular ichida yo'q.
    // Yuborilgan holat kabinetda "Invalid value in the Gender field" bergan —
    // shuning uchun bunday qiymat endi umuman yuborilmaydi.
    const kinds = ['Мужской', 'Женский', 'Детский', 'Девочки', 'Мальчики'];
    expect(pickFromDirectory(candidatesFor('Unisex'), kinds)).toBeNull();
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

/**
 * Ma'lumotnomaga suyanish yetarli emas: WB so'rov limiti tez uriladi va
 * ro'yxat o'qilmay qolsa zaxira yo'l taxminiy ruscha nomni yuborardi.
 * "Унисекс" aynan shunday o'tib ketib, kabinetda xato bergan.
 */
describe("WB da mavjud bo'lmagan qiymatlar", () => {
  it('unisex hech qanday holatda yuborilmaydi', async () => {
    const { toWbValue } = await import('../services/marketplace/wb-dictionary.service');
    // Kalit ataylab yaroqsiz — qiymat tarmoqqa chiqmasdan to'silishi kerak
    const r = await toWbValue('yaroqsiz-kalit', 'kinds', 'Unisex');
    expect(r.value).toBeNull();
    expect(r.note).toContain('yuborilmadi');
  });

  it('WB formasida unisex varianti umuman yo\'q', async () => {
    const { getSpec } = await import('../services/marketplace/specs');
    const gender = getSpec('WB')!
      .groups.flatMap((g) => g.fields)
      .find((f) => f.key === 'gender');
    expect(gender?.options).not.toContain('Unisex');
    expect(gender?.options).toContain('Erkaklar');
  });
});
