/**
 * Narx va qoldiqni MarketFlow'dan marketplace'ga yuborish (orqaga sinxronlash)
 *
 * Shu paytgacha ma'lumot faqat bir yo'nalishda yurardi: marketplace'dan bizga.
 * Bu modul teskarisini qiladi — sotuvchi narxni bitta joyda o'zgartiradi,
 * u to'rttala platformaga ketadi.
 *
 * IKKI XAVF BOR, ikkalasi ham jimgina o'tib ketadigan turdan:
 *
 * 1. VALYUTA. Uzum UZS da, Ozon/WB/Yandex RUB da ishlaydi. 234 000 so'mni
 *    Ozon'ga yuborsak, u 234 000 rubl bo'lib qoladi — ya'ni tovar ~100 barobar
 *    qimmatlashadi va buni hech kim darhol sezmaydi. Shuning uchun narx FAQAT
 *    o'sha marketplace uchun kiritilgan qiymatdan olinadi; boshqa valyutadagi
 *    qiymatga "tushish" ATAYIN qilinmagan.
 *
 * 2. IDENTIFIKATOR. Ozon va Yandex sotuvchi artikulini qabul qiladi, WB esa
 *    narx uchun nmID, qoldiq uchun barkod so'raydi; Uzum raqamli skuId.
 *    Noto'g'ri identifikator — boshqa tovarning narxini o'zgartirish demak,
 *    shuning uchun topilmagan artikul jimgina tashlanmaydi, xato sifatida
 *    qaytariladi.
 */

import { Marketplace } from '@prisma/client';
import * as uzum from './uzum-api.service';
import * as ozon from './ozon-api.service';
import * as wb from './wb-api.service';
import * as yandex from './yandex-api.service';
import { getSpec } from './specs';

export interface PriceStockItem {
  productId: string;
  title: string;
  /** Sotuvchi artikuli — barcha marketplace'larda shu bo'yicha topamiz */
  sku: string;
  barcode?: string | null;
  /** Shu marketplace valyutasidagi narx. Yo'q bo'lsa narx yuborilmaydi */
  price?: number;
  oldPrice?: number;
  /** Qoldiq — valyutaga bog'liq emas, har doim yuboriladi */
  stock?: number;
}

export interface PriceStockCreds {
  apiKey: string;
  apiSecret?: string | null;
  shopId?: string | null;
}

export interface PriceStockResult {
  /** Narxi yangilangan tovarlar soni */
  pricesUpdated: number;
  /** Qoldig'i yangilangan tovarlar soni */
  stocksUpdated: number;
  /** Yuborilmagan tovarlar — sababi bilan */
  failed: Array<{ productId: string; title: string; reason: string }>;
  /** Ketdi, lekin e'tibor talab qiladi */
  warnings: string[];
}

function emptyResult(): PriceStockResult {
  return { pricesUpdated: 0, stocksUpdated: 0, failed: [], warnings: [] };
}

/** Bir so'rovda nechta tovar — marketplace chegaralari bo'yicha */
const BATCH: Record<string, number> = { OZON: 100, WB: 1000, YANDEX: 500, UZUM: 100 };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ============================================
// OZON
// ============================================

async function pushOzon(creds: PriceStockCreds, items: PriceStockItem[]): Promise<PriceStockResult> {
  const result = emptyResult();
  if (!creds.apiSecret) throw new Error("Ozon uchun Client-Id kerak");
  const ozonCreds = { apiKey: creds.apiKey, clientId: creds.apiSecret };

  // Ozon `offer_id` sifatida sotuvchi artikulini qabul qiladi — qidiruv shart emas
  const withPrice = items.filter((i) => i.price !== undefined);
  const withStock = items.filter((i) => i.stock !== undefined);

  for (const batch of chunk(withPrice, BATCH.OZON)) {
    const raw: any = await ozon.updatePrices(
      ozonCreds,
      batch.map((i) => ({
        offer_id: i.sku,
        price: String(i.price),
        old_price: i.oldPrice ? String(i.oldPrice) : undefined,
      })),
    );
    // Xatolar to'planib boradi, shuning uchun shu partiyadagisini
    // oldin/keyin farqi bilan olamiz — aks holda ikkinchi partiyada
    // birinchisining xatolari ham ayirilib ketardi
    const before = result.failed.length;
    collectOzonErrors(raw, batch, result);
    result.pricesUpdated += batch.length - (result.failed.length - before);
  }

  for (const batch of chunk(withStock, BATCH.OZON)) {
    const raw: any = await ozon.updateStocks(
      ozonCreds,
      batch.map((i) => ({ offer_id: i.sku, stock: i.stock! })),
    );
    const before = result.failed.length;
    collectOzonErrors(raw, batch, result);
    result.stocksUpdated += batch.length - (result.failed.length - before);
  }

  return result;
}

