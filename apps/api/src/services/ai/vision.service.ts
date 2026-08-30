/**
 * Rasmga qarab marketplace kartochkasi maydonlarini to'ldirish
 *
 * OpenAI (gpt-4o-mini, vision) birinchi urinadi, xato bo'lsa Gemini'ga o'tadi.
 * Nima so'ralishi marketplace spec'idan olinadi — ya'ni Uzum uchun Uzum
 * maydonlari, WB uchun WB maydonlari so'raladi.
 */

import sharp from 'sharp';
import { MarketplaceSpec, SpecField, allFields } from '../marketplace/specs';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** gemini-1.5-* modellari to'xtatilgan — yangisini env orqali almashtirish mumkin */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/** AI ga yuboriladigan rasmning maksimal tomoni (token tejash uchun) */
const MAX_EDGE = 1024;

interface InlineImage {
  mimeType: string;
  base64: string;
}

/**
 * Rasmni AI ga yuborishga tayyorlash.
 *
 * URL yuborish o'rniga rasmni o'zimiz yuklab, kichraytirib, base64 qilamiz.
 * Sababi: rasm lokal saqlanganda (http://localhost:4000/uploads/...) OpenAI
 * yoki Google serverlari uni ocha olmaydi.
 */
async function toInlineImage(url: string): Promise<InlineImage> {
  if (url.startsWith('data:')) {
    const [header, data] = url.split(',');
    return { mimeType: header.slice(5).split(';')[0] || 'image/jpeg', base64: data };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rasmni olishda xato (${res.status}): ${url}`);

  const original = Buffer.from(await res.arrayBuffer());
  const resized = await sharp(original)
    .flatten({ background: '#FFFFFF' })
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return { mimeType: 'image/jpeg', base64: resized.toString('base64') };
}

/**
 * Kategoriyaga bog'liq dinamik xarakteristika (WB "предмет" maydonlari).
 * Spec'da yo'q — marketplace API'sidan kategoriya tanlangach keladi.
 */
export interface CharcSpec {
  id: number;
  name: string;
  type: 'number' | 'string';
  required: boolean;
  unit?: string;
  /** Nechta qiymat kiritish mumkin (1 dan katta bo'lsa vergul bilan) */
  maxCount: number;
  popular?: boolean;
  /** Ruxsat etilgan qiymatlar — bo'lsa AI faqat shulardan tanlaydi */
  options?: string[];
}

export interface VisionFillResult {
  values: Record<string, string>;
  /** Dinamik xarakteristikalar — kalit sifatida charc id (matn ko'rinishida) */
  charcValues: Record<string, string>;
  provider: 'openai' | 'gemini';
  notes: string[];
  /** Sarflangan tokenlar — xarajat hisobi uchun */
  tokensUsed: number;
}

/**
 * AI ga bir chaqiruvda yuboriladigan xarakteristika soni.
 *
 * WB ba'zi kategoriyalarda 100 dan ortiq maydon beradi — hammasini yuborish
 * promptni ham, hisobni ham shishiradi. Majburiy va ommabop maydonlar
 * birinchi, qolgani chegaragacha.
 */
const MAX_CHARCS_TO_ASK = 45;

/** Uzun matnli maydon (tavsif) uchun eng kam uzunlik */
const MIN_LONG_TEXT = 800;

/** Oxirgi chaqiruvda sarflangan token soni (xarajat hisobi uchun) */
let lastTokenUsage = 0;

/** AI to'ldira oladigan maydonlar */
function fillableFields(spec: MarketplaceSpec): SpecField[] {
  return allFields(spec).filter((f) => f.aiFillable);
}

function buildSystemPrompt(spec: MarketplaceSpec, includeLongText: boolean): string {
  return [
    `Sen ${spec.name} marketplace'i uchun mahsulot kartochkasini to'ldiradigan tajribali kontent menejersan.`,
    `Sotuvchi rasm yubordi. Rasmga qarab kartochka maydonlarini to'ldirasan.`,
    ``,
    `Qoidalar:`,
    `- Faqat rasmda ko'rinadigan narsaga asoslan. Ko'rinmasa — o'sha maydonni bo'sh satr ("") qoldir, o'ylab topma.`,
    `- Brend logotipi ko'rinmasa brendni taxmin qilma.`,
    `- Matn tili: ${spec.currency === 'UZS' ? "o'zbek tili (lotin)" : 'rus tili'}.`,
    `  Ba'zi maydonlarda til alohida ko'rsatilgan — o'sha yerda ko'rsatilgan tilda yoz.`,
    `  Ikki tilli juftliklarda (nomi RU / nomi UZ) matn TARJIMA bo'lsin, nusxa emas.`,
    `- Variantlari raqamlangan maydonlarda javob sifatida FAQAT raqamni yoz`,
    `  (masalan "2"), variant matnini emas. Mos variant bo'lmasa — bo'sh qoldir.`,
    `- Har bir maydonning belgi chegarasiga qat'iy rioya qil.`,
    ...(includeLongText
      ? [
          `- TAVSIF — eng muhim maydon: qidiruv shu matnga qarab topadi va u UZUN bo'lishi shart.`,
          `  Kamida ${MIN_LONG_TEXT} belgi yoz. Bu talab, tavsiya emas: qisqa tavsif qabul qilinmaydi.`,
          `  Tuzilishi — 4 ta xatboshi, har biri 3-4 gapdan:`,
          `  1) mahsulot nima va nimasi bilan ajralib turadi;`,
          `  2) material, sifat, tikuv/ishlanish tafsilotlari;`,
          `  3) kimga va qanday holatlarga mos, nima bilan kiyish/ishlatish mumkin;`,
          `  4) parvarish qoidasi, o'lcham tanlash bo'yicha maslahat, komplektatsiya.`,
        ]
      : []),
    `- Javob FAQAT JSON obyekt bo'lsin, boshqa hech narsa yozma.`,
  ].join('\n');
}

