import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import { exportToUzumFormat, scrapeUzumProduct } from '../services/marketplace/uzum.service';

const updateListingSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  seoKeywords: z.string().optional(),
  price: z.coerce.number().positive().optional(),
  discountPrice: z.coerce.number().positive().nullable().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'PAUSED', 'ERROR']).optional(),
});

const scrapeSchema = z.object({
  url: z.string().url(),
});

/**
 * GET /api/listings/product/:productId
 * Mahsulotning barcha marketplace kartochkalari
 */
export async function getProductListings(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params;
    const userId = req.user!.userId;

    const product = await prisma.product.findFirst({
      where: { id: productId, userId },
      include: {
        listings: true,
        images: { orderBy: { order: 'asc' } },
      },
    });
    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');

    res.json({
      product: {
        id: product.id,
        title: product.title,
        basePrice: product.basePrice,
        currency: product.currency,
      },
      listings: product.listings,
      images: product.images,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/listings/:id
 * Bitta kartochkani tahrirlash
 */
export async function updateListing(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const data = updateListingSchema.parse(req.body);

    // Egalik tekshiruvi
    const existing = await prisma.listing.findFirst({
      where: { id, product: { userId } },
    });
    if (!existing) throw new HttpError(404, 'Kartochka topilmadi');

    const listing = await prisma.listing.update({
      where: { id },
      data,
    });

    res.json({ listing });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/listings/:id/export
 * Kartochkani Uzum uchun eksport qilish (JSON + ma'lumot)
 */
export async function exportListing(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const listing = await prisma.listing.findFirst({
      where: { id, product: { userId } },
      include: {
        product: {
          include: {
            images: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!listing) throw new HttpError(404, 'Kartochka topilmadi');

    // Faqat Uzum uchun optimal rasmlarni tanlash
    const images = listing.product.images
      .filter(
        (img) => img.variant === 'UZUM' || img.variant === 'ORIGINAL',
      )
      .map((img) => ({
        url: img.url,
        order: img.order,
        isPrimary: img.isPrimary,
      }));

    const exportData = exportToUzumFormat({
      productId: listing.product.id,
      title: listing.title,
      description: listing.description,
      seoKeywords: listing.seoKeywords || '',
      price: listing.price.toString(),
      discountPrice: listing.discountPrice?.toString(),
      currency: listing.product.currency,
      category: listing.product.category,
      brand: listing.product.brand || undefined,
      sku: listing.product.sku || undefined,
      barcode: listing.product.barcode || undefined,
      stock: listing.product.stock,
      attributes: (listing.product.attributes as any) || {},
      images,
    });

    res.json(exportData);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/listings/scrape/uzum
 * Uzum'dan mahsulot ma'lumotlarini ko'chirib olish
 */
export async function scrapeFromUzum(req: Request, res: Response, next: NextFunction) {
  try {
    const { url } = scrapeSchema.parse(req.body);

    if (!url.includes('uzum.uz')) {
      throw new HttpError(400, 'Faqat uzum.uz linklari qabul qilinadi');
    }

    const scraped = await scrapeUzumProduct(url);
    res.json({ source: 'uzum.uz', url, data: scraped });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/listings/:id
 */
export async function deleteListing(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const existing = await prisma.listing.findFirst({
      where: { id, product: { userId } },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, 'Kartochka topilmadi');

    await prisma.listing.delete({ where: { id } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
