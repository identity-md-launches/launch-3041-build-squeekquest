import { readdir, lstat, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const excluded = new Set([
  '.git',
  '.github',
  '.imd',
  'node_modules',
  '.next',
  'out',
  '.cache',
  '.tmp',
  'npm-cache',
  '.npm',
  '.pnpm-store',
  '.turbo',
  'coverage',
]);
const files = [];
async function walk(dir = '.') {
  for (const name of await readdir(dir)) {
    const p = dir === '.' ? name : join(dir, name);
    if (
      excluded.has(name) ||
      p === 'test/scratch' ||
      name === '.env' ||
      name.startsWith('.env.') ||
      name.endsWith('.log') ||
      name.endsWith('.tsbuildinfo')
    )
      continue;
    const s = await lstat(p);
    if (s.isDirectory()) await walk(p);
    else files.push({ p, s });
  }
}
await walk();
const criticalSha256 = {};
for (const p of [
  'dist/index.html',
  'package.json',
  'package-lock.json',
  'src/lib/survival.ts',
  'src/lib/adventure.ts',
  'src/lib/chain-pulse.ts',
])
  criticalSha256[p] = createHash('sha256')
    .update(await readFile(p))
    .digest('hex');
const reportPath = 'artifacts/submission-budget.json',
  limitBytes = 8388608;
let prior = -1,
  report;
for (let i = 0; i < 5; i++) {
  let totalBytes = 0;
  const groups = {
      productionExport: 0,
      artifactsAndScreenshots: 0,
      sourceManifestsAndDocumentation: 0,
    },
    symlinks = [],
    archives = [],
    generated = [];
  for (const { p, s } of files) {
    if (s.isSymbolicLink()) symlinks.push(p);
    if (!s.isFile()) continue;
    const size = p === reportPath ? (await lstat(p)).size : s.size;
    totalBytes += size;
    groups[
      p.startsWith('dist/')
        ? 'productionExport'
        : p.startsWith('artifacts/')
          ? 'artifactsAndScreenshots'
          : 'sourceManifestsAndDocumentation'
    ] += size;
    if (/\.(tgz|tar|zip|gz)$/.test(p)) archives.push(p);
    if (/(?:^|\/)(node_modules|\.next|out|npm-cache|browsers)(?:\/|$)/.test(p)) generated.push(p);
  }
  const ignoreBytes = (await lstat('.gitignore')).size;
  report = {
    checkedAt: new Date().toISOString(),
    method:
      'Sum of regular deliverable files within this repository only. Supplied inputs, protected Git metadata, existing generated/cache exclusions and disposable test/scratch are omitted. No machine configuration was inspected.',
    limitBytes,
    totalBytes,
    remainingBytes: limitBytes - totalBytes,
    files: files.length,
    groups,
    gitignore: { changed: false, budgetBytes: 1024, actualBytes: ignoreBytes },
    unnecessaryDependencyArchives: archives,
    generated,
    symlinks,
    criticalSha256,
    passed:
      totalBytes <= limitBytes &&
      ignoreBytes <= 1024 &&
      !archives.length &&
      !generated.length &&
      !symlinks.length,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (totalBytes === prior) break;
  prior = totalBytes;
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
