/**
 * Ozon Seller API mijozi
 *
 * Autentifikatsiya: ikkita sarlavha — Client-Id (kabinet ID) va Api-Key.
 * Bizning modelda: apiKey = Api-Key, apiSecret = Client-Id.
 * Hujjat: https://docs.ozon.ru/api/seller/
 */

const OZON_BASE_URL = 'https://api-seller.ozon.ru';

export class OzonApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'OzonApiError';
  }
}

export interface OzonCreds {
  apiKey: string;
  clientId: string;
}

async function ozonFetch<T>(creds: OzonCreds, path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`${OZON_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Client-Id': creds.clientId,
      'Api-Key': creds.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    const message = err?.message || err?.error?.message || res.statusText;
    throw new OzonApiError(`Ozon API [${res.status}]: ${message}`, res.status);
  }
  return res.json() as Promise<T>;
}

/** POST /v3/product/list — mahsulotlar ro'yxati (last_id kursor bilan) */
export async function getProductList(
  creds: OzonCreds,
  { size = 20, lastId = '' }: { size?: number; lastId?: string } = {},
): Promise<{ items: any[]; total?: number; lastId?: string }> {
  const data = await ozonFetch<any>(creds, '/v3/product/list', {
    filter: { visibility: 'ALL' },
    last_id: lastId,
    limit: size,
  });
  return {
    items: data?.result?.items || [],
    total: data?.result?.total,
    lastId: data?.result?.last_id,
  };
}

/** POST /v3/product/info/list — mahsulotlar tafsiloti (nom, shtrix-kod, narx) */
export async function getProductInfo(creds: OzonCreds, productIds: number[]): Promise<any[]> {
  if (!productIds.length) return [];
  const data = await ozonFetch<any>(creds, '/v3/product/info/list', {
    product_id: productIds,
  });
  return data?.items || data?.result?.items || [];
}

/** POST /v3/posting/fbs/list — FBS buyurtmalar (sana oralig'i majburiy) */
export async function getFbsPostings(
  creds: OzonCreds,
  {
    size = 20,
    offset = 0,
    since,
    to,
  }: { size?: number; offset?: number; since: string; to: string },
): Promise<{ items: any[]; hasNext?: boolean }> {
  const data = await ozonFetch<any>(creds, '/v3/posting/fbs/list', {
    dir: 'DESC',
    filter: { since, to },
    limit: size,
    offset,
    with: { financial_data: true },
  });
  return {
    items: data?.result?.postings || [],
    hasNext: data?.result?.has_next,
  };
}

/** POST /v4/product/info/stocks — qoldiqlar */
export async function getStocks(
  creds: OzonCreds,
  { size = 20, cursor = '' }: { size?: number; cursor?: string } = {},
): Promise<{ items: any[]; cursor?: string }> {
  const data = await ozonFetch<any>(creds, '/v4/product/info/stocks', {
    filter: { visibility: 'ALL' },
    cursor,
    limit: size,
  });
  return {
    items: data?.items || data?.result?.items || [],
    cursor: data?.cursor || data?.result?.cursor,
  };
}

// ─── KATEGORIYALAR ───────────────────────────────────────

/**
 * POST /v1/description-category/tree — kategoriyalar va tovar turlari daraxti.
 *
 * Ozon kartochka yaratishda ikkita raqamni talab qiladi:
 *   description_category_id — oxirgidan oldingi daraja ("Kanselyariya tovarlari")
 *   type_id                 — barg ("Narx yorlig'i"), u 8229 atributining qiymati
 *
 * Ikkalasi ham shu daraxtdan olinadi, boshqa yo'l yo'q.
 */
export function getCategoryTree(creds: OzonCreds, language = 'RU'): Promise<any> {
  return ozonFetch(creds, '/v1/description-category/tree', { language });
}

/** POST /v1/description-category/attribute — shu kategoriya+tur uchun atributlar ro'yxati */
export async function getCategoryAttributes(
  creds: OzonCreds,
  categoryId: number,
  typeId: number,
  language = 'RU',
): Promise<any[]> {
  const data = await ozonFetch<any>(creds, '/v1/description-category/attribute', {
    description_category_id: categoryId,
    type_id: typeId,
    language,
  });
  return data?.result || [];
}

/**
 * POST /v1/description-category/attribute/values — lug'atli atributning qiymatlari.
 *
 * Ba'zi atributlar erkin matn emas, ro'yxatdan tanlanadi (rang, material).
 * Bunday atributda `dictionary_id > 0` bo'ladi va qiymat `dictionary_value_id`
 * sifatida yuboriladi — matn yuborilsa Ozon rad etadi.
 */
export async function getAttributeValues(
  creds: OzonCreds,
  categoryId: number,
  typeId: number,
  attributeId: number,
  { limit = 100, lastValueId = 0 }: { limit?: number; lastValueId?: number } = {},
): Promise<any[]> {
  const data = await ozonFetch<any>(creds, '/v1/description-category/attribute/values', {
    description_category_id: categoryId,
    type_id: typeId,
    attribute_id: attributeId,
    limit,
    last_value_id: lastValueId,
    language: 'RU',
  });
  return data?.result || [];
}

/** POST /v1/product/import/info — import vazifasining natijasi (xatolar shu yerda) */
export function getImportInfo(creds: OzonCreds, taskId: string | number): Promise<any> {
  return ozonFetch(creds, '/v1/product/import/info', { task_id: Number(taskId) });
}

/** POST /v3/product/import — kartochka yaratish/yangilash (asinxron, task_id qaytadi) */
export function importProducts(creds: OzonCreds, body: unknown): Promise<any> {
  return ozonFetch(creds, '/v3/product/import', body);
}

// ─── NARX VA QOLDIQ ──────────────────────────────────────

/**
 * POST /v1/product/import/prices — narxlarni yangilash.
 * `offer_id` — sotuvchi artikuli, ya'ni bizdagi Product.sku.
 */
export function updatePrices(
  creds: OzonCreds,
  prices: Array<{ offer_id: string; price: string; old_price?: string }>,
): Promise<any> {
  return ozonFetch(creds, '/v1/product/import/prices', {
    prices: prices.map((p) => ({
      offer_id: p.offer_id,
      price: p.price,
      // Ozon "0" ni "chegirmagacha narx yo'q" deb tushunadi
      old_price: p.old_price ?? '0',
      auto_action_enabled: 'UNKNOWN',
    })),
  });
}

/** POST /v1/product/import/stocks — qoldiqlarni yangilash (bir so'rovda 100 tagacha) */
export function updateStocks(
  creds: OzonCreds,
  stocks: Array<{ offer_id: string; stock: number }>,
): Promise<any> {
  return ozonFetch(creds, '/v1/product/import/stocks', { stocks });
}

// ─── BUYURTMA AMALLARI (FBS) ─────────────────────────────

/**
 * POST /v1/cancel-reason/list-by-posting — shu jo'natma uchun bekor qilish sabablari.
 *
 * Ozon `cancel_reason_id` ni raqamda talab qiladi va ro'yxat jo'natmaga qarab
 * farq qiladi (bekor qilish yig'ishdan oldinmi yoki keyinmi). Shuning uchun
 * sabablarni qattiq yozib qo'yib bo'lmaydi — har safar so'raladi.
 */
export async function getCancelReasons(
  creds: OzonCreds,
  postingNumber: string,
): Promise<Array<{ id: number; title: string; typeId?: string }>> {
  const data = await ozonFetch<any>(creds, '/v1/cancel-reason/list-by-posting', {
    related_posting_numbers: [postingNumber],
  });

  const first = (data?.result || data?.reasons || [])[0];
  const list: any[] = first?.reasons || data?.result || [];

  return list
    .map((r: any) => ({
      id: Number(r?.id ?? r?.cancel_reason_id),
      title: String(r?.title ?? r?.cancel_reason ?? '').trim(),
      typeId: r?.type_id ?? r?.cancellation_type,
    }))
    .filter((r) => Number.isFinite(r.id) && r.title);
}

/**
 * POST /v2/posting/fbs/cancel — jo'natmani bekor qilish.
 *
 * `posting_number` va `cancel_reason_id` ikkalasi ham majburiy.
 * Ba'zi sabablar uchun Ozon izoh (`cancel_reason_message`) ham talab qiladi.
 */
export function cancelPosting(
  creds: OzonCreds,
  postingNumber: string,
  cancelReasonId: number,
  message?: string,
): Promise<any> {
  return ozonFetch(creds, '/v2/posting/fbs/cancel', {
    posting_number: postingNumber,
    cancel_reason_id: cancelReasonId,
    cancel_reason_message: message || '',
  });
}
