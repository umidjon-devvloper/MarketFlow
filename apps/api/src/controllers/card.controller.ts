/**
 * Marketplace kartochkasi oqimi
 *
 * 1. GET  /api/cards/specs            — marketplace ro'yxati (logo, rasm talablari)
 * 2. GET  /api/cards/specs/:mp        — o'sha marketplace'ning to'liq maydonlari
 * 3. POST /api/cards/adapt-image      — rasmni AI bilan marketplace o'lchamiga moslash
 * 4. POST /api/cards/ai-fill          — rasmga qarab maydonlarni AI to'ldirsin
 * 5. POST /api/cards/price-advice     — AI narx tavsiyasi va qo'yilgan narxga baho
 * 6. POST /api/cards                  — kartochkani saqlash (Product + Listing)
 * 7. GET  /api/cards                  — saqlangan kartochkalar
 * 8. POST /api/cards/export           — marketplace formatida Excel
 */

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Marketplace } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';
import {
  getSpec,
  listSpecSummaries,
  allFields,
  validateValues,
  MarketplaceSpec,
} from '../services/marketplace/specs';
import { adaptImageToSpec } from '../services/image/adapt.service';
import { storeImage, hasCloudStorage } from '../services/image/storage';
import { fillFieldsFromImages } from '../services/ai/vision.service';
import { suggestPrice } from '../services/ai/price-advisor.service';
import { matchCategory, chooseTnved } from '../services/ai/category-match.service';
import {
  assertAiQuota,
  recordAiJob,
  estimateTextCost,
  imageJobCost,
  getQuotaStatus,
} from '../services/ai/quota.service';
import { prefillForMarketplace } from '../services/marketplace/prefill';
import {
  publishToMarketplace,
  checkPublishStatus,
  supportsPublish,
  PublishNotSupportedError,
} from '../services/marketplace/publish.service';
import {
  searchCategories,
  getWbCharacteristics,
  getWbTnved,
  CategoryError,
} from '../services/marketplace/categories.service';
import {
  enqueuePublish,
  listPublishJobs,
  getQueueSummary,
  cancelPublishJobs,
  applyCategoryToProducts,
} from '../services/marketplace/publish-queue.service';
import {
  pushPriceStock,
  priceForMarketplace,
  buildSyncMessage,
  suspiciousPrice,
  PriceStockItem,
} from '../services/marketplace/price-stock.service';
import { scoreCard } from '../services/marketplace/quality.service';
import { decrypt } from '../utils/encryption';
import {
  buildMarketplaceWorkbook,
  exportFileName,
  ExportRow,
} from '../services/export/marketplace-excel.service';
import {
  fillUzumTemplate,
  toUzumRow,
  uzumFileName,
  uzumMaxRows,
} from '../services/export/uzum-template.service';
import { fillWbTemplate, toWbRow, wbFileName } from '../services/export/wb-template.service';

// ============================================
// Spetsifikatsiyalar
// ============================================

export async function getSpecs(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ items: listSpecSummaries() });
  } catch (err) {
    next(err);
  }
}

export async function getSpecDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const spec = getSpec(req.params.marketplace?.toUpperCase() || '');
    if (!spec) throw new HttpError(404, 'Bunday marketplace yo\'q');
    res.json(spec);
  } catch (err) {
    next(err);
  }
}

// ============================================
// Rasm yuklash
// ============================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Faqat rasm fayllari qabul qilinadi'));
    }
    cb(null, true);
  },
});

export const uploadMiddleware = upload.single('file');

/**
 * POST /api/cards/upload
 * Rasmni saqlaydi. UPLOADTHING_TOKEN bo'lsa bulutga, bo'lmasa lokal papkaga.
 */
export async function uploadImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new HttpError(400, 'Fayl yuborilmadi');

    const stored = await storeImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ ...stored, cloud: hasCloudStorage() });
  } catch (err) {
    next(err);
  }
}

// ============================================
// Rasm moslashtirish
// ============================================

const adaptSchema = z.object({
  marketplace: z.string(),
  imageUrl: z.string().url(),
  // Ko'rsatilmasa — server sozlamasi hal qiladi (AI_BG_REMOVAL, standart o'chiq)
  removeBg: z.boolean().optional(),
});

export async function adaptImage(req: Request, res: Response, next: NextFunction) {
  const organizationId = req.organization!.id;
  const userId = req.user!.userId;

  try {
    const body = adaptSchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, 'Bunday marketplace yo\'q');

    await assertAiQuota(organizationId);

    const result = await adaptImageToSpec(body.imageUrl, spec, { removeBg: body.removeBg });

    await recordAiJob({
      organizationId,
      userId,
      type: 'ADAPT_IMAGE',
      provider: 'higgsfield+sharp',
      status: 'COMPLETED',
      inputUrl: body.imageUrl,
      outputUrl: result.url,
      costUsd: imageJobCost(),
      metadata: { marketplace: spec.id, warnings: result.warnings },
    });

    res.json(result);
  } catch (err: any) {
    if (err?.name === 'ZodError' || err instanceof HttpError) return next(err);

    await recordAiJob({
      organizationId,
      userId,
      type: 'ADAPT_IMAGE',
      provider: 'higgsfield+sharp',
      status: 'FAILED',
      error: err.message,
    });
    next(new HttpError(502, `Rasmni moslashtirib bo'lmadi: ${err.message}`));
  }
}

// ============================================
// AI bilan maydonlarni to'ldirish
// ============================================

/**
 * Kategoriya xarakteristikasi — frontend allaqachon yuklab olgan ro'yxatni
 * qaytarib yuboradi. Qaytadan marketplace'dan so'ramaymiz: bu ikkinchi tashqi
 * chaqiruv va yana bir kutish demak edi.
 */
const charcInputSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(300),
  type: z.enum(['number', 'string']),
  required: z.boolean().default(false),
  unit: z.string().max(60).optional(),
  maxCount: z.number().int().min(0).max(200).default(1),
  popular: z.boolean().optional(),
});

const aiFillSchema = z.object({
  marketplace: z.string(),
  imageUrls: z.array(z.string().url()).min(1).max(4),
  hints: z.record(z.string(), z.string()).default({}),
  /** Kategoriyaga bog'liq dinamik maydonlar (WB) — bo'lsa ular ham to'ldiriladi */
  charcs: z.array(charcInputSchema).max(300).default([]),
  /**
   * 'charcs' — faqat kategoriya xususiyatlarini to'ldirish. Shu bo'limdagi
   * alohida tugma uchun: asosiy maydonlarni qayta so'rash ortiqcha token.
   */
  scope: z.enum(['all', 'charcs']).default('all'),
  /** Tanlangan kategoriya ID — TN VED ro'yxati shunga bog'liq */
  categoryId: z.string().optional(),
});

