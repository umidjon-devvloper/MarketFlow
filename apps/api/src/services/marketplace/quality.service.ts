/**
 * Kartochka sifat bahosi (0–100)
 *
 * Nega kerak: marketplace'larning o'zi kartochkani to'ldirilganligi bo'yicha
 * baholaydi (WB "рейтинг заполненности", Ozon "контент-рейтинг") va shu
 * reyting qidiruvdagi o'ringa, ya'ni bevosita sotuvga ta'sir qiladi. Sotuvchi
 * kartochkani saqlashdan oldin "yaxshimi yoki yo'q" ni bilishi kerak — Excel
 * yuklaб yoki API'ga jo'natgandan keyin emas.
 *
 * Baho aynan marketplace mukofotlaydigan narsalarga qaratilgan:
 *   rasm soni · nom sifati · tavsif to'liqligi · majburiy va qo'shimcha
 *   xususiyatlar. Har omil o'z vaznига ega va yig'indisi 100 ni beradi.
 *
 * Sof funksiya — bazaga ham, tarmoqqa ham tegmaydi, shuning uchun to'liq
 * test qilinadi va istalgan joyda (saqlashdan oldin, ro'yxatda) ishlatiladi.
 */

import { MarketplaceSpec, SpecField, allFields } from './specs';

export interface QualityFactor {
  key: string;
  label: string;
  /** Shu omil bo'yicha to'plangan ball */
  points: number;
  /** Shu omilning maksimal balli */
  max: number;
  /** To'liq / qisman / bo'sh — UI rangi uchun */
  status: 'ok' | 'partial' | 'empty';
  /** Nimani yaxshilash kerak (to'liq bo'lsa bo'sh) */
  hint?: string;
}

export interface QualityScore {
  /** 0–100 */
  score: number;
  /** Umumiy baho darajasi */
  grade: 'zaif' | 'o‘rtacha' | 'yaxshi' | 'a‘lo';
  factors: QualityFactor[];
  /** Eng ko'p ball qo'shadigan keyingi qadam (bo'lsa) */
  topSuggestion?: string;
}

/** Omillar va ularning vazni — yig'indisi 100 */
const WEIGHTS = {
  images: 25,
  title: 15,
  description: 20,
  required: 25,
  optional: 15,
} as const;

