import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The incumbent game's package.json and lockfile remain unchanged. This isolated
// build produces required browser runtime assets, never a vendored npm registry.
const work = resolve('test/scratch/wallet');
await mkdir(work, { recursive: true });
const versions = {
  '@wagmi/core': '3.6.9',
  '@wagmi/connectors': '8.2.4',
  '@coinbase/wallet-sdk': '4.4.0',
  viem: '2.57.16',
  mppx: '0.17.3',
  esbuild: '0.28.2',
};
if (!process.argv.includes('--installed')) {
  const recorded = JSON.parse(await readFile('artifacts/wallet-dependencies.json', 'utf8'));
  if (!recorded.npmLock)
    throw new Error(
      'The recorded wallet dependency graph is missing. Restore artifacts/wallet-dependencies.json.',
    );
  await writeFile(
    resolve(work, 'package.json'),
    JSON.stringify({ dependencies: versions }, null, 2) + '\n',
  );
  await writeFile(
    resolve(work, 'package-lock.json'),
    JSON.stringify(recorded.npmLock, null, 2) + '\n',
  );
  const r = spawnSync(
    'npm',
    [
      'ci',
      '--prefix',
      work,
      '--cache',
      resolve('test/scratch/npm-cache'),
      '--no-audit',
      '--no-fund',
    ],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) process.exit(r.status || 1);
}
const { build } = await import(
  pathToFileURL(resolve(work, 'node_modules/esbuild/lib/main.js')).href
);
await rm('public/wallet-runtime', { recursive: true, force: true });
await build({
  entryPoints: { index: 'src/web3/sdk-entry.mjs' },
  outdir: 'public/wallet-runtime',
  nodePaths: [resolve(work, 'node_modules')],
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  legalComments: 'eof',
  define: { 'process.env.NODE_ENV': '"production"' },
  chunkNames: '[name]-[hash]',
});
const lock = JSON.parse(await readFile(resolve(work, 'package-lock.json'), 'utf8'));
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/wallet-dependencies.json',
  JSON.stringify(
    {
      entry: 'src/web3/sdk-entry.mjs',
      packages: versions,
      npmLock: lock,
      resolved: Object.fromEntries(
        Object.entries(lock.packages)
          .filter(([path]) => path)
          .map(([path, p]) => [
            path.replace(/^node_modules\//, ''),
            { version: p.version, integrity: p.integrity, resolved: p.resolved },
          ]),
      ),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Rebuilt local wallet runtime. The normal production build copies these assets unchanged.',
);
