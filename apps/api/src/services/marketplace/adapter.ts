/**
 * Umumiy marketplace adapteri.
 *
 * Har bir marketplace (UZUM / YANDEX / OZON / WB) shu bitta interfeys orqali
 * ishlaydi — frontend bitta formatdagi javob oladi va yangi marketplace
 * qo'shish uchun faqat shu ro'yxatga adapter qo'shish kifoya.
 */

import * as uzum from './uzum-api.service';
import * as yandex from './yandex-api.service';
import * as ozon from './ozon-api.service';
import * as wb from './wb-api.service';
import { firstArray, pickDate, pickNumber, pickString } from './normalize';

export type Marketplace = 'UZUM' | 'OZON' | 'WB' | 'YANDEX';

export interface AdapterCreds {
  apiKey: string;
  apiSecret?: string | null;
  shopId?: string | null;
}

export interface TestResult {
  success: boolean;
  message: string;
  shopId?: string;
  shopName?: string;
}

export interface NormalizedProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  stock?: number;
  status?: string;
  image?: string;
}

/** Buyurtma ichidagi bitta pozitsiya — "nima ko'p sotilyapti" tahlili uchun kerak */
export interface NormalizedOrderItem {
  sku: string;
  name?: string;
  qty: number;
  price?: number;
}

export interface NormalizedOrder {
  id: string;
  date?: string;
  status?: string;
  itemsCount?: number;
  total?: number;
  items?: NormalizedOrderItem[];
}

export interface NormalizedStock {
  sku: string;
  name?: string;
  amount: number;
  warehouse?: string;
}

export interface ListResult<T> {
  items: T[];
  total?: number;
}

export interface Summary {
  marketplace: Marketplace;
  orders: number;
  revenue: number;
  currency: string;
  periodDays: number;
}

export interface PageParams {
  page: number; // 0 dan boshlanadi
  size: number;
  /** Sana oynasi talab qiladigan API'lar uchun (WB, Ozon, Yandex buyurtmalari) */
  days?: number;
}

export interface MarketplaceAdapter {
  /**
   * API qabul qiladigan eng katta sahifa hajmi.
   * Uzum'da 100 so'ralsa "Illegal argument" qaytadi — shuning uchun chegaralaymiz.
   */
  maxPageSize?: number;
  /** Kalitni tekshirish; imkon bo'lsa do'kon ID/nomini ham qaytaradi */
  test(creds: AdapterCreds): Promise<TestResult>;
  getProducts(creds: AdapterCreds, params: PageParams): Promise<ListResult<NormalizedProduct>>;
  getOrders(creds: AdapterCreds, params: PageParams): Promise<ListResult<NormalizedOrder>>;
  getStocks(creds: AdapterCreds, params: PageParams): Promise<ListResult<NormalizedStock>>;
  /** So'nggi N kun bo'yicha buyurtmalar soni va daromad */
  getSummary(creds: AdapterCreds, days: number): Promise<Summary>;
}

function requireShopId(creds: AdapterCreds, hint: string): string {
  if (!creds.shopId) throw new Error(hint);
  return creds.shopId;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Buyurtma pozitsiyalarini yagona ko'rinishga keltirish.
 * Har bir marketplace o'z nomlarini ishlatadi, shuning uchun kalitlar ro'yxati bilan qidiramiz.
 */
function normalizeItems(raw: unknown, keys: string[]): NormalizedOrderItem[] {
  return firstArray(raw, keys)
    .map((it: any) => ({
      sku:
        pickString(it, ['offerId', 'offer_id', 'shopSku', 'sku', 'skuId', 'supplierArticle', 'vendorCode', 'barcode', 'productId']) ||
        '',
      name: pickString(it, ['offerName', 'name', 'title', 'productTitle', 'skuTitle', 'subject']),
      qty: pickNumber(it, ['count', 'quantity', 'amount', 'qty']) ?? 1,
      price: pickNumber(it, ['price', 'sellPrice', 'buyerPrice', 'totalPrice', 'finishedPrice', 'priceWithDisc']),
    }))
    .filter((it) => it.sku || it.name);
}

// ─── UZUM ────────────────────────────────────────────────

/**
 * Uzum mahsuloti: nom, narx, rasm va qoldiq — hammasi `skuList` ichida.
 * Yuqori darajada `title` maydoni umuman yo'q, shuning uchun birinchi SKU'dan olamiz.
 */
function uzumFirstSku(product: any): any {
  return firstArray(product, ['skuList', 'skus', 'productSkus'])[0] || {};
}

/**
 * Uzum `previewImage` faqat kalit qaytaradi (`https://images.uzum.uz/<key>`) —
 * fayl nomisiz bu havola rasm sifatida ochilmaydi. Moliyaviy javobdagi to'liq
 * havolalardan ko'rinib turibdiki, oxiriga o'lcham qo'shish kerak.
 */
function uzumImageUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(raw)) return raw;
  return `${raw.replace(/\/+$/, '')}/t_product_240_high.jpg`;
}

