/**
 * Uzum Seller API mijozi (rasmiy endpointlar)
 *
 * MUHIM: Authorization sarlavhasida token to'g'ridan-to'g'ri yuboriladi,
 * "Bearer" prefiksi QO'SHILMAYDI — aks holda 403 "Token not found" qaytadi.
 *
 * Har bir chaqiruv tashkilotning saqlangan (shifrdan yechilgan) kaliti
 * bilan ishlaydi — env'dan emas.
 */

import { limited, tokenId } from './rate-limit';

const UZUM_BASE_URL = 'https://api-seller.uzum.uz/api/seller-openapi';

/**
 * Uzum limitlari hujjatlashtirilmagan, lekin "Too Many Requests" tez keladi —
 * shuning uchun bitta token bo'yicha so'rovlar ketma-ket, oraliq bilan yuboriladi.
 */
const UZUM_GAP_MS = 600;
/** GET javoblari qisqa muddat keshlanadi — bir sahifada bir necha marta so'ralmasin */
const UZUM_CACHE_TTL_MS = 2 * 60_000;
const UZUM_MAX_WAIT_MS = 15_000;

export class UzumApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'UzumApiError';
  }
}

function uzumHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: apiKey, // Bearer yo'q!
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function rawUzumFetch<T>(
  apiKey: string,
  path: string,
  options: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${UZUM_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: uzumHeaders(apiKey),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    const message =
      err?.errors?.[0]?.message || err?.message || res.statusText;
    throw new UzumApiError(`Uzum API [${res.status}]: ${message}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function uzumFetch<T>(
  apiKey: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const id = tokenId(apiKey);
  const method = options.method || 'GET';

  try {
    return await limited<T>({
      key: `uzum:${id}`,
      gapMs: UZUM_GAP_MS,
      // O'zgartiruvchi so'rovlar keshlanmaydi
      cacheKey:
        method === 'GET' ? `uzum:${id}|${path}` : undefined,
      cacheTtlMs: UZUM_CACHE_TTL_MS,
      maxWaitMs: UZUM_MAX_WAIT_MS,
      retries: 2,
      isRateLimited: (err: any) => err?.status === 429,
      retryAfterMs: () => 4_000,
      onQueueTooLong: (waitMs) =>
        new UzumApiError(
          `Uzum limiti: ${Math.ceil(waitMs / 1000)} soniyadan keyin qayta urinib ko'ring`,
          429,
        ),
      run: () => rawUzumFetch<T>(apiKey, path, options),
    });
  } catch (err: any) {
    if (err?.status === 429) {
      throw new UzumApiError(
        "Uzum so'rovlar limitiga yetdi — bir necha daqiqadan so'ng qayta urinib ko'ring",
        429,
      );
    }
    throw err;
  }
}

/**
 * Uzum seller-openapi hujjati merchant kabinet ortida yopiq (tashqaridan 403)
 * va endpointlar versiyaga qarab farq qiladi. Shuning uchun ba'zi metodlar uchun
 * bir nechta ma'lum variantni navbat bilan sinaymiz: 400/404 kelsa keyingisiga
 * o'tamiz, ishlagan variantni esa eslab qolamiz — keyingi chaqiruvlar bitta so'rov.
 */
const workingVariant = new Map<string, number>();
/** Hech bir variant ishlamagan metodlar — qayta-qayta urinib limitga urilmaslik uchun */
const deadMethod = new Map<string, { until: number; message: string }>();
const DEAD_METHOD_TTL_MS = 10 * 60_000;

async function tryVariants<T>(
  key: string,
  variants: Array<{ note: string; run: () => Promise<T> }>,
): Promise<T> {
  const dead = deadMethod.get(key);
  if (dead && Date.now() < dead.until) {
    throw new UzumApiError(dead.message, 403);
  }

  // Avval ishlagan variant ma'lum bo'lsa — faqat shuni chaqiramiz
  const known = workingVariant.get(key);
  if (known !== undefined && variants[known]) {
    try {
      return await variants[known].run();
    } catch (err) {
      if (!canTryNextVariant(err)) throw err;
      workingVariant.delete(key); // yo'l o'zgargan bo'lishi mumkin — qaytadan qidiramiz
    }
  }

  let lastErr: unknown;
  for (let i = 0; i < variants.length; i++) {
    try {
      const result = await variants[i].run();
      workingVariant.set(key, i);
      if (i > 0) console.info(`Uzum ${key}: "${variants[i].note}" varianti ishladi`);
      return result;
    } catch (err) {
      lastErr = err;
      // Limit yoki avtorizatsiya xatosi — qolgan variantlarni sinash faqat holatni yomonlashtiradi
      if (!canTryNextVariant(err)) throw err;
    }
  }

  // Hammasi yiqildi — buni eslab qolamiz va tushunarli xabar beramiz
  const method = key.split('|')[0]; // kalitdagi token qismini xabarga chiqarmaymiz
  const message =
    `Uzum'da "${method}" metodi ishlamadi (${(lastErr as Error)?.message || 'xato'}). ` +
    "Do'koningizda bu bo'lim (FBS) yoqilmagan yoki kalitda ruxsat yo'q bo'lishi mumkin";
  deadMethod.set(key, { until: Date.now() + DEAD_METHOD_TTL_MS, message });
  throw new UzumApiError(message, 403);
}

