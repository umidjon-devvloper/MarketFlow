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
import { uzumCategories } from '../export/uzum-template.service';

/** Uzum katalogi — shablon ichidagi Лист2 dan */
function uzumCategoryOptions(template?: Buffer): CategoryOption[] {
  return uzumCategories(template).map((c) => ({ id: c.id, name: c.title, path: c.path }));
}

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
  /** Uzum: katalog sotuvchining o'z shabloni ichidan o'qiladi */
  template?: Buffer;
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
  // "Платья" ham, "Платки" ham bir xil darajada mos ko'rinadi. To'liq so'z
  // bilan umumiy boshlanish uzunligi farq qiladi va to'g'ri javob o'zi
  // yuqoriga chiqadi.
  //
  // Ilgari bu yerda faqat OXIRGI so'z bo'yicha saralanardi. Ruscha
  // kategoriyalarda esa asosiy so'z boshida turadi: "Футболка поло мужская"
  // so'rovi "мужская" bo'yicha saralanib, natijada "Электробритвы мужские"
  // yuqoriga chiqar, "Поло для взрослых" esa 30 talik ro'yxatga umuman
  // tushmasdi. Endi HAR BIR so'z bo'yicha alohida saralanadi va natijalar
  // aralashtiriladi — to'g'ri javob ro'yxatga albatta tushadi, qaysi biri
  // ekanini esa AI tanlaydi.
  const parts = normalize(query).split(' ').filter((p) => p.length >= 2);
  if (!parts.length) return options.slice(0, limit);

  const scoreFor = (option: CategoryOption, head: string): number => {
    const name = normalize(option.name);
    const nameHit = bestWordMatch(name, head);
    const pathHit = nameHit.length >= MIN_STEM ? nameHit : bestWordMatch(normalize(option.path), head);
    if (pathHit.length < Math.min(head.length, MIN_STEM)) return 0;

    let score = pathHit.length * 20;
    if (nameHit.length >= MIN_STEM) score += 40;
    if (nameHit.atStart && nameHit.length >= MIN_STEM) score += 60;

    // Qolgan so'zlar — qo'shimcha dalil
    for (const part of parts) {
      if (part === head) continue;
      if (bestWordMatch(name, part).length >= Math.min(part.length, MIN_STEM)) score += 25;
      else if (bestWordMatch(normalize(option.path), part).length >= Math.min(part.length, MIN_STEM)) score += 10;
    }

    // Teng ballarni ajratish uchun — qisqaroq nom biroz ustun
    return score - Math.min(name.length, 60) / 30;
  };

  // Har so'z uchun alohida reyting
  const perWord = parts.map((head) => {
    const scored: Array<{ option: CategoryOption; score: number }> = [];
    for (const option of options) {
      const score = scoreFor(option, head);
      if (score > 0) scored.push({ option, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  });

  // Navbat bilan olamiz: har so'zning eng yaxshisi ro'yxatga tushsin
  const chosen = new Map<string, number>();
  for (let i = 0; chosen.size < limit; i++) {
    let added = false;
    for (const list of perWord) {
      const hit = list[i];
      if (!hit) continue;
      added = true;
      const key = `${hit.option.id}:${hit.option.typeId ?? ''}`;
      const best = chosen.get(key);
      if (best === undefined || hit.score > best) chosen.set(key, hit.score);
      if (chosen.size >= limit) break;
    }
    if (!added) break;
  }

  const byKey = new Map<string, CategoryOption>();
  for (const list of perWord) {
    for (const { option } of list) {
      byKey.set(`${option.id}:${option.typeId ?? ''}`, option);
    }
  }

  return [...chosen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => byKey.get(key)!)
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Marketplace kategoriyalarini qidirish.
 *
 * Uzum'da API yo'q, lekin katalog uning Excel shablonining ichida (Лист2)
 * turadi — shuning uchun u ham shu yerdan qidiriladi.
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
      // Uzum'da API yo'q, lekin katalog shablonning ICHIDA (Лист2) turadi —
      // 8500 dan ortiq kategoriya ID si bilan birga. Shu sababli kategoriya
      // WB va Ozon'dagidek tanlanadi, sotuvchi Excel makrosiga tegmaydi.
      return rank(uzumCategoryOptions(creds.template), query, limit);

    default:
      throw new CategoryError('Bunday marketplace yo\'q');
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
  /**
   * Ruxsat etilgan qiymatlar (Yandex ENUM kabi). Bo'lsa forma ro'yxat
   * ko'rsatadi va AI ham faqat shulardan tanlaydi — erkin matn yuborilsa
   * marketplace qiymatni tanimaydi.
   */
  options?: string[];
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

/**
 * Ozon atributlari — formadagi "Kategoriya xususiyatlari" uchun.
 *
 * WB dagi bilan bir xil vazifa: kategoriya tanlangach, aynan o'sha turga
 * tegishli maydonlar ro'yxati keladi. Ozon buni "atribut" deb ataydi va
 * ularsiz kartochka moderatsiyadan o'tmaydi — avval sotuvchi ularni
 * to'ldira olmasdi, faqat "majburiy atribut bo'sh" ogohlantirishini ko'rardi.
 */
const OZON_COVERED_ATTRS = new Set([
  'цвет товара',
  'цвет',
  'материал',
  'страна изготовитель',
  'страна производства',
  'аннотация',
  'описание',
  'пол',
  'размер',
  'сезон',
  'гарантийный срок',
  'тн вэд',
  'тнвэд',
  'название товара',
  'бренд',
  'артикул',
  'тип',
]);

const ozonAttrCache = new Map<string, { items: CharcField[]; expiresAt: number }>();

export async function getOzonAttributes(
  creds: CategoryCreds,
  categoryId: number | string,
  typeId: number | string,
): Promise<CharcField[]> {
  const key = `${categoryId}:${typeId}:${tokenId(creds.apiKey)}`;
  const hit = ozonAttrCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.items;

  if (!creds.apiSecret) throw new CategoryError("Ozon uchun Client-Id kerak");

  const raw = await ozon.getCategoryAttributes(
    { apiKey: creds.apiKey, clientId: creds.apiSecret },
    Number(categoryId),
    Number(typeId),
  );

  const out: CharcField[] = [];
  for (const a of raw) {
    const name = String(a?.name ?? '').trim();
    if (!name || OZON_COVERED_ATTRS.has(normalize(name))) continue;
    // "Тип товара" alohida yuboriladi — formada ko'rsatishning ma'nosi yo'q
    if (Number(a?.id) === 8229) continue;

    out.push({
      id: Number(a.id),
      name,
      type: /integer|decimal|number/i.test(String(a?.type ?? '')) ? 'number' : 'string',
      required: !!a?.is_required,
      maxCount: a?.is_collection ? Number(a?.max_value_count) || 5 : 1,
      // Ozon "aspect" deb belgilagan atributlar qidiruvda ishlatiladi —
      // ular sotuvchi uchun ham muhimroq
      popular: !!a?.is_aspect,
    });
  }

  out.sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      Number(b.popular) - Number(a.popular) ||
      a.name.localeCompare(b.name, 'ru'),
  );

  if (out.length) ozonAttrCache.set(key, { items: out, expiresAt: Date.now() + TREE_TTL_MS });
  return out;
}

/**
 * Yandex kategoriya parametrlari — formadagi "Kategoriya xususiyatlari" uchun.
 *
 * Yandex buni "parameter" deb ataydi. ENUM turdagilar ro'yxatdan tanlanadi va
 * joylashda matn emas, `valueId` yuboriladi — matn yuborilsa qiymat
 * e'tiborsiz qoladi va tovar katalogda to'liq ko'rinmaydi.
 */
const YANDEX_COVERED_PARAMS = new Set([
  'название',
  'бренд',
  'производитель',
  'страна производства',
  'страна-изготовитель',
  'описание',
  'цвет',
  'размер',
  'пол',
  'сезон',
  'состав',
  'вес',
  'штрихкод',
]);

const yandexParamCache = new Map<string, { items: CharcField[]; expiresAt: number }>();

export async function getYandexParameters(
  apiKey: string,
  categoryId: number | string,
): Promise<CharcField[]> {
  const key = `${categoryId}:${tokenId(apiKey)}`;
  const hit = yandexParamCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.items;

  const raw: any = await yandex.getCategoryParameters(apiKey, categoryId);
  const list: any[] = raw?.result?.parameters ?? [];

  const out: CharcField[] = [];
  for (const p of list) {
    const name = String(p?.name ?? '').trim();
    if (!name || YANDEX_COVERED_PARAMS.has(normalize(name))) continue;

    const values = Array.isArray(p?.values)
      ? p.values.map((v: any) => String(v?.value ?? '').trim()).filter(Boolean)
      : [];

    out.push({
      id: Number(p.id),
      name,
      type: String(p?.type ?? '').toUpperCase() === 'NUMERIC' ? 'number' : 'string',
      required: !!p?.required,
      unit: p?.unit?.units?.find((u: any) => u.id === p?.unit?.defaultUnitId)?.name,
      maxCount: p?.multivalue ? 5 : 1,
      // Yandex "ADDITIONAL" deb belgilaganlari ikkinchi darajali
      popular: !(p?.recommendationTypes ?? []).includes('ADDITIONAL'),
      ...(values.length ? { options: values.slice(0, 200) } : {}),
    });
  }

  out.sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      Number(b.popular) - Number(a.popular) ||
      a.name.localeCompare(b.name, 'ru'),
  );

  if (out.length) yandexParamCache.set(key, { items: out, expiresAt: Date.now() + TREE_TTL_MS });
  return out;
}

/** TN VED ro'yxati predmet bo'yicha keshlanadi — u kunlab o'zgarmaydi */
const tnvedCache = new Map<string, { items: Array<{ tnved: string; isKiz?: boolean }>; expiresAt: number }>();
const TNVED_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Predmet uchun ruxsat etilgan TN VED kodlari.
 *
 * Sotuvchi kodni o'zi topa olmaydi (bojxona ma'lumotnomasi), noto'g'ri kod esa
 * kartochkani WB kabinetida qizil xatoga aylantiradi. Shuning uchun ro'yxat
 * formaga beriladi va joylashdan oldin tekshiriladi.
 */
export async function getWbTnved(
  apiKey: string,
  subjectId: number | string,
): Promise<Array<{ tnved: string; isKiz?: boolean }>> {
  const key = `${subjectId}:${apiKey.slice(-8)}`;
  const hit = tnvedCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.items;

  const items = await wb.getTnved(apiKey, subjectId);
  if (items.length) tnvedCache.set(key, { items, expiresAt: Date.now() + TNVED_TTL_MS });
  return items;
}

export function clearCategoryCache(): void {
  treeCache.clear();
  tnvedCache.clear();
  ozonAttrCache.clear();
  yandexParamCache.clear();
  inFlight.clear();
}

// Ichki funksiyalarni testdan chaqirish uchun ochamiz
export const __internal = { flattenOzon, flattenYandex, rank, normalize, stem, stems, headWord, bestWordMatch };
