import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import { exportToUzumFormat, scrapeUzumProduct } from '../services/marketplace/uzum.service';
import { getSpec, findField, MarketplaceId } from '../services/marketplace/specs';

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

const copySchema = z.object({
  marketplaces: z.array(z.enum(['UZUM', 'OZON', 'WB', 'YANDEX'])).min(1),
  /** Mavjud kartochkalar ustiga yozilsinmi */
  overwrite: z.boolean().default(false),
});

/**
 * Matnni marketplace chegarasiga sig'dirish.
 *
 * Har bir marketplace o'z chegarasini qo'yadi va ular juda farq qiladi —
 * WB sarlavhasi atigi 60 belgi, Ozon'da 200. Shuning uchun nusxalashda
 * matnni shunchaki ko'chirib bo'lmaydi: so'z o'rtasidan kesmaslik uchun
 * oxirgi probelgacha qisqartiramiz.
 */
function fitToLimit(text: string, limit?: number): { value: string; trimmed: boolean } {
  if (!limit || text.length <= limit) return { value: text, trimmed: false };
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  // Probel juda boshida bo'lsa (uzun bitta so'z) — o'z holicha kesamiz
  const value = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return { value: value.trimEnd(), trimmed: true };
}

/** Marketplace uchun `title` / `description` maydonining uzunlik chegarasi */
function limitFor(marketplace: MarketplaceId, key: 'title' | 'description'): number | undefined {
  const spec = getSpec(marketplace);
  return spec ? findField(spec, key)?.maxLength : undefined;
}

/**
 * GET /api/listings/product/:productId
 * Mahsulotning barcha marketplace kartochkalari
 */
export async function getProductListings(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params;
    const organizationId = req.organization!.id;

    const product = await prisma.product.findFirst({
      where: { id: productId, organizationId },
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
    const organizationId = req.organization!.id;
    const data = updateListingSchema.parse(req.body);

    // Egalik tekshiruvi
    const existing = await prisma.listing.findFirst({
      where: { id, product: { organizationId } },
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
    const organizationId = req.organization!.id;

    const listing = await prisma.listing.findFirst({
      where: { id, product: { organizationId } },
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
    const organizationId = req.organization!.id;

    const existing = await prisma.listing.findFirst({
      where: { id, product: { organizationId } },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, 'Kartochka topilmadi');

    await prisma.listing.delete({ where: { id } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/listings/:id/copy-to
 *
 * Tayyor kartochkani boshqa marketplace'larga nusxalash.
 *
 * AI generatsiyasidan farqi — bu bir zumda va bepul ishlaydi: bitta
 * marketplace uchun matn allaqachon tayyorlangan bo'lsa, qolganlarini
 * noldan yozdirishning hojati yo'q. Matn har bir marketplace chegarasiga
 * moslab qisqartiriladi.
 */
export async function copyListingTo(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { marketplaces, overwrite } = copySchema.parse(req.body);
    const organizationId = req.organization!.id;

    const source = await prisma.listing.findFirst({
      where: { id, product: { organizationId } },
    });
    if (!source) throw new HttpError(404, 'Kartochka topilmadi');

    const targets = marketplaces.filter((mp) => mp !== source.marketplace);
    if (!targets.length) {
      throw new HttpError(400, "Nusxalash uchun boshqa marketplace tanlang");
    }

    const existing = await prisma.listing.findMany({
      where: { productId: source.productId, marketplace: { in: targets } },
      select: { marketplace: true },
    });
    const alreadyThere = new Set(existing.map((l) => l.marketplace));

    const created: string[] = [];
    const skipped: string[] = [];
    const warnings: Array<{ marketplace: string; message: string }> = [];

    for (const mp of targets) {
      if (alreadyThere.has(mp) && !overwrite) {
        skipped.push(mp);
        continue;
      }

      const title = fitToLimit(source.title, limitFor(mp, 'title'));
      const description = fitToLimit(source.description, limitFor(mp, 'description'));
      if (title.trimmed) {
        warnings.push({
          marketplace: mp,
          message: `Sarlavha ${limitFor(mp, 'title')} belgigacha qisqartirildi — tekshirib chiqing`,
        });
      }
      if (description.trimmed) {
        warnings.push({ marketplace: mp, message: 'Tavsif chegaraga moslab qisqartirildi' });
      }

      await prisma.listing.upsert({
        where: { productId_marketplace: { productId: source.productId, marketplace: mp } },
        create: {
          productId: source.productId,
          marketplace: mp,
          status: 'DRAFT',
          title: title.value,
          description: description.value,
          seoKeywords: source.seoKeywords,
          price: source.price,
          discountPrice: source.discountPrice,
        },
        update: {
          title: title.value,
          description: description.value,
          seoKeywords: source.seoKeywords,
          price: source.price,
          discountPrice: source.discountPrice,
        },
      });
      created.push(mp);
    }

    res.json({ success: true, from: source.marketplace, created, skipped, warnings });
  } catch (err) {
    next(err);
  }
}
