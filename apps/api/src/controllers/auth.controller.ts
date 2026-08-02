import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { HttpError } from '../middleware/error.middleware';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  // Ixtiyoriy: agar taklif orqali kelayotgan bo'lsa
  inviteToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 40) + '-' + Math.random().toString(36).substring(2, 8)
  );
}

/**
 * POST /api/auth/register
 * Yangi foydalanuvchi yaratish + avtomatik Organization yaratish
 * Yoki taklif token bo'lsa - o'sha tashkilotga qo'shish
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpError(409, 'Bu email allaqachon ro\'yxatdan o\'tgan');

    const hashed = await bcrypt.hash(data.password, 10);

    // Agar taklif token bo'lsa - tekshirish
    let invitation = null;
    if (data.inviteToken) {
      invitation = await prisma.invitation.findUnique({
        where: { token: data.inviteToken },
      });

      if (!invitation || invitation.status !== 'PENDING') {
        throw new HttpError(400, 'Taklif yaroqsiz yoki muddati tugagan');
      }
      if (invitation.expiresAt < new Date()) {
        throw new HttpError(400, 'Taklif muddati tugagan');
      }
      if (invitation.email.toLowerCase() !== data.email.toLowerCase()) {
        throw new HttpError(400, `Bu taklif ${invitation.email} uchun`);
      }
    }

    // User + Organization/Membership yaratish (transaction)
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashed,
          fullName: data.fullName,
          phone: data.phone,
        },
        select: { id: true, email: true, fullName: true },
      });

      let organizationId: string;
      let role: 'OWNER' | 'ADMIN' | 'STAFF' = 'OWNER';

      if (invitation) {
        // Taklif orqali - mavjud tashkilotga qo'shish
        organizationId = invitation.organizationId;
        role = invitation.role;

        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId,
            role,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED', acceptedAt: new Date() },
        });
      } else {
        // Default - yangi tashkilot yaratish
        const orgName = `${data.fullName}ning tashkiloti`;
        const org = await tx.organization.create({
          data: {
            name: orgName,
            slug: slugify(data.fullName),
            ownerId: user.id,
            members: {
              create: {
                userId: user.id,
                role: 'OWNER',
              },
            },
          },
        });
        organizationId = org.id;
      }

      const organization = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true, logo: true },
      });

      return { user, organizationId, role, organization };
    });

    const accessToken = signAccessToken({
      userId: result.user.id,
      email: result.user.email,
      role: 'SELLER', // legacy field
    });
    const refreshToken = signRefreshToken({
      userId: result.user.id,
      email: result.user.email,
      role: 'SELLER',
    });

    res.status(201).json({
      user: result.user,
      // Login javobi bilan bir xil shakl — frontend to'g'ridan-to'g'ri ishlatadi
      organizations: result.organization
        ? [{ ...result.organization, role: result.role }]
        : [],
      organizationId: result.organizationId,
      organizationRole: result.role,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            organization: { select: { id: true, name: true, slug: true, logo: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!user) throw new HttpError(401, 'Email yoki parol noto\'g\'ri');

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) throw new HttpError(401, 'Email yoki parol noto\'g\'ri');
    if (!user.isActive) throw new HttpError(403, 'Hisob faol emas');

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: 'SELLER',
    });
    const refreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
      role: 'SELLER',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
      },
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logo: m.organization.logo,
        role: m.role,
      })),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new HttpError(400, 'refreshToken kerak');

    const payload = verifyRefreshToken(refreshToken);
    // Dekodlangan payloadda eski iat/exp bor — ularni signAccessToken'ga
    // uzatib bo'lmaydi (expiresIn bilan to'qnashadi), toza payload tuzamiz
    const accessToken = signAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });
    res.json({ accessToken });
  } catch (err) {
    next(new HttpError(401, 'Refresh token yaroqsiz'));
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            organization: { select: { id: true, name: true, slug: true, logo: true } },
          },
        },
      },
    });
    if (!user) throw new HttpError(404, 'Foydalanuvchi topilmadi');

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logo: m.organization.logo,
        role: m.role,
      })),
    });
  } catch (err) {
    next(err);
  }
}
