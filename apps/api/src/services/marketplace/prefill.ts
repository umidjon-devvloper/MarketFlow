/**
 * Mavjud kartochkadan boshqa marketplace uchun maydonlarni tayyorlash
 *
 * Sotuvchi Uzum uchun kartochka to'ldirgan bo'lsa, Ozon uchun hammasini
 * qaytadan yozishi shart emas: umumiy maydonlar ko'chiriladi, faqat
 * farq qiladiganlari so'raladi.
 *
 * Ikki nozik joy bor:
 *  1. O'lchov birliklari har xil — Uzum/Ozon qadoqni mm da, WB/Yandex sm da
 *     so'raydi; og'irlik Uzum/Ozon/WB da gramm, Yandex da kilogramm.
 *     Ko'chirishda qiymat o'giriladi, aks holda 10-1000 barobar xato bo'lardi.
 *  2. Belgi chegaralari har xil — Uzum nomi 100 belgi, WB niki atigi 60.
 *     Bunday holatda jimgina qisqartirmaymiz, "ko'rib chiqing" deb belgilaymiz.
 */

import { MarketplaceSpec, SpecField, allFields, findField } from './specs';

export interface ReviewNote {
  key: string;
  label: string;
  reason: string;
}

export interface PrefillResult {
  values: Record<string, string>;
  /** Ko'chirilgan maydon kalitlari */
  copied: string[];
  /** Ko'chirildi, lekin tekshirish kerak */
  needsReview: ReviewNote[];
  /** Majburiy, lekin to'ldirilmagan */
  missing: Array<{ key: string; label: string }>;
}

/**
 * Turli marketplace'larda BIR XIL narsani anglatuvchi, lekin boshqacha
 * nomlangan maydonlar.
 *
 * Masalan Uzum va Ozon "Material" deb so'raydi, WB esa aynan shu narsani
 * "Состав" (composition) deb ataydi. Kalitlar mos kelmagani uchun qiymat
 * ko'chmasdi va WB kartochkasi har doim "Tarkib to'ldirilmagan" bo'lib
 * qolardi — sotuvchi esa uni allaqachon yozgan bo'lardi.
 *
 * Ro'yxat ataylab qisqa: faqat haqiqatan bir xil ma'noli juftliklar.
 * Taxminiy moslashtirish noto'g'ri ma'lumot ko'chirishga olib keladi.
 */
const FIELD_SYNONYMS: Record<string, string[]> = {
  composition: ['material'],
  material: ['composition'],
};

/** Bir birlikdan ikkinchisiga o'girish koeffitsienti (topilmasa null) */
function conversionFactor(from?: string, to?: string): number | null {
  if (!from || !to || from === to) return null;

  const table: Record<string, number> = {
    'mm->sm': 0.1,
    'sm->mm': 10,
    'g->kg': 0.001,
    'kg->g': 1000,
    'oy->yil': 1 / 12,
    'yil->oy': 12,
  };

  return table[`${from}->${to}`] ?? null;
}

/** Sonni ortiqcha kasrsiz ko'rsatish */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/**
 * Manba qiymatlarni maqsad marketplace maydonlariga moslash.
 *
 * @param sourceValues  eski kartochkaning `attributes.values` i
 * @param sourceSpec    eski kartochka qaysi marketplace uchun edi (birlik o'girish uchun)
 * @param productFields Product jadvalidagi ustunlar (title, basePrice, ...)
 * @param targetSpec    yangi marketplace
 */
export function prefillForMarketplace(
  sourceValues: Record<string, any>,
  sourceSpec: MarketplaceSpec | null,
  productFields: Record<string, any>,
  targetSpec: MarketplaceSpec,
): PrefillResult {
  const values: Record<string, string> = {};
  const copied: string[] = [];
  const needsReview: ReviewNote[] = [];

  const empty = (value: unknown) =>
    value === undefined || value === null || String(value).trim() === '';

  for (const target of allFields(targetSpec)) {
    let raw = sourceValues[target.key];

    // Boshqacha nomlangan, lekin bir xil ma'noli maydonni sinaymiz
    if (empty(raw)) {
      for (const alias of FIELD_SYNONYMS[target.key] ?? []) {
        if (!empty(sourceValues[alias])) {
          raw = sourceValues[alias];
          break;
        }
      }
    }

    // Manbada bo'lmasa — Product ustunidan olishga urinamiz
    if (empty(raw) && target.mapsTo) {
      raw = productFields[target.mapsTo];
    }

    if (raw === undefined || raw === null || String(raw).trim() === '') continue;

    let text = String(raw).trim();

    // --- Sonlar: birlikni o'girish ---
    if (target.type === 'number') {
      const source: SpecField | undefined = sourceSpec ? findField(sourceSpec, target.key) : undefined;
      const factor = conversionFactor(source?.unit, target.unit);
      const num = Number(text.replace(',', '.'));

      if (!Number.isFinite(num)) continue;

      if (factor !== null) {
        text = formatNumber(num * factor);
        needsReview.push({
          key: target.key,
          label: target.label,
          reason: `${source?.unit} → ${target.unit} ga o'girildi (${formatNumber(num)} → ${text})`,
        });
      } else {
        text = formatNumber(num);
      }

      values[target.key] = text;
      copied.push(target.key);
      continue;
    }

    // --- Ro'yxatdan tanlanadigan maydonlar ---
    if (target.options?.length && !target.options.includes(text)) {
      const match = target.options.find((o) => o.toLowerCase() === text.toLowerCase());
      if (!match) {
        needsReview.push({
          key: target.key,
          label: target.label,
          reason: `"${text}" bu marketplace ro'yxatida yo'q — o'zingiz tanlang`,
        });
        continue;
      }
      text = match;
    }

    // --- Belgi chegarasi ---
    if (target.maxLength && text.length > target.maxLength) {
      needsReview.push({
        key: target.key,
        label: target.label,
        reason: `${targetSpec.name} ${target.maxLength} belgi so'raydi, matn ${text.length} ta — qisqartiring`,
      });
      // Qiymatni saqlaymiz, lekin qisqartirmaymiz — qaror sotuvchiniki
    }

    values[target.key] = text;
    copied.push(target.key);
  }

  const missing = allFields(targetSpec)
    .filter((f) => f.required && !String(values[f.key] ?? '').trim())
    .map((f) => ({ key: f.key, label: f.label }));

  return { values, copied, needsReview, missing };
}
