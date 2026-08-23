import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { HttpError } from './error.middleware';

type MemberRole = 'OWNER' | 'ADMIN' | 'STAFF';

declare global {
  namespace Express {
    interface Request {
      organization?: {
        id: string;
        name: string;
        slug: string;
        role: MemberRole;
      };
    }
  }
}

interface OrgContext {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
}

/**
 * A'zolik keshi.
 *
 * Har bir so'rov uchun `membership.findFirst` bajarilardi — dashboard bir vaqtda
 * 5-6 so'rov yuborgani uchun bu Prisma connection pool ini to'ldirib,
 * P2024 ("Timed out fetching a new connection") xatosini keltirib chiqarardi.
 * Endi natija qisqa muddat keshda turadi.
 *
 * A'zolik o'zgarganda `invalidateOrgAccess()` chaqiriladi — ya'ni xodim
 * o'chirilsa yoki roli o'zgarsa kesh darhol tozalanadi.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: OrgContext; expiresAt: number }>();

function cacheKey(userId: string, orgId: string | null) {
  return `${userId}:${orgId ?? '_default'}`;
}

function readCache(key: string): OrgContext | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key: string, value: OrgContext) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });

  // Kesh cheksiz o'smasin
  if (cache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiresAt < now) cache.delete(k);
    }
  }
}

/**
 * A'zolik keshini tozalash.
 * userId berilsa faqat o'shaniki, aks holda hammasi.
 */
export function invalidateOrgAccess(userId?: string) {
  if (!userId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) cache.delete(key);
  }
}

/**
 * Organization ni request'dan aniqlaydi va foydalanuvchining a'zoligini tekshiradi
 *
 * Organization ID keladigan joylar (prioritet bo'yicha):
 * 1. Header: `X-Organization-Id`
 * 2. Query: `?orgId=xxx`
 * 3. User'ning birinchi active organizatsiyasi (default)
 */
export async function orgMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Auth talab qilinadi');

    const userId = req.user.userId;
    const orgId = (req.headers['x-organization-id'] as string) || (req.query.orgId as string) || null;

    const key = cacheKey(userId, orgId);
    const cached = readCache(key);
    if (cached) {
      req.organization = cached;
      return next();
    }

    // Faqat kerakli ustunlar: `include: { organization: true }` butun jadvalni
    // tortadi va Organization'ga yangi ustun qo'shilib, migratsiya hali
    // qo'llanmagan bo'lsa — HAR BIR so'rov "column does not exist" bilan yiqiladi.
    const select = {
      organizationId: true,
      role: true,
      organization: { select: { name: true, slug: true } },
    } as const;

    const membership = orgId
      ? await prisma.membership.findFirst({
          where: { userId, organizationId: orgId, isActive: true },
          select,
        })
      : // Default: birinchi tashkilot
        await prisma.membership.findFirst({
          where: { userId, isActive: true },
          orderBy: { joinedAt: 'asc' },
          select,
        });

    if (!membership) {
      throw new HttpError(
        403,
        orgId ? "Bu tashkilotga kirish huquqi yo'q" : "Sizda hech qanday tashkilot yo'q. Avval yarating.",
      );
    }

    const context: OrgContext = {
      id: membership.organizationId,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    };

    writeCache(key, context);
    req.organization = context;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Rol talab qiluvchi middleware
 * Ishlatish: `router.post('/x', authMiddleware, orgMiddleware, requireRole('ADMIN', 'OWNER'), controller)`
 */
export function requireRole(...roles: MemberRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.organization) {
      return next(new HttpError(403, 'Tashkilot aniqlanmagan'));
    }
    if (!roles.includes(req.organization.role)) {
      return next(
        new HttpError(
          403,
          `Bu amal uchun ruxsat yo'q. Kerakli rol: ${roles.join(', ')}. Sizniki: ${req.organization.role}`,
        ),
      );
    }
    next();
  };
}

// Yordamchi konstanta
export const ROLES = {
  OWNER_ONLY: ['OWNER'] as MemberRole[],
  ADMIN_OR_OWNER: ['OWNER', 'ADMIN'] as MemberRole[],
  ANY: ['OWNER', 'ADMIN', 'STAFF'] as MemberRole[],
};
