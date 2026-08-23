import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * Login va ro'yxatdan o'tish uchun alohida, qattiqroq limit.
 * Umumiy /api limiti 15 daqiqada 600 so'rov — parolni brute-force qilish
 * uchun bu juda ko'p.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 50,
  message: { error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // muvaffaqiyatli kirish limitni yemasin
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authMiddleware, authController.logout);
router.patch('/password', authMiddleware, authController.changePassword);
router.get('/me', authMiddleware, authController.me);

export default router;
