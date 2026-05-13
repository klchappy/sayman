import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// .env workspace root'ta — buradan iki dizin yukarı (apps/api/src/config → ../../../../.env)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4300),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL gerekli'),
  CLIENT_URL: z.string().url().default('http://localhost:5278'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET en az 16 karakter olmalı'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export const env = envSchema.parse(process.env);

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
