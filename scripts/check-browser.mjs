import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve } from './preview.mjs';

// Optional executable/proxy settings are only for a developer's test runner;
// nothing is injected into the website or copied to the static export.
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const results = [];
const pageErrors = [];
const consoleErrors = [];
const resourceErrors = [];
await mkdir('artifacts/screenshots', { recursive: true });
const server = await serve(0);
let browser;
const startedAt = new Date().toISOString();
async function check(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`PASS ${name}`);
    return true;
  } catch (e) {
    results.push({ name, passed: false, durationMs: Date.now() - start, error: e.message });
    console.log(`FAIL ${name}: ${e.message}`);
    return false;
  }
}
try {
  const type = engine === 'webkit' ? webkit : chromium;
  browser = await type.launch({
    headless: true,
    ...(engine === 'chromium' && process.env.SQUEEKQUEST_CHROMIUM
      ? { executablePath: process.env.SQUEEKQUEST_CHROMIUM }
      : {}),
    ...(process.env.HTTPS_PROXY
      ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('requestfailed', (r) => {
    if (r.failure()?.errorText !== 'net::ERR_ABORTED')
      resourceErrors.push({ url: new URL(r.url()).pathname, error: r.failure()?.errorText });
  });
  page.on('response', (r) => {
    if (r.status() >= 400)
      resourceErrors.push({ status: r.status(), url: new URL(r.url()).pathname });
  });
  const url = `http://localhost:${server.address().port}/preview/`;
  await page.goto(url);
  await check('Production page hydrates at a static hosting subpath', async () => {
    await page.getByRole('button', { name: 'Start adventure', exact: true }).waitFor();
    assert.equal(await page.title(), 'SqueekQuest | A little hamster adventure');
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.fonts.check('800 24px "Nunito Sans"')));
    assert.equal(await page.locator('h1').count(), 1);
  });
  await check('Live API loads validated settled height and economy in the browser', async () => {
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.dashboard-strip .metric-value')].every(
          (e) => !e.textContent.includes('Unavailable'),
        ),
      {},
      { timeout: 20000 },
    );
    assert.ok(
      (await page.locator('.dashboard-strip .metric-value').first().innerText()).match(/[0-9]/),
    );
    await page.screenshot({
      path: `artifacts/screenshots/${engine}-adventure-desktop.webp`,
      fullPage: true,
      type: 'webp',
      quality: 82,
    });
  });
  await check('Product and primary action fit on the first 390px screen', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const b = await page
      .getByRole('button', { name: 'Start adventure', exact: true })
      .boundingBox();
    assert.ok(b && b.y >= 0 && b.y + b.height < 844);
    assert.ok(await page.locator('.game-map').isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await page.screenshot({
      path: `artifacts/screenshots/${engine}-adventure-mobile.webp`,
      fullPage: false,
      type: 'webp',
      quality: 85,
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await check('Forage: move to five seeds, return home and save a real run', async () => {
    await page.getByRole('button', { name: 'Start adventure', exact: true }).click();
    for (let i = 1; i <= 5; i++) {
      const seed = page.getByRole('button', { name: `Collect seed ${i}`, exact: true });
      await seed.click();
      await seed.waitFor({ state: 'detached' });
    }
    await page.screenshot({
      path: `artifacts/screenshots/${engine}-foraging.webp`,
      fullPage: false,
      type: 'webp',
      quality: 82,
    });
    await page.getByRole('button', { name: 'The burrow', exact: true }).click();
    await page.getByRole('button', { name: 'Play again', exact: true }).waitFor();
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('squeekquest.v1')));
    assert.equal(save.runs.length, 1);
    assert.ok(save.runs[0].seeds >= 5);
    assert.equal(save.receipts.filter((r) => r.quest === 'forage').length, 1);
  });
  await check('Keyboard movement, pause and resume work', async () => {
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    const hamster = page.getByTestId('hamster');
    const before = Number(await hamster.getAttribute('data-x'));
    await page.locator('.game-map').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(Number(await hamster.getAttribute('data-x')), before + 1);
    await page.keyboard.press('Escape');
    await page.getByRole('heading', { name: 'A little breather' }).waitFor();
    await page.getByRole('button', { name: 'Resume adventure', exact: true }).click();
    assert.equal(await page.locator('.game-overlay').count(), 0);
  });
  await check(
    'Wheel works: station visit, inspect settlement and earn local quest XP',
    async () => {
      await page.getByRole('button', { name: 'Visit Wheel works', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.match(await dialog.innerText(), /Safe settlement/);
      await dialog.getByRole('button', { name: 'Log discovery · +120 XP', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      const data = await page.evaluate(() => JSON.parse(localStorage.getItem('squeekquest.v1')));
      assert.ok(
        data.receipts.some((r) => r.quest === 'block-scout' && r.evidence.match(/0x[0-9a-f]{64}/)),
      );
    },
  );
  await check(
    'Signal station: inspect safe event, log evidence and claim daily challenge',
    async () => {
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.getByRole('button', { name: 'Visit Signal station', exact: true }).click();
      await page.getByRole('dialog').locator('.event-row').first().click();
      assert.match(await page.getByRole('dialog').innerText(), /Safe blockchain event/);
      await page.getByRole('button', { name: 'Log discovery · +150 XP', exact: true }).click();
      await page.getByRole('button', { name: 'Claim XP', exact: true }).click();
      const data = await page.evaluate(() => JSON.parse(localStorage.getItem('squeekquest.v1')));
      assert.ok(data.receipts.some((r) => r.quest === 'daily'));
      assert.ok(data.receipts.some((r) => r.quest === 'signal-hunter'));
    },
  );
  await check('Squeek grove: validate ID, load real NFT and log discovery', async () => {
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('button', { name: 'Visit Squeek grove', exact: true }).click();
    await page.getByLabel('Squeek ID', { exact: false }).fill('0');
    await page.getByRole('button', { name: 'Find Squeek', exact: true }).click();
    assert.match(await page.locator('#nft-error').innerText(), /1 to 9999/);
    await page.getByLabel('Squeek ID', { exact: false }).fill('1');
    await page.getByRole('button', { name: 'Find Squeek', exact: true }).click();
    await page
      .getByRole('button', { name: 'Log this Squeek', exact: true })
      .waitFor({ timeout: 15000 });
    assert.ok(
      await page
        .locator('.nft-image')
        .evaluate((e) => e instanceof HTMLImageElement && e.complete && e.naturalWidth > 0),
    );
    await page.screenshot({
      path: `artifacts/screenshots/${engine}-squeek-discovery.webp`,
      fullPage: false,
      type: 'webp',
      quality: 82,
    });
    await page.getByRole('button', { name: 'Log this Squeek', exact: true }).click();
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('squeekquest.v1')));
    assert.equal(data.receipts.filter((r) => r.quest !== 'daily').length, 4);
  });
  await check('Journal shows earned achievements and persistent evidence', async () => {
    await page.locator('.main-nav').getByRole('link', { name: 'Quest journal' }).click();
    assert.match(await page.locator('.journal-overview').innerText(), /4 of 4 quests complete/);
    assert.equal(await page.locator('.achievement.earned').count(), 5);
    await page.locator('.receipt-list summary').first().click();
    assert.ok(await page.locator('.receipt-list details[open] p').isVisible());
  });
  await check('Leaderboard, profile validation, sort and export work', async () => {
    await page.locator('.main-nav').getByRole('link', { name: 'Leaderboard', exact: true }).click();
    assert.equal(await page.locator('.leaderboard-row').count(), 1);
    await page.getByRole('button', { name: 'Edit name', exact: true }).click();
    await page.getByLabel('Explorer name', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Save explorer name', exact: true }).click();
    assert.ok(await page.locator('#name-error').isVisible());
    await page.getByLabel('Explorer name', { exact: true }).fill('Clover');
    await page.getByRole('button', { name: 'Save explorer name', exact: true }).click();
    await page.getByLabel('Sort runs', { exact: false }).selectOption('recent');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export progress', exact: true }).click(),
    ]);
    assert.equal(download.suggestedFilename(), 'squeekquest-progress.json');
    await page.reload();
    assert.equal(await page.locator('.leaderboard-row').count(), 1);
    await page.getByRole('button', { name: 'Edit name', exact: true }).click();
    assert.equal(await page.getByLabel('Explorer name', { exact: true }).inputValue(), 'Clover');
    await page.keyboard.press('Escape');
  });
  await check('Explorer filtering, empty state, event details and pagination work', async () => {
    await page
      .locator('.main-nav')
      .getByRole('link', { name: 'Chain explorer', exact: true })
      .click();
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await page.locator('.event-row').first().waitFor();
    const count = await page.locator('.event-row').count();
    await page.getByRole('searchbox').fill('no-event-matches-this');
    assert.equal(await page.locator('.event-row').count(), 0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    assert.equal(await page.locator('.event-row').count(), count);
    await page.getByLabel('Category', { exact: false }).selectOption('nft');
    assert.ok(
      (await page.locator('.event-row-main').allTextContents()).every((t) => /Nft/.test(t)),
    );
    await page.getByLabel('Category', { exact: false }).selectOption('all');
    await page.locator('.event-row').first().click();
    assert.ok(await page.getByRole('dialog').locator('.transaction a').isVisible());
    await page.keyboard.press('Escape');
    if (await page.getByRole('button', { name: 'Load more events', exact: true }).count()) {
      await page.getByRole('button', { name: 'Load more events', exact: true }).click();
      await page.waitForFunction((n) => document.querySelectorAll('.event-row').length > n, count);
    }
    await page.screenshot({
      path: `artifacts/screenshots/${engine}-explorer.webp`,
      fullPage: false,
      type: 'webp',
      quality: 82,
    });
    await page.getByRole('button', { name: 'Blocks', exact: true }).click();
    await page.locator('.settlement-row').first().click();
    assert.match(await page.getByRole('dialog').innerText(), /Ethereum block/);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Economy', exact: true }).click();
    assert.equal(await page.locator('.contract-list a').count(), 5);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    assert.equal(await page.locator('.bar-column').count(), 7);
  });
  await check('Dark mode persists and help returns keyboard focus', async () => {
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('button', { name: 'How to play', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(
      await page
        .getByRole('button', { name: 'How to play', exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.waitForFunction(
      () => document.querySelector('.network-badge')?.textContent?.includes('connected'),
      {},
      { timeout: 20000 },
    );
    await page.screenshot({
      path: `artifacts/screenshots/${engine}-dark.webp`,
      fullPage: false,
      type: 'webp',
      quality: 82,
    });
  });
  await check('All four pages reflow without horizontal scrolling', async () => {
    for (const width of [320, 390, 760, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of ['adventure', 'missions', 'explorer', 'leaderboard']) {
        await page.evaluate((v) => (location.hash = v), view);
        await page.waitForTimeout(60);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${view} overflows at ${width}`,
        );
      }
    }
  });
  await check('Reduced motion disables continuous game animations', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => (location.hash = 'adventure'));
    assert.equal(
      await page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === 'running').length,
      ),
      0,
    );
  });
  await check(
    'Unavailable API blocks chain discoveries while local gameplay remains usable',
    async () => {
      const offline = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p = await offline.newPage();
      p.setDefaultTimeout(8000);
      await p.route('https://api.squeekchain.com/**', (r) =>
        r.fulfill({
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Retry-After': '1',
          },
          body: '{"error":"indexer_busy"}',
        }),
      );
      await p.goto(url);
      await p.getByRole('button', { name: 'Start adventure', exact: true }).click();
      assert.ok(await p.getByRole('button', { name: 'Pause', exact: true }).isEnabled());
      await p.getByRole('button', { name: 'Visit Wheel works', exact: true }).click();
      await p.getByRole('dialog').waitFor();
      assert.ok(await p.getByRole('button', { name: 'Retry', exact: true }).isVisible());
      assert.equal(await p.getByRole('button', { name: /Log discovery/ }).count(), 0);
      await p.screenshot({
        path: `artifacts/screenshots/${engine}-api-unavailable.webp`,
        fullPage: false,
        type: 'webp',
        quality: 80,
      });
      await offline.close();
    },
  );
  await check('No page exceptions or failed production assets', async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(resourceErrors, []);
  });
} catch (e) {
  results.push({
    name: 'Browser setup or execution',
    passed: false,
    error: e.message.replaceAll(process.cwd(), '<workspace>'),
  });
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    `artifacts/browser-${engine}.json`,
    JSON.stringify(
      {
        engine,
        startedAt,
        finishedAt: new Date().toISOString(),
        scope:
          'Production static export at /preview/. Live API requests except explicitly injected outage scenario.',
        results,
        pageErrors,
        consoleErrors,
        resourceErrors,
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(
  `${results.filter((r) => r.passed).length}/${results.length} browser checks passed (${engine}).`,
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
