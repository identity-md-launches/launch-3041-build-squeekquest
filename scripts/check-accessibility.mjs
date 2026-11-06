import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve } from './preview.mjs';

const results = [];
const server = await serve(0);
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.SQUEEKQUEST_CHROMIUM
      ? { executablePath: process.env.SQUEEKQUEST_CHROMIUM }
      : {}),
    ...(process.env.HTTPS_PROXY
      ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } }
      : {}),
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const theme of ['light', 'dark'])
    for (const width of [390, 1440])
      for (const view of ['adventure', 'missions', 'explorer', 'leaderboard']) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`http://localhost:${server.address().port}/preview/#${view}`);
        await page.waitForFunction(() => document.querySelector('#__next button') !== null);
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        await page.waitForTimeout(600);
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        results.push({
          theme,
          width,
          view,
          passes: axe.passes.length,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            help: v.help,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          })),
          incomplete: axe.incomplete.map((i) => i.id),
        });
        console.log(
          `${theme} ${width} ${view}: ${axe.violations.length} violations, ${axe.incomplete.length} incomplete rules`,
        );
      }
} catch (e) {
  results.push({ error: e.message.replaceAll(process.cwd(), '<workspace>') });
  console.log('Accessibility runner error:', e.message.replaceAll(process.cwd(), '<workspace>'));
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  await mkdir('artifacts', { recursive: true });
  await writeFile(
    'artifacts/accessibility.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        scope:
          'Automated axe WCAG rules on four primary views in both themes. Not a screen-reader session or conformance certification.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
if (results.some((r) => r.error || r.violations.length)) process.exitCode = 1;
