import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  checkTransactionRpc as checkTransaction,
  checkExplorerTransaction,
  validateAccount,
  validateActivity,
  type VerifiedTransaction,
} from '../src/web3/service';
import { evidenceFor, readEvidence } from '../src/web3/evidence';
import { CONTRACTS } from '../src/lib/api';
import { NETWORK } from '../src/web3/network';
import type { WalletRuntime, DecodedEvent } from '../src/web3/runtime';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/web3-receipt.json', import.meta.url), 'utf8'),
);
const account = JSON.parse(
  await readFile(new URL('./fixtures/web3-account.json', import.meta.url), 'utf8'),
);
const activity = JSON.parse(
  await readFile(new URL('./fixtures/web3-activity.json', import.meta.url), 'utf8'),
);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const hash = fixture.tx.hash;
const decoder = async (): Promise<Pick<WalletRuntime, 'decode' | 'hashCode'>> => ({
  hashCode: () => NETWORK.coreRuntimeHash,
  decode: (): DecodedEvent[] => [
    { name: 'BatchSettled', contract: CONTRACTS.core, args: {}, logIndex: '295' },
    { name: 'RoundRecorded', contract: CONTRACTS.core, args: { work: '353' }, logIndex: '294' },
  ],
});
function transport(data = clone(fixture), chain = '0xaa36a7') {
  return async (_url: unknown, init?: RequestInit) => {
    const { method } = JSON.parse(String(init?.body));
    const responses: Record<string, unknown> = {
      eth_chainId: chain,
      eth_getTransactionByHash: data.tx,
      eth_getTransactionReceipt: data.receipt,
      eth_blockNumber: data.head,
      eth_getBlockByNumber: data.canonical,
      eth_getStorageAt: data.implementation,
      eth_getCode: data.code,
    };
    assert.ok(method in responses, `Unexpected or mutating method: ${method}`);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: responses[method] }), {
      status: 200,
    });
  };
}
test('real captured successful settlement passes canonical receipt checks', async (t) => {
  t.mock.method(globalThis, 'fetch', transport());
  const tx = await checkTransaction(hash, decoder);
  assert.equal(tx.status, 'Confirmed');
  assert.equal(tx.settlement, true);
  assert.equal(tx.blockNumber, BigInt(fixture.receipt.blockNumber).toString());
  assert.equal(tx.from, fixture.tx.from);
  assert.ok(tx.confirmations >= 12);
});
test('unknown transaction is not called pending or confirmed', async (t) => {
  const d = clone(fixture);
  d.tx = null;
  d.receipt = null;
  t.mock.method(globalThis, 'fetch', transport(d));
  assert.equal((await checkTransaction(hash, decoder)).status, 'Not found');
});
test('known mempool transaction stays pending and has no evidence', async (t) => {
  const d = clone(fixture);
  d.tx.blockNumber = null;
  d.tx.blockHash = null;
  d.receipt = null;
  t.mock.method(globalThis, 'fetch', transport(d));
  const tx = await checkTransaction(hash, decoder);
  assert.equal(tx.status, 'Pending');
  assert.equal(tx.settlement, false);
  assert.deepEqual(tx.events, []);
});
test('successful transaction below twelve confirmations cannot earn progress', async (t) => {
  const d = clone(fixture);
  d.head = d.receipt.blockNumber;
  t.mock.method(globalThis, 'fetch', transport(d));
  const tx = await checkTransaction(hash, decoder);
  assert.equal(tx.status, 'Pending');
  assert.equal(tx.confirmations, 1);
  assert.equal(tx.settlement, false);
  assert.throws(() => evidenceFor(tx, []), /confirmed settlement/);
});
test('reverted receipt is failed and cannot earn progress', async (t) => {
  const d = clone(fixture);
  d.receipt.status = '0x0';
  t.mock.method(globalThis, 'fetch', transport(d));
  const tx = await checkTransaction(hash, decoder);
  assert.equal(tx.status, 'Failed');
  assert.equal(tx.events.length, 0);
  assert.throws(() => evidenceFor(tx, []), /confirmed settlement/);
});
test('wrong RPC chain rejects a real hash', async (t) => {
  t.mock.method(globalThis, 'fetch', transport(clone(fixture), '0x1'));
  await assert.rejects(checkTransaction(hash, decoder), /network mismatch/);
});
test('receipt from another transaction is rejected', async (t) => {
  const d = clone(fixture);
  d.receipt.transactionHash = fixture.canonical.hash;
  t.mock.method(globalThis, 'fetch', transport(d));
  await assert.rejects(checkTransaction(hash, decoder), /identity mismatch/);
});
test('a reorg invalidates the receipt', async (t) => {
  const d = clone(fixture);
  d.canonical.hash = fixture.canonical.parentHash;
  t.mock.method(globalThis, 'fetch', transport(d));
  await assert.rejects(checkTransaction(hash, decoder), /canonical/);
});
test('unrecognized receipt status is not approved', async (t) => {
  const d = clone(fixture);
  d.receipt.status = '0x2';
  t.mock.method(globalThis, 'fetch', transport(d));
  await assert.rejects(checkTransaction(hash, decoder), /Unknown receipt status/);
});
test('a changed core implementation cannot verify a settlement', async (t) => {
  const d = clone(fixture);
  d.implementation = d.code;
  t.mock.method(globalThis, 'fetch', transport(d));
  await assert.rejects(checkTransaction(hash, decoder), /implementation differs/);
});
test('a changed implementation runtime cannot verify a settlement', async (t) => {
  t.mock.method(globalThis, 'fetch', transport());
  await assert.rejects(
    checkTransaction(hash, async () => ({
      ...(await decoder()),
      hashCode: () => fixture.canonical.hash,
    })),
    /code differs/,
  );
});
test('unrelated successful transaction is confirmed without inventing a settlement', async (t) => {
  t.mock.method(globalThis, 'fetch', transport());
  const tx = await checkTransaction(hash, async () => ({ ...(await decoder()), decode: () => [] }));
  assert.equal(tx.status, 'Confirmed');
  assert.equal(tx.settlement, false);
  assert.throws(() => evidenceFor(tx, []));
});
test('transport and RPC failures never turn into confirmation', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ error: { code: -32000, message: 'unavailable' } }), {
        status: 200,
      }),
  );
  await assert.rejects(checkTransaction(hash, decoder), /could not complete/);
});
test('invalid input sends no RPC request', async (t) => {
  const f = t.mock.method(globalThis, 'fetch', transport());
  await assert.rejects(checkTransaction('not-a-hash', decoder), /transaction hash/);
  assert.equal(f.mock.callCount(), 0);
});
test('settlement journal rejects duplicates across wallets and rejects stale verification', async (t) => {
  t.mock.method(globalThis, 'fetch', transport());
  const tx = await checkTransaction(hash, decoder);
  const entry = evidenceFor(tx, [], account.account);
  assert.equal(entry.reward, 90);
  assert.equal(entry.rounds, 1);
  assert.throws(() => evidenceFor(tx, [entry], fixture.tx.from), /already earned/);
  assert.throws(() => evidenceFor({ ...tx, checkedAt: Date.now() - 31000 }, []), /fresh/);
  assert.deepEqual(readEvidence(JSON.stringify([entry])), [entry]);
});
test('journal corruption is surfaced instead of silently forgetting rewarded hashes', () => {
  assert.throws(() => readEvidence('{'));
  assert.throws(() => readEvidence('[{}]'), /damaged/);
  assert.deepEqual(readEvidence(null), []);
});
test('captured account and activity validate only for their requested wallet', () => {
  assert.equal(validateAccount(account, account.account).tokens.length, account.tokens.length);
  assert.equal(
    validateActivity(activity, account.account).activity.length,
    activity.activity.length,
  );
  assert.throws(() => validateAccount(account, fixture.tx.from), /identity mismatch/);
  assert.throws(() => validateActivity(activity, fixture.tx.from), /safe account snapshot/);
});
test('account responses from another chain or release and unsafe activity are rejected', () => {
  const a = clone(account);
  a.chain.chainId = '1';
  assert.throws(() => validateAccount(a, account.account));
  const b = clone(account);
  b.release.id = 'unsupported';
  assert.throws(() => validateAccount(b, account.account));
  const c = clone(activity);
  c.chain.safeThroughBlock = '1';
  assert.throws(() => validateActivity(c, account.account));
});
test('NFT duplicate ownership rows are rejected', () => {
  const d = clone(account);
  d.tokens.push(d.tokens[0]);
  assert.throws(() => validateAccount(d, account.account), /Invalid NFT/);
});

