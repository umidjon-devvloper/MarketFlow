import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware, requireRole, ROLES } from '../middleware/org.middleware';
import * as controller from '../controllers/order.controller';

const router = Router();

router.use(authMiddleware, orgMiddleware);

// Buyurtmalar keshdan o'qiladi — hamma rol ko'ra oladi
router.get('/', requireRole(...ROLES.ANY), controller.listOrders);
router.get('/summary', requireRole(...ROLES.ANY), controller.ordersSummary);
router.get('/:id', requireRole(...ROLES.ANY), controller.getOrder);
router.get('/:id/actions', requireRole(...ROLES.ANY), controller.orderActions);

// Tasdiqlash va bekor qilish — HAQIQIY mijoz buyurtmasiga ta'sir qiladi
// va qaytarib bo'lmaydi. Bu biznes qarori, shuning uchun STAFF emas.
router.post('/:id/confirm', requireRole(...ROLES.ADMIN_OR_OWNER), controller.confirmOrderAction);
router.post('/:id/cancel', requireRole(...ROLES.ADMIN_OR_OWNER), controller.cancelOrderAction);

export default router;
