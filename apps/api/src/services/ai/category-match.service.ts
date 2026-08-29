/**
 * AI aytgan kategoriya nomini marketplace katalogidagi haqiqiy kategoriyaga
 * bog'laydi.
 *
 * Nega kerak: AI "Футболки" deb yozadi, lekin joylash uchun nom emas, ID
 * kerak. Sotuvchi esa katalogdan qidirib topishi shart edi — bir bosishda
 * to'ldirish shu yerda uzilardi. Ustiga nom yaqin bo'lsa ham to'g'ri
 * bo'lmasligi mumkin: polo uchun "Футболки" emas, "Футболки-поло" kerak,
 * va noto'g'ri predmet TN VED bilan xarakteristikalarni ham buzadi.
 *
 * Ikki bosqich:
 *   1. Katalogdan nom bo'yicha nomzodlar olinadi;
 *   2. Aynan mos kelsa — o'sha; bo'lmasa nomzodlar AI ga raqamlangan
 *      ro'yxat bo'lib beriladi va u mahsulot nomiga qarab bittasini tanlaydi.
 *
 * AI faqat ro'yxatdagi raqamni qaytaradi, ya'ni katalogda yo'q kategoriya
 * paydo bo'lishi mumkin emas.
 */

import { callOpenAI } from './openai.service';
import { callGemini } from './gemini.service';
import type { CategoryOption } from '../marketplace/categories.service';

function norm(text: string): string {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export interface CategoryMatch {
  option: CategoryOption;
  /** Aynan nom bo'yicha topildimi (AI ishlatilmadi) */
  exact: boolean;
}

/** Nomzodlardan aynan mos keladiganini topadi */
export function exactMatch(name: string, options: CategoryOption[]): CategoryOption | null {
  const target = norm(name);
  return options.find((o) => norm(o.name) === target) ?? null;
}

const SYSTEM_PROMPT = `Sen marketplace kataloglarini yaxshi biladigan kontent menejersan.
Senga mahsulot haqida ma'lumot va raqamlangan ro'yxat beriladi.
Sen faqat bitta raqam qaytarasan — eng mos variant raqami.
Hech qanday izoh, matn yoki tinish belgisi yozma. Mos variant bo'lmasa -1 yoz.`;

/**
 * Ro'yxatdan bittasini tanlaydi (matnli, arzon chaqiruv).
 *
 * Raqam so'raladi, nom emas: model ro'yxatdagi matnni qayta yozib yuborsa
 * moslik yo'qolardi. Raqam esa tildan xoli va tekshirish oson.
 * Hech qachon exception otmaydi — null qaytaradi.
 */
export async function chooseFromList(context: string, items: string[]): Promise<number | null> {
  if (!items.length) return null;
  if (items.length === 1) return 0;

  const prompt = `${context}\n\nRo'yxat:\n${items
    .map((item, i) => `${i} = ${item}`)
    .join('\n')}\n\nEng mos variant raqamini yoz (faqat raqam):`;

  let raw: string | null = null;
  try {
    raw = (
      await callOpenAI(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        { temperature: 0, maxTokens: 10 },
      )
    ).content;
  } catch {
    try {
      raw = (await callGemini(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0 })).content;
    } catch {
      return null;
    }
  }

  return parseChoice(raw, items.length);
}

/** Javobdan raqamni ajratadi. Yaroqsiz bo'lsa null. */
export function parseChoice(raw: string, count: number): number | null {
  const match = String(raw ?? '').match(/-?\d+/);
  if (!match) return null;
  const index = Number(match[0]);
  if (!Number.isInteger(index) || index < 0 || index >= count) return null;
  return index;
}

/**
 * Kategoriyani tanlaydi. AI chaqiruvi faqat aynan moslik bo'lmaganda ketadi.
 * Hech qachon exception otmaydi — to'ldirish shu sababdan to'xtamasin.
 */
export async function matchCategory(
  productTitle: string,
  aiCategoryName: string,
  options: CategoryOption[],
): Promise<CategoryMatch | null> {
  if (!options.length) return null;

  const exact = exactMatch(aiCategoryName, options);

  // Bitta nomzod bo'lsa tanlashning ma'nosi yo'q
  if (options.length === 1) return { option: options[0], exact: !!exact };

  // DIQQAT: aynan nom mosligi o'z-o'zidan g'olib emas. AI kategoriya nomini
  // umumiy yozishi mumkin ("Футболки"), katalogda esa aniqrog'i bor
  // ("Футболки-поло"). Shuning uchun nomzodlar baribir mahsulot nomiga
  // qarab tanlanadi; aynan moslik faqat tanlov ishlamaganda ishlatiladi.

  const shortlist = options.slice(0, 30);
  const index = await chooseFromList(
    `Mahsulot: ${productTitle}`,
    shortlist.map((o) => (o.path && o.path !== o.name ? `${o.name} (${o.path})` : o.name)),
  );
  if (index === null) return exact ? { option: exact, exact: true } : null;
  return { option: shortlist[index], exact: shortlist[index].id === exact?.id };
}

/**
 * TN VED kodini tanlaydi.
 *
 * Nega alohida funksiya: kodlar — quruq 10 xonali raqamlar. Ularni oddiy
 * "raqamni tanla" so'rovi bilan bersak (javob uchun 10 token), model
 * o'ylashga joy topmay tasodifiy kod beradi — sinovda poloni ayollar
 * ko'ylagi kodiga (6104...) qo'yib yubordi. Shuning uchun kodning o'zi
 * so'raladi, javobga joy beriladi va natija ro'yxatga solishtiriladi.
 */
export async function chooseTnved(
  productContext: string,
  codes: string[],
): Promise<string | null> {
  if (!codes.length) return null;
  if (codes.length === 1) return codes[0];

  const system = `Sen bojxona TN VED (HS) kodlarini biladigan mutaxassissan.
Senga mahsulot tavsifi va ruxsat etilgan kodlar ro'yxati beriladi.

Birinchi 4 raqam — tovar turi:
6104 — ayollar ko'ylagi/kostyumi, 6105 — erkaklar ko'ylagi (trikotaj),
6106 — ayollar bluzkasi (trikotaj), 6109 — futbolka/mayka, 6110 — sviter/jemper.

Keyingi raqamlar — MATERIAL. Buni tarkibga qarab tanlaysan:
...10 — paxtadan, ...20 — sintetik tolalardan, ...30 — sun'iy tolalardan,
...90 — boshqa materiallardan. Tarkib "100% хлопок" bo'lsa paxta kodini olasan,
"boshqa material" kodini emas.

Faqat ro'yxatdagi kodlardan birini tanlaysan.
Javob faqat JSON: {"tnved": "<kod>"}`;

  const prompt = `${productContext}

Ruxsat etilgan kodlar:
${codes.join(', ')}

Shu mahsulotga eng mos kodni tanla.`;

  let raw: string | null = null;
  try {
    raw = (
      await callOpenAI(
        [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        { temperature: 0, maxTokens: 120, jsonMode: true },
      )
    ).content;
  } catch {
    try {
      raw = (await callGemini(prompt, { systemInstruction: system, temperature: 0, jsonMode: true })).content;
    } catch {
      return null;
    }
  }

  const match = String(raw ?? '').match(/\d{10}/);
  const picked = match?.[0];
  // Ro'yxatda yo'q kodni qabul qilmaymiz — WB baribir rad etardi
  return picked && codes.includes(picked) ? picked : null;
}
