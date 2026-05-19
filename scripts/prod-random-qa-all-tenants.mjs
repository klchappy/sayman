#!/usr/bin/env node
/**
 * Controlled production exploratory QA.
 *
 * This intentionally creates only QA-RANDOM-* data, uses temporary local-auth
 * admin users per organization, throttles requests to stay under prod rate
 * limits, and hard-cleans its own records at the end.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const bcrypt = require('../apps/api/node_modules/bcryptjs');
const API_BASE = process.env.QA_API_BASE ?? 'https://api.sayman.deploi.net/v1';
const RUN_ID = process.env.QA_RUN_ID ?? new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const PREFIX = `QA-RANDOM-${RUN_ID}`;
const EMAIL_PREFIX = `qa-random-${RUN_ID}`;
const PASSWORD = `QaRandom${RUN_ID}A1`;
const REQUEST_INTERVAL_MS = Number(process.env.QA_REQUEST_INTERVAL_MS ?? 900);

function readEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

const envFile = readEnvFile();
const DIRECT_URL = process.env.DIRECT_URL ?? envFile.DIRECT_URL;
if (!DIRECT_URL) {
  console.error('DIRECT_URL is required for setup/cleanup.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const results = [];
const createdUsers = [];
const createdAccounts = [];
const created = {
  companies: [],
  persons: [],
  properties: [],
  payables: [],
  salesInvoices: [],
  guarantees: [],
  subscriptions: [],
  regularPayments: [],
  officialPayments: [],
  tasks: [],
  checks: [],
  fixedAssets: [],
  employees: [],
  payrollRuns: [],
  taxEvents: [],
  budgets: [],
  subsidiaries: [],
  webhooks: [],
  savedSearches: [],
  supportTickets: [],
  apiTokens: [],
};

let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle() {
  const wait = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function sql(q, params = []) {
  const res = await pool.query(q, params);
  return res.rows;
}

function short(value, max = 650) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function record({ scope, feature, operation, ok, status = null, severity = 'info', detail = '' }) {
  const row = { scope, feature, operation, ok, status, severity, detail };
  results.push(row);
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${scope} | ${feature} | ${operation}${status ? ` | ${status}` : ''}${detail ? ` | ${short(detail, 180)}` : ''}`);
}

async function check(scope, feature, operation, fn, severity = 'medium') {
  try {
    const value = await fn();
    record({ scope, feature, operation, ok: true });
    return value;
  } catch (err) {
    record({
      scope,
      feature,
      operation,
      ok: false,
      severity,
      detail: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function headers(ctx, extra = {}) {
  const h = {
    Authorization: `Bearer ${ctx.token}`,
    'Content-Type': 'application/json',
    'X-Sayman-Org': ctx.orgSlug,
    ...extra,
  };
  if (ctx.tenantSlug) h['X-Sayman-Tenant'] = ctx.tenantSlug;
  return h;
}

async function api(ctx, method, route, body, opts = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await throttle();
    const res = await fetch(`${API_BASE}${route}`, {
      method,
      headers: headers(ctx, opts.headers ?? {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (res.status === 429 && attempt < 2) {
      const retryAfter = Number(res.headers.get('retry-after') ?? 0);
      const waitMs = Math.max(65_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0);
      console.log(`[WAIT] rate_limited on ${method} ${route}; retrying in ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }
    return { status: res.status, body: json, text };
  }
  throw new Error(`unreachable retry state for ${method} ${route}`);
}

function expectStatus(response, expected, label) {
  assert(response, `${label}: no response`);
  assert(
    response.status === expected,
    `${label}: expected ${expected}, got ${response.status}; body=${short(response.body)}`,
  );
  return response.body;
}

function expectOk(response, label) {
  assert(response, `${label}: no response`);
  assert(
    response.status >= 200 && response.status < 300,
    `${label}: expected 2xx, got ${response.status}; body=${short(response.body)}`,
  );
  return response.body;
}

function dataId(body, label) {
  const id = body?.data?.id;
  assert(id, `${label}: data.id missing; body=${short(body)}`);
  return id;
}

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function iso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function tenantScope(org, tenant) {
  return `${org.slug}/${tenant.slug}`;
}

async function discoverOrgs() {
  const rows = await sql(`
    SELECT
      o.id,
      o.slug,
      o.name,
      COALESCE(
        json_agg(
          json_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'sector', t.sector, 'tax_number', t.tax_number)
          ORDER BY t.slug
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS tenants
    FROM organizations o
    LEFT JOIN tenants t ON t.organization_id = o.id AND t.is_active = true
    WHERE o.is_active = true
    GROUP BY o.id
    ORDER BY o.slug
  `);
  return rows.map((r) => ({ ...r, tenants: Array.isArray(r.tenants) ? r.tenants : [] }));
}

async function createQaUserForOrg(org) {
  const email = `${EMAIL_PREFIX}-${org.slug}`.replace(/[^a-z0-9@._-]/gi, '-').toLowerCase() + '@sayman.test';
  const hash = await bcrypt.hash(PASSWORD, 10);
  const rows = await sql(
    `
    WITH account AS (
      INSERT INTO auth_accounts (email, full_name, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, email
    ), app_user AS (
      INSERT INTO users (auth_account_id, email, full_name, is_active, onboarding_completed_at)
      SELECT account.id, account.email, $2, true, now()
      FROM account
      RETURNING id, auth_account_id, email
    ), role AS (
      INSERT INTO user_organization_roles (user_id, organization_id, role)
      SELECT app_user.id, $4::uuid, 'super_admin'
      FROM app_user
      RETURNING id
    )
    SELECT app_user.id AS user_id, app_user.auth_account_id AS account_id, app_user.email
    FROM app_user
    `,
    [email, `${PREFIX} Admin`, hash, org.id],
  );
  const row = rows[0];
  createdUsers.push(row.user_id);
  createdAccounts.push(row.account_id);

  const signIn = await fetch(`${API_BASE}/auth/local/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: row.email, password: PASSWORD }),
  });
  const body = await signIn.json();
  if (signIn.status !== 200 || !body.access_token) {
    throw new Error(`sign-in failed for ${org.slug}: ${signIn.status} ${short(body)}`);
  }
  return { ...row, token: body.access_token };
}

async function setupQaUsers(orgs) {
  const map = new Map();
  for (const org of orgs) {
    const user = await createQaUserForOrg(org);
    map.set(org.id, user);
  }
  return map;
}

async function listMetaCheck(ctx, route, feature, scope) {
  const res = await api(ctx, 'GET', route);
  const body = expectOk(res, `GET ${route}`);
  if (Array.isArray(body?.data) && ['count', 'total', 'limit', 'truncated'].some((k) => k in body)) {
    assert(body.count === body.data.length, `count (${body.count}) != data.length (${body.data.length})`);
  }
  record({ scope, feature, operation: `shape ${route}`, ok: true });
  return body;
}

async function orgLevelFlows(org, user) {
  const ctx = { token: user.token, orgSlug: org.slug };
  const scope = org.slug;

  await check(scope, 'auth/me', 'GET /me', async () => expectOk(await api(ctx, 'GET', '/me'), 'me'));
  await check(scope, 'users', 'GET /users', async () => expectOk(await api(ctx, 'GET', '/users'), 'users'));
  await check(scope, 'permissions', 'GET /users/me/permissions', async () => expectOk(await api(ctx, 'GET', '/users/me/permissions'), 'permissions'));
  await check(scope, 'tenants', 'GET /tenants', async () => expectOk(await api(ctx, 'GET', `/tenants?org=${org.slug}`), 'tenants'));
  await check(scope, 'security', 'GET /security/2fa/status', async () => expectOk(await api(ctx, 'GET', '/security/2fa/status'), '2fa status'));
  await check(scope, 'security', 'GET /security/audit', async () => expectOk(await api(ctx, 'GET', '/security/audit?limit=5'), 'audit'));
  await check(scope, 'api-tokens', 'CRUD', async () => {
    expectOk(await api(ctx, 'GET', '/api-tokens'), 'api-token list before');
    const createdToken = expectStatus(
      await api(ctx, 'POST', '/api-tokens', {
        name: `${PREFIX} token`,
        scopes: ['qa.read'],
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
      201,
      'api-token create',
    );
    const id = dataId(createdToken, 'api-token create');
    created.apiTokens.push(id);
    assert(typeof createdToken.token === 'string' && createdToken.token.startsWith('st_'), 'plain token missing');
    expectOk(await api(ctx, 'GET', '/api-tokens'), 'api-token list after');
    expectOk(await api(ctx, 'DELETE', `/api-tokens/${id}`), 'api-token revoke');
  });

  await check(scope, 'saved-searches', 'CRUD', async () => {
    const body = expectStatus(
      await api(ctx, 'POST', '/saved-searches', {
        module: 'payables',
        name: `${PREFIX} saved search`,
        filters: { q: PREFIX, status: 'pending' },
        is_pinned: true,
      }),
      201,
      'saved-search create',
    );
    const id = dataId(body, 'saved-search create');
    created.savedSearches.push(id);
    expectOk(await api(ctx, 'GET', '/saved-searches?module=payables'), 'saved-search list');
    expectOk(await api(ctx, 'PATCH', `/saved-searches/${id}`, { is_pinned: false }), 'saved-search update');
    expectOk(await api(ctx, 'DELETE', `/saved-searches/${id}`), 'saved-search delete');
  });

  await check(scope, 'webhooks', 'CRUD', async () => {
    expectOk(await api(ctx, 'GET', '/webhooks'), 'webhook list');
    const body = expectStatus(
      await api(ctx, 'POST', '/webhooks', {
        name: `${PREFIX} webhook`,
        url: `https://example.com/sayman-${RUN_ID}`,
        events: ['payable.created'],
      }),
      201,
      'webhook create',
    );
    const id = dataId(body, 'webhook create');
    created.webhooks.push(id);
    expectOk(await api(ctx, 'PATCH', `/webhooks/${id}`, { name: `${PREFIX} webhook updated` }), 'webhook update');
    expectOk(await api(ctx, 'GET', `/webhooks/${id}/deliveries`), 'webhook deliveries');
    expectOk(await api(ctx, 'DELETE', `/webhooks/${id}`), 'webhook delete');
  });

  await check(scope, 'support', 'ticket CRUD', async () => {
    const body = expectStatus(
      await api(ctx, 'POST', '/support/tickets', {
        title: `${PREFIX} support ticket`,
        description: 'Controlled QA ticket',
        category: 'bug',
        priority: 'low',
      }),
      201,
      'support ticket create',
    );
    const id = dataId(body, 'support ticket create');
    created.supportTickets.push(id);
    expectOk(await api(ctx, 'GET', '/support/tickets'), 'support ticket list');
    expectOk(await api(ctx, 'GET', `/support/tickets/${id}`), 'support ticket detail');
    expectOk(await api(ctx, 'PATCH', `/support/tickets/${id}`, { status: 'resolved', internal_notes: PREFIX }), 'support ticket update');
  });

  await check(scope, 'support', 'GET /support/tickets/summary', async () => {
    expectOk(await api(ctx, 'GET', '/support/tickets/summary'), 'support summary');
  }, 'high');

  await check(scope, 'aggregate', 'GET aggregate lists', async () => {
    if (org.tenants.length === 0) return;
    const agg = { token: user.token, orgSlug: org.slug };
    const extra = { headers: { 'X-Sayman-Aggregate': '1' } };
    for (const route of [
      '/dashboard/summary',
      '/payables',
      '/sales-invoices',
      '/guarantees',
      '/subscriptions',
      '/regular-payments',
      '/official-payments',
      '/tasks',
      '/checks',
      '/fixed-assets',
      '/employees',
      '/payroll/runs',
      '/tax-calendar',
      '/stock',
      '/budgets',
      '/budgets/comparison',
      `/reports/consolidated/profit-loss?from=${today(-30)}&to=${today()}`,
      `/reports/consolidated/balance-sheet?as_of=${today()}`,
    ]) {
      const res = await api(agg, 'GET', `${route}${route.includes('?') ? '&' : '?'}aggregate=1`, undefined, extra);
      expectOk(res, `aggregate ${route}`);
    }
  }, 'high');
}

async function crossTenantSecurityFlow(org, user) {
  if (org.tenants.length < 2) return;
  const [a, b] = org.tenants;
  const scope = `${org.slug} cross-tenant`;
  const aCtx = { token: user.token, orgSlug: org.slug, tenantSlug: a.slug };
  const bCtx = { token: user.token, orgSlug: org.slug, tenantSlug: b.slug };

  async function createRestricted(route, body, bucket) {
    const createdBody = expectStatus(await api(aCtx, 'POST', route, body), 201, `${route} restricted create`);
    const id = dataId(createdBody, `${route} restricted create`);
    created[bucket].push(id);
    return id;
  }

  await check(scope, 'master-data security', 'companies tenant B cannot access A-scoped record', async () => {
    const id = await createRestricted('/companies', {
      name: `${PREFIX} Restricted Company ${org.slug}`,
      tax_number: `91${RUN_ID.slice(-8)}`,
      share_scope: [a.slug],
    }, 'companies');
    expectStatus(await api(bCtx, 'GET', `/companies/${id}`), 404, 'cross company get');
    expectStatus(await api(bCtx, 'PATCH', `/companies/${id}`, { name: `${PREFIX} SHOULD NOT PATCH` }), 404, 'cross company patch');
    expectStatus(await api(bCtx, 'DELETE', `/companies/${id}`), 404, 'cross company delete');
    expectOk(await api(aCtx, 'DELETE', `/companies/${id}`), 'company cleanup via API');
  }, 'critical');

  await check(scope, 'master-data security', 'persons tenant B cannot access A-scoped record', async () => {
    const id = await createRestricted('/persons', {
      full_name: `${PREFIX} Restricted Person ${org.slug}`,
      phone: '+905550000000',
      share_scope: [a.slug],
    }, 'persons');
    expectStatus(await api(bCtx, 'GET', `/persons/${id}`), 404, 'cross person get');
    expectStatus(await api(bCtx, 'PATCH', `/persons/${id}`, { full_name: `${PREFIX} SHOULD NOT PATCH` }), 404, 'cross person patch');
    expectStatus(await api(bCtx, 'DELETE', `/persons/${id}`), 404, 'cross person delete');
    expectOk(await api(aCtx, 'DELETE', `/persons/${id}`), 'person cleanup via API');
  }, 'critical');

  await check(scope, 'master-data security', 'properties tenant B cannot mutate A-scoped record', async () => {
    const id = await createRestricted('/properties', {
      name: `${PREFIX} Restricted Property ${org.slug}`,
      property_type: 'office',
      municipality: 'QA',
      share_scope: [a.slug],
    }, 'properties');
    expectStatus(await api(bCtx, 'PATCH', `/properties/${id}`, { name: `${PREFIX} SHOULD NOT PATCH` }), 404, 'cross property patch');
    expectStatus(await api(bCtx, 'DELETE', `/properties/${id}`), 404, 'cross property delete');
    expectOk(await api(aCtx, 'DELETE', `/properties/${id}`), 'property cleanup via API');
  }, 'critical');
}

async function tenantFlows(org, tenant, user, tenantIndex) {
  const ctx = { token: user.token, orgSlug: org.slug, tenantSlug: tenant.slug };
  const scope = tenantScope(org, tenant);
  const suffix = `${RUN_ID}-${tenantIndex}`;
  let companyId = null;
  let personId = null;

  await check(scope, 'read surfaces', 'list/read core endpoints', async () => {
    for (const [route, feature] of [
      ['/dashboard/summary', 'dashboard'],
      ['/companies', 'companies'],
      ['/persons', 'persons'],
      ['/properties', 'properties'],
      ['/payables', 'payables'],
      ['/payments', 'payments'],
      ['/sales-invoices', 'sales-invoices'],
      ['/sales-invoices/summary', 'sales-summary'],
      ['/guarantees', 'guarantees'],
      ['/subscriptions', 'subscriptions'],
      ['/regular-payments', 'regular-payments'],
      ['/official-payments', 'official-payments'],
      ['/tasks', 'tasks'],
      ['/checks', 'checks'],
      ['/checks/summary', 'checks-summary'],
      ['/fixed-assets', 'fixed-assets'],
      ['/fixed-assets/summary', 'fixed-assets-summary'],
      ['/employees', 'employees'],
      ['/payroll/runs', 'payroll-runs'],
      ['/payroll/summary', 'payroll-summary'],
      ['/tax-calendar', 'tax-calendar'],
      ['/stock', 'stock'],
      ['/stock/critical', 'stock-critical'],
      ['/budgets', 'budgets'],
      ['/budgets/comparison', 'budgets-comparison'],
      ['/subsidiaries', 'subsidiaries'],
      ['/search?q=QA', 'search'],
      ['/search/top', 'search-top'],
      ['/archive/summary', 'archive'],
    ]) {
      await listMetaCheck(ctx, route, feature, scope);
    }
  }, 'high');

  await check(scope, 'companies', 'CRUD + soft delete', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/companies', {
      name: `${PREFIX} Company ${tenant.slug}`,
      short_name: `${PREFIX}-CO-${tenantIndex}`,
      tax_number: `80${String(tenantIndex).padStart(2, '0')}${RUN_ID.slice(-6)}`,
      share_scope: [tenant.slug],
    }), 201, 'company create');
    companyId = dataId(body, 'company create');
    created.companies.push(companyId);
    expectOk(await api(ctx, 'GET', `/companies/${companyId}`), 'company detail');
    expectOk(await api(ctx, 'PATCH', `/companies/${companyId}`, { short_name: `${PREFIX}-UPDATED` }), 'company update');
    expectOk(await api(ctx, 'DELETE', `/companies/${companyId}`), 'company delete');
    const list = expectOk(await api(ctx, 'GET', '/companies'), 'company list after delete');
    assert(!list.data.some((r) => r.id === companyId), 'soft-deleted company still visible');
  });

  await check(scope, 'persons', 'CRUD + soft delete', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/persons', {
      full_name: `${PREFIX} Person ${tenant.slug}`,
      phone: '+905550000001',
      family_group: 'QA',
      share_scope: [tenant.slug],
    }), 201, 'person create');
    personId = dataId(body, 'person create');
    created.persons.push(personId);
    expectOk(await api(ctx, 'GET', `/persons/${personId}`), 'person detail');
    expectOk(await api(ctx, 'PATCH', `/persons/${personId}`, { phone: '+905550000002' }), 'person update');
    expectOk(await api(ctx, 'DELETE', `/persons/${personId}`), 'person delete');
    const list = expectOk(await api(ctx, 'GET', '/persons'), 'person list after delete');
    assert(!list.data.some((r) => r.id === personId), 'soft-deleted person still visible');
  });

  await check(scope, 'properties', 'CRUD + soft delete', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/properties', {
      name: `${PREFIX} Property ${tenant.slug}`,
      property_type: 'office',
      municipality: 'Istanbul',
      registry_number: `QA-${suffix}`,
      share_scope: [tenant.slug],
    }), 201, 'property create');
    const id = dataId(body, 'property create');
    created.properties.push(id);
    expectOk(await api(ctx, 'PATCH', `/properties/${id}`, { site_unit_code: `U-${tenantIndex}` }), 'property update');
    expectOk(await api(ctx, 'DELETE', `/properties/${id}`), 'property delete');
  });

  let payableId = null;
  await check(scope, 'payables/payments', 'payable CRUD + payment race surface', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/payables', {
      owner_type: 'company',
      company_id: null,
      title: `${PREFIX} Payable ${tenant.slug}`,
      supplier_name: `${PREFIX} Supplier ${tenant.slug}`,
      invoice_number: `${PREFIX}-PAY-${suffix}`,
      issue_date: today(-2),
      due_date: today(15),
      amount: '1000.00',
      currency: 'TRY',
      status: 'pending',
      expected_method: 'eft',
      notes: PREFIX,
    }), 201, 'payable create');
    payableId = dataId(body, 'payable create');
    created.payables.push(payableId);
    expectOk(await api(ctx, 'GET', `/payables/${payableId}`), 'payable detail');
    expectOk(await api(ctx, 'PATCH', `/payables/${payableId}`, { status: 'approaching', notes: `${PREFIX} updated` }), 'payable update');
    const payment = expectStatus(await api(ctx, 'POST', '/payments', {
      payable_id: payableId,
      paid_at: today(),
      amount: '125.00',
      method: 'eft',
      reference_no: `${PREFIX}-PAYMENT-${suffix}`,
      status: 'approved',
      notes: PREFIX,
    }), 201, 'payment create');
    const paymentId = dataId(payment, 'payment create');
    expectOk(await api(ctx, 'GET', '/payments'), 'payment list');
    expectOk(await api(ctx, 'DELETE', `/payments/${paymentId}`), 'payment delete');
    expectOk(await api(ctx, 'DELETE', `/payables/${payableId}`), 'payable delete');
  }, 'critical');

  await check(scope, 'review queue', 'needs_review payable approve', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/payables', {
      title: `${PREFIX} Review Payable ${tenant.slug}`,
      supplier_name: `${PREFIX} Review Supplier`,
      invoice_number: `${PREFIX}-REV-${suffix}`,
      issue_date: today(),
      due_date: today(20),
      amount: '321.00',
      currency: 'TRY',
      status: 'pending',
      needs_review: true,
      auto_created_source: 'qa-random',
    }), 201, 'review payable create');
    const id = dataId(body, 'review payable create');
    created.payables.push(id);
    const summary = expectOk(await api(ctx, 'GET', '/review-queue/summary'), 'review summary');
    assert(Number(summary?.data?.total ?? 0) >= 1, 'review summary total did not increase');
    const queue = expectOk(await api(ctx, 'GET', '/review-queue?type=payable&scope=tenant'), 'review queue');
    const rows = queue?.data?.payables ?? [];
    assert(rows.some((r) => r.id === id), 'created review payable not listed');
    expectOk(await api(ctx, 'POST', `/review-queue/payable/${id}/approve`), 'review approve');
    const detail = expectOk(await api(ctx, 'GET', `/payables/${id}`), 'approved payable detail');
    assert(detail.data?.needs_review === false, 'approved payable still needs_review=true');
    expectOk(await api(ctx, 'DELETE', `/payables/${id}`), 'approved payable delete');
  }, 'critical');

  await check(scope, 'sales-invoices', 'CRUD + summary', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/sales-invoices', {
      title: `${PREFIX} Sales Invoice ${tenant.slug}`,
      customer_name: `${PREFIX} Customer ${tenant.slug}`,
      invoice_number: `${PREFIX}-SALE-${suffix}`,
      amount: '750.00',
      currency: 'TRY',
      issue_date: today(-1),
      due_date: today(30),
      notes: PREFIX,
    }), 201, 'sales create');
    const id = dataId(body, 'sales create');
    created.salesInvoices.push(id);
    expectOk(await api(ctx, 'GET', `/sales-invoices/${id}`), 'sales detail');
    expectOk(await api(ctx, 'PATCH', `/sales-invoices/${id}`, { status: 'partial_paid', paid_amount: '50.00' }), 'sales update');
    expectOk(await api(ctx, 'GET', '/sales-invoices/summary'), 'sales summary');
    expectOk(await api(ctx, 'DELETE', `/sales-invoices/${id}`), 'sales delete');
  });

  await check(scope, 'guarantees', 'CRUD + periods', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/guarantees', {
      beneficiary_name: `${PREFIX} Beneficiary ${tenant.slug}`,
      letter_no: `${PREFIX}-GUA-${suffix}`,
      amount: '25000.00',
      currency: 'TRY',
      issue_date: today(-10),
      expiry_date: today(120),
      commission_rate: '1.25',
      commission_frequency_months: 3,
      notes: PREFIX,
    }), 201, 'guarantee create');
    const id = dataId(body, 'guarantee create');
    created.guarantees.push(id);
    expectOk(await api(ctx, 'PATCH', `/guarantees/${id}`, { notes: `${PREFIX} updated` }), 'guarantee update');
    expectOk(await api(ctx, 'GET', `/guarantees/${id}/commission-periods`), 'guarantee periods');
    expectOk(await api(ctx, 'DELETE', `/guarantees/${id}`), 'guarantee delete');
  });

  await check(scope, 'subscriptions', 'CRUD', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/subscriptions', {
      owner_type: 'company',
      subscription_no: `${PREFIX}-SUB-${suffix}`,
      package_name: `${PREFIX} Internet ${tenant.slug}`,
      auto_payment: true,
      monthly_amount: '499.90',
      currency: 'TRY',
      start_date: today(-30),
      commitment_end_date: today(365),
      notes: PREFIX,
    }), 201, 'subscription create');
    const id = dataId(body, 'subscription create');
    created.subscriptions.push(id);
    expectOk(await api(ctx, 'PATCH', `/subscriptions/${id}`, { status: 'on_hold' }), 'subscription update');
    expectOk(await api(ctx, 'DELETE', `/subscriptions/${id}`), 'subscription delete');
  });

  await check(scope, 'regular-payments', 'CRUD + periods', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/regular-payments', {
      kind: 'rent',
      title: `${PREFIX} Rent ${tenant.slug}`,
      monthly_amount: '12000.00',
      currency: 'TRY',
      payment_day: 5,
      start_date: today(-60),
      end_date: today(300),
      notes: PREFIX,
    }), 201, 'regular payment create');
    const id = dataId(body, 'regular payment create');
    created.regularPayments.push(id);
    expectOk(await api(ctx, 'PATCH', `/regular-payments/${id}`, { monthly_amount: '12500.00' }), 'regular payment update');
    expectOk(await api(ctx, 'GET', `/regular-payments/${id}/periods`), 'regular payment periods');
    expectOk(await api(ctx, 'DELETE', `/regular-payments/${id}`), 'regular payment delete');
  });

  await check(scope, 'official-payments', 'CRUD + periods', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/official-payments', {
      payment_type: 'KDV',
      frequency: 'monthly',
      owner_type: 'company',
      typical_amount: '4500.00',
      currency: 'TRY',
      notes: `${PREFIX} KDV ${tenant.slug}`,
    }), 201, 'official payment create');
    const id = dataId(body, 'official payment create');
    created.officialPayments.push(id);
    expectOk(await api(ctx, 'PATCH', `/official-payments/${id}`, { typical_amount: '4600.00' }), 'official payment update');
    expectOk(await api(ctx, 'GET', `/official-payments/${id}/periods`), 'official payment periods');
    expectOk(await api(ctx, 'DELETE', `/official-payments/${id}`), 'official payment delete');
  });

  await check(scope, 'tasks', 'CRUD + done transition', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/tasks', {
      title: `${PREFIX} Task ${tenant.slug}`,
      description: 'QA task',
      priority: 'high',
      status: 'new',
      due_date: iso(7),
    }), 201, 'task create');
    const id = dataId(body, 'task create');
    created.tasks.push(id);
    expectOk(await api(ctx, 'PATCH', `/tasks/${id}`, { status: 'done' }), 'task done');
    expectOk(await api(ctx, 'DELETE', `/tasks/${id}`), 'task delete');
  });

  await check(scope, 'checks', 'CRUD + deposit/cash', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/checks', {
      kind: 'check',
      direction: 'incoming',
      document_no: `${PREFIX}-CHK-${suffix}`,
      drawer_name: `${PREFIX} Drawer`,
      amount: '3300.00',
      currency: 'TRY',
      issue_date: today(-3),
      due_date: today(45),
      portfolio_no: `${PREFIX}-PORT-${suffix}`,
      notes: PREFIX,
    }), 201, 'check create');
    const id = dataId(body, 'check create');
    created.checks.push(id);
    expectOk(await api(ctx, 'GET', `/checks/${id}`), 'check detail');
    expectOk(await api(ctx, 'POST', `/checks/${id}/deposit`, { deposited_at: today() }), 'check deposit');
    expectOk(await api(ctx, 'POST', `/checks/${id}/cash`, { cashed_at: today(1) }), 'check cash');
    expectOk(await api(ctx, 'DELETE', `/checks/${id}`), 'check delete');
  });

  await check(scope, 'fixed-assets', 'CRUD + schedule + dispose', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/fixed-assets', {
      name: `${PREFIX} Laptop ${tenant.slug}`,
      code: `qa-${RUN_ID.slice(-6)}-${tenantIndex}`,
      category: 'electronics',
      purchase_date: today(-90),
      purchase_cost: '42000.00',
      currency: 'TRY',
      useful_life_months: 36,
      depreciation_method: 'linear',
      salvage_value: '1000',
      location: 'QA Lab',
      supplier_name: `${PREFIX} Supplier`,
      notes: PREFIX,
    }), 201, 'fixed asset create');
    const id = dataId(body, 'fixed asset create');
    created.fixedAssets.push(id);
    expectOk(await api(ctx, 'GET', `/fixed-assets/${id}`), 'fixed asset detail');
    expectOk(await api(ctx, 'GET', `/fixed-assets/${id}/schedule`), 'fixed asset schedule');
    expectOk(await api(ctx, 'PATCH', `/fixed-assets/${id}`, { location: 'QA Lab Updated' }), 'fixed asset update');
    expectOk(await api(ctx, 'POST', `/fixed-assets/${id}/dispose`, { status: 'disposed', notes: PREFIX }), 'fixed asset dispose');
    expectOk(await api(ctx, 'DELETE', `/fixed-assets/${id}`), 'fixed asset delete');
  });

  let employeeId = null;
  await check(scope, 'employees/payroll', 'employee CRUD + payroll lifecycle', async () => {
    const employee = expectStatus(await api(ctx, 'POST', '/employees', {
      full_name: `${PREFIX} Employee ${tenant.slug}`,
      hire_date: today(-400),
      gross_salary: '45000.00',
      marital_status: 'single',
      kids_count: 0,
      spouse_working: false,
      department: 'QA',
      position: 'Tester',
      email: `${EMAIL_PREFIX}-${tenantIndex}@sayman.test`,
      notes: PREFIX,
    }), 201, 'employee create');
    employeeId = dataId(employee, 'employee create');
    created.employees.push(employeeId);
    expectOk(await api(ctx, 'GET', `/employees/${employeeId}`), 'employee detail');
    expectOk(await api(ctx, 'PATCH', `/employees/${employeeId}`, { gross_salary: '45500.00' }), 'employee update');
    expectOk(await api(ctx, 'POST', '/employees/calculate', {
      gross_monthly: 45500,
      marital_status: 'single',
      kids_count: 0,
      spouse_working: false,
    }), 'employee calculate');

    const period = `2099-${String((tenantIndex % 12) + 1).padStart(2, '0')}`;
    const run = expectStatus(await api(ctx, 'POST', '/payroll/runs', { period }), 201, 'payroll run create');
    const runId = dataId(run, 'payroll run create');
    created.payrollRuns.push(runId);
    expectOk(await api(ctx, 'GET', `/payroll/runs/${runId}`), 'payroll run detail');
    expectOk(await api(ctx, 'POST', `/payroll/runs/${runId}/approve`), 'payroll approve');
    expectOk(await api(ctx, 'POST', `/payroll/runs/${runId}/mark-paid`), 'payroll mark paid');
    expectOk(await api(ctx, 'DELETE', `/employees/${employeeId}`), 'employee delete');
  }, 'high');

  await check(scope, 'tax-calendar', 'CRUD + complete', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/tax-calendar', {
      kind: `QA-${suffix}`,
      label: `${PREFIX} Tax ${tenant.slug}`,
      period: `2099-${String((tenantIndex % 12) + 1).padStart(2, '0')}`,
      due_date: today(25),
      estimated_amount: '1234.56',
      notes: PREFIX,
    }), 201, 'tax event create');
    const id = dataId(body, 'tax event create');
    created.taxEvents.push(id);
    expectOk(await api(ctx, 'PATCH', `/tax-calendar/${id}`, { status: 'submitted' }), 'tax event update');
    expectOk(await api(ctx, 'POST', `/tax-calendar/${id}/complete`), 'tax event complete');
  });

  await check(scope, 'budgets', 'CRUD + comparison', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/budgets', {
      category: `qa-${RUN_ID}-${tenantIndex}`,
      period_kind: 'monthly',
      period: `2099-${String((tenantIndex % 12) + 1).padStart(2, '0')}`,
      planned_amount: '10000.00',
      currency: 'TRY',
      alert_threshold_pct: 75,
      notes: PREFIX,
    }), 201, 'budget create');
    const id = dataId(body, 'budget create');
    created.budgets.push(id);
    expectOk(await api(ctx, 'GET', `/budgets?period=2099-${String((tenantIndex % 12) + 1).padStart(2, '0')}`), 'budget period list');
    expectOk(await api(ctx, 'PATCH', `/budgets/${id}`, { planned_amount: '11000.00' }), 'budget update');
    expectOk(await api(ctx, 'GET', '/budgets/comparison'), 'budget comparison');
    expectOk(await api(ctx, 'DELETE', `/budgets/${id}`), 'budget delete');
  });

  await check(scope, 'subsidiaries', 'CRUD', async () => {
    const body = expectStatus(await api(ctx, 'POST', '/subsidiaries', {
      name: `${PREFIX} Branch ${tenant.slug}`,
      code: `qa-${RUN_ID.slice(-6)}-${tenantIndex}`,
      description: PREFIX,
      color: '#2563eb',
    }), 201, 'subsidiary create');
    const id = dataId(body, 'subsidiary create');
    created.subsidiaries.push(id);
    expectOk(await api(ctx, 'PATCH', `/subsidiaries/${id}`, { description: `${PREFIX} updated` }), 'subsidiary update');
    expectOk(await api(ctx, 'DELETE', `/subsidiaries/${id}`), 'subsidiary delete');
  });
}

async function cleanup() {
  const p = `${PREFIX}%`;
  const userIds = createdUsers;
  const accountIds = createdAccounts;

  await sql('BEGIN');
  try {
    await sql(`DELETE FROM webhook_deliveries WHERE endpoint_id IN (SELECT id FROM webhook_endpoints WHERE name LIKE $1)`, [p]);
    await sql(`DELETE FROM webhook_endpoints WHERE name LIKE $1 OR url LIKE $1`, [p]);
    await sql(`DELETE FROM saved_searches WHERE name LIKE $1 OR user_id = ANY($2::uuid[])`, [p, userIds]);
    const supportExists = (await sql(`SELECT to_regclass('support_tickets') AS reg`))[0]?.reg;
    if (supportExists) {
      await sql(`DELETE FROM support_tickets WHERE title LIKE $1 OR user_id = ANY($2::uuid[])`, [p, userIds]);
    }
    await sql(`DELETE FROM api_tokens WHERE name LIKE $1 OR account_id = ANY($2::uuid[])`, [p, accountIds]);

    await sql(`DELETE FROM payroll_items WHERE run_id IN (SELECT id FROM payroll_runs WHERE created_by = ANY($1::uuid[]) OR period LIKE '2099-%')`, [userIds]);
    await sql(`DELETE FROM payroll_runs WHERE created_by = ANY($1::uuid[]) OR period LIKE '2099-%'`, [userIds]);

    await sql(`DELETE FROM payment_transactions WHERE created_by = ANY($1::uuid[]) OR reference_no LIKE $2 OR notes LIKE $2`, [userIds, p]);
    await sql(`DELETE FROM payable_items WHERE created_by = ANY($1::uuid[]) OR title LIKE $2 OR invoice_number LIKE $2 OR supplier_name LIKE $2 OR notes LIKE $2`, [userIds, p]);
    await sql(`DELETE FROM sales_invoices WHERE created_by = ANY($1::uuid[]) OR title LIKE $2 OR invoice_number LIKE $2 OR customer_name LIKE $2 OR notes LIKE $2`, [userIds, p]);
    await sql(`DELETE FROM guarantees WHERE beneficiary_name LIKE $1 OR letter_no LIKE $1 OR notes LIKE $1`, [p]);
    await sql(`DELETE FROM subscriptions WHERE package_name LIKE $1 OR subscription_no LIKE $1 OR notes LIKE $1`, [p]);
    await sql(`DELETE FROM regular_payment_periods WHERE profile_id IN (SELECT id FROM regular_payment_profiles WHERE title LIKE $1 OR notes LIKE $1)`, [p]);
    await sql(`DELETE FROM regular_payment_profiles WHERE title LIKE $1 OR notes LIKE $1`, [p]);
    await sql(`DELETE FROM official_payment_periods WHERE profile_id IN (SELECT id FROM official_payment_profiles WHERE notes LIKE $1)`, [p]);
    await sql(`DELETE FROM official_payment_profiles WHERE notes LIKE $1`, [p]);
    await sql(`DELETE FROM tasks WHERE created_by = ANY($1::uuid[]) OR title LIKE $2 OR description LIKE $2`, [userIds, p]);
    await sql(`DELETE FROM checks_and_notes WHERE created_by = ANY($1::uuid[]) OR document_no LIKE $2 OR drawer_name LIKE $2 OR beneficiary_name LIKE $2 OR portfolio_no LIKE $2 OR notes LIKE $2`, [userIds, p]);
    await sql(`DELETE FROM depreciation_entries WHERE asset_id IN (SELECT id FROM fixed_assets WHERE created_by = ANY($1::uuid[]) OR name LIKE $2 OR code LIKE 'qa-%' OR supplier_name LIKE $2 OR notes LIKE $2)`, [userIds, p]);
    await sql(`DELETE FROM fixed_assets WHERE created_by = ANY($1::uuid[]) OR name LIKE $2 OR supplier_name LIKE $2 OR notes LIKE $2`, [userIds, p]);
    await sql(`DELETE FROM employees WHERE created_by = ANY($1::uuid[]) OR full_name LIKE $2 OR email LIKE $3 OR notes LIKE $2`, [userIds, p, `${EMAIL_PREFIX}%`]);
    await sql(`DELETE FROM tax_calendar_events WHERE label LIKE $1 OR kind LIKE $1 OR notes LIKE $1`, [p]);
    await sql(`DELETE FROM budgets WHERE created_by = ANY($1::uuid[]) OR category LIKE $2 OR notes LIKE $2`, [userIds, `qa-${RUN_ID}%`]);
    await sql(`DELETE FROM subsidiaries WHERE name LIKE $1 OR description LIKE $1 OR code LIKE 'qa-%'`, [p]);

    await sql(`DELETE FROM properties WHERE name LIKE $1 OR registry_number LIKE $1`, [p]);
    await sql(`DELETE FROM persons WHERE full_name LIKE $1 OR family_group = 'QA'`, [p]);
    await sql(`DELETE FROM companies WHERE name LIKE $1 OR short_name LIKE $1`, [p]);

    await sql(`DELETE FROM search_history WHERE user_id = ANY($1::uuid[]) OR query LIKE $2`, [userIds, p]);
    await sql(`DELETE FROM audit_log WHERE actor_id = ANY($1::uuid[])`, [userIds]);
    await sql(`DELETE FROM auth_sessions WHERE account_id = ANY($1::uuid[])`, [accountIds]);
    await sql(`DELETE FROM user_tenant_overrides WHERE user_id = ANY($1::uuid[])`, [userIds]);
    await sql(`DELETE FROM user_organization_roles WHERE user_id = ANY($1::uuid[])`, [userIds]);
    await sql(`DELETE FROM users WHERE id = ANY($1::uuid[]) OR email LIKE $2`, [userIds, `${EMAIL_PREFIX}%`]);
    await sql(`DELETE FROM auth_accounts WHERE id = ANY($1::uuid[]) OR email LIKE $2`, [accountIds, `${EMAIL_PREFIX}%`]);
    await sql('COMMIT');
  } catch (err) {
    await sql('ROLLBACK').catch(() => undefined);
    throw err;
  }

  const [left] = await sql(
    `
    SELECT
      (SELECT COUNT(*)::int FROM auth_accounts WHERE email LIKE $1) AS accounts,
      (SELECT COUNT(*)::int FROM users WHERE email LIKE $1) AS users,
      (SELECT COUNT(*)::int FROM payable_items WHERE title LIKE $2 OR invoice_number LIKE $2) AS payables,
      (SELECT COUNT(*)::int FROM sales_invoices WHERE title LIKE $2 OR invoice_number LIKE $2) AS sales_invoices,
      (SELECT COUNT(*)::int FROM companies WHERE name LIKE $2) AS companies,
      (SELECT COUNT(*)::int FROM persons WHERE full_name LIKE $2) AS persons,
      (SELECT COUNT(*)::int FROM properties WHERE name LIKE $2) AS properties,
      (SELECT COUNT(*)::int FROM tasks WHERE title LIKE $2) AS tasks,
      (SELECT COUNT(*)::int FROM employees WHERE full_name LIKE $2) AS employees
    `,
    [`${EMAIL_PREFIX}%`, p],
  );
  return left;
}

async function main() {
  console.log(`API: ${API_BASE}`);
  console.log(`RUN: ${PREFIX}`);
  console.log(`Throttle: ${REQUEST_INTERVAL_MS}ms/request\n`);

  const health = await fetch(`${API_BASE}/health`).then((r) => r.json());
  console.log(`Health: status=${health.status} db=${health.db} commit=${health.build?.commit ?? 'unknown'}\n`);

  const orgs = await discoverOrgs();
  const tenantCount = orgs.reduce((sum, org) => sum + org.tenants.length, 0);
  console.log(`Discovered: ${orgs.length} active orgs, ${tenantCount} active tenants\n`);

  let qaUsers;
  try {
    qaUsers = await setupQaUsers(orgs);

    for (const org of orgs) {
      const user = qaUsers.get(org.id);
      if (!user) continue;
      await orgLevelFlows(org, user);
      await crossTenantSecurityFlow(org, user);
    }

    let tenantIndex = 0;
    for (const org of orgs) {
      const user = qaUsers.get(org.id);
      if (!user) continue;
      for (const tenant of org.tenants) {
        tenantIndex += 1;
        await tenantFlows(org, tenant, user, tenantIndex);
      }
    }
  } finally {
    console.log('\nCleanup starting...');
    try {
      const left = await cleanup();
      console.log(`Cleanup left: ${JSON.stringify(left)}`);
    } catch (err) {
      console.error('Cleanup failed:', err);
      results.push({
        scope: 'cleanup',
        feature: 'cleanup',
        operation: 'hard cleanup',
        ok: false,
        severity: 'critical',
        status: null,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failed = results.filter((r) => !r.ok);
  const bySeverity = failed.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] ?? 0) + 1;
    return acc;
  }, {});
  const byFeature = failed.reduce((acc, r) => {
    acc[r.feature] = (acc[r.feature] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    run_id: RUN_ID,
    prefix: PREFIX,
    api_base: API_BASE,
    health,
    totals: {
      checks: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      by_severity: bySeverity,
      by_feature: byFeature,
    },
    failures: failed,
    results,
  };

  const outDir = path.join(ROOT, 'qa-reports');
  mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, `prod-random-qa-${RUN_ID}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\nSUMMARY');
  console.log(`${report.totals.passed}/${report.totals.checks} checks passed`);
  console.log(`Failures by severity: ${JSON.stringify(bySeverity)}`);
  console.log(`Report: ${reportPath}`);

  if (failed.some((r) => ['critical', 'high'].includes(r.severity))) {
    process.exitCode = 2;
  } else if (failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
