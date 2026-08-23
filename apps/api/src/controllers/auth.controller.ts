import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { HttpError } from '../middleware/error.middleware';

/**
 * Parol talablari: kamida 8 belgi, harf va raqam bo'lsin.
 * Ilgari 6 belgi yetardi — "test1234" kabi parollar juda oson topilardi.
 */
const passwordSchema = z
  .string()
  .min(8, 'Parol kamida 8 belgi bo\'lishi kerak')
  .refine((v) => /[a-zA-Z]/.test(v), 'Parolda kamida bitta harf bo\'lsin')
  .refine((v) => /[0-9]/.test(v), 'Parolda kamida bitta raqam bo\'lsin');

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
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
      tv: 0,
    });
    const refreshToken = signRefreshToken({
      userId: result.user.id,
      email: result.user.email,
      role: 'SELLER',
      tv: 0,
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
      tv: user.tokenVersion,
    });
    const refreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
      role: 'SELLER',
      tv: user.tokenVersion,
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

    // Token avlodi bazadagi bilan mos kelmasa — foydalanuvchi chiqib ketgan
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true, isActive: true },
    });
    if (!user || !user.isActive) throw new HttpError(401, 'Hisob topilmadi yoki faol emas');
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      throw new HttpError(401, 'Sessiya tugagan — qaytadan kiring');
    }

    // Dekodlangan payloadda eski iat/exp bor — ularni signAccessToken'ga
    // uzatib bo'lmaydi (expiresIn bilan to'qnashadi), toza payload tuzamiz
    const accessToken = signAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      tv: user.tokenVersion,
    });
    res.json({ accessToken });
  } catch (err) {
    next(err instanceof HttpError ? err : new HttpError(401, 'Refresh token yaroqsiz'));
  }
}

/**
 * POST /api/auth/logout
 * Token avlodini oshiradi — barcha qurilmalardagi refresh tokenlar bekor bo'ladi.
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { tokenVersion: { increment: 1 } },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/auth/password
 * Parolni almashtirish — eski parol tekshiriladi, keyin barcha sessiyalar yopiladi.
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const data = changePasswordSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, 'Foydalanuvchi topilmadi');

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) throw new HttpError(401, 'Joriy parol noto\'g\'ri');

    const hashed = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      // Parol o'zgarganda eski sessiyalar ham yopilishi kerak
      data: { password: hashed, tokenVersion: { increment: 1 } },
    });

    res.json({ success: true, message: 'Parol almashtirildi — qaytadan kiring' });
  } catch (err) {
    next(err);
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
