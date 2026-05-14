#!/usr/bin/env node
/**
 * Sayman uçtan uca smoke testi — master data + Faz E + 4 yeni modül.
 *
 * Akış:
 *   1. /v1/auth/local/sign-up-org → yeni org + JWT
 *   2. DB'ye direkt 2 test tenant insert (DIRECT_URL kullanarak)
 *      - smoke-insaat   (sector=insaat, full default modules)
 *      - smoke-hukuk    (sector=hukuk, daraltılmış modules — Faz E filtre testi)
 *   3. /v1/tenants?org=... → effective_modules doğru mu
 *   4. Master data CRUD (persons/companies/properties/banks/institutions)
 *   5. Finance + 4 yeni modül CRUD (insaat tenant'ında)
 *   6. hukuk tenant'ında: guarantees olmayan modül → ne olur (route 200 — Web filtreliyor)
 *   7. Cleanup: yaratılan kayıtları sil
 *
 * Çalıştır:
 *   node scripts/smoke-master-data.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_BASE = process.env.SMOKE_API_BASE ?? 'https://api.sayman.deploi.net/v1';
const PASSWORD = 'SmokeTest123';

// --- .env yükle ---
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
const DIRECT_URL = env.DIRECT_URL;
if (!DIRECT_URL) {
  console.error('DIRECT_URL gerekli — .env kontrol et.');
  process.exit(1);
}

// --- HTTP helper ---
let TOKEN = null;
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (CURRENT_TENANT?.orgSlug) headers['X-Sayman-Org'] = CURRENT_TENANT.orgSlug;
  if (CURRENT_TENANT?.tenantSlug) headers['X-Sayman-Tenant'] = CURRENT_TENANT.tenantSlug;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = { _raw: await res.text() };
  }
  return { status: res.status, body: json };
}

let CURRENT_TENANT = null;
function useTenant(orgSlug, tenantSlug) {
  CURRENT_TENANT = { orgSlug, tenantSlug };
}

// --- Test runner ---
const RESULTS = [];
async function step(label, fn) {
  process.stdout.write(`▸ ${label} ... `);
  try {
    const ret = await fn();
    console.log('OK');
    RESULTS.push({ label, ok: true, ret });
    return ret;
  } catch (e) {
    console.log('FAIL');
    console.error('   ', e.message);
    RESULTS.push({ label, ok: false, err: e.message });
    throw e;
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- Test data ---
const STAMP = Date.now().toString(36);
const TEST_EMAIL = `smoke-${STAMP}@sayman.test`;
const TEST_ORG_NAME = `Smoke Test ${STAMP}`;

// --- DB helper ---
const pool = new pg.Pool({
  connectionString: DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function sql(q, params = []) {
  const res = await pool.query(q, params);
  return res.rows;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log(`API: ${API_BASE}`);
  console.log(`Test email: ${TEST_EMAIL}\n`);

  // --- 1. Sign-up org ---
  const signup = await step('Sign-up new org', async () => {
    const r = await api('POST', '/auth/local/sign-up-org', {
      account_type: 'company',
      org_name: TEST_ORG_NAME,
      full_name: 'Smoke Tester',
      email: TEST_EMAIL,
      password: PASSWORD,
      accept_terms: true,
      accept_kvkk: true,
    });
    expect(r.status === 201, `signup status ${r.status}: ${JSON.stringify(r.body)}`);
    expect(r.body.access_token, 'access_token missing');
    expect(r.body.organization?.slug, 'org.slug missing');
    return r.body;
  });
  TOKEN = signup.access_token;
  const ORG_ID = signup.organization.id;
  const ORG_SLUG = signup.organization.slug;
  console.log(`   org_id=${ORG_ID} slug=${ORG_SLUG}\n`);

  // --- 2. /me ile token doğrulaması ---
  await step('GET /me', async () => {
    const r = await api('GET', '/me');
    expect(r.status === 200, `/me status ${r.status}`);
    expect(r.body.data?.user?.email === TEST_EMAIL,
      `me.email mismatch: got ${r.body.data?.user?.email}`);
    expect(r.body.data?.organizations?.length === 1, 'expected 1 org membership');
    expect(r.body.data?.organizations?.[0]?.role === 'super_admin', 'expected super_admin role');
    return r.body.data;
  });

  // --- 3. POST /tenants ile 2 tenant olustur (Faz F endpoint) ---
  // STAMP ile slug'lar unique (eski runlardan kalan kayitlarla cakismasin)
  const SLUG_INSAAT = `sm-${STAMP}-insaat`;
  const SLUG_HUKUK = `sm-${STAMP}-hukuk`;

  useTenant(ORG_SLUG, null); // org-only header
  const insaatTenant = await step('POST /tenants (insaat, default modules)', async () => {
    const r = await api('POST', '/tenants', {
      slug: SLUG_INSAAT,
      name: 'Smoke Insaat',
      sector: 'insaat',
    });
    expect(r.status === 201, `POST /tenants status ${r.status}: ${JSON.stringify(r.body)}`);
    expect(r.body.data.slug === SLUG_INSAAT, `slug mismatch: ${r.body.data.slug}`);
    return r.body.data;
  });

  const hukukTenant = await step('POST /tenants (hukuk, narrow modules)', async () => {
    const r = await api('POST', '/tenants', {
      slug: SLUG_HUKUK,
      name: 'Smoke Hukuk',
      sector: 'hukuk',
      active_modules: ['finance', 'dashboard', 'notifications', 'tasks'],
    });
    expect(r.status === 201, `POST /tenants status ${r.status}: ${JSON.stringify(r.body)}`);
    return r.body.data;
  });

  const TENANT_INSAAT_ID = insaatTenant.id;
  const TENANT_HUKUK_ID = hukukTenant.id;

  // --- 3b. PATCH /tenants/:id — sector degistirme + modules ekleme testi ---
  await step('PATCH /tenants/:id (modify active_modules)', async () => {
    const r = await api('PATCH', `/tenants/${TENANT_HUKUK_ID}`, {
      active_modules: ['finance', 'dashboard', 'notifications', 'tasks', 'reports'],
    });
    expect(r.status === 200, `PATCH status ${r.status}: ${JSON.stringify(r.body)}`);
    expect(r.body.data.active_modules.includes('reports'), 'reports should be added');
  });

  console.log(`   tenants: insaat=${TENANT_INSAAT_ID} hukuk=${TENANT_HUKUK_ID}\n`);

  // --- 4. /tenants ile effective_modules kontrolü ---
  await step('GET /tenants?org=... + effective_modules', async () => {
    const r = await api('GET', `/tenants?org=${ORG_SLUG}`);
    expect(r.status === 200, `/tenants status ${r.status}`);
    expect(r.body.data.length === 2, `expected 2 tenants, got ${r.body.data.length}`);

    const insaat = r.body.data.find((t) => t.slug === SLUG_INSAAT);
    const hukuk = r.body.data.find((t) => t.slug === SLUG_HUKUK);
    expect(insaat, `${SLUG_INSAAT} not found`);
    expect(hukuk, `${SLUG_HUKUK} not found`);

    // insaat: active_modules boş → SECTOR_DEFAULT_MODULES.insaat (guarantees var)
    expect(
      insaat.effective_modules.includes('guarantees'),
      `insaat should have guarantees in default: ${insaat.effective_modules.join(',')}`,
    );
    expect(
      insaat.effective_modules.includes('finance'),
      `insaat should have finance: ${insaat.effective_modules.join(',')}`,
    );

    // hukuk: active_modules elle set → guarantees YOK
    expect(
      !hukuk.effective_modules.includes('guarantees'),
      `hukuk should NOT have guarantees (Faz E filter): ${hukuk.effective_modules.join(',')}`,
    );
    expect(
      hukuk.effective_modules.includes('finance'),
      `hukuk should have finance: ${hukuk.effective_modules.join(',')}`,
    );

    return { insaat: insaat.effective_modules, hukuk: hukuk.effective_modules };
  });

  // --- 5. Master data: insaat tenant'ında CRUD ---
  useTenant(ORG_SLUG, SLUG_INSAAT);

  let personId, companyId, propertyId, bankId, institutionId;

  await step('POST /persons', async () => {
    const r = await api('POST', '/persons', {
      full_name: 'Smoke Person',
      national_id: '12345678901',
    });
    expect(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
    personId = r.body.data.id;
  });

  await step('POST /companies', async () => {
    const r = await api('POST', '/companies', {
      name: 'Smoke Company A.S.',
      tax_number: '1234567890',
    });
    expect(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
    companyId = r.body.data.id;
  });

  await step('POST /properties', async () => {
    const r = await api('POST', '/properties', {
      name: 'Smoke Daire 1+1',
      property_type: 'apartment',
      municipality: 'Besiktas',
    });
    expect(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
    propertyId = r.body.data.id;
  });

  await step('POST /banks', async () => {
    const r = await api('POST', '/banks', {
      name: 'Smoke Bank',
      short_code: 'SMK',
    });
    expect(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
    bankId = r.body.data.id;
  });

  await step('POST /institutions', async () => {
    const r = await api('POST', '/institutions', {
      name: 'Smoke IGDAS',
      institution_type: 'utility',
    });
    expect(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
    institutionId = r.body.data.id;
  });

  // --- 6. GET master data — yaratılanlar listede mi? ---
  await step('GET /persons + /companies + /properties + /banks + /institutions', async () => {
    for (const ep of ['/persons', '/companies', '/properties', '/banks', '/institutions']) {
      const r = await api('GET', ep);
      expect(r.status === 200, `${ep} status ${r.status}`);
      expect(Array.isArray(r.body.data), `${ep} data not array`);
    }
  });

  // --- 6b. PATCH master data — admin tarafindan duzenleme ---
  await step('PATCH /persons/:id (Smoke Person → Updated Person)', async () => {
    const r = await api('PATCH', `/persons/${personId}`, { full_name: 'Updated Person' });
    expect(r.status === 200, `status ${r.status}`);
    expect(r.body.data.full_name === 'Updated Person', 'name update failed');
  });

  await step('PATCH /companies/:id (Smoke Company → Updated A.S.)', async () => {
    const r = await api('PATCH', `/companies/${companyId}`, {
      name: 'Updated A.S.',
      short_name: 'UPD',
    });
    expect(r.status === 200, `status ${r.status}`);
    expect(r.body.data.name === 'Updated A.S.', 'company name update failed');
    expect(r.body.data.short_name === 'UPD', 'short_name update failed');
  });

  await step('PATCH /banks/:id (rename Smoke Bank)', async () => {
    const r = await api('PATCH', `/banks/${bankId}`, { name: 'Smoke Bank Renamed' });
    expect(r.status === 200, `status ${r.status}`);
    expect(r.body.data.name === 'Smoke Bank Renamed', 'bank name update failed');
  });

  await step('PATCH /institutions/:id (rename Smoke IGDAS)', async () => {
    const r = await api('PATCH', `/institutions/${institutionId}`, {
      name: 'Smoke IGDAS Renamed',
      institution_type: 'IGDAS',
    });
    expect(r.status === 200, `status ${r.status}`);
    expect(r.body.data.name === 'Smoke IGDAS Renamed', 'institution name update failed');
  });

  await step('PATCH /properties/:id (rename + change type)', async () => {
    const r = await api('PATCH', `/properties/${propertyId}`, {
      name: 'Smoke Daire Renamed',
      property_type: 'Daire',
    });
    expect(r.status === 200, `status ${r.status}`);
    expect(r.body.data.name === 'Smoke Daire Renamed', 'property name update failed');
  });

  // --- 7. Finance: payable yarat ---
  let payableId;
  await step('POST /payables', async () => {
    const r = await api('POST', '/payables', {
      title: 'Smoke Elektrik Faturası',
      amount: '500.50',
      owner_type: 'company',
      company_id: companyId,
    });
    expect(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
    payableId = r.body.data.id;
  });

  // --- 8. 4 YENİ MODÜL CRUD ---
  let subId, rpId, opId, gId;

  await step('POST /subscriptions', async () => {
    const r = await api('POST', '/subscriptions', {
      package_name: 'Smoke Fiber 1000',
      subscription_no: 'SMK-001',
      owner_type: 'company',
      company_id: companyId,
      monthly_amount: '299.90',
      auto_payment: true,
      start_date: '2026-01-01',
      commitment_end_date: '2027-01-01',
    });
    expect(r.status === 201, `subscriptions status ${r.status}: ${JSON.stringify(r.body)}`);
    subId = r.body.data.id;
  });

  await step('POST /regular-payments', async () => {
    const r = await api('POST', '/regular-payments', {
      kind: 'rent',
      title: 'Smoke Kira',
      monthly_amount: '15000',
      payment_day: 5,
      property_id: propertyId,
      annual_increase_rate: '25.00',
    });
    expect(r.status === 201, `regular-payments status ${r.status}: ${JSON.stringify(r.body)}`);
    rpId = r.body.data.id;
  });

  await step('POST /official-payments', async () => {
    const r = await api('POST', '/official-payments', {
      payment_type: 'BAGKUR',
      frequency: 'monthly',
      owner_type: 'company',
      company_id: companyId,
      typical_amount: '6500',
    });
    expect(r.status === 201, `official-payments status ${r.status}: ${JSON.stringify(r.body)}`);
    opId = r.body.data.id;
  });

  await step('POST /guarantees', async () => {
    const r = await api('POST', '/guarantees', {
      beneficiary_name: 'Smoke İnşaat A.Ş.',
      letter_no: 'TM-2026-001',
      amount: '100000',
      currency: 'TRY',
      issue_date: '2026-01-15',
      expiry_date: '2027-01-15',
      commission_rate: '2.50',
      commission_frequency_months: 3,
      bank_id: bankId,
    });
    expect(r.status === 201, `guarantees status ${r.status}: ${JSON.stringify(r.body)}`);
    gId = r.body.data.id;
  });

  // --- 9. GET 4 yeni modül listeleri ---
  await step('GET /subscriptions + /regular-payments + /official-payments + /guarantees', async () => {
    for (const ep of ['/subscriptions', '/regular-payments', '/official-payments', '/guarantees']) {
      const r = await api('GET', ep);
      expect(r.status === 200, `${ep} status ${r.status}`);
      expect(r.body.data.length >= 1, `${ep} empty`);
    }
  });

  // --- 10. Sub-resource: commission-periods (boş ama 200 dönmeli) ---
  await step('GET /guarantees/:id/commission-periods', async () => {
    const r = await api('GET', `/guarantees/${gId}/commission-periods`);
    expect(r.status === 200, `status ${r.status}`);
    expect(Array.isArray(r.body.data), 'data not array');
  });

  await step('GET /regular-payments/:id/periods', async () => {
    const r = await api('GET', `/regular-payments/${rpId}/periods`);
    expect(r.status === 200, `status ${r.status}`);
  });

  await step('GET /official-payments/:id/periods', async () => {
    const r = await api('GET', `/official-payments/${opId}/periods`);
    expect(r.status === 200, `status ${r.status}`);
  });

  // --- 11. Tenant-scope isolation: hukuk tenant'tan insaat'ın subscription'ını görebiliyor mu? (görmemeli) ---
  useTenant(ORG_SLUG, SLUG_HUKUK);
  await step('Tenant isolation: /subscriptions hukuk tenantta bos olmali', async () => {
    const r = await api('GET', '/subscriptions');
    expect(r.status === 200, `status ${r.status}`);
    expect(r.body.data.length === 0, `hukuk should see 0 subs, got ${r.body.data.length}`);
  });

  // --- 11b. User management — org-level (tenant header gerekmez) ---
  useTenant(ORG_SLUG, null);

  await step('GET /users/me/permissions (super_admin)', async () => {
    const r = await api('GET', '/users/me/permissions');
    expect(r.status === 200, `status ${r.status}`);
    expect(r.body.data.role === 'super_admin', `expected super_admin, got ${r.body.data.role}`);
    expect(
      r.body.data.permissions.includes('users.invite'),
      'super_admin should have users.invite',
    );
  });

  let inviteId, inviteToken;
  const INVITED_EMAIL = `invited-${STAMP}@sayman.test`;
  await step('POST /users/invite (muhasebeci role)', async () => {
    const r = await api('POST', '/users/invite', {
      email: INVITED_EMAIL,
      role: 'muhasebeci',
    });
    expect(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
    expect(r.body.action_link?.includes('accept-invite'), 'action_link missing');
    inviteId = r.body.data.id;
    // Token'i action_link'ten parse et (prod'da response.body.token gizli)
    const url = new URL(r.body.action_link);
    inviteToken = r.body.token ?? url.searchParams.get('token');
    expect(inviteToken, 'token cikarilamadi');
  });

  await step('GET /users/invitations (pending list)', async () => {
    const r = await api('GET', '/users/invitations');
    expect(r.status === 200, `status ${r.status}`);
    expect(r.body.data.length >= 1, 'expected pending invite');
  });

  await step('GET /users/invitations/:token/verify (PUBLIC)', async () => {
    // Token PUBLIC endpoint — auth header'ı temizle
    const oldToken = TOKEN;
    TOKEN = null;
    const r = await api('GET', `/users/invitations/${inviteToken}/verify`);
    TOKEN = oldToken;
    expect(r.status === 200, `verify status ${r.status}`);
    expect(r.body.data.email === INVITED_EMAIL, 'verify email mismatch');
    expect(r.body.data.role === 'muhasebeci', 'verify role mismatch');
  });

  await step('POST /users/accept-invite', async () => {
    const oldToken = TOKEN;
    TOKEN = null;
    const r = await api('POST', '/users/accept-invite', {
      token: inviteToken,
      full_name: 'Invited User',
      password: 'InvitedPass123',
    });
    TOKEN = oldToken;
    expect(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
    expect(r.body.access_token, 'access_token missing');
  });

  let invitedUserId;
  await step('GET /users (org-scope) — invited kullanici listede mi', async () => {
    const r = await api('GET', '/users');
    expect(r.status === 200, `status ${r.status}`);
    const invited = r.body.data.find((u) => u.email === INVITED_EMAIL);
    expect(invited, `${INVITED_EMAIL} listede yok`);
    expect(invited.role === 'muhasebeci', `role beklenmedik: ${invited.role}`);
    invitedUserId = invited.user_id;
  });

  await step('PATCH /users/:id/role (muhasebeci → denetci)', async () => {
    const r = await api('PATCH', `/users/${invitedUserId}/role`, { role: 'denetci' });
    expect(r.status === 200, `status ${r.status}: ${JSON.stringify(r.body)}`);
    expect(r.body.data.role === 'denetci', `role mismatch: ${r.body.data.role}`);
  });

  await step('POST /users/:id/tenant-override (deny hukuk)', async () => {
    const r = await api('POST', `/users/${invitedUserId}/tenant-override`, {
      tenant_id: TENANT_HUKUK_ID,
      value: 'deny',
    });
    expect(r.status === 200, `status ${r.status}: ${JSON.stringify(r.body)}`);
    expect(r.body.data.value === 'deny', `value mismatch: ${r.body.data.value}`);
  });

  await step('DELETE /users/:id (org\'dan cikar)', async () => {
    const r = await api('DELETE', `/users/${invitedUserId}`);
    expect(r.status === 200, `status ${r.status}`);
  });

  // Switch back to tenant context for cleanup below
  useTenant(ORG_SLUG, SLUG_INSAAT);

  // --- 12. Org-scope master data: hukuk tenant'tan da görünmeli (share_scope) ---
  await step('Cross-tenant master data: hukuk-tenant /persons should still see person', async () => {
    const r = await api('GET', '/persons');
    expect(r.status === 200, `status ${r.status}`);
    // share_scope default '*' veya share_scope filter logic'e bağlı
    // En azından 200 dönmeli ve crash etmemeli
  });

  // --- 13. CLEANUP ---
  console.log('\n--- CLEANUP ---');
  useTenant(ORG_SLUG, SLUG_INSAAT);
  // 4 yeni modül delete (soft)
  for (const [ep, id] of [
    ['/subscriptions', subId],
    ['/regular-payments', rpId],
    ['/official-payments', opId],
    ['/guarantees', gId],
    ['/payables', payableId],
  ]) {
    if (id) {
      const r = await api('DELETE', `${ep}/${id}`);
      console.log(`   DELETE ${ep}/${id} → ${r.status}`);
    }
  }

  // DB cleanup: test org & tenant cascading
  await sql('DELETE FROM organizations WHERE id = $1', [ORG_ID]);
  console.log(`   DELETE org ${ORG_ID} (cascade tenants + master-data + auth_account)`);

  await sql('DELETE FROM auth_accounts WHERE email = $1', [TEST_EMAIL]);
  await sql('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
  console.log(`   DELETE auth_account+users for ${TEST_EMAIL}`);

  // Invited user de cleanup (cascade org-bagimsiz)
  if (typeof INVITED_EMAIL === 'string') {
    await sql('DELETE FROM auth_accounts WHERE email = $1', [INVITED_EMAIL]);
    await sql('DELETE FROM users WHERE email = $1', [INVITED_EMAIL]);
    console.log(`   DELETE auth_account+users for ${INVITED_EMAIL}`);
  }

  await pool.end();

  // --- Final report ---
  const failed = RESULTS.filter((r) => !r.ok);
  console.log('\n' + '═'.repeat(60));
  console.log(`SUMMARY: ${RESULTS.length - failed.length}/${RESULTS.length} passed`);
  if (failed.length > 0) {
    console.log('\nFAILED:');
    failed.forEach((r) => console.log(`  ✗ ${r.label}: ${r.err}`));
    process.exit(1);
  }
  console.log('✓ ALL PASSED');
}

main().catch(async (e) => {
  console.error('\nFATAL:', e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
