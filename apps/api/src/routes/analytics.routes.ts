import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware } from '../middleware/org.middleware';
import * as controller from '../controllers/analytics.controller';

const router = Router();
router.use(authMiddleware, orgMiddleware);

router.get('/overview', controller.getOverview);
router.get('/timeseries', controller.getTimeseries);
router.get('/top-products', controller.getTopProducts);
router.get('/growth', controller.getGrowth);
router.get('/top-selling', controller.getTopSelling);

export default router;
