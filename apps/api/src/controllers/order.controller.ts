/**
 * Buyurtmalar — to'rttala marketplace bitta ro'yxatda
 *
 * Ma'lumot keshdan o'qiladi (MarketplaceOrder), jonli so'rov yuborilmaydi.
 * Sabab: WB statistikasi daqiqasiga 1 ta so'rovga ruxsat beradi, Uzum tez
 * "too many requests" qaytaradi. Sahifa har ochilganda to'rttala bozorni
 * so'rasak, sotuvchi 10-15 soniya kutardi va bir necha odam bir vaqtda
 * ishlasa hammasi 429 ga urilardi.
 *
 * Keshdan o'qishning yon foydasi kattaroq: to'rt bozorning buyurtmalarini
 * bitta ro'yxatda sana bo'yicha saralash faqat shunday qilib bo'ladi —
 * jonli so'rovlarda har bozor o'z sahifalashini beradi va ularni birlashtirib
 * bo'lmaydi.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import { isMarketplaceId, getSpec } from '../services/marketplace/specs';
import { decrypt } from '../utils/encryption';
import {
  getOrderCapabilities,
  getCancelReasons,
  confirmOrder,
  cancelOrder,
  OrderActionError,
} from '../services/marketplace/order-actions.service';

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  marketplace: z.string().optional(),
  /** Marketplace o'z atamasi bilan qaytaradi — aniq moslik bo'yicha filtrlaymiz */
  status: z.string().optional(),
  /** Oxirgi necha kun. Berilmasa — butun tarix (kesh 180 kun ko'rinmaganini o'chiradi) */
  days: z.coerce.number().int().min(1).max(3650).optional(),
  /** Buyurtma raqami yoki tovar nomi/artikuli bo'yicha */
  search: z.string().optional(),
});

/**
 * GET /api/orders
 *
 * Sana bo'yicha kamayish tartibida. Sanasi noma'lum buyurtmalar oxirida
 * turadi — ular yo'qolmasligi kerak, lekin yangilarni ham bosmasligi kerak.
 */
