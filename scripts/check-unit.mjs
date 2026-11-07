import { spawnSync } from 'node:child_process';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
const files = (await readdir('tests'))
  .filter((p) => p.endsWith('.test.ts'))
  .map((p) => 'tests/' + p);
const command = ['--import', 'tsx', '--test', ...files];
const run = spawnSync(process.execPath, command, { encoding: 'utf8' });
process.stdout.write(run.stdout || '');
process.stderr.write(run.stderr || '');
const output = run.stdout || '';
const count = (label) => Number(output.match(new RegExp(`(?:# |ℹ )${label} (\\d+)`))?.[1] ?? 0);
const checks = output
  .split('\n')
  .filter((l) => l.startsWith('✔') || l.startsWith('✖') || /^ok \d+ -/.test(l))
  .map((line) => ({
    name: line.replace(/^(?:✔|✖|ok \d+ -)\s*/, '').replace(/\s*\([\d.]+ms\)$/, ''),
    passed: !line.startsWith('✖'),
  }));
const report = {
  checkedAt: new Date().toISOString(),
  command: 'node ' + command.join(' '),
  tests: count('tests'),
  passedTests: count('pass'),
  failedTests: count('fail'),
  checks,
  exitCode: run.status,
  passed: run.status === 0 && count('tests') > 0,
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/unit-tests.json', JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.passed ? 0 : 1;
