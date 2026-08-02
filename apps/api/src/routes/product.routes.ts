import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware, requireRole, ROLES } from '../middleware/org.middleware';
import * as productController from '../controllers/product.controller';

const router = Router();

// Barcha yo'llar auth va org talab qiladi
router.use(authMiddleware, orgMiddleware);

// Barcha rollar (STAFF, ADMIN, OWNER) uchun
router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);
router.post('/', productController.createProduct);
router.patch('/:id', productController.updateProduct);
router.post('/:id/images', productController.addProductImage);

// Faqat ADMIN va OWNER o'chira oladi
router.delete(
  '/:id',
  requireRole(...ROLES.ADMIN_OR_OWNER),
  productController.deleteProduct,
);
router.delete(
  '/:id/images/:imageId',
  requireRole(...ROLES.ADMIN_OR_OWNER),
  productController.deleteProductImage,
);

export default router;
