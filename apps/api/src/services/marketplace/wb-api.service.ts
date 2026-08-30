/**
 * Wildberries API mijozi
 *
 * Autentifikatsiya: Authorization sarlavhasida token (kabinetda yaratiladi).
 * WB xizmatlari alohida domenlarga bo'lingan: common (ping), content (kartochkalar),
 * statistics (buyurtmalar/sotuvlar/qoldiqlar).
 * Hujjat: https://dev.wildberries.ru/
 *
 * WB limitlari juda qattiq — ayniqsa statistics: har bir metod uchun daqiqasiga
 * 1 ta so'rov, va butun sotuvchi bo'yicha umumiy ("global limiter") chegara ham bor.
 * Shuning uchun bu yerda uchta himoya bor:
 *   1) navbat — bir xil endpoint'ga so'rovlar ketma-ket, minimal oraliq bilan ketadi;
 *   2) kesh — takroriy so'rov WB'ga umuman bormaydi;
 *   3) 429 kelganda Retry-After bo'yicha qayta urinish, bo'lmasa eski kesh qaytariladi.
 */

import { limited, tokenId } from './rate-limit';

const WB_COMMON = 'https://common-api.wildberries.ru';
const WB_CONTENT = 'https://content-api.wildberries.ru';
const WB_STATS = 'https://statistics-api.wildberries.ru';
const WB_PRICES = 'https://discounts-prices-api.wildberries.ru';
const WB_MARKETPLACE = 'https://marketplace-api.wildberries.ru';

export class WbApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'WbApiError';
  }
}

// ─── LIMITLAR ────────────────────────────────────────────

/** Endpoint guruhlari — WB limitlari shu darajada hisoblanadi */
type Bucket = 'ping' | 'cards' | 'media' | 'orders' | 'sales' | 'stocks' | 'prices' | 'fbs';

/** Ikki so'rov orasidagi minimal oraliq (ms) */
const MIN_GAP_MS: Record<Bucket, number> = {
  ping: 1_000, // ~1 so'rov/sekund
  cards: 700, // 100 so'rov/daqiqa
  // Rasm biriktirish — daqiqasiga ATIGI BITTA. Bu taxmin emas: WB javob
  // sarlavhasida x-ratelimit-limit: 1 keladi. Tez-tez urinsak har uchala
  // urinish ham 429 bo'ladi va rasm hech qachon biriktirilmaydi.
  media: 61_000,
  orders: 61_000, // 1 so'rov/daqiqa
  sales: 61_000, // 1 so'rov/daqiqa
  stocks: 61_000, // 1 so'rov/daqiqa
  prices: 700, // 100 so'rov/daqiqa
  fbs: 250, // 300 so'rov/daqiqa
};

/**
 * Har bir endpoint qaysi token kategoriyasini talab qiladi.
 * WB kabinetida token yaratishda shu kategoriyalar checkbox bilan tanlanadi —
 * tanlanmagan bo'lsa API 401 "token scope not allowed" qaytaradi.
 */
const BUCKET_SCOPE: Record<Bucket, string> = {
  ping: '',
  cards: 'Kontent (Контент)',
  media: 'Kontent (Контент)',
  orders: 'Statistika (Статистика)',
  sales: 'Statistika (Статистика)',
  stocks: 'Statistika (Статистика)',
  prices: 'Narxlar va chegirmalar (Цены и скидки)',
  fbs: 'Marketplace (Маркетплейс)',
};

/** Javobni qancha vaqt keshda saqlash (ms) */
const CACHE_TTL_MS: Record<Bucket, number> = {
  ping: 30_000,
  media: 0, // rasm biriktirish keshlanmaydi
  cards: 60_000,
  // Statistics ma'lumoti WB tomonida ~30 daqiqada bir yangilanadi — tez-tez so'rashning ma'nosi yo'q
  orders: 10 * 60_000,
  sales: 10 * 60_000,
  stocks: 10 * 60_000,
  prices: 5 * 60_000,
  // FBS qoldig'i sotuvchi o'zi boshqaradi — tezroq eskiradi
  fbs: 2 * 60_000,
};

/** Bitta token bo'yicha istalgan ikki so'rov orasidagi minimal oraliq — global limiter uchun */
const GLOBAL_GAP_MS = 350;

