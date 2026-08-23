import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware } from '../middleware/org.middleware';
import * as listingController from '../controllers/listing.controller';

const router = Router();
router.use(authMiddleware, orgMiddleware);

router.get('/product/:productId', listingController.getProductListings);
router.patch('/:id', listingController.updateListing);
router.delete('/:id', listingController.deleteListing);
router.get('/:id/export', listingController.exportListing);
router.post('/:id/copy-to', listingController.copyListingTo);
router.post('/scrape/uzum', listingController.scrapeFromUzum);

export default router;
