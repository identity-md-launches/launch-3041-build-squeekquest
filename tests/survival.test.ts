import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recover } from '../src/lib/adventure';
import { addRun, award, freshSave } from '../src/lib/game';
import {
  BUILDINGS,
  BURROW,
  HEIGHT,
  RECIPES,
  SPAWN,
  TILE,
  WIDTH,
  WORLDS,
  afford,
  bagCount,
  build,
  canStand,
  capacity,
  claimQuest,
  consume,
  craft,
  discard,
  distance,
  findPath,
  gather,
  harvest,
  maxHealth,
  maxStamina,
  migrateLegacy,
  movePlayer,
  newGame,
  readSave,
  recordRun,
  rest,
  rollDaily,
  survivalAchievements,
  tick,
  travel,
  type Area,
  type SurvivalSave,
  type Vec,
} from '../src/lib/survival';

const rich = (): SurvivalSave => {
  const s = newGame();
  for (const k of Object.keys(s.inventory) as (keyof typeof s.inventory)[]) s.inventory[k] = 50;
  return s;
};
function walk(s: SurvivalSave, goal: Vec) {
  const path = findPath(s.area, s.position, goal);
  let frames = 0;
  for (const point of path) {
    let previous = Infinity,
      stuck = 0;
    while (distance(s.position, point) > 4) {
      const d = distance(s.position, point);
      s = movePlayer(s, point.x - s.position.x, point.y - s.position.y, 1 / 60, false);
      if (Math.abs(previous - d) < 0.001) stuck++;
      else stuck = 0;
      previous = d;
      assert.ok(
        stuck < 10,
        `path stuck at ${s.area} ${JSON.stringify(s.position)} toward ${JSON.stringify(point)}`,
      );
      assert.ok(frames++ < 4000, 'path must terminate');
    }
  }
  return s;
}