/** HTTP so'rovni ushlab turishning yuqori chegarasi — bundan uzun kutish o'rniga eski kesh qaytariladi */
const MAX_WAIT_MS = 12_000;

/** 429 kelganda nechi marta qayta urinish */
const MAX_RETRIES = 2;

// ─── SO'ROV ──────────────────────────────────────────────

/** WB javobidan qancha kutish kerakligini aniqlash */
function retryAfterMs(res: Response): number {
  const header =
    res.headers.get('X-Ratelimit-Retry-After') ||
    res.headers.get('Retry-After') ||
    res.headers.get('x-ratelimit-retry-after');
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000);
  return 5_000;
}

/**
 * WB "ruxsat yo'q" xatosimi?
 * Faqat WB o'zi scope haqida aytgan holatda — boshqa 401/403 sabablarni
 * (bloklangan akkaunt, noto'g'ri kalit) noto'g'ri nomlab qo'ymaslik uchun.
 */
function isScopeError(err: any): boolean {
  if (!(err instanceof WbApiError)) return false;
  if (err.status !== 401 && err.status !== 403) return false;
  return /scope|forbidden|not allowed|доступ/i.test(err.message);
}

async function rawFetch<T>(
  apiKey: string,
  url: string,
  options: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    let message = err?.errorText || err?.detail || err?.message || res.statusText;
    // "Invalid request format" da asl sabab additionalErrors ichida bo'ladi —
    // uni qo'shmasak qaysi maydon xato ekanini bilib bo'lmaydi
    const extra = err?.additionalErrors;
    if (extra && typeof extra === 'object') {
      const parts = Object.entries(extra)
        .map(([k, val]) => `${k}: ${typeof val === 'string' ? val : JSON.stringify(val)}`)
        .filter(Boolean);
      if (parts.length) message += ` — ${parts.join('; ')}`;
    } else if (Array.isArray(err?.errors) && err.errors.length) {
      message += ` — ${err.errors.join('; ')}`;
    }
    const wbErr = new WbApiError(`Wildberries API [${res.status}]: ${message}`, res.status);
    (wbErr as any).additionalErrors = extra;
    if (res.status === 429) (wbErr as any).retryAfterMs = retryAfterMs(res);
    throw wbErr;
  }
  return res.json() as Promise<T>;
}

async function wbFetch<T>(
  apiKey: string,
  url: string,
  options: { method?: string; body?: unknown; bucket: Bucket; noCache?: boolean },
): Promise<T> {
  const { bucket } = options;
  const id = tokenId(apiKey);

  try {
    return await limited<T>({
      key: `wb:${id}|${bucket}`,
      gapMs: MIN_GAP_MS[bucket],
      globalKey: `wb:${id}|*`,
      globalGapMs: GLOBAL_GAP_MS,
      // noCache — kesh butunlay chetlab o'tiladi (publish tekshiruvida yangi
      // ma'lumot kerak; 60s kesh eski holatni qaytarardi)
      cacheKey: options.noCache
        ? undefined
        : `wb:${id}|${options.method || 'GET'}|${url}|${JSON.stringify(options.body ?? null)}`,
      cacheTtlMs: CACHE_TTL_MS[bucket],
      maxWaitMs: MAX_WAIT_MS,
      retries: MAX_RETRIES,
      isRateLimited: (err: any) => err?.status === 429,
      retryAfterMs: (err: any) => err?.retryAfterMs ?? 5_000,
      onQueueTooLong: (waitMs) =>
        new WbApiError(
          `Wildberries limiti: bu ma'lumotni ${Math.ceil(waitMs / 1000)} soniyadan keyin qayta so'rang`,
          429,
        ),
      run: () => rawFetch<T>(apiKey, url, options),
    });
  } catch (err: any) {
    if (err?.status === 429) {
      throw new WbApiError(
        "Wildberries so'rovlar limitiga yetdi — 1 daqiqadan so'ng qayta urinib ko'ring",
        429,
      );
    }
    if (isScopeError(err) && BUCKET_SCOPE[bucket]) {
      // WB'ning asl matnini ham qoldiramiz — aks holda haqiqiy sababni topib bo'lmaydi
      throw new WbApiError(
        `Wildberries token'ida "${BUCKET_SCOPE[bucket]}" ruxsati yo'q shekilli. ` +
          `WB javobi: ${err.message}. ` +
          "Agar bu kategoriya kabinetda belgilangan bo'lsa — token muddati tugagan " +
          'yoki boshqa akkauntga tegishli bo\'lishi mumkin',
        err.status ?? 403,
      );
    }
    throw err;
  }
}

