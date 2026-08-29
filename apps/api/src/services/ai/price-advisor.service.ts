/**
 * AI narx maslahatchisi
 *
 * Ikkita savolga javob beradi:
 *   1. "Bu mahsulotni qanchaga qo'yay?" — pastki, tavsiya etilgan va yuqori narx.
 *   2. "Men qo'ygan narx bozorga to'g'ri keladimi?" — arzon / mos / qimmat xulosasi.
 *
 * VALYUTA — bu yerdagi eng qimmat xato manbai. Narx doim marketplace ishlaydigan
 * bitta valyutada bo'ladi (Uzum → UZS, WB/Ozon/Yandex → RUB). AI ga kurs ham,
 * boshqa valyutadagi raqam ham berilmaydi va undan valyuta almashtirish
 * so'ralmaydi: 250 000 UZS bilan 2 500 RUB ni aralashtirib yuborish — sotuvchini
 * zararga olib boradigan xato. Javobdagi raqamlar shu valyutada deb qabul
 * qilinadi, boshqa valyutadagi raqobatchilar prompt'ga umuman qo'shilmaydi.
 *
 * Raqobatchi narxlari bo'lsa (CompetitorWatch'dan), ular prompt'ga kiradi —
 * shunda javob umumiy taxminga emas, real raqamga tayanadi. Bo'lmasa AI buni
 * ochiq aytadi va ishonch darajasi pasayadi.
 */

import { callOpenAI } from './openai.service';
import { callGemini } from './gemini.service';

export type Confidence = 'low' | 'medium' | 'high';
export type VerdictLevel = 'low' | 'ok' | 'high';

export interface CompetitorPrice {
  label: string;
  price: number;
  currency: string;
  title?: string | null;
}

export interface PriceAdviceInput {
  /** Marketplace nomi — prompt uchun ("Wildberries") */
  marketplaceName: string;
  /** Faqat shu valyuta ishlatiladi */
  currency: 'UZS' | 'RUB';
  title: string;
  brand?: string;
  category?: string;
  /** Rang, material, o'lcham kabi to'ldirilgan maydonlar */
  attributes?: Record<string, string>;
  /** Sotuvchi qo'lda kiritgan narx — bo'lsa, unga baho beriladi */
  currentPrice?: number;
  /** Tannarx (bo'lsa, zarar chiqmasligini tekshiramiz) */
  costPrice?: number;
  competitors?: CompetitorPrice[];
}

export interface PriceAdvice {
  currency: string;
  /** Tavsiya etilgan oraliq */
  min: number;
  recommended: number;
  max: number;
  summary: string;
  /** Narxga ta'sir qilgan omillar — sotuvchi nega shunday ekanini ko'rsin */
  factors: string[];
  /** Sotuvchi kiritgan narxga baho (narx berilgan bo'lsa) */
  verdict: { level: VerdictLevel; message: string } | null;
  confidence: Confidence;
  /** Ma'lumot yetishmasligi kabi ogohlantirishlar */
  warnings: string[];
  provider: 'openai' | 'gemini';
  tokensUsed: number;
}

const SYSTEM_PROMPT = `Sen marketplace narx tahlilchisisan. Sotuvchiga mahsulotini qanchaga qo'yishni maslahat berasan.

Qoidalar:
- Javob FAQAT so'ralgan valyutada bo'ladi. Valyutani almashtirmaysan, kurs ishlatmaysan, boshqa valyutadagi raqam yozmaysan.
- Narxlar butun son bo'lsin (tiyin/kopeyka yo'q).
- Berilgan raqobatchi narxlari bo'lsa, birinchi navbatda ularga tayanasan.
- min, recommended va max HAR DOIM son bo'ladi — null, bo'sh yoki matn bo'lishi mumkin emas. Ma'lumot kam bo'lsa ham eng yaxshi taxminingni son qilib berasan.
- Raqobatchi ma'lumoti bo'lmasa, buni warnings da ochiq aytasan va confidence ni "low" qilasan — lekin baribir son berasan.
- Tannarx berilgan bo'lsa, tavsiya etilgan narx undan past bo'lishi mumkin emas.
- "recommended" — bozorga qarab bergan tavsiyang.
- Sodda o'zbek tilida yozasan, sotuvchi tushunadigan qilib.
- Javob faqat JSON, boshqa hech narsa yo'q.`;

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value))} ${currency}`;
}

function buildUserPrompt(input: PriceAdviceInput): string {
  const attrs = Object.entries(input.attributes || {})
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  // Boshqa valyutadagi raqobatchi umuman tushmaydi — taqqoslash bir valyutada
  const rivals = (input.competitors || []).filter((c) => c.currency === input.currency);

  const rivalText = rivals.length
    ? rivals
        .map((c) => `- ${c.label || c.title || 'raqobatchi'}: ${money(c.price, input.currency)}`)
        .join('\n')
    : "Raqobatchi narxlari yo'q (kuzatuvga havola qo'shilmagan).";

  return `Marketplace: ${input.marketplaceName}
