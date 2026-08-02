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
type Bucket = 'ping' | 'cards' | 'orders' | 'sales' | 'stocks';

/** Ikki so'rov orasidagi minimal oraliq (ms) */
const MIN_GAP_MS: Record<Bucket, number> = {
  ping: 1_000, // ~1 so'rov/sekund
  cards: 700, // 100 so'rov/daqiqa
  orders: 61_000, // 1 so'rov/daqiqa
  sales: 61_000, // 1 so'rov/daqiqa
  stocks: 61_000, // 1 so'rov/daqiqa
};

/**
 * Har bir endpoint qaysi token kategoriyasini talab qiladi.
 * WB kabinetida token yaratishda shu kategoriyalar checkbox bilan tanlanadi —
 * tanlanmagan bo'lsa API 401 "token scope not allowed" qaytaradi.
 */
const BUCKET_SCOPE: Record<Bucket, string> = {
  ping: '',
  cards: 'Kontent (Контент)',
  orders: 'Statistika (Статистика)',
  sales: 'Statistika (Статистика)',
  stocks: 'Statistika (Статистика)',
};

/** Javobni qancha vaqt keshda saqlash (ms) */
const CACHE_TTL_MS: Record<Bucket, number> = {
  ping: 30_000,
  cards: 60_000,
  // Statistics ma'lumoti WB tomonida ~30 daqiqada bir yangilanadi — tez-tez so'rashning ma'nosi yo'q
  orders: 10 * 60_000,
  sales: 10 * 60_000,
  stocks: 10 * 60_000,
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
    const message = err?.errorText || err?.detail || err?.message || res.statusText;
    const wbErr = new WbApiError(`Wildberries API [${res.status}]: ${message}`, res.status);
    if (res.status === 429) (wbErr as any).retryAfterMs = retryAfterMs(res);
    throw wbErr;
  }
  return res.json() as Promise<T>;
}

async function wbFetch<T>(
  apiKey: string,
  url: string,
  options: { method?: string; body?: unknown; bucket: Bucket },
): Promise<T> {
  const { bucket } = options;
  const id = tokenId(apiKey);

  try {
    return await limited<T>({
      key: `wb:${id}|${bucket}`,
      gapMs: MIN_GAP_MS[bucket],
      globalKey: `wb:${id}|*`,
      globalGapMs: GLOBAL_GAP_MS,
      cacheKey: `wb:${id}|${options.method || 'GET'}|${url}|${JSON.stringify(options.body ?? null)}`,
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

/** Ilova ishlatadigan WB xizmatlari — har biri alohida token kategoriyasini talab qiladi */
const SERVICES = [
  { key: 'content', label: 'Kontent (Контент)', base: WB_CONTENT, needed: 'Mahsulotlar' },
  { key: 'statistics', label: 'Statistika (Статистика)', base: WB_STATS, needed: 'Buyurtmalar, sotuvlar, qoldiqlar' },
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
  }: { size?: number; updatedAt?: string; nmID?: number } = {},
): Promise<{ cards: any[]; cursor?: { updatedAt?: string; nmID?: number; total?: number } }> {
  const cursor: Record<string, unknown> = { limit: size };
  if (updatedAt) cursor.updatedAt = updatedAt;
  if (nmID) cursor.nmID = nmID;

  const data = await wbFetch<any>(apiKey, `${WB_CONTENT}/content/v2/get/cards/list`, {
    method: 'POST',
    body: { settings: { cursor, filter: { withPhoto: -1 } } },
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
