import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import { encrypt, decrypt, DecryptionError } from '../utils/encryption';
import { inspectToken as inspectWbToken } from '../services/marketplace/wb-api.service';
import * as uzumApi from '../services/marketplace/uzum-api.service';
import { getAdapter, AdapterCreds, Marketplace } from '../services/marketplace/adapter';
import { buildInsights } from '../services/marketplace/insights.service';
import { generateSalesAdvice } from '../services/ai/advisor.service';

const saveCredentialsSchema = z.object({
  marketplace: z.enum(['UZUM', 'OZON', 'WB', 'YANDEX']),
  apiKey: z.string().min(10),
  apiSecret: z.string().optional(),
  shopId: z.string().optional(),
  shopName: z.string().optional(),
});

export async function listMarketplaces(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;

    const items = await prisma.userMarketplace.findMany({
      where: { organizationId },
      select: {
        id: true,
        marketplace: true,
        shopId: true,
        shopName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveCredentials(req: Request, res: Response, next: NextFunction) {
  try {
    const data = saveCredentialsSchema.parse(req.body);
    const organizationId = req.organization!.id;

    // WB tokenidagi eng ko'p uchraydigan ikki xatoni saqlashdan oldin ushlaymiz
    if (data.marketplace === 'WB') {
      const problems = inspectWbToken(data.apiKey);
      if (problems.length) {
        throw new HttpError(400, problems.map((p) => p.message).join(' '));
      }
    }

    const encryptedKey = encrypt(data.apiKey);
    const encryptedSecret = data.apiSecret ? encrypt(data.apiSecret) : null;

    const item = await prisma.userMarketplace.upsert({
      where: {
        organizationId_marketplace: {
          organizationId,
          marketplace: data.marketplace,
        },
      },
      create: {
        organizationId,
        marketplace: data.marketplace,
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
        shopId: data.shopId,
        shopName: data.shopName,
      },
      update: {
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
        shopId: data.shopId,
        shopName: data.shopName,
        isActive: true,
      },
      select: {
        id: true,
        marketplace: true,
        shopId: true,
        shopName: true,
        isActive: true,
      },
    });

    res.status(201).json({ marketplace: item });
  } catch (err) {
    next(err);
  }
}

export async function deleteCredentials(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizationId = req.organization!.id;

    const existing = await prisma.userMarketplace.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, 'Marketplace ulanish topilmadi');

    await prisma.userMarketplace.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function testCredentials(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizationId = req.organization!.id;

    const cred = await prisma.userMarketplace.findFirst({
      where: { id, organizationId },
    });
    if (!cred) throw new HttpError(404, 'Marketplace ulanish topilmadi');

    const adapter = getAdapter(cred.marketplace);
    const result = await adapter.test({
      apiKey: decrypt(cred.apiKey),
      apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
      shopId: cred.shopId,
    });

    // Muvaffaqiyatli testda do'kon ma'lumotlarini avtomatik saqlaymiz
    if (result.success) {
      await prisma.userMarketplace.update({
        where: { id: cred.id },
        data: {
          isActive: true,
          ...(result.shopId ? { shopId: result.shopId } : {}),
          ...(result.shopName ? { shopName: result.shopName } : {}),
        },
      });
    }

    res.json({ success: result.success, message: result.message });
  } catch (err) {
    next(toHttpError(err));
  }
}

/**
 * Tashkilotning UZUM ulanishini yuklab, kalitni shifrdan yechish.
 * shopId hali saqlanmagan bo'lsa — /v1/shops dan olib saqlaydi.
 */
async function loadUzumCredentials(id: string, organizationId: string) {
  const cred = await prisma.userMarketplace.findFirst({
    where: { id, organizationId, marketplace: 'UZUM' },
  });
  if (!cred) throw new HttpError(404, 'Uzum ulanishi topilmadi');
  if (!cred.isActive) throw new HttpError(400, 'Uzum ulanishi faol emas');

  const apiKey = decrypt(cred.apiKey);

  let shopId = cred.shopId;
  if (!shopId) {
    const shops = await uzumApi.getShops(apiKey);
    const shop = shops[0];
    if (!shop) throw new HttpError(400, 'Uzum hisobida do\'kon topilmadi');
    shopId = String(shop.id);
    await prisma.userMarketplace.update({
      where: { id: cred.id },
      data: { shopId, shopName: shop.name },
    });
  }

  return { apiKey, shopId };
}

function pagination(req: Request) {
  return {
    page: req.query.page ? Number(req.query.page) : 0,
    size: req.query.size ? Number(req.query.size) : 20,
  };
}

/** Marketplace API xatolarini HttpError'ga o'girib, express error middleware'ga uzatish */
function toHttpError(err: unknown): unknown {
  if (err instanceof HttpError) return err;
  // Kalit shifridan ochilmasa — bu marketplace emas, bizning konfiguratsiya muammomiz
  if (err instanceof DecryptionError) return new HttpError(409, err.message);
  if (err instanceof Error) {
    const status = (err as any).status;
    if (typeof status === 'number') {
      // 429 o'z holicha uzatiladi — frontend uni "limit" deb tanib, qayta urinmaydi
      if (status === 429) return new HttpError(429, err.message);
      return new HttpError(status >= 400 && status < 500 ? 400 : 502, err.message);
    }
    // Adapter validatsiya xatolari (masalan, shopId yo'q)
    if (err.name === 'Error') return new HttpError(400, err.message);
  }
  return err;
}

/**
 * Istalgan marketplace ulanishini yuklab, kalitlarni shifrdan yechish.
 */
async function loadCredentials(id: string, organizationId: string) {
  const cred = await prisma.userMarketplace.findFirst({
    where: { id, organizationId },
  });
  if (!cred) throw new HttpError(404, 'Marketplace ulanish topilmadi');
  if (!cred.isActive) throw new HttpError(400, 'Ulanish faol emas — avval "Test qilish" ni bosing');

  const creds: AdapterCreds = {
    apiKey: decrypt(cred.apiKey),
    apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
    shopId: cred.shopId,
  };
  return { cred, creds, adapter: getAdapter(cred.marketplace) };
}

// ─── UMUMIY DATA ENDPOINTLAR (barcha marketplace'lar) ────

/** GET /api/marketplaces/:id/products?page&size */
export async function marketplaceProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { creds, adapter, cred } = await loadCredentials(req.params.id, req.organization!.id);
    const data = await adapter.getProducts(creds, pagination(req));
    res.json({ success: true, marketplace: cred.marketplace, ...data });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/orders?page&size */
export async function marketplaceOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { creds, adapter, cred } = await loadCredentials(req.params.id, req.organization!.id);
    const data = await adapter.getOrders(creds, pagination(req));
    res.json({ success: true, marketplace: cred.marketplace, ...data });
  } catch (err) {
    next(toHttpError(err));
  }
}

/**
 * GET /api/marketplaces/:id/stocks?page&size&source=cache|live
 *
 * Standart — keshdan (cron to'ldiradi): darhol ochiladi va marketplace
 * limitini sarflamaydi. Kesh bo'sh bo'lsa jonli so'rovga tushadi, shunda
 * birinchi ochilish ham ishlaydi. `source=live` — majburan jonli.
 */
export async function marketplaceStocks(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const { page, size } = pagination(req);
    const wantsLive = req.query.source === 'live';

    const cred = await prisma.userMarketplace.findFirst({
      where: { id: req.params.id, organizationId },
      select: { marketplace: true, isActive: true },
    });
    if (!cred) throw new HttpError(404, 'Marketplace ulanish topilmadi');

    if (!wantsLive) {
      const where = { organizationId, marketplace: cred.marketplace };
      const [rows, total, latest] = await Promise.all([
        prisma.marketplaceStock.findMany({
          where,
          orderBy: [{ amount: 'asc' }, { sku: 'asc' }],
          skip: page * size,
          take: size,
        }),
        prisma.marketplaceStock.count({ where }),
        prisma.marketplaceStock.findFirst({
          where,
          orderBy: { syncedAt: 'desc' },
          select: { syncedAt: true },
        }),
      ]);

      if (total > 0) {
        return res.json({
          success: true,
          marketplace: cred.marketplace,
          source: 'cache',
          syncedAt: latest?.syncedAt,
          items: rows.map((r) => ({
            sku: r.sku,
            name: r.name ?? undefined,
            amount: r.amount,
            warehouse: r.warehouse ?? undefined,
          })),
          total,
        });
      }
      // Kesh hali to'ldirilmagan — birinchi ochilishda jonli o'qiymiz
    }

    const live = await loadCredentials(req.params.id, organizationId);
    const data = await live.adapter.getStocks(live.creds, { page, size });
    res.json({ success: true, marketplace: cred.marketplace, source: 'live', ...data });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/summary?days=30 — buyurtmalar soni va daromad */
export async function marketplaceSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { creds, adapter } = await loadCredentials(req.params.id, req.organization!.id);
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
    const data = await adapter.getSummary(creds, days);
    res.json({ success: true, ...data });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/insights?days=30 — analitika sahifasi uchun to'liq kesim */
export async function marketplaceInsights(req: Request, res: Response, next: NextFunction) {
  try {
    const { creds, adapter, cred } = await loadCredentials(req.params.id, req.organization!.id);
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
    const data = await buildInsights(adapter, creds, cred.marketplace as Marketplace, days);
    res.json({ success: true, ...data });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** POST /api/marketplaces/:id/advice?days=30 — AI savdo tavsiyalari */
export async function marketplaceAdvice(req: Request, res: Response, next: NextFunction) {
  try {
    const { creds, adapter, cred } = await loadCredentials(req.params.id, req.organization!.id);
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
    const insights = await buildInsights(adapter, creds, cred.marketplace as Marketplace, days);
    const advice = await generateSalesAdvice(insights);
    res.json({ success: true, advice, insights });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/uzum/shops */
export async function uzumShops(req: Request, res: Response, next: NextFunction) {
  try {
    const { apiKey } = await loadUzumCredentials(req.params.id, req.organization!.id);
    res.json({ success: true, data: await uzumApi.getShops(apiKey) });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/uzum/products?page&size */
export async function uzumProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { apiKey, shopId } = await loadUzumCredentials(req.params.id, req.organization!.id);
    res.json({ success: true, data: await uzumApi.getProducts(apiKey, shopId, pagination(req)) });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/uzum/orders?page&size&status */
export async function uzumOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { apiKey, shopId } = await loadUzumCredentials(req.params.id, req.organization!.id);
    const data = await uzumApi.getFbsOrders(apiKey, shopId, {
      ...pagination(req),
      status: req.query.status as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/uzum/finance/orders?page&size&dateFrom&dateTo */
export async function uzumFinanceOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { apiKey, shopId } = await loadUzumCredentials(req.params.id, req.organization!.id);
    const data = await uzumApi.getFinanceOrders(apiKey, shopId, {
      ...pagination(req),
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/uzum/finance/expenses?page&size */
export async function uzumFinanceExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const { apiKey, shopId } = await loadUzumCredentials(req.params.id, req.organization!.id);
    res.json({ success: true, data: await uzumApi.getFinanceExpenses(apiKey, shopId, pagination(req)) });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/uzum/stocks?page&size */
export async function uzumStocks(req: Request, res: Response, next: NextFunction) {
  try {
    const { apiKey } = await loadUzumCredentials(req.params.id, req.organization!.id);
    res.json({ success: true, data: await uzumApi.getFbsStocks(apiKey, pagination(req)) });
  } catch (err) {
    next(toHttpError(err));
  }
}

/** GET /api/marketplaces/:id/uzum/invoices?page&size */
export async function uzumInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const { apiKey } = await loadUzumCredentials(req.params.id, req.organization!.id);
    res.json({ success: true, data: await uzumApi.getInvoices(apiKey, pagination(req)) });
  } catch (err) {
    next(toHttpError(err));
  }
}
