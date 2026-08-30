/**
 * Wildberries'ning rasmiy Excel shablonini to'ldirish.
 *
 * Uzum'дагидек: WB "Загрузить из файла" faqat O'ZINING shablonini qabul qiladi
 * ("faylni o'zgartirmang, ustun qo'shmang/o'chirmang, tartibini buzmang" —
 * Manual varag'ida yozilgan). Shablonда 3636 ustun bor, ular kategoriyaga xos.
 * Shuning uchun biz shablonни QAYTA YARATMAYMIZ — tayyor faylning ichiga faqat
 * ma'lumot qatorlarini (5-qatordан) qo'yamiz, qolgani (sharedStrings, styles,
 * Manual, barcha ustunlar) bayt-bayt o'z holicha qoladi.
 *
 * Ustunlar NOM bo'yicha topiladi (3-qatordagi sarlavha), qattiq ustun harfi
 * bilan emas — shunda WB tartibни o'zgartirsa ham to'g'ri joyga tushadi.
 */

import fs from 'fs';
import { staticWbValue } from '../marketplace/wb-dictionary.service';
import { splitSizes } from '../marketplace/specs';
import path from 'path';
import { unzipSync, zipSync } from 'fflate';

const SHEET_PATH = 'xl/worksheets/sheet1.xml';
const SHARED_PATH = 'xl/sharedStrings.xml';

/** Sarlavha 3-qatorda, ma'lumot 5-qatordан (1 guruh, 2 bo'sh, 3 nom, 4 izoh) */
const HEADER_ROW = 3;
const DATA_START_ROW = 5;

/** Hozircha "Игрушки" (o'yinchoqlar) shabloni. Boshqa kategoriyalar keyin. */
const TEMPLATE_FILE = 'wb-toys-template.xlsx';

export interface WbExportRow {
  values: Record<string, any>;
  imageUrls: string[];
}

export interface WbExportWarning {
  row: number;
  column: string;
  message: string;
}

/**
 * Bizning maydon → WB ustun sarlavhasi (3-qatordagi nom bilan solishtiriladi).
 * `header` — WB nomi (normalizatsiya qilib taqqoslanadi); `key` — bizdagi
 * qiymat kaliti (`__images__` — rasm URLlari, `__const__:X` — doimiy qiymat).
 */
interface ColumnMap {
  header: string;
  key: string;
  type: 'text' | 'number';
  /** Qiymatni WB kutgan ko'rinishga o'girish */
  transform?: (raw: any) => any;
}

/** g → kg (WB og'irlikni kilogrammda kutadi) */
const gramsToKg = (raw: any) => {
  const n = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) / 1000 : '';
};
/**
 * Butun santimetr.
 *
 * Avval bu yerda mm → sm o'girish bor edi (10 ga bo'lardi), holbuki formada
 * o'lcham ALLAQACHON santimetrda so'raladi. Natijada 23 sm qadoq Excel'da
 * 2 sm bo'lib chiqardi — WB da bu jarima sababi: "ko'rsatilgan o'lcham
 * haqiqiysidan kichik bo'lsa jarima solinadi".
 */
const toCm = (raw: any) => {
  const n = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : '';
};

/**
 * O'zbekcha variantni WB lug'atiga o'girish.
 *
 * Forma ro'yxatlari o'zbekcha ("Erkaklar", "Xitoy"), WB shabloni esa ruscha
 * qiymat kutadi. O'girmasak Excel'da "Erkaklar" bo'lib ketardi va WB uni
 * yuklashda rad etardi — API yo'lidagi bilan bir xil xato.
 */
const toWbDict = (raw: any) => staticWbValue(raw);

