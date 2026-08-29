/**
 * WB lug'ati — o'zbekcha variantni WB kutadigan qiymatga o'girish.
 *
 * Muammo: formadagi tanlov ro'yxatlari o'zbekcha ("Erkaklar", "Turkiya",
 * "Yoz"), WB esa o'z lug'atidagi ruscha qiymatni kutadi. "Erkaklar" deb
 * yuborsak, kartochka YARATILADI — lekin WB kabinetida o'sha katak qizil
 * bo'lib qoladi ("Gender") va tovar sotuvga chiqmaydi. Xato bizga
 * qaytmaydi, shuning uchun uni faqat kabinetga kirib ko'rish mumkin edi.
 *
 * Yechim: WB ning o'z ma'lumotnomasidan (directory) ro'yxat olinadi va
 * bizning variant unga taqqoslanadi. Aniq nomni qattiq yozib qo'ymaymiz —
 * WB uni o'zgartirsa ham moslik topiladi. Ma'lumotnoma o'qilmasa, eng
 * ehtimolli ruscha nom yuboriladi: bu ham o'zbekchadan yaxshiroq.
 */

import * as wb from './wb-api.service';

export type WbDirectory = 'kinds' | 'seasons' | 'countries' | 'colors';

/**
 * Bizning variant → WB da uchraydigan nomlar.
 * Birinchisi eng ehtimollisi: ma'lumotnoma o'qilmasa o'sha yuboriladi.
 */
const ALIASES: Record<string, string[]> = {
  // Jinsi (kinds)
  erkaklar: ['Мужской', 'Мужчинам', 'Мужчины'],
  ayollar: ['Женский', 'Женщинам', 'Женщины'],
  unisex: ['Унисекс'],
  bolalar: ['Детский', 'Детям', 'Дети'],
  "o'g'il bolalar": ['Мальчики', 'Для мальчиков', 'Детский'],
  'qiz bolalar': ['Девочки', 'Для девочек', 'Детский'],

  // Mavsum (seasons)
  yoz: ['лето', 'Лето', 'летний'],
  qish: ['зима', 'Зима', 'зимний'],
  'demi-mavsum': ['демисезон', 'Демисезон', 'демисезонный'],
  'barcha mavsum': ['всесезон', 'Всесезон', 'круглогодичный'],

  // Davlat (countries)
  "o'zbekiston": ['Узбекистан'],
  xitoy: ['Китай'],
  turkiya: ['Турция'],
  rossiya: ['Россия'],
  "qozog'iston": ['Казахстан'],
  'janubiy koreya': ['Южная Корея', 'Корея, Республика', 'Республика Корея'],
  yaponiya: ['Япония'],
  germaniya: ['Германия'],
  italiya: ['Италия'],
  aqsh: ['США', 'Соединенные Штаты Америки'],
  hindiston: ['Индия'],
  vetnam: ['Вьетнам'],
  bangladesh: ['Бангладеш'],
  polsha: ['Польша'],
};

/**
 * WB da MAVJUD BO'LMAGAN qiymatlar.
 *
 * Ma'lumotnomaga suyanish yetarli emas: WB so'rov limiti tez-tez uriladi va
 * ro'yxat o'qilmay qolsa zaxira yo'l taxminiy ruscha nomni yuborardi —
 * "Унисекс" aynan shunday o'tib ketgan va kabinetda "Invalid value in the
 * Gender field" bergan. WB kinds ro'yxatida atigi 5 qiymat bor
 * (Мужской, Женский, Детский, Девочки, Мальчики), unisex esa yo'q.
 *
 * Bu ro'yxatdagilar hech qachon yuborilmaydi — internet ham, limit ham
 * ta'sir qilmaydi.
 */
const WB_UNSUPPORTED = new Set(['unisex', 'унисекс']);

function norm(text: string): string {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Shu o'zbekcha qiymat uchun WB da bo'lishi mumkin bo'lgan nomlar */
export function candidatesFor(uzValue: string): string[] {
  const key = norm(uzValue);
  const known = ALIASES[key];
  if (known) return known;
  // Ro'yxatda yo'q (masalan "Boshqa" yoki qo'lda yozilgan qiymat) —
  // o'zini qaytaramiz: WB ruscha yozilgan bo'lsa mos kelishi mumkin
  return [uzValue];
}

/** WB javobidan nomlar ro'yxatini ajratadi (ba'zi ma'lumotnomalar obyekt qaytaradi) */
export function extractNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') out.push(item);
    else if (item && typeof item === 'object') {
      const name = (item as any).name ?? (item as any).fullName ?? (item as any).value;
      if (typeof name === 'string') out.push(name);
    }
  }
  return out;
}

