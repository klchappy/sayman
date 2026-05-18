// Sayman canlı API E2E test runner
const API = process.env.SAYMAN_API_URL ?? 'https://api.sayman.deploi.net/v1';
const EMAIL = process.env.SAYMAN_TEST_EMAIL ?? 'kaanklc498@gmail.com';
const PASSWORD = process.env.SAYMAN_TEST_PASSWORD ?? 'Test12345';
const log = (...a) => console.log(...a);
const results = [];
const pass = (id, name, ok, note = '') => {
  results.push({ id, name, status: ok ? 'PASS' : 'FAIL', note });
  log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name}${note ? ' - ' + note : ''}`);
};

async function main() {
  // ===== Auth =====
  const lr = await fetch(API + '/auth/local/sign-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
  });
  const token = (await lr.json()).access_token;
  pass('AUTH', 'login', lr.status === 200 && !!token);

  const tenRes = await fetch(API + '/tenants?org=kilic', {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  const ten = await tenRes.json();
  const tekstil = ten.data.find((t) => t.slug === 'tekstil');
  const sanayi = ten.data.find((t) => t.slug === 'sanayi');
  pass('CTX', 'tenants list', !!tekstil && !!sanayi);

  const H = (org, slug, tid, extra = {}) => ({
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    ...(org ? { 'X-Sayman-Org': org } : {}),
    ...(slug ? { 'X-Sayman-Tenant': slug } : {}),
    ...(tid ? { 'X-Sayman-Tenant-Id': tid } : {}),
    ...extra,
  });
  const Htek = () => H('kilic', 'tekstil', tekstil.id);

  // ===== Smart Import CSV =====
  log('\n=== Smart Import (CSV) ===');
  const csv = [
    'title,supplier_name,amount,invoice_number,issue_date,due_date,currency',
    'Test Fatura 1,Test Tedarikci AS,1234.56,F-001,2026-05-01,2026-05-31,TRY',
    'Test Fatura 2,Diger Tedarikci Ltd,5678.90,F-002,2026-05-02,2026-06-01,TRY',
    'Test Fatura 3,Ucuncu Sirket,999.00,F-003,2026-05-03,2026-06-02,TRY',
  ].join('\n');

  const fd = new FormData();
  fd.append('file', new Blob([csv], { type: 'text/csv' }), 'test-faturalar.csv');

  const upload = await fetch(API + '/smart-import?commit=true', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-Sayman-Org': 'kilic',
      'X-Sayman-Tenant': 'tekstil',
      'X-Sayman-Tenant-Id': tekstil.id,
    },
    body: fd,
  });
  const uj = await upload.json();
  log('Upload:', upload.status, JSON.stringify(uj).slice(0, 300));
  pass('IMPORT', 'CSV smart-import', upload.status === 200 || upload.status === 201);

  // ===== Review queue summary =====
  const sum = await fetch(API + '/review-queue/summary', { headers: Htek() }).then((r) => r.json());
  log('Review queue summary:', JSON.stringify(sum.data));
  pass('REVIEW-SUM', 'summary > 0 after import', (sum.data?.payables || 0) > 0);

  // ===== Review queue listing =====
  const rq = await fetch(API + '/review-queue', { headers: Htek() }).then((r) => r.json());
  log('Review queue: payables=' + (rq.data?.payables?.length ?? 0));
  pass('REVIEW-LIST', 'review-queue list', !!rq.data);

  // ===== Approve first =====
  if (rq.data?.payables?.length > 0) {
    const p1 = rq.data.payables[0];
    const ap = await fetch(API + '/review-queue/payable/' + p1.id + '/approve', {
      method: 'POST', headers: Htek(),
    });
    pass('APPROVE', 'approve payable', ap.status === 200 || ap.status === 204);

    // Liste'de gorunsun
    const pay = await fetch(API + '/payables', { headers: Htek() }).then((r) => r.json());
    const found = pay.data?.find((p) => p.id === p1.id);
    pass('VISIBLE', 'approved visible in payables', !!found, pay.data ? '(' + pay.data.length + ' kayit)' : 'bos');
  }

  // ===== Reject second =====
  if (rq.data?.payables?.length > 1) {
    const p2 = rq.data.payables[1];
    const rj = await fetch(API + '/review-queue/payable/' + p2.id, {
      method: 'DELETE', headers: Htek(),
    });
    pass('REJECT', 'reject payable (hard delete)', rj.status === 200 || rj.status === 204);
  }

  // ===== Summary updated =====
  const sum2 = await fetch(API + '/review-queue/summary', { headers: Htek() }).then((r) => r.json());
  log('Updated summary:', JSON.stringify(sum2.data));
  pass('REVIEW-UPDATE', 'summary updated after mutations',
    (sum2.data?.payables ?? 99) < (sum.data?.payables ?? 0));

  // ===== Manuel CRUD + Restore =====
  log('\n=== Manuel Company CRUD ===');
  const cc = await fetch(API + '/companies', {
    method: 'POST', headers: Htek(),
    body: JSON.stringify({ name: 'Manuel CRUD Test', share_scope: ['tekstil'] }),
  }).then((r) => r.json());
  pass('CREATE', 'manual company create', !!cc.data?.id);

  if (cc.data?.id) {
    const cid = cc.data.id;
    const lst1 = await fetch(API + '/companies', { headers: Htek() }).then((r) => r.json());
    pass('LIST-VISIBLE', 'created visible', lst1.data.some((c) => c.id === cid));

    const dl = await fetch(API + '/companies/' + cid, { method: 'DELETE', headers: Htek() });
    pass('SOFT-DEL', 'soft delete OK', dl.status === 200);

    const lst2 = await fetch(API + '/companies', { headers: Htek() }).then((r) => r.json());
    pass('SOFT-HIDE', 'deleted hidden from list', !lst2.data.some((c) => c.id === cid));

    const rs = await fetch(API + '/companies/' + cid + '/restore', { method: 'POST', headers: Htek() });
    pass('RESTORE', 'restore endpoint', rs.status === 200 || rs.status === 201);

    const lst3 = await fetch(API + '/companies', { headers: Htek() }).then((r) => r.json());
    pass('RESTORED-VISIBLE', 'restored visible again', lst3.data.some((c) => c.id === cid));

    await fetch(API + '/companies/' + cid, { method: 'DELETE', headers: Htek() });
  }

  // ===== Aggregate mode =====
  log('\n=== Aggregate Mode ===');
  const Hagg = () => H('kilic', null, null, { 'X-Sayman-Aggregate': '1' });
  const aggDash = await fetch(API + '/dashboard/summary', { headers: Hagg() });
  pass('AGG-DASH', 'aggregate dashboard', aggDash.status === 200);

  const aggComp = await fetch(API + '/companies', { headers: Hagg() }).then((r) => r.json());
  pass('AGG-LIST', 'aggregate companies', aggComp.data !== undefined);

  // ===== Inbox =====
  log('\n=== Inbox ===');
  const inb = await fetch(API + '/inbox', { headers: Htek() }).then((r) => r.json());
  pass('INBOX', 'inbox endpoint', !!inb.data);

  // ===== Cross-tenant security (TEST 7 yeniden) =====
  log('\n=== Cross-tenant Security ===');
  const Hsan = () => H('kilic', 'sanayi', sanayi.id);
  const cc2 = await fetch(API + '/companies', {
    method: 'POST', headers: Htek(),
    body: JSON.stringify({ name: 'SecTest_Tekstil', share_scope: ['tekstil'] }),
  }).then((r) => r.json());

  if (cc2.data?.id) {
    const uuid = cc2.data.id;
    const g = await fetch(API + '/companies/' + uuid, { headers: Hsan() });
    pass('SEC-GET', 'cross-tenant GET = 404', g.status === 404);
    const p = await fetch(API + '/companies/' + uuid, {
      method: 'PATCH', headers: Hsan(),
      body: JSON.stringify({ name: 'HACKED' }),
    });
    pass('SEC-PATCH', 'cross-tenant PATCH = 404', p.status === 404);
    const d = await fetch(API + '/companies/' + uuid, { method: 'DELETE', headers: Hsan() });
    pass('SEC-DELETE', 'cross-tenant DELETE = 404', d.status === 404);
    // Cleanup
    await fetch(API + '/companies/' + uuid, { method: 'DELETE', headers: Htek() });
  }

  // ===== list-meta shape =====
  log('\n=== list-meta meta shape ===');
  const eps = ['/employees', '/companies', '/persons', '/payables', '/sales-invoices',
    '/guarantees', '/subscriptions', '/regular-payments', '/official-payments',
    '/payments', '/tasks', '/checks', '/stock', '/fixed-assets', '/tax-calendar',
    '/payroll/runs'];
  let metaOK = 0;
  for (const ep of eps) {
    const r = await fetch(API + ep, { headers: Htek() });
    if (r.status === 200) {
      const j = await r.json();
      if (j.total !== undefined && j.limit !== undefined && j.truncated !== undefined) metaOK++;
    }
  }
  pass('META', `${metaOK}/${eps.length} endpoints have list-meta`, metaOK === eps.length);

  // ===== Final =====
  log('\n==========================================');
  log('FINAL RESULTS:');
  console.table(results);
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  log(`Total: ${results.length}  -  PASS: ${passed}  -  FAIL: ${failed}`);
  log(`Score: ${Math.round((passed / results.length) * 100)}%`);
  // CI için exit code: en az 1 FAIL varsa exit(1)
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('ERR:', e.message, e.stack);
  process.exit(1);
});