/** Ozon har bir tovar uchun alohida natija qaytaradi — xatolarni ajratib olamiz */
function collectOzonErrors(raw: any, batch: PriceStockItem[], result: PriceStockResult) {
  const rows: any[] = raw?.result || [];
  const byOffer = new Map(batch.map((i) => [i.sku, i]));

  for (const row of rows) {
    if (row?.updated === true || !row?.errors?.length) continue;
    const item = byOffer.get(String(row?.offer_id));
    if (!item) continue;
    const reason = row.errors.map((e: any) => e?.message || e?.code).filter(Boolean).join('; ');
    result.failed.push({
      productId: item.productId,
      title: item.title,
      reason: reason || "Ozon qabul qilmadi",
    });
  }
}

// ============================================
// WILDBERRIES
// ============================================

async function pushWb(creds: PriceStockCreds, items: PriceStockItem[]): Promise<PriceStockResult> {
  const result = emptyResult();

  // WB narxni nmID, qoldiqni barkod bo'yicha yangilaydi — ikkalasi ham
  // bizda yo'q, shuning uchun kartochkalardan moslik jadvalini quramiz
  const index = await wb.buildVendorCodeIndex(creds.apiKey);

  const priced: Array<{ nmID: number; price: number; discount?: number }> = [];
  const stocked: Array<{ sku: string; amount: number }> = [];

  for (const item of items) {
    const found = index.get(item.sku);
    if (!found) {
      result.failed.push({
        productId: item.productId,
        title: item.title,
        reason: `"${item.sku}" artikuli WB katalogida topilmadi — kartochka joylanganmi?`,
      });
      continue;
    }

    if (item.price !== undefined && found.nmID) {
      // WB chegirmani foizda oladi: eski narxdan qancha tushgani
      const discount =
        item.oldPrice && item.oldPrice > item.price
          ? Math.round((1 - item.price / item.oldPrice) * 100)
          : undefined;
      priced.push({ nmID: found.nmID, price: Math.round(item.price), discount });
    }

    if (item.stock !== undefined) {
      const barcode = item.barcode || found.barcode;
      if (barcode) stocked.push({ sku: barcode, amount: item.stock });
      else {
        result.warnings.push(`${item.title}: barkod topilmadi, qoldiq yuborilmadi`);
      }
    }
  }

  for (const batch of chunk(priced, BATCH.WB)) {
    await wb.updatePrices(creds.apiKey, batch);
    result.pricesUpdated += batch.length;
  }

  if (stocked.length) {
    // Qoldiq ombor bo'yicha yuritiladi — sotuvchining FBS omborini topamiz
    const warehouses = await wb.getWarehouses(creds.apiKey);
    const warehouseId = warehouses[0]?.id ?? warehouses[0]?.officeId;

    if (!warehouseId) {
      result.warnings.push(
        "WB'da FBS ombori topilmadi — qoldiq yuborilmadi. Seller kabinetida ombor yarating.",
      );
    } else {
      if (warehouses.length > 1) {
        result.warnings.push(
          `WB'da ${warehouses.length} ta ombor bor — qoldiq birinchisiga (${warehouses[0]?.name ?? warehouseId}) yozildi`,
        );
      }
      for (const batch of chunk(stocked, BATCH.WB)) {
        await wb.updateStocks(creds.apiKey, warehouseId, batch);
        result.stocksUpdated += batch.length;
      }
    }
  }

  return result;
}

// ============================================
// YANDEX
// ============================================

