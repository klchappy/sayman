import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env, isProd } from './config/env';
import { logger } from './config/logger';
import { startCronJobs } from './jobs/scheduler';
import { errorHandler, notFound } from './middleware/error';
import { apiLimiter } from './middleware/rate-limit';
import { apiRouter } from './routes';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

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

app.use(express.json({ limit: '512kb' }));
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
