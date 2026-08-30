/**
 * Uzum'ning rasmiy .xlsm shablonini to'ldirish.
 *
 * Nega noldan Excel yasamaymiz: Uzum shabloni oddiy jadval emas — ichida
 * makroslar, ochiluvchi ro'yxatlar, validatsiya qoidalari va 8500 qatorlik
 * kategoriyalar ma'lumotnomasi bor. Yo'riqnomada aniq yozilgan:
 *
 *   🚫 Ustunlarni o'chirmang yoki qo'shmang, tartibini o'zgartirmang
 *   🚫 Shapkaga (1-3 satr) tegmang — makroslar shunga bog'liq
 *
 * Shuning uchun biz shablonni QAYTA YARATMAYMIZ, balki tayyor faylning
 * ichidagi bitta XML'ni (Лист1 varag'ining qatorlari) almashtiramiz.
 * Qolgan hamma narsa — makros, validatsiya, uslublar, boshqa varaqlar —
 * bayt-bayt o'z holicha qoladi.
 *
 * E va F ustunlarini (kategoriya nomi va id) esa o'zimiz to'ldiramiz —
 * shablonning ichida, Лист2 varag'ida, Uzum'ning butun katalogi ID lari
 * bilan turadi. Ilgari bu ikki ustun bo'sh chiqar va sotuvchi faylni
 * Excel'da ochib makros orqali tanlashi kerak edi.
 */

import fs from 'fs';
import path from 'path';
import { unzipSync, zipSync } from 'fflate';
import { staticWbValue } from '../marketplace/wb-dictionary.service';

/** Shablon fayli — Uzum kabinetidan olingan asl nusxa */
const TEMPLATE_FILE = 'uzum-template.xlsm';

/** Ma'lumot shu qatordan boshlanadi (1-3 — xizmat satrlari) */
const DATA_START_ROW = 4;

/**
 * Shablonga nechta tovar sig'adi.
 *
 * Bu son o'ylab topilmagan — shablon faylining o'zidan hisoblanadi.
 * Ilgari bu yerda 1000 turardi, aslida esa sheet1.xml da atigi 793 ta
 * <row> bor va ma'lumot 4-qatordan boshlanadi, ya'ni haqiqiy sig'im 790.
 * Farq jimgina yo'qolardi: 900 ta tovar eksport qilgan sotuvchi faylni
 * ochib 790 tasini ko'rardi va 110 tasi qayerga ketganini bilmasdi.
 */
let cachedMaxRows: number | null = null;

export function uzumMaxRows(template?: Buffer): number {
  if (!template && cachedMaxRows !== null) return cachedMaxRows;

  const zip = unzipSync(new Uint8Array(template ?? fs.readFileSync(templatePath())));
  const sheet = zip[SHEET_PATH];
  if (!sheet) throw new Error('Shablon buzilgan: Лист1 topilmadi');

  const xml = Buffer.from(sheet).toString('utf8');
  let last = 0;
  for (const m of xml.matchAll(/<row[^>]*\br="(\d+)"/g)) {
    const n = Number(m[1]);
    if (n > last) last = n;
  }

  const rows = Math.max(0, last - DATA_START_ROW + 1);
  if (!template) cachedMaxRows = rows;
  return rows;
}

/** Лист1 XML ichidagi yo'l */
const SHEET_PATH = 'xl/worksheets/sheet1.xml';

/**
 * Shablon ustunlari — tartibi va nomi Uzum shablonidagidek.
 * `key` — bizdagi maydon kaliti; `null` bo'lsa ustun bo'sh qoldiriladi.
 */
interface TemplateColumn {
  col: string;
  header: string;
  key: string | null;
  type: 'text' | 'number';
  /** Uzum chegarasi (belgi) */
  maxLength?: number;
  required?: boolean;
  /** Qiymatni shablonga yozishdan oldin o'girish */
  transform?: (raw: any) => any;
  /** Shablon ichidagi ma'lumotnoma — qiymat aynan shu ro'yxatdan bo'lishi shart */
  ref?: keyof UzumReferences;
}