function buildFieldSpecText(fields: SpecField[]): string {
  return fields
    .map((f) => {
      const parts = [`"${f.key}" — ${f.label}`];
      if (f.type === 'number') parts.push('(faqat son)');
      if (f.lang) {
        // Uzum kartochkasida ruscha va o'zbekcha matn alohida ustunlarda.
        // Aytmasak model hammasini bitta tilda yozadi va ikkala ustunga
        // bir xil matn tushadi.
        parts.push(f.lang === 'ru' ? '(RUS TILIDA yoz)' : "(O'ZBEK TILIDA yoz)");
      }
      if (f.type === 'category') {
        // Raqamli javob qoidasi faqat variantlari sanab o'tilgan maydonlarga
        // tegishli. Model uni kategoriyaga ham qo'llab, "1" deb yozib
        // yuborardi — keyin bunday nom katalogdan topilmasdi.
        parts.push('(kategoriya NOMINI yoz, raqam emas)');
      }
      if (f.type === 'textarea' && (f.maxLength ?? 0) >= 1000) {
        parts.push(`(kamida ${MIN_LONG_TEXT} belgi, max ${f.maxLength})`);
      } else if (f.maxLength) {
        parts.push(`(max ${f.maxLength} belgi)`);
      }
      if (f.options?.length) {
        // Variant nomini yozdirish ishonchsiz: model ro'yxat o'zbekcha bo'lsa ham
        // ruscha javob berardi ("Мужчины") va qiymat yo'qolardi. Raqam esa tildan
        // xoli — model raqamni to'g'ri tanlaydi, nomni biz o'zimiz qo'yamiz.
        const numbered = f.options.map((o, i) => `${i}=${o}`).join(' | ');
        parts.push(`(javobni RAQAM bilan ber, faqat shulardan: ${numbered})`);
      }
      if (f.required) parts.push('[majburiy]');
      if (f.hint) parts.push(`— ${f.hint}`);
      return `- ${parts.join(' ')}`;
    })
    .join('\n');
}

/** Kategoriya xarakteristikalarini AI tushunadigan ro'yxatga aylantiradi */
function buildCharcSpecText(charcs: CharcSpec[]): string {
  return charcs
    .map((c) => {
      const parts = [`"${c.id}" — ${c.name}`];
      if (c.type === 'number') parts.push('(faqat son)');
      if (c.unit) parts.push(`(o'lchov: ${c.unit})`);
      if (c.maxCount > 1) parts.push(`(${c.maxCount} tagacha qiymat, vergul bilan)`);
      if (c.options?.length) {
        // Ro'yxatdan tashqari qiymat marketplace tomonidan qabul qilinmaydi
        parts.push(`(FAQAT shulardan: ${c.options.slice(0, 40).join(' | ')})`);
      }
      if (c.required) parts.push('[majburiy]');
      return `- ${parts.join(' ')}`;
    })
    .join('\n');
}

