import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DataError, Endpoint, formatSqk, formatUint, validate } from '../src/lib/api';

const fixture = (key: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${key}.json`, import.meta.url), 'utf8'));
test('all eight captured real API responses pass the application validators', () => {
  for (const key of [
    'status',
    'core',
    'events',
    'stats',
    'blocks',
    'economy',
    'settlements',
    'nft',
  ] as Endpoint[])
    assert.ok(validate(key, fixture(key)));
});
test('unavailable is an error and is never interpreted as empty or zero', () => {
  assert.throws(
    () =>
      validate('economy', {
        schemaVersion: 3,
        status: 'unavailable',
        reason: 'indexer_unavailable',
      }),
    DataError,
  );
});
test('rejects wrong chain, version, deployment and unsafe event provenance', () => {
  const wrongChain = fixture('events');
  wrongChain.chain.chainId = '1';
  assert.throws(() => validate('events', wrongChain));
  const wrongVersion = fixture('events');
  wrongVersion.schemaVersion = 3;
  assert.throws(() => validate('events', wrongVersion));
  const wrongDeployment = fixture('events');
  wrongDeployment.deployment.revision = 8;
  assert.throws(() => validate('events', wrongDeployment));
  const unsafe = fixture('events');
  unsafe.events[0].source.blockNumber = (BigInt(unsafe.chain.safeThroughBlock) + 1n).toString();
  assert.throws(() => validate('events', unsafe));
  const mismatched = fixture('core');
  mismatched.identities.core = 'not-an-address';
  assert.throws(() => validate('core', mismatched));
});
test('rejects impossible settlement ranges', () => {
  const data = fixture('settlements');
  data.recentSettlements[0].completedBlockCount = '99999';
  assert.throws(() => validate('settlements', data));
});
test('formats large blockchain integers without float precision loss', () => {
  assert.equal(formatSqk('214188859285691262889981289'), '214,188,859.28');
  assert.equal(formatSqk('1000000000000000001', 18), '1.000000000000000001');
  assert.equal(formatUint('9007199254740993'), '9,007,199,254,740,993');
  assert.equal(formatUint(undefined), 'Unavailable');
  assert.equal(formatSqk(null), 'Unavailable');
});
