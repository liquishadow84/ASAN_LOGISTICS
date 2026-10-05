import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { startServer, ADMIN_PASS } from './helpers.mjs';

let S, admin;
before(async () => { S = await startServer(); admin = await S.login(); });
after(async () => { await S?.stop(); });

test('health is public and reports version', async () => {
  const r = await S.api('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.match(r.body.version, /^\d+\.\d+\.\d+$/);
});

test('login: wrong password is rejected, protected routes need a token', async () => {
  assert.equal((await S.api('/api/login', { method: 'POST', body: { username: 'admin', password: 'nope' } })).status, 401);
  assert.equal((await S.api('/api/me')).status, 401);
  assert.equal((await S.api('/api/me', { token: 'forged.token' })).status, 401);
  const me = await S.api('/api/me', { token: admin });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, 'admin');
  assert.ok(me.body.perms.includes('users.manage'));
});

test('versioned KV sync with optimistic concurrency (409 on conflict)', async () => {
  const v1 = await S.api('/api/kv/ifa-jobs', { method: 'PUT', token: admin, body: { value: JSON.stringify([{ id: 'J-1' }]), base: 0 } });
  assert.equal(v1.status, 200);
  assert.equal(v1.body.version, 1);
  const stale = await S.api('/api/kv/ifa-jobs', { method: 'PUT', token: admin, body: { value: JSON.stringify([{ id: 'J-X' }]), base: 0 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.conflict, true);
  assert.equal(stale.body.server.version, 1);
  const v2 = await S.api('/api/kv/ifa-jobs', { method: 'PUT', token: admin, body: { value: JSON.stringify([{ id: 'J-1' }, { id: 'J-2' }]), base: 1 } });
  assert.equal(v2.body.version, 2);
  const g = await S.api('/api/kv?keys=ifa-jobs,ifa-ship,../etc', { token: admin });
  assert.deepEqual(Object.keys(g.body).sort(), ['ifa-jobs', 'ifa-ship']);
  assert.equal(JSON.parse(g.body['ifa-jobs'].value).length, 2);
  assert.equal(g.body['ifa-ship'].version, 0);
  assert.equal((await S.api('/api/kv/ifa-jobs', { method: 'PUT', token: admin, body: { value: '{not json', base: 2 } })).status, 400);
  assert.equal((await S.api('/api/kv/BAD_KEY', { method: 'PUT', token: admin, body: { value: '[]' } })).status, 400);
  const hist = await S.api('/api/kv/ifa-jobs/history', { token: admin });
  assert.deepEqual(hist.body.map((h) => h.version), [2, 1]);
  const rs = await S.api('/api/kv/ifa-jobs/restore', { method: 'POST', token: admin, body: { version: 1 } });
  assert.equal(rs.body.version, 3);
});

test('roles: per-dataset ACL and permission checks', async () => {
  const c = await S.api('/api/users', { method: 'POST', token: admin, body: { username: 'sara.sales', name: 'Sara', role: 'sales', password: 'sales-pass-123' } });
  assert.equal(c.status, 200);
  const sales = await S.login('sara.sales', 'sales-pass-123');
  assert.equal((await S.api('/api/kv/ifa-leads', { method: 'PUT', token: sales, body: { value: '[]' } })).status, 200);
  assert.equal((await S.api('/api/kv/ifa-pay', { method: 'PUT', token: sales, body: { value: '[]' } })).status, 403);
  assert.equal((await S.api('/api/users', { token: sales })).status, 403);
  assert.equal((await S.api('/api/backup', { token: sales })).status, 403);
  const kv = await S.api('/api/kv?keys=ifa-leads,ifa-pay', { token: sales });
  assert.equal(kv.body['ifa-leads'].canWrite, true);
  assert.equal(kv.body['ifa-pay'].canWrite, false);
});

test('changing a role or disabling a user revokes their sessions immediately', async () => {
  await S.api('/api/users', { method: 'POST', token: admin, body: { username: 'ali.ops', role: 'ops', password: 'ops-pass-1234' } });
  const ops = await S.login('ali.ops', 'ops-pass-1234');
  assert.equal((await S.api('/api/me', { token: ops })).status, 200);
  const list = await S.api('/api/users', { token: admin });
  const id = list.body.find((u) => u.username === 'ali.ops').id;
  await S.api('/api/users/' + id, { method: 'PATCH', token: admin, body: { active: false } });
  assert.equal((await S.api('/api/me', { token: ops })).status, 401);
  assert.equal((await S.api('/api/login', { method: 'POST', body: { username: 'ali.ops', password: 'ops-pass-1234' } })).status, 401);
});

test('password change requires the current password', async () => {
  await S.api('/api/users', { method: 'POST', token: admin, body: { username: 'reza', role: 'viewer', password: 'viewer-pass-1' } });
  const t = await S.login('reza', 'viewer-pass-1');
  assert.equal((await S.api('/api/me/password', { method: 'POST', token: t, body: { old: 'wrong', password: 'new-pass-12345' } })).status, 400);
  assert.equal((await S.api('/api/me/password', { method: 'POST', token: t, body: { old: 'viewer-pass-1', password: 'short' } })).status, 400);
  assert.equal((await S.api('/api/me/password', { method: 'POST', token: t, body: { old: 'viewer-pass-1', password: 'new-pass-12345' } })).status, 200);
  await S.login('reza', 'new-pass-12345');
});

test('document archive: content-addressed, versioned, de-duplicated', async () => {
  const data = Buffer.from('%PDF-1.4 bill of lading').toString('base64');
  const a = await S.api('/api/files', { method: 'POST', token: admin, body: { job: 'JOB-77', name: 'BL.pdf', mime: 'application/pdf', data } });
  assert.equal(a.status, 200);
  assert.equal(a.body.version, 1);
  const dup = await S.api('/api/files', { method: 'POST', token: admin, body: { job: 'JOB-77', name: 'BL.pdf', data } });
  assert.equal(dup.body.duplicate, true);
  const b = await S.api('/api/files', { method: 'POST', token: admin, body: { job: 'JOB-77', name: '../../BL.pdf', data: Buffer.from('v2').toString('base64') } });
  assert.equal(b.body.version, 2, 'path components are stripped from file names');
  const raw = await fetch(S.base + '/api/files/' + a.body.id + '/raw', { headers: { Authorization: 'Bearer ' + admin } });
  assert.equal(raw.status, 200);
  assert.equal(Buffer.from(await raw.arrayBuffer()).toString(), '%PDF-1.4 bill of lading');
  const list = await S.api('/api/files?job=JOB-77', { token: admin });
  assert.equal(list.body.length, 2);
});

test('customer portal: expiring link shows only public documents, can be revoked', async () => {
  await S.api('/api/kv/ifa-jobs', { method: 'PUT', token: admin, body: { value: JSON.stringify([{ id: 'J-9', ref: 'JOB-77', st: 'run' }]), force: true } });
  const files = await S.api('/api/files?job=JOB-77', { token: admin });
  await S.api('/api/files/' + files.body[0].id, { method: 'PATCH', token: admin, body: { public: true } });
  const p = await S.api('/api/portal', { method: 'POST', token: admin, body: { job: 'JOB-77', days: 3 } });
  assert.equal(p.status, 200);
  const page = await fetch(S.base + '/p/' + p.body.token);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /JOB-77/);
  const hidden = files.body[1].id;
  assert.equal((await fetch(S.base + '/p/' + p.body.token + '/f/' + hidden)).status, 404);
  await S.api('/api/portal/' + p.body.token, { method: 'DELETE', token: admin });
  assert.equal((await fetch(S.base + '/p/' + p.body.token)).status, 404);
});

test('notifications: rules queue events into the outbox', async () => {
  const r = await S.api('/api/notify/rules', { method: 'POST', token: admin, body: { event: 'shipment.delayed', channel: 'log', template: 'تأخیر {{ref}}' } });
  assert.equal(r.status, 200);
  const e = await S.api('/api/events', { method: 'POST', token: admin, body: { type: 'shipment.delayed', data: { ref: 'SH-1' } } });
  assert.equal(e.body.queued, 1);
  const o = await S.api('/api/notify/outbox', { token: admin });
  assert.equal(o.body[0].text, 'تأخیر SH-1');
});

test('e-invoice (Moadian): tax id generation and validation', async () => {
  const t = await S.api('/api/einv/taxid', { method: 'POST', token: admin, body: { memoryId: 'A1B2C3', date: Date.UTC(2024, 0, 1), serial: 1 } });
  assert.equal(t.status, 200);
  assert.equal(t.body.taxid.length, 22);
  const v = await S.api('/api/einv/validate', { method: 'POST', token: admin, body: { invoice: { header: {}, body: [] } } });
  assert.ok(v.body.errors.length > 3);
  const sub = await S.api('/api/einv/submit', { method: 'POST', token: admin, body: { invoice: { header: {}, body: [] } } });
  assert.equal(sub.status, 422);
});

test('tracking returns 501 until DCSA is configured', async () => {
  assert.equal((await S.api('/api/track?ref=MSCU1234567', { token: admin })).status, 501);
});

test('backup contains data but never password hashes', async () => {
  const b = await S.api('/api/backup', { token: admin });
  assert.equal(b.status, 200);
  assert.ok(b.body.kv.length >= 1);
  const s = JSON.stringify(b.body);
  assert.ok(!/"hash"\s*:\s*"[0-9a-f]{64,}"/.test(JSON.stringify(b.body.users)));
  assert.ok(!s.includes('"salt"'));
});

test('audit log is a verifiable SHA-256 hash chain and detects tampering', async () => {
  const ok = await S.api('/api/audit/verify', { token: admin });
  assert.equal(ok.body.ok, true);
  assert.ok(ok.body.checked > 10);
  const db = new DatabaseSync(path.join(S.dataDir, 'ifa.db'));
  db.prepare("UPDATE audit SET user='mallory' WHERE id=3").run();
  db.close();
  const bad = await S.api('/api/audit/verify', { token: admin });
  assert.equal(bad.body.ok, false);
  assert.equal(bad.body.brokenAt, 3);
});

test('unknown API routes return 404 JSON', async () => {
  const r = await S.api('/api/does-not-exist', { token: admin });
  assert.equal(r.status, 404);
});

test('admin password bootstrap uses IFA_ADMIN_PASS', async () => {
  assert.equal((await S.api('/api/login', { method: 'POST', body: { username: 'ADMIN ', password: ADMIN_PASS } })).status, 200);
});
