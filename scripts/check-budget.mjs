import { execFileSync } from 'node:child_process';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Git's existing exclusions omit every nesting level of generated dependencies/caches.
const limitBytes = 8388608,
  reportPath = 'artifacts/submission-budget.json';
const listed = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const files = [...new Set([...listed, reportPath])].filter(
  (p) => !/^\.(?:git|github|imd|env)(?:\/|\.|$)/.test(p) && !p.startsWith('test/scratch/'),
);
const criticalSha256 = {};
for (const p of [
  'dist/index.html',
  'package.json',
  'package-lock.json',
  'src/lib/survival.ts',
  'src/lib/game.ts',
])
  criticalSha256[p] = createHash('sha256')
    .update(await readFile(p))
    .digest('hex');
let previous = -1,
  report;
for (let iteration = 0; iteration < 6; iteration++) {
  let totalBytes = 0,
    count = 0;
  const groups = {
      productionExport: 0,
      artifactsAndScreenshots: 0,
      sourceManifestsAndDocumentation: 0,
    },
    symlinks = [],
    unnecessaryDependencyArchives = [],
    generated = [];
  for (const p of files) {
    let s;
    try {
      s = await lstat(p);
    } catch {
      continue;
    }
    if (s.isSymbolicLink()) symlinks.push(p);
    if (!s.isFile()) continue;
    count++;
    totalBytes += s.size;
    groups[
      p.startsWith('dist/')
        ? 'productionExport'
        : p.startsWith('artifacts/')
          ? 'artifactsAndScreenshots'
          : 'sourceManifestsAndDocumentation'
    ] += s.size;
    if (/\.(?:tgz|tar|zip|gz)$/.test(p)) unnecessaryDependencyArchives.push(p);
    if (/(?:^|\/)(?:node_modules|\.next|out|\.cache|npm-cache|browsers)(?:\/|$)/.test(p))
      generated.push(p);
  }
  const ignore = (await lstat('.gitignore')).size;
  report = {
    method:
      'Sum of existing regular Git deliverable files, including this report. Supplied .imd inputs, test/scratch and existing generated/cache exclusions are omitted. Removed old export chunks are omitted.',
    limitBytes,
    totalBytes,
    remainingBytes: limitBytes - totalBytes,
    files: count,
    groups,
    gitignore: { budgetBytes: 1024, actualBytes: ignore, changed: false },
    unnecessaryDependencyArchives,
    generated,
    symlinks,
    criticalSha256,
    passed:
      totalBytes <= limitBytes &&
      ignore <= 1024 &&
      !unnecessaryDependencyArchives.length &&
      !generated.length &&
      !symlinks.length,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (totalBytes === previous) break;
  previous = totalBytes;
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
