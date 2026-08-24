import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware, requireRole, ROLES } from '../middleware/org.middleware';
import * as controller from '../controllers/competitor.controller';

const router = Router();
router.use(authMiddleware, orgMiddleware);

// Ko'rish — har qanday a'zo
router.get('/', requireRole(...ROLES.ANY), controller.list);
router.post('/check', requireRole(...ROLES.ANY), controller.checkAll);
router.post('/:id/check', requireRole(...ROLES.ANY), controller.checkOne);

// O'zgartirish — ADMIN/OWNER
router.post('/', requireRole(...ROLES.ADMIN_OR_OWNER), controller.create);
router.patch('/:id/price', requireRole(...ROLES.ADMIN_OR_OWNER), controller.setPrice);
router.delete('/:id', requireRole(...ROLES.ADMIN_OR_OWNER), controller.remove);

export default router;
