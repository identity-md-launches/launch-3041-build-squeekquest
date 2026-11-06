import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  achievements,
  award,
  bound,
  freshSave,
  hasQuest,
  level,
  loadSave,
  near,
  stepToward,
  totalXp,
} from '../src/lib/game';

test('daily rewards are idempotent and reset on UTC date boundaries', () => {
  let s = award(freshSave(), 'forage', 'five seeds', '2026-11-06');
  assert.equal(totalXp(s), 80);
  assert.equal(award(s, 'forage', 'duplicate', '2026-11-06'), s);
  assert.equal(hasQuest(s, 'forage', '2026-11-06'), true);
  s = award(s, 'forage', 'next day', '2026-11-07');
  assert.equal(totalXp(s), 160);
});
test('XP, levels and achievements derive from earned quest receipts', () => {
  let s = freshSave();
  for (const q of ['forage', 'block-scout', 'signal-hunter', 'squeek-friend'] as const)
    s = award(s, q, 'evidence');
  assert.equal(totalXp(s), 450);
  assert.equal(level(s), 2);
  assert.equal(achievements(s).find((a) => a.id === 'well-rounded')?.earned, true);
});
test('damaged, unknown-version and malformed browser storage recover safely', () => {
  for (const raw of [
    'not json',
    'null',
    '{}',
    '{"version":2}',
    JSON.stringify({ ...freshSave(), name: 42 }),
  ])
    assert.deepEqual(loadSave(raw), freshSave());
  assert.deepEqual(loadSave(JSON.stringify(freshSave())), freshSave());
});
test('movement reaches its destination without skipping tiles and stays in bounds', () => {
  let p = { x: 3, y: 8 };
  let steps = 0;
  const target = { x: 12, y: 3 };
  while (p.x !== target.x || p.y !== target.y) {
    const next = stepToward(p, target);
    assert.equal(Math.abs(next.x - p.x) + Math.abs(next.y - p.y), 1);
    p = next;
    steps++;
    assert.ok(steps < 30);
  }
  assert.equal(steps, 14);
  assert.deepEqual(bound({ x: -20, y: 100 }), { x: 1, y: 9 });
  assert.ok(near(p, { x: 12, y: 4 }));
});
test('bounded discovery history preserves lifetime XP and unlocked achievements', () => {
  const s = freshSave();
  s.receipts = Array.from({ length: 1000 }, (_, i) => ({
    quest: 'forage',
    date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10),
    evidence: 'unit test forage',
    earnedAt: '2026-11-06T00:00:00.000Z',
  }));
  s.unlocked = ['chain-scout'];
  const next = award(s, 'block-scout', 'unit test receipt', '2026-11-06');
  assert.equal(next.receipts.length, 1000);
  assert.equal(next.archivedXp, 80);
  assert.equal(totalXp(next), 80120);
  assert.ok(achievements(next).find((a) => a.id === 'chain-scout')?.earned);
});
