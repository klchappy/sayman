import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 240, // 4 req/sn ortalama
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});
