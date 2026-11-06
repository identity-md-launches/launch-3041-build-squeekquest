import assert from 'node:assert/strict';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, relative } from 'node:path';

const root = resolve('dist');
const files = [];
const errors = [];
let bytes = 0;
let references = 0;
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = resolve(dir, name);
    const s = await stat(path);
    if (s.isDirectory()) await walk(path);
    else {
      files.push(path);
      bytes += s.size;
    }
  }
}
await walk(root);
for (const file of files) {
  const ext = extname(file);
  if (ext !== '.html' && ext !== '.css') continue;
  const text = await readFile(file, 'utf8');
  const urls =
    ext === '.html'
      ? [...text.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1])
      : [...text.matchAll(/url\(\s*["']?([^"'\)\s]+)["']?\s*\)/g)].map((m) => m[1]);
  for (const url of urls) {
    if (/^(?:https?:|data:|mailto:|#|\/\/)/.test(url)) continue;
    references++;
    if (url.startsWith('/')) {
      errors.push(`Root-absolute URL in ${relative(root, file)}: ${url}`);
      continue;
    }
    try {
      await stat(resolve(dirname(file), decodeURIComponent(url.split(/[?#]/)[0])));
    } catch {
      errors.push(`Missing asset from ${relative(root, file)}: ${url}`);
    }
  }
}
const html = await readFile(resolve(root, 'index.html'), 'utf8');
for (const pattern of [
  /<title[^>]*>SqueekQuest/,
  /rel="icon"/,
  /name="description"/,
  /property="og:title"/,
  /property="og:image"/,
])
  if (!pattern.test(html)) errors.push(`Missing share metadata ${pattern}`);
assert.ok(bytes < 8388608, 'Export alone exceeds the complete submission budget.');
const report = {
  checkedAt: new Date().toISOString(),
  files: files.length,
  bytes,
  localReferencesChecked: references,
  errors,
  passed: errors.length === 0,
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/export-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