test('survival save round-trips world, inventory, costs, position, quests, settings and runs', () => {
  const s = newGame('Pip');
  s.position = { x: 360, y: 460 };
  s.inventory.wood = 15;
  s.buildings.chest = 2;
  s.tools.axe = true;
  s.daily.gathered = 12;
  s.depleted['forest-wood-12-13'] = 60;
  s.xp = 310;
  assert.deepEqual(readSave(JSON.stringify(s)), s);
  for (const raw of [
    null,
    'not json',
    '{}',
    '{"version":3}',
    JSON.stringify({ ...s, inventory: { wood: -1 } }),
    JSON.stringify({ ...s, position: { x: Infinity, y: 2 } }),
  ])
    assert.equal(readSave(raw), null);
  const moved = readSave(JSON.stringify({ ...s, position: BURROW }))!;
  assert.deepEqual(moved.position, SPAWN);
});
test('previous project saves retain names, XP, achievements, preferences and foraging records', () => {
  let old = award(freshSave(), 'forage', 'legacy run');
  old = addRun(old, 5, 22);
  old.name = 'Pip';
  old.theme = 'dark';
  const s = migrateLegacy(JSON.stringify(old))!;
  assert.equal(s.xp, 80);
  assert.equal(s.name, 'Pip');
  assert.equal(s.runs.length, 1);
  assert.equal(s.theme, 'dark');
  assert.ok(s.legacyAchievements.includes('first-forage'));
  assert.equal(migrateLegacy('bad'), null);
  assert.equal(migrateLegacy('{"version":1}'), null);
});
test('movement is smooth, normalized diagonally, and sprint spends real stamina', () => {
  const s = newGame();
  s.position = { x: 650, y: 450 };
  const straight = movePlayer(s, 1, 0, 0.02, false),
    diagonal = movePlayer(s, 1, 1, 0.02, false),
    sprint = movePlayer(s, 1, 0, 0.02, true);
  assert.ok(
    Math.abs(distance(s.position, straight.position) - distance(s.position, diagonal.position)) <
      0.001,
  );
  assert.ok(straight.position.x > s.position.x && straight.position.x < s.position.x + 3);
  assert.ok(distance(s.position, sprint.position) > distance(s.position, straight.position));
  assert.ok(sprint.stamina < s.stamina);
  assert.equal(movePlayer(s, 0, 0, 0.02, false), s);
});
test('collision prevents water, walls, tree trunks, burrow and boundaries from being crossed', () => {
  for (const [area, point] of [
    ['forest', { x: 650, y: 250 }],
    ['village', { x: 250, y: 220 }],
    ['forest', WORLDS.forest.nodes[0]],
    ['forest', BURROW],
    ['wilderness', { x: 0, y: 0 }],
  ] as [Area, Vec][])
    assert.equal(canStand(area, point), false);
  let s = newGame();
  s.position = { x: 630, y: 270 };
  for (let i = 0; i < 120; i++) s = movePlayer(s, 1, 0, 1 / 60, false);
  assert.ok(s.position.x < 640);
  s.position = { x: WIDTH - 42, y: 400 };
  for (let i = 0; i < 120; i++) s = movePlayer(s, 1, 0, 1 / 60, false);
  assert.ok(s.position.x <= WIDTH - TILE - 8);
  assert.ok(HEIGHT > 0);
});
test('actual movement follows collision-aware paths to every exit and every resource node', () => {
  for (const area of ['forest', 'village', 'wilderness', 'cave'] as Area[]) {
    const initial = newGame();
    initial.area = area;
    initial.position = area === 'forest' ? { ...SPAWN } : { x: 3.5 * TILE, y: 13.5 * TILE };
    for (const exit of WORLDS[area].exits)
      assert.ok(distance(walk(initial, exit).position, exit) < 60, `${area} exit ${exit.name}`);
    for (const node of WORLDS[area].nodes)
      assert.ok(
        distance(walk(initial, node).position, node) < 58,
        `${area} resource ${node.id} unreachable`,
      );
  }
});
test('gathering checks range, tool, cooldown, stamina and capacity without losing resources', () => {
  let s = newGame();
  const n = WORLDS.forest.nodes.find((n) => n.kind === 'wood')!;
  assert.equal(gather(s, n.id).success, false);
  s.position = { x: n.x - 32, y: n.y };
  const r = gather(s, n.id);
  assert.equal(r.save.inventory.wood, 2);
  assert.equal(r.save.stamina, 92);
  assert.equal(r.save.daily.gathered, 2);
  assert.equal(gather(r.save, n.id).success, false);
  s = { ...r.save, playSeconds: 75, tools: { ...r.save.tools, axe: true } };
  assert.equal(gather(s, n.id).save.inventory.wood, 6);
  s.stamina = 0;
  assert.equal(gather(s, n.id).success, false);
  s.stamina = 100;
  s.inventory.wood = capacity(s);
  assert.equal(gather(s, n.id).success, false);
  s = newGame();
  s.area = 'wilderness';
  const ore = WORLDS.wilderness.nodes.find((n) => n.kind === 'ore')!;
  s.position = { x: ore.x - 32, y: ore.y };
  assert.equal(gather(s, ore.id).success, false);
  s.tools.pickaxe = true;
  assert.equal(gather(s, ore.id).save.inventory.ore, 2);
});
test('recipes consume exact costs atomically, tools equip once, and advanced crafting needs home', () => {
  let s = newGame();
  s.inventory = { ...s.inventory, wood: 6, stone: 3, fiber: 2 };
  const before = { ...s.inventory };
  const r = craft(s, 'axe');
  assert.equal(r.success, true);
  assert.equal(r.save.inventory.wood, 0);
  assert.equal(r.save.inventory.stone, 0);
  assert.equal(r.save.inventory.fiber, 0);
  assert.equal(r.save.tools.axe, true);
  assert.equal(r.save.daily.crafted, 1);
  assert.equal(r.save.xp, 15);
  assert.deepEqual(s.inventory, before);
  assert.equal(craft(r.save, 'axe').save, r.save);
  assert.equal(craft(newGame(), 'pickaxe').success, false);
  s = newGame();
  s.inventory.wood = 3;
  const plank = craft(s, 'plank');
  assert.equal(plank.save.inventory.plank, 2);
  assert.equal(plank.save.inventory.wood, 0);
  s = rich();
  s.area = 'village';
  assert.equal(craft(s, 'backpack').success, false);
  s = newGame();
  s.position = { x: BURROW.x + 70, y: BURROW.y + 40 };
  s.inventory.fiber = 10;
  s.inventory.plank = 4;
  s.inventory.ore = 3;
  assert.equal(craft(s, 'backpack').success, true);
  assert.equal(RECIPES.length, 10);
});
test('build and upgrade all four structures use exact costs and apply actual benefits', () => {
  for (const key of Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]) {
    let s = rich();
    s.position = { x: BURROW.x + 70, y: BURROW.y + 40 };
    for (let lv = 0; lv < 3; lv++) {
      const b = BUILDINGS[key],
        before = s.inventory.wood,
        r = build(s, key);
      assert.equal(r.success, true);
      assert.equal(r.save.buildings[key], lv + 1);
      assert.equal(r.save.inventory.wood, before - (b.costs[lv].wood ?? 0));
      s = r.save;
    }
    assert.equal(build(s, key).success, false);
    assert.ok(survivalAchievements(s).find((a) => a.name === 'A place to thrive')?.earned);
    if (key === 'chest') assert.equal(capacity(s), 180);
    if (key === 'shelter') {
      assert.equal(maxHealth(s), 120);
      assert.equal(maxStamina(s), 120);
      s.health = 5;
      s.stamina = 1;
      assert.equal(rest(s).save.health, 120);
      assert.equal(rest(s).save.stamina, 120);
    }
  }
  const away = rich();
  away.area = 'village';
  assert.equal(build(away, 'shelter').success, false);
  assert.equal(build(newGame(), 'shelter').success, false);
});
test('campfires heal and gardens require 90 active seconds and capacity before harvesting', () => {
  let s = newGame();
  s.buildings.campfire = 2;
  s.position = { ...BUILDINGS.campfire.position };
  s.health = 50;
  const warmed = tick(s, 0.1).save;
  assert.ok(warmed.health > 50);
  assert.ok(warmed.stamina >= s.stamina);
  s.buildings.garden = 2;
  s.position = { ...BUILDINGS.garden.position };
  s.playSeconds = 89;
  assert.equal(harvest(s).success, false);
  s.playSeconds = 90;
  assert.equal(harvest(s).save.inventory.berry, s.inventory.berry + 8);
  assert.equal(harvest(harvest(s).save).success, false);
  s.inventory.wood = capacity(s);
  assert.equal(harvest(s).success, false);
});
test('consumables, item drops, thorn damage and safe respawn preserve the expected supplies', () => {
  let s = newGame();
  s.health = 50;
  s.stamina = 20;
  const r = consume(s, 'berry');
  assert.equal(r.save.health, 60);
  assert.equal(r.save.stamina, 38);
  assert.equal(r.save.inventory.berry, 2);
  assert.equal(consume(newGame(), 'berry').success, false);
  assert.equal(discard(s, 'berry').save.inventory.berry, 2);
  assert.equal(discard(s, 'wood').success, false);
  s.position = { x: 18 * TILE, y: 12 * TILE };
  s.health = 0.1;
  s.xp = 10;
  const fallen = tick(s, 0.1);
  assert.equal(fallen.save.adventure.dead, true);
  assert.equal(fallen.save.health, 0);
  const recovered = recover(fallen.save);
  assert.equal(recovered.save.area, 'forest');
  assert.equal(recovered.save.health, 100);
  assert.equal(recovered.save.xp, 0);
  assert.deepEqual(recovered.save.inventory, s.inventory);
  assert.deepEqual(recovered.save.position, SPAWN);
});
test('travel is proximity gated, bidirectional and discovery XP is earned only once', () => {
  let s = newGame(),
    exit = WORLDS.forest.exits[0];
  assert.equal(travel(s, exit).success, false);
  s.position = { ...exit };
  s.xp = 250;
  s = travel(s, exit).save;
  assert.equal(s.area, 'village');
  assert.equal(s.xp, 285);
  assert.deepEqual(s.visited, ['forest', 'village']);
  exit = WORLDS.village.exits[1];
  s.position = { ...exit };
  s = travel(s, exit).save;
  assert.equal(s.area, 'wilderness');
  assert.equal(s.xp, 320);
  assert.equal(s.visited.length, 3);
  const back = WORLDS.wilderness.exits[0];
  s.position = { ...back };
  s = travel(s, back).save;
  assert.equal(s.area, 'village');
  assert.equal(s.xp, 320);
  assert.equal(travel(s, { ...back }).success, false);
});
test('daily quest claims are gated, idempotent and roll over without losing lifetime XP', () => {
  let s = newGame();
  assert.equal(claimQuest(s, 'gather').success, false);
  s.daily.gathered = 20;
  s = claimQuest(s, 'gather').save;
  assert.equal(s.xp, 60);
  assert.equal(claimQuest(s, 'gather').save, s);
  const rolled = rollDaily(s, '2099-01-01');
  assert.equal(rolled.daily.gathered, 0);
  assert.deepEqual(rolled.daily.claimed, []);
  assert.equal(rolled.xp, 60);
});
test('hidden rewards can be collected once, and do not vanish when inventory is full', () => {
  let s = newGame();
  const cache = WORLDS.forest.nodes.find((n) => n.kind === 'cache')!;
  s.position = { x: cache.x + 32, y: cache.y };
  s.inventory.wood = capacity(s);
  assert.equal(gather(s, cache.id).success, false);
  s.inventory.wood = 0;
  s = gather(s, cache.id).save;
  assert.equal(s.xp, 60);
  assert.equal(s.treasures.length, 1);
  assert.equal(gather(s, cache.id).success, false);
});
test('foraging minigame credits actual seeds, bounds history and grants daily XP only on claim', () => {
  let s = newGame();
  s = recordRun(s, 5, 25).save;
  assert.equal(s.inventory.seed, 5);
  assert.equal(s.daily.run, 1);
  assert.equal(s.xp, 0);
  assert.equal(claimQuest(s, 'run').save.xp, 80);
  s = claimQuest(s, 'run').save;
  s.inventory.wood = capacity(s) - bagCount(s);
  for (let i = 0; i < 60; i++) s = recordRun(s, 5, 25).save;
  assert.equal(s.runs.length, 50);
  assert.equal(s.xp, 80);
  assert.equal(bagCount(s), capacity(s));
  assert.ok(readSave(JSON.stringify(s)));
});
