/**
 * Ommaviy joylash navbati
 *
 * Nega navbat: joylash bitta so'rov emas, ko'p bosqichli va sekin oqim.
 *   1. Kartochka yuboriladi                     — bir necha soniya
 *   2. Marketplace uni qayta ishlaydi           — Ozon'da daqiqalar
 *   3. WB'da kartochka sinxronlanadi            — 30 daqiqagacha
 *   4. Shundan keyingina rasmlar biriktiriladi
 *
 * 200 ta tovarni brauzer ochiq holda kutib bo'lmaydi — bitta yopilgan tab
 * butun ishni to'xtatardi. Shuning uchun vazifalar bazaga yoziladi, cron
 * ularni bosqichma-bosqich olib boradi, sahifa esa faqat holatni ko'rsatadi.
 *
 * Ketma-ketlik ataylab: marketplace limitlari SOTUVCHI bo'yicha hisoblanadi,
 * token bo'yicha emas. Parallel yuborish 429 ga olib keladi va hech narsani
 * tezlashtirmaydi.
 */

import { Marketplace, PublishJobStatus, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { decrypt } from '../../utils/encryption';
import { getSpec, validateValues } from './specs';
import { prefillForMarketplace } from './prefill';
import {
  publishToMarketplace,
  checkPublishStatus,
  supportsPublish,
  PublishCreds,
} from './publish.service';

/** Bir cron ishida ko'pi bilan shuncha vazifa olinadi */
const BATCH_SIZE = 20;

/** Vaqtinchalik xatoda nechi marta qayta uriniladi */
const MAX_ATTEMPTS = 3;

/** Qayta urinishlar orasidagi kutish — har safar ikki barobar (2, 4, 8 daqiqa) */
const BACKOFF_MINUTES = 2;

/**
 * PENDING vazifa qancha vaqtdan keyin tekshiriladi.
 * WB kartochkani 30 daqiqagacha sinxronlaydi, undan tez so'rashning ma'nosi yo'q.
 */
const PENDING_CHECK_MINUTES: Record<string, number> = {
  OZON: 2,
  WB: 10,
  YANDEX: 5,
};

/** PENDING vazifa shuncha vaqtdan keyin "javob bermadi" deb yopiladi */
const PENDING_GIVE_UP_HOURS = 12;

/** Nega o'tmadi va sotuvchi nima qilishi kerak */
export type SkipAction =
  /** Bu marketplace uchun kartochka umuman tayyorlanmagan — sehrgardan o'tish kerak */
  | 'prepare'
  /** Maydonlar bor, lekin kategoriya katalogdan tanlanmagan */
  | 'category'
  /** Boshqa sabab — matnda yozilgan */
  | 'other';

export interface SkippedProduct {
  productId: string;
  title: string;
  reason: string;
  action: SkipAction;
  /** Yetishmayotgan maydon nomlari */
  missing: string[];
}

export interface EnqueueResult {
  queued: number;
  skipped: SkippedProduct[];
}

// ─── NAVBATGA QO'YISH ────────────────────────────────────

/**
 * Mahsulotlarni joylash navbatiga qo'yish.
 *
 * Bu yerda tez tekshiruvlar bajariladi (kategoriya tanlanganmi, majburiy
 * maydonlar to'lganmi) — sotuvchi 200 ta tovarni navbatga tashlab, ertasiga
 * hammasi "to'ldirilmagan maydon" bilan yiqilganini ko'rmasin.
 */
export async function enqueuePublish(
  organizationId: string,
  userId: string,
  productIds: string[],
  marketplace: Marketplace,
): Promise<EnqueueResult> {
  const spec = getSpec(marketplace);
  if (!spec) throw new Error("Bunday marketplace yo'q");
  if (!supportsPublish(marketplace)) {
    throw new Error(
      `${spec.name} API orqali kartochka yaratishni qo'llab-quvvatlamaydi — Excel eksportidan foydalaning`,
    );
  }

  const cred = await prisma.userMarketplace.findFirst({
    where: { organizationId, marketplace, isActive: true },
  });
  if (!cred) {
    throw new Error(`${spec.name} ulanmagan. Marketplace'lar bo'limida API kalitni kiriting.`);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId },
    select: { id: true, title: true, attributes: true },
  });

  const skipped: SkippedProduct[] = [];
  const ready: string[] = [];

  for (const product of products) {
    const attrs = (product.attributes as any) || {};

    // Aynan shu marketplace uchun to'ldirilgan qiymatlar bormi?
    // Bo'lmasa boshqa marketplace'ning qiymatlariga tushamiz — ular
    // yetishmasligi mumkin, lekin nima yetishmayotganini aniq aytamiz.
    const own = attrs.byMarketplace?.[marketplace];
    const preparedFor: string | undefined = attrs.marketplace;
    const values: Record<string, any> = own || attrs.values || {};

    const issues = validateValues(spec, values, { forPublish: true });
    if (!issues.length) {
      ready.push(product.id);
      continue;
    }

    skipped.push({
      productId: product.id,
      title: product.title,
      ...classifySkip(issues, spec.name, {
        hasOwnValues: !!own,
        // `attributes.marketplace` — ID (UZUM), spec.name esa nom (Uzum Market).
        // Taqqoslash ID bo'yicha bo'lishi kerak, aks holda har doim "prepare" chiqadi.
        preparedFor: preparedFor && preparedFor !== marketplace ? preparedFor : undefined,
      }),
    });
  }

  // Topilmagan mahsulotlarni ham aytamiz — jim tashlab ketmaymiz
  const found = new Set(products.map((p) => p.id));
  for (const id of productIds) {
    if (!found.has(id)) {
      skipped.push({
        productId: id,
        title: id,
        action: 'other',
        missing: [],
        reason: 'Mahsulot topilmadi',
      });
    }
  }

  // Bir mahsulot bitta marketplace uchun navbatda bir marta turadi.
  // Tugma ikki marta bosilsa yoki eski, tugagan vazifa qolgan bo'lsa —
  // uni qaytadan navbatga qo'yamiz, nusxa yaratmaymiz.
  for (const productId of ready) {
    await prisma.publishJob.upsert({
      where: { productId_marketplace: { productId, marketplace } },
      create: { organizationId, productId, marketplace, createdById: userId },
      update: {
        status: 'QUEUED',
        attempts: 0,
        nextTryAt: null,
        message: null,
        warnings: [],
        externalId: null,
        startedAt: null,
        finishedAt: null,
        createdById: userId,
      },
    });
  }

  return { queued: ready.length, skipped };
}

