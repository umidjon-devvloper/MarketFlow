import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { HttpError } from '../middleware/error.middleware';

// ============================================
// Validatorlar
// ============================================

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  logo: z.string().url().nullable().optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'STAFF']).default('STAFF'),
});

const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'STAFF']),
});

// ============================================
// Yordamchi funksiyalar
// ============================================

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 40) + '-' + Math.random().toString(36).substring(2, 8)
  );
}

// ============================================
// Organizations
// ============================================

/**
 * GET /api/orgs
 * Foydalanuvchining barcha tashkilotlari
 */
export async function listMyOrgs(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    const memberships = await prisma.membership.findMany({
      where: { userId, isActive: true },
      include: {
        organization: {
          include: {
            _count: { select: { members: true, products: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    res.json({
      items: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logo: m.organization.logo,
        description: m.organization.description,
        role: m.role,
        joinedAt: m.joinedAt,
        stats: {
          members: m.organization._count.members,
          products: m.organization._count.products,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orgs
 * Yangi tashkilot yaratish (avtomatik OWNER)
 */
export async function createOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createOrgSchema.parse(req.body);
    const userId = req.user!.userId;

    const org = await prisma.organization.create({
      data: {
        name: data.name,
        slug: slugify(data.name),
        description: data.description,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
    });

    res.status(201).json({ organization: org });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orgs/current
 * Hozirgi tashkilot ma'lumoti
 */
export async function getCurrentOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organization!.id },
      include: {
        _count: { select: { members: true, products: true } },
      },
    });

    if (!org) throw new HttpError(404, 'Tashkilot topilmadi');

    res.json({
      organization: {
        ...org,
        currentUserRole: req.organization!.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/orgs/current
 * Tashkilot ma'lumotlarini yangilash (faqat OWNER)
 */
export async function updateOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateOrgSchema.parse(req.body);

    const org = await prisma.organization.update({
      where: { id: req.organization!.id },
      data,
    });

    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
}

// ============================================
// Members
// ============================================

/**
 * GET /api/orgs/current/members
 * Tashkilot a'zolari ro'yxati
 */
export async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await prisma.membership.findMany({
      where: { organizationId: req.organization!.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    res.json({
      items: members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        isActive: m.isActive,
        user: m.user,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/orgs/current/members/:id
 * A'zo rolini o'zgartirish (OWNER'ni o'zgartirib bo'lmaydi)
 */
export async function updateMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = updateMemberSchema.parse(req.body);

    const target = await prisma.membership.findFirst({
      where: { id, organizationId: req.organization!.id },
    });
    if (!target) throw new HttpError(404, 'A\'zo topilmadi');

    if (target.role === 'OWNER') {
      throw new HttpError(400, 'OWNER rolini o\'zgartirib bo\'lmaydi');
    }

    const updated = await prisma.membership.update({
      where: { id },
      data: { role: data.role },
    });

    res.json({ member: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/orgs/current/members/:id
 * A'zoni chiqarish
 */
export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const target = await prisma.membership.findFirst({
      where: { id, organizationId: req.organization!.id },
    });
    if (!target) throw new HttpError(404, 'A\'zo topilmadi');

    if (target.role === 'OWNER') {
      throw new HttpError(400, 'OWNER ni chiqarib bo\'lmaydi');
    }

    await prisma.membership.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ============================================
// Invitations
// ============================================

/**
 * GET /api/orgs/current/invitations
 * Kutilayotgan takliflar
 */
export async function listInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.invitation.findMany({
      where: {
        organizationId: req.organization!.id,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orgs/current/invitations
 * Yangi taklif yaratish (email va tokenga link jo'natish)
 */
export async function createInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const data = inviteSchema.parse(req.body);
    const userId = req.user!.userId;
    const orgId = req.organization!.id;

    // Bu email allaqachon a'zo bo'lmaganini tekshirish
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      const existingMembership = await prisma.membership.findFirst({
        where: { userId: existingUser.id, organizationId: orgId },
      });
      if (existingMembership) {
        throw new HttpError(409, 'Bu foydalanuvchi allaqachon tashkilot a\'zosi');
      }
    }

    // Eski PENDING taklif bo'lsa - bekor qilish
    await prisma.invitation.updateMany({
      where: {
        organizationId: orgId,
        email: data.email,
        status: 'PENDING',
      },
      data: { status: 'REVOKED' },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 kun

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: orgId,
        senderId: userId,
        email: data.email,
        role: data.role,
        token,
        expiresAt,
      },
    });

    // TODO: Email jo'natish (keyingi bosqichda)
    // Hozircha URL ni response'da qaytaramiz
    const inviteUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/invite/${token}`;

    res.status(201).json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      inviteUrl, // hozircha qo'lda ulashish uchun
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/orgs/current/invitations/:id
 * Taklif bekor qilish
 */
export async function revokeInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const inv = await prisma.invitation.findFirst({
      where: { id, organizationId: req.organization!.id },
    });
    if (!inv) throw new HttpError(404, 'Taklif topilmadi');

    await prisma.invitation.update({
      where: { id },
      data: { status: 'REVOKED' },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/invitations/:token
 * Taklif ma'lumotini olish (login qilmagan foydalanuvchi ham ko'ra oladi)
 */
export async function getInvitationByToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;

    const inv = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: { select: { name: true, logo: true } },
        sender: { select: { fullName: true } },
      },
    });

    if (!inv) throw new HttpError(404, 'Taklif topilmadi');
    if (inv.status !== 'PENDING') {
      throw new HttpError(400, `Taklif ${inv.status.toLowerCase()}`);
    }
    if (inv.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: inv.id },
        data: { status: 'EXPIRED' },
      });
      throw new HttpError(400, 'Taklif muddati tugagan');
    }

    res.json({
      invitation: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        organization: inv.organization,
        sender: inv.sender,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/invitations/:token/accept
 * Taklifni qabul qilish (foydalanuvchi login qilgan bo'lishi kerak)
 */
export async function acceptInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;
    const userId = req.user!.userId;

    const inv = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!inv) throw new HttpError(404, 'Taklif topilmadi');
    if (inv.status !== 'PENDING') throw new HttpError(400, 'Taklif allaqachon ishlov berilgan');
    if (inv.expiresAt < new Date()) throw new HttpError(400, 'Taklif muddati tugagan');

    // User email va invitation email mos kelishi kerak
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, 'Foydalanuvchi topilmadi');
    if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
      throw new HttpError(403, `Bu taklif ${inv.email} uchun. Sizniki: ${user.email}`);
    }

    // Membership yaratish
    await prisma.$transaction([
      prisma.membership.create({
        data: {
          userId,
          organizationId: inv.organizationId,
          role: inv.role,
        },
      }),
      prisma.invitation.update({
        where: { id: inv.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      }),
    ]);

    res.json({
      success: true,
      organizationId: inv.organizationId,
      organizationName: inv.organization.name,
    });
  } catch (err) {
    next(err);
  }
}
