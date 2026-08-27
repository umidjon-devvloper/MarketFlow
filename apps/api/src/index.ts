// Eng birinchi: .env ni o'qib, majburiy o'zgaruvchilarni tekshiradi.
// Xato bo'lsa shu yerda to'xtaydi — yarim ishlaydigan holatda emas.
import './config/env';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { openapiSpec } from './docs/openapi';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import listingRoutes from './routes/listing.routes';
import aiRoutes from './routes/ai.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import analyticsRoutes from './routes/analytics.routes';
import organizationRoutes from './routes/organization.routes';
import invitationRoutes from './routes/invitation.routes';
import importRoutes from './routes/import.routes';
import cardRoutes from './routes/card.routes'; // ← YANGI 4.3: marketplace kartochkalari
import alertsRoutes from './routes/alerts.routes'; // ← YANGI: qoldiq xabarnomasi
import syncRoutes from './routes/sync.routes'; // ← YANGI: marketplace sinxronizatsiyasi
import orderRoutes from './routes/order.routes'; // ← YANGI: buyurtmalar
import competitorRoutes from './routes/competitor.routes'; // ← YANGI: raqobatchi narx kuzatuvi

import { errorHandler } from './middleware/error.middleware';
import { isPlaceholderKey } from './utils/encryption';
import { startStockAlertJob } from './jobs/stock-alerts.job';
import { startMarketplaceSyncJob } from './jobs/marketplace-sync.job';
import { startPublishQueueJob } from './jobs/publish-queue.job';
import { startCompetitorWatchJob } from './jobs/competitor-watch.job';
import { startWbFinalizeJob } from './jobs/wb-finalize.job';
import { warmupDatabase } from './utils/prisma';

const app = express();
const PORT = process.env.PORT || 4000;

// Rasmlar boshqa domendan (web) ochilishi uchun CORP cheklovini yumshatamiz
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// UPLOADTHING_TOKEN bo'lmaganda rasmlar shu papkadan tarqatiladi
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { maxAge: '7d' }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || 'https://market-flow-web-two.vercel.app',
    credentials: true,
    exposedHeaders: ['X-Organization-Id'],
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Dashboard bir nechta parallel so'rov yuboradi — 200 limit faol
  // ishlatishda 429 berib, ilova "qotib qolgan"day tuyulardi.
  max: process.env.NODE_ENV === 'production' ? 600 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'marketflow-api', version: '4.3', time: new Date().toISOString() });
});

// API hujjatlari: Swagger UI /api/docs, xom spec /api/docs.json
app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.json(openapiSpec);
});
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'MarketFlow API — hujjatlar',
    swaggerOptions: { persistAuthorization: true },
  }),
);

app.use('/api/auth', authRoutes);
app.use('/api/orgs', organizationRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/marketplaces', marketplaceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/cards', cardRoutes); // ← YANGI 4.3
app.use('/api/alerts', alertsRoutes); // ← YANGI: qoldiq xabarnomasi
app.use('/api/sync', syncRoutes); // ← YANGI: sinxronizatsiya
app.use('/api/orders', orderRoutes); // ← YANGI: buyurtmalar
app.use('/api/competitors', competitorRoutes); // ← YANGI: raqobatchi narx kuzatuvi

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use(errorHandler);

if (isPlaceholderKey()) {
  console.warn(
    "\n⚠️  ENCRYPTION_KEY hali .env.example dagi namuna qiymatda.\n" +
      '   Marketplace API kalitlari shu bilan shifrlanadi — production uchun\n' +
      "   `openssl rand -base64 32` bilan yangi kalit qo'ying.\n" +
      "   Diqqat: kalitni almashtirsangiz eski saqlangan kalitlar ochilmaydi.\n",
  );
}

// Neon uyqudan uyg'onishi birinchi so'rovni kutdirmasin — fonda ulanib olamiz
void warmupDatabase();

// Fon vazifalari: avval ma'lumot yig'iladi, keyin kam qolganlari haqida xabar
startMarketplaceSyncJob();
startStockAlertJob();
startPublishQueueJob();
startCompetitorWatchJob();
startWbFinalizeJob();

app.listen(PORT, () => {
  console.log(`🚀 MarketFlow API v4.3 (Marketplace kartochkalari) ishga tushdi: http://localhost:${PORT}`);
});

export default app;
