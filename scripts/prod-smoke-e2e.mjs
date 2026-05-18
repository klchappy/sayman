#!/usr/bin/env node
/**
 * Production smoke E2E for Sayman.
 *
 * Covers the release-critical surfaces:
 * - API health and DB health
 * - Web shell, favicon, OCR worker bundle wiring
 * - Smart-import ZIP -> review queue -> approve -> payables
 * - Browser service worker / console / network health when Chrome is available
 *
 * Required for cleanup:
 * - DIRECT_URL in .env or process env
 *
 * Usage:
 *   node scripts/prod-smoke-e2e.mjs
 *   SMOKE_API_BASE=https://api.sayman.deploi.net/v1 SMOKE_WEB_BASE=https://sayman.deploi.net node scripts/prod-smoke-e2e.mjs
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_BASE = process.env.SMOKE_API_BASE ?? 'https://api.sayman.deploi.net/v1';
const WEB_BASE = process.env.SMOKE_WEB_BASE ?? 'https://sayman.deploi.net';
const PASSWORD = 'SmokeTest123';

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
  console.error('DIRECT_URL is required for cleanup. Put it in .env or process env.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const results = [];
function ok(label, detail = '') {
  results.push({ label, ok: true, detail });
  console.log(`[OK] ${label}${detail ? ` - ${detail}` : ''}`);
}
function fail(label, err) {
  const detail = err instanceof Error ? err.message : String(err);
  results.push({ label, ok: false, detail });
  console.log(`[FAIL] ${label} - ${detail}`);
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function step(label, fn) {
  try {
    const ret = await fn();
    ok(label);
    return ret;
  } catch (err) {
    fail(label, err);
    throw err;
  }
}

async function sql(q, params = []) {
  const res = await pool.query(q, params);
  return res.rows;
}

function crc32(buf) {
  let c = ~0;
  for (const x of buf) {
    c ^= x;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function u16(v) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v);
  return b;
}
function u32(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0);
  return b;
}
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ]);
    locals.push(local);
    centrals.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0),
      u16(0), u32(0), u32(offset), name,
    ]));
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(cd.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...locals, cd, end]);
}

function authHeaders(token, orgSlug, tenantSlug) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Sayman-Org': orgSlug,
  };
  if (tenantSlug) headers['X-Sayman-Tenant'] = tenantSlug;
  return headers;
}

async function apiJson(method, route, token, orgSlug, tenantSlug, body) {
  const headers = { ...authHeaders(token, orgSlug, tenantSlug) };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

async function verifyApiHealth() {
  const res = await fetch(`${API_BASE}/health`);
  const json = await res.json();
  expect(res.status === 200, `health status ${res.status}`);
  expect(json.status === 'ok', `health.status=${json.status}`);
  expect(json.db === 'ok', `health.db=${json.db}`);
  return json.build?.commit ?? 'unknown';
}

async function verifyWebAssets() {
  const root = await fetch(`${WEB_BASE}/?smoke=${Date.now()}`);
  expect(root.status === 200, `web root status ${root.status}`);
  const html = await root.text();
  expect(html.includes('/favicon.svg'), 'favicon link missing');

  const favicon = await fetch(`${WEB_BASE}/favicon.svg`, { method: 'HEAD' });
  expect(favicon.status === 200, `favicon status ${favicon.status}`);

  const main = html.match(/assets\/index-[^" ]+\.js/)?.[0];
  expect(main, 'main bundle not found');
  const mainJs = await fetch(`${WEB_BASE}/${main}`).then((r) => r.text());
  const ocrChunk = [...mainJs.matchAll(/assets\/OCR-[A-Za-z0-9_-]+\.js/g)][0]?.[0];
  expect(ocrChunk, 'OCR chunk not found in web bundle');
  const ocrJs = await fetch(`${WEB_BASE}/${ocrChunk}`).then((r) => r.text());
  expect(ocrJs.includes('/review-queue?type=payable'), 'OCR payable redirect not wired');
  expect(ocrJs.includes('workerBlobURL:!1') || ocrJs.includes('workerBlobURL:false'), 'OCR workerBlobURL false missing');
  expect(ocrJs.includes('tesseract.js-core@v7.0.0'), 'OCR corePath missing');
  expect(ocrJs.includes('4.0.0_best_int'), 'OCR langPath missing');
  const workerAsset = ocrJs.match(/\/assets\/worker\.min-[A-Za-z0-9_-]+\.js/)?.[0];
  expect(workerAsset, 'OCR worker asset not referenced');
  const worker = await fetch(`${WEB_BASE}${workerAsset}`, { method: 'HEAD' });
  expect(worker.status === 200, `worker asset status ${worker.status}`);
  return { main, ocrChunk, workerAsset };
}

async function createIsolatedOrg() {
  const stamp = Date.now().toString(36);
  const email = `prod-smoke-${stamp}@sayman.test`;
  const orgName = `Prod Smoke ${stamp}`;
  const tenantSlug = `prod-smoke-${stamp}`;
  const tenantTax = `79${String(Date.now()).slice(-8)}`.slice(0, 10);
  const signup = await fetch(`${API_BASE}/auth/local/sign-up-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_type: 'company',
      org_name: orgName,
      full_name: 'Prod Smoke',
      email,
      password: PASSWORD,
      accept_terms: true,
      accept_kvkk: true,
    }),
  });
  const body = await signup.json();
  expect(signup.status === 201, `signup status ${signup.status}: ${JSON.stringify(body)}`);
  expect(body.access_token, 'access_token missing');
  expect(body.organization?.id && body.organization?.slug, 'organization missing');

  const token = body.access_token;
  const orgId = body.organization.id;
  const orgSlug = body.organization.slug;
  const tenant = await apiJson('POST', '/tenants', token, orgSlug, null, {
    slug: tenantSlug,
    name: 'Prod Smoke Tenant',
    sector: 'tekstil',
    tax_number: tenantTax,
  });
  expect(tenant.status === 201, `tenant status ${tenant.status}: ${JSON.stringify(tenant.body)}`);
  return { stamp, email, orgId, orgSlug, tenantSlug, tenantTax, token };
}

function makeUblXml(invoiceNo, tenantTax) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${invoiceNo}</cbc:ID>
  <cbc:IssueDate>2026-05-18</cbc:IssueDate>
  <cbc:DueDate>2026-06-18</cbc:DueDate>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>Prod Smoke Supplier AS</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">${tenantTax}</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>Prod Smoke Tenant</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="TRY">123.45</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;
}

async function verifySmartImportFlow(ctx) {
  const invoiceNo = `SMOKE-${ctx.stamp}`.toUpperCase();
  const zip = makeZip([{ name: 'invoice.xml', data: makeUblXml(invoiceNo, ctx.tenantTax) }]);
  const form = new FormData();
  form.append('file', new Blob([zip], { type: 'application/zip' }), 'smoke.zip');

  const importRes = await fetch(`${API_BASE}/smart-import?commit=true`, {
    method: 'POST',
    headers: authHeaders(ctx.token, ctx.orgSlug, ctx.tenantSlug),
    body: form,
  });
  const importBody = await importRes.json();
  expect(importRes.status === 200, `smart-import status ${importRes.status}: ${JSON.stringify(importBody)}`);
  expect(importBody.data?.success === 1, `smart-import success mismatch: ${JSON.stringify(importBody.data)}`);

  const review = await apiJson('GET', '/review-queue?type=payable&scope=org', ctx.token, ctx.orgSlug, ctx.tenantSlug);
  const rows = review.body?.data?.payables ?? [];
  const row = rows.find((r) => r.invoice_number === invoiceNo);
  expect(review.status === 200, `review queue status ${review.status}`);
  expect(row, `invoice ${invoiceNo} not found in review queue`);

  const approve = await apiJson('POST', `/review-queue/payable/${row.id}/approve`, ctx.token, ctx.orgSlug, ctx.tenantSlug);
  expect(approve.status === 200, `approve status ${approve.status}: ${JSON.stringify(approve.body)}`);

  const payables = await apiJson('GET', '/payables', ctx.token, ctx.orgSlug, ctx.tenantSlug);
  const payableRows = Array.isArray(payables.body?.data) ? payables.body.data : [];
  expect(payables.status === 200, `payables status ${payables.status}`);
  expect(payableRows.some((p) => p.invoice_number === invoiceNo), `approved invoice ${invoiceNo} not in payables`);
  return invoiceNo;
}

function chromeCandidates() {
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    ];
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CDP websocket timeout')), 15_000);
      this.ws.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('CDP websocket error'));
      }, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, timeout } = this.pending.get(message.id);
        clearTimeout(timeout);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result ?? {});
        return;
      }
      const listeners = this.listeners.get(message.method);
      if (listeners) {
        for (const fn of listeners) fn(message.params ?? {});
      }
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  send(method, params = {}) {
    const id = this.id;
    this.id += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timeout`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

async function launchChrome() {
  const chrome = chromeCandidates().find((p) => existsSync(p));
  if (!chrome) return null;
  const userDir = await mkdtemp(path.join(os.tmpdir(), 'sayman-smoke-chrome-'));
  const child = execFile(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDir}`,
    'about:blank',
  ]);
  const portFile = path.join(userDir, 'DevToolsActivePort');
  const started = Date.now();
  while (!existsSync(portFile)) {
    if (Date.now() - started > 15_000) throw new Error('Chrome DevToolsActivePort timeout');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const [port] = readFileSync(portFile, 'utf8').split(/\r?\n/);
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  const page = targets.find((t) => t.type === 'page') ?? targets[0];
  const cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.open();
  return { child, userDir, cdp };
}

async function evalInPage(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text ?? 'Runtime exception');
  return res.result?.value;
}

async function verifyBrowserHealth() {
  const browser = await launchChrome();
  if (!browser) {
    ok('Browser health skipped', 'Chrome not found');
    return;
  }
  const { child, userDir, cdp } = browser;
  const consoleErrors = [];
  const networkErrors = [];
  try {
    cdp.on('Runtime.consoleAPICalled', (event) => {
      if (event.type === 'error') {
        consoleErrors.push((event.args ?? []).map((a) => a.value ?? a.description ?? '').join(' '));
      }
    });
    cdp.on('Log.entryAdded', (event) => {
      if (event.entry?.level === 'error') consoleErrors.push(event.entry.text);
    });
    cdp.on('Network.responseReceived', (event) => {
      if (event.response?.status >= 400) {
        networkErrors.push({ status: event.response.status, url: event.response.url });
      }
    });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.navigate', { url: `${WEB_BASE}/` });
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    const sw = await evalInPage(cdp, `
      navigator.serviceWorker
        ? navigator.serviceWorker.getRegistrations().then((rs) => ({ count: rs.length, scopes: rs.map((r) => r.scope), href: location.href }))
        : Promise.resolve({ count: 0, scopes: [], unsupported: true, href: location.href })
    `);
    expect(sw.count === 0, `service worker registrations: ${JSON.stringify(sw)}`);
    expect(consoleErrors.length === 0, `console errors: ${JSON.stringify(consoleErrors.slice(0, 5))}`);
    expect(networkErrors.length === 0, `network errors: ${JSON.stringify(networkErrors.slice(0, 5))}`);
  } finally {
    cdp.close();
    child.kill();
    await rm(userDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function cleanup(ctx) {
  if (!ctx) return null;
  await sql('DELETE FROM organizations WHERE id = $1', [ctx.orgId]);
  await sql('DELETE FROM auth_accounts WHERE email = $1', [ctx.email]);
  await sql('DELETE FROM users WHERE email = $1', [ctx.email]);
  const [left] = await sql(
    `SELECT
      (SELECT COUNT(*)::int FROM organizations WHERE id = $1) AS orgs,
      (SELECT COUNT(*)::int FROM users WHERE email = $2) AS users,
      (SELECT COUNT(*)::int FROM auth_accounts WHERE email = $2) AS accounts`,
    [ctx.orgId, ctx.email],
  );
  return left;
}

let ctx = null;
try {
  console.log(`API: ${API_BASE}`);
  console.log(`WEB: ${WEB_BASE}\n`);

  const commit = await step('API health', verifyApiHealth);
  ok('API commit', commit);

  const web = await step('Web assets', verifyWebAssets);
  ok('Web bundle', `${web.main}, ${web.ocrChunk}, ${web.workerAsset}`);

  ctx = await step('Create isolated org/tenant', createIsolatedOrg);
  const invoice = await step('Smart import -> review queue -> payables', () => verifySmartImportFlow(ctx));
  ok('Imported invoice', invoice);

  await step('Browser SW / console / network health', verifyBrowserHealth);

  const cleanupResult = await cleanup(ctx);
  ok('Cleanup', JSON.stringify(cleanupResult));

  const failed = results.filter((r) => !r.ok);
  console.log('\nSUMMARY');
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
} catch (err) {
  if (ctx) {
    try {
      const cleanupResult = await cleanup(ctx);
      ok('Cleanup after failure', JSON.stringify(cleanupResult));
    } catch (cleanupErr) {
      fail('Cleanup after failure', cleanupErr);
    }
  }
  console.error('\nFATAL:', err);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
