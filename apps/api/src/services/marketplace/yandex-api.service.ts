/**
 * Yandex Market Partner API mijozi
 *
 * Autentifikatsiya: "Api-Key" sarlavhasi (kabinetdagi "API kaliti").
 * shopId sifatida campaignId saqlanadi — GET /campaigns dan olinadi.
 * Hujjat: https://yandex.ru/dev/market/partner-api/doc/
 */

const YANDEX_BASE_URL = 'https://api.partner.market.yandex.ru';

export class YandexApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'YandexApiError';
  }
}

async function yandexFetch<T>(
  apiKey: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${YANDEX_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    const message =
      err?.errors?.[0]?.message || err?.error?.message || err?.message || res.statusText;
    throw new YandexApiError(`Yandex API [${res.status}]: ${message}`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface YandexCampaign {
  id: number;
  domain?: string;
  placementType?: string;
  business?: { id: number; name: string };
}

/** GET /campaigns — kabinetdagi do'konlar (kalitni tekshirish + campaignId olish) */
export async function getCampaigns(apiKey: string): Promise<YandexCampaign[]> {
  const data = await yandexFetch<{ campaigns?: YandexCampaign[] }>(apiKey, '/campaigns');
  return data.campaigns || [];
}

/**
 * POST /campaigns/{campaignId}/offers — do'kondagi tovarlar.
 *
 * Diqqat: bu metod faqat offerId, narx va holatni qaytaradi —
 * nom va rasm yo'q. Ular kabinet darajasidagi offer-mappings'da (pastda).
 */
export function getOffers(
  apiKey: string,
  campaignId: string,
  { size = 20, pageToken }: { size?: number; pageToken?: string } = {},
): Promise<any> {
  const params = new URLSearchParams({ limit: String(size) });
  if (pageToken) params.append('pageToken', pageToken);
  return yandexFetch(apiKey, `/campaigns/${campaignId}/offers?${params}`, {
    method: 'POST',
    body: {},
  });
}

/**
 * POST /v2/businesses/{businessId}/offer-mappings — kartochka ma'lumotlari:
 * nom, rasmlar, shtrix-kod, brend. offerIds bilan aniq tovarlarni so'rash mumkin (maks. 100).
 */
export function getOfferMappings(
  apiKey: string,
  businessId: string,
  { offerIds, size = 100, pageToken }: { offerIds?: string[]; size?: number; pageToken?: string } = {},
): Promise<any> {
  const byIds = !!offerIds?.length;
  const params = new URLSearchParams();
  // offerIds filtri bilan sahifalash parametrlari ishlatilmaydi
  if (!byIds) {
    params.set('limit', String(Math.min(size, 100)));
    if (pageToken) params.set('pageToken', pageToken);
  }
  const qs = params.toString();
  return yandexFetch(apiKey, `/v2/businesses/${businessId}/offer-mappings${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    body: byIds ? { offerIds: offerIds!.slice(0, 100) } : {},
  });
}

/** campaignId → businessId. Kampaniyalar ro'yxati kamdan-kam o'zgaradi — xotirada saqlaymiz. */
const businessIdByCampaign = new Map<string, string>();

export async function resolveBusinessId(
  apiKey: string,
  campaignId: string,
): Promise<string | undefined> {
  const cached = businessIdByCampaign.get(campaignId);
  if (cached) return cached;

  const campaigns = await getCampaigns(apiKey);
  for (const c of campaigns) {
    if (c?.business?.id) businessIdByCampaign.set(String(c.id), String(c.business.id));
  }
  return businessIdByCampaign.get(campaignId);
}

/** GET /campaigns/{campaignId}/orders — buyurtmalar */
export function getOrders(
  apiKey: string,
  campaignId: string,
  {
    page = 1,
    size = 20,
    fromDate,
  }: { page?: number; size?: number; fromDate?: string } = {},
): Promise<any> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(size) });
  if (fromDate) params.append('fromDate', fromDate); // DD-MM-YYYY
  return yandexFetch(apiKey, `/campaigns/${campaignId}/orders?${params}`);
}

/** POST /campaigns/{campaignId}/offers/stocks — qoldiqlar (offerIds bilan aniq tovarlar, maks. 500) */
export function getStocks(
  apiKey: string,
  campaignId: string,
  { offerIds, size = 100, pageToken }: { offerIds?: string[]; size?: number; pageToken?: string } = {},
): Promise<any> {
  const byIds = !!offerIds?.length;
  const params = new URLSearchParams();
  if (!byIds) {
    params.set('limit', String(Math.min(size, 200)));
    if (pageToken) params.set('pageToken', pageToken);
  }
  const qs = params.toString();
  return yandexFetch(apiKey, `/campaigns/${campaignId}/offers/stocks${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    body: byIds ? { offerIds: offerIds!.slice(0, 500) } : {},
  });
}

// ─── KATEGORIYALAR ───────────────────────────────────────

/**
 * POST /v2/categories/tree — Market kategoriyalari daraxti.
 *
 * `marketCategoryId` yangi tovar uchun majburiy maydon, va u faqat shu
 * daraxtdan olinadi. Daraxt katta va kamdan-kam o'zgaradi — keshlanadi.
 */
export function getCategoriesTree(apiKey: string, language = 'RU'): Promise<any> {
  return yandexFetch(apiKey, '/v2/categories/tree', {
    method: 'POST',
    body: { language },
  });
}

/**
 * POST /v2/businesses/{businessId}/offer-cards/update — kartochka
 * xarakteristikalari.
 *
 * DIQQAT: parametrlar offer-mappings/update orqali YUBORILMAYDI. U so'rov
 * xatosiz o'tadi, lekin parametrlar kartochkaga tushmaydi — jimgina
 * yo'qoladi (tekshirilgan: javob 200, kartochkada parameterValues bo'sh).
 * Ular aynan shu endpoint orqali yuboriladi.
 */
export function updateOfferCards(
  apiKey: string,
  businessId: string,
  offersContent: unknown[],
): Promise<any> {
  return yandexFetch(apiKey, `/v2/businesses/${businessId}/offer-cards/update`, {
    method: 'POST',
    body: { offersContent },
  });
}

/**
 * POST /v2/businesses/{businessId}/settings — kabinet sozlamalari.
 *
 * Bizga faqat VALYUTA kerak. Yandex Market bir nechta davlatda ishlaydi va
 * kabinet valyutasi shunga qarab farq qiladi: .ru da RUR, .uz da UZS.
 * Narxni noto'g'ri valyutada yuborsak tovar yaratilmaydi —
 * "Offer at index 0 should not have price with RUR currency".
 */
export function getBusinessSettings(apiKey: string, businessId: string | number): Promise<any> {
  return yandexFetch(apiKey, `/v2/businesses/${businessId}/settings`, {
    method: 'POST',
    body: {},
  });
}

/**
 * POST /v2/category/{categoryId}/parameters — shu kategoriyaning xarakteristikalari.
 *
 * Qaytgan `parameters` ro'yxatidan `required: true` bo'lganlari kartochkada
 * to'ldirilishi shart, aks holda Yandex tovarni katalogda ko'rsatmaydi.
 */
export function getCategoryParameters(
  apiKey: string,
  categoryId: string | number,
): Promise<any> {
  return yandexFetch(apiKey, `/v2/category/${categoryId}/parameters`, {
    method: 'POST',
    body: {},
  });
}

/**
 * POST /v2/businesses/{businessId}/offer-mappings/update — tovar yaratish/yangilash.
 *
 * DIQQAT: businessId — kabinet identifikatori, campaignId EMAS.
 * Ular boshqa-boshqa raqamlar; almashtirilsa Yandex 403 qaytaradi.
 * campaignId dan businessId ni `resolveBusinessId()` beradi.
 */
export function updateOfferMappings(
  apiKey: string,
  businessId: string,
  body: unknown,
): Promise<any> {
  return yandexFetch(apiKey, `/v2/businesses/${businessId}/offer-mappings/update`, {
    method: 'POST',
    body,
  });
}

// ─── NARX VA QOLDIQ ──────────────────────────────────────

/**
 * PUT /v2/campaigns/{campaignId}/offers/stocks — qoldiqlarni yangilash.
 *
 * `sku` — sotuvchining o'z identifikatori (bizda Product.sku).
 * Bir so'rovda 2000 tagacha, `items` har bir SKU uchun ANIQ bitta element.
 */
export function updateStocks(
  apiKey: string,
  campaignId: string,
  items: Array<{ sku: string; count: number }>,
): Promise<any> {
  const now = new Date().toISOString();
  return yandexFetch(apiKey, `/v2/campaigns/${campaignId}/offers/stocks`, {
    method: 'PUT',
    body: {
      skus: items.slice(0, 2000).map((i) => ({
        sku: i.sku,
        items: [{ count: i.count, updatedAt: now }],
      })),
    },
  });
}

/**
 * POST /v2/businesses/{businessId}/offer-prices/updates — narxlarni yangilash.
 *
 * Kabinet darajasida ishlaydi (campaign emas) — narx barcha do'konlarga tegishli.
 */
export function updatePrices(
  apiKey: string,
  businessId: string,
  items: Array<{ offerId: string; value: number; discountBase?: number }>,
): Promise<any> {
  return yandexFetch(apiKey, `/v2/businesses/${businessId}/offer-prices/updates`, {
    method: 'POST',
    body: {
      offers: items.map((i) => ({
        offerId: i.offerId,
        price: {
          value: i.value,
          currencyId: 'RUR',
          ...(i.discountBase ? { discountBase: i.discountBase } : {}),
        },
      })),
    },
  });
}

// ─── BUYURTMA AMALLARI ───────────────────────────────────

/**
 * PUT /v2/campaigns/{campaignId}/orders/{orderId}/status — holatni o'zgartirish.
 *
 * Tasdiqlash  → status PROCESSING, substatus STARTED
 * Bekor qilish → status CANCELLED, substatus majburiy (sababni bildiradi)
 *
 * Yandex substatusni bekor qilishda ATAYIN majburiy qilgan: statistikada
 * "sotuvchi aybi bilan bekor qilingan" (SHOP_FAILED) va "xaridor fikridan
 * qaytdi" (USER_CHANGED_MIND) butunlay boshqacha hisoblanadi va reytingga
 * har xil ta'sir qiladi.
 */
export function updateOrderStatus(
  apiKey: string,
  campaignId: string,
  orderId: string,
  status: 'PROCESSING' | 'CANCELLED',
  substatus: string,
): Promise<any> {
  return yandexFetch(apiKey, `/v2/campaigns/${campaignId}/orders/${orderId}/status`, {
    method: 'PUT',
    body: { order: { status, substatus } },
  });
}

/** Bekor qilish sabablari — Yandex ro'yxati qat'iy, API'dan olinmaydi */
export const YANDEX_CANCEL_REASONS = [
  { id: 'SHOP_FAILED', title: "Do'kon buyurtmani bajara olmaydi" },
  { id: 'USER_CHANGED_MIND', title: 'Xaridor fikridan qaytdi' },
  { id: 'USER_REFUSED_DELIVERY', title: 'Yetkazib berish shartlari to\'g\'ri kelmadi' },
  { id: 'USER_REFUSED_PRODUCT', title: 'Tovar xaridorga mos kelmadi' },
  { id: 'USER_UNREACHABLE', title: "Xaridor bilan bog'lanib bo'lmadi" },
] as const;