/**
 * Nega o'tmadi va sotuvchi nima qilishi kerak.
 *
 * Ikki holatni ajratish muhim, chunki yechimlari butunlay boshqa:
 *
 *   prepare  — kartochka boshqa marketplace uchun to'ldirilgan (masalan Uzum).
 *              Ozon maydonlari umuman yo'q, sehrgardan o'tish kerak.
 *   category — maydonlar bor, faqat kategoriya matn bilan yozilgan.
 *              Katalogdan tanlash kifoya.
 *
 * Farqni aytmasak sotuvchi «Kategoriya ID» degan xabarni ko'rib,
 * uni qayerdan olishni tushunmaydi.
 */
function classifySkip(
  issues: Array<{ key: string; label: string }>,
  marketplaceName: string,
  context: { hasOwnValues: boolean; preparedFor?: string },
): Pick<SkippedProduct, 'action' | 'missing' | 'reason'> {
  const missing = issues.map((i) => i.label);

  // 1. Faqat kategoriya identifikatorlari yetishmayapti — qolgani joyida.
  //    Tanlagichdan bir marta o'tish kifoya.
  const onlyCategory =
    issues.length > 0 && issues.every((i) => i.key === 'categoryId' || i.key === 'typeId');

  if (onlyCategory) {
    return {
      action: 'category',
      missing,
      reason: `Kategoriya katalogdan tanlanmagan. Kartochkani oching va ${marketplaceName} katalogidan tanlang.`,
    };
  }

  // 2. Bu marketplace uchun qiymatlar umuman yo'q — kartochka boshqa bozor
  //    uchun (yoki eski oqimda) yaratilgan. 16 ta maydon nomini sanab
  //    berishning foydasi yo'q, javob bitta: sehrgardan o'tish.
  if (!context.hasOwnValues) {
    return {
      action: 'prepare',
      missing,
      reason: context.preparedFor
        ? `Bu kartochka ${context.preparedFor} uchun tayyorlangan. ` +
          `${marketplaceName} maydonlari to'ldirilmagan — kartochkani ${marketplaceName} uchun tayyorlang.`
        : `${marketplaceName} maydonlari hali to'ldirilmagan — kartochkani tayyorlang.`,
    };
  }

  // 3. Qiymatlar bor, lekin ba'zilari yetishmayapti — aynan qaysilarini aytamiz
  return { action: 'other', missing, reason: `To'ldirilmagan: ${missing.join(', ')}` };
}

