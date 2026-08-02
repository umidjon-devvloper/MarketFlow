/**
 * Bulk Import Service
 * Excel yoki CSV faylni qabul qilib, mahsulotlarni bazaga import qiladi
 *
 * Format:
 * - Excel (.xlsx, .xls) — SheetJS (xlsx) paketi
 * - CSV — SheetJS ham qo'llab-quvvatlaydi
 *
 * Ustunlar:
 * title, description, category, brand, sku, barcode, basePrice, currency, stock,
 * imageUrl1, imageUrl2, imageUrl3, imageUrl4, imageUrl5
 */

import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '../utils/prisma';

// ============================================
// Row schema
// ============================================

export const importRowSchema = z.object({
  title: z.string().min(3, 'Nom kamida 3 harf').max(200, 'Nom 200 dan uzun'),
  description: z.string().min(10, 'Tavsif kamida 10 harf').max(5000),
  category: z.string().min(1, 'Kategoriya kerak'),
  brand: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  basePrice: z.coerce.number().positive('Narx musbat bo\'lishi kerak'),
  currency: z.enum(['UZS', 'RUB', 'USD']).default('UZS').catch('UZS'),
  stock: z.coerce.number().int().min(0).default(0).catch(0),
  imageUrl1: z.string().url().optional().nullable().or(z.literal('')),
  imageUrl2: z.string().url().optional().nullable().or(z.literal('')),
  imageUrl3: z.string().url().optional().nullable().or(z.literal('')),
  imageUrl4: z.string().url().optional().nullable().or(z.literal('')),
  imageUrl5: z.string().url().optional().nullable().or(z.literal('')),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export interface RowValidation {
  rowNumber: number; // Excel'dagi satr raqami (2 dan boshlanadi, chunki 1 - header)
  data: any;
  errors: Array<{ field: string; message: string }>;
  isValid: boolean;
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: RowValidation[];
}

export interface ImportResult {
  successCount: number;
  failedCount: number;
  errors: Array<{ rowNumber: number; message: string }>;
  createdProductIds: string[];
}

// ============================================
// Ustun nomi normalizatsiyasi
// ============================================

/**
 * Excel'da har xil yozilishi mumkin (nomi/Nomi/NAME/Title) — bularni bir formatga keltiramiz
 */
const COLUMN_ALIASES: Record<string, keyof ImportRow> = {
  // title
  title: 'title',
  name: 'title',
  nomi: 'title',
  nom: 'title',
  наименование: 'title',
  название: 'title',

  // description
  description: 'description',
  tavsif: 'description',
  описание: 'description',
  desc: 'description',

  // category
  category: 'category',
  kategoriya: 'category',
  категория: 'category',

  // brand
  brand: 'brand',
  brend: 'brand',
  бренд: 'brand',

  sku: 'sku',
  barcode: 'barcode',
  barkod: 'barcode',
  штрихкод: 'barcode',

  // price
  price: 'basePrice',
  baseprice: 'basePrice',
  narx: 'basePrice',
  цена: 'basePrice',

  currency: 'currency',
  valyuta: 'currency',
  валюта: 'currency',

  stock: 'stock',
  zaxira: 'stock',
  остаток: 'stock',
  quantity: 'stock',

  // images
  imageurl1: 'imageUrl1',
  image1: 'imageUrl1',
  rasm1: 'imageUrl1',
  imageurl2: 'imageUrl2',
  image2: 'imageUrl2',
  rasm2: 'imageUrl2',
  imageurl3: 'imageUrl3',
  image3: 'imageUrl3',
  rasm3: 'imageUrl3',
  imageurl4: 'imageUrl4',
  image4: 'imageUrl4',
  rasm4: 'imageUrl4',
  imageurl5: 'imageUrl5',
  image5: 'imageUrl5',
  rasm5: 'imageUrl5',
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '').trim();
}

function normalizeRow(raw: any): any {
  const normalized: any = {};
  for (const [key, value] of Object.entries(raw)) {
    const normKey = normalizeKey(key);
    const mapped = COLUMN_ALIASES[normKey];
    if (mapped) {
      // Bo'sh string'ni null qilamiz
      normalized[mapped] = value === '' || value === undefined ? null : value;
    }
  }
  return normalized;
}

// ============================================
// Fayl parsing
// ============================================

/**
 * Buffer'dan Excel yoki CSV o'qish
 */
export function parseFile(buffer: Buffer, fileName: string): any[] {
  const isCsv = fileName.toLowerCase().endsWith('.csv');

  const workbook = isCsv
    ? XLSX.read(buffer.toString('utf-8'), { type: 'string' })
    : XLSX.read(buffer, { type: 'buffer' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Faylda hech qanday sahifa (sheet) topilmadi');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows;
}

// ============================================
// Validatsiya (import qilmasdan)
// ============================================

export function validateRows(rows: any[]): ImportPreview {
  const validated: RowValidation[] = rows.map((raw, index) => {
    const rowNumber = index + 2; // Excel: 1 - header, 2 dan boshlanadi
    const normalized = normalizeRow(raw);

    const result = importRowSchema.safeParse(normalized);

    if (result.success) {
      return {
        rowNumber,
        data: result.data,
        errors: [],
        isValid: true,
      };
    }

    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return {
      rowNumber,
      data: normalized,
      errors,
      isValid: false,
    };
  });

  return {
    totalRows: validated.length,
    validRows: validated.filter((r) => r.isValid).length,
    invalidRows: validated.filter((r) => !r.isValid).length,
    rows: validated,
  };
}

// ============================================
// Ommaviy import
// ============================================

/**
 * Faqat valid satrlarni bazaga qo'shish
 * organizationId va createdById kerak
 */
export async function importValidRows(
  rows: RowValidation[],
  organizationId: string,
  userId: string,
): Promise<ImportResult> {
  const validRows = rows.filter((r) => r.isValid);
  const errors: ImportResult['errors'] = [];
  const createdProductIds: string[] = [];

  // Batch bo'lib import (100 tadan)
  const BATCH_SIZE = 50;

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (row) => {
        try {
          const data = row.data as ImportRow;

          // Rasmlarni ajratish
          const imageUrls = [
            data.imageUrl1,
            data.imageUrl2,
            data.imageUrl3,
            data.imageUrl4,
            data.imageUrl5,
          ].filter((url): url is string => Boolean(url && url.length > 0));

          const product = await prisma.product.create({
            data: {
              organizationId,
              createdById: userId,
              title: data.title,
              description: data.description,
              category: data.category,
              brand: data.brand || null,
              sku: data.sku || null,
              barcode: data.barcode || null,
              basePrice: data.basePrice,
              currency: data.currency,
              stock: data.stock,
              status: 'DRAFT',
              images: {
                create: imageUrls.map((url, idx) => ({
                  url,
                  originalUrl: url,
                  isPrimary: idx === 0,
                  order: idx,
                  variant: 'ORIGINAL' as const,
                })),
              },
            },
          });

          createdProductIds.push(product.id);
        } catch (err: any) {
          errors.push({
            rowNumber: row.rowNumber,
            message: err.code === 'P2002' 
              ? `SKU takrorlangan: ${(row.data as any).sku}` 
              : err.message || 'Nomaʼlum xato',
          });
        }
      }),
    );
  }

  return {
    successCount: createdProductIds.length,
    failedCount: errors.length,
    errors,
    createdProductIds,
  };
}

