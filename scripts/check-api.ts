import { mkdir, writeFile } from 'node:fs/promises';
import { API, Endpoint, fetchData, paths } from '../src/lib/api';

const checks = await Promise.all(
  (Object.keys(paths) as Endpoint[]).map(async (key) => {
    const start = Date.now();
    try {
      const data = await fetchData(key, { force: true });
      return {
        endpoint: API + paths[key],
        key,
        passed: true,
        durationMs: Date.now() - start,
        schemaVersion: data.schemaVersion,
        installationId: data.installationId,
        chainId: 'chain' in data ? data.chain.chainId : undefined,
        recordCount:
          'events' in data
            ? data.events.length
            : 'recentSettlements' in data
              ? data.recentSettlements.length
              : 'blocks' in data
                ? data.blocks.length
                : undefined,
      };
    } catch (e) {
      return {
        endpoint: API + paths[key],
        key,
        passed: false,
        durationMs: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }),
);
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/api-check.json',
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      scope:
        'Actual public read requests and application schema validation. Not independent chain verification.',
      checks,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(checks, null, 2));
if (checks.some((c) => !c.passed)) process.exitCode = 1;