export async function aiFill(req: Request, res: Response, next: NextFunction) {
  const organizationId = req.organization!.id;
  const userId = req.user!.userId;

  try {
    const body = aiFillSchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, 'Bunday marketplace yo\'q');

    await assertAiQuota(organizationId);

    // TN VED ro'yxati spec'da yo'q — WB dan predmetga qarab keladi. Ro'yxatni
    // AI ga bersak, u erkin kod yozmaydi (bojxona kodini o'ylab topib bo'lmaydi),
    // faqat shu kategoriyaga ruxsat etilganlaridan birini tanlaydi.
    const dynamicOptions: Record<string, string[]> = {};
    if (spec.id === 'WB' && body.categoryId && body.scope === 'all') {
      const cred = await prisma.userMarketplace.findFirst({
        where: { organizationId, marketplace: spec.id as Marketplace, isActive: true },
      });
      if (cred) {
        const codes = await getWbTnved(decrypt(cred.apiKey), body.categoryId).catch(() => []);
        if (codes.length) dynamicOptions.tnved = codes.map((c) => c.tnved);
      }
    }

    const result = await fillFieldsFromImages(
      body.imageUrls,
      spec,
      body.hints,
      body.charcs,
      body.scope,
      dynamicOptions,
    );

    await recordAiJob({
      organizationId,
      userId,
      type: 'FIELD_FILL',
      provider: result.provider,
      status: 'COMPLETED',
      inputUrl: body.imageUrls[0],
      tokensUsed: result.tokensUsed,
      costUsd: estimateTextCost(result.tokensUsed),
      metadata: {
        marketplace: spec.id,
        scope: body.scope,
        filled: Object.keys(result.values).length,
        charcsFilled: Object.keys(result.charcValues).length,
      },
    });

    // AI kategoriya NOMINI aytadi, joylash uchun esa katalog ID kerak.
    // Sotuvchi uni qo'lda qidirishi shart edi — bir bosishda to'ldirish shu
    // yerda uzilardi. Nomni katalogga bog'lab, ID ni ham qaytaramiz.
    let resolvedCategoryId = body.categoryId ?? '';
    const cred = await prisma.userMarketplace.findFirst({
      where: { organizationId, marketplace: spec.id as Marketplace, isActive: true },
    });

    if (cred && spec.id !== 'UZUM' && result.values.category && !resolvedCategoryId) {
      try {
        const options = await searchCategories(
          spec.id,
          {
            apiKey: decrypt(cred.apiKey),
            apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
            shopId: cred.shopId,
          },
          { query: result.values.category, limit: 30 },
        );
        const matched = await matchCategory(
          result.values.title || result.values.category,
          result.values.category,
          options,
        );
        if (matched) {
          result.values.category = matched.option.name;
          result.values.categoryId = matched.option.id;
          resolvedCategoryId = matched.option.id;
          if (!matched.exact) {
            result.notes.push(
              `Kategoriya katalogdan tanlandi: "${matched.option.name}" — to'g'ri emasmi, o'zgartiring`,
            );
          }
        } else {
          result.notes.push(
            `"${result.values.category}" katalogdan topilmadi — kategoriyani o'zingiz tanlang`,
          );
        }
      } catch {
        // Katalog o'qilmadi (kalit yoki limit) — nom qoladi, sotuvchi tanlaydi
      }
    }

    // TN VED — oxirgi so'z shu yerda. AI kategoriya ma'lum bo'lmagan paytda
    // to'ldirsa, kodni o'ylab topadi va yarim qiymat yozishi mumkin ("6105").
    // Shuning uchun qiymat BOR bo'lsa ham ro'yxatga solishtiriladi: mos
    // kelmasa qayta tanlanadi, tanlab bo'lmasa umuman o'chiriladi —
    // yaroqsiz kod formada qolib, sotuvchini adashtirmasin.
    if (cred && spec.id === 'WB' && resolvedCategoryId) {
      const codes = await getWbTnved(decrypt(cred.apiKey), resolvedCategoryId).catch(() => []);
      const allowed = codes.map((c) => c.tnved);
      const current = String(result.values.tnved ?? '').trim();

      if (allowed.length && !allowed.includes(current)) {
        const picked = await chooseTnved(
          `Mahsulot: ${result.values.title || ''}. Tarkib: ${result.values.composition || "ko'rsatilmagan"}. ` +
            `Jinsi: ${result.values.gender || "ko'rsatilmagan"}. Kategoriya: ${result.values.category || ''}.`,
          allowed,
        );
        if (picked) {
          result.values.tnved = picked;
          // "Chesniy znak" — huquqiy majburiyat: shunday kod tanlansa tovar
          // markirovka qilinishi shart. Sotuvchi buni bilmay qolmasin.
          const needsKiz = codes.find((c) => c.tnved === picked)?.isKiz;
          result.notes.push(
            `TN VED kodini AI tanladi (${picked}) — bojxona uchun tekshirib qo'ying` +
              (needsKiz ? '. DIQQAT: bu kod "Chesniy znak" markirovkasini talab qiladi' : ''),
          );
        } else {
          delete result.values.tnved;
          result.notes.push("TN VED kodini tanlab bo'lmadi — ro'yxatdan o'zingiz tanlang");
        }
      }
    }

    const quota = await getQuotaStatus(organizationId);
    res.json({ ...result, quota });
  } catch (err: any) {
    if (err?.name === 'ZodError' || err instanceof HttpError) return next(err);

    await recordAiJob({
      organizationId,
      userId,
      type: 'FIELD_FILL',
      provider: 'openai',
      status: 'FAILED',
      error: err.message,
    });
    next(new HttpError(502, err.message));
  }
}

/**
 * GET /api/cards/ai-usage
 * Bugungi AI sarfi — foydalanuvchi limitni ko'rib tursin
 */
export async function aiUsage(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getQuotaStatus(req.organization!.id));
  } catch (err) {
    next(err);
  }
}

// ============================================
// AI narx tavsiyasi
// ============================================

const priceAdviceSchema = z.object({
  marketplace: z.string(),
  /** Formadagi to'ldirilgan maydonlar — AI shu kontekstga qarab narx beradi */
  values: z.record(z.string(), z.any()).default({}),
  /** Sotuvchi qo'lda kiritgan narx — bo'lsa unga baho beriladi */
  price: z.number().positive().optional(),
  /** Tannarx — bo'lsa, tavsiya undan past bo'lmaydi */
  costPrice: z.number().positive().optional(),
});

/**
 * Forma qiymatini matnga aylantiradi.
 *
 * `values` ochiq record — ichiga obyekt yoki massiv ham tushishi mumkin. Ularni
 * String() bilan o'girsak promptga "[object Object]" kirib ketardi, AI esa shunga
 * qarab narx aytardi. Faqat oddiy qiymatlar olinadi.
 */
function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Narx tavsiyasiga aloqasi yo'q maydonlar — promptga kirmaydi */
const PRICE_CONTEXT_SKIP = new Set(['price', 'stock', 'vat', 'categoryId', 'sku', 'barcode']);

/**
 * POST /api/cards/price-advice
 *
 * "Bu mahsulotni qanchaga qo'yay?" va "qo'ygan narxim bozorga to'g'ri keladimi?"
 *
 * Valyuta marketplace spetsifikatsiyasidan olinadi (Uzum → UZS, qolgani → RUB) va
 * boshqa valyutadagi raqobatchilar taqqoslashga umuman kirmaydi.
 */
