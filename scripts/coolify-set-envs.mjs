#!/usr/bin/env node
/**
 * Coolify env setter — Sayman deploy.
 *
 * Bulk endpoint kullanır: PATCH /api/v1/applications/{uuid}/envs/bulk
 * Default `is_buildtime=true, is_runtime=true` — Vite VITE_ env'leri için ideal.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COOLIFY_URL = 'https://coolify.deploi.net';
const COOLIFY_TOKEN = '5|650S5qWM3oruHBy54CxK25KiWbjFi6YqYlZ3gBT4dcb54316';
const API_UUID = 'xdy5msb04a8pq8iyz21n0lnf';
const WEB_UUID = 'h13pbw7v6ffepm2ak0y2msmp';
const PROD_CLIENT_URL = 'https://sayman.deploi.net';
const PROD_VITE_API_URL = 'https://api.sayman.deploi.net/v1';

const envFile = readFileSync(path.join(ROOT, '.env'), 'utf8');
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

async function bulkEnvs(appUuid, envObj) {
  const data = Object.entries(envObj)
    .filter(([, v]) => v != null && v !== '')
    .map(([key, value]) => ({ key, value }));

  const res = await fetch(`${COOLIFY_URL}/api/v1/applications/${appUuid}/envs/bulk`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${COOLIFY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.log(`✗ FAIL ${res.status}:`, JSON.stringify(body).slice(0, 300));
    return false;
  }
  for (const item of body) {
    console.log(`  + ${item.key}`);
  }
  return true;
}

console.log('=== sayman-api env (13 değişken) ===');
await bulkEnvs(API_UUID, {
  NODE_ENV: 'production',
  PORT: '4300',
  CLIENT_URL: PROD_CLIENT_URL,
  LOG_LEVEL: 'info',
  DATABASE_URL: env.DATABASE_URL,
  DIRECT_URL: env.DIRECT_URL,
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: env.JWT_SECRET,
  RESEND_API_KEY: env.RESEND_API_KEY,
  EMAIL_FROM: env.EMAIL_FROM,
  PUBLIC_WEB_URL: env.PUBLIC_WEB_URL ?? PROD_CLIENT_URL,
});

console.log('\n=== sayman-web build args (3 değişken) ===');
await bulkEnvs(WEB_UUID, {
  VITE_API_URL: PROD_VITE_API_URL,
  VITE_SUPABASE_URL: env.SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
});

console.log('\nDONE');
