import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve } from './preview.mjs';

const playwright = await import(
  process.env.IMD_PLAYWRIGHT ? pathToFileURL(process.env.IMD_PLAYWRIGHT).href : 'playwright'
);
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const fixture = JSON.parse(await readFile('tests/fixtures/web3-receipt.json', 'utf8'));
const accountFixture = JSON.parse(await readFile('tests/fixtures/web3-account.json', 'utf8'));
const results = [],
  errors = [],
  failures = [],
  liveReads = [],
  limitations = [],
  recoveredReads = [],
  verifiedLiveHashes = [];
const server = await serve(0),
  url = `http://localhost:${server.address().port}/preview/`;
let browser,
  page,
  mode = 'forward',
  rpcReads = 0;
const nav = (name) => page.locator('.web3-nav').getByRole('button', { name, exact: true });
const close = async () => {
  if (await page.locator('dialog').count())
    await page.getByRole('button', { name: 'Close dialog', exact: true }).last().click();
};
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log('PASS', name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message.slice(0, 1000) });
    console.log('FAIL', name, e.message.split('\n')[0]);
    await writeFile(
      `test/scratch/web3-${engine}-failure.txt`,
      await page
        .locator('body')
        .innerText()
        .catch(() => ''),
    );
  }
}
let visit = 0;
const go = async (hash = '') => {
  await close();
  await page.goto(url + '?validation=' + ++visit + hash, { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: /Start adventure|Continue adventure/, exact: true })
    .waitFor();
};
async function shot(name) {
  await page.screenshot({
    path: `artifacts/screenshots/web3-${engine}-${name}.jpg`,
    type: 'jpeg',
    quality: 76,
    fullPage: false,
  });
}
async function attachTransport(context) {
  await context.route('https://api.squeekchain.com/**', forward);
  await context.route('https://eth-sepolia.blockscout.com/api/**', forward);
  async function forward(route) {
    const request = route.request(),
      rpc = request.method() === 'POST',
      body = rpc ? JSON.parse(request.postData()) : null;
    if (rpc) rpcReads++;
    if (mode === 'offline') {
      await route.abort('internetdisconnected');
      return;
    }
    if (rpc && ['pending', 'failed', 'reorg', 'missing'].includes(mode)) {
      const f = structuredClone(fixture);
      if (mode === 'pending') {
        f.tx.blockHash = null;
        f.tx.blockNumber = null;
        f.receipt = null;
      }
      if (mode === 'failed') f.receipt.status = '0x0';
      if (mode === 'reorg') f.canonical.hash = f.canonical.parentHash;
      if (mode === 'missing') {
        f.tx = null;
        f.receipt = null;
      }
      const data = {
        eth_chainId: '0xaa36a7',
        eth_getTransactionByHash: f.tx,
        eth_getTransactionReceipt: f.receipt,
        eth_blockNumber: f.head,
        eth_getBlockByNumber: f.canonical,
        eth_getStorageAt: f.implementation,
        eth_getCode: f.code,
      }[body.method];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result: data }),
      });
      return;
    }
    try {
      const r = await fetch(request.url(), {
        method: request.method(),
        ...(rpc
          ? { body: request.postData(), headers: { 'Content-Type': 'application/json' } }
          : {}),
        signal: AbortSignal.timeout(20000),
      });
      const text = await r.text();
      if (request.url().includes('/v1/core') || request.url().includes('/v1/settlements')) {
        await mkdir(`test/scratch/web3-responses/${engine}`, { recursive: true });
        await writeFile(
          `test/scratch/web3-responses/${engine}/${Date.now()}-${request.url().includes('/core') ? 'core' : 'settlements'}.json`,
          text,
        );
      }
      liveReads.push({
        url: request.url(),
        method: body?.method || 'GET',
        status: r.status,
        bytes: Buffer.byteLength(text),
        at: new Date().toISOString(),
      });
      await route.fulfill({ status: r.status, contentType: 'application/json', body: text });
    } catch {
      await route.abort('failed');
    }
  }
}
try {
  const executablePath =
    process.env[engine === 'webkit' ? 'SQUEEKQUEST_WEBKIT' : 'SQUEEKQUEST_CHROMIUM'];
  browser = await playwright[engine].launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: true,
  });
  await attachTransport(context);
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (new URL(r.url()).hostname === 'localhost' && r.status() >= 400)
      failures.push({ url: r.url(), status: r.status() });
  });
  await check(
    'static subpath loads wallet modules and connect sheet without a wallet',
    async () => {
      await go();
      await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
      await page.getByRole('button', { name: 'Coinbase Wallet', exact: true }).waitFor();
      assert.equal(
        await page.getByRole('button', { name: 'Browser wallet', exact: true }).count(),
        1,
      );
      assert.ok((await page.evaluate(() => document.baseURI)).endsWith('/preview/'));
      await shot('wallet-desktop');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog').count(), 0);
      assert.match(
        await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || ''),
        /Connect wallet/,
      );
    },
  );
  await check(
    'mobile first screen, wallet deep links, bottom sheet and keyboard focus',
    async () => {
      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        hasTouch: true,
        ignoreHTTPSErrors: true,
      });
      await attachTransport(mobile);
      const old = page;
      page = await mobile.newPage();
      page.setDefaultTimeout(15000);
      await go();
      const start = await page
        .getByRole('button', { name: 'Start adventure', exact: true })
        .boundingBox();
      assert.ok(start && start.y + start.height < 844);
      await shot('mobile-first-screen');
      await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
      for (const name of ['MetaMask', 'Coinbase Wallet', 'Rabby', 'Phantom'])
        await page.getByRole('link', { name: `Open in ${name}`, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Coinbase Smart Wallet', exact: true }).waitFor();
      assert.ok(
        await page
          .getByRole('link', { name: 'Open in MetaMask', exact: true })
          .getAttribute('href'),
      );
      await shot('wallet-phone');
      await page.keyboard.press('Escape');
      await mobile.close();
      page = old;
    },
  );
  await check(
    'real canonical receipt decodes official events and earns one durable local reward',
    async () => {
      const available = await (
        await fetch('https://api.squeekchain.com/v1/settlements?range=24h')
      ).json();
      const liveHash = available.recentSettlements?.[0]?.transactionHash;
      assert.match(liveHash || '', /^0x[0-9a-f]{64}$/i);
      verifiedLiveHashes.push(liveHash);
      await go('#web3/checker');
      await page.getByLabel('Wallet address or transaction hash').fill(liveHash);
      await page.getByRole('button', { name: 'Verify transaction', exact: true }).click();
      for (let attempt = 0; attempt < 2; attempt++) {
        await page.waitForFunction(
          () => {
            const dialog = document.querySelector('dialog');
            return (
              [...(dialog?.querySelectorAll('h3') || [])].some(
                (h) => h.textContent === 'Confirmed',
              ) || !!dialog?.querySelector('[role=alert]')
            );
          },
          undefined,
          { timeout: 45000 },
        );
        if (await page.getByRole('heading', { name: 'Confirmed', exact: true }).count()) break;
        const error = await page.locator('dialog [role=alert]').innerText();
        if (attempt === 1) throw new Error(error);
        recoveredReads.push({
          at: new Date().toISOString(),
          error,
          action: 'Used the visible Try again control once',
        });
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
      }
      await page
        .getByText('Settlement verified against official SqueekCore evidence.', { exact: true })
        .waitFor();
      assert.ok(await page.getByText('BatchSettled', { exact: true }).count());
      await shot('real-settlement');
      const before = await page.evaluate(
        () => JSON.parse(localStorage.getItem('squeekquest.survival.v2'))?.xp || 0,
      );
      await page.getByRole('button', { name: 'Record settlement · +90 XP', exact: true }).click();
      await page
        .getByRole('button', { name: 'Already recorded', exact: true })
        .waitFor({ timeout: 45000 });
      const after = await page.evaluate(
        () => JSON.parse(localStorage.getItem('squeekquest.survival.v2')).xp,
      );
      assert.equal(after - before, 90);
      await go('#web3/checker');
      await page.getByLabel('Wallet address or transaction hash').fill(liveHash);
      await page.getByRole('button', { name: 'Verify transaction', exact: true }).click();
      await page
        .getByRole('button', { name: 'Already recorded', exact: true })
        .waitFor({ timeout: 45000 });
      assert.equal(
        await page.getByRole('button', { name: 'Already recorded', exact: true }).isDisabled(),
        true,
      );
    },
  );
  await check('real wallet search loads account history and real NFT ownership', async () => {
    await page.getByLabel('Wallet address or transaction hash').fill(accountFixture.account);
    await page.getByRole('button', { name: 'Verify transaction', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Confirmed transaction history', exact: true })
      .waitFor();
    await page.getByText(/official activity entries/).waitFor({ timeout: 30000 });
    assert.match(await page.locator('dialog').innerText(), /Not attributable/);
    await nav('NFT inventory').click();
    await page
      .getByRole('button', { name: new RegExp(`Squeek #${accountFixture.tokens[0].tokenId}`) })
      .waitFor({ timeout: 30000 });
    await page
      .getByRole('button', { name: new RegExp(`Squeek #${accountFixture.tokens[0].tokenId}`) })
      .click();
    await page
      .getByRole('link', { name: 'View Squeek on explorer', exact: true })
      .waitFor({ timeout: 30000 });
    await shot('nft-inventory');
  });
  await check(
    'community rankings use real safe events, filters and public profile links',
    async () => {
      await nav('Leaderboard').click();
      await page.locator('.web3-ranking li').first().waitFor({ timeout: 45000 });
      await page.getByLabel('Rank by', { exact: true }).selectOption('transactions');
      assert.match(await page.locator('.web3-ranking li').first().innerText(), /transactions/);
      await page.getByLabel('Period', { exact: true }).selectOption('weekly');
      await page.locator('.web3-ranking li').first().waitFor({ timeout: 45000 });
      await page.getByLabel('Period', { exact: true }).selectOption('all');
      await page.locator('.web3-ranking li').first().waitFor({ timeout: 45000 });
      await shot('leaderboard');
      await page.locator('.web3-ranking a').first().click();
      await page.getByRole('heading', { name: 'Web3 player profile', exact: true }).waitFor();
      assert.match(
        await page.getByLabel('Wallet address', { exact: true }).inputValue(),
        /^0x[\da-f]{40}$/i,
      );
      await nav('Leaderboard').click();
      await page.getByRole('button', { name: 'Game rankings', exact: true }).click();
      await page
        .getByRole('heading', { name: 'Global game rankings are unavailable', exact: true })
        .waitFor();
    },
  );
  await check(
    'pending refresh, failed, missing, reorg and offline states never grant rewards (controlled RPC)',
    async () => {
      await go('#web3/checker');
      mode = 'pending';
      await page.getByLabel('Wallet address or transaction hash').fill(fixture.tx.hash);
      await page.getByRole('button', { name: 'Verify transaction', exact: true }).click();
      await page.getByRole('heading', { name: 'Pending', exact: true }).waitFor();
      const before = rpcReads;
      await page.waitForTimeout(16000);
      await page.getByRole('heading', { name: 'Pending', exact: true }).waitFor();
      assert.ok(rpcReads > before);
      assert.equal(
        await page.getByRole('button', { name: 'Record settlement · +90 XP', exact: true }).count(),
        0,
      );
      for (const [m, state] of [
        ['failed', 'Failed'],
        ['missing', 'Not found'],
      ]) {
        mode = m;
        await page.getByRole('button', { name: 'Refresh receipt', exact: true }).click();
        await page.getByRole('heading', { name: state, exact: true }).waitFor();
      }
      mode = 'reorg';
      await page.getByRole('button', { name: 'Refresh receipt', exact: true }).click();
      await page
        .getByText('Block is no longer canonical. Refresh to recheck.', { exact: true })
        .waitFor();
      mode = 'offline';
      await page.getByRole('button', { name: 'Verify transaction', exact: true }).click();
      await page.locator('dialog [role=alert]').last().waitFor();
      assert.equal(
        await page.getByRole('button', { name: 'Record settlement · +90 XP', exact: true }).count(),
        0,
      );
      mode = 'forward';
    },
  );
  await check('quest categories preserve game quests and link evidence journals', async () => {
    await close();
    await page.getByRole('button', { name: 'Open quests', exact: true }).click();
    await page.getByRole('button', { name: 'Game quests', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Hamster quests', exact: true }).click();
    await page.getByRole('button', { name: 'Open hamster quests', exact: true }).waitFor();
    await page.getByRole('button', { name: 'On-chain quests', exact: true }).click();
    await page.getByRole('button', { name: 'Open on-chain quest journal', exact: true }).click();
    await page.getByRole('heading', { name: 'Settlement scout', exact: true }).count();
    await page
      .getByText(/Unlocked locally/)
      .first()
      .waitFor();
  });
  await check('reflow, light/dark, reduced motion and local resource integrity', async () => {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await nav('Check transaction').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await page.locator('dialog').evaluate((d) => d.scrollWidth <= d.clientWidth + 1));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    await shot('checker-dark-mobile');
    await page.keyboard.press('Tab');
    await shot('keyboard-focus');
    await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
  });
  await context.close();
  // Provider simulation only: no external account, stored private key or real wallet transaction.
  await check(
    'EIP-6963 discovery, rejection, network add/switch, message proof, account change and disconnect (simulated wallet)',
    async () => {
      const accountsModule = pathToFileURL(
        resolve('test/scratch/wallet/node_modules/viem/_esm/accounts/index.js'),
      ).href;
      const { generatePrivateKey, privateKeyToAccount } = await import(accountsModule);
      const ephemeral = privateKeyToAccount(generatePrivateKey());
      const c = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        ignoreHTTPSErrors: true,
      });
      await attachTransport(c);
      page = await c.newPage();
      page.setDefaultTimeout(15000);
      await page.exposeFunction('squeekTestSign', (raw) =>
        ephemeral.signMessage({ message: { raw } }),
      );
      await page.addInitScript(
        ({ address }) => {
          const listeners = {};
          const state = {
            address,
            chain: '0x1',
            authorized: false,
            reject: true,
            unknown: true,
            methods: [],
          };
          window.squeekTestWallet = state;
          const emit = (event, data) => (listeners[event] || []).forEach((fn) => fn(data));
          const provider = {
            on: (event, fn) => (listeners[event] ||= []).push(fn),
            removeListener: (event, fn) => {
              listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
            },
            request: async ({ method, params }) => {
              state.methods.push(method);
              if (method === 'eth_accounts') return state.authorized ? [state.address] : [];
              if (method === 'eth_chainId') return state.chain;
              if (method === 'eth_requestAccounts') {
                if (state.reject)
                  throw Object.assign(new Error('Request rejected'), { code: 4001 });
                state.authorized = true;
                return [state.address];
              }
              if (method === 'wallet_switchEthereumChain') {
                if (state.unknown) {
                  state.unknown = false;
                  throw Object.assign(new Error('Unknown chain'), { code: 4902 });
                }
                state.chain = params[0].chainId;
                emit('chainChanged', state.chain);
                return null;
              }
              if (method === 'wallet_addEthereumChain') {
                state.added = params[0];
                state.chain = params[0].chainId;
                emit('chainChanged', state.chain);
                return null;
              }
              if (method === 'personal_sign') {
                if (state.reject)
                  throw Object.assign(new Error('Request rejected'), { code: 4001 });
                return window.squeekTestSign(params[0]);
              }
              if (method === 'wallet_revokePermissions') {
                state.authorized = false;
                return null;
              }
              throw new Error('Unsupported test wallet method: ' + method);
            },
          };
          window.squeekTestChange = (address) => {
            state.address = address;
            emit('accountsChanged', [address]);
          };
          const info = {
            uuid: crypto.randomUUID(),
            name: 'Validation wallet',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
            rdns: 'test.squeekquest.wallet',
          };
          const announce = () =>
            window.dispatchEvent(
              new CustomEvent('eip6963:announceProvider', { detail: { info, provider } }),
            );
          window.addEventListener('eip6963:requestProvider', announce);
          announce();
        },
        { address: ephemeral.address },
      );
      await go();
      await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
      await page.getByRole('button', { name: 'Validation wallet', exact: true }).click();
      await page.locator('dialog [role=alert]').last().waitFor();
      await page.evaluate(() => (window.squeekTestWallet.reject = false));
      await page.getByRole('button', { name: 'Validation wallet', exact: true }).click();
      await page.getByRole('button', { name: 'Switch to Sepolia', exact: true }).last().waitFor();
      await page.getByRole('button', { name: 'Switch to Sepolia', exact: true }).last().click();
      await page.getByText('Connected · Sepolia', { exact: true }).waitFor();
      const added = await page.evaluate(() => window.squeekTestWallet.added);
      assert.equal(added.chainId, '0xaa36a7');
      assert.deepEqual(added.rpcUrls, ['https://eth-sepolia.blockscout.com/api/eth-rpc']);
      await page.getByRole('button', { name: 'Open Web3 profile', exact: true }).click();
      await page.getByRole('button', { name: 'Sign ownership message', exact: true }).click();
      await page
        .getByRole('button', { name: 'Ownership verified', exact: true })
        .waitFor({ timeout: 30000 });
      await page.evaluate((address) => window.squeekTestChange(address), accountFixture.account);
      await page.getByRole('button', { name: 'My wallet', exact: true }).click();
      await page.getByRole('button', { name: 'Sign ownership message', exact: true }).waitFor();
      await close();
      await page.getByRole('button', { name: /Wallet 0x.*connected/ }).click();
      await page.getByRole('button', { name: 'Disconnect wallet', exact: true }).click();
      await page.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
      const methods = await page.evaluate(() => window.squeekTestWallet.methods);
      assert.ok(methods.includes('personal_sign'));
      assert.ok(
        !methods.some((m) =>
          /sendTransaction|sendRawTransaction|signTransaction|requestPrivate/.test(m),
        ),
      );
      await c.close();
    },
  );
  limitations.push(
    'Wallet prompts used a controlled EIP-6963 provider and an ephemeral in-memory signer. No physical extension, mobile app, passkey account or paid transaction was used.',
  );
  limitations.push(
    'Real-response browser tests forward unmodified public HTTP responses through Node because this sandbox’s direct Chromium API requests return ERR_EMPTY_RESPONSE. The production export fetches the official services directly.',
  );
} catch (e) {
  results.push({ name: 'browser harness', passed: false, error: e.message.slice(0, 1500) });
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await mkdir('artifacts', { recursive: true });
  const report = {
    checkedAt: new Date().toISOString(),
    engine,
    scope:
      'Production export at /preview/. Real responses and clearly isolated controlled transport/provider cases.',
    results,
    errors,
    localFailures: failures,
    liveReads,
    recoveredReads,
    verifiedLiveHashes,
    limitations,
    passed:
      results.length > 0 && results.every((r) => r.passed) && !errors.length && !failures.length,
  };
  await writeFile(`artifacts/web3-${engine}.json`, JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}
