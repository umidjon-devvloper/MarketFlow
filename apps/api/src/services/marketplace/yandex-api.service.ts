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
