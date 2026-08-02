import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;

    const [totalProducts, activeListings, draftListings, totalImages, aiJobs] =
      await Promise.all([
        prisma.product.count({ where: { organizationId } }),
        prisma.listing.count({
          where: { product: { organizationId }, status: 'PUBLISHED' },
        }),
        prisma.listing.count({
          where: { product: { organizationId }, status: 'DRAFT' },
        }),
        prisma.productImage.count({
          where: { product: { organizationId } },
        }),
        prisma.aiJob.count({
          where: { product: { organizationId }, status: 'COMPLETED' },
        }),
      ]);

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
