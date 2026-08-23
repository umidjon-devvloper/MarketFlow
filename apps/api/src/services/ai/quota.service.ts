/**
 * AI limiti va xarajat hisobi
 *
 * Har `ai-fill` OpenAI'ga, har `adapt-image` Higgsfield'ga pul sarflaydi.
 * Umumiy rate limit (15 daqiqada 600 so'rov) buni to'xtatmaydi — bitta
 * foydalanuvchi tugmani bosaverib hisobni bo'shatishi mumkin edi.
 *
 * Shuning uchun har tashkilotga kunlik limit qo'yiladi va har chaqiruv
 * AiJob jadvaliga xarajati bilan yoziladi.
 */

import { prisma } from '../../utils/prisma';
import { HttpError } from '../../middleware/error.middleware';

/** Kunlik limit — .env dan sozlanadi */
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 200);

/**
 * Narxlar (1 million token uchun, USD).
 * Model narxi o'zgarsa .env orqali yangilanadi — kodga tegmasdan.
 */
const PRICE_PER_MTOK = Number(process.env.AI_PRICE_PER_MTOK || 0.6);

/** Higgsfield bitta rasm uchun taxminiy narx */
const IMAGE_JOB_COST = Number(process.env.AI_IMAGE_JOB_COST || 0.01);

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  costTodayUsd: number;
}

/** Bugungi holat */
export async function getQuotaStatus(organizationId: string): Promise<QuotaStatus> {
  const since = startOfToday();

  const [used, sum] = await Promise.all([
    prisma.aiJob.count({ where: { organizationId, createdAt: { gte: since } } }),
    prisma.aiJob.aggregate({
      where: { organizationId, createdAt: { gte: since } },
      _sum: { costUsd: true },
    }),
  ]);

  return {
    used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
    costTodayUsd: Number(sum._sum.costUsd ?? 0),
  };
}

/** Limit tugagan bo'lsa xato tashlaydi */
export async function assertAiQuota(organizationId: string): Promise<QuotaStatus> {
  const status = await getQuotaStatus(organizationId);

  if (status.remaining <= 0) {
    throw new HttpError(
      429,
      `Bugungi AI limiti tugadi (${status.limit} ta). Ertaga yangilanadi yoki AI_DAILY_LIMIT ni oshiring.`,
    );
  }

  return status;
}

export function estimateTextCost(tokens: number): number {
  return (tokens / 1_000_000) * PRICE_PER_MTOK;
}

export function imageJobCost(): number {
  return IMAGE_JOB_COST;
}

/** Bajarilgan ishni yozib qo'yish */
export async function recordAiJob(params: {
  organizationId: string;
  userId: string;
  type: 'ADAPT_IMAGE' | 'FIELD_FILL';
  provider: string;
  status: 'COMPLETED' | 'FAILED';
  inputUrl?: string;
  outputUrl?: string;
  tokensUsed?: number;
  costUsd?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.aiJob.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        type: params.type,
        status: params.status,
        provider: params.provider,
        inputUrl: params.inputUrl ?? null,
        outputUrl: params.outputUrl ?? null,
        tokensUsed: params.tokensUsed ?? null,
        costUsd: params.costUsd ?? null,
        error: params.error ?? null,
        metadata: (params.metadata ?? {}) as any,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    // Hisob yozuvi asosiy oqimni to'xtatmasligi kerak
    console.warn('AI job yozib bo\'lmadi:', (err as Error).message);
  }
}