const WB_COLUMNS: ColumnMap[] = [
  { header: 'Group', key: '__const__:1', type: 'number' },
  { header: "Seller`s article", key: 'sku', type: 'text' },
  { header: 'Name', key: 'title', type: 'text' },
  { header: 'Subject', key: 'category', type: 'text' },
  // Brend ataylab to'ldirilmaydi: majburiy emas va WB faqat sotuvchi
  // huquqiga ega ro'yxatdan o'tgan brendni qabul qiladi. Ustun shablonda
  // qoladi — o'z brendi bo'lsa sotuvchi Excel ichida yozadi.
  { header: 'Description', key: 'description', type: 'text' },
  { header: 'Photo', key: '__images__', type: 'text' },
  // KIZ ataylab bo'sh: "Not needed" deb yozish huquqiy da'vo bo'lardi, holbuki
  // ko'p TN VED kodlari markirovkani TALAB qiladi (poloda 40 koddan 38 tasi).
  // Bo'sh bo'lsa WB o'z qoidasini qo'llaydi.
  { header: 'KIZ', key: '__const__:', type: 'text' },
  { header: 'Packaging weight (kg)', key: 'weight', type: 'number', transform: gramsToKg },
  { header: 'Color', key: 'color', type: 'text' },
  // Zaxira kalitlar vergul bilan — birinchi to'ldirilgani olinadi
  { header: 'Composition', key: 'composition,material', type: 'text' },
  { header: 'Gender', key: 'gender', type: 'text', transform: toWbDict },
  { header: 'Contents', key: 'contents', type: 'text' },
  // Kiyim shablonlarida o'lcham ustunlari bor. Bizdagi tayyor shablon
  // "Игрушки" bo'lgani uchun ular topilmasligi mumkin — u holda mavjud
  // ogohlantirish mexanizmi ("bu ustun topilmadi") ishlaydi.
  { header: 'Size', key: '__size__', type: 'text' },
  { header: 'Barcodes', key: 'barcode', type: 'text' },
  { header: 'Price', key: 'price', type: 'number' },
  // QQS ataylab to'ldirilmaydi: WB stavkani kabinet sozlamasidan oladi va
  // kartochka API'sida bunday maydon yo'q. Ustun WB shablonida qoladi —
  // kerak bo'lsa sotuvchi Excel ichida o'zi yozadi.
  { header: 'Country of origin', key: 'country', type: 'text', transform: toWbDict },
  { header: 'HS code', key: 'tnved,mxik,hsCode', type: 'text' },
  { header: 'Package height', key: 'packHeight', type: 'number', transform: toCm },
  { header: 'Package length', key: 'packLength', type: 'number', transform: toCm },
  { header: 'Package width', key: 'packWidth', type: 'number', transform: toCm },
];

// ─── Yordamchilar ────────────────────────────────────────

