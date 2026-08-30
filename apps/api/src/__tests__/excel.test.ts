import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { MARKETPLACE_SPECS, allFields } from '../services/marketplace/specs';
import { buildMarketplaceWorkbook, exportFileName } from '../services/export/marketplace-excel.service';

/**
 * Excel eng nozik joy: ustun nomi noto'g'ri bo'lsa marketplace butun
 * yuklamani rad etadi va sotuvchi buni faqat kabinetda ko'radi.
 */
describe('marketplace Excel eksporti', () => {
  const uzum = MARKETPLACE_SPECS.UZUM;

  const row = {
    values: {
      category: 'Kiyim-kechak',
      title: "Erkaklar ko'ylagi",
      brand: 'CottonPro',
      description: 'Paxta ko\'ylak',
      mxik: '01001001001000000',
      sku: 'SHIRT-001',
      price: 189000,
      stock: 50,
      vat: '12%',
      color: 'Oq',
      material: '100% paxta',
      country: "O'zbekiston",
      weight: 300,
      packLength: 300,
      packWidth: 200,
      packHeight: 50,
    },
    imageUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
  };

  it('3 ta varaq yaratadi', () => {
    const wb = XLSX.read(buildMarketplaceWorkbook(uzum, [row]), { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Uzum', 'Rasm talablari', "Yo'riqnoma"]);
  });

  it("ustun nomlari spec dagi excelHeader bilan bir xil", () => {
    const wb = XLSX.read(buildMarketplaceWorkbook(uzum, [row]), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Uzum']);
    // Yashirin maydonlar (categoryId) ustun bo'lmaydi — ularni tanlagich to'ldiradi
    const expected = allFields(uzum).filter((f) => !f.hidden).map((f) => f.excelHeader);
    for (const header of expected) {
      expect(Object.keys(rows[0]), `"${header}" ustuni yo'q`).toContain(header);
    }
  });

  it('sonlar matn emas, son bo\'lib yoziladi', () => {
    const wb = XLSX.read(buildMarketplaceWorkbook(uzum, [row]), { type: 'buffer' });
    const first = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Uzum'])[0];
    expect(typeof first['Narx']).toBe('number');
    expect(typeof first['Zaxira']).toBe('number');
  });

  it('rasm ustunlari qo\'shiladi', () => {
    const wb = XLSX.read(buildMarketplaceWorkbook(uzum, [row]), { type: 'buffer' });
    const first = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Uzum'])[0];
    expect(first['Rasm 1']).toBe('https://example.com/1.jpg');
    expect(first['Rasm 2']).toBe('https://example.com/2.jpg');
  });

  it("bo'sh maydon bo'sh satr bo'lib qoladi (undefined emas)", () => {
    const wb = XLSX.read(buildMarketplaceWorkbook(uzum, [{ values: {}, imageUrls: [] }]), {
      type: 'buffer',
    });
    const first = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Uzum'], {
      defval: '',
    })[0];
    expect(first['Mahsulot nomi']).toBe('');
  });

  it("har bir marketplace o'z varaq nomi bilan chiqadi", () => {
    for (const spec of Object.values(MARKETPLACE_SPECS)) {
      const wb = XLSX.read(buildMarketplaceWorkbook(spec, [row]), { type: 'buffer' });
      expect(wb.SheetNames[0]).toBe(spec.sheetName);
    }
  });

  it('fayl nomida marketplace va soni bor', () => {
    expect(exportFileName(uzum, 3)).toMatch(/^uzum-3-mahsulot-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
