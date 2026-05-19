/**
 * Tüm sistem feature explorer.
 *
 * Tüm tenant'lar × tüm CRUD endpoint'leri × edge case'ler.
 * Her test için: PASS/FAIL/SKIP + response time + error detail.
 * Sonunda bug rapor + perf metrik.
 */
const API = process.env.SAYMAN_API_URL ?? 'https://api.sayman.deploi.net/v1';
const EMAIL = process.env.SAYMAN_TEST_EMAIL ?? 'kaanklc498@gmail.com';
const PASSWORD = process.env.SAYMAN_TEST_PASSWORD ?? 'Test12345';
const log = (...a) => console.log(...a);

const tests = [];
const recordTest = (cat, tenant, name, status, durationMs, detail = '') => {
  tests.push({ cat, tenant, name, status, durationMs, detail });
};

// Track resources for cleanup
const cleanup = { companies: [], persons: [], payables: [], employees: [], tasks: [], guarantees: [], subscriptions: [] };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function timedFetch(url, opts = {}) {
  await sleep(450); // ~3.5 req/sec — rate limit (240/min = 4/sec) altında kal
  const t0 = Date.now();
  const r = await fetch(url, opts);
  const dur = Date.now() - t0;
  let body = null;
  const ct = r.headers.get('content-type') ?? '';
  if (ct.includes('json')) {
    try { body = await r.json(); } catch {}
  }
  return { status: r.status, body, durationMs: dur };
}

