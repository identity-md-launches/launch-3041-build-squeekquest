import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve } from './preview.mjs';

const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const results = [],
  pageErrors = [],
  consoleErrors = [],
  resourceErrors = [],
  externalRequests = [];
const KEY = 'squeekquest.survival.v2';
await mkdir('artifacts/screenshots', { recursive: true });
const server = await serve(0);
let browser, activePage;
async function check(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`PASS ${name}`);
    return true;
  } catch (e) {
    results.push({ name, passed: false, error: e.message, durationMs: Date.now() - start });
    console.log(`FAIL ${name}: ${e.message}`);
    if (activePage)
      console.log(
        'Current feedback:',
        await activePage
          .locator('.adventure-message')
          .textContent()
          .catch(() => ''),
      );
    return false;
  }
}
try {
  browser = await (engine === 'webkit' ? webkit : chromium).launch({
    headless: true,
    ...(engine === 'chromium' && process.env.SQUEEKQUEST_CHROMIUM
      ? { executablePath: process.env.SQUEEKQUEST_CHROMIUM }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(8000);
  await page.addInitScript(() => {
    if (window.name.startsWith('squeekquest-browser-fixture:')) {
      const data = JSON.parse(window.name.slice('squeekquest-browser-fixture:'.length));
      localStorage.removeItem('squeekquest.survival.v2');
      for (const [key, value] of Object.entries(data))
        localStorage.setItem(key, JSON.stringify(value));
      window.name = '';
    }
  });
  const url = `http://localhost:${server.address().port}/preview/`;
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('request', (r) => {
    if (
      !r.url().startsWith(url.slice(0, url.indexOf('/preview/'))) &&
      !r.url().startsWith('data:') &&
      !r.url().startsWith('blob:')
    )
      externalRequests.push(r.url());
  });
  page.on('requestfailed', (r) => {
    if (r.failure()?.errorText !== 'net::ERR_ABORTED')
      resourceErrors.push({ url: new URL(r.url()).pathname, error: r.failure()?.errorText });
  });
  page.on('response', (r) => {
    if (r.status() >= 400)
      resourceErrors.push({ status: r.status(), url: new URL(r.url()).pathname });
  });
  const stored = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  async function close() {
    if (await page.locator('dialog').count())
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  }
  async function load(s) {
    await close();
    await page.evaluate(
      ({ key, s }) => (window.name = 'squeekquest-browser-fixture:' + JSON.stringify({ [key]: s })),
      { key: KEY, s },
    );
    await page.reload();
    await page.getByRole('button', { name: 'Continue adventure', exact: true }).click();
    await page.locator('.survival-canvas').focus();
  }
  async function pauseSave() {
    await close();
    await page.locator('.survival-canvas').focus();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Continue adventure', exact: true }).waitFor();
    return stored();
  }
  async function worldClick(x, y) {
    await page.waitForTimeout(400);
    const geo = await page.locator('.survival-canvas').evaluate((c) => ({
      r: c.getBoundingClientRect().toJSON(),
      px: Number(c.dataset.x),
      py: Number(c.dataset.y),
    }));
    const scale = geo.r.width < 500 ? 1.35 : 1.7;
    const left = Math.max(
        0,
        Math.min(1216 - geo.r.width / scale, geo.px - geo.r.width / scale / 2),
      ),
      top = Math.max(0, Math.min(832 - geo.r.height / scale, geo.py - geo.r.height / scale / 2));
    await page.mouse.click(geo.r.x + (x - left) * scale, geo.r.y + (y - top) * scale);
  }
  await page.goto(url);
  await check('Production export hydrates at /preview/ with local fonts and metadata', async () => {
    await page.getByRole('button', { name: 'Start adventure', exact: true }).waitFor();
    assert.equal(await page.title(), 'SqueekQuest | Small paws. Wild world.');
    assert.equal(await page.locator('h1').count(), 1);
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.fonts.check('800 24px "Nunito Sans"')));
    for (const s of [
      'link[rel="icon"]',
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:image"]',
    ])
      assert.equal(await page.locator(s).count(), 1);
    await page.screenshot({
      path: `artifacts/screenshots/${engine}-survival-desktop.webp`,
      fullPage: true,
    });
  });
  await check(
    'First screen and controls work at 320, 390, 768 and 1440 with no horizontal overflow',
    async () => {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const r = await page.locator('.sq-start').boundingBox();
        assert.ok(r.y + r.height < 844);
        if (width === 390)
          await page.screenshot({
            path: `artifacts/screenshots/${engine}-survival-mobile.webp`,
            fullPage: true,
          });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    },
  );
  await page.getByRole('button', { name: 'Start adventure', exact: true }).click();
  const fresh = await stored();
  await check(
    'WASD movement is continuous and Escape freezes the world until Continue',
    async () => {
      const c = page.locator('.survival-canvas');
      await c.focus();
      const before = Number(await c.getAttribute('data-x'));
      await page.keyboard.down('d');
      await page.waitForTimeout(260);
      await page.keyboard.up('d');
      assert.ok(Number(await c.getAttribute('data-x')) > before + 10);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Continue adventure', exact: true }).waitFor();
      const x = await c.getAttribute('data-x');
      await page.waitForTimeout(250);
      assert.equal(await c.getAttribute('data-x'), x);
      await page.getByRole('button', { name: 'Continue adventure', exact: true }).click();
    },
  );
  await check(
    'Select a tree: player walks there, gathers wood, spends stamina and saves position',
    async () => {
      await worldClick(400, 432);
      await page.waitForFunction(() =>
        document.querySelector('.adventure-message').textContent.includes('+2 wood'),
      );
      const s = await pauseSave();
      assert.equal(s.inventory.wood, 2);
      assert.ok(s.stamina < 100);
      assert.ok(Math.hypot(s.position.x - 400, s.position.y - 432) < 58);
      assert.ok(s.depleted['forest-wood-12-13'] > 0);
    },
  );
  let fixture = {
    ...fresh,
    position: { x: 336, y: 464 },
    health: 40,
    stamina: 30,
    inventory: {
      ...fresh.inventory,
      wood: 36,
      stone: 28,
      fiber: 24,
      seed: 20,
      herb: 4,
      ore: 12,
      plank: 16,
    },
    buildings: { ...fresh.buildings, chest: 3 },
  };
  await load(fixture);
  await check(
    'Keyboard opens crafting, recipe consumes exact costs and axe equips once',
    async () => {
      await page.keyboard.press('c');
      await page.getByRole('dialog', { name: 'Crafting bench' }).waitFor();
      const row = page
        .locator('.recipe-row')
        .filter({ has: page.getByRole('heading', { name: 'Woodland axe', exact: true }) });
      await row.getByRole('button', { name: 'Craft', exact: true }).click();
      await row.getByRole('button', { name: 'Equipped', exact: true }).waitFor();
      assert.ok(await row.getByRole('button', { name: 'Equipped', exact: true }).isDisabled());
      const s = await stored();
      assert.equal(s.inventory.wood, 30);
      assert.equal(s.inventory.stone, 25);
      assert.equal(s.inventory.fiber, 22);
      assert.equal(s.tools.axe, true);
      await page.screenshot({
        path: `artifacts/screenshots/${engine}-crafting.webp`,
        fullPage: true,
      });
      await close();
    },
  );
  await check(
    'Base building and upgrades consume resources; shelter rest restores health and stamina',
    async () => {
      await page.keyboard.press('b');
      const card = page
        .locator('.building-card')
        .filter({ has: page.getByRole('heading', { name: 'Burrow shelter', exact: true }) });
      await card.getByRole('button', { name: 'Build', exact: true }).click();
      await card.getByText('Level 1 / 3', { exact: true }).waitFor();
      let s = await stored();
      assert.equal(s.inventory.wood, 20);
      assert.equal(s.inventory.fiber, 16);
      await card.getByRole('button', { name: 'Rest and recover' }).click();
      s = await stored();
      assert.equal(s.health, 100);
      assert.equal(s.stamina, 100);
      await card.getByRole('button', { name: 'Upgrade', exact: true }).click();
      s = await stored();
      assert.equal(s.buildings.shelter, 2);
      assert.equal(s.inventory.wood, 8);
      await page.screenshot({
        path: `artifacts/screenshots/${engine}-building.webp`,
        fullPage: true,
      });
      await close();
    },
  );
  await check(
    'Inventory filters, selecting a stack, consuming food and dropping one update counts',
    async () => {
      let s = await pauseSave();
      s.health = 50;
      s.stamina = 30;
      await load(s);
      await page.keyboard.press('i');
      await page.getByRole('dialog', { name: 'Your satchel' }).waitFor();
      await page.getByRole('button', { name: 'Supplies', exact: true }).click();
      assert.equal(await page.locator('.inventory-slot').count(), 3);
      await page.getByRole('button', { name: 'Berries, 3', exact: true }).click();
      await page.getByRole('button', { name: 'Eat berries', exact: true }).click();
      s = await stored();
      assert.equal(s.inventory.berry, 2);
      assert.equal(s.health, 60);
      await page.getByRole('button', { name: 'Drop one', exact: true }).click();
      s = await stored();
      assert.equal(s.inventory.berry, 1);
      await page.getByRole('button', { name: 'All items', exact: true }).click();
      assert.equal(await page.locator('.inventory-slot').count(), 10);
      await close();
    },
  );
  await check(
    'Daily quest requires progress, claims XP once and keeps claimed state after reload',
    async () => {
      let s = await pauseSave();
      s.daily.gathered = 20;
      const xp = s.xp;
      await load(s);
      await page.keyboard.press('j');
      const q = page
        .locator('.journal-quest')
        .filter({ has: page.getByRole('heading', { name: 'Stock the pantry', exact: true }) });
      await q.getByRole('button', { name: 'Claim XP', exact: true }).click();
      assert.ok(await q.getByRole('button', { name: 'Claimed', exact: true }).isDisabled());
      s = await stored();
      assert.equal(s.xp, xp + 60);
      await page.reload();
      await page.getByRole('button', { name: 'Continue adventure', exact: true }).click();
      await page.getByRole('button', { name: 'Open quests', exact: true }).click();
      assert.ok(
        await page
          .locator('.journal-quest')
          .first()
          .getByRole('button', { name: 'Claimed', exact: true })
          .isDisabled(),
      );
      await close();
    },
  );
  await check(
    'World map navigation walks to the village marker; E crosses and saves area',
    async () => {
      let s = await pauseSave();
      s.position = { x: 1088, y: 432 };
      s.area = 'forest';
      await load(s);
      await page.keyboard.press('m');
      await page
        .getByRole('button', { name: 'Walk the trail to Abandoned Village', exact: true })
        .click();
      await page.waitForFunction(() =>
        document.querySelector('.interact-button').textContent.includes('To the village'),
      );
      await page.locator('.survival-canvas').focus();
      await page.keyboard.press('e');
      await page.waitForFunction(
        () => document.querySelector('.survival-canvas').dataset.area === 'village',
      );
      s = await pauseSave();
      assert.equal(s.area, 'village');
      assert.ok(s.visited.includes('village'));
    },
  );
  await check(
    'Village north trail reaches Wilderness; ore requires a crafted pickaxe',
    async () => {
      let s = await stored();
      s.area = 'village';
      s.position = { x: 656, y: 90 };
      await load(s);
      await page.keyboard.press('e');
      await page.waitForFunction(
        () => document.querySelector('.survival-canvas').dataset.area === 'wilderness',
      );
      s = await pauseSave();
      s.position = { x: 528, y: 629 };
      s.tools.pickaxe = false;
      await load(s);
      await page.keyboard.press('e');
      await page.waitForFunction(() =>
        document.querySelector('.adventure-message').textContent.includes('Craft a pickaxe'),
      );
      s = await pauseSave();
      s.tools.pickaxe = true;
      const before = s.inventory.ore;
      await load(s);
      await page.keyboard.press('e');
      await page.waitForFunction(() =>
        document.querySelector('.adventure-message').textContent.includes('iron ore'),
      );
      s = await pauseSave();
      assert.equal(s.inventory.ore, before + 2);
      await page.screenshot({
        path: `artifacts/screenshots/${engine}-wilderness.webp`,
        fullPage: true,
      });
    },
  );
  await check('Hidden cache grants loot once; thorn damage visibly changes health', async () => {
    let s = await stored();
    s.area = 'forest';
    s.position = { x: 176, y: 144 };
    s.treasures = [];
    s.health = 100;
    await load(s);
    await page.keyboard.press('e');
    await page.waitForFunction(() =>
      document.querySelector('.adventure-message').textContent.includes('Hidden cache found'),
    );
    s = await pauseSave();
    assert.equal(s.treasures.length, 1);
    s.position = { x: 580, y: 390 };
    await load(s);
    await page.waitForTimeout(350);
    s = await pauseSave();
    assert.ok(s.health < 100);
  });
  await check(
    'Original foraging mini-game completes a real five-seed run and saves records',
    async () => {
      await page.getByRole('button', { name: 'Play Sunflower scramble', exact: true }).click();
      await page.getByRole('button', { name: 'Start adventure', exact: true }).click();
      for (const number of [1, 2, 3, 4, 5]) {
        await page.getByRole('button', { name: `Collect seed ${number}`, exact: true }).click();
        await page.waitForFunction(
          (n) => !document.querySelector(`button[aria-label="Collect seed ${n}"]`),
          number,
        );
      }
      await page.getByRole('button', { name: 'The burrow', exact: true }).click();
      await page
        .getByRole('button', { name: 'Play again', exact: true })
        .waitFor({ timeout: 12000 });
      const s = await stored();
      assert.ok(s.runs.length > 0);
      assert.ok(s.daily.run > 0);
      assert.equal(s.runs[0].seeds, 5);
      await page.screenshot({
        path: `artifacts/screenshots/${engine}-sunflower-scramble.webp`,
        fullPage: true,
      });
      await close();
    },
  );
  await check(
    'Profile rename, save export and valid/invalid import work without losing valid data',
    async () => {
      await page.getByRole('button', { name: /Explorer profile/ }).click();
      await page.getByLabel('Explorer name', { exact: true }).fill('Pip');
      await page.getByRole('button', { name: 'Save name', exact: true }).click();
      assert.equal((await stored()).name, 'Pip');
      const download = page.waitForEvent('download');
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Export save', exact: true })
        .click();
      assert.equal((await download).suggestedFilename(), 'squeekquest-save.json');
      const file = page.locator('input[type="file"]');
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: 'Import save', exact: true }).click(),
      ]);
      await chooser.setFiles({
        name: 'invalid.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{"broken":true}'),
      });
      await page.waitForFunction(() =>
        document.querySelector('.panel-feedback').textContent.includes('not a valid'),
      );
      assert.equal((await stored()).name, 'Pip');
      const s = await stored();
      s.name = 'Restored explorer';
      await file.setInputFiles({
        name: 'save.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(s)),
      });
      await page.waitForFunction(() =>
        document.querySelector('.panel-feedback').textContent.includes('Adventure imported'),
      );
      assert.equal((await stored()).name, 'Restored explorer');
      assert.equal(
        await page.getByLabel('Explorer name', { exact: true }).inputValue(),
        'Restored explorer',
      );
      await close();
    },
  );
  await check(
    'New game offers a safe cancel and only resets after its explicit confirmation',
    async () => {
      await page.getByRole('button', { name: /Explorer profile/ }).click();
      await page.getByRole('button', { name: 'Start a new game', exact: true }).click();
      await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
      assert.equal((await stored()).name, 'Restored explorer');
      await page.getByRole('button', { name: /Explorer profile/ }).click();
      await page.getByRole('button', { name: 'Start a new game', exact: true }).click();
      await page.getByRole('button', { name: 'Start new game', exact: true }).click();
      const s = await stored();
      assert.equal(s.xp, 0);
      assert.equal(s.area, 'forest');
      assert.equal(s.inventory.wood, 0);
      assert.equal(s.buildings.shelter, 0);
    },
  );
  await check(
    'Mobile direction controls, dark theme, dialogs and reduced motion remain usable',
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.getByRole('button', { name: 'Move right', exact: true }).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Open inventory', exact: true }).click();
      await page.screenshot({
        path: `artifacts/screenshots/${engine}-inventory-mobile-dark.webp`,
        fullPage: true,
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await close();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(
        await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
        true,
      );
      await page.getByRole('button', { name: 'How to play', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog').count(), 0);
    },
  );
  await check('Legacy profile migrates without requiring the old chain integration', async () => {
    await close();
    await page.evaluate(
      () =>
        (window.name =
          'squeekquest-browser-fixture:' +
          JSON.stringify({
            'squeekquest.v1': {
              version: 1,
              name: 'Old explorer',
              receipts: [],
              archivedXp: 450,
              unlocked: ['chain-scout'],
              runs: [],
              sound: false,
              theme: 'light',
            },
          })),
    );
    await page.reload();
    await page.getByRole('button', { name: 'Continue adventure', exact: true }).click();
    const s = await stored();
    assert.equal(s.name, 'Old explorer');
    assert.equal(s.xp, 450);
    assert.ok(s.legacyAchievements.includes('chain-scout'));
  });
  await check(
    'Unavailable browser storage reports export recovery; game stays playable',
    async () => {
      const limited = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await limited.addInitScript(() => {
        Storage.prototype.setItem = function () {
          throw new DOMException('Storage unavailable', 'QuotaExceededError');
        };
      });
      const p = await limited.newPage();
      await p.goto(url);
      await p.getByRole('button', { name: 'Start adventure', exact: true }).click();
      await p.getByText('Storage is unavailable or full.', { exact: false }).waitFor();
      assert.equal(await p.locator('.survival-canvas').count(), 1);
      await p.screenshot({
        path: `artifacts/screenshots/${engine}-storage-recovery.webp`,
        fullPage: true,
      });
      await limited.close();
    },
  );
  await check(
    'Offline game has no external requests, browser errors or broken local assets',
    async () => {
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(consoleErrors, []);
      assert.deepEqual(resourceErrors, []);
      assert.deepEqual(externalRequests, []);
    },
  );
} catch (e) {
  results.push({ name: 'Browser launch or runner', passed: false, error: e.message });
  console.log(e.message);
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  const report = {
    checkedAt: new Date().toISOString(),
    engine,
    scope:
      'Worker browser validation of the production export. Controlled saves are test inputs only; no runtime test hook.',
    results,
    pageErrors,
    consoleErrors,
    resourceErrors,
    externalRequests,
    passed: results.every((r) => r.passed),
  };
  await writeFile(`artifacts/browser-${engine}.json`, JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}
