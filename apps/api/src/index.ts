import 'dotenv/config';
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
import importRoutes from './routes/import.routes'; // ← YANGI 4.2

import { errorHandler } from './middleware/error.middleware';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
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
  res.json({ status: 'ok', service: 'marketflow-api', version: '4.2', time: new Date().toISOString() });
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
app.use('/api/import', importRoutes); // ← YANGI 4.2

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 MarketFlow API v4.2 (Bulk Import) ishga tushdi: http://localhost:${PORT}`);
});

export default app;