// ============================================
// Excel shablon yaratish
// ============================================

export function generateTemplate(withExamples: boolean = true): Buffer {
  const headers = [
    'title',
    'description',
    'category',
    'brand',
    'sku',
    'barcode',
    'basePrice',
    'currency',
    'stock',
    'imageUrl1',
    'imageUrl2',
    'imageUrl3',
    'imageUrl4',
    'imageUrl5',
  ];

  const examples = withExamples
    ? [
        {
          title: 'Erkaklar ko\'ylagi, katak, oq',
          description: 'Yuqori sifatli paxta ko\'ylak. Kunlik kiyim uchun ideal. Yumshoq mato, o\'lchamlar S-XL.',
          category: 'Kiyim-kechak',
          brand: 'CottonPro',
          sku: 'SHIRT-001',
          barcode: '1234567890123',
          basePrice: 150000,
          currency: 'UZS',
          stock: 50,
          imageUrl1: 'https://example.com/shirt-front.jpg',
          imageUrl2: 'https://example.com/shirt-back.jpg',
          imageUrl3: '',
          imageUrl4: '',
          imageUrl5: '',
        },
        {
          title: 'Bluetooth Naushnik, simsiz, qora',
          description: 'Yuqori sifatli tovush, 20 soat batareya, mikrofon bilan. iPhone va Android bilan mos.',
          category: 'Elektronika',
          brand: 'SoundMax',
          sku: 'HP-BT-002',
          barcode: '',
          basePrice: 320000,
          currency: 'UZS',
          stock: 25,
          imageUrl1: 'https://example.com/headphones.jpg',
          imageUrl2: '',
          imageUrl3: '',
          imageUrl4: '',
          imageUrl5: '',
        },
      ]
    : [];

  const worksheet = XLSX.utils.json_to_sheet(examples, { header: headers });

  // Ustun kengliklarini o'rnatish
  worksheet['!cols'] = [
    { wch: 40 }, // title
    { wch: 50 }, // description
    { wch: 20 }, // category
    { wch: 15 }, // brand
    { wch: 15 }, // sku
    { wch: 15 }, // barcode
    { wch: 12 }, // basePrice
    { wch: 10 }, // currency
    { wch: 8 },  // stock
    { wch: 40 }, // imageUrl1..5
    { wch: 40 },
    { wch: 40 },
    { wch: 40 },
    { wch: 40 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mahsulotlar');

  // Yo'riqnoma sheet
  const instructions = [
    { field: 'title', required: 'Ha', description: 'Mahsulot nomi (3-200 belgi)' },
    { field: 'description', required: 'Ha', description: 'Tavsif (10-5000 belgi)' },
    { field: 'category', required: 'Ha', description: 'Kategoriya nomi' },
    { field: 'brand', required: 'Yo\'q', description: 'Brend nomi' },
    { field: 'sku', required: 'Yo\'q', description: 'Ichki artikul (takrorlanmasligi kerak)' },
    { field: 'barcode', required: 'Yo\'q', description: 'Shtrix kod' },
    { field: 'basePrice', required: 'Ha', description: 'Narx (musbat son)' },
    { field: 'currency', required: 'Yo\'q', description: 'UZS / RUB / USD (default: UZS)' },
    { field: 'stock', required: 'Yo\'q', description: 'Zaxira miqdori (butun son)' },
    { field: 'imageUrl1..5', required: 'Yo\'q', description: 'Rasm URL manzillari (max 5)' },
  ];

  const instrSheet = XLSX.utils.json_to_sheet(instructions);
  instrSheet['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, instrSheet, 'Yo\'riqnoma');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
