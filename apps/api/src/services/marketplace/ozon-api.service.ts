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