export async function priceAdvice(req: Request, res: Response, next: NextFunction) {
  const organizationId = req.organization!.id;
  const userId = req.user!.userId;

  try {
    const body = priceAdviceSchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");

    const title = asText(body.values.title);
    if (!title) {
      throw new HttpError(400, "Avval mahsulot nomini kiriting — nomsiz narx tavsiya qilib bo'lmaydi");
    }

    await assertAiQuota(organizationId);

    // Maydon kalitlarini AI tushunadigan yorliqqa aylantiramiz
    const fields = allFields(spec);
    const attributes: Record<string, string> = {};
    for (const field of fields) {
      if (field.hidden || PRICE_CONTEXT_SKIP.has(field.key)) continue;
      if (field.key === 'title' || field.key === 'brand' || field.key === 'category') continue;
      const raw = asText(body.values[field.key]);
      // Tavsif 5000 belgigacha bo'lishi mumkin — butunicha yuborsak prompt
      // (va hisob) bekorga shishadi. Narx uchun boshi yetarli.
      if (raw) attributes[field.label] = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
    }

    // Shu marketplace bo'yicha kuzatilayotgan raqobatchi narxlari.
    // Kuzatuv marketplace'ga bog'langani uchun valyuta ham o'shanikidir; baribir
    // taqqoslashdan oldin servis ichida valyuta yana bir bor solishtiriladi.
    const watches = await prisma.competitorWatch.findMany({
      where: { organizationId, marketplace: spec.id as Marketplace, lastPrice: { not: null } },
      select: { label: true, lastTitle: true, lastPrice: true, lastCurrency: true },
      orderBy: { lastCheckedAt: 'desc' },
      take: 10,
    });

    const advice = await suggestPrice({
      marketplaceName: spec.name,
      currency: spec.currency,
      title,
      brand: asText(body.values.brand) || undefined,
      category: asText(body.values.category) || undefined,
      attributes,
      currentPrice: body.price,
      costPrice: body.costPrice,
      competitors: watches.map((w) => ({
        label: w.label || w.lastTitle || 'raqobatchi',
        price: Number(w.lastPrice),
        currency: w.lastCurrency || spec.currency,
        title: w.lastTitle,
      })),
    });

    await recordAiJob({
      organizationId,
      userId,
      // AiJobType da alohida tur yo'q — bazani o'zgartirmaslik uchun GENERATE
      // ishlatiladi, aniq turi metadata da turadi.
      type: 'GENERATE',
      provider: advice.provider,
      status: 'COMPLETED',
      tokensUsed: advice.tokensUsed,
      costUsd: estimateTextCost(advice.tokensUsed),
      metadata: {
        kind: 'price-advice',
        marketplace: spec.id,
        currency: advice.currency,
        recommended: advice.recommended,
        competitorsUsed: watches.length,
      },
    });

    const quota = await getQuotaStatus(organizationId);
    res.json({ ...advice, quota });
  } catch (err: any) {
    if (err?.name === 'ZodError' || err instanceof HttpError) return next(err);

    await recordAiJob({
      organizationId,
      userId,
      type: 'GENERATE',
      provider: 'openai',
      status: 'FAILED',
      error: err.message,
      metadata: { kind: 'price-advice' },
    });
    next(new HttpError(502, err.message));
  }
}

// ============================================
// Saqlash
// ============================================

const imageSchema = z.object({
  url: z.string().url(),
  fileKey: z.string().optional(),
  originalUrl: z.string().url().optional(),
  isAdapted: z.boolean().default(false),
});

const saveSchema = z.object({
  marketplace: z.string(),
  values: z.record(z.string(), z.any()),
  images: z.array(imageSchema).min(1, 'Kamida bitta rasm kerak'),
});

/** Spec qiymatlaridan Product ustunlarini yig'ish */
function mapToProduct(spec: MarketplaceSpec, values: Record<string, any>) {
  const mapped: Record<string, any> = {};
  for (const field of allFields(spec)) {
    if (!field.mapsTo) continue;
    const raw = values[field.key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    mapped[field.mapsTo] = field.type === 'number' ? Number(raw) : String(raw).trim();
  }
  return mapped;
}

export async function saveCard(req: Request, res: Response, next: NextFunction) {
  try {
    const body = saveSchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, 'Bunday marketplace yo\'q');

    const issues = validateValues(spec, body.values);
    if (issues.length) {
      throw new HttpError(400, `To'ldirilmagan maydonlar: ${issues.map((i) => i.label).join(', ')}`);
    }

    const organizationId = req.organization!.id;
    const userId = req.user!.userId;
    const mapped = mapToProduct(spec, body.values);

    const title = mapped.title || 'Nomsiz mahsulot';
    const description = mapped.description || title;
    const category = mapped.category || 'Boshqa';
    const basePrice = Number(mapped.basePrice ?? 0);

    // SKU tashkilot ichida unikal. Band bo'lsa jimgina o'zgartirmaymiz —
    // aks holda Excel'ga sotuvchi yozgan artikul emas, boshqasi tushib,
    // omborlari bilan mos kelmay qolardi.
    const sku: string | null = mapped.sku ?? null;
    if (sku) {
      const taken = await prisma.product.findFirst({
        where: { organizationId, sku },
        select: { id: true, title: true },
      });
      if (taken) {
        throw new HttpError(
          409,
          `"${sku}" artikuli allaqachon ishlatilgan ("${taken.title}"). Boshqa artikul kiriting.`,
        );
      }
    }

    const product = await prisma.product.create({
      data: {
        organizationId,
        createdById: userId,
        title,
        description,
        category,
        brand: mapped.brand ?? null,
        sku,
        barcode: mapped.barcode ?? null,
        basePrice,
        currency: spec.currency,
        stock: Number(mapped.stock ?? 0),
        status: 'DRAFT',
        attributes: {
          marketplace: spec.id,
          values: body.values,
        },
        images: {
          create: body.images.map((img, index) => ({
            url: img.url,
            originalUrl: img.originalUrl || img.url,
            fileKey: img.fileKey ?? null,
            isPrimary: index === 0,
            order: index,
            isAiProcessed: img.isAdapted,
            variant: img.isAdapted ? (spec.id as any) : ('ORIGINAL' as const),
          })),
        },
        listings: {
          create: {
            marketplace: spec.id as any,
            status: 'DRAFT',
            title,
            description,
            price: basePrice,
          },
        },
      },
      include: { images: true, listings: true },
    });

    res.status(201).json({ product });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return next(new HttpError(409, 'Bu SKU allaqachon band'));
    }
    next(err);
  }
}

// ============================================
// Boshqa marketplace uchun qayta ishlatish
// ============================================

/**
 * GET /api/cards/:productId/prefill/:marketplace
 * Mavjud kartochkadan yangi marketplace uchun maydonlarni tayyorlab beradi.
 */
export async function prefillCard(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const spec = getSpec(req.params.marketplace?.toUpperCase() || '');
    if (!spec) throw new HttpError(404, 'Bunday marketplace yo\'q');

    const product = await prisma.product.findFirst({
      where: { id: req.params.productId, organizationId },
      include: {
        images: { orderBy: { order: 'asc' } },
        listings: { select: { marketplace: true } },
      },
    });
    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');

    const attrs = (product.attributes as any) || {};
    const sourceSpec = attrs.marketplace ? getSpec(attrs.marketplace) : null;

    const result = prefillForMarketplace(
      attrs.values || {},
      sourceSpec,
      {
        title: product.title,
        description: product.description,
        category: product.category,
        brand: product.brand,
        sku: product.sku,
        barcode: product.barcode,
        basePrice: product.basePrice?.toString(),
        currency: product.currency,
        stock: product.stock,
      },
      spec,
    );

    // Shu marketplace uchun moslashtirilgan rasmlar bormi
    const adapted = product.images.filter((i) => i.variant === (spec.id as any));

    // Asl rasmlar. Kartochka boshqa marketplace uchun saqlangan bo'lsa,
    // ORIGINAL variant bo'lmasligi mumkin — u holda mavjud rasmlarning
    // asl manzilini olamiz, aks holda sehrgar rasmsiz boshlanardi.
    const originalVariants = product.images.filter((i) => i.variant === 'ORIGINAL');
    const originals = originalVariants.length
      ? originalVariants
      : product.images.filter((i) => i.variant !== (spec.id as any));

    res.json({
      ...result,
      sourceMarketplace: attrs.marketplace ?? null,
      alreadyExists: product.listings.some((l) => l.marketplace === (spec.id as any)),
      product: { id: product.id, title: product.title },
      images: {
        // Moslashtirish uchun asl rasmlar kerak
        originals: originals.map((i) => ({ url: i.originalUrl || i.url, fileKey: i.fileKey })),
        adapted: adapted.map((i) => ({ url: i.url, fileKey: i.fileKey })),
      },
    });
  } catch (err) {
    next(err);
  }
}

