import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { fillWbTemplate, toWbRow, __internal } from '../services/export/wb-template.service';

/**
 * WB "Загрузить из файла" faqat o'zining shablonini qabul qiladi (struktura
 * o'zgarmasligi shart). Shuning uchun biz tayyor shablonni to'ldiramiz.
 * Bu testlar: ma'lumot TO'G'RI ustunga (nom bo'yicha) tushishini va boshqa
 * struktura (Manual varag'i, ustunlar soni) buzilmasligini tekshiradi.
 */

/** Yaratilgan fayldan "Items" varag'ini o'qish */
function readItems(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Items'], {
    header: 1,
    blankrows: false,
    defval: '',
  });
  return { wb, header: rows[2], row5: rows[4], row6: rows[5] };
}

const cellByHeader = (header: string[], row: any[], name: string) => {
  const i = header.findIndex((h) => String(h).replace(/\s+/g, ' ').trim().toLowerCase() === name.toLowerCase());
  return i >= 0 ? row[i] : undefined;
};

const base = {
  sku: 'TOY-001',
  title: 'Самолет игрушечный',
  category: 'Самолеты и вертолеты',
  brand: 'pilot',
  description: 'Игрушечный самолёт для детей от 3 лет',
  barcode: '4600000000017',
  price: 15000,
  weight: 320, // gramm
  packLength: 250, // mm
  packWidth: 120,
  packHeight: 80,
  color: 'Синий',
  material: 'Пластик',
  country: 'Xitoy',
  vat: '20%',
  mxik: '9503001000',
};

describe('WB shabloni to\'ldirish', () => {
  it('shablon o\'qiladi va ustunlar nom bo\'yicha topiladi', () => {
    // 3636 ustunli shablon topilishi kerak
    expect(__internal.WB_COLUMNS.length).toBeGreaterThan(10);
  });

  it('ma\'lumot to\'g\'ri ustunga tushadi (nom bo\'yicha)', () => {
    const { buffer } = fillWbTemplate([toWbRow(base, ['https://a.jpg', 'https://b.jpg'])]);
    const { header, row5 } = readItems(buffer);

    expect(cellByHeader(header, row5, "Seller`s article")).toBe('TOY-001');
    expect(cellByHeader(header, row5, 'Name')).toBe('Самолет игрушечный');
    expect(cellByHeader(header, row5, 'Subject')).toBe('Самолеты и вертолеты');
    expect(cellByHeader(header, row5, 'Barcodes')).toBe('4600000000017');
    expect(Number(cellByHeader(header, row5, 'Price'))).toBe(15000);
    // Photo — ';' bilan ajratilgan
    expect(cellByHeader(header, row5, 'Photo')).toBe('https://a.jpg;https://b.jpg');
  });

  it('brend va QQS ustunlari ataylab bo\'sh qoladi', () => {
    // WB brendni faqat sotuvchi huquqiga ega, ro'yxatdan o'tgan holda qabul
    // qiladi va u majburiy emas; QQS esa kartochka API'sida umuman yo'q —
    // WB stavkani kabinet sozlamasidan oladi. Ikkalasini to'ldirish
    // sotuvchini kabinetda qizil xatoga olib borardi.
    const { buffer } = fillWbTemplate([toWbRow(base, ['https://a.jpg'])]);
    const { header, row5 } = readItems(buffer);
    expect(cellByHeader(header, row5, 'Brand')).toBe('');
    expect(cellByHeader(header, row5, 'VAT rate')).toBe('');
  });

  it('og\'irlik grammdan kg ga, o\'lcham mm dan butun sm ga o\'giriladi', () => {
    const { buffer } = fillWbTemplate([toWbRow(base, ['https://a.jpg'])]);
    const { header, row5 } = readItems(buffer);
    // 320 g → 0.32 kg
    expect(Number(cellByHeader(header, row5, 'Packaging weight (kg)'))).toBeCloseTo(0.32, 3);
    // 250 mm → 25 sm, 120 → 12, 80 → 8
    expect(Number(cellByHeader(header, row5, 'Package length'))).toBe(25);
    expect(Number(cellByHeader(header, row5, 'Package width'))).toBe(12);
    expect(Number(cellByHeader(header, row5, 'Package height'))).toBe(8);
  });

  it('bir necha mahsulot — har biri alohida qatorда', () => {
    const { buffer } = fillWbTemplate([
      toWbRow({ ...base, sku: 'A' }, ['https://a.jpg']),
      toWbRow({ ...base, sku: 'B' }, ['https://b.jpg']),
    ]);
    const { header, row5, row6 } = readItems(buffer);
    expect(cellByHeader(header, row5, "Seller`s article")).toBe('A');
    expect(cellByHeader(header, row6, "Seller`s article")).toBe('B');
  });

  it('struktura buzilmaydi — Manual varag\'i va 3636 ustun saqlanadi', () => {
    const { buffer } = fillWbTemplate([toWbRow(base, ['https://a.jpg'])]);
    const { wb, header } = readItems(buffer);
    expect(wb.SheetNames).toContain('Manual');
    expect(wb.SheetNames).toContain('Items');
    expect(header.length).toBeGreaterThan(3000);
  });
});
