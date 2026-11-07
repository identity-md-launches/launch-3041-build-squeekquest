import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { serve } from './preview.mjs';

const server = await serve(0),
  results = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.SQUEEKQUEST_CHROMIUM
      ? { executablePath: process.env.SQUEEKQUEST_CHROMIUM }
      : {}),
  });
  const context = await browser.newContext();
  await context.route('https://api.squeekchain.com/**', (route) =>
    route.abort('internetdisconnected'),
  );
  const page = await context.newPage();
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`http://localhost:${server.address().port}/preview/`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
      await page.getByRole('button', { name: 'Coinbase Wallet', exact: true }).waitFor();
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      await measure('wallet');
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page
        .getByRole('navigation', { name: 'Squeekchain tools' })
        .getByRole('button', { name: 'Check transaction', exact: true })
        .click();
      for (const name of [
        'Check transaction',
        'Web3 profile',
        'NFT inventory',
        'Leaderboard',
        'On-chain quests',
        'Squeekchain',
      ]) {
        await page
          .getByRole('navigation', { name: 'Web3 panels' })
          .getByRole('button', { name, exact: true })
          .click();
        await page.waitForTimeout(120);
        await measure(name);
      }
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      async function measure(view) {
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth ||
            [...document.querySelectorAll('dialog[open]')].some(
              (d) => d.scrollWidth > d.clientWidth + 1,
            ),
        );
        results.push({
          width,
          theme,
          view,
          overflow,
          passes: axe.passes.length,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          })),
          incomplete: axe.incomplete.map((v) => v.id),
        });
        console.log(
          `${width} ${theme} ${view}: ${axe.violations.length} violations; overflow ${overflow}`,
        );
      }
    }
  await context.close();
} catch (e) {
  results.push({ error: e.message.replaceAll(process.cwd(), '<workspace>') });
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await mkdir('artifacts', { recursive: true });
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      'Axe WCAG scan of wallet and six Web3 panels in two themes at two widths; offline/error and empty states. Real populated states are exercised by check-web3.mjs. Not a screen-reader session or accessibility certification.',
    results,
    passed:
      results.length === 28 &&
      results.every((r) => !r.error && !r.overflow && !r.violations.length),
  };
  await writeFile('artifacts/web3-accessibility.json', JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}
