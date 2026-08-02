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
    let orgId = (req.headers['x-organization-id'] as string) || (req.query.orgId as string);

    if (!orgId) {
      // Default: birinchi tashkilot
      const firstMembership = await prisma.membership.findFirst({
        where: { userId, isActive: true },
        orderBy: { joinedAt: 'asc' },
        include: { organization: true },
      });

      if (!firstMembership) {
        throw new HttpError(403, 'Sizda hech qanday tashkilot yo\'q. Avval yarating.');
      }

      req.organization = {
        id: firstMembership.organizationId,
        name: firstMembership.organization.name,
        slug: firstMembership.organization.slug,
        role: firstMembership.role,
      };
      return next();
    }

    // Berilgan orgId ga a'zolikni tekshirish
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId: orgId, isActive: true },
      include: { organization: true },
    });

    if (!membership) {
      throw new HttpError(403, 'Bu tashkilotga kirish huquqi yo\'q');
    }

    req.organization = {
      id: membership.organizationId,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    };

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
