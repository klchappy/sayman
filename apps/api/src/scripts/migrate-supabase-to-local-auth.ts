/**
 * One-time migration: mevcut Supabase auth.users → auth_accounts (local).
 *
 * Bu script'i production'da BIR KERE çalıştır. Mevcut user'lar için:
 *   1. auth_accounts satırı oluştur (email + full_name, password_hash boş placeholder)
 *   2. public.users.auth_account_id = yeni auth_accounts.id
 *   3. Kullanıcı forgot password ile kendi şifresini set etsin (password_hash güncellenir)
 *
 * Çalıştır:
 *   pnpm --filter @sayman/api exec tsx src/scripts/migrate-supabase-to-local-auth.ts
 *
 * Idempotent — auth_accounts.email zaten varsa atlanır.
 */
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { authAccounts, getDb, users } from '@sayman/db';
import { env, isConfigured } from '../config/env';

const PLACEHOLDER_HASH = '$2a$10$PLACEHOLDER_MUST_RESET_VIA_FORGOT_PASSWORD/0000000000000000000';

async function main() {
  if (!isConfigured.supabase) {
    console.error('Supabase yapılandırılmamış — geçiş yapılamaz');
    process.exit(1);
  }

  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Supabase auth.users → auth_accounts migration başlıyor...');

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error || !data?.users) {
    console.error('Supabase listUsers hatası:', error);
    process.exit(1);
  }

  console.log(`${data.users.length} Supabase user bulundu.`);
  const db = getDb();
  let created = 0;
  let skipped = 0;
  let linked = 0;

  for (const sbUser of data.users) {
    if (!sbUser.email) {
      console.log(`  ! ${sbUser.id} — email yok, atlandı`);
      continue;
    }

    const email = sbUser.email.toLowerCase();
    const fullName = (sbUser.user_metadata?.['full_name'] as string | undefined) ?? email;

    // 1) auth_accounts: yoksa oluştur
    let accountId: string | null = null;
    const [existing] = await db.select().from(authAccounts).where(eq(authAccounts.email, email));
    if (existing) {
      accountId = existing.id;
      skipped++;
      console.log(`  ~ ${email} — auth_accounts'da var (${accountId.slice(0, 8)}...)`);
    } else {
      const [newAccount] = await db
        .insert(authAccounts)
        .values({
          email,
          full_name: fullName,
          password_hash: PLACEHOLDER_HASH,
        })
        .returning();
      if (!newAccount) {
        console.error(`  ✗ ${email} — insert başarısız`);
        continue;
      }
      accountId = newAccount.id;
      created++;
      console.log(`  + ${email} → auth_accounts (${accountId.slice(0, 8)}...)`);
    }

    // 2) public.users.auth_account_id güncelle
    if (accountId) {
      const result = await db
        .update(users)
        .set({ auth_account_id: accountId, updated_at: new Date() })
        .where(eq(users.auth_user_id, sbUser.id))
        .returning({ id: users.id });
      if (result.length > 0) {
        linked++;
        console.log(`    ↳ users.auth_account_id bağlandı (user ${result[0]!.id.slice(0, 8)}...)`);
      }
    }
  }

  console.log(`\nÖzet: ${created} yeni auth_account, ${skipped} mevcut, ${linked} users bağlantısı`);
  console.log(`\nÖnemli: Local password kullanmak için herkes /auth/forgot-password ile yeni şifre belirler.`);
  console.log(`Mevcut Supabase Auth login akışı çalışmaya devam eder (hibrit mode).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration hatası:', err);
  process.exit(1);
});
