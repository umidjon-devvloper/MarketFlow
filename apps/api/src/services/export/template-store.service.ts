/**
 * Sotuvchining o'z Excel shabloni.
 *
 * Marketplace shablonlari KATEGORIYAGA bog'langan: ilova bilan kelgan nusxa
 * faqat bitta kategoriya uchun to'g'ri keladi (WB'da o'yinchoqlar, Uzum'da
 * kiyim). Boshqa kategoriyada ustunlar mos kelmaydi — sotuvchi to'ldirilgan
 * faylni umuman yuklay olmaydi.
 *
 * Yechim: sotuvchi o'z kategoriyasining shablonini marketplace kabinetidan
 * yuklab olib, bir marta shu yerga joylaydi. Keyingi eksportlar o'sha faylni
 * to'ldiradi. Shabloni yo'q bo'lsa ilova bilan kelgan nusxa ishlatiladi.
 */

import { Marketplace } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { HttpError } from '../../middleware/error.middleware';

/** Excel shablonlari katta emas, lekin bazani ham to'ldirib yubormaylik */
const MAX_TEMPLATE_BYTES = 12 * 1024 * 1024;

/**
 * Bir jarayon ichida qayta-qayta bazadan o'qimaslik uchun.
 * Shablon kamdan-kam almashadi, eksport esa ketma-ket bo'lishi mumkin.
 */
const cache = new Map<string, { content: Buffer; version: string }>();

function cacheKey(organizationId: string, marketplace: Marketplace): string {
  return `${organizationId}:${marketplace}`;
}

export interface TemplateInfo {
  label: string;
  fileName: string;
  size: number;
  updatedAt: Date;
}

/** Sotuvchining shabloni haqida ma'lumot (faylsiz) */
export async function getTemplateInfo(
  organizationId: string,
  marketplace: Marketplace,
): Promise<TemplateInfo | null> {
  const row = await prisma.marketplaceTemplate.findUnique({
    where: { organizationId_marketplace: { organizationId, marketplace } },
    select: { label: true, fileName: true, size: true, updatedAt: true },
  });
  return row ?? null;
}

/**
 * Shablon fayli. Sotuvchi o'zinikini yuklamagan bo'lsa `null` — chaqiruvchi
 * ilova bilan kelgan nusxaga qaytadi.
 */
export async function getTemplateBuffer(
  organizationId: string,
  marketplace: Marketplace,
): Promise<Buffer | null> {
  const row = await prisma.marketplaceTemplate.findUnique({
    where: { organizationId_marketplace: { organizationId, marketplace } },
    select: { content: true, updatedAt: true },
  });
  if (!row) {
    cache.delete(cacheKey(organizationId, marketplace));
    return null;
  }

  const key = cacheKey(organizationId, marketplace);
  const version = row.updatedAt.toISOString();
  const hit = cache.get(key);
  if (hit?.version === version) return hit.content;

  const content = Buffer.from(row.content);
  cache.set(key, { content, version });
  return content;
}

/** Yuklangan fayl haqiqatan Excel ekanini tekshiramiz */
function assertExcel(fileName: string, content: Buffer): void {
  if (content.length === 0) throw new HttpError(400, "Fayl bo'sh");
  if (content.length > MAX_TEMPLATE_BYTES) {
    throw new HttpError(400, `Fayl juda katta (${Math.round(content.length / 1024 / 1024)} MB). 12 MB gacha bo'lsin.`);
  }
  // xlsx/xlsm — ZIP konteyner, "PK" bilan boshlanadi
  if (content[0] !== 0x50 || content[1] !== 0x4b) {
    throw new HttpError(400, 'Bu Excel fayl emas. Marketplace kabinetidan .xlsx yoki .xlsm shablonini yuklab oling.');
  }
  if (!/\.(xlsx|xlsm)$/i.test(fileName)) {
    throw new HttpError(400, 'Fayl kengaytmasi .xlsx yoki .xlsm bo\'lishi kerak');
  }
}

export async function saveTemplate(params: {
  organizationId: string;
  marketplace: Marketplace;
  label: string;
  fileName: string;
  content: Buffer;
}): Promise<TemplateInfo> {
  const { organizationId, marketplace, label, fileName, content } = params;
  assertExcel(fileName, content);

  const row = await prisma.marketplaceTemplate.upsert({
    where: { organizationId_marketplace: { organizationId, marketplace } },
    create: { organizationId, marketplace, label, fileName, content, size: content.length },
    update: { label, fileName, content, size: content.length },
    select: { label: true, fileName: true, size: true, updatedAt: true },
  });

  cache.delete(cacheKey(organizationId, marketplace));
  return row;
}

export async function deleteTemplate(
  organizationId: string,
  marketplace: Marketplace,
): Promise<boolean> {
  const { count } = await prisma.marketplaceTemplate.deleteMany({
    where: { organizationId, marketplace },
  });
  cache.delete(cacheKey(organizationId, marketplace));
  return count > 0;
}
