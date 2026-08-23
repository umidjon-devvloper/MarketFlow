import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware, requireRole, ROLES } from '../middleware/org.middleware';
import * as controller from '../controllers/alerts.controller';

const router = Router();
router.use(authMiddleware, orgMiddleware);

router.get('/settings', requireRole(...ROLES.ANY), controller.getSettings);

// Sozlama va xat yuborish — faqat ADMIN/OWNER
router.patch('/settings', requireRole(...ROLES.ADMIN_OR_OWNER), controller.updateSettings);
router.post('/test', requireRole(...ROLES.ADMIN_OR_OWNER), controller.sendTestEmail);
router.post('/run', requireRole(...ROLES.ADMIN_OR_OWNER), controller.runNow);

export default router;