function buildUserPrompt(
  spec: MarketplaceSpec,
  fields: SpecField[],
  hints: Record<string, string>,
  charcs: CharcSpec[],
): string {
  const hintLines = Object.entries(hints)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${v}`);

  const charcBlock = charcs.length
    ? [
        ``,
        `KATEGORIYA XUSUSIYATLARI (${charcs.length} ta) — bularni to'ldir.`,
        `Kalit sifatida qavs ichidagi raqamni ishlat.`,
        `Rasmda to'g'ridan-to'g'ri ko'rinmasa ham, shu turdagi mahsulot uchun ODATIY`,
        `bo'lgan qiymatni yoz (tarkib, o'lcham turi, taxminiy og'irlik kabi) —`,
        `sotuvchi keyin tekshirib to'g'rilaydi, bo'sh maydon esa kartochkani rad ettiradi.`,
        `Faqat taxmin qilib bo'lmaydiganini (sertifikat raqami, sana, artikul) bo'sh qoldir.`,
        ``,
        buildCharcSpecText(charcs),
      ].join('\n')
    : '';

  // Faqat xususiyatlar so'ralganda asosiy maydonlar haqida umuman gapirmaymiz:
  // ortiqcha ta'rif AI e'tiborini bo'ladi va tokenni bekorga yeydi.
  const fieldBlock = fields.length
    ? [
        `${spec.name} kartochkasi uchun quyidagi maydonlarni rasmga qarab to'ldir:`,
        ``,
        buildFieldSpecText(fields),
      ].join('\n')
    : `${spec.name} kartochkasining kategoriya xususiyatlarini rasmga qarab to'ldir.`;

  const answerShape = [
    fields.length
      ? `  "fields": {${fields
          .map((f) =>
            f.type === 'textarea' && (f.maxLength ?? 0) >= 1000
              ? `"${f.key}": "(kamida ${MIN_LONG_TEXT} belgi, 4 xatboshi)"`
              : `"${f.key}": "..."`,
          )
          .join(', ')}},`
      : '',
    `  "charcs": {${charcs.length ? '"<xususiyat raqami>": "qiymat"' : ''}}`,
  ].filter(Boolean);

  return [
    fieldBlock,
    charcBlock,
    ``,
    hintLines.length ? `Sotuvchi bergan qo'shimcha maʼlumot:\n${hintLines.join('\n')}` : '',
    ``,
    `Javob formati (aynan shu tuzilishda JSON):`,
    `{`,
    ...answerShape,
    `}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ============================================
// OpenAI vision
// ============================================

async function callOpenAIVision(
  systemPrompt: string,
  userPrompt: string,
  images: InlineImage[],
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY .env da yo'q");

  const content: any[] = [{ type: 'text', text: userPrompt }];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'low' },
    });
  }

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI vision xato (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as any;
  lastTokenUsage = data.usage?.total_tokens ?? 0;
  return data.choices?.[0]?.message?.content ?? '';
}

// ============================================
// Gemini vision (fallback)
// ============================================

async function callGeminiVision(
  systemPrompt: string,
  userPrompt: string,
  images: InlineImage[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY .env da yo'q");

  const res = await fetch(`${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: 'user',
          parts: [
            { text: userPrompt },
            ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
        // 2.5 modellari javobdan oldin "o'ylash" tokenlarini yeydi va javob
        // yarim kesilib qoladi — bu yerda o'ylash kerak emas.
        ...(GEMINI_MODEL.includes('2.5')
          ? { thinkingConfig: { thinkingBudget: Number(process.env.GEMINI_THINKING_BUDGET ?? 0) } }
          : {}),
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini vision xato (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as any;
  lastTokenUsage = data.usageMetadata?.totalTokenCount ?? 0;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ============================================
// Javobni tozalash
// ============================================

function parseJson(raw: string): Record<string, any> {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI javobini JSON sifatida o'qib bo'lmadi");
  }
}

/**
 * Matndan sonni ajratadi, ajrata olmasa null.
 *
 * Number('') === 0 — shuning uchun faqat Number.isFinite() ni tekshirish
 * yetmaydi: AI og'irlik o'rniga "og'ir" desa, tozalangandan keyin bo'sh satr
 * qoladi va u jimgina 0 ga aylanadi. Marketplace'ga nol og'irlik ketishi
 * kartochkani rad ettiradi yoki yetkazib berish narxini buzadi.
 */
function toNumberOrNull(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.-]/g, '');
  if (!/\d/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Xarakteristika qiymatlarini tozalash.
 *
 * AI raqam so'ralgan joyga matn ("qora"), yoki maxCount 2 bo'lgan joyga beshta
 * qiymat yozib yuborishi mumkin — ikkalasini ham marketplace rad etadi.
 */
function sanitizeCharcs(charcs: CharcSpec[], parsed: Record<string, any>) {
  const charcValues: Record<string, string> = {};
  const notes: string[] = [];
  if (!charcs.length) return { charcValues, notes };

  for (const charc of charcs) {
    let value = parsed?.[String(charc.id)];
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) value = value.join(', ');
    value = String(value).trim();
    if (!value || value.toLowerCase() === 'null' || value === '-') continue;

    if (charc.options?.length) {
      const match = charc.options.find(
        (o) => o.toLowerCase() === value.toLowerCase() || o.toLowerCase().includes(value.toLowerCase()),
      );
      if (!match) {
        notes.push(`"${charc.name}" uchun AI "${value}" dedi — ro'yxatda yo'q, o'zingiz tanlang`);
        continue;
      }
      charcValues[String(charc.id)] = match;
      continue;
    }

    if (charc.type === 'number') {
      const num = toNumberOrNull(String(value));
      if (num === null) {
        notes.push(`"${charc.name}" son bo'lishi kerak — AI "${value}" dedi, o'tkazib yuborildi`);
        continue;
      }
      charcValues[String(charc.id)] = String(num);
      continue;
    }

    if (charc.maxCount > 1) {
      const parts = String(value)
        .split(',')
        .map((v: string) => v.trim())
        .filter(Boolean);
      if (parts.length > charc.maxCount) {
        notes.push(`"${charc.name}" uchun ${charc.maxCount} tagacha qiymat mumkin — ortiqchasi olib tashlandi`);
      }
      charcValues[String(charc.id)] = parts.slice(0, charc.maxCount).join(', ');
      continue;
    }

    charcValues[String(charc.id)] = value;
  }

  const numericFilled = charcs.filter(
    (c) => c.type === 'number' && charcValues[String(c.id)] !== undefined,
  );
  if (numericFilled.length) {
    notes.push(
      `Raqamli xususiyatlar taxminiy (${numericFilled.map((c) => c.name).join(', ')}) — jo'natishdan oldin tekshiring`,
    );
  }

  return { charcValues, notes };
}

/** AI qaytargan qiymatlarni spec chegaralariga moslash */
function sanitize(fields: SpecField[], parsed: Record<string, any>) {
  const values: Record<string, string> = {};
  const notes: string[] = [];

  for (const field of fields) {
    let value = parsed[field.key];
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) value = value.join(', ');
    value = String(value).trim();
    if (!value || value.toLowerCase() === 'null' || value === '-') continue;

    if (field.type === 'number') {
      const num = toNumberOrNull(String(value));
      if (num === null) {
        notes.push(`"${field.label}" son bo'lishi kerak — AI "${value}" dedi, o'tkazib yuborildi`);
        continue;
      }
      values[field.key] = String(num);
      continue;
    }

    if (field.options?.length && !field.options.includes(value)) {
      // Avval raqam: prompt aynan shuni so'raydi
      const index = /^\d+$/.test(value) ? Number(value) : -1;
      if (index >= 0 && index < field.options.length) {
        values[field.key] = field.options[index];
        continue;
      }

      // Raqam kelmasa — yaqin variantni topishga urinamiz (registrga sezgir emas)
      const match = field.options.find(
        (o) => o.toLowerCase() === value.toLowerCase() || o.toLowerCase().includes(value.toLowerCase()),
      );
      if (!match) {
        notes.push(`"${field.label}" uchun AI "${value}" dedi — ro'yxatda yo'q, o'zingiz tanlang`);
        continue;
      }
      value = match;
    }

    if (field.maxLength && value.length > field.maxLength) {
      value = value.slice(0, field.maxLength).trim();
      notes.push(`"${field.label}" ${field.maxLength} belgigacha qisqartirildi`);
    }

    values[field.key] = value;
  }

  return { values, notes };
}

// ============================================
// Asosiy funksiya
// ============================================

export async function fillFieldsFromImages(
  imageUrls: string[],
  spec: MarketplaceSpec,
  hints: Record<string, string> = {},
  allCharcs: CharcSpec[] = [],
  /** 'charcs' — faqat kategoriya xususiyatlari (o'sha bo'limdagi tugma uchun) */
  scope: 'all' | 'charcs' = 'all',
  /**
   * Kategoriyaga bog'liq variantlar (maydon kaliti → ruxsat etilgan qiymatlar).
   * TN VED shunday: ro'yxat spec'da yo'q, WB dan predmetga qarab keladi.
   * Ro'yxat berilsa AI erkin yozmaydi — faqat shundan tanlaydi.
   */
  dynamicOptions: Record<string, string[]> = {},
): Promise<VisionFillResult> {
  if (!imageUrls.length) throw new Error('Kamida bitta rasm kerak');
  if (scope === 'charcs' && !allCharcs.length) {
    throw new Error("Bu kategoriyada to'ldiriladigan xususiyat yo'q");
  }

  const fields = (scope === 'charcs' ? [] : fillableFields(spec))
    .map((field) => {
      const options = dynamicOptions[field.key];
      return options?.length ? { ...field, options } : field;
    })
    // Ro'yxatdan tanlanadigan maydon (TN VED), lekin ro'yxat kelmagan bo'lsa
    // (kategoriya hali tanlanmagan) — AI dan so'ramaymiz. Aks holda u kodni
    // o'ylab topadi va yarim qiymat yozadi ("6105"), keyin uni tozalash kerak
    // bo'ladi. Kategoriya aniqlangach kod baribir server tomonda tanlanadi.
    .filter((field) => !(field.optionsFrom && !field.options?.length));

  // Majburiy → ommabop → qolgani tartibida, chegaragacha
  const ordered = [...allCharcs].sort((a, b) => {
    const weight = (c: CharcSpec) => (c.required ? 0 : c.popular ? 1 : 2);
    return weight(a) - weight(b);
  });
  const charcs = ordered.slice(0, MAX_CHARCS_TO_ASK);

  const wantsLongText = fields.some((f) => f.type === 'textarea' && (f.maxLength ?? 0) >= 1000);
  const systemPrompt = buildSystemPrompt(spec, wantsLongText);
  const userPrompt = buildUserPrompt(spec, fields, hints, charcs);

  // Rasmlarni bir marta tayyorlaymiz — ikkala provayder ham shuni ishlatadi
  const images = await Promise.all(imageUrls.slice(0, 4).map(toInlineImage));

  let raw: string;
  let provider: 'openai' | 'gemini' = 'openai';

  try {
    raw = await callOpenAIVision(systemPrompt, userPrompt, images);
  } catch (openaiErr) {
    console.warn("OpenAI vision ishlamadi, Gemini'ga o'tildi:", (openaiErr as Error).message);
    try {
      raw = await callGeminiVision(systemPrompt, userPrompt, images);
      provider = 'gemini';
    } catch (geminiErr) {
      throw new Error(
        `AI to'ldirish ishlamadi. OpenAI: ${(openaiErr as Error).message} | Gemini: ${(geminiErr as Error).message}`,
      );
    }
  }

  const parsed = parseJson(raw);

  // Yangi javob {fields, charcs} ko'rinishida. Model eski (yassi) shaklda
  // qaytarib qo'ysa ham ishlayveradi — kartochka to'ldirish to'xtab qolmasin.
  const fieldPart = parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : parsed;
  const charcPart = parsed.charcs && typeof parsed.charcs === 'object' ? parsed.charcs : {};

  const { values, notes } = sanitize(fields, fieldPart);

  // Bojxona kodi — sotuvchining javobgarligi. AI faqat WB ruxsat etgan
  // ro'yxatdan tanlaydi, ya'ni kartochka rad etilmaydi; lekin ro'yxat ichida
  // qaysi kod aynan to'g'ri ekani tovar tarkibiga bog'liq.
  if (dynamicOptions.tnved?.length && values.tnved) {
    notes.push(`TN VED kodini AI tanladi (${values.tnved}) — bojxona uchun tekshirib qo'ying`);
  }
  const { charcValues, notes: charcNotes } = sanitizeCharcs(charcs, charcPart);

  if (allCharcs.length > charcs.length) {
    charcNotes.push(
      `Kategoriyada ${allCharcs.length} ta xususiyat bor — AI eng muhim ${charcs.length} tasini to'ldirdi, qolganini o'zingiz kiriting`,
    );
  }

  return {
    values,
    charcValues,
    provider,
    notes: [...notes, ...charcNotes],
    tokensUsed: lastTokenUsage,
  };
}

/** Testlar uchun — tashqaridan chaqirilmaydi */
export const __internal = { sanitizeCharcs, buildCharcSpecText, toNumberOrNull, buildUserPrompt, buildSystemPrompt };
