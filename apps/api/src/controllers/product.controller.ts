import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import { getSpec } from '../services/marketplace/specs';
import { scoreCard } from '../services/marketplace/quality.service';

const createProductSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  category: z.string().min(1),
  brand: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  basePrice: z.number().positive(),
  currency: z.enum(['UZS', 'RUB', 'USD']).default('UZS'),
  stock: z.number().int().min(0).default(0),
  attributes: z.record(z.string(), z.any()).default({}),
});

const updateProductSchema = createProductSchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  category: z.string().optional(),
});

const addImageSchema = z.object({
  url: z.string().url(),
  fileKey: z.string().optional(),
  isPrimary: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
});

/**
 * GET /api/products
 * Tashkilot mahsulotlari
 */
export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse(req.query);
    const organizationId = req.organization!.id;

    const where: any = { organizationId };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;

    const [rawItems, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: { orderBy: { order: 'asc' }, take: 1 },
          listings: { select: { marketplace: true, status: true } },
          // Baho uchun rasmlarning UMUMIY soni kerak (ko'rsatishga bittasi yetadi)
          _count: { select: { images: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);

    // Har kartochkaga sifat bahosi — u qaysi marketplace uchun saqlangan
    // bo'lsa, o'sha talab bo'yicha. Marketplace konteksti yo'q eski
    // kartochkalarda baho null bo'ladi.
    const items = rawItems.map(({ _count, ...product }) => {
      const attrs = (product.attributes as any) || {};
      const spec = attrs.marketplace ? getSpec(attrs.marketplace) : null;
      const quality = spec
        ? { marketplace: spec.id, ...scoreCard(spec, attrs.values || {}, _count.images) }
        : null;
      return { ...product, quality };
    });

    res.json({
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizationId = req.organization!.id;

    const product = await prisma.product.findFirst({
      where: { id, organizationId },
      include: {
        images: { orderBy: { order: 'asc' } },
        listings: true,
      },
    });

    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');
    res.json({ product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createProductSchema.parse(req.body);
    const organizationId = req.organization!.id;
    const userId = req.user!.userId;

    const product = await prisma.product.create({
      data: {
        ...data,
        organizationId,
        createdById: userId,
        status: 'DRAFT',
      },
      include: {
        images: true,
        listings: true,
      },
    });

    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizationId = req.organization!.id;
    const data = updateProductSchema.parse(req.body);

    const existing = await prisma.product.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, 'Mahsulot topilmadi');

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        images: { orderBy: { order: 'asc' } },
        listings: true,
      },
    });

    res.json({ product });
  } catch (err) {
    next(err);
  }
}

/**
 * Faqat OWNER/ADMIN o'chira oladi (routes'da tekshiriladi)
 */
export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizationId = req.organization!.id;

    const existing = await prisma.product.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, 'Mahsulot topilmadi');

    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addProductImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const organizationId = req.organization!.id;
    const data = addImageSchema.parse(req.body);

    const product = await prisma.product.findFirst({
      where: { id, organizationId },
      include: { images: true },
    });
    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');

    const isFirst = product.images.length === 0;

    if (data.isPrimary || isFirst) {
      await prisma.productImage.updateMany({
        where: { productId: id },
        data: { isPrimary: false },
      });
    }

    const image = await prisma.productImage.create({
      data: {
        productId: id,
        url: data.url,
        originalUrl: data.url,
        fileKey: data.fileKey,
        isPrimary: data.isPrimary || isFirst,
        order: data.order,
        variant: 'ORIGINAL',
      },
    });

    res.status(201).json({ image });
  } catch (err) {
    next(err);
  }
}

export async function deleteProductImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, imageId } = req.params;
    const organizationId = req.organization!.id;

    const product = await prisma.product.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });
    if (!image) throw new HttpError(404, 'Rasm topilmadi');

    await prisma.productImage.delete({ where: { id: imageId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
