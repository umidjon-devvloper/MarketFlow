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
  packLength: 25, // sm — forma o'lchamni santimetrda so'raydi
  packWidth: 12,
  packHeight: 8,
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

  it("og'irlik grammdan kg ga o'giriladi, o'lcham esa santimetrda qoladi", () => {
    // Avval bu yerda mm → sm o'girish bor edi (10 ga bo'lardi), holbuki forma
    // o'lchamni ALLAQACHON santimetrda so'raydi. Natijada 23 sm qadoq Excel'da
    // 2 sm bo'lib chiqardi — WB da bu jarima sababi.
    const { buffer } = fillWbTemplate([toWbRow(base, ['https://a.jpg'])]);
    const { header, row5 } = readItems(buffer);
    expect(Number(cellByHeader(header, row5, 'Packaging weight (kg)'))).toBeCloseTo(0.32, 3);
    expect(Number(cellByHeader(header, row5, 'Package length'))).toBe(25);
    expect(Number(cellByHeader(header, row5, 'Package width'))).toBe(12);
    expect(Number(cellByHeader(header, row5, 'Package height'))).toBe(8);
  });

  it("jins va davlat WB lug'atiga o'giriladi", () => {
    // Forma ro'yxati o'zbekcha, WB shabloni ruscha qiymat kutadi
    const { buffer } = fillWbTemplate([
      toWbRow({ ...base, gender: 'Erkaklar', country: 'Xitoy' }, ['https://a.jpg']),
    ]);
    const { header, row5 } = readItems(buffer);
    expect(cellByHeader(header, row5, 'Gender')).toBe('Мужской');
    expect(cellByHeader(header, row5, 'Country of origin')).toBe('Китай');
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

/**
 * WB da har o'lcham — ALOHIDA nomenklatura, o'z barkodi bilan. Hammasi bitta
 * katakka yozilsa (avval shunday edi) WB bitta variant yasaydi: xaridor
 * o'lchamni tanlay olmaydi, qoldiq ham o'lchamlar bo'yicha yuritilmaydi.
 * Kabinetda bu "Seller size: M, L, XL" bo'lib ko'ringan edi.
 */
describe("o'lchamlarni ajratish", () => {
  it('vergul, nuqtali vergul va chiziq bo\'yicha ajratadi', async () => {
    const { splitSizes } = await import('../services/marketplace/publish.service');
    expect(splitSizes('M, L, XL')).toEqual(['M', 'L', 'XL']);
    expect(splitSizes('s;m;l')).toEqual(['S', 'M', 'L']);
    expect(splitSizes('42/44/46')).toEqual(['42', '44', '46']);
  });

  it('takrorlarni va bo\'shliqlarni tozalaydi', async () => {
    const { splitSizes } = await import('../services/marketplace/publish.service');
    expect(splitSizes(' m , M ,  l ')).toEqual(['M', 'L']);
    expect(splitSizes('')).toEqual([]);
    expect(splitSizes('   ')).toEqual([]);
  });

  it("30 tadan ko'p bo'lsa kesadi (WB chegarasi)", async () => {
    const { splitSizes } = await import('../services/marketplace/publish.service');
    const many = Array.from({ length: 40 }, (_, i) => `R${i}`).join(',');
    expect(splitSizes(many)).toHaveLength(30);
  });
});