const addListingSchema = z.object({
  marketplace: z.string(),
  values: z.record(z.string(), z.any()),
  images: z.array(imageSchema).min(1, 'Kamida bitta rasm kerak'),
});

/**
 * POST /api/cards/:productId/listings
 * Mavjud mahsulotga yangi marketplace kartochkasini qo'shadi —
 * yangi Product yaratmaydi, shuning uchun nusxalar ko'paymaydi.
 */
export async function addListing(req: Request, res: Response, next: NextFunction) {
  try {
    const body = addListingSchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, 'Bunday marketplace yo\'q');

    const issues = validateValues(spec, body.values);
    if (issues.length) {
      throw new HttpError(400, `To'ldirilmagan maydonlar: ${issues.map((i) => i.label).join(', ')}`);
    }

    const organizationId = req.organization!.id;
    const product = await prisma.product.findFirst({
      where: { id: req.params.productId, organizationId },
    });
    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');

    const mapped = mapToProduct(spec, body.values);
    const attrs = (product.attributes as any) || {};

    // Har marketplace o'z qiymatlarini alohida saqlaydi
    const byMarketplace = { ...(attrs.byMarketplace || {}) };
    if (attrs.marketplace && attrs.values && !byMarketplace[attrs.marketplace]) {
      byMarketplace[attrs.marketplace] = attrs.values;
    }
    byMarketplace[spec.id] = body.values;

    const [listing] = await prisma.$transaction([
      prisma.listing.upsert({
        where: { productId_marketplace: { productId: product.id, marketplace: spec.id as any } },
        create: {
          productId: product.id,
          marketplace: spec.id as any,
          status: 'DRAFT',
          title: mapped.title || product.title,
          description: mapped.description || product.description,
          price: Number(mapped.basePrice ?? product.basePrice),
        },
        update: {
          title: mapped.title || product.title,
          description: mapped.description || product.description,
          price: Number(mapped.basePrice ?? product.basePrice),
        },
      }),
      prisma.product.update({
        where: { id: product.id },
        data: { attributes: { ...attrs, byMarketplace } as any },
      }),
    ]);

    // Moslashtirilgan rasmlarni shu marketplace varianti sifatida saqlaymiz
    const adaptedImages = body.images.filter((img) => img.isAdapted);
    if (adaptedImages.length) {
      await prisma.productImage.createMany({
        data: adaptedImages.map((img, index) => ({
          productId: product.id,
          url: img.url,
          originalUrl: img.originalUrl || img.url,
          fileKey: img.fileKey ?? null,
          isPrimary: false,
          order: 100 + index,
          isAiProcessed: true,
          variant: spec.id as any,
        })),
      });
    }

    res.status(201).json({ listing, productId: product.id });
  } catch (err) {
    next(err);
  }
}

// ============================================
// Ro'yxat
// ============================================

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  marketplace: z.string().optional(),
});