/** Do'kondagi sotuvga tayyor qoldiq — barcha SKU'lar bo'yicha jami */
function uzumStockTotal(product: any): number {
  const skus = firstArray(product, ['skuList', 'skus', 'productSkus']);
  if (!skus.length) return pickNumber(product, ['quantityActive', 'quantity', 'amount']) ?? 0;
  return skus.reduce(
    (sum: number, s: any) => sum + (pickNumber(s, ['quantityActive', 'quantityAvailable']) ?? 0),
    0,
  );
}

const uzumAdapter: MarketplaceAdapter = {
  // Tekshirilgan: size=50 ishlaydi, size=60 dan boshlab "Illegal argument"
  maxPageSize: 50,

  async test(creds) {
    // Yangi yaratilgan kalit Uzum tomonida darhol faollashmasligi mumkin —
    // oraliq kutish bilan bir necha marta urinamiz.
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 4000;
    let lastError = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const shops = await uzum.getShops(creds.apiKey);
        const shop = shops[0];
        return {
          success: true,
          shopId: shop ? String(shop.id) : undefined,
          shopName: shop?.name,
          message: shop ? `Kalit ishlayapti — do'kon: ${shop.name}` : 'Kalit ishlayapti',
        };
      } catch (err: any) {
        lastError = err.message;
        const status = err instanceof uzum.UzumApiError ? err.status : undefined;
        // 401/403 — kalit hali faollashmagan bo'lishi mumkin, qayta urinamiz
        if (status && status !== 401 && status !== 403) break;
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    return {
      success: false,
      message: `Kalit ishlamadi (${lastError}) — yangi kalit bo'lsa, 1-2 daqiqadan so'ng qayta urinib ko'ring`,
    };
  },

  async getProducts(creds, { page, size }) {
    const shopId = requireShopId(creds, "Uzum do'kon ID topilmadi — avval 'Test qilish' ni bosing");
    const raw: any = await uzum.getProducts(creds.apiKey, shopId, { page, size });
    const list = firstArray(raw, ['productList', 'products', 'items', 'content', 'payload']);
    return {
      items: list.map((p: any) => {
        const sku = uzumFirstSku(p);
        return {
          id: pickString(p, ['productId', 'id', 'skuId']) || '',
          name:
            pickString(sku, ['productTitle', 'skuFullTitle', 'skuTitle']) ||
            pickString(p, ['title', 'name']) ||
            'Nomsiz',
          sku: pickString(sku, ['skuTitle', 'sellerItemCode']) || pickString(p, ['vendorCode']),
          barcode: pickString(sku, ['barcode']),
          price: pickNumber(sku, ['price', 'marketPrice']),
          stock: uzumStockTotal(p),
          // Holat obyekt ko'rinishida keladi: { value, title, color }
          status: pickString(p?.status ?? p, ['title', 'value', 'state']),
          image: uzumImageUrl(pickString(sku, ['previewImage'])),
        };
      }),
      total: pickNumber(raw, ['totalProductsAmount', 'totalElements', 'total', 'totalCount']),
    };
  },

  async getOrders(creds, { page, size, days }) {
    const shopId = requireShopId(creds, "Uzum do'kon ID topilmadi — avval 'Test qilish' ni bosing");

    // 1) FBS buyurtmalari — o'zi yetkazib beradigan sotuvchilar uchun
    const raw: any = await uzum.getFbsOrders(creds.apiKey, shopId, { page, size, days });
    const list = firstArray(raw, ['orders', 'content', 'items', 'payload']);

    if (list.length) {
      return {
        items: list.map((o: any) => ({
          id: pickString(o, ['id', 'orderId', 'orderNumber']) || '',
          date: pickDate(o, ['dateCreated', 'createDate', 'createdAt', 'date', 'orderDate']),
          status: pickString(o, ['status', 'state']),
          itemsCount:
            pickNumber(o, ['itemsCount', 'itemsAmount']) ??
            (Array.isArray(o?.items) ? o.items.length : undefined),
          total: pickNumber(o, ['totalSum', 'totalPrice', 'price', 'amount', 'sum']),
          items: normalizeItems(o, ['items', 'orderItems', 'products']),
        })),
        total: pickNumber(raw, ['totalElements', 'total', 'totalCount']),
      };
    }

    // 2) FBS bo'sh bo'lsa (FBO bilan ishlaydigan do'konlar) — savdo moliyaviy
    // buyurtmalarda bo'ladi. Bu yerda har qator bitta pozitsiya: skuTitle + productId.
    const fin: any = await uzum.getFinanceOrders(creds.apiKey, shopId, { page, size });
    const finList = firstArray(fin, ['orderItems', 'orders', 'content', 'items', 'payload']);
    return {
      items: finList.map((o: any) => {
        // Maydonlar API javobidan aniqlangan: sellPrice — sotuv narxi,
        // amount — sotilgan dona (bekor qilinganda 0), sellerProfit — komissiyadan keyingi foyda.
        const price = pickNumber(o, ['sellPrice']) ?? 0;
        const qty = pickNumber(o, ['amount']) ?? 0;
        return {
          id: pickString(o, ['orderId', 'id']) || '',
          date: pickDate(o, ['date']),
          status: pickString(o, ['status']),
          itemsCount: 1,
          total: price * qty,
          items: [
            {
              sku: pickString(o, ['skuTitle']) || pickString(o, ['productId']) || '',
              name: pickString(o, ['productTitle', 'skuTitle']),
              qty,
              price,
            },
          ],
        };
      }),
      total: pickNumber(fin, ['totalElements', 'total', 'totalCount']),
    };
  },

  /**
   * Qoldiqlar mahsulotlar ro'yxatidan olinadi.
   *
   * Uzum'da qoldiqni O'QISH uchun alohida endpoint yo'q: /v2/fbs/sku/stocks faqat
   * yozish (POST) uchun, GET esa 404 qaytaradi; qolgan barcha variantlar
   * "RBAC: access denied" beradi. Mahsulot kartochkasida esa har bir SKU uchun
   * quantityActive/quantityAvailable bor — kerakli ma'lumot shu yerda.
   */
  async getStocks(creds, { page, size }) {
    const shopId = requireShopId(creds, "Uzum do'kon ID topilmadi — avval 'Test qilish' ni bosing");
    const raw: any = await uzum.getProducts(creds.apiKey, shopId, { page, size });
    const products = firstArray(raw, ['productList', 'products', 'items', 'content', 'payload']);

    const items: NormalizedStock[] = [];
    for (const p of products) {
      const skus = firstArray(p, ['skuList', 'skus', 'productSkus']);
      if (!skus.length) {
        items.push({
          sku: pickString(p, ['productId', 'id']) || '',
          name: pickString(p, ['title', 'name']),
          amount: pickNumber(p, ['quantityActive', 'quantity', 'amount']) ?? 0,
        });
        continue;
      }
      for (const s of skus) {
        items.push({
          sku: pickString(s, ['skuTitle', 'sellerItemCode', 'barcode', 'skuId']) || '',
          name: pickString(s, ['productTitle', 'skuFullTitle']),
          amount: pickNumber(s, ['quantityActive', 'quantityAvailable']) ?? 0,
        });
      }
    }

    return {
      items,
      total: pickNumber(raw, ['totalProductsAmount', 'totalElements', 'total', 'totalCount']),
    };
  },

  async getSummary(creds, days) {
    const shopId = requireShopId(creds, "Uzum do'kon ID topilmadi — avval 'Test qilish' ni bosing");
    const from = new Date();
    from.setDate(from.getDate() - days);

    let orders = 0;
    let revenue = 0;
    // Uzum sahifa hajmi 50 dan oshmasligi kerak — aks holda "Illegal argument"
    const PAGE = 50;
    for (let page = 0; page < 6; page++) {
      const raw: any = await uzum.getFinanceOrders(creds.apiKey, shopId, { page, size: PAGE });
      const list = firstArray(raw, ['orderItems', 'orders', 'content', 'items', 'payload']);
      if (!list.length) break;

      for (const o of list) {
        const date = pickDate(o, ['date']);
        if (date && new Date(date) < from) continue;
        // amount — sotilgan dona (bekor qilinganda 0), sellPrice — sotuv narxi
        const qty = pickNumber(o, ['amount']) ?? 0;
        if (qty <= 0) continue;
        orders += 1;
        revenue += (pickNumber(o, ['sellPrice']) ?? 0) * qty;
      }
      if (list.length < PAGE) break;
    }

    return { marketplace: 'UZUM', orders, revenue, currency: 'UZS', periodDays: days };
  },
};

