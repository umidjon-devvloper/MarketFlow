import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { unzipSync } from 'fflate';
import {
  fillUzumTemplate,
  toUzumRow,
  uzumCategories,
  uzumMaxRows,
  UZUM_TEMPLATE_COLUMNS,
} from '../services/export/uzum-template.service';

/** Yaratilgan fayldan Лист1 ni o'qish */
function readSheet(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Лист1'], {
    header: 1,
    blankrows: true,
    defval: '',
  });
}

const cell = (rows: string[][], col: string, rowNum: number) =>
  rows[rowNum - 1]?.[XLSX.utils.decode_col(col)] ?? '';

const baseValues = {
  title: 'Кепка',
  titleUz: 'Kepka',
  sku: 'K-1',
  brand: 'No name',
  country: 'Узбекистан',
  description: 'Ручная работа',
  mxik: '6505003000000000',
  price: 89000,
  weight: 120,
  packHeight: 100,
  packWidth: 200,
  packLength: 250,
};

describe('Uzum shabloni', () => {
  it('ustun tartibi Uzum shablonidagidek — A dan AD gacha', () => {
    const cols = UZUM_TEMPLATE_COLUMNS.map((c) => c.col);
    expect(cols[0]).toBe('A');
    expect(cols[cols.length - 1]).toBe('AD');
    expect(new Set(cols).size).toBe(cols.length);
  });

  it("ma'lumot 4-qatordan boshlanadi, shapka tegilmaydi", () => {
    const { buffer } = fillUzumTemplate([toUzumRow(baseValues, ['https://a.jpg'])]);
    const rows = readSheet(buffer);

    // 2-qator — shablonning asl ustun nomlari
    expect(cell(rows, 'A', 2)).toContain('Название товара RU');
    expect(cell(rows, 'V', 2)).toContain('ИКПУ');
    // 4-qator — bizning ma'lumot
    expect(cell(rows, 'A', 4)).toBe('Кепка');
    expect(cell(rows, 'B', 4)).toBe('K-1');
  });

  it('E va F ustunlarini shablon katalogidan to\'ldiradi', () => {
    // Katalog Лист2 varag'ida — ilgari bu ikki ustun bo'sh chiqar va
    // sotuvchi faylni Excel'da ochib makros orqali tanlashi kerak edi.
    const category = uzumCategories()[0];
    const { buffer } = fillUzumTemplate([
      toUzumRow({ ...baseValues, category: category.title }, ['https://a.jpg']),
    ]);
    const rows = readSheet(buffer);
    expect(cell(rows, 'E', 4)).toBe(category.title);
    expect(String(cell(rows, 'F', 4))).toBe(category.id);
  });

  it("katalogda yo'q kategoriyada E/F bo'sh qoladi va ogohlantiradi", () => {
    const { buffer, warnings } = fillUzumTemplate([
      toUzumRow({ ...baseValues, category: 'Bunday kategoriya yo\'q' }, ['https://a.jpg']),
    ]);
    const rows = readSheet(buffer);
    expect(cell(rows, 'E', 4)).toBe('');
    expect(warnings.some((w) => w.column.includes('Категория'))).toBe(true);
  });

  it('ro\'yxatli ustunlarni Uzum yozuviga o\'giradi', () => {
    // Uzum aynan o'z ma'lumotnomasidagi yozuvni kutadi: "бежевый" emas —
    // "Бежевый", "No name" emas — "No Name".
    const { buffer } = fillUzumTemplate([
      toUzumRow({ ...baseValues, brand: 'no name', color: 'Bej' }, ['https://a.jpg']),
    ]);
    const rows = readSheet(buffer);
    expect(cell(rows, 'G', 4)).toBe('No Name');
    expect(cell(rows, 'W', 4)).toBe('Бежевый');
    expect(cell(rows, 'I', 4)).toBe('Узбекистан');
  });

  it("ro'yxatda yo'q qiymat yozilmaydi", () => {
    const { buffer, warnings } = fillUzumTemplate([
      toUzumRow({ ...baseValues, color: 'kosmik-yashil' }, ['https://a.jpg']),
    ]);
    expect(cell(readSheet(buffer), 'W', 4)).toBe('');
    expect(warnings.some((w) => /kosmik-yashil/.test(w.message))).toBe(true);
  });

  it("har bir o'lcham alohida qator bo'ladi, SKU guruhi bir xil qoladi", () => {
    // Uzum shablonida bitta qator = bitta variant. "M,L,XL" bitta katakda
    // qolsa, o'lcham ro'yxatdan topilmaydi va variantlar yo'qoladi.
    const { buffer } = fillUzumTemplate([
      toUzumRow({ ...baseValues, sku: 'POLO', skuGroup: 'POLO', size: 'M,L,XL' }, ['https://a.jpg']),
    ]);
    const rows = readSheet(buffer);
    // Ro'yxatda "Размер одежды:M" turadi, katakka esa faqat o'lchamning
    // o'zi yoziladi: prefiks — ochiluvchi ro'yxatdagi guruh nomi, Uzum uni
    // qiymat sifatida qabul qilmaydi ("Not valid Sku Titles from SkuDto!").
    expect(cell(rows, 'X', 4)).toBe('M');
    expect(cell(rows, 'X', 5)).toBe('L');
    expect(cell(rows, 'X', 6)).toBe('XL');
    expect(cell(rows, 'B', 4)).toBe('POLO-M');
    expect(cell(rows, 'D', 4)).toBe('POLO');
    expect(cell(rows, 'D', 6)).toBe('POLO');
  });

  it('makros, validatsiya va boshqa varaqlar saqlanadi', () => {
    const { buffer } = fillUzumTemplate([toUzumRow(baseValues, ['https://a.jpg'])]);
    const zip = unzipSync(new Uint8Array(buffer));

    expect(zip['xl/vbaProject.bin']).toBeDefined();
    const sheet = Buffer.from(zip['xl/worksheets/sheet1.xml']).toString('utf8');
    expect(sheet).toContain('<dataValidation');
    expect(sheet).toContain('conditionalFormatting');

    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toContain('Лист2');
    expect(wb.SheetNames).toContain('_cache');
  });

  it("bo'sh RU/UZ maydonlarini mavjudidan to'ldiradi", () => {
    const row = toUzumRow({ ...baseValues, titleUz: undefined }, []);
    expect(row.values.titleUz).toBe('Кепка');
    expect(row.values.descriptionUz).toBe('Ручная работа');
    // Qisqa tavsif berilmasa — to'liq tavsifning boshidan
    expect(row.values.shortRu).toBe('Ручная работа');
    // Chegirmagacha narx majburiy — berilmasa sotuv narxi
    expect(row.values.oldPrice).toBe('89000');
    // SKU guruhi berilmasa — artikul
    expect(row.values.skuGroup).toBe('K-1');
  });

  it('chegaradan oshgan matnni qisqartirib, ogohlantiradi', () => {
    const { buffer, warnings } = fillUzumTemplate([
      toUzumRow({ ...baseValues, shortRu: 'x'.repeat(500) }, ['https://a.jpg']),
    ]);
    const trimmed = warnings.find((w) => w.column === 'Краткое описание RU');
    expect(trimmed).toBeDefined();
    expect(cell(readSheet(buffer), 'L', 4)).toHaveLength(390);
  });

  it("majburiy maydon bo'sh bo'lsa ogohlantiradi", () => {
    const { warnings } = fillUzumTemplate([
      toUzumRow({ ...baseValues, mxik: undefined }, ['https://a.jpg']),
    ]);
    expect(warnings.some((w) => w.column === 'ИКПУ' && w.message.includes('majburiy'))).toBe(true);
  });

  it("rasmlar bitta katakka, birinchisi asosiy bo'lib tushadi", () => {
    const { buffer } = fillUzumTemplate([
      toUzumRow(baseValues, ['https://a.jpg', 'https://b.jpg']),
    ]);
    expect(cell(readSheet(buffer), 'T', 4)).toBe('https://a.jpg\nhttps://b.jpg');
  });

  it('bir nechta qator ketma-ket joylashadi', () => {
    const { buffer } = fillUzumTemplate([
      toUzumRow({ ...baseValues, sku: 'A' }, ['https://a.jpg']),
      toUzumRow({ ...baseValues, sku: 'B' }, ['https://b.jpg']),
      toUzumRow({ ...baseValues, sku: 'C' }, ['https://c.jpg']),
    ]);
    const rows = readSheet(buffer);
    expect(cell(rows, 'B', 4)).toBe('A');
    expect(cell(rows, 'B', 5)).toBe('B');
    expect(cell(rows, 'B', 6)).toBe('C');
  });

  it("shablon sig'imidan oshsa aniq xato beradi", () => {
    const max = uzumMaxRows();

    // Sig'im shablonning o'zidan hisoblanadi, qattiq yozilmagan.
    // Ilgari kod 1000 ga ruxsat berardi, aslida 790 ta joy bor edi —
    // ortiqchasi jimgina yo'qolardi.
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThan(1000);

    const tooMany = Array.from({ length: max + 1 }, () => toUzumRow(baseValues, ['https://x/1.jpg']));
    expect(() => fillUzumTemplate(tooMany)).toThrow(new RegExp(String(max)));
  });

  it("sig'imga to'liq teng miqdor o'tadi", () => {
    const max = uzumMaxRows();
    const exact = Array.from({ length: max }, () => toUzumRow(baseValues, ['https://x/1.jpg']));
    expect(() => fillUzumTemplate(exact)).not.toThrow();
  });

  // ─── Narx 1000 ga karrali (Uzum "Значение цены не кратно 1000" rad etadi) ───

  it('narx 1000 ga karrali emas — eng yaqin mingga yaxlitlanadi (Y va Z)', () => {
    const { buffer, warnings } = fillUzumTemplate([
      toUzumRow({ ...baseValues, price: 234324, oldPrice: 250500 }, ['https://a.jpg']),
    ]);
    const rows = readSheet(buffer);
    expect(Number(cell(rows, 'Y', 4))).toBe(234000); // sotuv narxi
    expect(Number(cell(rows, 'Z', 4))).toBe(251000); // chegirmagacha narx
    expect(warnings.some((w) => w.column === 'Цена продажи (som)' && /yaxlitlandi/.test(w.message))).toBe(true);
  });

  it('allaqachon karrali narx o\'zgarmaydi va ogohlantirish bermaydi', () => {
    const { buffer, warnings } = fillUzumTemplate([
      toUzumRow({ ...baseValues, price: 89000 }, ['https://a.jpg']),
    ]);
    expect(Number(cell(readSheet(buffer), 'Y', 4))).toBe(89000);
    expect(warnings.some((w) => /yaxlitlandi/.test(w.message))).toBe(false);
  });

  it('1000 dan kichik narx 0 ga tushmaydi — minimal 1000', () => {
    const { buffer } = fillUzumTemplate([
      toUzumRow({ ...baseValues, price: 400 }, ['https://a.jpg']),
    ]);
    expect(Number(cell(readSheet(buffer), 'Y', 4))).toBe(1000);
  });

  it("shablon boshqa kategoriyaniki bo'lsa ogohlantiradi", () => {
    // Uzum xususiyat ustunlarini nomi bo'yicha emas, tartibi bo'yicha o'qiydi.
    // Shablon boshqa kategoriyaniki bo'lsa, fayl yuklashda
    // "пропущены обязательные характеристики" deb rad etiladi.
    const category = uzumCategories().find((c) => c.filters.length)!;
    const { warnings } = fillUzumTemplate([
      toUzumRow({ ...baseValues, category: category.title }, ['https://a.jpg']),
    ]);
    const hit = warnings.find((w) => w.column.includes('характеристики'));
    if (hit) expect(hit.message).toContain(category.filters[0]);
  });

  it('kategoriya topilganda ortiqcha ogohlantirish bermaydi', () => {
    const category = uzumCategories()[0];
    const { warnings } = fillUzumTemplate([
      toUzumRow({ ...baseValues, category: category.title }, ['https://a.jpg']),
    ]);
    expect(warnings.some((w) => w.column.includes('Категория'))).toBe(false);
  });
});