/** GET /ping — kalitni tekshirish */
export function ping(apiKey: string): Promise<{ TS?: string; Status?: string }> {
  return wbFetch(apiKey, `${WB_COMMON}/ping`, { bucket: 'ping' });
}

// ─── TOKEN TEKSHIRUVI ────────────────────────────────────

export interface WbTokenInfo {
  sellerId?: string;
  expiresAt?: Date;
  isExpired: boolean;
}

/**
 * WB token — oddiy JWT. Ichidan sotuvchi ID (`sid`) va amal qilish muddatini (`exp`)
 * o'qiymiz. Imzoni tekshirmaymiz — bu faqat foydalanuvchiga tushunarli xabar berish uchun.
 */
export function decodeToken(apiKey: string): WbTokenInfo | null {
  const parts = apiKey.trim().split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const exp = typeof payload?.exp === 'number' ? new Date(payload.exp * 1000) : undefined;
    return {
      sellerId: payload?.sid ? String(payload.sid) : undefined,
      expiresAt: exp,
      isExpired: !!exp && exp.getTime() < Date.now(),
    };
  } catch {
    return null;
  }
}

export interface WbTokenProblem {
  code: 'not_jwt' | 'expired' | 'sandbox' | 'no_scopes';
  message: string;
}

/**
 * Tokenni WB serveriga bormasdan tekshirish.
 *
 * WB tokeni — JWT, ichida hamma narsa yozilgan. Ikkita xato juda ko'p
 * uchraydi va API javobidan tushunish qiyin:
 *
 *   t = true  → "Тестовый контур" katagi belgilangan. Bunday token faqat
 *               sandbox'da ishlaydi, production endpointlar 403 qaytaradi.
 *   s = 0     → token yaratishda birorta ham kategoriya belgilanmagan.
 *               Har qanday so'rov "token scope not allowed" bilan tugaydi.
 *
 * Shuning uchun bularni kalit saqlanayotgan paytdayoq ushlaymiz.
 */
export function inspectToken(token: string): WbTokenProblem[] {
  const problems: WbTokenProblem[] = [];
  const parts = token.trim().split('.');

  if (parts.length !== 3) {
    return [
      {
        code: 'not_jwt',
        message:
          "Bu WB tokeniga o'xshamaydi. Seller kabinet → Настройки → Доступ к API dan " +
          "to'liq tokenni nusxalang (uzun, nuqtalar bilan ajratilgan matn).",
      },
    ];
  }

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return [{ code: 'not_jwt', message: "Token o'qib bo'lmadi — buzilgan yoki to'liq nusxalanmagan" }];
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    problems.push({
      code: 'expired',
      message: `Token muddati tugagan (${new Date(payload.exp * 1000).toLocaleDateString('uz-UZ')}). Kabinetda yangisini yarating.`,
    });
  }

  if (payload.t === true) {
    problems.push({
      code: 'sandbox',
      message:
        'Bu — test konturi (sandbox) tokeni. Token yaratishda "Тестовый контур" katagi belgilangan, ' +
        'shuning uchun haqiqiy WB API uni qabul qilmaydi. O\'sha katakni belgilamasdan yangi token yarating.',
    });
  }

  if (payload.s === 0) {
    problems.push({
      code: 'no_scopes',
      message:
        'Tokenda birorta ham kategoriya belgilanmagan. Yangi token yaratayotganda kamida ' +
        '"Контент" (kartochkalar uchun) va "Статистика" (buyurtma/qoldiqlar uchun) kataklarini belgilang.',
    });
  }

  return problems;
}

/** Ilova ishlatadigan WB xizmatlari — har biri alohida token kategoriyasini talab qiladi */
const SERVICES = [
  { key: 'content', label: 'Kontent (Контент)', base: WB_CONTENT, needed: 'Mahsulotlar' },
  { key: 'statistics', label: 'Statistika (Статистика)', base: WB_STATS, needed: 'Buyurtmalar, sotuvlar, FBW qoldiqlari' },
  { key: 'prices', label: 'Narxlar va chegirmalar (Цены и скидки)', base: WB_PRICES, needed: 'Mahsulot narxlari' },
  { key: 'marketplace', label: 'Marketplace (Маркетплейс)', base: WB_MARKETPLACE, needed: 'FBS qoldiqlari (o\'z omboringiz)' },
] as const;