Valyuta: ${input.currency} — javobdagi hamma raqam shu valyutada bo'lsin.

MAHSULOT:
- Nomi: ${input.title || "ko'rsatilmagan"}
- Brend: ${input.brand || "ko'rsatilmagan"}
- Kategoriya: ${input.category || "ko'rsatilmagan"}
${attrs || '- qo\'shimcha xususiyat kiritilmagan'}

${input.costPrice ? `TANNARX: ${money(input.costPrice, input.currency)} — tavsiya shundan past bo'lmasin.` : "TANNARX: kiritilmagan."}

RAQOBATCHI NARXLARI:
${rivalText}

Javobni AYNAN shu JSON formatida ber:
{
  "min": <eng past mantiqiy narx, son>,
  "recommended": <tavsiya etilgan narx, son>,
  "max": <eng yuqori mantiqiy narx, son>,
  "summary": "2-3 gapda: bozorda bu mahsulot qanaqa narxda turadi va nega shu narx tavsiya qilinyapti",
  "factors": ["narxga ta'sir qilgan omil 1", "omil 2", "omil 3"],
  "confidence": "low|medium|high",
  "warnings": ["ma'lumot yetishmasa shu yerda ayt"]
}`;
}

function parseJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

/** AI qaytargan raqamni ishonchli songa aylantiradi. Yaroqsiz bo'lsa null. */
function toPrice(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * Sotuvchi narxiga xulosa — AI emas, kod chiqaradi.
 *
 * Nega: sotuvchining narxini promptga qo'shsak, model o'sha raqamga yopishib
 * qoladi va "narxingiz qimmat" deb turib, tavsiya sifatida o'sha narxning
 * o'zini qaytaradi. Endi model narxni umuman ko'rmaydi — bozor oralig'ini
 * mustaqil beradi, xulosani esa oraliq bilan taqqoslab biz yozamiz. Shunda
 * xulosa hech qachon tavsiyaga zid bo'lmaydi.
 */
function judgePrice(
  price: number | undefined,
  range: { min: number; recommended: number; max: number },
  currency: string,
): { level: VerdictLevel; message: string } | null {
  if (!price) return null;

  if (price > range.max) {
    const pct = Math.round(((price - range.max) / range.max) * 100);
    return {
      level: 'high',
      message: `Narxingiz bozor oralig'idan ${pct}% yuqori. Sotuv sekinlashadi — ${money(range.recommended, currency)} atrofiga tushirib ko'ring.`,
    };
  }

  if (price < range.min) {
    const pct = Math.round(((range.min - price) / range.min) * 100);
    return {
      level: 'low',
      message: `Narxingiz bozor oralig'idan ${pct}% past. Bu narxda foyda qolmasligi mumkin — ${money(range.recommended, currency)} gacha ko'tarsangiz bo'ladi.`,
    };
  }

  return {
    level: 'ok',
    message: `Narxingiz bozor oralig'ida (${money(range.min, currency)} … ${money(range.max, currency)}). O'zgartirish shart emas.`,
  };
}