export async function listCards(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listSchema.parse(req.query);
    const organizationId = req.organization!.id;

    const where: any = { organizationId };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.marketplace && getSpec(query.marketplace.toUpperCase())) {
      where.listings = { some: { marketplace: query.marketplace.toUpperCase() } };
    }

    const [rawItems, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: { orderBy: { order: 'asc' } },
          listings: { select: { marketplace: true, status: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);

    // Har kartochkaga sifat bahosini qo'shamiz. Baho kartochka qaysi
    // marketplace uchun saqlangan bo'lsa, o'sha talab bo'yicha hisoblanadi.
    const items = rawItems.map((product) => {
      const attrs = (product.attributes as any) || {};
      const mp = attrs.marketplace ? getSpec(attrs.marketplace) : null;
      const values: Record<string, any> = attrs.values || {};
      const quality = mp
        ? { marketplace: mp.id, ...scoreCard(mp, values, product.images.length) }
        : null;
      // Ro'yxatda faqat birinchi rasm kerak — qolganini yubormaymiz
      return { ...product, images: product.images.slice(0, 1), quality };
    });

    res.json({
      items,
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

// ============================================
// To'g'ridan-to'g'ri joylash
// ============================================

/**
 * POST /api/cards/:productId/publish/:marketplace
 * Kartochkani marketplace API'si orqali joylaydi (Uzum'dan tashqari).
 */
export async function publishCard(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const spec = getSpec(req.params.marketplace?.toUpperCase() || '');
    if (!spec) throw new HttpError(404, 'Bunday marketplace yo\'q');

    if (!supportsPublish(spec.id)) {
      throw new HttpError(400, new PublishNotSupportedError(spec.name).message);
    }

    const [product, cred] = await Promise.all([
      prisma.product.findFirst({
        where: { id: req.params.productId, organizationId },
        include: { images: { orderBy: { order: 'asc' } } },
      }),
      prisma.userMarketplace.findFirst({
        where: { organizationId, marketplace: spec.id as any, isActive: true },
      }),
    ]);

    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');
    if (!cred) {
      throw new HttpError(
        400,
        `${spec.name} ulanmagan. Marketplace'lar bo'limida API kalitni kiriting va "Test qilish" ni bosing.`,
      );
    }

    const attrs = (product.attributes as any) || {};
    const values: Record<string, any> = attrs.byMarketplace?.[spec.id] || attrs.values || {};

    // Joylashda kategoriya ID'lari ham majburiy — ularsiz marketplace rad etadi
    const issues = validateValues(spec, values, { forPublish: true });
    if (issues.length) {
      throw new HttpError(
        400,
        `Joylashdan oldin to'ldiring: ${issues.map((i) => `${i.label} (${i.message})`).join(', ')}`,
      );
    }

    // Shu marketplace uchun moslashtirilgan rasmlar bo'lsa — o'shalar
    const adapted = product.images.filter((i) => i.variant === (spec.id as any));
    const imageUrls = (adapted.length ? adapted : product.images).map((i) => i.url);

    const result = await publishToMarketplace(
      spec,
      {
        apiKey: decrypt(cred.apiKey),
        apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
        shopId: cred.shopId,
      },
      { values, imageUrls },
    );

    // Natijani listing'ga yozamiz. `pending` — marketplace hali qayta ishlayapti,
    // shuning uchun PUBLISHED emas, PENDING qoladi va taskId saqlanadi:
    // holat tekshiruvi aynan shu identifikator bo'yicha ishlaydi.
    //
    // DIQQAT: externalId ni O'CHIRMAYMIZ. Avval bu yerda `result.taskId ?? null`
    // turardi va muvaffaqiyatli joylashda (taskId qaytmaydigan yo'lda) u null
    // bo'lib qolardi — kartochkaning WB dagi artikuli bilan bog'lanishi
    // yo'qolar, keyingi har qanday holat tekshiruvi "hali yuborilmagan" deb
    // xato berardi.
    await prisma.listing.updateMany({
      where: { productId: product.id, marketplace: spec.id as any },
      data: result.success
        ? {
            status: result.pending ? 'PENDING' : 'PUBLISHED',
            ...(result.taskId ? { externalId: result.taskId } : {}),
            lastSyncedAt: new Date(),
            errorMessage: result.warnings?.length ? result.warnings.join(' · ') : null,
          }
        : { status: 'ERROR', errorMessage: result.message },
    });

    res.status(result.success ? 200 : 502).json(result);
  } catch (err: any) {
    if (err?.name === 'DecryptionError') {
      return next(new HttpError(409, err.message));
    }
    next(err);
  }
}

// ============================================
// Excel eksport
// ============================================

const exportSchema = z
  .object({
    marketplace: z.string(),
    productIds: z.array(z.string()).optional(),
    rows: z
      .array(
        z.object({
          values: z.record(z.string(), z.any()),
          imageUrls: z.array(z.string()).default([]),
        }),
      )
      .optional(),
  })
  .refine((v) => (v.productIds && v.productIds.length) || (v.rows && v.rows.length), {
    message: "Eksport uchun productIds yoki rows kerak",
  });

export async function exportExcel(req: Request, res: Response, next: NextFunction) {
  try {
    const body = exportSchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, 'Bunday marketplace yo\'q');

    let rows: ExportRow[] = body.rows ?? [];

    // Saqlangan kartochkalardan eksport
    if (body.productIds?.length) {
      const organizationId = req.organization!.id;
      const products = await prisma.product.findMany({
        where: { id: { in: body.productIds }, organizationId },
        include: { images: { orderBy: { order: 'asc' } } },
      });

      if (!products.length) throw new HttpError(404, 'Kartochka topilmadi');

      rows = products.map((product) => {
        const attrs = (product.attributes as any) || {};
        // Kartochka boshqa marketplace uchun saqlangan bo'lsa ham, mavjud
        // qiymatlarni asos qilib olamiz — mos kalitlar o'z joyiga tushadi.
        const values: Record<string, any> = { ...(attrs.values || {}) };

        for (const field of allFields(spec)) {
          if (!field.mapsTo || values[field.key] !== undefined) continue;
          const fromProduct = (product as any)[field.mapsTo];
          if (fromProduct !== null && fromProduct !== undefined) {
            values[field.key] = String(fromProduct);
          }
        }

        // Moslashtirilgan rasmlar birinchi turadi
        const adapted = product.images.filter((i) => i.variant === (spec.id as any));
        const chosen = adapted.length ? adapted : product.images;

        return { values, imageUrls: chosen.map((i) => i.url) };
      });
    }

    // Uzum'da o'z .xlsm shabloni bor — makros va validatsiyalari bilan.
    // Uni qayta yaratib bo'lmaydi, shuning uchun tayyorini to'ldiramiz.
    if (spec.id === 'UZUM') {
      // Chegara shablonning o'zidan hisoblanadi — qattiq yozilgan son emas
      const maxRows = uzumMaxRows();
      if (rows.length > maxRows) {
        throw new HttpError(
          400,
          `Uzum shabloniga ${maxRows} tadan ko'p tovar sig'maydi (siz ${rows.length} ta tanladingiz). ` +
            "Mahsulotlarni bir necha faylga bo'lib eksport qiling.",
        );
      }

      const { buffer, warnings } = fillUzumTemplate(
        rows.map((row) => toUzumRow(row.values, row.imageUrls)),
      );
      const fileName = uzumFileName(rows.length);

      res.setHeader('Content-Type', 'application/vnd.ms-excel.sheet.macroEnabled.12');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      // Ogohlantirishlar sarlavhada — fayl baribir yuklab olinadi, lekin
      // frontend nima e'tibor talab qilishini ko'rsata oladi
      res.setHeader('X-Export-Warnings', encodeURIComponent(JSON.stringify(warnings.slice(0, 50))));
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition, X-Export-Warnings',
      );
      return res.send(buffer);
    }

    // Wildberries'da ham o'z Excel shabloni bor (3636 ustun, "Загрузить из файла"
    // aynan shu strukturani kutadi). Uzum'dagidek tayyorini to'ldiramiz —
    // hozircha "Игрушки" (o'yinchoqlar) shabloni.
    if (spec.id === 'WB') {
      const { buffer, warnings } = fillWbTemplate(
        rows.map((row) => toWbRow(row.values, row.imageUrls)),
      );
      const fileName = wbFileName(rows.length);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Export-Warnings', encodeURIComponent(JSON.stringify(warnings.slice(0, 50))));
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Export-Warnings');
      return res.send(buffer);
    }

    const buffer = buildMarketplaceWorkbook(spec, rows);
    const fileName = exportFileName(spec, rows.length);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ============================================
// Kategoriya katalogi
// ============================================

/**
 * GET /api/cards/categories/:marketplace?q=ko'ylak&limit=30
 *
 * Uchala marketplace ham kartochka yaratishda raqamli kategoriya ID talab
 * qiladi. Ro'yxat marketplace'ning o'z katalogidan olinadi, ya'ni tashkilotning
 * ulangan kaliti kerak — kalitsiz katalogni ko'rib bo'lmaydi.
 */
export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const spec = getSpec(req.params.marketplace?.toUpperCase() || '');
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");

    if (spec.id === 'UZUM') {
      throw new HttpError(
        400,
        "Uzum'da kategoriya Excel shablonidagi ochiluvchi ro'yxatdan tanlanadi — bu yerda katalog yo'q",
      );
    }

    const cred = await prisma.userMarketplace.findFirst({
      where: { organizationId, marketplace: spec.id as any, isActive: true },
    });
    if (!cred) {
      throw new HttpError(
        400,
        `${spec.name} ulanmagan. Kategoriyalar ro'yxati uning katalogidan olinadi — ` +
          "Marketplace'lar bo'limida API kalitni kiriting va \"Test qilish\" ni bosing.",
      );
    }

    const items = await searchCategories(
      spec.id,
      {
        apiKey: decrypt(cred.apiKey),
        apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
        shopId: cred.shopId,
      },
      {
        query: typeof req.query.q === 'string' ? req.query.q : '',
        limit: Math.min(Math.max(Number(req.query.limit) || 30, 1), 100),
      },
    );

    res.json({ marketplace: spec.id, items });
  } catch (err: any) {
    if (err instanceof CategoryError) return next(new HttpError(err.status, err.message));
    if (err?.name === 'DecryptionError') return next(new HttpError(409, err.message));
    // Marketplace o'z xatosini bersa (limit, ruxsat yo'q) — o'z holicha uzatamiz
    if (typeof err?.status === 'number') {
      return next(new HttpError(err.status === 429 ? 429 : 502, err.message));
    }
    next(err);
  }
}

/**
 * GET /api/cards/categories/:marketplace/charcs?subjectId=
 * Tanlangan kategoriya (subjectID) uchun dinamik xarakteristikalar — forma
 * shu kategoriyaga mos maydonlarni chizsin.
 */
/**
 * GET /api/cards/categories/:marketplace/tnved?subjectId=
 *
 * Shu predmet uchun ruxsat etilgan TN VED kodlari. Sotuvchi kodni o'zi
 * topa olmaydi, noto'g'risi esa kartochkani kabinetda qizil xatoga aylantiradi.
 */
export async function getCategoryTnved(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const spec = getSpec(req.params.marketplace?.toUpperCase() || '');
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");
    if (spec.id !== 'WB') return res.json({ marketplace: spec.id, items: [] });

    const subjectId = Number(req.query.subjectId);
    if (!Number.isFinite(subjectId) || subjectId <= 0) {
      throw new HttpError(400, "subjectId noto'g'ri");
    }

    const cred = await prisma.userMarketplace.findFirst({
      where: { organizationId, marketplace: spec.id as any, isActive: true },
    });
    if (!cred) {
      throw new HttpError(400, `${spec.name} ulanmagan — Marketplace'lar bo'limida API kalitni kiriting.`);
    }

    const items = await getWbTnved(decrypt(cred.apiKey), subjectId);
    res.json({ marketplace: spec.id, subjectId, items });
  } catch (err: any) {
    if (err?.name === 'DecryptionError') return next(new HttpError(409, err.message));
    if (typeof err?.status === 'number') {
      return next(new HttpError(err.status === 429 ? 429 : 502, err.message));
    }
    next(err);
  }
}

