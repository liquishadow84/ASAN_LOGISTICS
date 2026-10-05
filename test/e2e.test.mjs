/* Browser end-to-end test: real app ↔ real server. Requires `playwright` (npm i -D playwright && npx playwright install chromium).
   Skipped automatically when Playwright is not installed. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.mjs';
import { build } from '../scripts/build.mjs';

let pw = null;
try { pw = await import('playwright'); } catch {}
const opts = { skip: !pw && 'playwright not installed', timeout: 180000 };
let S, browser;
before(async () => {
  if (!pw) return;
  build();
  S = await startServer();
  browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await S?.stop(); });

test('app boots from the server without JavaScript errors and syncs data two-way', opts, async () => {
  const token = await S.login();
  // a teammate already stored a shipment on the server
  await S.api('/api/kv/ifa-ship', { method: 'PUT', token, body: { value: JSON.stringify([{ id: 'S-1', ref: 'SH-1001', ms: [] }]), base: 0 } });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(S.base + '/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForSelector('#root *', { timeout: 60000 });
  assert.equal(await page.title(), 'سامانه لجستیک آسانا · Asana Logistics');

  // sign in through the app's own client API (same svLogin/svSync code used by the «سرور و همکاری تیمی» screen)
  await page.waitForFunction(() => window.IFA && window.IFA.server, null, { timeout: 60000 });
  const who = await page.evaluate(async (pass) => (await window.IFA.server.login('admin', pass)).user.username, 'Test-Admin-Pass-2024');
  assert.equal(who, 'admin');
  await page.evaluate(() => window.IFA.server.sync());
  const pulled = await page.evaluate(() => JSON.parse(localStorage.getItem('ifa-ship') || '[]'));
  assert.equal(pulled[0].ref, 'SH-1001', 'server data is pulled into the browser');

  await page.evaluate(() => { localStorage.setItem('ifa-tasks', JSON.stringify([{ id: 'T-1', t: 'پیگیری ترخیص' }])); });
  await page.evaluate(() => window.IFA.server.sync());
  const srv = await S.api('/api/kv?keys=ifa-tasks', { token });
  assert.equal(JSON.parse(srv.body['ifa-tasks'].value)[0].id, 'T-1', 'browser data is pushed to the server');

  const st = await page.evaluate(() => window.IFA.server.status());
  assert.equal(st.connected, true);
  assert.equal(st.error, null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('import cost to the Iranian border is USD-only, tagged by source and checks the WRS cap', opts, async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(S.base + '/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.IFA && window.IFA.market, null, { timeout: 60000 });
  const r = await page.evaluate(() => ({
    hc: IFA.market.estimate({ eq: '40HC' }),
    c20: IFA.market.estimate({ eq: '20' }),
    rf: IFA.market.estimate({ eq: '40RF', params: { cargo: 100000, ins: 0.2, insWar: 0.3 } }),
    over: IFA.market.estimate({ eq: '40', params: { wrs40: 2600 } }),
  }));
  for (const e of Object.values(r)) {
    assert.ok(e, 'estimate available (bundled SCFI/FBX series)');
    assert.equal(e.currency, 'USD');
    assert.equal(e.scope, 'to-iran-border');
    assert.ok(e.breakdown.every((b) => !/ریال/.test(b.item) && b.source), 'no rial lines; every line has a source tag');
    assert.ok(Math.abs(e.total - e.breakdown.reduce((a, b) => a + b.usd, 0)) <= e.breakdown.length, 'total = sum of rounded lines');
    assert.ok(e.low < e.total && e.total < e.high);
  }
  const wrs = (e) => e.breakdown.find((b) => /WRS/.test(b.item));
  assert.equal(wrs(r.hc).usd, 2000);
  assert.equal(wrs(r.c20).usd, 1000);
  assert.equal(wrs(r.rf).usd, 3000);
  assert.match(wrs(r.over).basis, /بیش از سقف/);
  assert.equal(r.hc.cif, null);
  const ins = r.rf.breakdown.find((b) => /بیمه/.test(b.item));
  assert.ok(ins && ins.usd > 0);
  // CIF = (FOB + freight) / (1 - 1.1 × rate)
  assert.ok(Math.abs(r.rf.cif - (100000 + r.rf.freight) / (1 - 1.1 * 0.005)) <= 2, `cif ${r.rf.cif}`);
  assert.deepEqual(errors, []);
  await ctx.close();
});