export const UZUM_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { col: 'A', header: 'Название товара RU', key: 'titleRu', type: 'text', maxLength: 100, required: true },
  { col: 'B', header: 'Идентификатор от продавца', key: 'sku', type: 'text' },
  { col: 'C', header: 'Название товара UZ', key: 'titleUz', type: 'text', maxLength: 100, required: true },
  { col: 'D', header: 'Группировка SKU', key: 'skuGroup', type: 'text', maxLength: 100, required: true },
  // E, F — makros to'ldiradi, tegmaymiz
  { col: 'E', header: 'Название категории', key: null, type: 'text' },
  { col: 'F', header: 'id категории', key: null, type: 'text' },
  { col: 'G', header: 'Бренд', key: 'brand', type: 'text', required: true, ref: 'brands' },
  { col: 'H', header: 'Модель', key: 'model', type: 'text' },
  // Shablon ruscha to'ldiriladi: "Xitoy" emas, "Китай"
  {
    col: 'I',
    header: 'Страна производства',
    key: 'country',
    type: 'text',
    required: true,
    transform: (raw: any) => staticWbValue(raw) || raw,
    ref: 'countries',
  },
  { col: 'J', header: 'Описание товара RU', key: 'descriptionRu', type: 'text', maxLength: 5000, required: true },
  { col: 'K', header: 'Описание товара UZ', key: 'descriptionUz', type: 'text', maxLength: 5000, required: true },
  { col: 'L', header: 'Краткое описание RU', key: 'shortRu', type: 'text', maxLength: 390, required: true },
  { col: 'M', header: 'Краткое описание UZ', key: 'shortUz', type: 'text', maxLength: 390, required: true },
  { col: 'N', header: 'Состав RU', key: 'materialRu', type: 'text' },
  { col: 'O', header: 'Состав UZ', key: 'materialUz', type: 'text' },
  { col: 'P', header: 'Инструкция по уходу RU', key: 'careRu', type: 'text' },
  { col: 'Q', header: 'Инструкция по уходу UZ', key: 'careUz', type: 'text' },
  { col: 'R', header: 'Размерная сетка RU', key: 'sizeChartRu', type: 'text' },
  { col: 'S', header: 'Размерная сетка UZ', key: 'sizeChartUz', type: 'text' },
  { col: 'T', header: 'Ссылки на фото', key: '__images__', type: 'text', required: true },
  { col: 'U', header: 'Штрихкод', key: 'barcode', type: 'text' },
  { col: 'V', header: 'ИКПУ', key: 'mxik', type: 'text', required: true },
  // Rang ham ruscha ustun: "Bej" emas, "бежевый"
  { col: 'W', header: 'Цвет', key: 'color', type: 'text', transform: (raw: any) => staticWbValue(raw) || raw, ref: 'colors' },
  { col: 'X', header: 'Размер', key: 'size', type: 'text', ref: 'sizes' },
  { col: 'Y', header: 'Цена продажи (som)', key: 'price', type: 'number', required: true },
  { col: 'Z', header: 'Цена до скидки (som)', key: 'oldPrice', type: 'number', required: true },
  { col: 'AA', header: 'Вес (г)', key: 'weight', type: 'number', required: true },
  { col: 'AB', header: 'Высота (мм)', key: 'packHeight', type: 'number', required: true },
  { col: 'AC', header: 'Ширина (мм)', key: 'packWidth', type: 'number', required: true },
  { col: 'AD', header: 'Длина (мм)', key: 'packLength', type: 'number', required: true },
];

export interface UzumExportRow {
  values: Record<string, any>;
  imageUrls: string[];
}

export interface UzumExportWarning {
  row: number;
  column: string;
  message: string;
}

export interface UzumExportResult {
  buffer: Buffer;
  warnings: UzumExportWarning[];
}

/**
 * Kartochka maydonlarini shablon ustunlariga moslashtirish.
 *
 * Bizdagi kartochkalar bitta tilda to'ldirilishi mumkin, Uzum esa RU va UZ
 * ikkalasini ham majburiy qiladi. Shuning uchun bo'sh qolgan maydonlarni
 * mavjudidan to'ldiramiz — eksport ishlasin, foydalanuvchi esa faylni
 * ochib tarjimani tekshirsin (bu haqda ogohlantirish qaytadi).
 */
