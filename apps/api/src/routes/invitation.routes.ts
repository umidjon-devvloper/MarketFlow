import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as controller from '../controllers/organization.controller';

const router = Router();

// Public: taklif ma'lumotini token orqali ko'rish
router.get('/:token', controller.getInvitationByToken);

// Auth talab: qabul qilish
router.post('/:token/accept', authMiddleware, controller.acceptInvitation);

export default router;
