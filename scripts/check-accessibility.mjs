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
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const theme of ['light', 'dark'])
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`http://localhost:${server.address().port}/preview/`);
      await page
        .getByRole('button', { name: /Start adventure|Continue adventure/, exact: true })
        .waitFor();
      await setTheme();
      await measure('menu');
      await page
        .getByRole('button', { name: /Start adventure|Continue adventure/, exact: true })
        .click();
      // A scenario's theme is deliberately controlled; the toggle is tested separately.
      await setTheme();
      await measure('playing');
      for (const [name, label] of [
        ['inventory', 'Open inventory'],
        ['crafting', 'Open crafting'],
        ['building', 'Open build'],
        ['quests', 'Open quests'],
        ['map', 'Open map'],
        ['help', 'How to play'],
        ['minigame', 'Play Sunflower scramble'],
      ]) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await measure(name);
        await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      }
      await page.getByRole('button', { name: /Explorer profile/ }).click();
      await measure('profile');
      await page.getByRole('button', { name: 'Start a new game', exact: true }).click();
      await measure('new-game');
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      async function setTheme() {
        const current = await page.locator('html').getAttribute('data-theme');
        if (current !== theme)
          await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
        await page.waitForTimeout(180);
      }
      async function measure(view) {
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth ||
            [...document.querySelectorAll('dialog[open]')].some(
              (d) => d.scrollWidth > d.clientWidth,
            ),
        );
        results.push({
          theme,
          width,
          view,
          passes: axe.passes.length,
          overflow,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          })),
          incomplete: axe.incomplete.map((i) => i.id),
        });
        console.log(
          `${theme} ${width} ${view}: ${axe.violations.length} violations; overflow ${overflow}`,
        );
      }
    }
} catch (e) {
  results.push({ error: e.message.replaceAll(process.cwd(), '<workspace>') });
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await mkdir('artifacts', { recursive: true });
  const passed =
    results.length === 44 &&
    results.every((r) => !r.error && !r.overflow && r.violations.length === 0);
  await writeFile(
    'artifacts/accessibility.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        scope:
          'Automated axe WCAG checks in two themes and two widths across menu, game and nine panels; not a screen-reader session or compliance certification.',
        results,
        passed,
      },
      null,
      2,
    ) + '\n',
  );
  if (!passed) process.exitCode = 1;
}