const rest = JSON.parse(
  await readFile(new URL('./fixtures/web3-explorer.json', import.meta.url), 'utf8'),
);
function restTransport(data = clone(rest)) {
  return async (url: unknown) => {
    const u = String(url);
    let body;
    if (u.includes('/transactions/') && u.includes('/logs')) body = data.logs;
    else if (u.includes('/transactions/')) body = data.tx;
    else if (u.includes('/blocks/')) body = data.block;
    else if (u.includes('/v1/core')) body = data.core;
    else if (u.includes('/v1/settlements')) body = data.settlements;
    else throw new Error('Unexpected source: ' + u);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
test('official explorer REST fallback requires matching canonical logs and safe settlement history', async (t) => {
  t.mock.method(globalThis, 'fetch', restTransport());
  const tx = await checkExplorerTransaction(hash, decoder);
  assert.equal(tx.status, 'Confirmed');
  assert.equal(tx.settlement, true);
  assert.equal(tx.readSource, 'Official explorer API');
  assert.match(tx.verificationNote!, /Historical proxy storage was not read/);
});
test('explorer fallback never promotes a pending or reverted transaction', async (t) => {
  const d = clone(rest);
  d.tx.block_number = null;
  d.tx.confirmations = 0;
  t.mock.method(globalThis, 'fetch', restTransport(d));
  assert.equal((await checkExplorerTransaction(hash, decoder)).status, 'Pending');
});
test('explorer fallback rejects logs from another block', async (t) => {
  const d = clone(rest);
  d.logs.items[0].block_hash = fixture.canonical.parentHash;
  t.mock.method(globalThis, 'fetch', restTransport(d));
  await assert.rejects(checkExplorerTransaction(hash, decoder), /canonical block/);
});
test('explorer fallback cannot award a receipt absent from official safe history', async (t) => {
  const d = clone(rest);
  d.settlements.recentSettlements = [];
  t.mock.method(globalThis, 'fetch', restTransport(d));
  const tx = await checkExplorerTransaction(hash, decoder);
  assert.equal(tx.status, 'Confirmed');
  assert.equal(tx.settlement, false);
  assert.throws(() => evidenceFor(tx, []));
});
test('explorer fallback cannot reward a receipt below twelve confirmations', async (t) => {
  const d = clone(rest);
  d.tx.confirmations = 11;
  t.mock.method(globalThis, 'fetch', restTransport(d));
  const tx = await checkExplorerTransaction(hash, decoder);
  assert.equal(tx.status, 'Pending');
  assert.equal(tx.settlement, false);
});