// ─── QAYTA URINISH SIYOSATI ──────────────────────────────

/**
 * Bu xato vaqtinchalikmi?
 *
 * Limit (429) va server xatolari o'tib ketadi — qayta urinish mantiqiy.
 * "Majburiy maydon bo'sh" yoki "kategoriya noto'g'ri" esa o'z-o'zidan
 * tuzalmaydi: qayta urinish faqat limitni sarflaydi va sotuvchini
 * chalg'itadi ("hali ham ishlayapti" deb kutadi).
 */
function isTransient(error: unknown): boolean {
  const status = (error as any)?.status;
  if (typeof status === 'number') return status === 429 || status >= 500;

  const message = String((error as Error)?.message || '');
  return /timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|socket hang up/i.test(message);
}

function backoffUntil(attempts: number): Date {
  const minutes = BACKOFF_MINUTES * 2 ** Math.max(0, attempts - 1);
  return new Date(Date.now() + minutes * 60_000);
}

// ─── KALITLAR ────────────────────────────────────────────

/** Tashkilotning bir marketplace kaliti — bir sikl davomida keshlanadi */
async function loadCreds(
  organizationId: string,
  marketplace: Marketplace,
  cache: Map<string, PublishCreds | null>,
): Promise<PublishCreds | null> {
  const key = `${organizationId}:${marketplace}`;
  if (cache.has(key)) return cache.get(key)!;

  const cred = await prisma.userMarketplace.findFirst({
    where: { organizationId, marketplace, isActive: true },
  });

  let creds: PublishCreds | null = null;
  if (cred) {
    try {
      creds = {
        apiKey: decrypt(cred.apiKey),
        apiSecret: cred.apiSecret ? decrypt(cred.apiSecret) : null,
        shopId: cred.shopId,
      };
    } catch {
      // ENCRYPTION_KEY almashgan — bu ulanish bo'yicha hech narsa qilib bo'lmaydi
      creds = null;
    }
  }

  cache.set(key, creds);
  return creds;
}

// ─── NAVBATNI QAYTA ISHLASH ──────────────────────────────

export interface QueueRunResult {
  processed: number;
  done: number;
  pending: number;
  failed: number;
}

/**
 * Navbatdagi vazifalarni yuborish.
 *
 * Ketma-ket, chunki marketplace limitlari sotuvchi bo'yicha. Ustiga
 * `rate-limit.ts` dagi navbat ham har bir token uchun oraliq saqlaydi —
 * ikkalasi birga sotuvchini 429 dan himoya qiladi.
 */
