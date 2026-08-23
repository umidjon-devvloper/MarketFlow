import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { syncOrganization } from '../services/sync/marketplace-sync.service';

/**
 * GET /api/sync/status
 * Har bir ulanish bo'yicha oxirgi sinxronizatsiya holati.
 */
export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;

    const creds = await prisma.userMarketplace.findMany({
      where: { organizationId, isActive: true },
      select: { marketplace: true },
    });

    const items = await Promise.all(
      creds.map(async ({ marketplace }) => {
        const [lastRun, cached] = await Promise.all([
          prisma.syncRun.findFirst({
            where: { organizationId, marketplace },
            orderBy: { startedAt: 'desc' },
          }),
          prisma.marketplaceStock.aggregate({
            where: { organizationId, marketplace },
            _count: { _all: true },
            _sum: { amount: true },
          }),
        ]);

        return {
          marketplace,
          lastSyncedAt: lastRun?.finishedAt ?? null,
          status: lastRun?.status ?? null,
          error: lastRun?.error ?? null,
          durationMs: lastRun?.durationMs ?? null,
          skuCount: cached._count._all,
          totalStock: cached._sum.amount ?? 0,
        };
      }),
    );

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/sync/run
 * Cron'ni kutmasdan hozir sinxronlash.
 */
export async function runNow(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncOrganization(req.organization!.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/sync/trend?days=30
 * Kunlik kesimlar — grafik va "o'tgan haftaga nisbatan" uchun.
 */
export async function getTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);

    const from = new Date();
    from.setUTCDate(from.getUTCDate() - days);
    from.setUTCHours(0, 0, 0, 0);

    const rows = await prisma.marketplaceSnapshot.findMany({
      where: { organizationId, date: { gte: from } },
      orderBy: { date: 'asc' },
    });

    res.json({
      days,
      items: rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        marketplace: r.marketplace,
        orders: r.orders,
        revenue: Number(r.revenue),
        currency: r.currency,
        skuCount: r.skuCount,
        totalStock: r.totalStock,
        lowStock: r.lowStock,
        outOfStock: r.outOfStock,
      })),
    });
  } catch (err) {
    next(err);
  }
}
