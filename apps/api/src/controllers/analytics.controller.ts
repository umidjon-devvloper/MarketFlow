import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import {
  computeGrowth,
  aggregateTopProducts,
  OrderLike,
} from '../services/analytics/sales.service';
import { isMarketplaceId } from '../services/marketplace/specs';

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;

    // Ilgari bu yerda 7 ta alohida so'rov ketardi va har biri connection band
    // qilardi — dashboard bir vaqtda bir necha endpoint chaqirgani uchun pool
    // to'lib, P2024 xatosi chiqardi. Endi status bo'yicha sanoqlar bitta
    // groupBy ga birlashtirildi.
    const [totalProducts, totalImages, aiJobs, listingsByStatus] = await Promise.all([
      prisma.product.count({ where: { organizationId } }),
      prisma.productImage.count({ where: { product: { organizationId } } }),
      prisma.aiJob.count({
        where: { product: { organizationId }, status: 'COMPLETED' },
      }),
      prisma.listing.groupBy({
        by: ['status'],
        where: { product: { organizationId } },
        _count: { _all: true },
      }),
    ]);

    const countByStatus = (status: string) =>
      listingsByStatus.find((row) => row.status === status)?._count._all ?? 0;

    const activeListings = countByStatus('PUBLISHED');
    const draftListings = countByStatus('DRAFT');

    const marketplaceStats = await prisma.listing.groupBy({
      by: ['marketplace'],
      where: { product: { organizationId } },
      _count: { id: true },
      _sum: { revenue: true, sales: true, views: true },
    });

    const recentProducts = await prisma.product.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        basePrice: true,
        currency: true,
        updatedAt: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
        _count: { select: { listings: true } },
      },
    });

    res.json({
      totals: {
        products: totalProducts,
        activeListings,
        draftListings,
        images: totalImages,
        aiJobs,
      },
      marketplaceStats: marketplaceStats.map((s) => ({
        marketplace: s.marketplace,
        listings: s._count.id,
        revenue: s._sum.revenue?.toString() || '0',
        sales: s._sum.sales || 0,
        views: s._sum.views || 0,
      })),
      recentProducts,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTimeseries(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: {
        listing: { product: { organizationId } },
        date: { gte: fromDate },
      },
      orderBy: { date: 'asc' },
    });

    const byDate: Record<string, any> = {};
    for (const snap of snapshots) {
      const key = snap.date.toISOString().split('T')[0];
      if (!byDate[key]) {
        byDate[key] = { date: key, views: 0, addToCart: 0, sales: 0, revenue: 0 };
      }
      byDate[key].views += snap.views;
      byDate[key].addToCart += snap.addToCart;
      byDate[key].sales += snap.sales;
      byDate[key].revenue += Number(snap.revenue);
    }

    const result: any[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const key = date.toISOString().split('T')[0];
      result.push(
        byDate[key] || { date: key, views: 0, addToCart: 0, sales: 0, revenue: 0 },
      );
    }

    res.json({ days, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getTopProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Hamma mahsulotni xotiraga yuklamasdan, DB darajasida jamlaymiz
    const grouped = await prisma.listing.groupBy({
      by: ['productId'],
      where: { product: { organizationId } },
      _sum: { sales: true, revenue: true, views: true },
      orderBy: { _sum: { sales: 'desc' } },
      take: limit,
    });

    const products = await prisma.product.findMany({
      where: { id: { in: grouped.map((g) => g.productId) } },
      select: {
        id: true,
        title: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const withStats = grouped
      .map((g) => {
        const product = byId.get(g.productId);
        if (!product) return null;
        const sales = g._sum.sales || 0;
        const views = g._sum.views || 0;
        return {
          id: product.id,
          title: product.title,
          image: product.images[0]?.url,
          sales,
          revenue: Number(g._sum.revenue || 0),
          views,
          conversion: views > 0 ? ((sales / views) * 100).toFixed(2) : '0',
        };
      })
      .filter(Boolean);

    res.json({ products: withStats });
  } catch (err) {
    next(err);
  }
}

// ============================================
// Haqiqiy sotuv analitikasi (MarketplaceOrder'dan)
// ============================================

/** Kesh buyurtmasini analitika sof funksiyalari kutgan shaklga o'girish */
function toOrderLike(o: {
  marketplace: string;
  status: string | null;
  total: unknown;
  currency: string;
  items: unknown;
}): OrderLike {
  return {
    marketplace: o.marketplace,
    status: o.status,
    total: Number(o.total) || 0,
    currency: o.currency,
    items: Array.isArray(o.items) ? (o.items as any[]) : [],
  };
}

/**
 * GET /api/analytics/growth?days=30
 *
 * Joriy oyna va undan oldingi teng oynani taqqoslaydi. Diskret
 * buyurtmalardan (orderedAt bo'yicha) — snapshot rolling yig'indisidan emas.
 */
export async function getGrowth(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 180);
    const now = Date.now();
    const curFrom = new Date(now - days * 24 * 3600_000);
    const prevFrom = new Date(now - 2 * days * 24 * 3600_000);

    const select = { marketplace: true, status: true, total: true, currency: true, items: true } as const;
    const [current, previous] = await Promise.all([
      prisma.marketplaceOrder.findMany({
        where: { organizationId, orderedAt: { gte: curFrom } },
        select,
      }),
      prisma.marketplaceOrder.findMany({
        where: { organizationId, orderedAt: { gte: prevFrom, lt: curFrom } },
        select,
      }),
    ]);

    res.json({
      days,
      ...computeGrowth(current.map(toOrderLike), previous.map(toOrderLike)),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/top-selling?days=30&marketplace=&limit=10
 *
 * Buyurtma pozitsiyalarini tovar bo'yicha jamlaydi. Lokal Listing.sales
 * ustuniga tayangan eski getTopProducts'dan farqli — bu haqiqiy sotuvdan.
 */
export async function getTopSelling(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 180);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
    const mp = typeof req.query.marketplace === 'string' ? req.query.marketplace.toUpperCase() : undefined;

    const where: any = {
      organizationId,
      orderedAt: { gte: new Date(Date.now() - days * 24 * 3600_000) },
    };
    if (mp && isMarketplaceId(mp)) where.marketplace = mp;

    const orders = await prisma.marketplaceOrder.findMany({
      where,
      select: { marketplace: true, status: true, total: true, currency: true, items: true },
    });

    res.json({ days, products: aggregateTopProducts(orders.map(toOrderLike), limit) });
  } catch (err) {
    next(err);
  }
}
