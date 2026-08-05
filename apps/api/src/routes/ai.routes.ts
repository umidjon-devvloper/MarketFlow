import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware } from '../middleware/org.middleware';
import * as aiController from '../controllers/ai.controller';

const router = Router();
router.use(authMiddleware, orgMiddleware);

// Rasm AI
router.post('/remove-background', aiController.removeBackgroundController);
router.post('/upscale', aiController.upscaleController);
router.get('/jobs/:id', aiController.getJobStatus);

// Matn AI
router.post('/generate-listings', aiController.generateListingsController);

export default router;