/** Nomni taqqoslash uchun — bo'shliqlar, registr va maxsus belgilarсиз */
function normHeader(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function templatePath(): string {
  const candidates = [
    path.join(__dirname, 'templates', TEMPLATE_FILE),
    path.resolve(process.cwd(), 'src/services/export/templates', TEMPLATE_FILE),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`WB shabloni topilmadi (${TEMPLATE_FILE}).`);
  return found;
}

/** sharedStrings.xml → matnlar massivi (indeks bo'yicha) */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    // <si> ichida bir yoki bir necha <t> bo'lishi mumkin (rich text)
    const parts = [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]));
    out.push(parts.join(''));
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/** 3-qatordagi sarlavhalar → { normalizatsiyalangan nom: ustun harfi } */
function headerColumns(sheetXml: string, shared: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const rowMatch = sheetXml.match(new RegExp(`<row[^>]*\\br="${HEADER_ROW}"[^>]*>([\\s\\S]*?)</row>`));
  if (!rowMatch) return map;

  for (const c of rowMatch[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
    const col = c[1];
    const attrs = c[2];
    const inner = c[3];
    let text = '';
    if (/\bt="s"/.test(attrs)) {
      const idx = Number(inner.match(/<v>(\d+)<\/v>/)?.[1]);
      text = shared[idx] ?? '';
    } else {
      text = decodeXml(inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '');
    }
    const norm = normHeader(text);
    if (norm && !map.has(norm)) map.set(norm, col);
  }
  return map;
}

/** Bitta katak XML si (matn — inlineStr, son — <v>) */
function buildCell(col: string, rowNum: number, raw: unknown, type: 'text' | 'number'): string {
  const ref = `${col}${rowNum}`;
  if (raw === undefined || raw === null || String(raw).trim() === '') return '';

  if (type === 'number') {
    const num = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(num)) return '';
    return `<c r="${ref}"><v>${num}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(raw))}</t></is></c>`;
}

// ─── Asosiy funksiyalar ──────────────────────────────────

/** Kartochka maydonlarini WB qatoriga tayyorlash (moslashtirish shu yerда emas — fillда) */
export function toWbRow(values: Record<string, any>, imageUrls: string[]): WbExportRow {
  return { values, imageUrls };
}

export function fillWbTemplate(
  rows: WbExportRow[],
  /**
   * Sotuvchining o'z shabloni. Berilmasa ilova bilan kelgan nusxa
   * ishlatiladi — u faqat bitta kategoriya uchun to'g'ri keladi.
   */
  template?: Buffer,
): { buffer: Buffer; warnings: WbExportWarning[] } {
  const zip = unzipSync(new Uint8Array(template ?? fs.readFileSync(templatePath())));
  const sheetBytes = zip[SHEET_PATH];
  const sharedBytes = zip[SHARED_PATH];
  if (!sheetBytes) throw new Error('WB shabloni buzilgan: Items varag\'i topilmadi');

  let xml = Buffer.from(sheetBytes).toString('utf8');
  const shared = sharedBytes ? parseSharedStrings(Buffer.from(sharedBytes).toString('utf8')) : [];
  const cols = headerColumns(xml, shared);
  const warnings: WbExportWarning[] = [];

  // WB da har o'lcham alohida nomenklatura — Excel'da ham alohida QATOR.
  // Hammasini bitta katakka yozsak ("M, L, XL") WB bitta variant yasaydi:
  // xaridor o'lchamni tanlay olmaydi, qoldiq ham ajratilmaydi.
  // Barkod faqat birinchi qatorga: qolganlariga WB o'zi generatsiya qiladi
  // (bir xil barkodni takrorlash — kartochkani rad ettiradi).
  const expanded: WbExportRow[] = [];
  let sawSizes = false;
  for (const row of rows) {
    const sizes = splitSizes(String(row.values.size ?? ''));
    if (sizes.length) sawSizes = true;
    if (sizes.length <= 1) {
      expanded.push({ ...row, values: { ...row.values, __size__: sizes[0] ?? '' } });
      continue;
    }
    sizes.forEach((size, i) => {
      expanded.push({
        ...row,
        values: {
          ...row.values,
          __size__: size,
          barcode: i === 0 ? row.values.barcode : '',
        },
      });
    });
  }

  // Tayyor shablon "Игрушки" uchun — kiyimda o'lcham ustuni yo'q. Sotuvchi
  // buni bilmasa, o'lchamsiz faylni yuklaydi va WB kartochkani o'lchamsiz
  // yaratadi. Shuning uchun ochiq aytamiz.
  if (sawSizes && !cols.has(normHeader('Size'))) {
    warnings.push({
      row: DATA_START_ROW,
      column: 'Size',
      message:
        "bu shablonda o'lcham ustuni yo'q (u o'yinchoqlar uchun). Kiyim uchun WB kabinetidan " +
        'o\'z kategoriyangiz shablonini yuklab oling yoki API orqali joylang — u yerda o\'lchamlar to\'g\'ri ketadi',
    });
  }

  // Har mahsulot uchun kataklar to'plamini yasaymiz
  const rowXmls: Array<{ num: number; cells: string }> = [];
  expanded.forEach((row, index) => {
    const rowNum = DATA_START_ROW + index;
    const cells: string[] = [];

    for (const map of WB_COLUMNS) {
      const col = cols.get(normHeader(map.header));
      if (!col) {
        if (index === 0) {
          warnings.push({ row: rowNum, column: map.header, message: 'shablonda bu ustun topilmadi — o\'tkazib yuborildi' });
        }
        continue;
      }

      let value: any;
      if (map.key.startsWith('__const__:')) {
        value = map.key.slice('__const__:'.length);
      } else if (map.key === '__images__') {
        value = row.imageUrls.filter(Boolean).join(';');
      } else {
        // Vergul bilan ajratilgan zaxira kalitlar — birinchi to'ldirilgani
        for (const k of map.key.split(',')) {
          const v = row.values[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            value = v;
            break;
          }
        }
      }

      if (map.transform) value = map.transform(value);

      const cell = buildCell(col, rowNum, value, map.type);
      if (cell) cells.push(cell);
    }

    rowXmls.push({ num: rowNum, cells: cells.join('') });
  });

  // Qatorlarni XML ga joylaymiz: mavjud bo'sh qatorни almashtiramiz, bo'lmasa qo'shamiz
  for (const { num, cells } of rowXmls) {
    const rowRe = new RegExp(`<row([^>]*\\br="${num}"[^>]*)(?:/>|>[\\s\\S]*?</row>)`);
    if (rowRe.test(xml)) {
      xml = xml.replace(rowRe, `<row$1>${cells}</row>`);
    } else {
      // </sheetData> dan oldin yangi qator qo'shamiz
      xml = xml.replace('</sheetData>', `<row r="${num}">${cells}</row></sheetData>`);
    }
  }

  zip[SHEET_PATH] = new Uint8Array(Buffer.from(xml, 'utf8'));
  const out = zipSync(zip, { level: 6 });
  return { buffer: Buffer.from(out), warnings };
}

/** Yuklab olinadigan fayl nomi */
export function wbFileName(count: number): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `wb-${count}-mahsulot-${stamp}.xlsx`;
}

/** Ustunlar nom bo'yicha topilishini test/diagnostika uchun ochamiz */
export const __internal = { normHeader, parseSharedStrings, headerColumns, WB_COLUMNS };
