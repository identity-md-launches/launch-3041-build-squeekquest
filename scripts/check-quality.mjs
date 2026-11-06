import { chromium } from 'playwright';
import { serve } from './preview.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = await serve(0);
let b;
const checks = [],
  contrasts = [];
try {
  b = await chromium.launch({
    headless: true,
    ...(process.env.SQUEEKQUEST_CHROMIUM
      ? { executablePath: process.env.SQUEEKQUEST_CHROMIUM }
      : {}),
  });
  const context = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage();
  await p.goto(`http://localhost:${server.address().port}/preview/`);
  await p.getByRole('button', { name: 'Start adventure', exact: true }).waitFor();
  await p.keyboard.press('Tab');
  await p.keyboard.press('Tab');
  await p.keyboard.press('Tab');
  assert.equal(
    await p.evaluate(() => document.activeElement.getAttribute('aria-label')),
    'How to play',
  );
  await p.screenshot({
    path: 'artifacts/screenshots/chromium-keyboard-focus.webp',
    fullPage: true,
  });
  await p.keyboard.press('Enter');
  await p.getByRole('dialog').waitFor();
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press('Tab');
    assert.ok(
      await p.evaluate(
        () =>
          document.querySelector('dialog').contains(document.activeElement) ||
          document.activeElement === document.body,
      ),
    );
  }
  await p.keyboard.press('Escape');
  assert.equal(
    await p.evaluate(() => document.activeElement.getAttribute('aria-label')),
    'How to play',
  );
  checks.push({
    name: 'Keyboard focus ring, modal focus trap, Escape and trigger restoration',
    passed: true,
  });
  await p.getByRole('button', { name: 'Start adventure', exact: true }).click();
  await p.locator('.survival-canvas').focus();
  await p.keyboard.press('i');
  await p.keyboard.press('Escape');
  assert.ok(await p.locator('.survival-canvas').evaluate((c) => document.activeElement === c));
  checks.push({ name: 'Canvas shortcut dialog restores world focus', passed: true });
  for (const theme of ['light', 'dark']) {
    await p.getByRole('button', { name: 'Pause adventure', exact: true }).click();
    if ((await p.locator('html').getAttribute('data-theme')) !== theme)
      await p.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
    await p.waitForTimeout(180);
    const pairs = await p.evaluate(() => {
      const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = (c) =>
        rgb(c)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const samples = [
        ['Page title', '.sq-intro h1'],
        ['Description', '.sq-intro p'],
        ['Primary action', '.sq-start'],
        ['Health label', '.sq-meter.health>div>span'],
        ['Stamina label', '.sq-meter.stamina>div>span'],
        ['Scene label', '.scene-corner'],
        ['Next-step description', '.next-step p'],
        ['Text action', '.sq-text-button'],
      ];
      return samples.map(([name, selector]) => {
        const el = document.querySelector(selector),
          fg = getComputedStyle(el).color;
        let bg = '';
        for (let e = el; e; e = e.parentElement) {
          const c = getComputedStyle(e).backgroundColor;
          if (c.startsWith('rgb(')) {
            bg = c;
            break;
          }
        }
        const a = lum(fg),
          b = lum(bg);
        return {
          name,
          selector,
          foreground: fg,
          background: bg,
          ratio: Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)),
        };
      });
    });
    contrasts.push({ theme, pairs });
    checks.push({
      name: `${theme} text contrast across eight rendered solid-background pairs`,
      passed: pairs.every((v) => v.ratio >= 4.5),
    });
    await p.getByRole('button', { name: 'Continue adventure', exact: true }).click();
  }
  for (const width of [320, 390, 768, 1440]) {
    await p.setViewportSize({ width, height: 1000 });
    await p.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    await p.getByRole('button', { name: 'Open inventory', exact: true }).click();
    const measurements = await p.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      dialogScroll: document.querySelector('dialog').scrollWidth,
      dialogWidth: document.querySelector('dialog').clientWidth,
    }));
    checks.push({
      name: `200% text enlargement at ${width}px (not native zoom)`,
      passed:
        measurements.documentWidth <= width &&
        measurements.dialogScroll <= measurements.dialogWidth,
      measurements,
    });
    if (width === 390)
      await p.screenshot({
        path: 'artifacts/screenshots/chromium-text-200-mobile.webp',
        fullPage: true,
      });
    await p.keyboard.press('Escape');
    await p.evaluate(() => (document.documentElement.style.fontSize = ''));
  }
  await writeFile(
    'artifacts/contrast.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        method:
          'WCAG sRGB relative luminance of browser-computed foreground and nearest opaque solid background. These pairs do not certify canvas pixels or translucent image overlays.',
        results: contrasts,
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    'artifacts/quality.json',
    JSON.stringify(
      { checkedAt: new Date().toISOString(), checks, passed: checks.every((c) => c.passed) },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ checks, contrasts }, null, 2));
  if (!checks.every((c) => c.passed)) process.exitCode = 1;
} finally {
  await b?.close();
  await new Promise((r) => server.close(r));
}
