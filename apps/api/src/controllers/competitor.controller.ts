import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import { detectMarketplace, priceVerdict } from '../services/marketplace/competitor.service';
import {
  checkOneWatch,
  checkOrganizationCompetitors,
} from '../services/marketplace/competitor-check.service';

const createSchema = z.object({
  url: z.string().url("Havola noto'g'ri"),
  label: z.string().trim().max(120).optional(),
  productId: z.string().cuid().optional(),
});

function currencyOf(mp: string): 'UZS' | 'RUB' {
  return mp === 'UZUM' ? 'UZS' : 'RUB';
}

/** GET /api/competitors — kuzatuvlar ro'yxati (o'z narxi bilan taqqoslab) */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const watches = await prisma.competitorWatch.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            listings: { select: { marketplace: true, price: true, discountPrice: true } },
          },
        },
      },
    });

    const rows = watches.map((w) => {
      // O'z narxi: shu bozor uchun kiritilgan listing narxi (bir valyutada)
      const listing = w.product?.listings.find((l) => l.marketplace === w.marketplace);
      const ownPrice = listing ? Number(listing.discountPrice ?? listing.price) : null;
      const ownCurrency = listing ? currencyOf(w.marketplace) : null;
      const compPrice = w.lastPrice != null ? Number(w.lastPrice) : null;

      const comparison =
        ownPrice && compPrice
          ? priceVerdict(ownPrice, ownCurrency, compPrice, w.lastCurrency)
          : undefined;

      return {
        id: w.id,
        url: w.url,
        label: w.label,
        marketplace: w.marketplace,
        lastPrice: compPrice,
        lastCurrency: w.lastCurrency,
        lastTitle: w.lastTitle,
        lastCheckedAt: w.lastCheckedAt,
        lastError: w.lastError,
        history: w.history,
        product: w.product ? { id: w.product.id, title: w.product.title } : null,
        ownPrice,
        ownCurrency,
        comparison,
      };
    });

    res.json({ watches: rows });
  } catch (err) {
    next(err);
  }
}

/** POST /api/competitors — yangi kuzatuv qo'shish */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const data = createSchema.parse(req.body);

    const source = detectMarketplace(data.url);
    if (!source) {
      throw new HttpError(
        400,
        "Havola tanilmadi. Uzum, Wildberries, Ozon yoki Yandex Market mahsulot havolasini kiriting.",
      );
    }

    // Bog'langan mahsulot shu tashkilotniki ekanini tekshiramiz
    if (data.productId) {
      const owns = await prisma.product.count({
        where: { id: data.productId, organizationId },
      });
      if (!owns) throw new HttpError(404, 'Mahsulot topilmadi');
    }

    const existing = await prisma.competitorWatch.findUnique({
      where: { organizationId_url: { organizationId, url: data.url } },
      select: { id: true },
    });
    if (existing) throw new HttpError(409, 'Bu havola allaqachon kuzatuvda');

    const watch = await prisma.competitorWatch.create({
      data: {
        organizationId,
        url: data.url,
        label: data.label || null,
        marketplace: source.marketplace,
        productId: data.productId || null,
      },
      select: { id: true },
    });

    // Darrov bir marta o'qib qo'yamiz — ro'yxat bo'sh ko'rinmasin
    let firstCheck;
    try {
      firstCheck = await checkOneWatch(watch.id);
    } catch {
      firstCheck = undefined;
    }

    res.status(201).json({ success: true, id: watch.id, firstCheck });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/competitors/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const { id } = req.params;

    const watch = await prisma.competitorWatch.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!watch) throw new HttpError(404, 'Kuzatuv topilmadi');

    await prisma.competitorWatch.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** POST /api/competitors/:id/check — bittasini hozir tekshirish */
export async function checkOne(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const { id } = req.params;

    const watch = await prisma.competitorWatch.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!watch) throw new HttpError(404, 'Kuzatuv topilmadi');

    const result = await checkOneWatch(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** POST /api/competitors/check — hammasini hozir tekshirish */
export async function checkAll(req: Request, res: Response, next: NextFunction) {
  try {
    const results = await checkOrganizationCompetitors(req.organization!.id);
    res.json({
      success: true,
      checked: results.filter((r) => r.ok).length,
      dropped: results.filter((r) => r.priceDropped).length,
      results,
    });
  } catch (err) {
    next(err);
  }
}
