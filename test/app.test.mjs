import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { startServer, ROOT } from './helpers.mjs';
import { build } from '../scripts/build.mjs';

let S;
before(async () => { build(); S = await startServer(); });
after(async () => { await S?.stop(); });

test('build: UI fingerprint unchanged and embedded server equals server/server.js', () => {
  const r = build({ write: false });
  const html = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
  const m = html.match(/SRVJS\s*=\s*'([A-Za-z0-9+/=]+)'/);
  assert.ok(m);
  assert.equal(Buffer.from(m[1], 'base64').toString('utf8'), fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8'));
  assert.equal(r.uiHash, fs.readFileSync(path.join(ROOT, 'app', 'UI_SHA256'), 'utf8').trim());
});

test('server delivers the app with compression, ETag and 304 revalidation', async () => {
  const plain = await fetch(S.base + '/', { headers: { 'Accept-Encoding': 'identity' } });
  assert.equal(plain.status, 200);
  const text = await plain.text();
  assert.match(text, /سامانه لجستیک آسانا/);
  const etag = plain.headers.get('etag');
  assert.ok(etag);
  const http = await import('node:http');
  const gz = await new Promise((ok, no) => http.get(S.base + '/', { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
    const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => ok({ h: res.headers, b: Buffer.concat(c) }));
  }).on('error', no));
  assert.equal(gz.h['content-encoding'], 'gzip');
  assert.ok(gz.b.length < Buffer.byteLength(text) * 0.7, `gzip ${gz.b.length} bytes`);
  assert.equal(zlib.gunzipSync(gz.b).toString('utf8'), text);
  const again = await fetch(S.base + '/', { headers: { 'If-None-Match': etag } });
  assert.equal(again.status, 304);
});

test('brotli is served when accepted', async () => {
  const http = await import('node:http');
  const r = await new Promise((ok, no) => http.get(S.base + '/index.html', { headers: { 'Accept-Encoding': 'br, gzip' } }, (res) => {
    const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => ok({ h: res.headers, b: Buffer.concat(c) }));
  }).on('error', no));
  assert.equal(r.h['content-encoding'], 'br');
  assert.match(zlib.brotliDecompressSync(r.b).toString('utf8'), /<div id="root"><\/div>/);
});
