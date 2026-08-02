import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware, requireRole, ROLES } from '../middleware/org.middleware';
import * as controller from '../controllers/organization.controller';

const router = Router();

// Auth talab qiluvchi barcha yo'llar
router.use(authMiddleware);

// Foydalanuvchi tashkilotlari (org tanlash uchun)
router.get('/', controller.listMyOrgs);
router.post('/', controller.createOrg);

// Hozirgi tashkilot (X-Organization-Id header'dan)
router.get('/current', orgMiddleware, controller.getCurrentOrg);
router.patch(
  '/current',
  orgMiddleware,
  requireRole(...ROLES.OWNER_ONLY),
  controller.updateOrg,
);

// A'zolar
router.get('/current/members', orgMiddleware, controller.listMembers);
router.patch(
  '/current/members/:id',
  orgMiddleware,
  requireRole(...ROLES.ADMIN_OR_OWNER),
  controller.updateMember,
);
router.delete(
  '/current/members/:id',
  orgMiddleware,
  requireRole(...ROLES.OWNER_ONLY),
  controller.removeMember,
);

// Takliflar
router.get(
  '/current/invitations',
  orgMiddleware,
  requireRole(...ROLES.ADMIN_OR_OWNER),
  controller.listInvitations,
);
router.post(
  '/current/invitations',
  orgMiddleware,
  requireRole(...ROLES.ADMIN_OR_OWNER),
  controller.createInvitation,
);
router.delete(
  '/current/invitations/:id',
  orgMiddleware,
  requireRole(...ROLES.ADMIN_OR_OWNER),
  controller.revokeInvitation,
);

export default router;
