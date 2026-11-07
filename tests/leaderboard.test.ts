import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getRankings } from '../src/web3/service';

const real = JSON.parse(
  await readFile(new URL('./fixtures/web3-players.json', import.meta.url), 'utf8'),
);
const clone = () => JSON.parse(JSON.stringify(real));
test('community rank ignores duplicate log entries and counts unique transactions', async (t) => {
  const d = clone();
  d.events.push(d.events[0]);
  const mixedCase = JSON.parse(JSON.stringify(d.events[0]));
  mixedCase.source.blockHash = '0x' + mixedCase.source.blockHash.slice(2).toUpperCase();
  mixedCase.source.transactionHash = '0x' + mixedCase.source.transactionHash.slice(2).toUpperCase();
  d.events.push(mixedCase);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(d), { status: 200 }));
  const ranks = await getRankings('all');
  assert.equal(ranks.count, 3);
  assert.equal(ranks.complete, true);
  assert.equal(
    ranks.rows.reduce((n, r) => n + r.actions, 0),
    3,
  );
  assert.equal(
    ranks.rows.reduce((n, r) => n + r.transactions, 0),
    3,
  );
  assert.ok(ranks.rows.every((r) => /^0x[0-9a-f]{40}$/.test(r.address)));
});
test('unsafe source blocks and another deployment cannot enter community rankings', async (t) => {
  const d = clone();
  d.events[0].source.blockNumber = String(BigInt(d.chain.safeThroughBlock) + 1n);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(d), { status: 200 }));
  await assert.rejects(getRankings('all'), /provenance/);
});
test('measurement receipts and client-reported XP are not player ranking inputs', async (t) => {
  const d = clone();
  d.events[0].source.kind = 'measurement';
  d.events[0].payload.xp = 999999;
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(d), { status: 200 }));
  await assert.rejects(getRankings('all'), /could not be validated/);
});
test('a repeated paginated feed is bounded and explicitly marked partial', async (t) => {
  const d = clone();
  d.nextCursor = 'controlled-test-cursor';
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(JSON.stringify(d), { status: 200 });
  });
  const ranks = await getRankings('all');
  assert.equal(requests, 10);
  assert.equal(ranks.complete, false);
  assert.equal(ranks.count, 3);
});
test('a changing safe snapshot cannot combine incompatible rank pages', async (t) => {
  const d = clone();
  d.nextCursor = 'controlled-test-cursor';
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    const page = JSON.parse(JSON.stringify(d));
    if (requests++) page.chain.safeThroughBlock = String(BigInt(page.chain.safeThroughBlock) + 1n);
    return new Response(JSON.stringify(page), { status: 200 });
  });
  await assert.rejects(getRankings('all'), /snapshot changed/);
});
