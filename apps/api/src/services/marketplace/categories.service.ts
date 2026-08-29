/**
 * Marketplace kategoriyalarini qidirish
 *
 * Nega alohida xizmat: uchala marketplace ham kartochka yaratishda RAQAMLI
 * kategoriya identifikatorini talab qiladi, sotuvchi esa faqat nomni biladi.
 * Har biri buni boshqacha nomlaydi va boshqacha beradi:
 *
 *   OZON   — description_category_id + type_id (ikkalasi ham majburiy).
 *            Butun daraxt bitta so'rovda keladi, qidiruv bizda.
 *   WB     — subjectID ("predmet"). Qidiruv WB tomonida (`name` parametri).
 *   YANDEX — marketCategoryId. Butun daraxt bitta so'rovda, qidiruv bizda.
 *
 * Ozon va Yandex daraxtlari katta (o'n minglab tugun) va kamdan-kam o'zgaradi,
 * shuning uchun ular tokenga bog'lab xotirada keshlanadi. WB'da esa kesh shart
 * emas — u qidiruvni o'zi bajaradi.
 */

import * as ozon from './ozon-api.service';
import * as wb from './wb-api.service';
import * as yandex from './yandex-api.service';
import { tokenId } from './rate-limit';
import { MarketplaceId } from './specs';

export interface CategoryOption {
  /** Marketplace'ga yuboriladigan asosiy ID */
  id: string;
  /** Ko'rinadigan nom */
  name: string;
  /** To'liq yo'l — bir xil nomli kategoriyalarni ajratish uchun */
  path: string;
  /** Ozon'da tovar turi; qolganlarida bo'lmaydi */
  typeId?: string;
}

export class CategoryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}

export interface CategoryCreds {
  apiKey: string;
  apiSecret?: string | null;
  shopId?: string | null;
}

// ─── KESH ────────────────────────────────────────────────

/** Daraxt kamdan-kam o'zgaradi, lekin bir kunda bir marta yangilanib tursin */
const TREE_TTL_MS = 12 * 60 * 60 * 1000;

interface CachedTree {
  options: CategoryOption[];
  expiresAt: number;
}

const treeCache = new Map<string, CachedTree>();
/** Bir vaqtda bir nechta so'rov kelsa daraxt bir marta yuklansin */
const inFlight = new Map<string, Promise<CategoryOption[]>>();