export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listSchema.parse(req.query);
    const organizationId = req.organization!.id;

    const where: Prisma.MarketplaceOrderWhereInput = { organizationId };

    if (query.marketplace && isMarketplaceId(query.marketplace.toUpperCase())) {
      where.marketplace = query.marketplace.toUpperCase() as any;
    }
    if (query.status) where.status = query.status;
    if (query.days) {
      const since = new Date(Date.now() - query.days * 24 * 3600_000);
      // Sanasi noma'lum buyurtmalar ham qolsin — ular yo'qolib ketmasligi kerak
      where.AND = [{ OR: [{ orderedAt: { gte: since } }, { orderedAt: null }] }];
    }
    if (query.search) {
      const text = query.search.trim();
      where.OR = [
        { externalId: { contains: text, mode: 'insensitive' } },
        // Pozitsiyalar JSON ichida — matn bo'yicha qidiramiz.
        // Aniq emas, lekin sotuvchi odatda tovar nomini yozadi va bu yetarli.
        { items: { string_contains: text } },
      ];
    }

    const [items, total, syncedAt] = await Promise.all([
      prisma.marketplaceOrder.findMany({
        where,
        orderBy: [{ orderedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.marketplaceOrder.count({ where }),
      prisma.marketplaceOrder.findFirst({
        where: { organizationId },
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }),
    ]);

    res.json({
      items,
      syncedAt: syncedAt?.syncedAt ?? null,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/summary?days=30
 *
 * Marketplace bo'yicha soni va summasi + mavjud holatlar ro'yxati.
 * Filtrlar shu ro'yxatdan quriladi — qattiq yozib qo'yib bo'lmaydi, chunki
 * har bir marketplace o'z atamalarini ishlatadi ("Yangi", "Собран", "delivered").
 */
export async function ordersSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    // `days` berilmasa yoki 0 bo'lsa — butun tarix. Ro'yxatdagi filtr bilan
    // bir xil bo'lishi shart, aks holda plitkadagi son va ro'yxat mos kelmaydi.
    const raw = Number(req.query.days);
    const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 3650) : 0;

    const where: Prisma.MarketplaceOrderWhereInput = { organizationId };
    if (days) {
      const since = new Date(Date.now() - days * 24 * 3600_000);
      // Sanasi noma'lum buyurtmalar filtrdan tushib qolmasin
      where.OR = [{ orderedAt: { gte: since } }, { orderedAt: null }];
    }

    const [byMarketplace, byStatus, syncRuns] = await Promise.all([
      prisma.marketplaceOrder.groupBy({
        by: ['marketplace'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.marketplaceOrder.groupBy({
        by: ['marketplace', 'status'],
        where,
        _count: { _all: true },
      }),
      // Oxirgi sinxronizatsiya — sotuvchi ma'lumot qanchalik eskiligini bilsin
      prisma.syncRun.findMany({
        where: { organizationId },
        orderBy: { startedAt: 'desc' },
        take: 8,
        select: { marketplace: true, status: true, startedAt: true, error: true },
      }),
    ]);

    // Har marketplace bo'yicha oxirgi urinish
    const lastSync = new Map<string, (typeof syncRuns)[number]>();
    for (const run of syncRuns) {
      if (!lastSync.has(run.marketplace)) lastSync.set(run.marketplace, run);
    }

    res.json({
      days: days || null,
      marketplaces: byMarketplace.map((row) => ({
        marketplace: row.marketplace,
        orders: row._count._all,
        revenue: row._sum.total?.toString() ?? '0',
        currency: row.marketplace === 'UZUM' ? 'UZS' : 'RUB',
        lastSync: lastSync.get(row.marketplace) ?? null,
      })),
      statuses: byStatus
        .filter((row) => row.status)
        .map((row) => ({
          marketplace: row.marketplace,
          status: row.status!,
          count: row._count._all,
        })),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/orders/:id — bitta buyurtma, pozitsiyalari bilan */
export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.marketplaceOrder.findFirst({
      where: { id: req.params.id, organizationId: req.organization!.id },
    });
    if (!order) throw new HttpError(404, 'Buyurtma topilmadi');
    res.json(order);
  } catch (err) {
    next(err);
  }
}

// ============================================
// Buyurtma amallari — tasdiqlash va bekor qilish
// ============================================

/** Buyurtma + shu marketplace kaliti. Ikkalasi ham bo'lmasa amal bajarilmaydi. */
async function loadOrderWithCreds(orderId: string, organizationId: string) {
  const order = await prisma.marketplaceOrder.findFirst({
    where: { id: orderId, organizationId },
  });
  if (!order) throw new HttpError(404, 'Buyurtma topilmadi');

  const cred = await prisma.userMarketplace.findFirst({
    where: { organizationId, marketplace: order.marketplace, isActive: true },
  });
  if (!cred) {
    const spec = getSpec(order.marketplace);
    throw new HttpError(400, `${spec?.name ?? order.marketplace} ulanmagan`);
  }

  return {
    order,
    creds: {
      apiKey: decrypt(cred.apiKey),
      apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
      shopId: cred.shopId,
    },
  };
}

/** Marketplace xatolarini HttpError'ga o'girish */
function toHttp(err: any): unknown {
  if (err instanceof HttpError) return err;
  if (err instanceof OrderActionError) return new HttpError(err.status, err.message);
  if (err?.name === 'DecryptionError') return new HttpError(409, err.message);
  if (typeof err?.status === 'number') {
    return new HttpError(err.status === 429 ? 429 : 502, err.message);
  }
  return err;
}

/**
 * GET /api/orders/:id/actions
 *
 * Bu buyurtma bilan nima qilish mumkin va bekor qilish sabablari.
 * UI tugmalarni shu javobga qarab chizadi — imkoniyat yo'q joyda tugma
 * ko'rsatib, keyin xato berish sotuvchini chalg'itadi.
 */
export async function orderActions(req: Request, res: Response, next: NextFunction) {
  try {
    const { order, creds } = await loadOrderWithCreds(req.params.id, req.organization!.id);
    const capabilities = getOrderCapabilities(order.marketplace);

    // Sabablar faqat kerak bo'lganda so'raladi — Ozon uchun bu API chaqiruvi
    let reasons: Awaited<ReturnType<typeof getCancelReasons>> = [];
    if (capabilities.canCancel && capabilities.cancelNeedsReason) {
      try {
        reasons = await getCancelReasons(order.marketplace, creds, order.externalId);
      } catch (err: any) {
        // Sabablarni olib bo'lmasa ham imkoniyatlarni qaytaramiz —
        // UI xabarni ko'rsatadi, tugma esa o'chiq bo'ladi
        return res.json({
          ...capabilities,
          reasons: [],
          reasonsError: err?.message || "Sabablar ro'yxatini olib bo'lmadi",
        });
      }
    }

    res.json({ ...capabilities, reasons });
  } catch (err) {
    next(toHttp(err));
  }
}

/** POST /api/orders/:id/confirm */
export async function confirmOrderAction(req: Request, res: Response, next: NextFunction) {
  try {
    const { order, creds } = await loadOrderWithCreds(req.params.id, req.organization!.id);
    const result = await confirmOrder(order.marketplace, creds, order.externalId);

    // Keshni darhol yangilaymiz — sotuvchi natijani ko'rsin, cron'ni kutmasin
    if (result.status) {
      await prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: { status: result.status },
      });
    }

    res.json(result);
  } catch (err) {
    next(toHttp(err));
  }
}

const cancelSchema = z.object({
  reasonId: z.string().optional(),
  comment: z.string().max(500).optional(),
});

/** POST /api/orders/:id/cancel */
export async function cancelOrderAction(req: Request, res: Response, next: NextFunction) {
  try {
    const body = cancelSchema.parse(req.body ?? {});
    const { order, creds } = await loadOrderWithCreds(req.params.id, req.organization!.id);

    const result = await cancelOrder(order.marketplace, creds, order.externalId, body);

    if (result.status) {
      await prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: { status: result.status },
      });
    }

    res.json(result);
  } catch (err: any) {
    if (err?.name === 'ZodError') return next(err);
    next(toHttp(err));
  }
}