export async function processPublishQueue(limit = BATCH_SIZE): Promise<QueueRunResult> {
  const now = new Date();
  const jobs = await prisma.publishJob.findMany({
    where: {
      status: 'QUEUED',
      OR: [{ nextTryAt: null }, { nextTryAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const result: QueueRunResult = { processed: 0, done: 0, pending: 0, failed: 0 };
  const credsCache = new Map<string, PublishCreds | null>();

  for (const job of jobs) {
    result.processed++;

    const spec = getSpec(job.marketplace);
    if (!spec) {
      await fail(job.id, "Bunday marketplace yo'q");
      result.failed++;
      continue;
    }

    const creds = await loadCreds(job.organizationId, job.marketplace, credsCache);
    if (!creds) {
      await fail(job.id, `${spec.name} ulanishi topilmadi yoki kaliti ochilmadi`);
      result.failed++;
      continue;
    }

    await prisma.publishJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      const product = await prisma.product.findUnique({
        where: { id: job.productId },
        include: { images: { orderBy: { order: 'asc' } } },
      });
      if (!product) throw new Error('Mahsulot topilmadi');

      const attrs = (product.attributes as any) || {};
      const values: Record<string, any> =
        attrs.byMarketplace?.[job.marketplace] || attrs.values || {};

      // Shu marketplace uchun moslashtirilgan rasmlar bo'lsa — o'shalar
      const adapted = product.images.filter((i) => i.variant === (job.marketplace as any));
      const imageUrls = (adapted.length ? adapted : product.images).map((i) => i.url);

      const outcome = await publishToMarketplace(spec, creds, { values, imageUrls });

      if (!outcome.success) {
        // Marketplace aniq rad etdi — bu qayta urinish bilan tuzalmaydi
        await fail(job.id, outcome.message, outcome.warnings);
        await markListing(job.productId, job.marketplace, 'ERROR', outcome.message);
        result.failed++;
        continue;
      }

      if (outcome.pending) {
        await prisma.publishJob.update({
          where: { id: job.id },
          data: {
            status: 'PENDING',
            externalId: outcome.taskId ?? null,
            message: outcome.message,
            warnings: outcome.warnings ?? [],
            nextTryAt: nextPendingCheck(job.marketplace),
          },
        });
        await markListing(job.productId, job.marketplace, 'PENDING', null, outcome.taskId);
        result.pending++;
        continue;
      }

      await finish(job.id, outcome.message, outcome.warnings);
      await markListing(job.productId, job.marketplace, 'PUBLISHED', null, outcome.taskId);
      result.done++;
    } catch (err: any) {
      const message = err?.message || 'Nomaʼlum xato';
      const attempts = job.attempts + 1;

      if (isTransient(err) && attempts < MAX_ATTEMPTS) {
        // Vaqtinchalik nosozlik — keyinroq qaytamiz
        await prisma.publishJob.update({
          where: { id: job.id },
          data: {
            status: 'QUEUED',
            message: `${message} — ${attempts}/${MAX_ATTEMPTS}-urinish, keyinroq qayta uriniladi`,
            nextTryAt: backoffUntil(attempts),
          },
        });
        continue;
      }

      await fail(job.id, message);
      await markListing(job.productId, job.marketplace, 'ERROR', message);
      result.failed++;
    }
  }

  return result;
}

function nextPendingCheck(marketplace: Marketplace): Date {
  const minutes = PENDING_CHECK_MINUTES[marketplace] ?? 5;
  return new Date(Date.now() + minutes * 60_000);
}

// ─── KUTAYOTGANLARNI TEKSHIRISH ──────────────────────────

/**
 * PENDING vazifalarning haqiqiy natijasini so'rash.
 *
 * Ozon import vazifasi holatini, WB esa kartochkani topib rasmlarni
 * biriktiradi. Shusiz sotuvchi kartochkasi rad etilganini faqat seller
 * kabinetiga kirib bilib olardi.
 */
export async function checkPendingPublishJobs(limit = BATCH_SIZE): Promise<QueueRunResult> {
  const now = new Date();
  const jobs = await prisma.publishJob.findMany({
    where: {
      status: 'PENDING',
      OR: [{ nextTryAt: null }, { nextTryAt: { lte: now } }],
    },
    orderBy: { startedAt: 'asc' },
    take: limit,
  });

  const result: QueueRunResult = { processed: 0, done: 0, pending: 0, failed: 0 };
  const credsCache = new Map<string, PublishCreds | null>();
  const giveUpBefore = new Date(Date.now() - PENDING_GIVE_UP_HOURS * 3600_000);

  for (const job of jobs) {
    result.processed++;

    const spec = getSpec(job.marketplace);
    const creds = await loadCreds(job.organizationId, job.marketplace, credsCache);
    if (!spec || !creds || !job.externalId) {
      await fail(job.id, "Holatni tekshirish uchun ma'lumot yetarli emas");
      result.failed++;
      continue;
    }

    try {
      const product = await prisma.product.findUnique({
        where: { id: job.productId },
        include: { images: { orderBy: { order: 'asc' } } },
      });
      const adapted = product?.images.filter((i) => i.variant === (job.marketplace as any)) ?? [];
      const imageUrls = (adapted.length ? adapted : (product?.images ?? [])).map((i) => i.url);

      const outcome = await checkPublishStatus(spec, creds, job.externalId, imageUrls);

      if (outcome.pending) {
        // Juda uzoq kutdik — marketplace javob bermayapti
        if (job.startedAt && job.startedAt < giveUpBefore) {
          const message =
            `${spec.name} ${PENDING_GIVE_UP_HOURS} soat ichida javob bermadi. ` +
            'Seller kabinetida kartochka holatini tekshiring.';
          await fail(job.id, message);
          await markListing(job.productId, job.marketplace, 'ERROR', message);
          result.failed++;
          continue;
        }

        await prisma.publishJob.update({
          where: { id: job.id },
          data: { message: outcome.message, nextTryAt: nextPendingCheck(job.marketplace) },
        });
        result.pending++;
        continue;
      }

      if (outcome.success) {
        await finish(job.id, outcome.message, outcome.warnings);
        await markListing(job.productId, job.marketplace, 'PUBLISHED', null);
        result.done++;
      } else {
        await fail(job.id, outcome.message, outcome.warnings);
        await markListing(job.productId, job.marketplace, 'ERROR', outcome.message);
        result.failed++;
      }
    } catch (err: any) {
      const message = err?.message || 'Nomaʼlum xato';
      if (isTransient(err)) {
        // Tekshiruv o'zi yiqildi — vazifa PENDING qoladi, keyinroq qaytamiz
        await prisma.publishJob.update({
          where: { id: job.id },
          data: { message, nextTryAt: nextPendingCheck(job.marketplace) },
        });
        result.pending++;
        continue;
      }
      await fail(job.id, message);
      result.failed++;
    }
  }

  return result;
}

// ─── HOLAT YOZUVLARI ─────────────────────────────────────

function finish(id: string, message: string, warnings?: string[]) {
  return prisma.publishJob.update({
    where: { id },
    data: {
      status: 'DONE',
      message,
      warnings: warnings ?? [],
      nextTryAt: null,
      finishedAt: new Date(),
    },
  });
}

function fail(id: string, message: string, warnings?: string[]) {
  return prisma.publishJob.update({
    where: { id },
    data: {
      status: 'FAILED',
      message,
      warnings: warnings ?? [],
      nextTryAt: null,
      finishedAt: new Date(),
    },
  });
}

/** Listing holatini navbat natijasi bilan moslashtirish */
async function markListing(
  productId: string,
  marketplace: Marketplace,
  status: 'PENDING' | 'PUBLISHED' | 'ERROR',
  errorMessage: string | null = null,
  externalId?: string,
) {
  await prisma.listing.updateMany({
    where: { productId, marketplace },
    data: {
      status,
      errorMessage,
      lastSyncedAt: new Date(),
      ...(externalId ? { externalId } : {}),
    },
  });
}

// ─── HOLATNI KO'RSATISH ──────────────────────────────────

export interface QueueSummary {
  counts: Record<PublishJobStatus, number>;
  /** Hozir navbatda yoki ishlayotgan vazifalar bormi */
  active: boolean;
}

export async function getQueueSummary(organizationId: string): Promise<QueueSummary> {
  const rows = await prisma.publishJob.groupBy({
    by: ['status'],
    where: { organizationId },
    _count: { _all: true },
  });

  const counts = {
    QUEUED: 0,
    RUNNING: 0,
    PENDING: 0,
    DONE: 0,
    FAILED: 0,
    CANCELLED: 0,
  } as Record<PublishJobStatus, number>;

  for (const row of rows) counts[row.status] = row._count._all;

  return {
    counts,
    active: counts.QUEUED + counts.RUNNING + counts.PENDING > 0,
  };
}

export async function listPublishJobs(
  organizationId: string,
  { status, limit = 50 }: { status?: PublishJobStatus; limit?: number } = {},
) {
  const where: Prisma.PublishJobWhereInput = { organizationId };
  if (status) where.status = status;

  return prisma.publishJob.findMany({
    where,
    include: {
      product: {
        select: { id: true, title: true, sku: true, images: { take: 1, orderBy: { order: 'asc' } } },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });
}

/** Hali boshlanmagan vazifalarni bekor qilish */
export async function cancelPublishJobs(
  organizationId: string,
  jobIds?: string[],
): Promise<number> {
  const { count } = await prisma.publishJob.updateMany({
    // RUNNING ga tegmaymiz — u allaqachon marketplace'ga so'rov yuborgan bo'lishi mumkin
    where: {
      organizationId,
      status: { in: ['QUEUED', 'PENDING'] },
      ...(jobIds?.length ? { id: { in: jobIds } } : {}),
    },
    data: { status: 'CANCELLED', finishedAt: new Date(), nextTryAt: null },
  });
  return count;
}

// Qayta urinish siyosati testdan chaqiriladi
export const __internal = { isTransient, backoffUntil, nextPendingCheck, classifySkip };

// ─── OMMAVIY KATEGORIYA TANLASH ──────────────────────────

export interface BulkCategoryInput {
  /** Marketplace katalogidagi ID */
  categoryId: string;
  /** Ozon uchun tovar turi — kategoriya bilan juftlikda majburiy */
  typeId?: string;
  /** Ko'rinadigan nom */
  name: string;
}

export interface BulkCategoryResult {
  updated: number;
  /** Kategoriya qo'yildi va endi joylashga tayyor */
  ready: string[];
  /** Kategoriya qo'yildi, lekin boshqa maydonlar hali yetishmayapti */
  stillMissing: Array<{ productId: string; title: string; missing: string[] }>;
}

/**
 * Bir nechta mahsulotga bitta kategoriyani birdan qo'yish.
 *
 * Nega bu shunchaki `categoryId` yozish emas:
 *
 * Kartochka Uzum uchun to'ldirilgan bo'lsa, `attributes.byMarketplace.OZON`
 * bo'sh bo'ladi va joylash paytida Uzum qiymatlariga tushiladi. Agar biz
 * `byMarketplace.OZON = { categoryId }` deb yozsak, o'sha "tushish" ishlamay
 * qoladi va endi BARCHA maydonlar yetishmay qoladi — ya'ni holatni
 * yaxshilash o'rniga buzgan bo'lardik.
 *
 * Shuning uchun avval `prefillForMarketplace` bilan to'liq qiymatlar to'plami
 * quriladi (birliklar o'giriladi, ro'yxatdan tanlanadigan maydonlar
 * moslashtiriladi), keyin ustiga kategoriya qo'yiladi.
 */
export async function applyCategoryToProducts(
  organizationId: string,
  productIds: string[],
  marketplace: Marketplace,
  category: BulkCategoryInput,
): Promise<BulkCategoryResult> {
  const targetSpec = getSpec(marketplace);
  if (!targetSpec) throw new Error("Bunday marketplace yo'q");

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId },
  });

  const result: BulkCategoryResult = { updated: 0, ready: [], stillMissing: [] };

  for (const product of products) {
    const attrs = (product.attributes as any) || {};
    const byMarketplace: Record<string, any> = { ...(attrs.byMarketplace || {}) };

    // Shu marketplace uchun qiymatlar bormi? Bo'lmasa mavjud kartochkadan quramiz
    let values: Record<string, any> = byMarketplace[marketplace];

    if (!values) {
      const sourceSpec = attrs.marketplace ? getSpec(attrs.marketplace) : null;
      const prefilled = prefillForMarketplace(
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
        targetSpec,
      );
      values = prefilled.values;
    }

    values = {
      ...values,
      category: category.name,
      categoryId: category.categoryId,
      ...(category.typeId ? { typeId: category.typeId } : {}),
    };

    byMarketplace[marketplace] = values;

    // Eski, bitta marketplace uchun saqlangan qiymatlarni ham ko'chirib qo'yamiz —
    // aks holda ular keyingi tahrirlashda yo'qolardi
    if (attrs.marketplace && attrs.values && !byMarketplace[attrs.marketplace]) {
      byMarketplace[attrs.marketplace] = attrs.values;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { attributes: { ...attrs, byMarketplace } as any },
    });
    result.updated++;

    // Endi joylashga tayyormi — sotuvchi darhol bilsin
    const issues = validateValues(targetSpec, values, { forPublish: true });
    if (issues.length) {
      result.stillMissing.push({
        productId: product.id,
        title: product.title,
        missing: issues.map((i) => i.label),
      });
    } else {
      result.ready.push(product.id);
    }
  }

  return result;
}
