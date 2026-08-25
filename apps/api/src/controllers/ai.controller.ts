import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import {
  upscaleImage,
  checkJobStatus,
  waitForJob,
  HiggsfieldError,
} from '../services/higgsfield.service';
import { removeBackgroundRemoveBg, bgRemovalEnabled } from '../services/image/remove-bg.service';
import { storeImage } from '../services/image/storage';
import {
  generateListingText,
  generateAllListings,
  ProductInput,
  Marketplace,
} from '../services/ai/text-generator.service';

/**
 * Higgsfield xatosini foydalanuvchiga ko'rsatiladigan HttpError'ga o'girish.
 *
 * Xizmatning o'zi ishlamayotgan bo'lsa — 503: bu foydalanuvchi aybi emas va
 * frontend uni "qayta urinib ko'ring" deb ko'rsatishi kerak, xato sifatida emas.
 */
function toHiggsfieldHttpError(err: unknown): HttpError {
  if (err instanceof HiggsfieldError) {
    return new HttpError(err.isDown ? 503 : err.status && err.status < 500 ? 400 : 502, err.message);
  }
  return new HttpError(502, `Higgsfield xato: ${(err as Error)?.message ?? 'nomaʼlum'}`);
}

const removeBackgroundSchema = z.object({
  imageId: z.string(),
});

const upscaleSchema = z.object({
  imageId: z.string(),
  scale: z.union([z.literal(2), z.literal(4)]).default(2),
});

const generateTextSchema = z.object({
  productId: z.string(),
  marketplaces: z.array(z.enum(['UZUM', 'OZON', 'WB', 'YANDEX'])).min(1),
});

/**
 * POST /api/ai/remove-background
 * Rasm fonini o'chiradi (Higgsfield)
 */
export async function removeBackgroundController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!bgRemovalEnabled()) {
      throw new HttpError(
        409,
        "Fon o'chirish o'chirilgan. Serverda REMOVE_BG_API_KEY ni to'ldiring (yoki AI_BG_REMOVAL=on).",
      );
    }
    const { imageId } = removeBackgroundSchema.parse(req.body);
    const userId = req.user!.userId;
    const organizationId = req.organization!.id;

    // Rasmni topish (egalik tekshiruvi)
    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        product: { organizationId },
      },
    });
    if (!image) throw new HttpError(404, 'Rasm topilmadi');

    // AI job yaratish
    const aiJob = await prisma.aiJob.create({
      data: {
        userId,
        productId: image.productId,
        type: 'BACKGROUND_REMOVE',
        status: 'PROCESSING',
        inputUrl: image.url,
      },
    });

    try {
      // Rasmni yuklab, remove.bg bilan fonni oq qilamiz (sinxron — natija
      // darhol qaytadi, mahsulot qayta chizilmaydi, aynan saqlanadi).
      const src = await fetch(image.url);
      if (!src.ok) throw new Error(`Rasmni yuklab bo'lmadi (${src.status})`);
      const inputBuffer = Buffer.from(await src.arrayBuffer());

      const result = await removeBackgroundRemoveBg(
        inputBuffer,
        src.headers.get('content-type') || 'image/png',
      );
      if (!result.ok) throw new Error(result.error);

      const stored = await storeImage(result.buffer, `bg-${aiJob.id}.png`, 'image/png');

      await prisma.aiJob.update({
        where: { id: aiJob.id },
        data: { status: 'COMPLETED', outputUrl: stored.url, completedAt: new Date() },
      });

      // ProductImage yangi variant sifatida saqlash (oq fon — barchasiga mos)
      const newImage = await prisma.productImage.create({
        data: {
          productId: image.productId,
          url: stored.url,
          originalUrl: image.originalUrl,
          variant: 'UZUM',
          isAiProcessed: true,
          aiJobId: aiJob.id,
          order: image.order + 100,
        },
      });

      return res.json({ job: { ...aiJob, status: 'COMPLETED' }, image: newImage });
    } catch (aiErr: any) {
      await prisma.aiJob
        .update({ where: { id: aiJob.id }, data: { status: 'FAILED', error: aiErr?.message } })
        .catch(() => {});
      throw new HttpError(502, `AI fon o'chirish ishlamadi: ${aiErr?.message ?? 'nomaʼlum'}`);
    }
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/ai/upscale
 * Rasm sifatini oshiradi
 */