export interface WbAccess {
  service: string;
  label: string;
  needed: string;
  ok: boolean;
  error?: string;
}

/**
 * Har bir xizmatning o'z /ping'ini chaqirib, token'da qaysi kategoriyalar
 * yoqilganini aniqlaydi. Shu orqali foydalanuvchiga aynan nima yetishmayotganini aytamiz.
 */
export async function checkAccess(apiKey: string): Promise<WbAccess[]> {
  const out: WbAccess[] = [];
  for (const svc of SERVICES) {
    try {
      await wbFetch(apiKey, `${svc.base}/ping`, { bucket: 'ping' });
      out.push({ service: svc.key, label: svc.label, needed: svc.needed, ok: true });
    } catch (err: any) {
      out.push({
        service: svc.key,
        label: svc.label,
        needed: svc.needed,
        ok: false,
        error: err?.message || 'xato',
      });
    }
  }
  return out;
}

/** POST /content/v2/get/cards/list — kartochkalar (kursor bilan) */
export async function getCards(
  apiKey: string,
  {
    size = 20,
    updatedAt,
    nmID,
    textSearch,
  }: { size?: number; updatedAt?: string; nmID?: number; textSearch?: string } = {},
): Promise<{ cards: any[]; cursor?: { updatedAt?: string; nmID?: number; total?: number } }> {
  const cursor: Record<string, unknown> = { limit: size };
  if (updatedAt) cursor.updatedAt = updatedAt;
  if (nmID) cursor.nmID = nmID;

  const filter: Record<string, unknown> = { withPhoto: -1 };
  // Artikul bo'yicha qidirish — katalogi katta sotuvchida yagona ishonchli yo'l
  if (textSearch) filter.textSearch = textSearch;

  const data = await wbFetch<any>(apiKey, `${WB_CONTENT}/content/v2/get/cards/list`, {
    method: 'POST',
    body: { settings: { cursor, filter } },
    bucket: 'cards',
  });
  return { cards: data?.cards || [], cursor: data?.cursor };
}

/** GET /api/v1/supplier/orders — buyurtmalar (dateFrom dan boshlab) */
export function getOrders(apiKey: string, dateFrom: string): Promise<any[]> {
  const params = new URLSearchParams({ dateFrom });
  return wbFetch(apiKey, `${WB_STATS}/api/v1/supplier/orders?${params}`, { bucket: 'orders' });
}

/** GET /api/v1/supplier/sales — sotuvlar (dateFrom dan boshlab) */
export function getSales(apiKey: string, dateFrom: string): Promise<any[]> {
  const params = new URLSearchParams({ dateFrom });
  return wbFetch(apiKey, `${WB_STATS}/api/v1/supplier/sales?${params}`, { bucket: 'sales' });
}

/** GET /api/v1/supplier/stocks — qoldiqlar */
export function getStocks(apiKey: string, dateFrom: string): Promise<any[]> {
  const params = new URLSearchParams({ dateFrom });
  return wbFetch(apiKey, `${WB_STATS}/api/v1/supplier/stocks?${params}`, { bucket: 'stocks' });
}

/**
 * GET /api/v2/list/goods/filter — narxlar va chegirmalar.
 *
 * Kartochkalar API'si narxni umuman qaytarmaydi — narx alohida xizmatda turadi,
 * shuning uchun mahsulotlar jadvali uchun buni ham chaqirish kerak.
 */
