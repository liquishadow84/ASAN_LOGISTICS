import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ADMIN_PASS = 'Test-Admin-Pass-2024';

const freePort = () => new Promise((ok, no) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
  s.on('error', no);
});

/** Starts an isolated server (temporary data dir, market collectors off). */
export async function startServer(env = {}) {
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifa-test-'));
  const child = spawn(process.execPath, ['--experimental-sqlite', '--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, IFA_PORT: String(port), IFA_HOST: '127.0.0.1', IFA_DATA: dataDir, IFA_ADMIN_PASS: ADMIN_PASS, IFA_MARKET: '0', IFA_CONFIG: path.join(dataDir, 'none.json'), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + '/api/health'); if (r.ok) break; } catch {}
    if (child.exitCode != null) throw new Error('server exited:\n' + log);
    await new Promise((r) => setTimeout(r, 100));
  }
  const api = async (p, { method = 'GET', body, token, headers = {} } = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body != null ? JSON.stringify(body) : undefined });
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, body: j, headers: r.headers };
  };
  const login = async (username = 'admin', password = ADMIN_PASS) => {
    const r = await api('/api/login', { method: 'POST', body: { username, password } });
    if (r.status !== 200) throw new Error('login failed: ' + JSON.stringify(r.body));
    return r.body.token;
  };
  const stop = async () => {
    if (child.exitCode == null) { child.kill('SIGTERM'); await new Promise((r) => child.once('exit', r)); }
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
  return { base, port, dataDir, api, login, stop, log: () => log };
}