export function toUzumRow(values: Record<string, any>, imageUrls: string[]): UzumExportRow {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = values[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
    }
    return undefined;
  };

  const titleRu = pick('titleRu', 'title');
  const titleUz = pick('titleUz', 'title');
  const descriptionRu = pick('descriptionRu', 'description');
  const descriptionUz = pick('descriptionUz', 'description');

  /** Qisqa tavsif berilmagan bo'lsa — to'liq tavsifning boshidan */
  const shorten = (text?: string) => (text ? text.replace(/\s+/g, ' ').trim().slice(0, 390) : undefined);

  return {
    imageUrls,
    values: {
      ...values,
      titleRu,
      titleUz,
      descriptionRu,
      descriptionUz,
      shortRu: pick('shortRu', 'shortDescription') ?? shorten(descriptionRu),
      shortUz: pick('shortUz') ?? shorten(descriptionUz),
      // Variatsiyalar bir kartochkaga birlashishi uchun — berilmasa artikul
      skuGroup: pick('skuGroup', 'sku'),
      materialRu: pick('materialRu', 'material'),
      materialUz: pick('materialUz'),
      // Chegirmagacha narx majburiy: berilmasa sotuv narxining o'zi
      oldPrice: pick('oldPrice') ?? pick('price'),
    },
  };
}

// ─── XML yordamchilari ───────────────────────────────────

/**
 * Uzum narxni faqat 1000 ga karrali qabul qiladi ("Значение цены не кратно
 * 1000"). Shuning uchun eksportda narxni eng yaqin mingga yaxlitlaymiz.
 * Minimal 1000 — 400 so'm mahsulot 0 ga tushib, Uzum uni rad etmasin.
 * O'zgargan bo'lsa sotuvchini ogohlantiramiz (jimgina narxini o'zgartirmaymiz).
 */
function roundToThousand(raw: unknown): number | null {
  const num = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.max(1000, Math.round(num / 1000) * 1000);
}

