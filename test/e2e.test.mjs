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
  // FOB invoice: CIF = (FOB value + buyer-paid freight lines) / (1 - 1.1 × rate); origin THC is in the seller's price
  const fLines = r.rf.breakdown.filter((b) => b.group === 'freight').reduce((a, b) => a + b.usd, 0);
  assert.ok(Math.abs(r.rf.cif - (100000 + fLines) / (1 - 1.1 * 0.005)) <= 3, `cif ${r.rf.cif}`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Incoterms split buyer/seller share, lane uses UN/LOCODE, origin THC is per port', opts, async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(S.base + '/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.IFA && window.IFA.market, null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const p = { cargo: 50000, ins: 0.2 };
    return {
      exw: IFA.market.estimate({ params: { ...p, inc: 'EXW' } }),
      fob: IFA.market.estimate({ params: { ...p, inc: 'FOB' } }),
      cfr: IFA.market.estimate({ params: { ...p, inc: 'CFR' } }),
      cif: IFA.market.estimate({ params: { ...p, inc: 'CIF' } }),
      dir: IFA.market.estimate({ pol: 'Ningbo', params: { route: 'dir' } }),
      thc: IFA.market.estimate({ pol: 'Qingdao', params: { thcPol: { Qingdao: { thcO40: 333 } } } }),
    };
  });
  const sum = (e, f) => e.breakdown.filter(f).reduce((a, b) => a + b.usd, 0);
  for (const e of Object.values(r)) {
    assert.ok(e.breakdown.every((b) => ['origin', 'freight', 'insurance'].includes(b.group) && ['buyer', 'seller'].includes(b.payer)));
    assert.ok(Math.abs(e.buyerShare - sum(e, (b) => b.payer === 'buyer')) <= e.breakdown.length);
  }
  assert.equal(r.fob.lane, 'CNSHA→AEJEA→IRBND');
  assert.equal(r.dir.lane, 'CNNGB→IRBND');
  assert.equal(r.fob.incoterm, 'FOB');
  assert.ok(Math.abs(r.exw.buyerShare - r.exw.total) <= r.exw.breakdown.length, 'EXW: buyer pays everything');
  assert.ok(r.fob.breakdown.filter((b) => b.group === 'origin').every((b) => b.payer === 'seller'), 'FOB: origin THC in seller price');
  assert.ok(r.cfr.breakdown.every((b) => (b.group === 'insurance') === (b.payer === 'buyer')), 'CFR: buyer pays insurance only');
  assert.equal(r.cif.cif, 50000, 'CIF invoice: value is CIF');
  assert.ok(!r.cif.breakdown.some((b) => b.group === 'insurance'));
  assert.equal(r.cif.buyerShare, 0);
  assert.ok(r.cif.breakdown.every((b) => /در قیمت فروشنده/.test(b.basis)));
  assert.equal(r.thc.breakdown.find((b) => b.group === 'origin').usd, 333);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('forwarder quotes: validity, WRS cap, 40/20 and reefer checks, lane median, like-for-like THC', opts, async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(S.base + '/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.IFA && window.IFA.market, null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const t = new Date().toISOString().slice(0, 10);
    const add = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
    const base = { pol: 'Shanghai', pod: 'Bandar Abbas', cur: 'USD', date: t, to: add(10) };
    localStorage.setItem('ifa-mkt-q', JSON.stringify([
      { ...base, id: 'a20', vendor: 'A', eq: '20', amt: 5000 },
      { ...base, id: 'a40', vendor: 'A', eq: '40HC', amt: 5200 },
      { ...base, id: 'arf', vendor: 'A', eq: '40RF', amt: 5000, wrs: 3500 },
      { ...base, id: 'b40', vendor: 'B', eq: '40HC', amt: 8000, thc: true },
      { ...base, id: 'c40', vendor: 'C', eq: '40HC', amt: 9000 },
      { ...base, id: 'old', vendor: 'D', eq: '40HC', amt: 7000, to: add(-3) },
    ]));
    return { q: IFA.market.quotes(), l: IFA.market.laneStats() };
  });
  const q = Object.fromEntries(r.q.filter((x) => x.id.startsWith('mq:')).map((x) => [x.id.slice(3), x]));
  const has = (id, re) => q[id].checks.some((c) => re.test(c.text));
  assert.equal(q.a40.lane, 'CNSHA→IRBND');
  assert.ok(has('a40', /۴۰\/۲۰/), '40/20 ratio flagged');
  assert.ok(has('arf', /WRS/) && has('arf', /یخچالی/), 'reefer WRS over cap and cheaper than dry');
  assert.ok(has('old', /منقضی/) && q.old.live === false);
  assert.ok(q.b40.includesOriginThc && q.b40.market > q.c40.market, 'benchmark adds origin THC only when quoted');
  const hc = r.l.find((x) => x.lane === 'CNSHA→IRBND' && x.eq === '40HC');
  assert.equal(hc.count, 3, 'expired quote excluded');
  assert.equal(hc.median, 8000);
  assert.equal(hc.enough, true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('alternative routes: status with date/source, cost to border per mode, chargeable weight, closed routes excluded', opts, async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(S.base + '/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.IFA && window.IFA.market, null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const before = IFA.market.routes();
    const a = IFA.market.compareRoutes({ eq: '40HC', kg: 3000, cbm: 30, cargo: 50000, ins: 0.2 });
    const ok = IFA.market.setRouteStatus('rail_srk', 'closed', 'test');
    const b = IFA.market.compareRoutes({ eq: '20', kg: 12000, cbm: 20 });
    IFA.market.open('alt');
    return { before, a, ok, b, after: IFA.market.routes(), html: document.querySelector('.sx-body')?.innerText || '' };
  });
  const ids = ['sea', 'rail_srk', 'rail_inc', 'road_baz', 'casp_anz', 'casp_amd', 'air_ika'];
  assert.deepEqual(r.before.map((x) => x.id), ids);
  assert.ok(r.before.every((x) => ['open', 'lim', 'closed'].includes(x.status) && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && /^https:/.test(x.source)), 'each route has status, date and source');
  assert.equal(r.before.find((x) => x.id === 'sea').status, 'closed');
  assert.equal(r.a.currency, 'USD');
  assert.equal(r.a.scope, 'to-iran-border');
  assert.equal(r.a.chargeableKg, 5000, 'air chargeable = max(3000 kg, 30 m³ × 166.7)');
  for (const x of r.a.routes) {
    assert.ok(x.total > 0 && x.low < x.total && x.total < x.high, x.id);
    assert.ok(Math.abs(x.total - x.breakdown.reduce((s, b) => s + b.usd, 0)) <= x.breakdown.length, 'total = sum of lines ' + x.id);
    assert.ok(x.breakdown.every((b) => b.source && !/ریال/.test(b.item)), 'source tag on every line ' + x.id);
    assert.ok(x.days[0] <= x.days[1]);
  }
  const g = (X, id) => X.routes.find((x) => x.id === id);
  assert.ok(g(r.a, 'air_ika').breakdown.some((b) => b.usd === Math.round(5000 * 5.75)));
  assert.notEqual(r.a.cheapest, 'sea', 'closed sea route is never recommended');
  assert.equal(r.a.fastest, 'air_ika');
  assert.ok(g(r.a, 'rail_srk').breakdown.some((b) => /بیمه/.test(b.item)), 'insurance on value');
  assert.ok(r.ok);
  assert.equal(g(r.b, 'rail_srk').status, 'closed');
  assert.equal(r.after.find((x) => x.id === 'rail_srk').manual, true);
  assert.ok(g(r.b, 'rail_srk').total < g(r.a, 'rail_srk').total, '20ft rail cheaper than 40HC');
  assert.match(r.html, /وضعیت مسیرها/);
  assert.match(r.html, /مقایسهٔ مسیرها برای این محموله/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
