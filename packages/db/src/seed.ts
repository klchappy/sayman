/**
 * Sayman DB — ilk seed.
 *
 * 1 organization (Kılıç Holding) + 7 sektör tenant + 1 demo super admin user.
 *
 * Çalıştır:
 *   pnpm db:seed
 *
 * Idempotent: zaten varsa atlar.
 */
import { SECTOR_DEFAULT_MODULES, type Sector } from '@sayman/shared';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  organizations,
  tenants,
  userOrganizationRoles,
  users,
} from './schema';

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL gerekli — .env kontrol et.');
  process.exit(1);
}

const SECTORS_TO_SEED: Array<{ slug: string; sector: Sector; nameSuffix: string }> = [
  { slug: 'tekstil',     sector: 'tekstil',     nameSuffix: 'Tekstil' },
  { slug: 'enerji',      sector: 'enerji',      nameSuffix: 'Enerji' },
  { slug: 'insaat',      sector: 'insaat',      nameSuffix: 'İnşaat' },
  { slug: 'gayrimenkul', sector: 'gayrimenkul', nameSuffix: 'Gayrimenkul' },
  { slug: 'kisisel',     sector: 'kisisel',     nameSuffix: 'Kişisel / Aile' },
  { slug: 'sanayi',      sector: 'sanayi',      nameSuffix: 'Sanayi' },
  { slug: 'hukuk',       sector: 'hukuk',       nameSuffix: 'Hukuk' },
];

async function main() {
  const pool = new Pool({
    connectionString: url,
    ssl: url!.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  });
  const db = drizzle(pool);

  console.log('[seed] DB:', url!.replace(/:[^:@]+@/, ':***@'));

  // --- Organization: Kılıç Holding ---
  let [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, 'kilic'));

  if (!org) {
    const inserted = await db
      .insert(organizations)
      .values({
        name: 'Kılıç Holding',
        slug: 'kilic',
        plan: 'pro',
        contact_email: 'kaanklc498@gmail.com',
      })
      .returning();
    if (!inserted[0]) throw new Error('Organization insert basarisiz');
    org = inserted[0];
    console.log('[seed] + Organization:', org.name, `(${org.id})`);
  } else {
    console.log('[seed] ~ Organization mevcut:', org.name);
  }

  // --- 7 Tenant ---
  for (const def of SECTORS_TO_SEED) {
    const existing = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, def.slug));

    const existingForOrg = existing.find((t) => t.organization_id === org!.id);

    if (!existingForOrg) {
      const inserted = await db
        .insert(tenants)
        .values({
          organization_id: org!.id,
          slug: def.slug,
          name: `Kılıç ${def.nameSuffix}`,
          sector: def.sector,
          active_modules: [...SECTOR_DEFAULT_MODULES[def.sector]],
        })
        .returning();
      console.log(`[seed]   + Tenant: ${inserted[0]?.name} (${def.slug})`);
    } else {
      console.log(`[seed]   ~ Tenant mevcut: ${existingForOrg.name}`);
    }
  }

  // --- Demo super admin user ---
  let [admin] = await db.select().from(users).where(eq(users.email, 'kaanklc498@gmail.com'));
  if (!admin) {
    const inserted = await db
      .insert(users)
      .values({
        email: 'kaanklc498@gmail.com',
        full_name: 'Kaan Kılıç',
      })
      .returning();
    if (!inserted[0]) throw new Error('Admin user insert basarisiz');
    admin = inserted[0];
    console.log('[seed] + Admin user:', admin.email);

    await db.insert(userOrganizationRoles).values({
      user_id: admin.id,
      organization_id: org!.id,
      role: 'super_admin',
    });
    console.log('[seed]   + Role: super_admin @ Kılıç Holding');
  } else {
    console.log('[seed] ~ Admin user mevcut');
  }

  console.log('\n[seed] DONE ✓ — 1 organization + 7 tenant + 1 admin');
  await pool.end();
}

main().catch(async (err) => {
  console.error('[seed] HATA:', err);
  process.exit(1);
});
