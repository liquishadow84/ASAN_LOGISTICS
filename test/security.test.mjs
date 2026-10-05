import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.mjs';

test('brute-force lockout after 10 failures; X-Forwarded-For is ignored unless trustProxy', async () => {
  const S = await startServer();
  try {
    for (let i = 0; i < 10; i++) {
      const r = await S.api('/api/login', { method: 'POST', body: { username: 'admin', password: 'x' + i }, headers: { 'X-Forwarded-For': '10.0.0.' + i } });
      assert.equal(r.status, 401);
    }
    const r = await S.api('/api/login', { method: 'POST', body: { username: 'admin', password: 'x' }, headers: { 'X-Forwarded-For': '10.9.9.9' } });
    assert.equal(r.status, 429, 'spoofed X-Forwarded-For must not bypass the lockout');
  } finally { await S.stop(); }
});

test('with trustProxy the client IP comes from X-Forwarded-For', async () => {
  const S = await startServer({ IFA_TRUST_PROXY: '1' });
  try {
    for (let i = 0; i < 10; i++) await S.api('/api/login', { method: 'POST', body: { username: 'admin', password: 'x' }, headers: { 'X-Forwarded-For': '203.0.113.5' } });
    assert.equal((await S.api('/api/login', { method: 'POST', body: { username: 'admin', password: 'x' }, headers: { 'X-Forwarded-For': '203.0.113.5' } })).status, 429);
    assert.equal((await S.api('/api/login', { method: 'POST', body: { username: 'admin', password: 'x' }, headers: { 'X-Forwarded-For': '198.51.100.7' } })).status, 401);
  } finally { await S.stop(); }
});
