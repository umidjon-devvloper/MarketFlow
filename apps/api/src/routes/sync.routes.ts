import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware, requireRole, ROLES } from '../middleware/org.middleware';
import * as controller from '../controllers/sync.controller';

const router = Router();
router.use(authMiddleware, orgMiddleware);

router.get('/status', requireRole(...ROLES.ANY), controller.getStatus);
router.get('/trend', requireRole(...ROLES.ANY), controller.getTrend);

// Qo'lda ishga tushirish marketplace limitlarini sarflaydi — faqat ADMIN/OWNER
router.post('/run', requireRole(...ROLES.ADMIN_OR_OWNER), controller.runNow);

export default router;