async function cachedTree(
  key: string,
  load: () => Promise<CategoryOption[]>,
): Promise<CategoryOption[]> {
  const hit = treeCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.options;

  const running = inFlight.get(key);
  if (running) return running;

  const promise = load()
    .then((options) => {
      treeCache.set(key, { options, expiresAt: Date.now() + TREE_TTL_MS });
      return options;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

// ─── OZON ────────────────────────────────────────────────

/**
 * Daraxtni tekis ro'yxatga yoyish.
 *
 * Bizga faqat "barg" kerak — ya'ni type_id bor tugunlar. Ularning ota-onasi
 * description_category_id ni beradi. Ikkalasi birga bo'lmasa Ozon kartochkani
 * qabul qilmaydi, shuning uchun juftlik topilmagan tugunlar tashlab yuboriladi.
 */
function flattenOzon(
  nodes: any[],
  trail: string[] = [],
  categoryId?: number,
  out: CategoryOption[] = [],
): CategoryOption[] {
  for (const node of nodes || []) {
    const isType = node?.type_id !== undefined && node?.type_id !== null;
    const label = String(node?.type_name || node?.category_name || '').trim();
    if (!label) continue;

    // Ozon o'chirilgan tugunlarni ham qaytaradi — ular yaroqsiz
    if (node?.disabled) continue;

    if (isType) {
      if (categoryId) {
        out.push({
          id: String(categoryId),
          typeId: String(node.type_id),
          name: label,
          path: [...trail, label].join(' › '),
        });
      }
      continue;
    }

    const nextCategoryId = node?.description_category_id
      ? Number(node.description_category_id)
      : categoryId;
    flattenOzon(node?.children, [...trail, label], nextCategoryId, out);
  }
  return out;
}

async function ozonOptions(creds: CategoryCreds): Promise<CategoryOption[]> {
  if (!creds.apiSecret) {
    throw new CategoryError(
      "Ozon uchun Client-Id kerak — Marketplace sozlamalarida 'Client-Id' maydonini to'ldiring",
    );
  }
  const ozonCreds = { apiKey: creds.apiKey, clientId: creds.apiSecret };
  const data: any = await ozon.getCategoryTree(ozonCreds);
  return flattenOzon(data?.result || []);
}

// ─── YANDEX ──────────────────────────────────────────────

/**
 * Yandex daraxti `children` bilan nestlangan. Faqat barglar tanlanadi:
 * oraliq tugunga tovar joylashtirib bo'lmaydi.
 */
function flattenYandex(
  nodes: any[],
  trail: string[] = [],
  out: CategoryOption[] = [],
): CategoryOption[] {
  for (const node of nodes || []) {
    const label = String(node?.name || '').trim();
    if (!label) continue;

    const children = node?.children;
    const path = [...trail, label];

    if (Array.isArray(children) && children.length) {
      flattenYandex(children, path, out);
      continue;
    }
    if (node?.id !== undefined && node?.id !== null) {
      out.push({ id: String(node.id), name: label, path: path.join(' › ') });
    }
  }
  return out;
}

async function yandexOptions(creds: CategoryCreds): Promise<CategoryOption[]> {
  const data: any = await yandex.getCategoriesTree(creds.apiKey);
  // Javob shakli versiyaga qarab farq qiladi — ikkalasini ham qabul qilamiz
  const root = data?.result?.children || data?.result?.categories || data?.result || [];
  return flattenYandex(Array.isArray(root) ? root : [root]);
}

// ─── WB ──────────────────────────────────────────────────

async function wbSearch(creds: CategoryCreds, query: string, limit: number): Promise<CategoryOption[]> {
  // WB qidiruvni o'z tomonida bajaradi, lekin aniq mos kelishni talab qiladi:
  // "рубашка" → 0 ta, "рубашк" → 5 ta (tekshirilgan). Shuning uchun unga
  // to'liq so'z emas, o'zak yuboriladi.
  const parts = stems(query);
  const head = parts[parts.length - 1];

  // WB o'zak bo'yicha keng ro'yxat qaytaradi ("плат" → Платья, Платки,
  // Платежные браслеты). Qaysi biri to'g'ri kelishini o'zimiz aniqlaymiz,
  // shuning uchun ko'proq so'rab, keyin tartiblaymiz.
  const rows = await wb.getSubjects(creds.apiKey, {
    name: head || undefined,
    limit: Math.min(limit * 4, 100),
  });

  const options = rows.map((r) => ({
    id: String(r.subjectID),
    name: r.subjectName,
    path: r.parentName ? `${r.parentName} › ${r.subjectName}` : r.subjectName,
  }));

  return query ? rank(options, query, limit) : options.slice(0, limit);
}

// ─── QIDIRUV ─────────────────────────────────────────────

/** Oddiy, diakritikaga chidamli taqqoslash */
function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/**
 * Ruscha so'zning o'zagini qoldirish.
 *
 * Nega kerak: kataloglar ko'plik shaklda yozilgan ("Рубашки"), sotuvchi esa
 * birlikda qidiradi ("рубашка"). Oddiy substring taqqoslash bunda 0 natija
 * beradi — tekshirdik, WB ham, Yandex ham shunday. Qo'shimchani kesib
 * tashlasak ("рубашк") ikkalasi ham topiladi.
 *
 * Bu to'liq morfologik tahlil emas va bo'lishi ham shart emas: qidiruv
 * natijasini kengaytirish xato natija berishdan ko'ra arzonroq.
 */
const RU_ENDINGS = [
  // Uch harfli — birinchi tekshiriladi, aks holda qisqasi ularni kesib qo'yadi
  'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими',
  // Ikki harfli. "ие"/"ии" ayniqsa muhim: мужские, женские, детские —
  // ularsiz "мужская рубашка" so'rovi o'zakka tushmasdi
  'ие', 'ии', 'ые', 'ый', 'ий', 'ая', 'ое', 'ых', 'их', 'ах', 'ях',
  'ам', 'ям', 'ой', 'ей', 'ов', 'ев', 'ья', 'ье', 'ем', 'ом',
  // Bir harfli
  'и', 'ы', 'а', 'я', 'е', 'у', 'ю', 'о', 'ь',
];

/** O'zak kamida shuncha belgidan iborat qolishi kerak — aks holda "мяч" → "мя" bo'lib ketadi */
const MIN_STEM = 4;

export function stem(word: string): string {
  if (word.length <= MIN_STEM) return word;
  for (const ending of RU_ENDINGS) {
    if (word.endsWith(ending) && word.length - ending.length >= MIN_STEM) {
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

/** So'rovni o'zaklarga ajratish — "мужская рубашка" → ["мужск", "рубашк"] */
function stems(query: string): string[] {
  return normalize(query)
    .split(' ')
    .filter(Boolean)
    .map(stem);
}

/**
 * So'rovdagi asosiy so'z — RUS TILIDA ODATDA OXIRGISI.
 *
 * "женские платья", "мужская рубашка", "детские кроссовки" — hamma joyda
 * ot oxirida turadi. Eng uzun so'zni tanlash noto'g'ri edi: "женские платья"
 * da "женские" "платья" dan uzun, natijada qidiruv "Прокладки женские" ni topardi.
 */
function headWord(parts: string[]): string {
  return parts[parts.length - 1] ?? '';
}

/** Ikki so'zning umumiy boshlanish uzunligi */
function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

/**
 * Nomdagi so'zlar ichidan berilgan o'zakka eng mos keladiganini topish.
 *
 * Nega oddiy `includes` yaramaydi: "платье" o'zagi "плат" bo'lib, u
 * "Платки" va "Платежные браслеты" ichida ham bor. Umumiy boshlanish
 * uzunligini o'lchasak, "Платья" (5 ta umumiy harf) "Платки" (4 ta) dan
 * yuqori chiqadi va to'g'ri javob birinchi bo'ladi.
 */
function bestWordMatch(text: string, stemmed: string): { length: number; atStart: boolean } {
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let best = 0;
  let atStart = false;

  words.forEach((word, index) => {
    const shared = commonPrefixLength(word, stemmed);
    if (shared > best) {
      best = shared;
      atStart = index === 0;
    } else if (shared === best && index === 0) {
      atStart = true;
    }
  });

  return { length: best, atStart };
}

/**
 * Keshlangan ro'yxatdan qidirish.
 *
 * Asosiy so'z (oxirgisi) topilishi shart, qolganlari faqat tartibni
 * aniqlaydi — kategoriya nomlarida jins yoki material ko'rsatilmasligi
 * mumkin, shuning uchun ularni majburiy qilib bo'lmaydi.
 */
function rank(options: CategoryOption[], query: string, limit: number): CategoryOption[] {
  // DIQQAT: bu yerda o'zak EMAS, to'liq so'z ishlatiladi.
  //
  // O'zak so'rovni juda qisqartiradi: "платье" → "плат", va shundan keyin
  // "Платья" ham, "Платки" ham, "Платежные браслеты" ham bir xil darajada
  // mos ko'rinadi. To'liq so'z bilan taqqoslasak umumiy boshlanish uzunligi
  // farq qiladi: "платье"↔"платья" = 5, "платье"↔"платки" = 4 —
  // ya'ni to'g'ri javob o'zi yuqoriga chiqadi.
  //
  // O'zak faqat WB'ning server tomonidagi qidiruvi uchun kerak (wbSearch).
  const parts = normalize(query).split(' ').filter(Boolean);
  if (!parts.length) return options.slice(0, limit);

  const head = parts[parts.length - 1];
  const rest = parts.slice(0, -1);
  const scored: Array<{ option: CategoryOption; score: number }> = [];

  for (const option of options) {
    const name = normalize(option.name);
    const nameHit = bestWordMatch(name, head);
    const pathHit = nameHit.length >= MIN_STEM ? nameHit : bestWordMatch(normalize(option.path), head);

    // O'zak to'liq topilmasa — bu boshqa narsa
    if (pathHit.length < Math.min(head.length, MIN_STEM)) continue;

    // Umumiy boshlanish qancha uzun bo'lsa, moslik shuncha aniq:
    // "плать" ↔ "платья" = 5, "плать" ↔ "платки" = 4
    let score = pathHit.length * 20;
    if (nameHit.length >= MIN_STEM) score += 40;
    if (nameHit.atStart && nameHit.length >= MIN_STEM) score += 60;

    for (const part of rest) {
      if (bestWordMatch(name, part).length >= Math.min(part.length, MIN_STEM)) score += 25;
      else if (bestWordMatch(normalize(option.path), part).length >= Math.min(part.length, MIN_STEM)) score += 10;
    }

    // Teng ballarni ajratish uchun — qisqaroq nom biroz ustun
    score -= Math.min(name.length, 60) / 30;

    scored.push({ option, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.option);
}

/**
 * Marketplace kategoriyalarini qidirish.
 *
 * Uzum bu ro'yxatda yo'q: uning Excel shablonida kategoriyani makros
 * o'zi to'ldiradi (E/F ustunlari), qo'lda yozish yuklashni buzadi.
 */
export async function searchCategories(
  marketplace: MarketplaceId,
  creds: CategoryCreds,
  { query = '', limit = 30 }: { query?: string; limit?: number } = {},
): Promise<CategoryOption[]> {
  const cacheKey = `${marketplace}:${tokenId(creds.apiKey)}`;

  switch (marketplace) {
    case 'OZON':
      return rank(await cachedTree(cacheKey, () => ozonOptions(creds)), query, limit);

    case 'YANDEX':
      return rank(await cachedTree(cacheKey, () => yandexOptions(creds)), query, limit);

    case 'WB':
      // WB qidiruvni o'zi bajaradi — keshlash faqat zarar qilardi
      return wbSearch(creds, query, limit);

    case 'UZUM':
    default:
      throw new CategoryError(
        "Uzum'da kategoriya Excel shablonidagi makros orqali tanlanadi — bu yerda ro'yxat yo'q",
      );
  }
}

/** Testlar uchun: keshni tozalash */
// ─── WB KATEGORIYA XARAKTERISTIKALARI (dinamik maydonlar) ───────────

export interface CharcField {
  /** WB charcID — publish'da shu bilan yuboriladi */
  id: number;
  name: string;
  /** 'number' → son (birlik bilan), 'string' → matn/ro'yxat */
  type: 'number' | 'string';
  required: boolean;
  /** Son birligi: см, г, л, шт. */
  unit?: string;
  /** Nechta qiymat: 0/1 — bitta, >1 — bir nechta */
  maxCount: number;
  /** WB " commonly used" deb belgilagan — formada oldinroq ko'rsatiladi */
  popular: boolean;
}

/**
 * Formada alohida qat'iy maydon bilan qoplangan xarakteristikalar — dinamik
 * bo'limda takrorlanmasligi uchun chiqarib tashlanadi (specs.ts WB maydonlari:
 * brand, color, composition, country, gender, season, contents, tnved +
 * paket габарит/вес top-level yuboriladi).
 */
const WB_COVERED_CHARCS = new Set([
  'бренд',
  'цвет',
  'состав',
  'страна производства',
  'пол',
  'сезон',
  'комплектация',
  'тнвэд',
  'тн вэд',
  'высота упаковки',
  'ширина упаковки',
  'длина упаковки',
  'вес товара с упаковкой',
  'вес товара без упаковки',
]);

/**
 * Xarakteristika nomini taqqoslash uchun kalit.
 *
 * WB nomni o'lchov birligi bilan beradi: "Вес товара с упаковкой (г)".
 * Qavsni olib tashlamasak, ro'yxatdagi "вес товара с упаковкой" bilan mos
 * kelmaydi va maydon dinamik formada takror chiqadi. Oqibati og'ir: WB
 * og'irlikni endi xarakteristika sifatida qabul qilmaydi va kartochkani
 * "weightBrutto in kilograms" xatosi bilan rad etadi.
 */
export function charcKey(name: string): string {
  return normalize(String(name || '').replace(/\([^)]*\)/g, ' '));
}

/** Shu xarakteristika formada alohida qat'iy maydon bilan qoplanganmi */
export function isCoveredCharc(name: string): boolean {
  return WB_COVERED_CHARCS.has(charcKey(name));
}

/**
 * Kategoriya (subjectID) uchun WB xarakteristikalari — dinamik forma uchun.
 * Qat'iy maydonlar bilan qoplanganlarini chiqarib tashlaydi, muhimlarini
 * (required → popular) oldinga qo'yadi.
 */
export async function getWbCharacteristics(apiKey: string, subjectId: number): Promise<CharcField[]> {
  const raw = await wb.getSubjectCharcs(apiKey, subjectId);
  const out: CharcField[] = [];
  for (const c of raw) {
    if (isCoveredCharc(String(c?.name || ''))) continue;
    out.push({
      id: c.charcID,
      name: c.name,
      type: c.charcType === 4 ? 'number' : 'string',
      required: !!c.required,
      unit: c.unitName || undefined,
      maxCount: Number(c.maxCount) || 1,
      popular: !!c.popular,
    });
  }
  out.sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      Number(b.popular) - Number(a.popular) ||
      a.name.localeCompare(b.name, 'ru'),
  );
  return out;
}

export function clearCategoryCache(): void {
  treeCache.clear();
  inFlight.clear();
}

// Ichki funksiyalarni testdan chaqirish uchun ochamiz
export const __internal = { flattenOzon, flattenYandex, rank, normalize, stem, stems, headWord, bestWordMatch };
