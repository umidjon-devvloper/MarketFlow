/**
 * Marketplace ma'lumotini bazaga ko'chirish (sinxronizatsiya).
 *
 * Muammo: marketplace API'lari sekin va qattiq limitlangan — WB statistikasi
 * daqiqasiga 1 ta so'rov, Uzum "too many requests" beradi. Har sahifa
 * ochilganda jonli so'rov yuborilsa, foydalanuvchi 2-3 soniya kutadi va
 * bir nechta odam bir vaqtda ishlasa 429 boshlanadi.
 *
 * Yechim: cron ma'lumotni oldindan o'qib bazaga yozadi, sahifalar bazadan
 * o'qiydi. Yon foyda — kunlik kesimlar to'planib, tarix paydo bo'ladi.
 */

import { Marketplace as PrismaMarketplace, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { decrypt } from '../../utils/encryption';
import { getAdapter, AdapterCreds, NormalizedStock, NormalizedOrder } from '../marketplace/adapter';

/** Bitta marketplace'dan ko'pi bilan shuncha qator o'qiymiz */
const MAX_ROWS = 5000;
const PAGE_SIZE = 200;

/** Summary qaysi oyna uchun olinadi */
const SUMMARY_DAYS = 30;

/** Buyurtmalar qaysi oyna uchun o'qiladi */
const ORDER_DAYS = 30;

/** Bir marketplace'dan ko'pi bilan shuncha buyurtma */
const MAX_ORDERS = 1000;

/**
 * Buyurtma sahifasining hajmi.
 *
 * Qoldiqlarnikidan kichik: buyurtma endpointlari qat'iyroq cheklangan.
 * Yandex 200 ta so'ralganda "Page size is too big" bilan rad etadi
 * (tekshirilgan), Uzum ham 50 dan oshganda "Illegal argument" beradi.
 */
const ORDER_PAGE_SIZE = 50;

/**
 * Shuncha vaqt marketplace javobida KO'RINMAGAN buyurtmalar keshdan o'chadi.
 *
 * DIQQAT: bu `orderedAt` emas, `syncedAt` bo'yicha.
 *
 * Avval buyurtma sanasi bo'yicha tozalanardi va bu jimgina ma'lumot
 * yo'qotardi: Uzum 30 kunlik filtrni har doim ham qo'llamaydi va eski
 * buyurtmani qaytaraveradi — biz uni yozib, darhol o'chirib tashlardik.
 * Natijada ro'yxat bo'sh ko'rinardi, garchi buyurtma bor bo'lsa ham.
 *
 * Endi qoida oddiy: marketplace hali qaytarayotgan buyurtma qoladi,
 * qaytarmay qo'yganlari esa yarim yildan keyin o'chadi.
 */
const ORDER_KEEP_DAYS = 180;

/** Bir vaqtda nechta qatorni yozamiz — connection pool ni to'ldirib yubormaslik uchun */
const UPSERT_CHUNK = 25;

export interface MarketplaceSyncResult {
  marketplace: string;
  status: 'OK' | 'PARTIAL' | 'FAILED';
  itemCount: number;
  durationMs: number;
  error?: string;
}

export interface OrgSyncResult {
  organizationId: string;
  orgName: string;
  results: MarketplaceSyncResult[];
}

/** Bugungi kun (UTC yarim tuni) — snapshot kaliti sifatida */
function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Ulanishning barcha qoldiqlarini sahifama-sahifa o'qish */
async function readAllStocks(marketplace: string, creds: AdapterCreds): Promise<NormalizedStock[]> {
  const adapter = getAdapter(marketplace);
  const size = Math.min(PAGE_SIZE, adapter.maxPageSize ?? PAGE_SIZE);
  const out: NormalizedStock[] = [];

  for (let page = 0; out.length < MAX_ROWS; page++) {
    const { items, total } = await adapter.getStocks(creds, { page, size });
    out.push(...items);
    if (items.length < size) break;
    if (total !== undefined && out.length >= total) break;
  }
  return out;
}

/** Buyurtmalarni sahifama-sahifa o'qish */
async function readOrders(marketplace: string, creds: AdapterCreds): Promise<NormalizedOrder[]> {
  const adapter = getAdapter(marketplace);
  const size = Math.min(ORDER_PAGE_SIZE, adapter.maxPageSize ?? ORDER_PAGE_SIZE);
  const out: NormalizedOrder[] = [];

  for (let page = 0; out.length < MAX_ORDERS; page++) {
    const { items, total } = await adapter.getOrders(creds, { page, size, days: ORDER_DAYS });
    out.push(...items);
    if (items.length < size) break;
    if (total !== undefined && out.length >= total) break;
  }
  return out;
}

/**
 * Bir mahsulot bir necha omborda yotishi mumkin — bazada SKU bo'yicha
 * bitta qator saqlaymiz, qoldiqlar qo'shiladi.
 */
function groupBySku(rows: NormalizedStock[]): NormalizedStock[] {
  const map = new Map<string, NormalizedStock>();
  for (const row of rows) {
    const sku = (row.sku || '').trim();
    if (!sku) continue;
    const hit = map.get(sku);
    if (!hit) {
      map.set(sku, { ...row, sku });
      continue;
    }
    hit.amount += row.amount;
    if (hit.warehouse && row.warehouse && hit.warehouse !== row.warehouse) {
      hit.warehouse = 'bir necha ombor';
    }
    if (!hit.name && row.name) hit.name = row.name;
  }
  return [...map.values()];
}

/**
 * Bitta marketplace ulanishini sinxronlash.
 *
 * Qoldiq va summary alohida olinadi: biri ishlamasa (masalan token'da
 * "Statistika" ruxsati yo'q) ikkinchisi baribir yoziladi — shuning uchun
 * natija `PARTIAL` bo'lishi mumkin.
 */
export async function syncMarketplace(
  organizationId: string,
  cred: { id: string; marketplace: PrismaMarketplace; apiKey: string; apiSecret: string | null; shopId: string | null },
  lowStockThreshold: number,
): Promise<MarketplaceSyncResult> {
  const startedAt = new Date();
  const run = await prisma.syncRun.create({
    data: { organizationId, marketplace: cred.marketplace, status: 'FAILED', startedAt },
  });

  // Kalit ochilmasa (ENCRYPTION_KEY almashgan) — shu ulanish tashlab
  // ketiladi, qolganlari sinxronlanaveradi. Ilgari bu butun tashkilot
  // sinxronizatsiyasini to'xtatib qo'yardi.
  let creds: AdapterCreds;
  try {
    creds = {
      apiKey: decrypt(cred.apiKey),
      apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
      shopId: cred.shopId,
    };
  } catch (err: any) {
    const message = err?.message || 'kalitni ochib bo\'lmadi';
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        error: message,
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      },
    });
    return {
      marketplace: cred.marketplace,
      status: 'FAILED',
      itemCount: 0,
      durationMs: Date.now() - startedAt.getTime(),
      error: message,
    };
  }

  const problems: string[] = [];
  let items: NormalizedStock[] = [];

  // ── Qoldiqlar ──────────────────────────────────────────
  let stocksOk = false;
  try {
    items = groupBySku(await readAllStocks(cred.marketplace, creds));
    stocksOk = true;

    // Bitta katta transaksiya emas — 5000 ta upsert Prisma'ning standart
    // 5 soniyalik timeout'iga sig'maydi. Kesh bo'lgani uchun atomarlik shart emas.
    for (let i = 0; i < items.length; i += UPSERT_CHUNK) {
      await Promise.all(
        items.slice(i, i + UPSERT_CHUNK).map((row) =>
          prisma.marketplaceStock.upsert({
            where: {
              organizationId_marketplace_sku: {
                organizationId,
                marketplace: cred.marketplace,
                sku: row.sku,
              },
            },
            create: {
              organizationId,
              marketplace: cred.marketplace,
              sku: row.sku,
              name: row.name,
              amount: row.amount,
              warehouse: row.warehouse,
              syncedAt: startedAt,
            },
            update: {
              name: row.name,
              amount: row.amount,
              warehouse: row.warehouse,
              syncedAt: startedAt,
            },
          }),
        ),
      );
    }

    // Bu safar kelmagan SKU'lar — marketplace'dan olib tashlangan, keshdan ham o'chadi
    await prisma.marketplaceStock.deleteMany({
      where: { organizationId, marketplace: cred.marketplace, syncedAt: { lt: startedAt } },
    });
  } catch (err: any) {
    problems.push(`qoldiqlar: ${err?.message || 'xato'}`);
  }

  // ── Buyurtmalar ────────────────────────────────────────
  //
  // Qoldiqdan farqli: bu safar kelmagan buyurtmalar O'CHIRILMAYDI.
  // Buyurtma tarixi — sotuvchining o'z ma'lumoti, marketplace uni oynadan
  // chiqarib yuborgani uni yo'q bo'ldi degani emas.
  let orderCount = 0;
  try {
    const orders = await readOrders(cred.marketplace, creds);
    orderCount = orders.length;

    for (let i = 0; i < orders.length; i += UPSERT_CHUNK) {
      await Promise.all(
        orders.slice(i, i + UPSERT_CHUNK).map((order) => {
          const data = {
            orderedAt: order.date ? new Date(order.date) : null,
            status: order.status ?? null,
            itemsCount: order.itemsCount ?? order.items?.length ?? 0,
            total: new Prisma.Decimal(order.total ?? 0),
            currency: cred.marketplace === 'UZUM' ? 'UZS' : 'RUB',
            items: (order.items ?? []) as any,
            syncedAt: startedAt,
          };
          return prisma.marketplaceOrder.upsert({
            where: {
              organizationId_marketplace_externalId: {
                organizationId,
                marketplace: cred.marketplace,
                externalId: order.id,
              },
            },
            create: {
              organizationId,
              marketplace: cred.marketplace,
              externalId: order.id,
              ...data,
            },
            update: data,
          });
        }),
      );
    }

    // Uzoq vaqt marketplace javobida ko'rinmaganlarini tozalaymiz —
    // jadval cheksiz o'smasin. Hali qaytarilayotganlariga tegilmaydi.
    await prisma.marketplaceOrder.deleteMany({
      where: {
        organizationId,
        marketplace: cred.marketplace,
        syncedAt: { lt: new Date(Date.now() - ORDER_KEEP_DAYS * 24 * 3600_000) },
      },
    });
  } catch (err: any) {
    problems.push(`buyurtmalar ro'yxati: ${err?.message || 'xato'}`);
  }

  // ── Buyurtma soni va daromad (umumiy kesim) ────────────
  let summary: { orders: number; revenue: number; currency: string } | null = null;
  try {
    const s = await getAdapter(cred.marketplace).getSummary(creds, SUMMARY_DAYS);
    summary = { orders: s.orders, revenue: s.revenue, currency: s.currency };
  } catch (err: any) {
    problems.push(`buyurtmalar: ${err?.message || 'xato'}`);
  }

  // ── Kunlik kesim ───────────────────────────────────────
  if (stocksOk || summary) {
    const snapshot = {
      orders: summary?.orders ?? 0,
      revenue: new Prisma.Decimal(summary?.revenue ?? 0),
      // Valyuta bozorga bog'liq, summary'ga emas: WB summary limitga urilib
      // null qaytganda ?? 'UZS' butun WB kesimini noto'g'ri UZS deb belgilardi
      // va analitikada RUB daromad UZS bo'lib ko'rinardi. Qoldiq kesimidagi
      // (yuqoridagi) mantiqning aynan o'zi.
      currency: cred.marketplace === 'UZUM' ? 'UZS' : 'RUB',
      skuCount: items.length,
      totalStock: items.reduce((n, r) => n + r.amount, 0),
      lowStock: items.filter((r) => r.amount > 0 && r.amount <= lowStockThreshold).length,
      outOfStock: items.filter((r) => r.amount === 0).length,
    };

    await prisma.marketplaceSnapshot.upsert({
      where: {
        organizationId_marketplace_date: {
          organizationId,
          marketplace: cred.marketplace,
          date: today(),
        },
      },
      create: { organizationId, marketplace: cred.marketplace, date: today(), ...snapshot },
      // Kun davomida bir necha marta ishlaydi — oxirgi holat qoladi
      update: snapshot,
    });
  }

  const status: MarketplaceSyncResult['status'] =
    problems.length === 0 ? 'OK' : stocksOk || summary || orderCount ? 'PARTIAL' : 'FAILED';
  const durationMs = Date.now() - startedAt.getTime();

  await prisma.syncRun.update({
    where: { id: run.id },
    data: {
      status,
      error: problems.length ? problems.join('; ') : null,
      itemCount: items.length,
      durationMs,
      finishedAt: new Date(),
    },
  });

  return {
    marketplace: cred.marketplace,
    status,
    itemCount: items.length,
    durationMs,
    error: problems.length ? problems.join('; ') : undefined,
  };
}

/** Tashkilotning barcha faol ulanishlarini sinxronlash */
export async function syncOrganization(organizationId: string): Promise<OrgSyncResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      lowStockThreshold: true,
      userMarketplaces: {
        where: { isActive: true },
        select: { id: true, marketplace: true, apiKey: true, apiSecret: true, shopId: true },
      },
    },
  });
  if (!org) throw new Error('Tashkilot topilmadi');

  const results: MarketplaceSyncResult[] = [];
  for (const cred of org.userMarketplaces) {
    // Ketma-ket — limitlar token bo'yicha emas, sotuvchi bo'yicha hisoblanadi
    results.push(await syncMarketplace(organizationId, cred, org.lowStockThreshold));
  }

  return { organizationId, orgName: org.name, results };
}

/** Barcha faol tashkilotlar (cron uchun) */
export async function syncAllOrganizations(): Promise<OrgSyncResult[]> {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true, userMarketplaces: { some: { isActive: true } } },
    select: { id: true },
  });

  const out: OrgSyncResult[] = [];
  for (const org of orgs) {
    try {
      out.push(await syncOrganization(org.id));
    } catch (err: any) {
      console.error(`Sync (${org.id}) xato: ${err?.message}`);
    }
  }
  return out;
}
