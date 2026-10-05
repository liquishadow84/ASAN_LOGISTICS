#!/usr/bin/env node
/**
 * Build: assembles the single-file web app (dist/index.html) from app/index.template.html + app/src/*.
 * - `<!--@include NAME-->` is replaced by app/src/NAME, or by the concatenation of NAME.part01, NAME.part02, …
 * - __IFA_SERVER_JS_B64__ / __IFA_SERVER_README_B64__ are replaced with base64 of server/server.js and
 *   server/README.md, so the in-app “download server.js” button always ships the server in this repository.
 * - The UI fingerprint (hash of the assembled app with placeholders unresolved) is compared with app/UI_SHA256
 *   to guarantee that the user interface is byte-identical to the original design.
 * - The design fingerprint (template markup + styles.css) is compared with app/DESIGN_SHA256: logic may evolve,
 *   but the visual design must not change.
 * Flags: --check (verify only, do not write)  --update-fingerprint (rewrite app/UI_SHA256 intentionally)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'app', 'src');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

export function readInclude(name) {
  if (!/^[\w.-]+$/.test(name)) throw new Error('invalid include name: ' + name);
  const whole = path.join(SRC, name);
  if (fs.existsSync(whole)) return fs.readFileSync(whole, 'utf8');
  const parts = fs.readdirSync(SRC).filter((f) => f.startsWith(name + '.part')).sort();
  if (!parts.length) throw new Error('include not found: ' + name);
  return parts.map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
}

export function assembleUi() {
  const tpl = fs.readFileSync(path.join(ROOT, 'app', 'index.template.html'), 'utf8');
  return tpl.replace(/<!--@include ([\w.-]+)-->/g, (_, n) => readInclude(n));
}

export function build({ write = true, updateFingerprint = false } = {}) {
  const ui = assembleUi();
  const uiHash = sha(Buffer.from(ui, 'utf8'));
  const fpFile = path.join(ROOT, 'app', 'UI_SHA256');
  if (updateFingerprint) fs.writeFileSync(fpFile, uiHash + '\n');
  const expected = fs.existsSync(fpFile) ? fs.readFileSync(fpFile, 'utf8').trim() : null;
  if (expected && expected !== uiHash) {
    throw new Error(`UI fingerprint mismatch\n  expected ${expected}\n  actual   ${uiHash}\nThe app sources changed. If intentional, run: npm run build -- --update-fingerprint`);
  }
  // Visual design guard: page markup (template) + stylesheet must stay byte-identical to the original design.
  const designHash = sha(Buffer.from(fs.readFileSync(path.join(ROOT, 'app', 'index.template.html'), 'utf8') + '\n/*css*/\n' + readInclude('styles.css'), 'utf8'));
  const dFile = path.join(ROOT, 'app', 'DESIGN_SHA256');
  const dExp = fs.existsSync(dFile) ? fs.readFileSync(dFile, 'utf8').trim() : null;
  if (dExp && dExp !== designHash) throw new Error(`Design fingerprint mismatch (markup/CSS changed)\n  expected ${dExp}\n  actual   ${designHash}`);
  const b64 = (f) => fs.readFileSync(path.join(ROOT, f)).toString('base64');
  for (const ph of ['__IFA_SERVER_JS_B64__', '__IFA_SERVER_README_B64__'])
    if (ui.split(ph).length !== 2) throw new Error('placeholder must appear exactly once: ' + ph);
  const html = ui
    .replace('__IFA_SERVER_JS_B64__', () => b64('server/server.js'))
    .replace('__IFA_SERVER_README_B64__', () => b64('server/README.md'));
  const out = path.join(ROOT, 'dist', 'index.html');
  if (write) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
  }
  return { out, bytes: Buffer.byteLength(html), uiHash, designHash, sha256: sha(Buffer.from(html, 'utf8')) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = build({ write: !process.argv.includes('--check'), updateFingerprint: process.argv.includes('--update-fingerprint') });
    console.log(`UI fingerprint OK  ${r.uiHash}`);
    console.log(`${process.argv.includes('--check') ? 'checked' : 'built'}  ${path.relative(ROOT, r.out)}  ${(r.bytes / 1048576).toFixed(2)} MB  sha256=${r.sha256}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
