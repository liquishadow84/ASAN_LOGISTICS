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