// ─── YANDEX ──────────────────────────────────────────────

/** Yandex buyurtmalar filtri DD-MM-YYYY formatini kutadi */
function yandexDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** Token-kursorli API'da kerakli sahifagacha yurish */
async function yandexOffersPage(apiKey: string, campaignId: string, page: number, size: number) {
  let pageToken: string | undefined;
  for (let i = 0; ; i++) {
    const raw: any = await yandex.getOffers(apiKey, campaignId, { size, pageToken });
    if (i >= page) return raw;
    pageToken = raw?.result?.paging?.nextPageToken;
    if (!pageToken) return { result: { offers: [] } };
  }
}

/**
 * Yandex'da nom va rasm do'kon (campaign) emas, kabinet (business) darajasida saqlanadi —
 * /campaigns/{id}/offers faqat offerId, narx va holatni beradi. Shuning uchun
 * kartochkalarni offer-mappings'dan alohida olib, offerId bo'yicha birlashtiramiz.
 */
async function yandexCards(
  apiKey: string,
  campaignId: string,
  offerIds: string[],
): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (!offerIds.length) return map;
  try {
    const businessId = await yandex.resolveBusinessId(apiKey, campaignId);
    if (!businessId) return map;
    const raw: any = await yandex.getOfferMappings(apiKey, businessId, { offerIds });
    for (const entry of firstArray(raw, ['offerMappings'])) {
      const offer = entry?.offer || entry;
      const id = pickString(offer, ['offerId']);
      if (id) map.set(id, { offer, mapping: entry?.mapping });
    }
  } catch {
    // Kartochkalar olinmasa ham ro'yxat ko'rinaverishi kerak
  }
  return map;
}