function empty(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Rasmlar (25 ball).
 *
 * Ko'proq rasm — yuqori konversiya, marketplace ham shuni mukofotlaydi.
 * "Yetarli" nuqta minimal sondan yuqori: bitta rasm kartochkani ochadi,
 * lekin uni "to'liq" qilmaydi. Tavsiya etilgan nuqta — maksimalning yarmi
 * yoki kamida 4 ta (qaysi biri kichik bo'lsa).
 */
function scoreImages(imageCount: number, spec: MarketplaceSpec): QualityFactor {
  const max = WEIGHTS.images;
  const sweet = Math.max(spec.image.minCount + 2, Math.min(4, spec.image.maxCount));

  let points = 0;
  let status: QualityFactor['status'] = 'empty';
  let hint: string | undefined;

  if (imageCount === 0) {
    hint = 'Kamida bitta rasm yuklang — rasmsiz kartochka ko‘rinmaydi';
  } else if (imageCount >= sweet) {
    points = max;
    status = 'ok';
  } else {
    // Chiziqli: minCount da yarim ball, sweet nuqtada to'liq
    const ratio = imageCount / sweet;
    points = Math.round(max * Math.max(0.4, ratio));
    status = 'partial';
    hint = `Yana rasm qo‘shing — ${sweet} ta bo‘lsa to‘liq baho (hozir ${imageCount})`;
  }

  return { key: 'images', label: 'Rasmlar', points, max, status, hint };
}

/**
 * Matn maydoni sifati (nom yoki tavsif).
 *
 * Faqat "bor/yo'q" emas: juda qisqa nom sotuvga yordam bermaydi. To'liq ball
 * uchun matn absolyut chegaradan (nom ~40, tavsif ~150 belgi) oshishi kerak.
 */
function scoreText(
  key: 'title' | 'description',
  label: string,
  text: string,
  maxLength: number | undefined,
  weight: number,
): QualityFactor {
  if (empty(text)) {
    return {
      key,
      label,
      points: 0,
      max: weight,
      status: 'empty',
      hint: `${label} to‘ldirilmagan`,
    };
  }

  const len = text.trim().length;
  // "Yaxshi" chegara ABSOLYUT, foiz emas: WB tavsifi 5000 belgigacha, lekin
  // 35% (1750 belgi) real emas — yaxshi tavsif ~150 belgi. Nom uchun ~40 belgi
  // (tur + brend + xususiyat sig'adi). Chegara kichik bo'lsa unga tenglashadi.
  const target = key === 'title' ? 40 : 150;
  const limit = maxLength ?? (key === 'title' ? 100 : 2000);
  const good = Math.min(target, limit);

  if (len >= good) {
    return { key, label, points: weight, max: weight, status: 'ok' };
  }

  // Qisqa — yarim ball va maslahat
  return {
    key,
    label,
    points: Math.round(weight * 0.5),
    max: weight,
    status: 'partial',
    hint:
      key === 'title'
        ? 'Nomni to‘ldiring: tur + brend + asosiy xususiyat'
        : `Tavsifni kengaytiring — kamida ${good} belgi qidiruvga yordam beradi`,
  };
}

/** Ro'yxatdagi maydonlarning nechtasi to'ldirilgan — nisbatga qarab ball */
function scoreFieldGroup(
  key: string,
  label: string,
  fields: SpecField[],
  values: Record<string, any>,
  weight: number,
  emptyHint: string,
): QualityFactor {
  if (!fields.length) {
    // Bu marketplace'da bunday maydon yo'q — to'liq deb hisoblaymiz
    return { key, label, points: weight, max: weight, status: 'ok' };
  }

  const filled = fields.filter((f) => !empty(values[f.key]));
  const ratio = filled.length / fields.length;
  const points = Math.round(weight * ratio);

  const missing = fields.filter((f) => empty(values[f.key])).map((f) => f.label);

  let status: QualityFactor['status'] = 'partial';
  if (ratio >= 0.999) status = 'ok';
  else if (ratio === 0) status = 'empty';

  return {
    key,
    label,
    points,
    max: weight,
    status,
    hint:
      status === 'ok'
        ? undefined
        : `${emptyHint}: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`,
  };
}

function grade(score: number): QualityScore['grade'] {
  if (score >= 90) return 'a‘lo';
  if (score >= 70) return 'yaxshi';
  if (score >= 45) return 'o‘rtacha';
  return 'zaif';
}

/**
 * Kartochkani baholash.
 *
 * @param spec       qaysi marketplace talablari bo'yicha
 * @param values     kartochka maydonlari (attributes.values yoki byMarketplace)
 * @param imageCount yuklangan rasmlar soni
 */
export function scoreCard(
  spec: MarketplaceSpec,
  values: Record<string, any>,
  imageCount: number,
): QualityScore {
  // Yashirin maydonlar (kategoriya ID) sotuvchi ko'radigan sifatga kirmaydi —
  // ularni tanlagich to'ldiradi, forma sifatini ular bilan pasaytirmaymiz
  const visible = allFields(spec).filter((f) => !f.hidden);

  const titleField = visible.find((f) => f.key === 'title' || f.mapsTo === 'title');
  const descField = visible.find((f) => f.key === 'description' || f.mapsTo === 'description');

  // Nom va tavsif alohida baholanadi — qolgan majburiy/qo'shimcha guruhlaridan chiqaramiz
  const special = new Set(['title', 'description', titleField?.key, descField?.key]);
  const rest = visible.filter((f) => !special.has(f.key));

  const requiredFields = rest.filter((f) => f.required);
  const optionalFields = rest.filter((f) => !f.required);

  const factors: QualityFactor[] = [
    scoreImages(imageCount, spec),
    scoreText('title', 'Nom', String(values[titleField?.key ?? 'title'] ?? ''), titleField?.maxLength, WEIGHTS.title),
    scoreText(
      'description',
      'Tavsif',
      String(values[descField?.key ?? 'description'] ?? ''),
      descField?.maxLength,
      WEIGHTS.description,
    ),
    scoreFieldGroup('required', 'Majburiy maydonlar', requiredFields, values, WEIGHTS.required, 'To‘ldiring'),
    scoreFieldGroup(
      'optional',
      'Qo‘shimcha xususiyatlar',
      optionalFields,
      values,
      WEIGHTS.optional,
      'Filtrlarda ko‘rinish uchun',
    ),
  ];

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));

  // Eng ko'p ball beradigan keyingi qadam — sotuvchi nimadan boshlashini bilsin
  const topGap = factors
    .filter((f) => f.hint)
    .sort((a, b) => b.max - b.points - (a.max - a.points))[0];

  return {
    score,
    grade: grade(score),
    factors,
    topSuggestion: topGap?.hint,
  };
}

export const __internal = { WEIGHTS, scoreImages, scoreText, grade };