async function pushYandex(
  creds: PriceStockCreds,
  items: PriceStockItem[],
): Promise<PriceStockResult> {
  const result = emptyResult();
  const campaignId = creds.shopId;
  if (!campaignId) throw new Error("Yandex kampaniya ID topilmadi — avval \"Test qilish\" ni bosing");

  const withStock = items.filter((i) => i.stock !== undefined);
  const withPrice = items.filter((i) => i.price !== undefined);

  for (const batch of chunk(withStock, BATCH.YANDEX)) {
    await yandex.updateStocks(
      creds.apiKey,
      campaignId,
      batch.map((i) => ({ sku: i.sku, count: i.stock! })),
    );
    result.stocksUpdated += batch.length;
  }

  if (withPrice.length) {
    // Narx kabinet darajasida — campaignId emas, businessId kerak
    const businessId = await yandex.resolveBusinessId(creds.apiKey, campaignId);
    if (!businessId) {
      result.warnings.push("Yandex kabinet ID topilmadi — narx yuborilmadi");
    } else {
      for (const batch of chunk(withPrice, BATCH.YANDEX)) {
        await yandex.updatePrices(
          creds.apiKey,
          businessId,
          batch.map((i) => ({ offerId: i.sku, value: i.price!, discountBase: i.oldPrice })),
        );
        result.pricesUpdated += batch.length;
      }
    }
  }

  return result;
}

// ============================================
// UZUM
// ============================================

async function pushUzum(creds: PriceStockCreds, items: PriceStockItem[]): Promise<PriceStockResult> {
  const result = emptyResult();
  const shopId = creds.shopId;
  if (!shopId) throw new Error("Uzum do'kon ID topilmadi — avval \"Test qilish\" ni bosing");

  // Uzum faqat raqamli skuId bilan ishlaydi
  const index = await uzum.buildSkuIndex(creds.apiKey, shopId);

  const priced: Array<{ skuId: number; price: number }> = [];
  const stocked: Array<{ skuId: number; amount: number }> = [];

  for (const item of items) {
    const skuId = index.get(item.sku) ?? (item.barcode ? index.get(item.barcode) : undefined);
    if (!skuId) {
      result.failed.push({
        productId: item.productId,
        title: item.title,
        reason: `"${item.sku}" artikuli Uzum katalogida topilmadi — Excel orqali yuklanganmi?`,
      });
      continue;
    }
    if (item.price !== undefined) priced.push({ skuId, price: Math.round(item.price) });
    if (item.stock !== undefined) stocked.push({ skuId, amount: item.stock });
  }

  for (const batch of chunk(priced, BATCH.UZUM)) {
    await uzum.updatePrices(creds.apiKey, shopId, batch);
    result.pricesUpdated += batch.length;
  }
  for (const batch of chunk(stocked, BATCH.UZUM)) {
    await uzum.updateFbsStocks(creds.apiKey, batch);
    result.stocksUpdated += batch.length;
  }

  return result;
}

// ============================================
// Umumiy kirish nuqtasi
// ============================================

/**
 * Narx va qoldiqni yuborish.
 *
 * `items` dagi narx allaqachon SHU marketplace valyutasida bo'lishi kerak —
 * bu funksiya valyuta o'girmaydi va o'girishga urinmaydi ham. Chaqiruvchi
 * tomonda (controller) boshqa valyutadagi qiymat umuman qo'shilmaydi.
 */
export async function pushPriceStock(
  marketplace: Marketplace,
  creds: PriceStockCreds,
  items: PriceStockItem[],
): Promise<PriceStockResult> {
  if (!items.length) return emptyResult();
  const spec = getSpec(marketplace);
  if (!spec) throw new Error("Bunday marketplace yo'q");

  switch (marketplace) {
    case 'OZON':
      return pushOzon(creds, items);
    case 'WB':
      return pushWb(creds, items);
    case 'YANDEX':
      return pushYandex(creds, items);
    case 'UZUM':
      return pushUzum(creds, items);
    default:
      throw new Error(`${spec.name} uchun narx/qoldiq yuborish qo'llab-quvvatlanmaydi`);
  }
}