/** Ma'lumotnoma ro'yxatidan mos nomni topadi (aynan WB yozgan holicha) */
export function pickFromDirectory(candidates: string[], names: string[]): string | null {
  const byNorm = new Map(names.map((n) => [norm(n), n]));
  for (const candidate of candidates) {
    const hit = byNorm.get(norm(candidate));
    if (hit) return hit;
  }
  return null;
}

interface CacheEntry {
  names: string[];
  expiresAt: number;
}

/** Ma'lumotnomalar kunlab o'zgarmaydi — har joylashda qayta so'ramaymiz */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

async function directoryNames(apiKey: string, directory: WbDirectory): Promise<string[]> {
  const key = `${directory}:${apiKey.slice(-8)}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.names;

  const names = extractNames(await wb.getDirectory(apiKey, directory));
  if (names.length) cache.set(key, { names, expiresAt: Date.now() + CACHE_TTL_MS });
  return names;
}

export interface WbValueResult {
  /**
   * WB ga yuboriladigan qiymat. `null` — yuborilmasin: ma'lumotnoma o'qildi,
   * lekin bu qiymat unda yo'q. Bunday qiymatni yuborish kartochkani
   * kabinetda qizil xatoga aylantiradi ("Invalid value in the Gender field").
   */
  value: string | null;
  /** Ma'lumotnomadan tasdiqlanganmi */
  verified: boolean;
  /** Sotuvchiga aytiladigan eslatma */
  note?: string;
}

/**
 * O'zbekcha variantni WB qiymatiga o'giradi.
 * Hech qachon exception otmaydi — joylash shu sababdan to'xtamasin.
 */
export async function toWbValue(
  apiKey: string,
  directory: WbDirectory,
  uzValue: string,
): Promise<WbValueResult> {
  if (WB_UNSUPPORTED.has(norm(uzValue))) {
    return {
      value: null,
      verified: false,
      note: `"${uzValue}" WB da mavjud emas — bu maydon yuborilmadi. Aniq jinsni tanlang (erkaklar, ayollar, bolalar)`,
    };
  }

  const candidates = candidatesFor(uzValue);

  try {
    const names = await directoryNames(apiKey, directory);
    if (names.length) {
      const match = pickFromDirectory(candidates, names);
      if (match) return { value: match, verified: true };

      // Ro'yxat o'qildi va bu qiymat unda YO'Q — taxmin qilib yubormaymiz.
      // Yaroqsiz qiymat kartochkani kabinetda qizil qiladi va tovar sotuvga
      // chiqmaydi; maydonni bo'sh qoldirish esa zarar qilmaydi.
      return {
        value: null,
        verified: false,
        note: `"${uzValue}" WB ro'yxatida yo'q — bu maydon yuborilmadi. Kabinetdan mos qiymatni tanlang`,
      };
    }
  } catch (err: any) {
    // Ma'lumotnoma o'qilmadi (ruxsat yoki limit) — taxminiy nom bilan davom etamiz
    return {
      value: candidates[0],
      verified: false,
      note: `WB ma'lumotnomasi o'qilmadi (${err?.message ?? 'xato'}) — "${candidates[0]}" yuborildi`,
    };
  }

  return { value: candidates[0], verified: false };
}

/**
 * Tarmoqsiz o'girish — Excel eksporti uchun.
 *
 * Excel fayli sinxron quriladi va u yerda WB kalitini so'rash imkoni yo'q.
 * Shuning uchun statik jadval ishlatiladi: "Erkaklar" -> "Мужской".
 * WB da mavjud bo'lmagan qiymat ('Unisex') bo'sh qaytariladi — Excel'ga
 * yaroqsiz qiymat yozib qo'yish sotuvchini yuklashda xatoga olib boradi.
 */
export function staticWbValue(uzValue: string): string {
  const text = String(uzValue ?? '').trim();
  if (!text) return '';
  if (WB_UNSUPPORTED.has(norm(text))) return '';
  return candidatesFor(text)[0] ?? '';
}

/** Testlar uchun */
export function clearWbDictionaryCache(): void {
  cache.clear();
}