/**
 * Keyingi variantga o'tish mantiqiymi?
 * 400/403/404/405 — yo'l yoki parametr noto'g'ri bo'lishi mumkin. Uzum noto'g'ri
 * yo'lga ham "RBAC: access denied" (403) qaytaradi, shuning uchun 403 ham sinaladi —
 * lekin natija manfiy keshga tushadi, ya'ni bu 10 daqiqada bir marta bo'ladi.
 * 401/429 — kalit yoki limit muammosi: qolgan variantlarni sinash faqat zarar.
 */
function canTryNextVariant(err: unknown): boolean {
  const status = err instanceof UzumApiError ? err.status : undefined;
  return status === 400 || status === 403 || status === 404 || status === 405;
}

// ─── SHOPS ───────────────────────────────────────────────

export interface UzumShop {
  id: number;
  name: string;
}

/** GET /v1/shops — do'konlar ro'yxati (kalitni tekshirish + shopId olish) */
export function getShops(apiKey: string): Promise<UzumShop[]> {
  return uzumFetch<UzumShop[]>(apiKey, '/v1/shops');
}

// ─── PRODUCTS ────────────────────────────────────────────

/** GET /v1/product/shop/:shopId — do'kon mahsulotlari */
export function getProducts(
  apiKey: string,
  shopId: string,
  { page = 0, size = 20 }: { page?: number; size?: number } = {},
): Promise<unknown> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return uzumFetch(apiKey, `/v1/product/shop/${shopId}?${params}`);
}

/** POST /v1/product/:shopId/sendPriceData — narx yangilash */
export function updatePrices(
  apiKey: string,
  shopId: string,
  skus: Array<{ skuId: number; price: number }>,
): Promise<unknown> {
  return uzumFetch(apiKey, `/v1/product/${shopId}/sendPriceData`, {
    method: 'POST',
    body: { skus },
  });
}

// ─── ORDERS (FBS) ────────────────────────────────────────

/**
 * GET /v2/fbs/orders — FBS buyurtmalar.
 *
 * Ba'zi kabinetlarda sana oynasi majburiy ("Illegal argument" xatosi),
 * ba'zilarida shopIds ortiqcha — variantlar ketma-ket sinaladi.
 */
export function getFbsOrders(
  apiKey: string,
  shopId: string,
  {
    page = 0,
    size = 20,
    status,
    days = 30,
  }: { page?: number; size?: number; status?: string; days?: number } = {},
): Promise<unknown> {
  const base = () => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) p.append('status', status);
    return p;
  };
  // Sanani soatga yaxlitlaymiz — aks holda har millisekundda yangi kesh kaliti chiqadi
  const HOUR = 60 * 60 * 1000;
  const to = Math.floor(Date.now() / HOUR) * HOUR;
  const from = to - days * 24 * HOUR;

  return tryVariants(`fbs/orders|${tokenId(apiKey)}`, [
    {
      note: 'shopIds',
      run: () => {
        const p = base();
        p.append('shopIds', shopId);
        return uzumFetch(apiKey, `/v2/fbs/orders?${p}`);
      },
    },
    {
      note: 'shopIds + dateFrom/dateTo (epoch ms)',
      run: () => {
        const p = base();
        p.append('shopIds', shopId);
        p.append('dateFrom', String(from));
        p.append('dateTo', String(to));
        return uzumFetch(apiKey, `/v2/fbs/orders?${p}`);
      },
    },
    {
      note: 'shopIds + dateFrom/dateTo (YYYY-MM-DD)',
      run: () => {
        const p = base();
        p.append('shopIds', shopId);
        p.append('dateFrom', new Date(from).toISOString().slice(0, 10));
        p.append('dateTo', new Date(to).toISOString().slice(0, 10));
        return uzumFetch(apiKey, `/v2/fbs/orders?${p}`);
      },
    },
    { note: 'shopIds siz', run: () => uzumFetch(apiKey, `/v2/fbs/orders?${base()}`) },
    {
      note: 'v1',
      run: () => {
        const p = base();
        p.append('shopIds', shopId);
        return uzumFetch(apiKey, `/v1/fbs/orders?${p}`);
      },
    },
  ]);
}

