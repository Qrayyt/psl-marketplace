import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import path from 'path';

import { env } from './config/env';
import { redis } from './config/redis';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { successResponse } from './utils/apiResponse';
import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.routes';
import productsRoutes from './routes/products.routes';
import cartRoutes from './routes/cart.routes';
import favoritesRoutes from './routes/favorites.routes';
import addressesRoutes from './routes/addresses.routes';
import ordersRoutes from './routes/orders.routes';
import adminRoutes from './routes/admin.routes';
import onecRoutes from './routes/onec.routes';
import { csrfProtection } from './middleware/csrf';

const app = express();

// Trust proxy (Nginx перед Express)
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(cors({
  origin: env.cors.origin,
  credentials: true,
}));

// Global rate limit (Redis store)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - ioredis и rate-limit-redis типы несовместимы, но работает
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  }),
}));

// CommerceML обмен с 1С — должен идти ДО express.json(), т.к. в режиме file
// тело приходит как raw-байты (binary chunk), а не JSON.
// CSRF и JSON-parser для этих маршрутов не применяются — работает собственная
// Basic Auth + cookie-сессия в onec-auth middleware.
app.use('/api/1c', cookieParser(), onecRoutes);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// CSRF protection
app.use(csrfProtection);

// Request ID & logging
app.use(requestId);
app.use(morgan(':method :url :status :response-time ms - :req[x-request-id]'));

// Static files (uploads)
app.use('/uploads', express.static(path.resolve(env.upload.dir)));

// Swagger
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/api/health', (_req, res) => {
  successResponse(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/addresses', addressesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);

// Error handling (must be last)
app.use(errorHandler);

export default app;