/**
 * Shu marketplace valyutasidagi narxni topish.
 *
 * VALYUTA XAVFI: Uzum UZS, qolganlari RUB. 234 000 so'mni Ozon'ga yuborsak
 * u 234 000 rubl bo'lib qoladi — tovar ~100 barobar qimmatlashadi va buni
 * hech kim darhol sezmaydi. Shuning uchun boshqa valyutadagi qiymatga
 * "tushish" ATAYIN qilinmagan: narx topilmasa, u umuman yuborilmaydi.
 */
export function priceForMarketplace(
  product: { attributes: any; basePrice: any; currency: string },
  marketplaceId: string,
  specCurrency: string,
): { price?: number; oldPrice?: number; reason?: string } {
  const attrs = product.attributes || {};
  const num = (raw: unknown) => {
    const parsed = Number(String(raw ?? '').replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  // 1. Aynan shu marketplace formasida kiritilgan narx — valyutasi aniq to'g'ri
  const own = attrs.byMarketplace?.[marketplaceId];
  if (own) {
    const price = num(own.price);
    if (price) return { price, oldPrice: num(own.oldPrice) };
  }

  // 2. Kartochka shu marketplace uchun saqlangan bo'lsa
  if (attrs.marketplace === marketplaceId) {
    const price = num(attrs.values?.price);
    if (price) return { price, oldPrice: num(attrs.values?.oldPrice) };
  }

  // 3. Product narxi — faqat valyuta mos kelsa
  if (product.currency === specCurrency) {
    const price = num(product.basePrice?.toString());
    if (price) return { price };
  }

  return {
    reason:
      product.currency !== specCurrency
        ? `narx ${product.currency} da, ${specCurrency} kerak — kartochkada ${specCurrency} narxini kiriting`
        : 'narx kiritilmagan',
  };
}


/** Natijadan tushunarli xabar yig'ish */
export function buildSyncMessage(result: PriceStockResult, marketplaceName: string): string {
  const parts = [
    result.pricesUpdated ? `${result.pricesUpdated} ta narx` : '',
    result.stocksUpdated ? `${result.stocksUpdated} ta qoldiq` : '',
  ].filter(Boolean);

  if (!parts.length) {
    return result.failed.length
      ? `Hech narsa yuborilmadi — ${result.failed.length} ta tovarda muammo bor`
      : 'Yuboriladigan o\'zgarish topilmadi';
  }
  return `${parts.join(' va ')} ${marketplaceName} ga yuborildi`;
}


/**
 * Shubhali narxni aniqlash.
 *
 * Valyuta to'sig'i faqat "narxni boshqa valyutadan olib kelish"ni to'xtatadi.
 * Lekin sotuvchi ikkala kartochkaga ham QO'LDA bir xil raqam yozib qo'ysa,
 * to'siq ishlamaydi — qiymat "o'sha marketplace uchun kiritilgan" hisoblanadi.
 *
 * Amalda bu ko'p uchraydi: Uzum kartochkasidan nusxa olib, narxni
 * o'zgartirishni unutish. 12 213 so'm ≈ 90 rubl, 12 213 rubl esa ≈ 1,7 mln so'm —
 * tovar sotilmay qoladi va sabab ko'rinmaydi.
 *
 * Shuning uchun bir xil raqam turli valyutadagi bozorlarda uchrasa —
 * bloklamaymiz (sotuvchi haqli bo'lishi mumkin), lekin aytamiz.
 */
export function suspiciousPrice(
  attributes: any,
  marketplaceId: string,
  price: number,
): string | null {
  const byMarketplace = attributes?.byMarketplace ?? {};

  for (const [otherId, values] of Object.entries<any>(byMarketplace)) {
    if (otherId === marketplaceId) continue;

    const otherSpec = getSpec(otherId);
    const thisSpec = getSpec(marketplaceId);
    if (!otherSpec || !thisSpec || otherSpec.currency === thisSpec.currency) continue;

    const otherPrice = Number(String(values?.price ?? '').replace(',', '.'));
    if (Number.isFinite(otherPrice) && otherPrice === price) {
      return (
        `narx ${otherId} dagi bilan bir xil (${price}), lekin valyutalar boshqa ` +
        `(${otherSpec.currency} va ${thisSpec.currency}) — tekshirib ko'ring`
      );
    }
  }
  return null;
}

export const __internal = { chunk, collectOzonErrors };
