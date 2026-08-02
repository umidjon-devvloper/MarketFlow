import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware } from '../middleware/org.middleware';
import * as controller from '../controllers/import.controller';

const router = Router();

// Barcha yo'llar auth va org talab qiladi
router.use(authMiddleware, orgMiddleware);

// Shablon yuklab olish (barcha rollar)
router.get('/template', controller.downloadTemplate);

// Preview (fayl yuklash + validatsiya)
router.post('/preview', controller.uploadMiddleware, controller.previewImport);

// Import ijro etish
router.post('/execute', controller.executeImport);

export default router;
