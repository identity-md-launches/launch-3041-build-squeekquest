import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
export async function serve(port = 4173) {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!path.startsWith('/preview/')) {
        res.writeHead(302, { Location: '/preview/' });
        res.end();
        return;
      }
      const file = resolve(root, path.slice('/preview/'.length) || 'index.html');
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const actual = (await stat(file)).isDirectory() ? resolve(file, 'index.html') : file;
      res.writeHead(200, {
        'Content-Type': mime[extname(actual)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(await readFile(actual));
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise((r) => server.listen(port, '0.0.0.0', r));
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/preview.mjs')) {
  const server = await serve(Number(process.argv[2]) || 4173);
  console.log(`SqueekQuest preview: http://localhost:${server.address().port}/preview/`);
}