/** Narx ustunlari — 1000 ga karrali bo'lishi shart */
const PRICE_KEYS = new Set(['price', 'oldPrice']);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Excel XML'da ruxsat etilmagan boshqaruv belgilari — faylni buzadi
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Qatordagi mavjud kataklardan uslub raqamini (`s`) yig'ish.
 *
 * Shablonda G/I/X kataklari oldindan uslublangan (ochiluvchi ro'yxat
 * ko'rinishi shundan keladi) — qayta yozayotganda uni saqlash kerak,
 * aks holda katak boshqacha ko'rinadi.
 */
function readStyles(rowXml: string): Map<string, string> {
  const styles = new Map<string, string>();
  for (const m of rowXml.matchAll(/<c\s+r="([A-Z]+)\d+"([^>]*)>/g)) {
    const s = m[2].match(/\bs="(\d+)"/);
    if (s) styles.set(m[1], s[1]);
  }
  return styles;
}

function buildCell(col: string, rowNum: number, raw: unknown, type: 'text' | 'number', style?: string): string {
  const ref = `${col}${rowNum}`;
  const s = style ? ` s="${style}"` : '';

  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return `<c r="${ref}"${s}/>`;
  }

  if (type === 'number') {
    const num = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(num)) return `<c r="${ref}"${s}/>`;
    return `<c r="${ref}"${s}><v>${num}</v></c>`;
  }

  // inlineStr — sharedStrings.xml ga tegmaslik uchun (u boshqa varaqlar
  // bilan bo'lishilgan va indekslarni buzish butun faylni buzadi)
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(raw))}</t></is></c>`;
}

// ─── Asosiy funksiya ─────────────────────────────────────

function templatePath(): string {
  // Ishlab chiqishda src/, buildda dist/ — ikkalasini ham tekshiramiz
  const candidates = [
    path.join(__dirname, 'templates', TEMPLATE_FILE),
    path.resolve(process.cwd(), 'src/services/export/templates', TEMPLATE_FILE),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `Uzum shabloni topilmadi (${TEMPLATE_FILE}). ` +
        'Uni apps/api/src/services/export/templates/ ichiga joylang.',
    );
  }
  return found;
}

/**
 * Bir nechta o'lcham — bir nechta qator.
 *
 * Uzum shablonida bitta qator = bitta variant. "M,L,XL" deb bitta katakka
 * yozsak, Uzum uni ro'yxatidan topolmaydi va o'lchamsiz bitta tovar
 * yaratiladi. Variantlar bitta kartochkaga birlashishi uchun ularning
 * "Группировка SKU" si bir xil qoladi, artikuli esa farqlanadi.
 */
function expandUzumSizes(rows: UzumExportRow[]): UzumExportRow[] {
  const out: UzumExportRow[] = [];
  for (const row of rows) {
    const sizes = String(row.values.size ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (sizes.length < 2) {
      out.push(row);
      continue;
    }

    const sku = String(row.values.sku ?? '').trim();
    for (const size of sizes) {
      out.push({
        imageUrls: row.imageUrls,
        values: {
          ...row.values,
          size,
          // Artikul har bir variantda alohida bo'lishi shart
          sku: sku ? `${sku}-${size}` : sku,
        },
      });
    }
  }
  return out;
}

/**
 * Kartochkadagi kategoriyani shablon katalogiga bog'lash.
 *
 * Avval ID bo'yicha (AI kategoriyani tanlaganda ID ham saqlanadi), keyin
 * nomi va yo'lining oxirgi bo'g'ini bo'yicha. Topilmasa `null` — E/F bo'sh
 * qoladi va sotuvchi ogohlantiriladi.
 */
function resolveUzumCategory(
  values: Record<string, any>,
  categories: UzumCategoryRef[],
): UzumCategoryRef | null {
  if (!categories.length) return null;

  const id = String(values.categoryId ?? '').trim();
  if (id) {
    const byId = categories.find((c) => c.id === id);
    if (byId) return byId;
  }

  const raw = String(values.category ?? '').trim();
  if (!raw) return null;

  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
  const leaf = norm(raw.split(/[>/]/).pop() ?? raw);

  return (
    categories.find((c) => norm(c.title) === leaf) ??
    categories.find((c) => norm(c.path) === norm(raw)) ??
    null
  );
}

/**
 * Uzum shablonini ma'lumot bilan to'ldirib, .xlsm buferini qaytaradi.
 */
export function fillUzumTemplate(inputRows: UzumExportRow[], template?: Buffer): UzumExportResult {
  const rows = expandUzumSizes(inputRows);
  const maxRows = uzumMaxRows(template);
  if (rows.length > maxRows) {
    throw new Error(
      `Shablonga ${maxRows} tadan ko'p tovar sig'maydi (siz ${rows.length} ta tanladingiz). ` +
        'Mahsulotlarni bir necha faylga bo\'lib eksport qiling.',
    );
  }

  const zip = unzipSync(new Uint8Array(template ?? fs.readFileSync(templatePath())));
  const sheetBytes = zip[SHEET_PATH];
  if (!sheetBytes) throw new Error('Shablon buzilgan: Лист1 topilmadi');

  let xml = Buffer.from(sheetBytes).toString('utf8');
  const warnings: UzumExportWarning[] = [];

  // Kategoriya (E/F) va ro'yxatli ustunlar shablonning O'Z ichidagi
  // ma'lumotnomadan to'ldiriladi. Ilgari E/F bo'sh chiqar va sotuvchi
  // faylni Excel'da ochib makros orqali tanlashi kerak edi.
  const refs = uzumReferences(template);
  const categories = uzumCategories(template);

  rows.forEach((row, index) => {
    const rowNum = DATA_START_ROW + index;

    // Qatorni topamiz — bo'sh qator `<row .../>` ko'rinishida ham bo'lishi mumkin
    const rowRe = new RegExp(`<row([^>]*\\br="${rowNum}"[^>]*)(?:/>|>([\\s\\S]*?)</row>)`);
    const match = xml.match(rowRe);
    if (!match) {
      // Bu yerga tushmasligi kerak (yuqorida chegara tekshirilgan), lekin
      // shablon almashtirilsa tushishi mumkin. Jim tashlab ketish eng yomoni:
      // sotuvchi tovari yo'qolganini bilmay qoladi.
      warnings.push({
        row: rowNum,
        column: '—',
        message: `shablonda ${rowNum}-qator yo'q, bu tovar faylga tushmadi`,
      });
      return;
    }

    const styles = readStyles(match[2] || '');
    const cells: string[] = [];

    // Kategoriya — E (nomi) va F (id). Ikkalasi ham majburiy va ikkalasi
    // ham shablon ichidagi katalogdan keladi.
    const category = resolveUzumCategory(row.values, categories);
    if (!category) {
      warnings.push({
        row: rowNum,
        column: 'Категория (E/F)',
        message:
          "kategoriya aniqlanmadi — faylni ochib ochiluvchi ro'yxatdan tanlang, " +
          "aks holda Uzum 'kategoriya ko'rsatilmagan' deb rad etadi",
      });
    }

    for (const column of UZUM_TEMPLATE_COLUMNS) {
      if (column.key === null) {
        // E/F — katalogdan to'ldiriladi, topilmasa uslubni saqlab bo'sh qoladi
        const text = column.col === 'E' ? category?.title : category?.id;
        if (text) {
          cells.push(buildCell(column.col, rowNum, text, 'text', styles.get(column.col)));
        } else {
          const s = styles.get(column.col);
          if (s) cells.push(`<c r="${column.col}${rowNum}" s="${s}"/>`);
        }
        continue;
      }

      let value =
        column.key === '__images__'
          ? row.imageUrls.filter(Boolean).join('\n')
          : row.values[column.key];

      if (column.transform && value !== undefined && value !== null && String(value).trim() !== '') {
        value = column.transform(value);
      }

      // Ro'yxatli ustun: Uzum aynan o'z yozuvini kutadi. "бежевый" emas —
      // "Бежевый", "No name" emas — "No Name". Mos kelmasa bo'sh qoldiramiz:
      // ro'yxatdan tashqari qiymat butun faylni rad ettiradi.
      if (column.ref && value !== undefined && value !== null && String(value).trim() !== '') {
        const matched = matchReference(String(value), refs[column.ref]);
        if (matched.value) {
          value = matched.value;
        } else {
          warnings.push({
            row: rowNum,
            column: column.header,
            message: matched.ambiguous
              ? `"${value}" bir nechta ro'yxatga to'g'ri keldi — Excel'da ochiluvchi ro'yxatdan tanlang`
              : `"${value}" Uzum ro'yxatida yo'q — bo'sh qoldirildi`,
          });
          value = undefined;
        }
      }

      if (column.maxLength && typeof value === 'string' && value.length > column.maxLength) {
        warnings.push({
          row: rowNum,
          column: column.header,
          message: `${value.length} belgi — ${column.maxLength} gacha qisqartirildi`,
        });
        value = value.slice(0, column.maxLength);
      }

      if (column.required && (value === undefined || value === null || String(value).trim() === '')) {
        warnings.push({
          row: rowNum,
          column: column.header,
          message: "majburiy maydon bo'sh — Uzum yuklashda rad etadi",
        });
      }

      // Narxni 1000 ga karrali qilamiz — Uzum shunisiz rad etadi
      if (PRICE_KEYS.has(column.key!) && value !== undefined && value !== null && String(value).trim() !== '') {
        const rounded = roundToThousand(value);
        if (rounded !== null && rounded !== Number(value)) {
          warnings.push({
            row: rowNum,
            column: column.header,
            message: `narx ${value} → ${rounded} ga yaxlitlandi (Uzum 1000 ga karrali talab qiladi)`,
          });
        }
        if (rounded !== null) value = rounded;
      }

      cells.push(buildCell(column.col, rowNum, value, column.type, styles.get(column.col)));
    }

    // Kategoriya xususiyatlari (AE dan boshlab). Ular shablonning o'zidan
    // o'qiladi va formada to'ldiriladi — avval bu ustunlar bo'sh chiqib,
    // sotuvchi ularni Excel ichida qo'lda tanlashi kerak edi.
    const charcValues = row.values.uzumCharacteristics;
    if (charcValues && typeof charcValues === 'object') {
      for (const charc of uzumCharacteristics(template)) {
        const raw = (charcValues as Record<string, unknown>)[String(charc.id)];
        const text = String(raw ?? '').trim();
        if (!text) continue;

        // Ro'yxatdan tashqari qiymat Uzum validatsiyasidan o'tmaydi
        const allowed = text
          .split(',')
          .map((part) => part.trim())
          .filter((part) => charc.options.some((o) => o.toLowerCase() === part.toLowerCase()))
          .slice(0, charc.maxCount);

        if (!allowed.length) {
          warnings.push({
            row: rowNum,
            column: charc.name,
            message: `"${text}" ro'yxatda yo'q — bo'sh qoldirildi`,
          });
          continue;
        }

        cells.push(
          buildCell(charc.column, rowNum, allowed.join(', '), 'text', styles.get(charc.column)),
        );
      }
    }

    const attrs = match[1].replace(/\s*\/$/, '');
    xml = xml.replace(rowRe, `<row${attrs}>${cells.join('')}</row>`);
  });

  zip[SHEET_PATH] = new Uint8Array(Buffer.from(xml, 'utf8'));

  // mimeType saqlanishi uchun siqishni asl darajada qoldiramiz
  const out = zipSync(zip, { level: 6 });
  return { buffer: Buffer.from(out), warnings };
}