export async function upscaleController(req: Request, res: Response, next: NextFunction) {
  try {
    const { imageId, scale } = upscaleSchema.parse(req.body);
    const userId = req.user!.userId;
    const organizationId = req.organization!.id;

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, product: { organizationId } },
    });
    if (!image) throw new HttpError(404, 'Rasm topilmadi');

    const aiJob = await prisma.aiJob.create({
      data: {
        userId,
        productId: image.productId,
        type: 'UPSCALE',
        status: 'PROCESSING',
        inputUrl: image.url,
        metadata: { scale },
      },
    });

    try {
      const hfJob = await upscaleImage(image.url, scale);

      await prisma.aiJob.update({
        where: { id: aiJob.id },
        data: { providerJobId: hfJob.jobId },
      });

      if (hfJob.status === 'completed' && hfJob.outputUrl) {
        await prisma.aiJob.update({
          where: { id: aiJob.id },
          data: {
            status: 'COMPLETED',
            outputUrl: hfJob.outputUrl,
            completedAt: new Date(),
          },
        });

        // Original rasmni URL ini yangilash
        await prisma.productImage.update({
          where: { id: image.id },
          data: { url: hfJob.outputUrl, isAiProcessed: true },
        });

        return res.json({ job: { ...aiJob, status: 'COMPLETED' }, url: hfJob.outputUrl });
      }

      res.json({ job: { ...aiJob, providerJobId: hfJob.jobId } });
    } catch (hfErr: any) {
      await prisma.aiJob.update({
        where: { id: aiJob.id },
        data: { status: 'FAILED', error: hfErr.message },
      });
      throw toHiggsfieldHttpError(hfErr);
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/ai/jobs/:id
 * Job holatini tekshirish
 */
export async function getJobStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const job = await prisma.aiJob.findFirst({
      where: { id, userId },
    });
    if (!job) throw new HttpError(404, 'Job topilmadi');

    // Agar hali PROCESSING bo'lsa — Higgsfield'dan qayta so'rash
    if (job.status === 'PROCESSING' && job.providerJobId) {
      try {
        const hfJob = await checkJobStatus(job.providerJobId);

        if (hfJob.status === 'completed' && hfJob.outputUrl) {
          await prisma.aiJob.update({
            where: { id },
            data: {
              status: 'COMPLETED',
              outputUrl: hfJob.outputUrl,
              completedAt: new Date(),
            },
          });

          // Rasmni saqlash
          if (job.productId && job.type === 'BACKGROUND_REMOVE') {
            await prisma.productImage.create({
              data: {
                productId: job.productId,
                url: hfJob.outputUrl,
                originalUrl: job.inputUrl!,
                variant: 'UZUM',
                isAiProcessed: true,
                aiJobId: job.id,
              },
            });
          }

          return res.json({ ...job, status: 'COMPLETED', outputUrl: hfJob.outputUrl });
        }

        if (hfJob.status === 'failed') {
          await prisma.aiJob.update({
            where: { id },
            data: { status: 'FAILED', error: hfJob.error },
          });
          return res.json({ ...job, status: 'FAILED', error: hfJob.error });
        }
      } catch (checkErr) {
        console.error('Job status tekshirishda xato:', checkErr);
      }
    }

    res.json(job);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/ai/generate-listings
 * Tanlangan marketplace'lar uchun matn generatsiyasi (title, desc, SEO)
 */
export async function generateListingsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { productId, marketplaces } = generateTextSchema.parse(req.body);
    const organizationId = req.organization!.id;

    const product = await prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');

    const input: ProductInput = {
      title: product.title,
      description: product.description,
      category: product.category,
      brand: product.brand || undefined,
      attributes: (product.attributes as any) || {},
      basePrice: product.basePrice.toString(),
      currency: product.currency,
    };

    // Parallel generatsiya
    const results = await Promise.allSettled(
      marketplaces.map(async (mp: Marketplace) => {
        const generated = await generateListingText(input, mp);

        // Bazaga saqlash (upsert)
        const listing = await prisma.listing.upsert({
          where: {
            productId_marketplace: {
              productId,
              marketplace: mp,
            },
          },
          create: {
            productId,
            marketplace: mp,
            status: 'DRAFT',
            title: generated.title,
            description: generated.description,
            seoKeywords: generated.seoKeywords,
            price: product.basePrice,
          },
          update: {
            title: generated.title,
            description: generated.description,
            seoKeywords: generated.seoKeywords,
          },
        });

        return { marketplace: mp, listing };
      }),
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);
    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r: any) => ({ error: r.reason?.message || 'Nomaʼlum xato' }));

    res.json({
      generated: successful,
      failed,
      total: marketplaces.length,
      succeeded: successful.length,
    });
  } catch (err) {
    next(err);
  }
}