/** Sotuvga yaroqli qoldiq turlari — muzlatilgan/brak/muddati o'tganlarini hisoblamaymiz */
const YANDEX_SELLABLE_STOCK = new Set(['AVAILABLE', 'FIT']);

function yandexStockCount(offer: any): number {
  return firstArray(offer, ['stocks']).reduce((sum: number, s: any) => {
    const type = pickString(s, ['type']);
    if (type && !YANDEX_SELLABLE_STOCK.has(type)) return sum;
    return sum + (pickNumber(s, ['count', 'amount']) ?? 0);
  }, 0);
}

/** offerId → qoldiq (barcha omborlar bo'yicha jami) */
async function yandexStockMap(
  apiKey: string,
  campaignId: string,
  offerIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!offerIds.length) return map;
  try {
    const raw: any = await yandex.getStocks(apiKey, campaignId, { offerIds });
    for (const w of firstArray(raw, ['warehouses'])) {
      for (const offer of firstArray(w, ['offers'])) {
        const id = pickString(offer, ['offerId']);
        if (!id) continue;
        map.set(id, (map.get(id) ?? 0) + yandexStockCount(offer));
      }
    }
  } catch {
    // Qoldiqlar olinmasa ustun bo'sh qoladi
  }
  return map;
}

const yandexAdapter: MarketplaceAdapter = {
  async test(creds) {
    try {
      const campaigns = await yandex.getCampaigns(creds.apiKey);
      const campaign = campaigns[0];
      if (!campaign) {
        return { success: false, message: "Kalit ishlayapti, lekin kabinetda do'kon (campaign) topilmadi" };
      }
      const name = campaign.business?.name || campaign.domain || `Campaign ${campaign.id}`;
      return {
        success: true,
        shopId: String(campaign.id),
        shopName: name,
        message: `Kalit ishlayapti — do'kon: ${name}`,
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  async getProducts(creds, { page, size }) {
    const campaignId = requireShopId(creds, "Yandex campaign ID topilmadi — avval 'Test qilish' ni bosing");
    const raw: any = await yandexOffersPage(creds.apiKey, campaignId, page, size);
    const list = firstArray(raw, ['offers', 'offerMappings', 'items']);

    const offerIds = list
      .map((entry: any) => pickString(entry?.offer || entry, ['offerId']))
      .filter((id): id is string => !!id);

    // Nom/rasm va qoldiq alohida endpointlarda — parallel olib, offerId bo'yicha qo'shamiz
    const [cards, stocks] = await Promise.all([
      yandexCards(creds.apiKey, campaignId, offerIds),
      yandexStockMap(creds.apiKey, campaignId, offerIds),
    ]);

    return {
      items: list.map((entry: any) => {
        const offer = entry?.offer || entry;
        const id = pickString(offer, ['offerId', 'id', 'marketSku']) || '';
        const card = cards.get(id);
        const cardOffer = card?.offer;
        return {
          id,
          name:
            pickString(cardOffer, ['name']) ||
            pickString(card?.mapping, ['marketSkuName', 'marketModelName']) ||
            pickString(offer, ['name', 'title']) ||
            'Nomsiz',
          sku: pickString(offer, ['offerId', 'shopSku']) || pickString(cardOffer, ['vendorCode']),
          barcode: Array.isArray(cardOffer?.barcodes) ? String(cardOffer.barcodes[0] ?? '') : undefined,
          price: pickNumber(offer?.basicPrice ?? offer, ['value', 'price']),
          stock: stocks.get(id),
          status: pickString(entry, ['cardStatus', 'status']),
          image: Array.isArray(cardOffer?.pictures) ? cardOffer.pictures[0] : undefined,
        };
      }),
      total: pickNumber(raw?.result?.paging ?? raw, ['total', 'totalElements']),
    };
  },

  async getOrders(creds, { page, size, days }) {
    const campaignId = requireShopId(creds, "Yandex campaign ID topilmadi — avval 'Test qilish' ni bosing");
    // Yandex sahifalari 1 dan boshlanadi
    const raw: any = await yandex.getOrders(creds.apiKey, campaignId, {
      page: page + 1,
      size,
      fromDate: days ? yandexDate(days) : undefined,
    });
    const list = firstArray(raw, ['orders', 'items']);
    return {
      items: list.map((o: any) => ({
        id: pickString(o, ['id', 'orderId']) || '',
        date: pickDate(o, ['creationDate', 'createdAt', 'date']),
        status: pickString(o, ['status', 'substatus']),
        itemsCount: Array.isArray(o?.items) ? o.items.length : undefined,
        total: pickNumber(o, ['itemsTotal', 'buyerItemsTotal', 'total', 'buyerTotal']),
        items: normalizeItems(o, ['items']),
      })),
      total: pickNumber(raw?.pager ?? raw, ['total']),
    };
  },

  async getStocks(creds, { page, size }) {
    const campaignId = requireShopId(creds, "Yandex campaign ID topilmadi — avval 'Test qilish' ni bosing");
    const raw: any = await yandex.getStocks(creds.apiKey, campaignId, { size: 200 });
    const warehouses = firstArray(raw, ['warehouses']);
    const items: NormalizedStock[] = [];
    for (const w of warehouses) {
      for (const offer of firstArray(w, ['offers', 'items'])) {
        items.push({
          sku: pickString(offer, ['offerId', 'sku', 'shopSku']) || '',
          name: pickString(offer, ['name', 'title']),
          amount: yandexStockCount(offer),
          warehouse: pickString(w, ['name']) || (w?.warehouseId ? `Ombor ${w.warehouseId}` : undefined),
        });
      }
    }

    // Nomlar qoldiqlar javobida yo'q — kartochkalardan olamiz
    const page_ = items.slice(page * size, page * size + size);
    const cards = await yandexCards(
      creds.apiKey,
      campaignId,
      page_.map((s) => s.sku).filter(Boolean),
    );
    for (const s of page_) {
      s.name = s.name || pickString(cards.get(s.sku)?.offer, ['name']);
    }
    return { items: page_, total: items.length };
  },

  async getSummary(creds, days) {
    const campaignId = requireShopId(creds, "Yandex campaign ID topilmadi — avval 'Test qilish' ni bosing");
    const fromDate = yandexDate(days);

    let orders = 0;
    let revenue = 0;
    for (let page = 1; page <= 5; page++) {
      const raw: any = await yandex.getOrders(creds.apiKey, campaignId, {
        page,
        size: 50,
        fromDate,
      });
      const list = firstArray(raw, ['orders', 'items']);
      if (!list.length) break;
      for (const o of list) {
        orders += 1;
        revenue += pickNumber(o, ['itemsTotal', 'buyerItemsTotal', 'total', 'buyerTotal']) ?? 0;
      }
      const pagesCount = pickNumber(raw?.pager ?? {}, ['pagesCount']);
      if (pagesCount && page >= pagesCount) break;
    }
    return { marketplace: 'YANDEX', orders, revenue, currency: 'RUB', periodDays: days };
  },
};

// ─── OZON ────────────────────────────────────────────────

function ozonCreds(creds: AdapterCreds): ozon.OzonCreds {
  if (!creds.apiSecret) {
    throw new Error("Ozon uchun Client-Id kiritilmagan — ulanish oynasida 'Client-Id' maydonini to'ldiring");
  }
  return { apiKey: creds.apiKey, clientId: creds.apiSecret };
}

const ozonAdapter: MarketplaceAdapter = {
  async test(creds) {
    try {
      const c = ozonCreds(creds);
      const { total } = await ozon.getProductList(c, { size: 1 });
      return {
        success: true,
        message: `Kalit ishlayapti — kabinetda ${total ?? 0} ta mahsulot`,
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  async getProducts(creds, { page, size }) {
    const c = ozonCreds(creds);
    // last_id kursori bilan kerakli sahifagacha yuramiz
    let lastId = '';
    let chunk: { items: any[]; total?: number; lastId?: string } = { items: [] };
    for (let i = 0; i <= page; i++) {
      chunk = await ozon.getProductList(c, { size, lastId });
      lastId = chunk.lastId || '';
      if (!chunk.items.length) break;
    }

    const ids = chunk.items
      .map((p: any) => pickNumber(p, ['product_id', 'productId']))
      .filter((id): id is number => typeof id === 'number');
    const info = await ozon.getProductInfo(c, ids);
    const infoById = new Map(info.map((p: any) => [pickNumber(p, ['id', 'product_id']), p]));

    return {
      items: chunk.items.map((p: any) => {
        const id = pickNumber(p, ['product_id', 'productId']);
        const detail: any = infoById.get(id) || {};
        return {
          id: String(id ?? ''),
          name: pickString(detail, ['name', 'title']) || pickString(p, ['offer_id']) || 'Nomsiz',
          sku: pickString(p, ['offer_id']) || pickString(detail, ['offer_id']),
          barcode: Array.isArray(detail?.barcodes) ? detail.barcodes[0] : pickString(detail, ['barcode']),
          price: pickNumber(detail, ['marketing_price', 'price', 'min_price']),
          stock: pickNumber(detail?.stocks ?? detail, ['present', 'stock', 'coming']),
          status: pickString(detail?.statuses ?? detail, ['status', 'status_name', 'state']),
          image: Array.isArray(detail?.images) ? detail.images[0] : pickString(detail, ['primary_image']),
        };
      }),
      total: chunk.total,
    };
  },

  async getOrders(creds, { page, size, days = 90 }) {
    const c = ozonCreds(creds);
    const { items } = await ozon.getFbsPostings(c, {
      size,
      offset: page * size,
      since: daysAgoIso(days),
      to: new Date().toISOString(),
    });
    return {
      items: items.map((o: any) => {
        const products = Array.isArray(o?.products) ? o.products : [];
        const total = products.reduce(
          (sum: number, p: any) =>
            sum + (pickNumber(p, ['price']) ?? 0) * (pickNumber(p, ['quantity']) ?? 1),
          0,
        );
        return {
          id: pickString(o, ['posting_number', 'order_number', 'order_id']) || '',
          date: pickDate(o, ['in_process_at', 'shipment_date', 'created_at']),
          status: pickString(o, ['status', 'substatus']),
          itemsCount: products.length || undefined,
          total: total || pickNumber(o?.financial_data ?? o, ['total', 'payout']),
          items: normalizeItems(o, ['products']),
        };
      }),
    };
  },

  async getStocks(creds, { page, size }) {
    const c = ozonCreds(creds);
    let cursor = '';
    let chunk: { items: any[]; cursor?: string } = { items: [] };
    for (let i = 0; i <= page; i++) {
      chunk = await ozon.getStocks(c, { size, cursor });
      cursor = chunk.cursor || '';
      if (!chunk.items.length) break;
    }
    return {
      items: chunk.items.map((s: any) => {
        const stocks = Array.isArray(s?.stocks) ? s.stocks : [];
        const amount = stocks.reduce(
          (sum: number, st: any) => sum + (pickNumber(st, ['present', 'count', 'amount']) ?? 0),
          0,
        );
        return {
          sku: pickString(s, ['offer_id', 'sku', 'product_id']) || '',
          name: pickString(s, ['name', 'title']),
          amount: amount || (pickNumber(s, ['present', 'amount']) ?? 0),
        };
      }),
    };
  },

  async getSummary(creds, days) {
    const c = ozonCreds(creds);
    let orders = 0;
    let revenue = 0;
    for (let page = 0; page < 5; page++) {
      const { items, hasNext } = await ozon.getFbsPostings(c, {
        size: 100,
        offset: page * 100,
        since: daysAgoIso(days),
        to: new Date().toISOString(),
      });
      if (!items.length) break;
      for (const o of items) {
        orders += 1;
        const products = Array.isArray(o?.products) ? o.products : [];
        revenue += products.reduce(
          (sum: number, p: any) =>
            sum + (pickNumber(p, ['price']) ?? 0) * (pickNumber(p, ['quantity']) ?? 1),
          0,
        );
      }
      if (!hasNext) break;
    }
    return { marketplace: 'OZON', orders, revenue, currency: 'RUB', periodDays: days };
  },
};

// ─── WILDBERRIES ─────────────────────────────────────────

const wbAdapter: MarketplaceAdapter = {
  async test(creds) {
    const info = wb.decodeToken(creds.apiKey);
    if (info?.isExpired) {
      return {
        success: false,
        message: `Token muddati tugagan (${info.expiresAt?.toLocaleDateString('uz-UZ')}) — kabinetda yangi token yarating`,
      };
    }

    // Token'ning har bir kerakli kategoriyasini alohida tekshiramiz
    const access = await wb.checkAccess(creds.apiKey);
    const missing = access.filter((a) => !a.ok);

    if (missing.length === access.length) {
      // Hech biri ishlamadi — kalitning o'zi yaroqsiz yoki hech qanday ruxsat berilmagan
      return { success: false, message: missing[0]?.error || 'Kalit ishlamadi' };
    }

    const base = info?.sellerId ? `Kalit ishlayapti — sotuvchi ID: ${info.sellerId}` : 'Kalit ishlayapti';
    if (missing.length) {
      return {
        success: true,
        shopId: info?.sellerId,
        message:
          `${base}. Lekin token'da ${missing.map((m) => `"${m.label}"`).join(', ')} ruxsati yo'q — ` +
          `${missing.map((m) => m.needed.toLowerCase()).join(', ')} ko'rinmaydi. ` +
          'Kabinetda shu kategoriyalarni belgilab, yangi token yarating.',
      };
    }
    return { success: true, shopId: info?.sellerId, message: base };
  },

  async getProducts(creds, { page, size }) {
    // WB kursorli — kerakli sahifagacha yuramiz
    let updatedAt: string | undefined;
    let nmID: number | undefined;
    let cards: any[] = [];
    let total: number | undefined;
    for (let i = 0; i <= page; i++) {
      const res = await wb.getCards(creds.apiKey, { size, updatedAt, nmID });
      cards = res.cards;
      total = res.cursor?.total ?? total;
      updatedAt = res.cursor?.updatedAt;
      nmID = res.cursor?.nmID;
      if (!cards.length) break;
    }
    return {
      items: cards.map((c: any) => {
        const photos = Array.isArray(c?.photos) ? c.photos : [];
        const sizes = Array.isArray(c?.sizes) ? c.sizes : [];
        const skus = sizes.flatMap((s: any) => (Array.isArray(s?.skus) ? s.skus : []));
        return {
          id: pickString(c, ['nmID', 'nmId', 'imtID']) || '',
          name: pickString(c, ['title', 'subjectName', 'vendorCode']) || 'Nomsiz',
          sku: pickString(c, ['vendorCode']),
          barcode: skus[0] ? String(skus[0]) : undefined,
          image: photos[0]?.c246x328 || photos[0]?.big || undefined,
          status: pickString(c, ['status']),
        };
      }),
      total,
    };
  },

  async getOrders(creds, { page, size, days = 30 }) {
    const all = await wb.getOrders(creds.apiKey, daysAgoIso(days).split('T')[0]);
    const list = Array.isArray(all) ? all : firstArray(all, ['orders']);
    const sorted = [...list].sort((a, b) =>
      String(b?.date ?? '').localeCompare(String(a?.date ?? '')),
    );
    return {
      // WB statistikasi har bir pozitsiyani alohida qator qilib qaytaradi —
      // shuning uchun buyurtmaning o'zi bitta pozitsiyadan iborat
      items: sorted.slice(page * size, page * size + size).map((o: any) => ({
        id: pickString(o, ['srid', 'odid', 'gNumber']) || '',
        date: pickDate(o, ['date', 'lastChangeDate']),
        status: o?.isCancel ? 'CANCELLED' : pickString(o, ['orderType', 'status']) || 'NEW',
        total: pickNumber(o, ['priceWithDisc', 'finishedPrice', 'totalPrice']),
        items: [
          {
            sku: pickString(o, ['supplierArticle', 'nmId', 'barcode']) || '',
            name: pickString(o, ['subject', 'category', 'brand']),
            qty: 1,
            price: pickNumber(o, ['priceWithDisc', 'finishedPrice', 'totalPrice']),
          },
        ],
      })),
      total: sorted.length,
    };
  },

  async getStocks(creds, { page, size }) {
    const all = await wb.getStocks(creds.apiKey, '2020-01-01');
    const list = Array.isArray(all) ? all : firstArray(all, ['stocks']);
    return {
      items: list.slice(page * size, page * size + size).map((s: any) => ({
        sku: pickString(s, ['supplierArticle', 'barcode', 'nmId']) || '',
        name: pickString(s, ['subject', 'category', 'brand']),
        amount: pickNumber(s, ['quantity', 'quantityFull']) ?? 0,
        warehouse: pickString(s, ['warehouseName']),
      })),
      total: list.length,
    };
  },

  async getSummary(creds, days) {
    const dateFrom = daysAgoIso(days).split('T')[0];
    const all = await wb.getSales(creds.apiKey, dateFrom);
    const list = Array.isArray(all) ? all : firstArray(all, ['sales']);
    let revenue = 0;
    for (const s of list) {
      revenue += pickNumber(s, ['forPay', 'finishedPrice', 'priceWithDisc']) ?? 0;
    }
    return { marketplace: 'WB', orders: list.length, revenue, currency: 'RUB', periodDays: days };
  },
};

// ─── REGISTRY ────────────────────────────────────────────

const ADAPTERS: Record<Marketplace, MarketplaceAdapter> = {
  UZUM: uzumAdapter,
  YANDEX: yandexAdapter,
  OZON: ozonAdapter,
  WB: wbAdapter,
};

export function getAdapter(marketplace: string): MarketplaceAdapter {
  const adapter = ADAPTERS[marketplace as Marketplace];
  if (!adapter) throw new Error(`Noma'lum marketplace: ${marketplace}`);
  return adapter;
}