// ─── SHABLON ICHIDAGI MA'LUMOTNOMALAR ────────────────────

/**
 * Uzum shablonining ichida ikkita ma'lumotnoma varag'i bor va ular
 * yuklashda hal qiluvchi:
 *
 *   Лист2 — kategoriyalar katalogi (category_id, category_title, full_path_ru)
 *   Лист3 — o'lchamlar, ranglar, brendlar va davlatlar ro'yxati
 *
 * Buni bilmaganimiz uchun eksport ikki joyda yiqilardi. Birinchisi —
 * kategoriya: E/F ustunlarini sotuvchi Excel ichidagi makros orqali
 * qo'lda tanlashi kerak edi. Ikkinchisi — ro'yxatli ustunlar: biz
 * "бежевый" va "No name" deb yozardik, Uzum esa aynan o'z yozuvini
 * kutadi ("Бежевый", "No Name") va boshqasini rad etadi.
 *
 * Ma'lumotnoma faylning ichida bo'lgani uchun na API, na tarmoq kerak —
 * sotuvchi o'z kategoriyasining shablonini yuklasa, ro'yxat ham u bilan
 * birga yangilanadi.
 */
export interface UzumCategoryRef {
  /** Uzum katalog ID si — F ustuniga shu yoziladi */
  id: string;
  /** Kategoriya nomi — E ustuniga shu yoziladi */
  title: string;
  /** To'liq yo'l (ruscha) — qidiruvda va tanlovda ko'rsatiladi */
  path: string;
}

