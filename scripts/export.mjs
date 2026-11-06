import { cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Next's Pages Router supplies relative chunk URLs through assetPrefix. Rebase
// remaining document-owned public URLs so the single-page app also works at /x/y/.
await rm('dist', { recursive: true, force: true });
await cp('out', 'dist', { recursive: true });
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const file = join(dir, name);
    if ((await stat(file)).isDirectory()) {
      await walk(file);
      continue;
    }
    if (name.endsWith('.map')) {
      await rm(file);
      continue;
    }
    if (name.endsWith('.html')) {
      const before = await readFile(file, 'utf8');
      const after = before.replace(/((?:src|href)=['"])\/(?!\/)/g, '$1./');
      await writeFile(file, after);
    }
  }
}
await walk('dist');
console.log('Static export ready: dist/index.html (relative assets, no server required).');
