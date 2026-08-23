import { describe, it, expect } from 'vitest';
import {
  MARKETPLACE_IDS,
  MARKETPLACE_SPECS,
  allFields,
  getSpec,
  validateValues,
} from '../services/marketplace/specs';

describe('marketplace spetsifikatsiyalari', () => {
  it('4 ta marketplace ham mavjud', () => {
    expect(MARKETPLACE_IDS).toEqual(['UZUM', 'OZON', 'WB', 'YANDEX']);
  });

  it("maydon kalitlari har bir marketplace ichida takrorlanmaydi", () => {
    for (const id of MARKETPLACE_IDS) {
      const keys = allFields(MARKETPLACE_SPECS[id]).map((f) => f.key);
      expect(new Set(keys).size, `${id} da takroriy kalit bor`).toBe(keys.length);
    }
  });

  it('Excel ustun nomlari takrorlanmaydi — aks holda ustunlar ustma-ust tushadi', () => {
    for (const id of MARKETPLACE_IDS) {
      // Yashirin maydonlar Excel'ga umuman chiqmaydi (marketplace-excel.service.ts
      // ularni filtrlaydi), shuning uchun ustun nomi ham talab qilinmaydi
      const headers = allFields(MARKETPLACE_SPECS[id])
        .filter((f) => !f.hidden)
        .map((f) => f.excelHeader);
      expect(new Set(headers).size, `${id} da takroriy ustun nomi`).toBe(headers.length);
      expect(headers.every((h) => h.trim().length > 0), `${id} da ustun nomi bo'sh`).toBe(true);
    }
  });

  it("yashirin maydonlar Excel'ga chiqmaydi va publishRequired bilan belgilangan", () => {
    for (const id of MARKETPLACE_IDS) {
      for (const field of allFields(MARKETPLACE_SPECS[id]).filter((f) => f.hidden)) {
        // Yashirin maydonni foydalanuvchi qo'lda to'ldirmaydi — uni tanlagich
        // to'ldiradi. Shuning uchun `required` bo'lsa Excel oqimi bloklanardi.
        expect(field.required, `${id}.${field.key} required bo'lmasligi kerak`).toBe(false);
        expect(field.publishRequired, `${id}.${field.key}`).toBe(true);
        expect(field.excelHeader, `${id}.${field.key}`).toBe('');
      }
    }
  });

  it('Ozon, WB va Yandex kategoriyani katalogdan tanlaydi', () => {
    for (const id of ['OZON', 'WB', 'YANDEX'] as const) {
      const fields = allFields(MARKETPLACE_SPECS[id]);
      expect(fields.find((f) => f.key === 'category')?.type, id).toBe('category');
      expect(fields.some((f) => f.key === 'categoryId'), `${id} da categoryId yo'q`).toBe(true);
    }
    // Uzum'da kategoriyani shablon makrosi to'ldiradi — tanlagich kerak emas
    const uzum = allFields(MARKETPLACE_SPECS.UZUM);
    expect(uzum.some((f) => f.key === 'categoryId')).toBe(false);
  });

  it('publishRequired maydon oddiy saqlashni bloklamaydi, publishda so\'raladi', () => {
    const spec = MARKETPLACE_SPECS.WB;
    const values: Record<string, string> = {};
    for (const f of allFields(spec)) {
      if (!f.required) continue;
      values[f.key] = f.type === 'number' ? '1' : f.options?.[0] ?? 'x';
    }

    expect(validateValues(spec, values)).toEqual([]);

    const publishIssues = validateValues(spec, values, { forPublish: true });
    expect(publishIssues.map((i) => i.key)).toContain('categoryId');
  });

  it('narx, nom va zaxira Product ustunlariga bog\'langan', () => {
    for (const id of MARKETPLACE_IDS) {
      const mapped = allFields(MARKETPLACE_SPECS[id])
        .map((f) => f.mapsTo)
        .filter(Boolean);
      expect(mapped, `${id}`).toContain('title');
      expect(mapped, `${id}`).toContain('basePrice');
      expect(mapped, `${id}`).toContain('stock');
    }
  });

  it("select maydonlarida variantlar ro'yxati bor", () => {
    for (const id of MARKETPLACE_IDS) {
      for (const field of allFields(MARKETPLACE_SPECS[id])) {
        if (field.type === 'select') {
          expect(field.options?.length, `${id}.${field.key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('WB nomi 60 belgi bilan chegaralangan', () => {
    const title = allFields(MARKETPLACE_SPECS.WB).find((f) => f.key === 'title');
    expect(title?.maxLength).toBe(60);
  });

  it("noma'lum marketplace uchun null qaytadi", () => {
    expect(getSpec('AMAZON')).toBeNull();
  });
});

describe('validateValues', () => {
  const uzum = MARKETPLACE_SPECS.UZUM;

  it("bo'sh forma barcha majburiy maydonlarni xato deb ko'rsatadi", () => {
    const issues = validateValues(uzum, {});
    const required = allFields(uzum).filter((f) => f.required);
    expect(issues).toHaveLength(required.length);
  });

  it('belgi chegarasidan oshsa xato beradi', () => {
    const issues = validateValues(uzum, { title: 'a'.repeat(101) });
    expect(issues.some((i) => i.key === 'title' && i.message.includes('101'))).toBe(true);
  });

  it("ro'yxatda yo'q variant rad etiladi", () => {
    const issues = validateValues(uzum, { vat: '25%' });
    expect(issues.some((i) => i.key === 'vat')).toBe(true);
  });

  it("son o'rniga matn kelsa xato beradi", () => {
    const issues = validateValues(uzum, { price: 'arzon' });
    expect(issues.some((i) => i.key === 'price' && i.message.includes('Son'))).toBe(true);
  });

  it('minimal qiymatdan kichik son rad etiladi', () => {
    const issues = validateValues(uzum, { weight: '0' });
    expect(issues.some((i) => i.key === 'weight')).toBe(true);
  });

  it("to'g'ri to'ldirilgan formada xato yo'q", () => {
    const values: Record<string, string> = {};
    for (const f of allFields(uzum)) {
      if (!f.required) continue;
      if (f.type === 'number') values[f.key] = String(f.min ?? 1);
      else if (f.options?.length) values[f.key] = f.options[0];
      else values[f.key] = 'qiymat';
    }
    expect(validateValues(uzum, values)).toHaveLength(0);
  });
});