export interface UzumReferences {
  sizes: string[];
  colors: string[];
  brands: string[];
  countries: string[];
}

/** Лист2 — kategoriyalar, Лист3 — ro'yxatlar */
const CATEGORY_SHEET = 'xl/worksheets/sheet2.xml';
const LIST_SHEET = 'xl/worksheets/sheet3.xml';

let cachedRefs: UzumReferences | null = null;
let cachedCategories: UzumCategoryRef[] | null = null;

function sharedStrings(zip: Record<string, Uint8Array>): string[] {
  const xml = zip['xl/sharedStrings.xml'] ? Buffer.from(zip['xl/sharedStrings.xml']).toString('utf8') : '';
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    (m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''),
  );
}

/** Varaqning bitta ustunidagi qiymatlar (1-qator sarlavha, tashlab ketiladi) */
function columnValues(sheet: string, col: string, shared: string[]): string[] {
  const out: string[] = [];
  const re = new RegExp(`<c r="${col}(\\d+)"([^>]*)>(?:<v>([^<]*)</v>)?</c>`, 'g');
  for (const m of sheet.matchAll(re)) {
    if (Number(m[1]) < 2) continue;
    const value = / t="s"/.test(m[2]) ? shared[Number(m[3])] : m[3];
    if (value) out.push(String(value));
  }
  return out;
}

