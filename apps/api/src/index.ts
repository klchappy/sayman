import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env, isProd } from './config/env';
import { logger } from './config/logger';
import { initSentry } from './lib/sentry';
import { startCronJobs } from './jobs/scheduler';

// Sentry'i en başta init et (diğer importlar instrumentation öncesi yüklensin diye)
initSentry();
import { errorHandler, notFound } from './middleware/error';
import { apiLimiter } from './middleware/rate-limit';
import { apiRouter } from './routes';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// API JSON döner — restrictive CSP (sayfa render etmiyoruz).
// Swagger UI lokal kullanılırsa scriptSrc'i genişlet.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'none'"],
        connectSrc: ["'self'"],
        // Swagger UI için inline gerekirse:
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    // HSTS: 2 yıl + subdomains + preload (production'da gözlemlenmiş)
    strictTransportSecurity: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// Permissions-Policy — API JSON döner, tarayıcı feature'larına ihtiyaç yok.
// Üçüncü taraf iframe enjekte edilse bile kamera/mikro/jeolokasyon erişemesin.
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
  );
  next();
});

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const trimmed = origin.replace(/\/$/, '');
      const clientUrl = env.CLIENT_URL.replace(/\/$/, '');
      if (
        trimmed === clientUrl ||
        trimmed.startsWith('http://localhost:') ||
        // *.localhost subdomain (Sayman dev: tekstil.kilic.localhost:5274)
        /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.localhost(:\d+)?$/.test(trimmed) ||
        // Prod: *.sayman.deploi.net
        /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.sayman\.deploi\.net$/.test(trimmed)
      ) {
        cb(null, true);
      } else {
        cb(new Error(`CORS engellendi: ${origin}`));
      }
    },
    credentials: true,
  }),
);

// Raw body captured for HMAC signature verification (whatsapp inbound).
// Meta WhatsApp Business API imzayı raw bytes üzerinden hesaplar; JSON re-serialize
// edilirse HMAC eşleşmez. Bu yüzden parse SIRASINDA buf'u sakla.
app.use(
  express.json({
    limit: '512kb',
    verify: (req, _res, buf) => {
      if (req.url?.includes('/whatsapp/inbound')) {
        (req as unknown as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      }
    },
  }),
);
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/v1/health' },
  }),
);

app.use('/v1', apiLimiter);
app.use('/v1', apiRouter);

app.get('/', (_req, res) => {
  res.json({
    name: 'Sayman API',
    version: '0.1.0',
    base: '/v1',
    health: '/v1/health',
  });
});

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `🪙 Sayman API ${isProd ? 'production' : 'dev'} → http://localhost:${env.PORT}`,
  );
  // Cron scheduler boot (Europe/Istanbul TZ)
  startCronJobs();
});