export async function getCategoryCharcs(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const spec = getSpec(req.params.marketplace?.toUpperCase() || '');
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");
    if (spec.id !== 'WB') {
      // Hozircha faqat WB; Ozon/Yandex keyingi bosqichda
      return res.json({ marketplace: spec.id, charcs: [] });
    }

    const subjectId = Number(req.query.subjectId);
    if (!Number.isFinite(subjectId) || subjectId <= 0) {
      throw new HttpError(400, 'subjectId noto\'g\'ri');
    }

    const cred = await prisma.userMarketplace.findFirst({
      where: { organizationId, marketplace: spec.id as any, isActive: true },
    });
    if (!cred) {
      throw new HttpError(400, `${spec.name} ulanmagan — Marketplace'lar bo'limida API kalitni kiriting.`);
    }

    const charcs = await getWbCharacteristics(decrypt(cred.apiKey), subjectId);
    res.json({ marketplace: spec.id, subjectId, charcs });
  } catch (err: any) {
    if (err?.name === 'DecryptionError') return next(new HttpError(409, err.message));
    if (typeof err?.status === 'number') {
      return next(new HttpError(err.status === 429 ? 429 : 502, err.message));
    }
    next(err);
  }
}

// ============================================
// Joylash natijasini tekshirish
// ============================================

/**
 * GET /api/cards/:productId/publish-status/:marketplace
 *
 * Ozon ham, WB ham darhol "qabul qilindi" deydi va tovarni keyin tekshiradi.
 * Bu endpoint haqiqiy natijani so'raydi; WB uchun u ayni paytda rasmlarni
 * biriktirish qadamini ham bajaradi (nmID faqat shu paytda paydo bo'ladi).
 */
/**
 * WB rasm biriktirish endpointi daqiqasiga ATIGI BITTA so'rovga ruxsat beradi
 * (javob sarlavhasi: x-ratelimit-limit: 1). Tez-tez urinsak, har uchala
 * urinish ham 429 bo'lib qaytadi va rasm hech qachon biriktirilmaydi.
 *
 * Shuning uchun oxirgi urinish vaqti mahsulot atributlarida saqlanadi va
 * bir daqiqa o'tmaguncha WB ga umuman murojaat qilinmaydi. Xotiradagi
 * cheklovchi bu yerda yaramaydi: serverless muhitda u har so'rovda tozalanadi.
 */
const WB_MEDIA_GAP_MS = 65_000;

function mediaCooldownLeft(attributes: unknown): number {
  const at = Date.parse(String((attributes as any)?.wbMediaAt ?? ''));
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, WB_MEDIA_GAP_MS - (Date.now() - at));
}

/**
 * POST /api/cards/finalize-pending
 *
 * Kutilayotgan WB kartochkalarini yakunlaydi: nmID ni topib, rasmlarni
 * biriktiradi va holatni yopadi.
 *
 * Nega kerak: WB kartochkani asinxron yaratadi va rasm faqat keyin
 * biriktiriladi. Buni cron qilardi, lekin deploy serverless muhitda —
 * u yerda cron yashamaydi. Sehrgardagi kutish esa sotuvchi sahifada
 * turganida ishlaydi; u boshqa sahifaga o'tsa yoki tabni yopsa, kartochka
 * rasmsiz qolardi. Shuning uchun ilovaning istalgan sahifasi ochilganda
 * shu chaqiruv yuboriladi va "qarzlar" yopiladi.
 */
export async function finalizePending(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;

    const cred = await prisma.userMarketplace.findFirst({
      where: { organizationId, marketplace: 'WB', isActive: true },
    });
    if (!cred) return res.json({ checked: 0, finished: 0 });

    // Yangi yuborilganini darrov so'ramaymiz: WB ga kartochkani yaratish
    // uchun vaqt kerak. Bir marta ko'p ish qilmaymiz — WB so'rov limiti bor.
    const listings = await prisma.listing.findMany({
      where: {
        marketplace: 'WB',
        status: 'PENDING',
        externalId: { not: null },
        updatedAt: { lt: new Date(Date.now() - 90_000) },
        product: { organizationId },
      },
      // Yangisidan boshlaymiz: eskilari orasida WB dan o'chirilgani bo'lishi
      // mumkin va ular hech qachon yakunlanmaydi. Eski tartibda (asc) o'sha
      // "o'lik" yozuvlar uchta o'rinni ham egallab, yangi kartochka
      // navbatga umuman yetib bormasdi.
      orderBy: { updatedAt: 'desc' },
      take: 3,
      include: { product: { include: { images: { orderBy: { order: 'asc' } } } } },
    });
    if (!listings.length) return res.json({ checked: 0, finished: 0 });

    const spec = getSpec('WB')!;
    const creds = {
      apiKey: decrypt(cred.apiKey),
      apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
      shopId: cred.shopId,
    };

    let finished = 0;
    for (const listing of listings) {
      const adapted = listing.product.images.filter((i) => i.variant === 'WB');
      const imageUrls = (adapted.length ? adapted : listing.product.images).map((i) => i.url);

      const attrs = (listing.product.attributes as any) || {};
      const knownNmId = Number(attrs.wbNmId) || undefined;

      // Bir daqiqa o'tmagan bo'lsa WB ga tegmaymiz — baribir 429 qaytadi
      if (imageUrls.length && mediaCooldownLeft(attrs) > 0) continue;

      try {
        const result = await checkPublishStatus(
          spec,
          creds,
          listing.externalId!,
          imageUrls,
          knownNmId,
        );

        const foundNmId = Number((result.raw as any)?.nmID);
        if (foundNmId) {
          await prisma.product.update({
            where: { id: listing.productId },
            data: {
              attributes: {
                ...attrs,
                wbNmId: foundNmId,
                // Rasm urinishi bo'lgan bo'lsa vaqtini belgilaymiz
                ...(imageUrls.length ? { wbMediaAt: new Date().toISOString() } : {}),
              },
            },
          });
        }

        // Yarim soatdan beri topilmayapti — kartochka WB da yo'q (o'chirilgan
        // yoki umuman yaratilmagan). Bunday yozuv abadiy kutilib, har safar
        // navbatdan joy egallab turardi.
        const stale = Date.now() - listing.updatedAt.getTime() > 30 * 60 * 1000;
        if (result.pending && !stale) continue;

        finished++;
        await prisma.listing.update({
          where: { id: listing.id },
          data:
            result.pending && stale
              ? {
                  status: 'ERROR',
                  errorMessage:
                    `WB'da "${listing.externalId}" artikuli topilmadi. Kartochka yaratilmagan ` +
                    "yoki keyin o'chirilgan — qaytadan yuboring.",
                }
              : result.success
                ? { status: 'PUBLISHED', lastSyncedAt: new Date(), errorMessage: null }
                : { status: 'ERROR', errorMessage: result.message },
        });
      } catch {
        // Limit yoki tarmoq — keyingi chaqiruvda qayta urinamiz
      }
    }

    res.json({ checked: listings.length, finished });
  } catch (err: any) {
    if (err?.name === 'DecryptionError') return next(new HttpError(409, err.message));
    next(err);
  }
}

