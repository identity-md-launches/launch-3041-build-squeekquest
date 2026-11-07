import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, CONTRACTS, type DataTypes } from '../src/lib/api';
import {
  newGame,
  readSave,
  travel,
  WORLDS,
  canStand,
  findPath,
  distance,
  movePlayer,
  craft,
  consume,
  maxHealth,
  playerLevel,
} from '../src/lib/survival';
import {
  attack,
  attackDamage,
  dodge,
  stepAdventure,
  collectDrop,
  recover,
  learn,
  skillPoints,
  equip,
  claimStory,
  resolvePulse,
} from '../src/lib/adventure';
import {
  advancePulse,
  ingestMeasurements,
  mergePulse,
  measurementView,
  readPulse,
  claimMeasurement,
  newPulse,
} from '../src/lib/chain-pulse';
const fixture = (k: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${k}.json`, import.meta.url), 'utf8'));
const now = Date.now();
const coreAt = (height: string, overrides: Record<string, unknown> = {}) => {
  const d = validate('core', fixture('core'));
  d.core.blockHeight = height;
  delete d.core.cumulativeBlockUnits;
  return { data: d, loading: false, checkedAt: now, ...overrides };
};
test('old survival v2 saves migrate combat, food, equipment and Pulse state without losing progress', () => {
  const s: any = newGame('Acorn');
  delete s.adventure;
  delete s.pulse;
  for (const k of ['sword', 'ironSword', 'armor', 'lantern']) delete s.tools[k];
  s.inventory.wood = 12;
  s.xp = 300;
  s.buildings.shelter = 1;
  const loaded = readSave(JSON.stringify(s))!;
  assert.equal(loaded.inventory.wood, 12);
  assert.equal(loaded.xp, 300);
  assert.equal(loaded.buildings.shelter, 1);
  assert.equal(loaded.adventure.hunger, 100);
  assert.equal(loaded.adventure.enemies.length, 17);
  assert.equal(loaded.pulse.cursor, null);
  assert.equal(
    readSave(JSON.stringify({ ...loaded, adventure: { ...loaded.adventure, hunger: -2 } })),
    null,
  );
});
test('weapons consume materials and equip; damage, cooldown, drops and XP are genuine and one-time', () => {
  let s = newGame();
  s.inventory = { ...s.inventory, wood: 4, stone: 2, fiber: 2 };
  s = craft(s, 'sword').save;
  assert.equal(s.adventure.weapon, 'sword');
  assert.equal(s.inventory.wood, 0);
  const e = s.adventure.enemies[0];
  s.position = { x: e.x - 35, y: e.y };
  let r = attack(s);
  assert.equal(r.save.adventure.enemies[0].hp, 11);
  assert.equal(r.save.stamina, s.stamina - 5);
  assert.equal(attack(r.save).success, false);
  s = stepAdventure(r.save, 0.1).save;
  for (let i = 0; i < 5; i++) s = stepAdventure(s, 0.1).save;
  r = attack(s);
  assert.equal(r.save.adventure.enemies[0].hp, 0);
  assert.equal(r.save.adventure.kills, 1);
  assert.equal(r.save.xp, s.xp + 30);
  const loot = collectDrop(r.save)!;
  assert.equal(loot.success, true);
  assert.equal(collectDrop(loot.save), null);
  s = { ...loot.save, stamina: 0 };
  assert.equal(attack(s).success, false);
  assert.equal(equip(newGame(), 'ironSword').success, false);
});
test('enemy AI approaches, telegraphs damage, respects dodge and pauses after death', () => {
  let s = newGame();
  s.position = { x: 650, y: 520 };
  const before = s.adventure.enemies[0].y;
  s = stepAdventure(s, 0.1).save;
  assert.ok(s.adventure.enemies[0].y > before);
  s.position = { x: s.adventure.enemies[0].x, y: s.adventure.enemies[0].y + 20 };
  for (let i = 0; i < 30; i++) s = stepAdventure(s, 0.1).save;
  assert.ok(s.health < 100);
  s.adventure.enemies[0].windup = 0.1;
  s.adventure.enemies[0].cooldown = 0;
  const hp = s.health;
  s = dodge(s).save;
  s = stepAdventure(s, 0.1).save;
  assert.equal(s.health, hp);
  assert.ok(s.adventure.dodgeTime > 0);
  s.adventure.dead = true;
  assert.deepEqual(stepAdventure(s, 0.1).save, s);
  s = recover(s).save;
  assert.equal(s.adventure.dead, false);
  assert.equal(s.area, 'forest');
  assert.equal(s.health, maxHealth(s));
});
test('Root Warden can be defeated with normal attacks and its quest can be claimed exactly once', () => {
  let s = newGame();
  s.area = 'cave';
  s.tools.ironSword = true;
  s.adventure.weapon = 'ironSword';
  const boss = s.adventure.enemies.find((e) => e.kind === 'warden')!;
  s.position = { x: boss.x - 50, y: boss.y };
  for (let hits = 0; hits < 10; hits++) {
    s = { ...s, stamina: 100, adventure: { ...s.adventure, attackCooldown: 0 } };
    s = attack(s).save;
  }
  assert.equal(s.adventure.bossDefeated, true);
  assert.equal(s.adventure.enemies.find((e) => e.kind === 'warden')!.hp, 0);
  assert.equal(s.xp, 400);
  const r = claimStory(s, 'heart');
  assert.equal(r.success, true);
  assert.equal(r.save.xp, 700);
  assert.equal(claimStory(r.save, 'heart').success, false);
  const after = attack({ ...r.save, adventure: { ...r.save.adventure, attackCooldown: 0 } }).save;
  assert.equal(after.xp, 700);
});
test('skills spend earned points, alter stats and cave unlock requires real progress and tools', () => {
  let s = newGame();
  assert.equal(skillPoints(s), 0);
  assert.equal(learn(s, 'combat').success, false);
  s.xp = 500;
  assert.equal(playerLevel(s), 3);
  s = learn(s, 'combat').save;
  assert.equal(attackDamage(s), 16);
  s = learn(s, 'vitality').save;
  assert.equal(maxHealth(s), 115);
  assert.equal(skillPoints(s), 0);
  s.area = 'wilderness';
  s.position = { ...WORLDS.wilderness.exits[1] };
  assert.equal(travel(s, WORLDS.wilderness.exits[1]).success, false);
  s.tools.pickaxe = true;
  s.tools.lantern = true;
  s = travel(s, WORLDS.wilderness.exits[1]).save;
  assert.equal(s.area, 'cave');
  assert.ok(readSave(JSON.stringify(s)));
  assert.ok(canStand(s.area, s.position));
});
test('food declines only during active simulation; eating restores food, health and stamina', () => {
  let s = newGame();
  s = stepAdventure(s, 0.1).save;
  assert.ok(s.adventure.hunger < 100);
  s.adventure.hunger = 0;
  s.health = 60;
  s.stamina = 20;
  const starved = stepAdventure(s, 0.1).save;
  assert.ok(starved.health < 60);
  const fed = consume(starved, 'berry').save;
  assert.equal(fed.adventure.hunger, 18);
  assert.equal(fed.inventory.berry, 2);
});
test('Pulse establishes a baseline, emits one event per NEW confirmed height, ignores duplicates and optimistic blocks', () => {
  let p = advancePulse(newPulse(), coreAt('1140'), now);
  assert.equal(p.events.length, 0);
  assert.equal(p.baseline, '1140');
  p = advancePulse(p, coreAt('1141'), now);
  assert.equal(p.events.length, 1);
  assert.equal(p.events[0].height, '1141');
  assert.equal(advancePulse(p, coreAt('1141'), now).events.length, 1);
  p = advancePulse(p, coreAt('1144'), now);
  assert.equal(p.events.length, 4);
  assert.equal(new Set(p.events.map((e) => e.id)).size, 4);
  assert.equal(new Set(p.events.map((e) => e.kind)).size, 4);
  const roundtrip = readPulse(JSON.stringify(p))!;
  assert.equal(advancePulse(roundtrip, coreAt('1144'), now).events.length, 4);
  assert.equal(advancePulse(p, coreAt('9999', { error: 'offline' }), now), p);
  assert.equal(advancePulse(p, coreAt('9999', { checkedAt: now - 100000 }), now), p);
  assert.equal(advancePulse(p, coreAt('1139'), now), p);
  const unsafe = coreAt('1145');
  unsafe.data.source!.blockNumber = (BigInt(unsafe.data.chain.safeThroughBlock) + 1n).toString();
  assert.equal(advancePulse(p, unsafe, now), p);
});
test('Pulse backlog is bounded, catches up without skipping heights and survives imported older saves', () => {
  let p = advancePulse(newPulse(), coreAt('100'), now);
  for (let i = 0; i < 20; i++) p = advancePulse(p, coreAt('150'), now);
  assert.equal(p.events.length, 12);
  assert.equal(p.cursor, '112');
  assert.equal(p.target, '150');
  let s = newGame();
  s.pulse = p;
  s.position = { x: p.events[0].x, y: p.events[0].y };
  const r = resolvePulse(s, p.events[0].id);
  assert.equal(r.success, true);
  assert.equal(resolvePulse(r.save, p.events[0].id).success, false);
  p = advancePulse(r.save.pulse, coreAt('150'), now);
  assert.equal(p.cursor, '113');
  const merged = mergePulse(newPulse(), p);
  assert.equal(merged.cursor, '113');
  assert.equal(merged.events.find((e) => e.height === '101')!.resolved, true);
  assert.equal(
    advancePulse(merged, coreAt('113'), now).events.filter((e) => e.height === '101').length,
    1,
  );
});
test('all four real-block world encounter types are playable and reward only once after refresh', () => {
  let pulse = advancePulse(newPulse(), coreAt('1140'), now);
  pulse = advancePulse(pulse, coreAt('1144'), now);
  for (const e of pulse.events) {
    let s = newGame();
    s.pulse = pulse;
    s.position = { x: e.x, y: e.y };
    const r = resolvePulse(s, e.id);
    assert.equal(r.success, true);
    assert.equal(r.save.pulse.completed, 1);
    const restored = readSave(JSON.stringify(r.save))!;
    assert.equal(resolvePulse(restored, e.id).success, false);
    assert.equal(restored.xp, 20);
    if (e.kind === 'wave')
      assert.equal(restored.adventure.enemies.length, s.adventure.enemies.length + 2);
    if (e.kind === 'portal') assert.notDeepEqual(restored.position, s.position);
  }
});
test('accepted real measurement schema parses; missing provenance remains unknown; receipt XP cannot replay', () => {
  const data = validate('measurements', fixture('measurements'));
  data.generatedAt = new Date(now).toISOString();
  const r = { data, loading: false, checkedAt: now };
  let p = ingestMeasurements(newPulse(), r, now);
  assert.ok(p.measurements.length > 0);
  assert.equal(p.measurements[0].provenance, 'unknown');
  assert.equal(ingestMeasurements(p, r, now), p);
  const id = p.measurements[0].id;
  p = claimMeasurement(p, id)!;
  assert.equal(claimMeasurement(p, id), null);
  assert.equal(claimMeasurement(mergePulse(newPulse(), p), id), null);
  const bad = fixture('measurements');
  bad.events[0].source.disposition = 'rejected';
  assert.throws(() => validate('measurements', bad));
});
test('live panel never converts unavailable or stale measurements to zero; preserves all provenance types', () => {
  const data = validate('status', fixture('status'));
  data.measurement!.observedAt = new Date(now).toISOString();
  const r = { data, loading: false, checkedAt: now };
  assert.equal(measurementView({ loading: false }, now).rpm, 'Unknown');
  assert.equal(measurementView({ ...r, error: 'network' }, now).status, 'UNKNOWN');
  data.measurement!.observedAt = new Date(now - 130000).toISOString();
  assert.equal(measurementView(r, now).known, false);
  data.measurement!.observedAt = new Date(now).toISOString();
  for (const kind of ['hardware', 'simulated', 'replay', 'derived'] as const) {
    data.measurement!.provenance = kind;
    assert.equal(measurementView(r, now).provenance, kind);
  }
});

test('retired Pulse receipts cannot be resurrected by importing an old save after journal pruning', () => {
  let p = advancePulse(newPulse(), coreAt('100'), now);
  p = advancePulse(p, coreAt('101'), now);
  const old = JSON.parse(JSON.stringify(p));
  let s = newGame();
  s.pulse = p;
  s.position = { x: p.events[0].x, y: p.events[0].y };
  s = resolvePulse(s, p.events[0].id).save;
  // Simulate the documented short display journal pruning; the durable cursor is retained.
  const retired = { ...s.pulse, events: [] };
  const merged = mergePulse(old, retired);
  s.pulse = merged;
  assert.equal(resolvePulse(s, old.events[0].id).success, false);
  assert.equal(advancePulse(merged, coreAt('101'), now).cursor, '101');
});
test('safe snapshots below a previously confirmed target cannot emit unconfirmed backlog heights', () => {
  let p = advancePulse(newPulse(), coreAt('100'), now);
  p = advancePulse(p, coreAt('120'), now);
  assert.equal(p.cursor, '104');
  const previous = JSON.stringify(p);
  assert.equal(JSON.stringify(advancePulse(p, coreAt('106'), now)), previous);
});

test('bark armor reduces telegraphed combat damage without consuming inventory', () => {
  const plain = newGame();
  plain.position = { x: 650, y: 485 };
  plain.adventure.enemies[0].windup = 0.05;
  plain.adventure.enemies[0].cooldown = 0;
  const armored = structuredClone(plain);
  armored.adventure.armored = true;
  armored.tools.armor = true;
  const a = stepAdventure(plain, 0.1).save,
    b = stepAdventure(armored, 0.1).save;
  assert.ok(b.health > a.health && b.health < 100);
  assert.deepEqual(b.inventory, armored.inventory);
});