/** GET /v2/fbs/orders/count — buyurtmalar soni */
export function getFbsOrdersCount(apiKey: string): Promise<unknown> {
  return uzumFetch(apiKey, '/v2/fbs/orders/count');
}

/** GET /v1/fbs/order/:orderId — bitta buyurtma */
export function getFbsOrder(apiKey: string, orderId: string): Promise<unknown> {
  return uzumFetch(apiKey, `/v1/fbs/order/${orderId}`);
}

/** POST /v1/fbs/order/:orderId/confirm — buyurtmani tasdiqlash */
export function confirmFbsOrder(apiKey: string, orderId: string): Promise<unknown> {
  return uzumFetch(apiKey, `/v1/fbs/order/${orderId}/confirm`, { method: 'POST' });
}

/** POST /v1/fbs/order/:orderId/cancel — buyurtmani bekor qilish */
export function cancelFbsOrder(
  apiKey: string,
  orderId: string,
  body: Record<string, unknown> = {},
): Promise<unknown> {
  return uzumFetch(apiKey, `/v1/fbs/order/${orderId}/cancel`, {
    method: 'POST',
    body,
  });
}

// ─── FINANCE ─────────────────────────────────────────────

/** GET /v1/finance/orders — moliyaviy buyurtmalar (shopIds majburiy) */
export function getFinanceOrders(
  apiKey: string,
  shopId: string,
  {
    page = 0,
    size = 20,
    dateFrom,
    dateTo,
  }: { page?: number; size?: number; dateFrom?: string; dateTo?: string } = {},
): Promise<unknown> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('shopIds', shopId);
  return uzumFetch(apiKey, `/v1/finance/orders?${params}`);
}

/** GET /v1/finance/expenses — seller xarajatlari (shopIds majburiy) */
export function getFinanceExpenses(
  apiKey: string,
  shopId: string,
  { page = 0, size = 20 }: { page?: number; size?: number } = {},
): Promise<unknown> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  params.append('shopIds', shopId);
  return uzumFetch(apiKey, `/v1/finance/expenses?${params}`);
}

// ─── STOCKS (FBS) ────────────────────────────────────────

/**
 * GET /v2/fbs/sku/stocks — SKU qoldiqlari.
 * Yo'l kabinet versiyasiga qarab farq qiladi (404) — variantlar sinaladi.
 */
export function getFbsStocks(
  apiKey: string,
  { page = 0, size = 20, shopId }: { page?: number; size?: number; shopId?: string } = {},
): Promise<unknown> {
  const qs = () => new URLSearchParams({ page: String(page), size: String(size) });

  // Probe natijasi: shopIds bo'lmasa Uzum "RBAC: access denied" (403) qaytaradi —
  // shuning uchun barcha variantlar shopIds bilan sinaladi.
  const withShop = () => {
    const p = qs();
    if (shopId) p.append('shopIds', shopId);
    return p;
  };

  return tryVariants(`fbs/sku/stocks|${tokenId(apiKey)}`, [
    { note: '/v2/sku/stocks + shopIds', run: () => uzumFetch(apiKey, `/v2/sku/stocks?${withShop()}`) },
    { note: '/v2/fbs/stocks + shopIds', run: () => uzumFetch(apiKey, `/v2/fbs/stocks?${withShop()}`) },
    { note: '/v1/sku/stocks + shopIds', run: () => uzumFetch(apiKey, `/v1/sku/stocks?${withShop()}`) },
    {
      note: '/v2/fbs/sku/stocks + shopIds',
      run: () => uzumFetch(apiKey, `/v2/fbs/sku/stocks?${withShop()}`),
    },
    { note: '/v2/fbs/sku/stocks', run: () => uzumFetch(apiKey, `/v2/fbs/sku/stocks?${qs()}`) },
  ]);
}

/** POST /v2/fbs/sku/stocks — qoldiqlarni yangilash */
export function updateFbsStocks(
  apiKey: string,
  skus: Array<{ skuId: number; amount: number }>,
): Promise<unknown> {
  return uzumFetch(apiKey, '/v2/fbs/sku/stocks', { method: 'POST', body: { skus } });
}

// ─── INVOICES ────────────────────────────────────────────

/** GET /v1/invoice — nakladnoylar ro'yxati */
export function getInvoices(
  apiKey: string,
  { page = 0, size = 20 }: { page?: number; size?: number } = {},
): Promise<unknown> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return uzumFetch(apiKey, `/v1/invoice?${params}`);
}