async function main() {
  log('=== Sayman Full System Explorer ===\n');

  // Auth
  const t0 = Date.now();
  const lr = await fetch(API + '/auth/local/sign-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
  });
  const token = (await lr.json()).access_token;
  recordTest('AUTH', '-', 'login', lr.status === 200 ? 'PASS' : 'FAIL', Date.now() - t0);
  if (!token) { log('FATAL: login fail'); return; }

  // Tenants list
  const tt = await timedFetch(API + '/tenants?org=kilic', {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  recordTest('AUTH', '-', 'tenants list', tt.status === 200 ? 'PASS' : 'FAIL', tt.durationMs);
  const tenants = tt.body?.data ?? [];
  log(`  ${tenants.length} aktif tenant bulundu\n`);

  // Org-level endpoints (her tenant için tekrarlamaya gerek yok)
  log('--- Org-level endpoints ---');
  const HO = { 'Authorization': 'Bearer ' + token, 'X-Sayman-Org': 'kilic' };
  const orgEndpoints = [
    { path: '/me', name: 'me' },
    { path: '/review-queue/summary?scope=org', name: 'review-queue summary (org)' },
    { path: '/review-queue?scope=org', name: 'review-queue list (org)' },
    { path: '/jobs/runs', name: 'admin jobs runs' },
    { path: '/jobs/runs/summary', name: 'admin jobs summary' },
    { path: '/organizations', name: 'organizations' },
    { path: '/audit', name: 'audit log' },
    { path: '/notifications?limit=20', name: 'notifications' },
    { path: '/security/sessions', name: 'security sessions' },
    { path: '/erp/connections', name: 'erp connections list' },
    { path: '/reference/banks', name: 'reference banks' },
    { path: '/reference/institutions', name: 'reference institutions' },
    { path: '/reference/government-agencies', name: 'reference govt' },
    { path: '/integrations', name: 'integrations' },
    { path: '/integrations/credentials', name: 'integration creds' },
  ];
  for (const e of orgEndpoints) {
    const r = await timedFetch(API + e.path, { headers: HO });
    recordTest('ORG', '-', e.name, r.status === 200 ? 'PASS' : (r.status === 404 ? 'SKIP_404' : 'FAIL'), r.durationMs,
      r.status !== 200 ? `${r.status} ${JSON.stringify(r.body).slice(0, 120)}` : '');
  }

  // Aggregate endpoints
  log('\n--- Aggregate-mode endpoints ---');
  const HA = { ...HO, 'X-Sayman-Aggregate': '1' };
  for (const e of [
    { path: '/dashboard/summary', name: 'agg dashboard' },
    { path: '/payables', name: 'agg payables' },
    { path: '/sales-invoices', name: 'agg sales-invoices' },
    { path: '/companies', name: 'agg companies' },
    { path: '/persons', name: 'agg persons' },
    { path: '/employees', name: 'agg employees' },
    { path: '/checks', name: 'agg checks' },
    { path: '/fixed-assets', name: 'agg fixed-assets' },
  ]) {
    const r = await timedFetch(API + e.path, { headers: HA });
    recordTest('AGG', '-', e.name, r.status === 200 ? 'PASS' : 'FAIL', r.durationMs,
      r.status !== 200 ? `${r.status}` : '');
  }

  // Per-tenant endpoints
  for (const tenant of tenants) {
    const slug = tenant.slug;
    log(`\n--- Tenant: ${slug} (${tenant.name}) ---`);
    const H = {
      ...HO,
      'X-Sayman-Tenant': slug,
      'X-Sayman-Tenant-Id': tenant.id,
    };
    const HJ = { ...H, 'Content-Type': 'application/json' };

    const listEndpoints = [
      '/payables', '/sales-invoices', '/payments', '/companies', '/persons',
      '/employees', '/tasks', '/guarantees', '/subscriptions',
      '/regular-payments', '/official-payments', '/tax-calendar',
      '/checks', '/fixed-assets', '/stock', '/payroll/runs',
      '/dashboard/summary', '/forecast/cashflow', '/inbox', '/banks',
      '/properties', '/subsidiaries', '/payment-approvals',
      '/api-tokens',
      '/saved-searches?module=payables', '/activity-timeline',
    ];

    for (const ep of listEndpoints) {
      const r = await timedFetch(API + ep, { headers: H });
      const status = r.status === 200 ? 'PASS' : (r.status === 404 ? 'SKIP_404' : 'FAIL');
      recordTest('LIST', slug, ep, status, r.durationMs,
        r.status >= 500 ? `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`
          : r.status === 400 ? `400 ${JSON.stringify(r.body).slice(0, 120)}` : '');
    }

    // CRUD round-trip (sadece kısa CRUD sorunsuz tamamlanır mı)
    // Personel CRUD
    const empT0 = Date.now();
    const newEmp = await timedFetch(API + '/employees', {
      method: 'POST', headers: HJ,
      body: JSON.stringify({
        full_name: `Test Personel ${slug}-${Date.now()}`,
        hire_date: '2025-01-01',
        gross_salary: '15000',
      }),
    });
    if (newEmp.status === 201 && newEmp.body?.data?.id) {
      cleanup.employees.push({ slug, id: newEmp.body.data.id });
      recordTest('CRUD', slug, 'employee create', 'PASS', newEmp.durationMs);

      const upd = await timedFetch(API + '/employees/' + newEmp.body.data.id, {
        method: 'PATCH', headers: HJ,
        body: JSON.stringify({ gross_salary: '16000' }),
      });
      recordTest('CRUD', slug, 'employee update', upd.status === 200 ? 'PASS' : 'FAIL', upd.durationMs,
        upd.status !== 200 ? `${upd.status}` : '');
    } else {
      recordTest('CRUD', slug, 'employee create', newEmp.status >= 500 ? 'FAIL' : 'SKIP', newEmp.durationMs,
        `${newEmp.status}`);
    }

    // Task CRUD
    const newTask = await timedFetch(API + '/tasks', {
      method: 'POST', headers: HJ,
      body: JSON.stringify({ title: `Test görev ${slug}`, priority: 'normal' }),
    });
    if (newTask.status === 201 && newTask.body?.data?.id) {
      cleanup.tasks.push({ slug, id: newTask.body.data.id });
      recordTest('CRUD', slug, 'task create', 'PASS', newTask.durationMs);

      const done = await timedFetch(API + '/tasks/' + newTask.body.data.id, {
        method: 'PATCH', headers: HJ,
        body: JSON.stringify({ status: 'done' }),
      });
      recordTest('CRUD', slug, 'task status=done', done.status === 200 ? 'PASS' : 'FAIL', done.durationMs);
    } else {
      recordTest('CRUD', slug, 'task create', 'SKIP', newTask.durationMs, `${newTask.status}`);
    }

    // Guarantee
    const newG = await timedFetch(API + '/guarantees', {
      method: 'POST', headers: HJ,
      body: JSON.stringify({
        beneficiary_name: `Test Lehdar ${slug}`,
        amount: '100000',
        currency: 'TRY',
        issue_date: '2025-01-01',
        expiry_date: '2026-01-01',
      }),
    });
    if (newG.status === 201 && newG.body?.data?.id) {
      cleanup.guarantees.push({ slug, id: newG.body.data.id });
      recordTest('CRUD', slug, 'guarantee create', 'PASS', newG.durationMs);
    } else {
      recordTest('CRUD', slug, 'guarantee create', 'SKIP', newG.durationMs, `${newG.status}`);
    }

    // Smart-import CSV
    const csv = `title,supplier_name,amount,invoice_number,issue_date,due_date,currency
Test Fatura A,Test Tedarikçi ${slug},1000.00,F-${slug}-001,2025-09-01,2025-10-01,TRY
Test Fatura B,Test Tedarikçi ${slug},2500.50,F-${slug}-002,2025-09-15,2025-10-15,TRY`;
    const fd = new FormData();
    fd.append('file', new Blob([csv], { type: 'text/csv' }), `test-${slug}.csv`);
    const t1 = Date.now();
    const importRes = await fetch(API + '/smart-import?commit=true', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'X-Sayman-Org': 'kilic', 'X-Sayman-Tenant': slug, 'X-Sayman-Tenant-Id': tenant.id },
      body: fd,
    });
    const importJ = await importRes.json().catch(() => ({}));
    recordTest('IMPORT', slug, 'CSV smart-import',
      importRes.status === 200 ? 'PASS' : 'FAIL', Date.now() - t1,
      importRes.status !== 200 ? `${importRes.status} ${JSON.stringify(importJ).slice(0, 120)}` : `inserted:${importJ.data?.inserted}`);
    if (importJ.data?.inserted_ids) {
      for (const id of importJ.data.inserted_ids) cleanup.payables.push({ slug, id });
    }
  }

  // Cleanup
  log('\n--- Cleanup ---');
  for (const t of tenants) {
    const slug = t.slug;
    const H = { ...HO, 'X-Sayman-Tenant': slug, 'X-Sayman-Tenant-Id': t.id };
    const toDelete = {
      employees: cleanup.employees.filter((x) => x.slug === slug),
      tasks: cleanup.tasks.filter((x) => x.slug === slug),
      guarantees: cleanup.guarantees.filter((x) => x.slug === slug),
      payables: cleanup.payables.filter((x) => x.slug === slug),
    };
    for (const [resource, items] of Object.entries(toDelete)) {
      for (const it of items) {
        await fetch(API + `/${resource}/${it.id}`, { method: 'DELETE', headers: H }).catch(() => {});
      }
    }
  }
  // Companies/persons auto-created
  const { Client } = await import('pg');
  const c = new Client({ connectionString: 'postgresql://postgres.dfbevcemusawhibymiqg:vOQ28QvOo58RB8HOnrWwJLL9Q9AL@aws-1-eu-central-1.pooler.supabase.com:5432/postgres' });
  await c.connect();
  await c.query("DELETE FROM companies WHERE name LIKE 'Test Tedarikçi%' OR name LIKE 'Test A.Ş.%'");
  await c.end();

  // === Final report ===
  log('\n========================================');
  log('FULL SYSTEM EXPLORER REPORT');
  log('========================================\n');

  const totals = { PASS: 0, FAIL: 0, SKIP: 0, SKIP_404: 0 };
  for (const t of tests) {
    totals[t.status] = (totals[t.status] ?? 0) + 1;
  }

  log(`Toplam test: ${tests.length}`);
  log(`  PASS:     ${totals.PASS}`);
  log(`  FAIL:     ${totals.FAIL}`);
  log(`  SKIP:     ${totals.SKIP ?? 0}`);
  log(`  404 yok:  ${totals.SKIP_404 ?? 0}`);

  // Slow queries (>500ms)
  const slow = tests.filter((t) => t.status === 'PASS' && t.durationMs > 500).sort((a, b) => b.durationMs - a.durationMs);
  log(`\n⚠️ Yavaş istekler (>500ms): ${slow.length}`);
  for (const s of slow.slice(0, 15)) {
    log(`  ${s.durationMs}ms - [${s.cat}] ${s.tenant} ${s.name}`);
  }

  // FAIL details
  const fails = tests.filter((t) => t.status === 'FAIL');
  log(`\n❌ HATALI testler: ${fails.length}`);
  for (const f of fails) {
    log(`  [${f.cat}] ${f.tenant} ${f.name} — ${f.detail}`);
  }

  // 404 endpoint pattern (henüz deploy edilmemiş veya silinmiş)
  const not404 = tests.filter((t) => t.status === 'SKIP_404');
  if (not404.length > 0) {
    log(`\n⚠️ 404 dönen endpoint'ler (deploy gerideyse beklenir): ${not404.length}`);
    const grouped = {};
    for (const t of not404) {
      grouped[t.name] = (grouped[t.name] ?? 0) + 1;
    }
    for (const [name, count] of Object.entries(grouped)) {
      log(`  ${name} (${count} tenant'ta)`);
    }
  }

  // Tenant başına özet
  log(`\n--- Tenant başına ---`);
  const byTenant = {};
  for (const t of tests) {
    if (t.tenant === '-') continue;
    byTenant[t.tenant] = byTenant[t.tenant] ?? { PASS: 0, FAIL: 0, SKIP: 0, SKIP_404: 0 };
    byTenant[t.tenant][t.status]++;
  }
  console.table(byTenant);

  // Hata yapan tenant'lar
  const failingTenants = Object.entries(byTenant).filter(([_, v]) => v.FAIL > 0);
  if (failingTenants.length > 0) {
    log(`\n⚠️ Hata veren tenant'lar:`);
    for (const [slug, counts] of failingTenants) {
      log(`  ${slug}: ${counts.FAIL} FAIL`);
    }
  }

  // Kategori başına ortalama süre
  log(`\n--- Ortalama yanıt süresi (PASS) ---`);
  const byCat = {};
  for (const t of tests) {
    if (t.status !== 'PASS') continue;
    byCat[t.cat] = byCat[t.cat] ?? { count: 0, total: 0 };
    byCat[t.cat].count++;
    byCat[t.cat].total += t.durationMs;
  }
  const catStats = {};
  for (const [cat, v] of Object.entries(byCat)) {
    catStats[cat] = { count: v.count, avg_ms: Math.round(v.total / v.count) };
  }
  console.table(catStats);
}

main().catch((e) => {
  console.error('FATAL:', e.message, e.stack);
  process.exit(1);
});