export async function getPrices(
  apiKey: string,
  { limit = 1000, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<any[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const data = await wbFetch<any>(apiKey, `${WB_PRICES}/api/v2/list/goods/filter?${params}`, {
    bucket: 'prices',
  });
  return data?.data?.listGoods || [];
}

/**
 * GET /api/v3/warehouses — sotuvchining o'z (FBS) omborlari.
 *
 * FBS'da ishlaydigan sotuvchida statistics/stocks bo'sh keladi: u yerda faqat
 * WB omboridagi (FBW) tovarlar bor. Shuning uchun qoldiqni omborlar ro'yxati
 * orqali alohida so'raymiz.
 */
export async function getWarehouses(apiKey: string): Promise<any[]> {
  const data = await wbFetch<any>(apiKey, `${WB_MARKETPLACE}/api/v3/warehouses`, { bucket: 'fbs' });
  return Array.isArray(data) ? data : [];
}

/** POST /api/v3/stocks/{warehouseId} — FBS qoldiqlari (barcode bo'yicha, bir so'rovda 1000 tagacha) */
export async function getFbsStocks(
  apiKey: string,
  warehouseId: number | string,
  skus: string[],
): Promise<Array<{ sku: string; amount: number }>> {
  if (!skus.length) return [];
  const data = await wbFetch<any>(apiKey, `${WB_MARKETPLACE}/api/v3/stocks/${warehouseId}`, {
    method: 'POST',
    body: { skus: skus.slice(0, 1000) },
    bucket: 'fbs',
  });
  return Array.isArray(data?.stocks) ? data.stocks : [];
}

// ─── PREDMETLAR (kategoriyalar) VA MEDIA ─────────────────

/**
 * GET /content/v2/object/all — WB "predmetlari" (bizda: kategoriya).
 *
 * `subjectID` kartochka yaratishda majburiy. WB'da qidiruv server tomonida
 * (`name` parametri), shuning uchun butun daraxtni keshlash shart emas —
 * foydalanuvchi yozgan matnni to'g'ridan-to'g'ri uzatamiz.
 */
export async function getSubjects(
  apiKey: string,
  { name, limit = 50, offset = 0, locale = 'ru' }: { name?: string; limit?: number; offset?: number; locale?: string } = {},
): Promise<Array<{ subjectID: number; subjectName: string; parentID?: number; parentName?: string }>> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), locale });
  if (name) params.set('name', name);
  const data = await wbFetch<any>(apiKey, `${WB_CONTENT}/content/v2/object/all?${params}`, {
    bucket: 'cards',
  });
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * GET /content/v2/object/charcs/{subjectId} — predmetning xarakteristikalari.
 *
 * Xarakteristika ID'lari har predmetda boshqacha — bitta kategoriyada ishlagan
 * ID ikkinchisida umuman mavjud emas. Shuning uchun ularni qattiq yozib
 * qo'yish mumkin emas, har safar shu yerdan olinadi.
 */
