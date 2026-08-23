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

export interface VisionFillResult {
  values: Record<string, string>;
  provider: 'openai' | 'gemini';
  notes: string[];
  /** Sarflangan tokenlar — xarajat hisobi uchun */
  tokensUsed: number;
}

/** Oxirgi chaqiruvda sarflangan token soni (xarajat hisobi uchun) */
let lastTokenUsage = 0;

/** AI to'ldira oladigan maydonlar */
function fillableFields(spec: MarketplaceSpec): SpecField[] {
  return allFields(spec).filter((f) => f.aiFillable);
}

function buildSystemPrompt(spec: MarketplaceSpec): string {
  return [
    `Sen ${spec.name} marketplace'i uchun mahsulot kartochkasini to'ldiradigan tajribali kontent menejersan.`,
    `Sotuvchi rasm yubordi. Rasmga qarab kartochka maydonlarini to'ldirasan.`,
    ``,
    `Qoidalar:`,
    `- Faqat rasmda ko'rinadigan narsaga asoslan. Ko'rinmasa — o'sha maydonni bo'sh satr ("") qoldir, o'ylab topma.`,
    `- Brend logotipi ko'rinmasa brendni taxmin qilma.`,
    `- Matn tili: ${spec.currency === 'UZS' ? "o'zbek tili (lotin)" : 'rus tili'}.`,
    `- Har bir maydonning belgi chegarasiga qat'iy rioya qil.`,
    `- Javob FAQAT JSON obyekt bo'lsin, boshqa hech narsa yozma.`,
  ].join('\n');
}

function buildFieldSpecText(fields: SpecField[]): string {
  return fields
    .map((f) => {
      const parts = [`"${f.key}" — ${f.label}`];
      if (f.type === 'number') parts.push('(faqat son)');
      if (f.maxLength) parts.push(`(max ${f.maxLength} belgi)`);
      if (f.options?.length) parts.push(`(faqat shulardan biri: ${f.options.join(' | ')})`);
      if (f.required) parts.push('[majburiy]');
      if (f.hint) parts.push(`— ${f.hint}`);
      return `- ${parts.join(' ')}`;
    })
    .join('\n');
}

function buildUserPrompt(
  spec: MarketplaceSpec,
  fields: SpecField[],
  hints: Record<string, string>,
): string {
  const hintLines = Object.entries(hints)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${v}`);

  return [
    `${spec.name} kartochkasi uchun quyidagi maydonlarni rasmga qarab to'ldir:`,
    ``,
    buildFieldSpecText(fields),
    ``,
    hintLines.length ? `Sotuvchi bergan qo'shimcha maʼlumot:\n${hintLines.join('\n')}` : '',
    ``,
    `Javob formati (aynan shu kalitlar bilan JSON):`,
    `{${fields.map((f) => `"${f.key}": "..."`).join(', ')}}`,
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
      max_tokens: 2000,
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
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
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
      const num = Number(String(value).replace(/[^\d.-]/g, ''));
      if (!Number.isFinite(num)) continue;
      values[field.key] = String(num);
      continue;
    }

    if (field.options?.length && !field.options.includes(value)) {
      // Yaqin variantni topishga urinamiz (registrga sezgir emas)
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
): Promise<VisionFillResult> {
  if (!imageUrls.length) throw new Error('Kamida bitta rasm kerak');

  const fields = fillableFields(spec);
  const systemPrompt = buildSystemPrompt(spec);
  const userPrompt = buildUserPrompt(spec, fields, hints);

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
  const { values, notes } = sanitize(fields, parsed);

  return { values, provider, notes, tokensUsed: lastTokenUsage };
}
