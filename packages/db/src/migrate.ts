/**
 * Sayman DB — migration runner.
 *
 * Çalıştır (workspace root'ta):
 *   pnpm db:migrate
 *
 * .env'den DATABASE_URL okur; DIRECT_URL varsa onu tercih eder.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL (veya DIRECT_URL) gerekli — .env dosyasını kontrol et.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('supabase.co') ? { rejectUnauthorized: false } : false,
});

const db = drizzle(pool);

// Absolute path — Docker container'da CWD ne olursa olsun migration klasörünü
// güvenle bul. (Container start: `pnpm --filter @sayman/db exec tsx src/migrate.ts`)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.join(__dirname, 'migrations');

console.log('[migrate] Başladı —', url.replace(/:[^:@]+@/, ':***@'), 'folder:', migrationsFolder);

migrate(db, { migrationsFolder })
  .then(async () => {
    console.log('[migrate] Tamam ✓');
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[migrate] HATA:', err);
    await pool.end();
    process.exit(1);
  });