export function uzumReferences(template?: Buffer): UzumReferences {
  if (!template && cachedRefs) return cachedRefs;

  const zip = unzipSync(new Uint8Array(template ?? fs.readFileSync(templatePath())));
  const shared = sharedStrings(zip);
  const sheet = zip[LIST_SHEET] ? Buffer.from(zip[LIST_SHEET]).toString('utf8') : '';

  const refs: UzumReferences = {
    sizes: columnValues(sheet, 'A', shared),
    colors: columnValues(sheet, 'B', shared),
    brands: columnValues(sheet, 'C', shared),
    countries: columnValues(sheet, 'D', shared),
  };

  if (!template) cachedRefs = refs;
  return refs;
}

/** Shablon ichidagi kategoriyalar katalogi (takrorlanmaydigan) */
export function uzumCategories(template?: Buffer): UzumCategoryRef[] {
  if (!template && cachedCategories) return cachedCategories;

  const zip = unzipSync(new Uint8Array(template ?? fs.readFileSync(templatePath())));
  const shared = sharedStrings(zip);
  const sheet = zip[CATEGORY_SHEET] ? Buffer.from(zip[CATEGORY_SHEET]).toString('utf8') : '';

  // Har bir kategoriya filtri uchun alohida qator bor — ID bo'yicha yig'amiz
  const rows = new Map<number, Record<string, string>>();
  for (const m of sheet.matchAll(/<c r="([A-C])(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
    const rowNum = Number(m[2]);
    if (rowNum < 2) continue;
    const value = / t="s"/.test(m[3]) ? shared[Number(m[4])] : m[4];
    if (!value) continue;
    const row = rows.get(rowNum) ?? {};
    row[m[1]] = String(value);
    rows.set(rowNum, row);
  }

  const byId = new Map<string, UzumCategoryRef>();
  for (const row of rows.values()) {
    if (!row.A || !row.B) continue;
    if (byId.has(row.A)) continue;
    byId.set(row.A, {
      id: row.A,
      title: row.B,
      path: (row.C ?? row.B).replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
    });
  }

  const out = [...byId.values()];
  if (!template) cachedCategories = out;
  return out;
}

/**
 * Qiymatni ma'lumotnomadagi aynan yozuvga o'girish.
 *
 * O'lchamlar ro'yxati prefiksli: "Размер одежды:M". Sotuvchi esa "M" deb
 * yozadi — shuning uchun ikki nuqtadan keyingi qism bo'yicha ham qidiramiz.
 * Bir nechta ro'yxatga to'g'ri kelsa ("42" — ham oyoq kiyim, ham ko'ylak
 * yoqasi) tanlab qo'ymaymiz: noto'g'ri o'lcham bilan sotuvga chiqqan tovar
 * qaytarib olinadi, bo'sh katak esa faqat ogohlantirish beradi.
 */
export function matchReference(value: string, list: string[]): { value: string | null; ambiguous: boolean } {
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
  const target = norm(value);
  if (!target) return { value: null, ambiguous: false };

  const exact = list.find((item) => norm(item) === target);
  if (exact) return { value: exact, ambiguous: false };

  const bySuffix = list.filter((item) => item.includes(':') && norm(item.split(':').slice(1).join(':')) === target);
  if (bySuffix.length === 1) return { value: bySuffix[0], ambiguous: false };
  if (bySuffix.length > 1) return { value: null, ambiguous: true };

  return { value: null, ambiguous: false };
}

/** Yuklab olinadigan fayl nomi */
export function uzumFileName(count: number): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `uzum-${count}-mahsulot-${stamp}.xlsm`;
}

// ─── KATEGORIYA XUSUSIYATLARI ────────────────────────────

