/**
 * Marketplace formatidagi Excel eksport
 *
 * Har bir marketplace o'z shablonida boshqa ustun nomlarini kutadi —
 * ustun sarlavhalari specs.ts dagi `excelHeader` dan olinadi.
 *
 * Fayl 3 ta varaqdan iborat:
 *   1. <Marketplace> — yuklanadigan maʼlumot (ustun tartibi spec bo'yicha)
 *   2. Rasm talablari — moslashtirilgan rasmlarning o'lchami/soni
 *   3. Yo'riqnoma — qaysi maydon nima, qayerga yuklash kerak
 */

import * as XLSX from 'xlsx';
import { MarketplaceSpec, allFields } from '../marketplace/specs';

export interface ExportRow {
  values: Record<string, any>;
  imageUrls: string[];
}

const MAX_IMAGE_COLUMNS = 10;

export function buildMarketplaceWorkbook(spec: MarketplaceSpec, rows: ExportRow[]): Buffer {
  // Yashirin maydonlar (kategoriya ID'lari) faqat API uchun — marketplace
  // shablonida bunday ustun yo'q, qo'shsak yuklash xato beradi
  const fields = allFields(spec).filter((f) => !f.hidden);
  const imageColumns = Math.min(
    Math.max(1, ...rows.map((r) => r.imageUrls.length)),
    Math.min(spec.image.maxCount, MAX_IMAGE_COLUMNS),
  );

  const headers = [
    ...fields.map((f) => f.excelHeader),
    ...Array.from({ length: imageColumns }, (_, i) => `Rasm ${i + 1}`),
  ];

  const data = rows.map((row) => {
    const record: Record<string, any> = {};

    for (const field of fields) {
      const raw = row.values[field.key];
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        record[field.excelHeader] = '';
        continue;
      }
      record[field.excelHeader] = field.type === 'number' ? Number(raw) : String(raw);
    }

    for (let i = 0; i < imageColumns; i++) {
      record[`Rasm ${i + 1}`] = row.imageUrls[i] || '';
    }

    return record;
  });

  const sheet = XLSX.utils.json_to_sheet(data, { header: headers });
  sheet['!cols'] = [
    ...fields.map((f) => ({
      wch: f.type === 'textarea' ? 60 : f.excelHeader.length + 6,
    })),
    ...Array.from({ length: imageColumns }, () => ({ wch: 45 })),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, spec.sheetName);

  // 2-varaq: rasm talablari
  const imageInfo = [
    { Parametr: "O'lcham (tavsiya)", Qiymat: `${spec.image.targetWidth}×${spec.image.targetHeight} px` },
    { Parametr: 'Minimal o‘lcham', Qiymat: `${spec.image.minWidth}×${spec.image.minHeight} px` },
    { Parametr: 'Nisbat', Qiymat: spec.image.aspectRatio },
    { Parametr: 'Fon', Qiymat: spec.image.background },
    { Parametr: 'Format', Qiymat: spec.image.formats.join(', ') },
    { Parametr: 'Maksimal hajm', Qiymat: `${spec.image.maxSizeMB} MB` },
    { Parametr: 'Rasm soni', Qiymat: `${spec.image.minCount}–${spec.image.maxCount}` },
    ...spec.image.notes.map((note, i) => ({ Parametr: `Eslatma ${i + 1}`, Qiymat: note })),
  ];
  const imageSheet = XLSX.utils.json_to_sheet(imageInfo);
  imageSheet['!cols'] = [{ wch: 22 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, imageSheet, 'Rasm talablari');

  // 3-varaq: yo'riqnoma
  const instructions = [
    { Ustun: '— YO‘RIQNOMA —', Majburiy: '', Izoh: spec.uploadHint },
    ...fields.map((f) => ({
      Ustun: f.excelHeader,
      Majburiy: f.required ? 'Ha' : "Yo'q",
      Izoh: [
        f.label,
        f.maxLength ? `max ${f.maxLength} belgi` : '',
        f.unit ? `birlik: ${f.unit}` : '',
        f.options?.length ? `variantlar: ${f.options.join(' | ')}` : '',
        f.hint || '',
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    {
      Ustun: 'Rasm 1..N',
      Majburiy: 'Ha',
      Izoh: `${spec.name} talabiga moslashtirilgan rasm URL manzillari (${spec.image.targetWidth}×${spec.image.targetHeight})`,
    },
  ];
  const instrSheet = XLSX.utils.json_to_sheet(instructions);
  instrSheet['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, instrSheet, "Yo'riqnoma");

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/** Yuklab olinadigan fayl nomi */
export function exportFileName(spec: MarketplaceSpec, count: number): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${spec.id.toLowerCase()}-${count}-mahsulot-${stamp}.xlsx`;
}
