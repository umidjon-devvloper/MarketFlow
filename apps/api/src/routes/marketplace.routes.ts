import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware, requireRole, ROLES } from '../middleware/org.middleware';
import * as controller from '../controllers/marketplace.controller';

const router = Router();
router.use(authMiddleware, orgMiddleware);

// Barcha rollar ko'ra oladi
router.get('/', controller.listMarketplaces);

// Faqat ADMIN/OWNER — kalitlarni boshqarish
router.post('/', requireRole(...ROLES.ADMIN_OR_OWNER), controller.saveCredentials);
router.delete('/:id', requireRole(...ROLES.ADMIN_OR_OWNER), controller.deleteCredentials);
router.post('/:id/test', requireRole(...ROLES.ANY), controller.testCredentials);

// Umumiy data endpointlar — istalgan marketplace (adapter orqali)
router.get('/:id/products', requireRole(...ROLES.ANY), controller.marketplaceProducts);
router.get('/:id/orders', requireRole(...ROLES.ANY), controller.marketplaceOrders);
router.get('/:id/stocks', requireRole(...ROLES.ANY), controller.marketplaceStocks);
router.get('/:id/summary', requireRole(...ROLES.ANY), controller.marketplaceSummary);
router.get('/:id/insights', requireRole(...ROLES.ANY), controller.marketplaceInsights);
router.post('/:id/advice', requireRole(...ROLES.ANY), controller.marketplaceAdvice);

// Uzum Seller API ma'lumotlari — barcha rollar ko'ra oladi
router.get('/:id/uzum/shops', requireRole(...ROLES.ANY), controller.uzumShops);
router.get('/:id/uzum/products', requireRole(...ROLES.ANY), controller.uzumProducts);
router.get('/:id/uzum/orders', requireRole(...ROLES.ANY), controller.uzumOrders);
router.get('/:id/uzum/finance/orders', requireRole(...ROLES.ANY), controller.uzumFinanceOrders);
router.get('/:id/uzum/finance/expenses', requireRole(...ROLES.ANY), controller.uzumFinanceExpenses);
router.get('/:id/uzum/stocks', requireRole(...ROLES.ANY), controller.uzumStocks);
router.get('/:id/uzum/invoices', requireRole(...ROLES.ANY), controller.uzumInvoices);

export default router;