export async function publishStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const spec = getSpec(req.params.marketplace?.toUpperCase() || '');
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");

    const [product, listing, cred] = await Promise.all([
      prisma.product.findFirst({
        where: { id: req.params.productId, organizationId },
        include: { images: { orderBy: { order: 'asc' } } },
      }),
      prisma.listing.findFirst({
        where: { productId: req.params.productId, marketplace: spec.id as any },
      }),
      prisma.userMarketplace.findFirst({
        where: { organizationId, marketplace: spec.id as any, isActive: true },
      }),
    ]);

    if (!product) throw new HttpError(404, 'Mahsulot topilmadi');
    if (!listing?.externalId) {
      throw new HttpError(400, 'Bu kartochka hali marketplace\'ga yuborilmagan');
    }
    if (!cred) throw new HttpError(400, `${spec.name} ulanmagan`);

    const adapted = product.images.filter((i) => i.variant === (spec.id as any));
    const imageUrls = (adapted.length ? adapted : product.images).map((i) => i.url);

    // Oldin topilgan nmID mahsulot atributlarida saqlanadi — qayta qidiruv
    // WB so'rov limitidan yeydi va rasm biriktirishga budjet qoldirmaydi.
    const attrs = (product.attributes as any) || {};
    const knownNmId = Number(attrs.wbNmId) || undefined;

    // WB rasm biriktirishga daqiqasiga bitta so'rov beradi — erta urinsak
    // 429 qaytadi va bitta ruxsat behuda ketadi
    const cooldown = spec.id === 'WB' && imageUrls.length ? mediaCooldownLeft(attrs) : 0;
    if (cooldown > 0) {
      return res.json({
        success: true,
        pending: true,
        taskId: listing.externalId,
        message: `Rasm biriktirilishi kutilmoqda — WB limiti tufayli ${Math.ceil(cooldown / 1000)} soniyadan keyin qayta urinamiz.`,
      });
    }

    const result = await checkPublishStatus(
      spec,
      {
        apiKey: decrypt(cred.apiKey),
        apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
        shopId: cred.shopId,
      },
      listing.externalId,
      imageUrls,
      spec.id === 'WB' ? knownNmId : undefined,
    );

    const foundNmId = Number((result.raw as any)?.nmID);
    if (spec.id === 'WB' && foundNmId) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          attributes: {
            ...attrs,
            wbNmId: foundNmId,
            ...(imageUrls.length ? { wbMediaAt: new Date().toISOString() } : {}),
          },
        },
      });
    }

    /**
     * Uzoq vaqt "kutilmoqda" — demak kartochka yo'q.
     *
     * WB kartochkani daqiqalar ichida yaratadi. Agar yarim soatdan keyin ham
     * topilmasa, u yaratilmagan yoki keyin o'chirilgan. Avval bunday holat
     * abadiy "sinxronlanmoqda" bo'lib qolardi: sotuvchi tekshiraveradi va
     * hech narsa o'zgarmaydi, sababini ham bilmaydi.
     */
    const pendingMs = Date.now() - listing.updatedAt.getTime();
    if (result.pending && pendingMs > 30 * 60 * 1000) {
      const message =
        `WB'da "${listing.externalId}" artikuli topilmadi. Kartochka yaratilmagan ` +
        "yoki keyin o'chirilgan — qaytadan yuboring.";
      await prisma.listing.update({
        where: { id: listing.id },
        data: { status: 'ERROR', errorMessage: message },
      });
      return res.json({ success: false, pending: false, message });
    }

    // Yakuniy natija bo'lsa listing holatini yopamiz
    if (!result.pending) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: result.success
          ? { status: 'PUBLISHED', lastSyncedAt: new Date(), errorMessage: null }
          : { status: 'ERROR', errorMessage: result.message },
      });
    }

    res.json(result);
  } catch (err: any) {
    if (err?.name === 'DecryptionError') return next(new HttpError(409, err.message));
    if (typeof err?.status === 'number' && !(err instanceof HttpError)) {
      return next(new HttpError(err.status === 429 ? 429 : 502, err.message));
    }
    next(err);
  }
}

// ============================================
// Ommaviy joylash navbati
// ============================================

const batchPublishSchema = z.object({
  marketplace: z.string(),
  productIds: z.array(z.string()).min(1, 'Kamida bitta mahsulot tanlang').max(500),
});

/**
 * POST /api/cards/publish-batch
 *
 * Mahsulotlarni joylash navbatiga qo'yadi. Darhol yubormaydi — cron ularni
 * ketma-ket olib boradi, chunki marketplace limitlari sotuvchi bo'yicha
 * hisoblanadi va parallel yuborish faqat 429 beradi.
 */
export async function publishBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = batchPublishSchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");

    const result = await enqueuePublish(
      req.organization!.id,
      req.user!.userId,
      body.productIds,
      spec.id as any,
    );

    // Hech biri o'tmasa ham to'liq ro'yxatni qaytaramiz: frontend har bir
    // mahsulot uchun "nima qilish kerak" tugmasini ko'rsata olsin.
    // Faqat birinchi sababni matn sifatida berish foydasiz edi —
    // sotuvchi "Kategoriya ID" ni qayerdan olishni bilmasdi.
    res.status(result.queued > 0 ? 202 : 400).json({
      queued: result.queued,
      skipped: result.skipped,
      marketplace: spec.id,
      message:
        result.queued > 0
          ? `${result.queued} ta kartochka navbatga qo'shildi` +
            (result.skipped.length ? `, ${result.skipped.length} tasi tayyor emas` : '')
          : `Hech bir kartochka ${spec.name} uchun tayyor emas`,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError' || err instanceof HttpError) return next(err);
    next(new HttpError(400, err?.message || "Navbatga qo'shib bo'lmadi"));
  }
}

/** GET /api/cards/publish-jobs?status=&limit= — navbat holati */
export async function publishJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.organization!.id;
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    const valid = ['QUEUED', 'RUNNING', 'PENDING', 'DONE', 'FAILED', 'CANCELLED'];

    const [items, summary] = await Promise.all([
      listPublishJobs(organizationId, {
        status: status && valid.includes(status) ? (status as any) : undefined,
        limit: Math.min(Math.max(Number(req.query.limit) || 50, 1), 200),
      }),
      getQueueSummary(organizationId),
    ]);

    res.json({ items, ...summary });
  } catch (err) {
    next(err);
  }
}

/** POST /api/cards/publish-jobs/cancel — boshlanmagan vazifalarni bekor qilish */
export async function cancelPublishBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const jobIds = Array.isArray(req.body?.jobIds) ? (req.body.jobIds as string[]) : undefined;
    const cancelled = await cancelPublishJobs(req.organization!.id, jobIds);
    res.json({
      cancelled,
      message: cancelled
        ? `${cancelled} ta vazifa bekor qilindi`
        : 'Bekor qilinadigan vazifa topilmadi (yuborilganlarini to\'xtatib bo\'lmaydi)',
    });
  } catch (err) {
    next(err);
  }
}

const bulkCategorySchema = z.object({
  marketplace: z.string(),
  productIds: z.array(z.string()).min(1, 'Kamida bitta mahsulot tanlang').max(500),
  categoryId: z.string().min(1, 'Kategoriya tanlanmagan'),
  typeId: z.string().optional(),
  name: z.string().min(1),
});