/**
 * Shablonning o'zidan kategoriya xususiyatlarini o'qish.
 *
 * Uzum shablonida AE ustunidan boshlab kategoriyaga xos maydonlar turadi:
 * 2-qatorda nomi ("Основной материал"), 3-qatorda tanlov turi ("выбор
 * одного" / "выбор нескольких"), ruxsat etilgan qiymatlar esa `_cache`
 * varag'ida, ustunga biriktirilgan `FilterList_*` diapazonida.
 *
 * Ya'ni ma'lumotnoma faylning ichida — API ham, tarmoq ham kerak emas.
 * Avval bu ustunlar bo'sh chiqardi va sotuvchi ularni Excel ichida qo'lda
 * to'ldirishi kerak edi; endi formada ko'rinadi va AI to'ldiradi.
 */
export interface UzumCharacteristic {
  /** Ustun raqami (AE = 31) — qiymat shu ustunga yoziladi */
  id: number;
  column: string;
  name: string;
  maxCount: number;
  options: string[];
}

function columnIndex(col: string): number {
  return col.split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
}

let cachedCharcs: UzumCharacteristic[] | null = null;

export function uzumCharacteristics(template?: Buffer): UzumCharacteristic[] {
  if (!template && cachedCharcs) return cachedCharcs;

  const zip = unzipSync(new Uint8Array(template ?? fs.readFileSync(templatePath())));
  const text = (p: string) => (zip[p] ? Buffer.from(zip[p]).toString('utf8') : '');

  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    (m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''),
  );
  const sheet = text(SHEET_PATH);

  const rowCells = (rowNum: number): Map<string, string> => {
    const row = sheet.match(new RegExp(`<row[^>]*r="${rowNum}"[\\s\\S]*?</row>`))?.[0] ?? '';
    const out = new Map<string, string>();
    for (const c of row.matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?: t="(\w+)")?[^>]*>(?:<v>([^<]*)<\/v>)?/g)) {
      const value = c[2] === 's' ? shared[Number(c[3])] : c[3];
      if (value) out.set(c[1], String(value));
    }
    return out;
  };

  const names = rowCells(2);
  const modes = rowCells(3);

  const validation = new Map<string, string>();
  for (const dv of sheet.matchAll(
    /<dataValidation[^>]*sqref="([A-Z]+)\d+:[A-Z]+\d+"[^>]*>\s*<formula1>([^<]+)<\/formula1>/g,
  )) {
    validation.set(dv[1], dv[2]);
  }

  const ranges = new Map<string, string>();
  for (const n of text('xl/workbook.xml').matchAll(
    /<definedName name="([^"]+)"[^>]*>([^<]*)<\/definedName>/g,
  )) {
    ranges.set(n[1], n[2]);
  }

  const cacheSheet = text('xl/worksheets/sheet6.xml');
  const valuesOf = (ref: string): string[] => {
    const m = ref.match(/\$([A-Z]+)\$(\d+):\$[A-Z]+\$(\d+)/);
    if (!m) return [];
    const [, col, from, to] = m;
    const out: string[] = [];
    for (let r = Number(from); r <= Number(to); r++) {
      const cell = cacheSheet.match(
        new RegExp(`<c r="${col}${r}"[^>]*?(?: t="(\\w+)")?[^>]*>(?:<v>([^<]*)</v>)?`),
      );
      if (!cell) continue;
      const value = cell[1] === 's' ? shared[Number(cell[2])] : cell[2];
      if (value) out.push(String(value));
    }
    return out;
  };

  const out: UzumCharacteristic[] = [];
  for (const [col, name] of names) {
    // Xususiyatlar AE dan boshlanadi; undan oldingilari — qat'iy ustunlar
    if (columnIndex(col) < columnIndex('AE')) continue;
    const list = validation.get(col);
    const options = list ? valuesOf(ranges.get(list) ?? '') : [];
    if (!options.length) continue;

    out.push({
      id: columnIndex(col),
      column: col,
      name,
      maxCount: /нескольких/i.test(modes.get(col) ?? '') ? 5 : 1,
      options,
    });
  }

  if (!template) cachedCharcs = out;
  return out;
}
