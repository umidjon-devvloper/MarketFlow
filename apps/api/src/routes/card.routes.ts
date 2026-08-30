import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { orgMiddleware, requireRole, ROLES } from '../middleware/org.middleware';
import * as controller from '../controllers/card.controller';

const router = Router();

// Spetsifikatsiyalar statik — bazaga umuman tegmaydi, shuning uchun
// orgMiddleware'siz (u har so'rovda a'zolikni tekshiradi)
router.get('/specs', authMiddleware, controller.getSpecs);
router.get('/specs/:marketplace', authMiddleware, controller.getSpecDetail);

// Qolgan yo'llar tashkilot kontekstini talab qiladi
router.use(authMiddleware, orgMiddleware);

// Rasm yuklash
router.post('/upload', controller.uploadMiddleware, controller.uploadImage);

// AI qadamlari
router.post('/adapt-image', controller.adaptImage);
router.post('/ai-fill', controller.aiFill);
router.post('/price-advice', controller.priceAdvice);
router.get('/ai-usage', controller.aiUsage);

// Kategoriya katalogi — marketplace ID'larini qidirish
router.get('/categories/:marketplace', controller.listCategories);
router.get('/categories/:marketplace/charcs', controller.getCategoryCharcs);
router.get('/categories/:marketplace/tnved', controller.getCategoryTnved);

// Mavjud mahsulotni boshqa marketplace uchun qayta ishlatish
router.get('/:productId/prefill/:marketplace', controller.prefillCard);
router.post('/:productId/listings', controller.addListing);
router.post('/:productId/publish/:marketplace', controller.publishCard);
router.post('/finalize-pending', controller.finalizePending);
router.get('/:productId/publish-status/:marketplace', controller.publishStatus);

// Bir nechta kartochkaga bitta kategoriyani birdan qo'yish
router.post('/bulk-category', requireRole(...ROLES.ANY), controller.bulkCategory);

// Kartochka sifat bahosi (jonli, saqlashdan oldin)
router.post('/quality', controller.cardQuality);

// Narx va qoldiqni marketplace'ga yuborish (orqaga sinxronlash)
router.post('/sync-price-stock', requireRole(...ROLES.ANY), controller.syncPriceStock);

// Ommaviy joylash navbati
router.post('/publish-batch', requireRole(...ROLES.ANY), controller.publishBatch);
router.get('/publish-jobs', controller.publishJobs);
router.post('/publish-jobs/cancel', controller.cancelPublishBatch);

// Kartochkalar
router.get('/', controller.listCards);
router.post('/', controller.saveCard);
router.post('/export', controller.exportExcel);

export default router;