/**
 * POST /api/cards/bulk-category
 *
 * Tanlangan mahsulotlarga bitta kategoriyani birdan qo'yadi.
 * Kartochka boshqa marketplace uchun to'ldirilgan bo'lsa, qolgan maydonlar
 * ham ko'chiriladi (birliklar o'girilib) — aks holda kategoriya qo'yish
 * holatni yaxshilash o'rniga buzardi.
 */
export async function bulkCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bulkCategorySchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");

    // Ozon kategoriya va tovar turini juftlikda talab qiladi
    if (spec.id === 'OZON' && !body.typeId) {
      throw new HttpError(400, 'Ozon uchun tovar turi ham tanlanishi kerak');
    }

    const result = await applyCategoryToProducts(
      req.organization!.id,
      body.productIds,
      spec.id as any,
      { categoryId: body.categoryId, typeId: body.typeId, name: body.name },
    );

    res.json({
      ...result,
      marketplace: spec.id,
      message:
        `${result.updated} ta kartochkaga "${body.name}" kategoriyasi qo'yildi` +
        (result.ready.length ? `, ${result.ready.length} tasi joylashga tayyor` : '') +
        (result.stillMissing.length
          ? `, ${result.stillMissing.length} tasida boshqa maydonlar yetishmayapti`
          : ''),
    });
  } catch (err: any) {
    if (err?.name === 'ZodError' || err instanceof HttpError) return next(err);
    next(new HttpError(400, err?.message || "Kategoriyani qo'yib bo'lmadi"));
  }
}

// ============================================
// Narx va qoldiqni marketplace'ga yuborish
// ============================================

const priceStockSchema = z.object({
  marketplace: z.string(),
  productIds: z.array(z.string()).min(1, 'Kamida bitta mahsulot tanlang').max(500),
  /** Nimani yuborish — ikkalasi ham bo'lishi mumkin */
  price: z.boolean().default(true),
  stock: z.boolean().default(true),
  /**
   * Faqat ko'rsatish: nima yuborilishini qaytaradi, marketplace'ga tegmaydi.
   * Narx — qaytarib bo'lmaydigan o'zgarish, shuning uchun oldindan ko'rish kerak.
   */
  dryRun: z.boolean().default(false),
});

/**
 * POST /api/cards/sync-price-stock
 *
 * Narx va qoldiqni MarketFlow'dan marketplace'ga yuboradi.
 * Navbat orqali emas, darhol — bu tez operatsiya va sotuvchi natijani
 * shu yerda ko'rishi kerak.
 */
export async function syncPriceStock(req: Request, res: Response, next: NextFunction) {
  try {
    const body = priceStockSchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");
    if (!body.price && !body.stock) {
      throw new HttpError(400, "Narx yoki qoldiqdan kamida bittasi tanlanishi kerak");
    }

    const organizationId = req.organization!.id;
    const cred = await prisma.userMarketplace.findFirst({
      where: { organizationId, marketplace: spec.id as any, isActive: true },
    });
    if (!cred) {
      throw new HttpError(
        400,
        `${spec.name} ulanmagan. Marketplace'lar bo'limida API kalitni kiriting.`,
      );
    }

    const products = await prisma.product.findMany({
      where: { id: { in: body.productIds }, organizationId },
    });

    const items: PriceStockItem[] = [];
    const skipped: Array<{ productId: string; title: string; reason: string }> = [];
    const priceWarnings: string[] = [];

    for (const product of products) {
      if (!product.sku) {
        skipped.push({
          productId: product.id,
          title: product.title,
          reason: "artikul (SKU) yo'q — marketplace'da tovarni topib bo'lmaydi",
        });
        continue;
      }

      const item: PriceStockItem = {
        productId: product.id,
        title: product.title,
        sku: product.sku,
        barcode: product.barcode,
      };

      if (body.price) {
        const found = priceForMarketplace(product as any, spec.id, spec.currency);
        if (found.price) {
          item.price = found.price;
          item.oldPrice = found.oldPrice;

          // Bloklamaymiz, lekin aytamiz: bir xil raqam turli valyutada
          const doubt = suspiciousPrice(product.attributes, spec.id, found.price);
          if (doubt) priceWarnings.push(`${product.title}: ${doubt}`);
        } else if (!body.stock) {
          // Faqat narx so'ralgan, lekin uni topib bo'lmadi — bu tovar uchun qilinadigan ish yo'q
          skipped.push({ productId: product.id, title: product.title, reason: found.reason! });
          continue;
        } else {
          skipped.push({ productId: product.id, title: product.title, reason: found.reason! });
        }
      }

      // Qoldiq valyutaga bog'liq emas — har doim yuborsa bo'ladi
      if (body.stock) item.stock = product.stock;

      items.push(item);
    }

    if (!items.length) {
      throw new HttpError(
        400,
        `Yuboriladigan tovar topilmadi. ${skipped[0]?.reason ?? ''}`,
      );
    }

    // Ko'rish rejimi — marketplace'ga umuman so'rov yuborilmaydi
    if (body.dryRun) {
      return res.json({
        dryRun: true,
        marketplace: spec.id,
        skipped,
        warnings: priceWarnings,
        willSend: items.map((i) => ({
          productId: i.productId,
          title: i.title,
          sku: i.sku,
          price: i.price,
          oldPrice: i.oldPrice,
          stock: i.stock,
        })),
        message:
          `${items.filter((i) => i.price !== undefined).length} ta narx va ` +
          `${items.filter((i) => i.stock !== undefined).length} ta qoldiq yuborishga tayyor`,
      });
    }

    const result = await pushPriceStock(
      spec.id as any,
      {
        apiKey: decrypt(cred.apiKey),
        apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
        shopId: cred.shopId,
      },
      items,
    );

    res.json({
      ...result,
      warnings: [...priceWarnings, ...result.warnings],
      // Narxi topilmagan, lekin qoldig'i ketganlar ham shu ro'yxatda —
      // sotuvchi nima yuborilmaganini bilishi kerak
      skipped,
      marketplace: spec.id,
      message: buildSyncMessage(result, spec.name),
    });
  } catch (err: any) {
    if (err?.name === 'ZodError' || err instanceof HttpError) return next(err);
    if (err?.name === 'DecryptionError') return next(new HttpError(409, err.message));
    if (typeof err?.status === 'number') {
      return next(new HttpError(err.status === 429 ? 429 : 502, err.message));
    }
    next(new HttpError(502, err?.message || "Yuborib bo'lmadi"));
  }
}

// ============================================
// Kartochka sifat bahosi
// ============================================

const qualitySchema = z.object({
  marketplace: z.string(),
  values: z.record(z.string(), z.any()).default({}),
  imageCount: z.coerce.number().int().min(0).default(0),
});

/**
 * POST /api/cards/quality
 *
 * Jonli baho — sehrgar saqlashdan oldin ko'rsatadi. Bazaga tegmaydi, shuning
 * uchun har tahrirda chaqirsa bo'ladi.
 */
export async function cardQuality(req: Request, res: Response, next: NextFunction) {
  try {
    const body = qualitySchema.parse(req.body);
    const spec = getSpec(body.marketplace.toUpperCase());
    if (!spec) throw new HttpError(404, "Bunday marketplace yo'q");
    res.json(scoreCard(spec, body.values, body.imageCount));
  } catch (err: any) {
    if (err?.name === 'ZodError' || err instanceof HttpError) return next(err);
    next(new HttpError(400, err?.message || "Bahoni hisoblab bo'lmadi"));
  }
}