export async function getSubjectCharcs(
  apiKey: string,
  subjectId: number | string,
  locale = 'ru',
): Promise<any[]> {
  const data = await wbFetch<any>(
    apiKey,
    `${WB_CONTENT}/content/v2/object/charcs/${subjectId}?locale=${locale}`,
    { bucket: 'cards' },
  );
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * GET /content/v2/directory/{name} — WB ma'lumotnomalari.
 *
 * Jinsi (kinds), mavsum (seasons), davlat (countries), rang (colors) —
 * bularning qiymatlari WB lug'atidan olinishi kerak. O'z so'zimizni
 * yuborsak kartochka yaratiladi, lekin kabinetda katak qizil bo'lib
 * qoladi va tovar sotuvga chiqmaydi.
 */
export async function getDirectory(
  apiKey: string,
  name: 'kinds' | 'seasons' | 'countries' | 'colors',
  locale = 'ru',
): Promise<unknown[]> {
  const data = await wbFetch<any>(
    apiKey,
    `${WB_CONTENT}/content/v2/directory/${name}?locale=${locale}`,
    { bucket: 'cards' },
  );
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * POST /content/v2/barcodes — WB tomonidan barkod generatsiyasi.
 *
 * `sizes[].skus` bo'sh bo'lsa WB kartochkani qabul qilmaydi, sotuvchida esa
 * ko'pincha barkod bo'lmaydi. Shuning uchun kerak bo'lganda o'zimiz so'raymiz.
 */
export async function generateBarcodes(apiKey: string, count = 1): Promise<string[]> {
  const data = await wbFetch<any>(apiKey, `${WB_CONTENT}/content/v2/barcodes`, {
    method: 'POST',
    body: { count },
    bucket: 'cards',
  });
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * POST /content/v3/media/save — kartochkaga rasm biriktirish (URL ro'yxati bilan).
 *
 * WB'da rasm kartochka bilan bir so'rovda ketmaydi: avval kartochka yaratiladi,
 * u `nmId` oladi, keyin shu metod chaqiriladi. `data` — rasmlarning to'liq
 * ochiq URL'lari; WB ularni o'zi yuklab oladi, ya'ni manzil tashqaridan
 * ochiladigan bo'lishi shart (localhost ishlamaydi).
 */
export async function saveMedia(
  apiKey: string,
  nmId: number,
  imageUrls: string[],
): Promise<unknown> {
  return wbFetch(apiKey, `${WB_CONTENT}/content/v3/media/save`, {
    method: 'POST',
    body: { nmId, data: imageUrls },
    bucket: 'media',
  });
}

/**
 * POST /content/v2/cards/error/list — yaratishda xato bergan kartochkalar.
 *
 * WB kartochkani asinxron yaratadi: HTTP 200 "qabul qilindi" degani,
 * "yaratildi" degani emas. Haqiqiy natija shu yerda ko'rinadi.
 */
export async function getCardErrors(
  apiKey: string,
  locale = 'ru',
  opts: { fresh?: boolean } = {},
): Promise<any[]> {
  const data = await wbFetch<any>(
    apiKey,
    `${WB_CONTENT}/content/v2/cards/error/list?locale=${locale}`,
    { bucket: 'cards', noCache: opts.fresh },
  );
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * vendorCode bo'yicha kartochkani topish.
 *
 * To'liq obyekt qaytariladi: yangilash uchun nmID dan tashqari mavjud
 * o'lchamlar (chrtID va barkodlar) ham kerak — WB yangilashda o'lchamni
 * aynan chrtID bo'yicha topadi.
 */
export async function findCardByVendorCode(
  apiKey: string,
  vendorCode: string,
): Promise<any | null> {
  // Avval matnli qidiruv. Oldin bu yerda faqat "birinchi 100 kartochka"
  // olinardi — 235 kartochkali do'konda yangi kartochka o'sha ro'yxatga
  // tushmasdi va topilmadi deb hisoblanardi. Oqibati og'ir edi: nmID
  // topilmagach rasm biriktirilmasdi, kartochka esa abadiy PENDING qolardi.
  const direct = await getCards(apiKey, { size: 100, textSearch: vendorCode });
  const hit = direct.cards.find((c: any) => c?.vendorCode === vendorCode);
  if (hit) return hit;

  // Zaxira: kursor bo'yicha varaqlash. WB matnli qidiruvni yangi
  // kartochkalarda darrov qo'llamasligi mumkin.
  //
  // DIQQAT: varaqlashni BOSHIDAN boshlaymiz. Avval bu yerda matnli
  // qidiruvdan qaytgan kursor ishlatilardi — u bo'sh natijaning kursori
  // bo'lgani uchun varaqlash noto'g'ri joydan boshlanar va eng yangi
  // kartochkalar umuman ko'rilmasdi. Natijada mavjud kartochka
  // "topilmadi" deb belgilanib qolgan edi.
  let cursor: { updatedAt?: string; nmID?: number } | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await getCards(apiKey, {
      size: 100,
      updatedAt: cursor?.updatedAt,
      nmID: cursor?.nmID,
    });
    const found = res.cards.find((c: any) => c?.vendorCode === vendorCode);
    if (found) return found;
    // Oxirgi sahifa — WB to'liq bo'lmagan to'plam qaytarsa tugadi
    if (res.cards.length < 100) return null;
    cursor = res.cursor;
  }
  return null;
}

/**
 * POST /content/v2/cards/upload — yangi kartochka yaratish.
 *
 * Asinxron: 200 javob "qabul qilindi" degani, "yaratildi" degani emas.
 * Haqiqiy natija `getCardErrors` va `getCards` orqali bilinadi.
 * Bir so'rovda 100 tagacha kartochka, har birida 30 tagacha nomenklatura.
 */
export function uploadCards(apiKey: string, body: unknown): Promise<any> {
  return wbFetch(apiKey, `${WB_CONTENT}/content/v2/cards/upload`, {
    method: 'POST',
    body,
    bucket: 'cards',
  });
}

/**
 * GET /content/v2/directory/tnved — predmet uchun ruxsat etilgan TN VED kodlari.
 *
 * TN VED butun dunyo uchun bitta emas: WB har predmetga o'z ro'yxatini
 * belgilaydi. Polo uchun to'g'ri kod sarafan predmetida qabul qilinmaydi —
 * "Invalid HS code. Value doesn't match the directory" aynan shu haqda.
 *
 * `isKiz` — shu kod bo'yicha tovar "Chesniy znak" markirovkasini talab qiladi.
 */
export async function getTnved(
  apiKey: string,
  subjectId: number | string,
  search?: string,
): Promise<Array<{ tnved: string; isKiz?: boolean }>> {
  const params = new URLSearchParams({ subjectID: String(subjectId), locale: 'ru' });
  if (search) params.set('search', search);
  const data = await wbFetch<any>(
    apiKey,
    `${WB_CONTENT}/content/v2/directory/tnved?${params}`,
    { bucket: 'cards' },
  );
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * POST /content/v2/cards/update — MAVJUD kartochkani yangilash.
 *
 * upload dan farqi: upload faqat yangi kartochka yaratadi va o'sha
 * vendorCode bilan ikkinchi marta yuborilsa rad etadi. Kabinetdagi xatoni
 * (noto'g'ri jins, TN VED va h.k.) tuzatish uchun aynan shu chaqiruv kerak.
 *
 * Har bir kartochkada nmID va mavjud o'lchamlar (chrtID) bo'lishi shart.
 */
export function updateCards(apiKey: string, body: unknown): Promise<any> {
  return wbFetch(apiKey, `${WB_CONTENT}/content/v2/cards/update`, {
    method: 'POST',
    body,
    bucket: 'cards',
  });
}

// ─── NARX VA QOLDIQ ──────────────────────────────────────

/**
 * POST /api/v2/upload/task — narx va chegirma.
 *
 * DIQQAT: WB nmID (raqamli) bilan ishlaydi, sotuvchi artikuli bilan emas.
 * nmID ni `findCardByVendorCode` orqali topib olish kerak.
 * Limit: 6 soniyada 10 so'rov (butun akkaunt bo'yicha).
 */
export function updatePrices(
  apiKey: string,
  data: Array<{ nmID: number; price: number; discount?: number }>,
): Promise<any> {
  return wbFetch(apiKey, `${WB_PRICES}/api/v2/upload/task`, {
    method: 'POST',
    body: { data },
    bucket: 'prices',
  });
}

/**
 * PUT /api/v3/stocks/{warehouseId} — FBS qoldiqlari.
 *
 * `sku` bu yerda BARKOD (nmID ham, artikul ham emas) — WB shunday ataydi.
 * Ombor identifikatori majburiy: qoldiq har bir omborda alohida yuritiladi.
 */
export function updateStocks(
  apiKey: string,
  warehouseId: number | string,
  stocks: Array<{ sku: string; amount: number }>,
): Promise<any> {
  return wbFetch(apiKey, `${WB_MARKETPLACE}/api/v3/stocks/${warehouseId}`, {
    method: 'PUT',
    body: { stocks: stocks.slice(0, 1000) },
    bucket: 'fbs',
  });
}

/**
 * Artikul → nmID va barkod jadvali.
 *
 * Narx nmID bo'yicha, qoldiq esa barkod bo'yicha yangilanadi — ikkalasi ham
 * bizda yo'q, faqat sotuvchi artikuli bor. Shuning uchun kartochkalar
 * ro'yxatini bir marta o'qib, moslik jadvalini quramiz.
 */
export async function buildVendorCodeIndex(
  apiKey: string,
  { maxPages = 10 }: { maxPages?: number } = {},
): Promise<Map<string, { nmID?: number; barcode?: string }>> {
  const index = new Map<string, { nmID?: number; barcode?: string }>();
  let cursor: { updatedAt?: string; nmID?: number } | undefined;

  for (let page = 0; page < maxPages; page++) {
    const { cards, cursor: next } = await getCards(apiKey, {
      size: 100,
      updatedAt: cursor?.updatedAt,
      nmID: cursor?.nmID,
    });
    if (!cards.length) break;

    for (const card of cards) {
      const vendorCode = card?.vendorCode;
      if (!vendorCode) continue;
      // Barkod o'lchamlar ichida yotadi — birinchisini olamiz
      const barcode = card?.sizes?.find((s: any) => s?.skus?.length)?.skus?.[0];
      index.set(String(vendorCode), { nmID: card?.nmID, barcode });
    }

    if (cards.length < 100 || !next?.updatedAt) break;
    cursor = { updatedAt: next.updatedAt, nmID: next.nmID };
  }

  return index;
}