/**
 * AI javobini tozalaydi.
 *
 * Model ba'zan min/max ni almashtirib yuboradi yoki tavsiyani oraliqdan
 * tashqarida beradi — bunday javobni foydalanuvchiga ko'rsatib bo'lmaydi,
 * shuning uchun tartibga solamiz. Tannarxdan past tavsiya ham to'g'rilanadi.
 */
export function normalizeAdvice(
  parsed: any,
  input: PriceAdviceInput,
): Omit<PriceAdvice, 'provider' | 'tokensUsed'> {
  const warnings: string[] = Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : [];

  const nums = [toPrice(parsed?.min), toPrice(parsed?.recommended), toPrice(parsed?.max)];
  if (nums.some((n) => n === null)) {
    throw new Error('AI narx qaytarmadi — qayta urinib ko\'ring');
  }

  const sorted = (nums as number[]).slice().sort((a, b) => a - b);
  let [min, recommended, max] = sorted;

  // Tannarxdan past sotish — zarar. Oraliqni yuqoriga suramiz va ogohlantiramiz.
  if (input.costPrice && recommended < input.costPrice) {
    warnings.push(
      `AI tavsiyasi tannarxdan past edi (${money(recommended, input.currency)}) — tannarx darajasiga ko'tarildi`,
    );
    min = Math.max(min, input.costPrice);
    recommended = input.costPrice;
    max = Math.max(max, input.costPrice);
  }

  const verdict = judgePrice(input.currentPrice, { min, recommended, max }, input.currency);

  let confidence: Confidence = ['low', 'medium', 'high'].includes(parsed?.confidence)
    ? parsed.confidence
    : 'low';

  const rivals = (input.competitors || []).filter((c) => c.currency === input.currency);
  if (!rivals.length) {
    warnings.push(
      "Raqobatchi narxlari yo'q — tavsiya faqat AI bilimiga tayanadi. Aniqroq bo'lishi uchun \"Raqobatchilar\" bo'limiga havola qo'shing.",
    );
    // Real raqam bo'lmasa "ishonch yuqori" deb ko'rsatish sotuvchini chalg'itadi:
    // u taxminni tekshirilgan ma'lumot deb qabul qiladi.
    confidence = 'low';
  }

  return {
    currency: input.currency,
    min,
    recommended,
    max,
    summary: String(parsed?.summary || ''),
    factors: Array.isArray(parsed?.factors) ? parsed.factors.slice(0, 5).map(String) : [],
    verdict,
    confidence,
    warnings,
  };
}

export async function suggestPrice(input: PriceAdviceInput): Promise<PriceAdvice> {
  const userPrompt = buildUserPrompt(input);

  const providers: Array<{
    name: 'openai' | 'gemini';
    run: () => Promise<{ content: string; tokens: number }>;
  }> = [
    {
      name: 'openai',
      run: () =>
        callOpenAI(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          { jsonMode: true, temperature: 0.3, maxTokens: 1200 },
        ),
    },
    {
      name: 'gemini',
      run: () =>
        callGemini(userPrompt, {
          systemInstruction: SYSTEM_PROMPT,
          jsonMode: true,
          temperature: 0.3,
          maxTokens: 2000,
        }),
    },
  ];

  const failures: string[] = [];
  let tokensUsed = 0;

  // Ikkinchi provayderga faqat chaqiruv YIQILGANDA emas, javob YARAMAGANDA ham
  // o'tamiz: model JSON qaytarib, ichida narx bermasligi ham xuddi shunday
  // muvaffaqiyatsizlik. Avval shu holatda foydalanuvchi boshi berk ko'chaga
  // kirib qolardi.
  for (const provider of providers) {
    try {
      const result = await provider.run();
      tokensUsed += result.tokens;
      try {
        return {
          ...normalizeAdvice(parseJson(result.content), input),
          provider: provider.name,
          tokensUsed,
        };
      } catch (badAnswer) {
        failures.push(`${provider.name}: ${(badAnswer as Error).message}`);
      }
    } catch (callFailed) {
      failures.push(`${provider.name}: ${(callFailed as Error).message}`);
    }
  }

  throw new Error(`AI narx tavsiyasi olinmadi — ${failures.join(' | ')}`);
}
