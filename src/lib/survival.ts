import { z } from 'zod';
import { adventureSchema, newAdventure, newPulse, pulseSchema } from './adventure-state';
import { loadSave as loadLegacy, totalXp as legacyXp, saveSchema as legacySchema } from './game';

export const TILE = 32,
  WIDTH = 38 * TILE,
  HEIGHT = 26 * TILE;
export type Area = 'forest' | 'village' | 'wilderness' | 'cave';
export type Vec = { x: number; y: number };
export const AREA_NAMES: Record<Area, string> = {
  forest: 'Forest',
  village: 'Ancient Ruins',
  wilderness: 'Wilderness',
  cave: 'Underground Cave',
};
export const AREA_HINTS: Record<Area, string> = {
  forest: 'A quiet place to put down roots.',
  village: 'Old walls. Useful things left behind.',
  wilderness: 'Rare ore grows beyond the thorn fields.',
  cave: 'Light a lantern. The Root Warden waits below.',
};
export const ITEMS = {
  wood: {
    name: 'Wood',
    icon: 'wood',
    detail: 'Gather fallen branches. Used for tools and buildings.',
  },
  stone: {
    name: 'Stone',
    icon: 'stone',
    detail: 'Collect loose stones. A pickaxe doubles the yield.',
  },
  fiber: {
    name: 'Fiber',
    icon: 'fiber',
    detail: 'Gather tall grass. Used for bandages and shelter.',
  },
  berry: {
    name: 'Berries',
    icon: 'berry',
    detail: 'Eat to restore 10 health, 18 stamina and 18 food.',
  },
  seed: {
    name: 'Seeds',
    icon: 'seed',
    detail: 'Found in grass and seed patches. Plant a garden or make trail mix.',
  },
  herb: {
    name: 'Herbs',
    icon: 'herb',
    detail: 'A healing plant. Combine with fiber for a bandage.',
  },
  ore: {
    name: 'Iron ore',
    icon: 'ore',
    detail: 'Mine in the wilderness or cave with a pickaxe. Used for upgrades.',
  },
  plank: {
    name: 'Planks',
    icon: 'plank',
    detail: 'Crafted from wood. Strong enough for advanced structures.',
  },
  bandage: { name: 'Bandage', icon: 'bandage', detail: 'Use to restore 45 health.' },
  mix: {
    name: 'Trail mix',
    icon: 'mix',
    detail: 'Eat to restore 20 health, 60 stamina and 50 food.',
  },
} as const;
export type Item = keyof typeof ITEMS;
export type Bag = Record<Item, number>;
const itemKeys = Object.keys(ITEMS) as Item[];
const bagSchema = z.object(
  Object.fromEntries(itemKeys.map((k) => [k, z.number().int().min(0).max(9999)])) as Record<
    Item,
    z.ZodNumber
  >,
);
const vecSchema = z.object({
  x: z.number().finite().min(0).max(WIDTH),
  y: z.number().finite().min(0).max(HEIGHT),
});
const statsSchema = z.object({
  gathered: z.number().nonnegative(),
  crafted: z.number().nonnegative(),
  built: z.number().nonnegative(),
  caches: z.number().nonnegative(),
  runs: z.number().nonnegative(),
});
export const utcDay = () => new Date().toISOString().slice(0, 10);
export const BURROW: Vec = { x: 8.5 * TILE, y: 13.5 * TILE };
export const SPAWN: Vec = { x: 10.5 * TILE, y: 14.5 * TILE };
const saveSchema = z.object({
  version: z.literal(2),
  name: z.string().min(1).max(24),
  area: z.enum(['forest', 'village', 'wilderness', 'cave']),
  position: vecSchema,
  health: z.number().min(0).max(200),
  stamina: z.number().min(0).max(200),
  inventory: bagSchema,
  tools: z.object({
    axe: z.boolean(),
    pickaxe: z.boolean(),
    backpack: z.boolean(),
    sword: z.boolean().default(false),
    ironSword: z.boolean().default(false),
    armor: z.boolean().default(false),
    lantern: z.boolean().default(false),
  }),
  adventure: adventureSchema.default(() => newAdventure()),
  pulse: pulseSchema.default(() => newPulse()),
  buildings: z.object({
    shelter: z.number().int().min(0).max(3),
    campfire: z.number().int().min(0).max(3),
    chest: z.number().int().min(0).max(3),
    garden: z.number().int().min(0).max(3),
  }),
  depleted: z
    .record(z.string().max(60), z.number().nonnegative())
    .refine((v) => Object.keys(v).length <= 500),
  treasures: z.array(z.string().max(60)).max(10),
  visited: z.array(z.enum(['forest', 'village', 'wilderness', 'cave'])).max(4),
  xp: z.number().int().nonnegative().max(100000000),
  playSeconds: z.number().nonnegative(),
  gardenAt: z.number().nonnegative(),
  daily: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gathered: z.number().nonnegative(),
    crafted: z.number().nonnegative(),
    run: z.number().nonnegative(),
    claimed: z.array(z.string().max(30)).max(4),
  }),
  stats: statsSchema,
  sound: z.boolean(),
  theme: z.enum(['light', 'dark']),
  runs: z
    .array(
      z.object({
        id: z.string().max(80),
        name: z.string().max(24),
        date: z.string().max(40),
        seeds: z.number().int().min(5).max(8),
        seconds: z.number().int().min(0).max(86400),
        xp: z.literal(80),
      }),
    )
    .max(50),
  legacyAchievements: z.array(z.string().max(60)).max(10),
  savedAt: z.string().max(40),
});
export type SurvivalSave = z.infer<typeof saveSchema>;
export const SAVE_KEY = 'squeekquest.survival.v2';
export const emptyBag = (): Bag => Object.fromEntries(itemKeys.map((k) => [k, 0])) as Bag;
export function newGame(name = 'Little explorer'): SurvivalSave {
  return {
    version: 2,
    name,
    area: 'forest',
    position: { ...SPAWN },
    health: 100,
    stamina: 100,
    inventory: { ...emptyBag(), berry: 3 },
    tools: {
      axe: false,
      pickaxe: false,
      backpack: false,
      sword: false,
      ironSword: false,
      armor: false,
      lantern: false,
    },
    adventure: newAdventure(),
    pulse: newPulse(),
    buildings: { shelter: 0, campfire: 0, chest: 0, garden: 0 },
    depleted: {},
    treasures: [],
    visited: ['forest'],
    xp: 0,
    playSeconds: 0,
    gardenAt: 0,
    daily: { date: utcDay(), gathered: 0, crafted: 0, run: 0, claimed: [] },
    stats: { gathered: 0, crafted: 0, built: 0, caches: 0, runs: 0 },
    sound: false,
    theme: 'light',
    runs: [],
    legacyAchievements: [],
    savedAt: '',
  };
}
export function readSave(raw: string | null): SurvivalSave | null {
  if (!raw) return null;
  try {
    const parsed = saveSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const s = parsed.data;
    // A saved position must still be walkable, even after a map update or hand-edited save.
    if (!canStand(s.area, s.position))
      s.position = s.area === 'forest' ? { ...SPAWN } : { x: 3.5 * TILE, y: 13.5 * TILE };
    return rollDaily(s);
  } catch {
    return null;
  }
}
export function migrateLegacy(raw: string | null): SurvivalSave | null {
  if (!raw) return null;
  try {
    if (!legacySchema.safeParse(JSON.parse(raw)).success) return null;
  } catch {
    return null;
  }
  const old = loadLegacy(raw),
    s = newGame(old.name);
  return {
    ...s,
    xp: legacyXp(old),
    runs: old.runs,
    stats: { ...s.stats, runs: old.runs.length },
    legacyAchievements: old.unlocked,
    sound: old.sound,
    theme: old.theme,
  };
}
export function rollDaily(s: SurvivalSave, date = utcDay()): SurvivalSave {
  return s.daily.date === date
    ? s
    : { ...s, daily: { date, gathered: 0, crafted: 0, run: 0, claimed: [] } };
}
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const playerLevel = (s: SurvivalSave) => Math.floor(s.xp / 250) + 1;
export const maxHealth = (s: SurvivalSave) =>
  100 + (s.buildings.shelter >= 3 ? 20 : 0) + s.adventure.skills.vitality * 15;
export const maxStamina = (s: SurvivalSave) =>
  100 + (s.tools.backpack ? 20 : 0) + (s.buildings.shelter >= 2 ? 20 : 0);
export const capacity = (s: SurvivalSave) =>
  60 + (s.tools.backpack ? 40 : 0) + s.buildings.chest * 40;
export const bagCount = (s: SurvivalSave) => itemKeys.reduce((n, k) => n + s.inventory[k], 0);
export type Cost = Partial<Bag>;
export const afford = (s: SurvivalSave, cost: Cost) =>
  Object.entries(cost).every(([k, v]) => s.inventory[k as Item] >= v);
function pay(s: SurvivalSave, cost: Cost): Bag {
  const bag = { ...s.inventory };
  for (const [k, v] of Object.entries(cost)) bag[k as Item] -= v;
  return bag;
}
export type NodeKind = 'wood' | 'stone' | 'fiber' | 'berry' | 'seed' | 'herb' | 'ore' | 'cache';
export type WorldNode = Vec & { id: string; kind: NodeKind };
export type Rect = Vec & { w: number; h: number; kind: 'water' | 'wall' | 'thorns' | 'mud' };
export type Exit = Vec & { name: string; to: Area; arrival: Vec };
export type World = { nodes: WorldNode[]; rects: Rect[]; exits: Exit[] };
const p = (x: number, y: number): Vec => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
function makeWorld(area: Area): World {
  const nodes: WorldNode[] = [];
  const add = (kind: NodeKind, coords: number[][]) =>
    coords.forEach(([x, y]) => nodes.push({ ...p(x, y), kind, id: `${area}-${kind}-${x}-${y}` }));
  if (area === 'forest') {
    add('wood', [
      [12, 13],
      [13, 16],
      [9, 17],
      [7, 17],
      [5, 10],
      [6, 8],
      [9, 6],
      [14, 6],
      [16, 9],
      [19, 15],
      [20, 19],
      [25, 17],
      [28, 9],
      [30, 17],
      [25, 5],
      [31, 6],
      [17, 20],
      [5, 20],
    ]);
    add('stone', [
      [13, 12],
      [15, 16],
      [6, 15],
      [16, 7],
      [24, 19],
      [28, 16],
      [32, 8],
      [20, 6],
    ]);
    add('fiber', [
      [11, 16],
      [8, 15],
      [15, 13],
      [6, 6],
      [18, 17],
      [24, 9],
      [31, 19],
      [29, 5],
    ]);
    add('berry', [
      [11, 12],
      [7, 11],
      [17, 14],
      [26, 15],
      [30, 10],
    ]);
    add('seed', [
      [12, 16],
      [9, 15],
      [18, 9],
      [22, 19],
      [31, 15],
    ]);
    add('herb', [
      [5, 16],
      [15, 19],
      [28, 5],
    ]);
    add('cache', [[5, 5]]);
    return {
      nodes,
      rects: [
        { x: 20 * TILE, y: 7 * TILE, w: 5 * TILE, h: 5 * TILE, kind: 'water' },
        { x: 17 * TILE, y: 11 * TILE, w: 2 * TILE, h: 2 * TILE, kind: 'thorns' },
      ],
      exits: [{ ...p(36, 13), name: 'To Ancient Ruins', to: 'village', arrival: p(2, 13) }],
    };
  }
  if (area === 'village') {
    add('wood', [
      [5, 11],
      [8, 17],
      [14, 19],
      [26, 18],
      [30, 10],
      [33, 17],
      [11, 6],
      [23, 5],
      [6, 20],
    ]);
    add('stone', [
      [6, 12],
      [9, 17],
      [16, 18],
      [26, 17],
      [31, 10],
      [11, 5],
      [25, 7],
      [31, 19],
    ]);
    add('fiber', [
      [7, 14],
      [13, 20],
      [28, 12],
      [24, 8],
      [18, 9],
    ]);
    add('berry', [
      [5, 16],
      [17, 17],
      [28, 19],
    ]);
    add('seed', [
      [9, 19],
      [27, 15],
    ]);
    add('herb', [
      [14, 8],
      [30, 6],
      [24, 20],
    ]);
    add('cache', [[31, 5]]);
    return {
      nodes,
      rects: [
        { x: 7 * TILE, y: 6 * TILE, w: 5 * TILE, h: 4 * TILE, kind: 'wall' },
        { x: 16 * TILE, y: 4 * TILE, w: 4 * TILE, h: 4 * TILE, kind: 'wall' },
        { x: 22 * TILE, y: 14 * TILE, w: 4 * TILE, h: 3 * TILE, kind: 'wall' },
        { x: 12 * TILE, y: 14 * TILE, w: 2 * TILE, h: 2 * TILE, kind: 'thorns' },
        { x: 27 * TILE, y: 7 * TILE, w: 3 * TILE, h: 2 * TILE, kind: 'mud' },
      ],
      exits: [
        { ...p(1, 13), name: 'To the forest', to: 'forest', arrival: p(35, 13) },
        { ...p(20, 1), name: 'To the wilderness', to: 'wilderness', arrival: p(20, 23) },
      ],
    };
  }
  if (area === 'cave') {
    add('ore', [
      [7, 8],
      [10, 16],
      [17, 18],
      [26, 18],
      [30, 10],
      [28, 5],
    ]);
    add('herb', [
      [8, 12],
      [14, 20],
      [24, 7],
    ]);
    add('berry', [
      [4, 15],
      [12, 18],
    ]);
    add('stone', [
      [12, 7],
      [22, 19],
      [30, 17],
    ]);
    add('cache', [[32, 5]]);
    return {
      nodes,
      rects: [
        { x: 14 * TILE, y: 4 * TILE, w: 2 * TILE, h: 7 * TILE, kind: 'wall' },
        { x: 21 * TILE, y: 16 * TILE, w: 5 * TILE, h: 2 * TILE, kind: 'water' },
        { x: 23 * TILE, y: 6 * TILE, w: 2 * TILE, h: 2 * TILE, kind: 'thorns' },
      ],
      exits: [{ ...p(1, 13), name: 'To the wilderness', to: 'wilderness', arrival: p(35, 13) }],
    };
  }
  add('wood', [
    [8, 17],
    [11, 11],
    [27, 18],
    [31, 8],
    [8, 6],
    [25, 6],
    [30, 20],
  ]);
  add('stone', [
    [15, 19],
    [23, 17],
    [30, 13],
    [7, 10],
    [17, 6],
    [29, 5],
  ]);
  add('fiber', [
    [17, 21],
    [24, 21],
    [12, 16],
    [10, 7],
    [31, 15],
  ]);
  add('berry', [
    [22, 22],
    [15, 16],
    [29, 18],
  ]);
  add('herb', [
    [18, 20],
    [23, 19],
    [11, 15],
    [28, 8],
    [12, 5],
  ]);
  add('seed', [
    [19, 22],
    [8, 18],
    [32, 9],
  ]);
  add('ore', [
    [16, 20],
    [25, 20],
    [11, 12],
    [28, 11],
    [18, 5],
    [30, 5],
    [9, 8],
  ]);
  add('cache', [[32, 4]]);
  return {
    nodes,
    rects: [
      { x: 17 * TILE, y: 9 * TILE, w: 6 * TILE, h: 5 * TILE, kind: 'water' },
      { x: 13 * TILE, y: 17 * TILE, w: 3 * TILE, h: 2 * TILE, kind: 'thorns' },
      { x: 25 * TILE, y: 12 * TILE, w: 4 * TILE, h: 2 * TILE, kind: 'thorns' },
      { x: 8 * TILE, y: 12 * TILE, w: 2 * TILE, h: 2 * TILE, kind: 'mud' },
    ],
    exits: [
      { ...p(20, 24), name: 'To Ancient Ruins', to: 'village', arrival: p(20, 2) },
      { ...p(36, 13), name: 'Enter the cave', to: 'cave', arrival: p(2, 13) },
    ],
  };
}
export const WORLDS: Record<Area, World> = {
  forest: makeWorld('forest'),
  village: makeWorld('village'),
  wilderness: makeWorld('wilderness'),
  cave: makeWorld('cave'),
};
export function inside(v: Vec, r: Rect, margin = 0) {
  return (
    v.x > r.x - margin && v.x < r.x + r.w + margin && v.y > r.y - margin && v.y < r.y + r.h + margin
  );
}
export function canStand(area: Area, v: Vec, radius = 8) {
  if (
    v.x < TILE + radius ||
    v.x > WIDTH - TILE - radius ||
    v.y < TILE + radius ||
    v.y > HEIGHT - TILE - radius
  )
    return false;
  if (
    WORLDS[area].rects.some(
      (r) => (r.kind === 'water' || r.kind === 'wall') && inside(v, r, radius),
    )
  )
    return false;
  if (
    WORLDS[area].nodes.some(
      (n) => ['wood', 'stone', 'ore'].includes(n.kind) && distance(n, v) < 18 + radius,
    )
  )
    return false;
  if (area === 'forest' && distance(v, BURROW) < 27) return false;
  return true;
}
export function movePlayer(
  s: SurvivalSave,
  dx: number,
  dy: number,
  dt: number,
  sprint: boolean,
): SurvivalSave {
  if ((!dx && !dy) || s.adventure.dead) return s;
  const norm = Math.hypot(dx, dy),
    dash = sprint && s.stamina > 2;
  const mud = WORLDS[s.area].rects.some((r) => r.kind === 'mud' && inside(s.position, r));
  const speed = (s.adventure.dodgeTime > 0 ? 310 : dash ? 155 : 96) * (mud ? 0.55 : 1),
    step = Math.min(dt, 0.05) * speed;
  let { x, y } = s.position;
  if (canStand(s.area, { x: x + (dx / norm) * step, y })) x += (dx / norm) * step;
  if (canStand(s.area, { x, y: y + (dy / norm) * step })) y += (dy / norm) * step;
  return {
    ...s,
    adventure: { ...s.adventure, facing: { x: dx / norm, y: dy / norm } },
    position: { x, y },
    stamina: dash ? Math.max(0, s.stamina - 18 * dt) : s.stamina,
  };
}
/** Deterministic A* over the same collision grid used for direct movement. */
export function findPath(area: Area, start: Vec, goal: Vec): Vec[] {
  const cols = 38,
    rows = 26;
  const id = (x: number, y: number) => y * cols + x;
  const sx = Math.floor(start.x / TILE),
    sy = Math.floor(start.y / TILE);
  const gx = Math.max(1, Math.min(36, Math.floor(goal.x / TILE))),
    gy = Math.max(1, Math.min(24, Math.floor(goal.y / TILE)));
  const open = [id(sx, sy)],
    came = new Map<number, number>(),
    g = new Map([[id(sx, sy), 0]]);
  const heuristic = (n: number) => Math.abs((n % cols) - gx) + Math.abs(Math.floor(n / cols) - gy);
  let closest = open[0];
  for (let count = 0; open.length && count < cols * rows; count++) {
    open.sort((a, b) => g.get(a)! + heuristic(a) - (g.get(b)! + heuristic(b)));
    const current = open.shift()!,
      x = current % cols,
      y = Math.floor(current / cols);
    if (heuristic(current) < heuristic(closest)) closest = current;
    if (x === gx && y === gy) {
      closest = current;
      break;
    }
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + ox,
        ny = y + oy,
        n = id(nx, ny);
      if (nx < 1 || nx > 36 || ny < 1 || ny > 24 || !canStand(area, p(nx, ny))) continue;
      const next = g.get(current)! + 1;
      if (next < (g.get(n) ?? Infinity)) {
        came.set(n, current);
        g.set(n, next);
        if (!open.includes(n)) open.push(n);
      }
    }
  }
  const result: Vec[] = [];
  for (let at = closest; came.has(at); at = came.get(at)!)
    result.unshift(p(at % cols, Math.floor(at / cols)));
  return result;
}
export type Result = { save: SurvivalSave; message: string; success: boolean };
const result = (save: SurvivalSave, message: string, success = false): Result => ({
  save,
  message,
  success,
});
export const nodeReady = (s: SurvivalSave, n: WorldNode) =>
  !s.depleted[n.id] || s.depleted[n.id] <= s.playSeconds;
export function nearestNode(s: SurvivalSave) {
  return WORLDS[s.area].nodes
    .filter((n) => nodeReady(s, n) && !(n.kind === 'cache' && s.treasures.includes(n.id)))
    .sort((a, b) => distance(a, s.position) - distance(b, s.position))[0];
}
export function gather(s: SurvivalSave, nodeId?: string): Result {
  s = rollDaily(s);
  const node = nodeId ? WORLDS[s.area].nodes.find((n) => n.id === nodeId) : nearestNode(s);
  if (!node || distance(s.position, node) > 58)
    return result(s, 'Walk closer to a resource, then gather.');
  if (!nodeReady(s, node)) return result(s, 'This patch is regrowing. Try another resource.');
  if (node.kind === 'cache') {
    if (s.treasures.includes(node.id)) return result(s, 'You already found this hidden cache.');
    const loot: Cost =
      s.area === 'wilderness'
        ? { ore: 5, bandage: 2 }
        : s.area === 'village'
          ? { plank: 4, herb: 3 }
          : { seed: 5, berry: 3 };
    if (bagCount(s) + Object.values(loot).reduce((a, b) => a + b, 0) > capacity(s))
      return result(s, 'Your bag is full. Make room before opening the cache.');
    const inventory = { ...s.inventory };
    for (const [k, v] of Object.entries(loot)) inventory[k as Item] += v;
    return result(
      {
        ...s,
        inventory,
        xp: s.xp + 60,
        treasures: [...s.treasures, node.id],
        stats: { ...s.stats, caches: s.stats.caches + 1 },
      },
      'Hidden cache found. Supplies and 60 XP tucked away.',
      true,
    );
  }
  if (node.kind === 'ore' && !s.tools.pickaxe)
    return result(s, 'Craft a pickaxe to mine iron ore.');
  const cost = node.kind === 'wood' || node.kind === 'stone' || node.kind === 'ore' ? 8 : 4;
  if (s.stamina < cost) return result(s, 'Catch your breath or eat berries to restore stamina.');
  const amount =
    s.adventure.skills.foraging +
    ((node.kind === 'wood' && s.tools.axe) || (node.kind === 'stone' && s.tools.pickaxe)
      ? 4
      : node.kind === 'ore'
        ? 2
        : 2);
  if (bagCount(s) + amount > capacity(s))
    return result(s, 'Your bag is full. Use supplies, craft, or build a storage chest.');
  return result(
    {
      ...s,
      inventory: { ...s.inventory, [node.kind]: s.inventory[node.kind] + amount },
      stamina: s.stamina - cost,
      xp: s.xp + 4,
      depleted: { ...s.depleted, [node.id]: s.playSeconds + 75 },
      stats: { ...s.stats, gathered: s.stats.gathered + amount },
      daily: { ...s.daily, gathered: s.daily.gathered + amount },
    },
    `+${amount} ${ITEMS[node.kind].name.toLowerCase()}. +4 XP.`,
    true,
  );
}
export const RECIPES = [
  {
    id: 'sword',
    name: 'Bramble blade',
    detail: 'Equip a blade: 25 damage per swing.',
    cost: { wood: 4, stone: 2, fiber: 2 },
    tool: 'sword',
  },
  {
    id: 'ironSword',
    name: 'Iron fang',
    detail: 'Equip an iron blade: 42 damage per swing.',
    cost: { ore: 6, plank: 2, fiber: 2 },
    tool: 'ironSword',
  },
  {
    id: 'armor',
    name: 'Bark armor',
    detail: 'Wear armor to absorb 35% of incoming combat damage.',
    cost: { fiber: 8, wood: 4, ore: 2 },
    tool: 'armor',
  },
  {
    id: 'lantern',
    name: 'Glowroot lantern',
    detail: 'Opens the Underground Cave at level 3.',
    cost: { wood: 4, herb: 2, fiber: 2 },
    tool: 'lantern',
  },
  {
    id: 'axe',
    name: 'Woodland axe',
    detail: 'Gather twice as much wood.',
    cost: { wood: 6, stone: 3, fiber: 2 },
    tool: 'axe',
  },
  {
    id: 'pickaxe',
    name: 'Stone pickaxe',
    detail: 'Mine iron ore. Double your stone yield.',
    cost: { wood: 5, stone: 6, fiber: 2 },
    tool: 'pickaxe',
  },
  {
    id: 'bandage',
    name: 'Bandage',
    detail: 'Restore 45 health when used.',
    cost: { fiber: 3, herb: 1 },
    output: 'bandage',
    amount: 1,
  },
  {
    id: 'mix',
    name: 'Trail mix',
    detail: 'Restore 20 health and 60 stamina.',
    cost: { berry: 2, seed: 2 },
    output: 'mix',
    amount: 1,
  },
  {
    id: 'plank',
    name: 'Saw planks',
    detail: 'Turn 3 wood into 2 building planks.',
    cost: { wood: 3 },
    output: 'plank',
    amount: 2,
  },
  {
    id: 'backpack',
    name: 'Explorer pack',
    detail: '+40 inventory capacity and +20 maximum stamina.',
    cost: { fiber: 10, plank: 4, ore: 3 },
    tool: 'backpack',
    workbench: true,
  },
] satisfies {
  id: string;
  name: string;
  detail: string;
  cost: Cost;
  tool?: keyof SurvivalSave['tools'];
  output?: Item;
  amount?: number;
  workbench?: boolean;
}[];
export function craft(s: SurvivalSave, id: string): Result {
  s = rollDaily(s);
  const r = RECIPES.find((r) => r.id === id);
  if (!r) return result(s, 'Choose a recipe.');
  if ('tool' in r && r.tool && s.tools[r.tool]) return result(s, 'You already own this tool.');
  if (
    'workbench' in r &&
    r.workbench &&
    !(s.area === 'forest' && distance(s.position, BURROW) < 170)
  )
    return result(s, 'Return to the burrow workbench to craft this pack.');
  if (!afford(s, r.cost)) return result(s, 'Gather the missing materials shown in the recipe.');
  const inventory = pay(s, r.cost);
  if ('output' in r && r.output) inventory[r.output] += r.amount;
  if (itemKeys.reduce((n, k) => n + inventory[k], 0) > capacity(s))
    return result(s, 'Make some room in your inventory first.');
  const tools = { ...s.tools };
  if ('tool' in r && r.tool) tools[r.tool] = true;
  return result(
    {
      ...s,
      inventory,
      tools,
      adventure: {
        ...s.adventure,
        weapon: id === 'sword' ? 'sword' : id === 'ironSword' ? 'ironSword' : s.adventure.weapon,
        armored: id === 'armor' ? true : s.adventure.armored,
      },
      xp: s.xp + 15,
      stats: { ...s.stats, crafted: s.stats.crafted + 1 },
      daily: { ...s.daily, crafted: s.daily.crafted + 1 },
    },
    `${r.name} crafted. +15 XP.`,
    true,
  );
}
export type Building = keyof SurvivalSave['buildings'];
export const BUILDINGS: Record<
  Building,
  { name: string; icon: string; detail: string[]; costs: Cost[]; position: Vec }
> = {
  shelter: {
    name: 'Burrow shelter',
    icon: 'home',
    position: p(8, 13),
    detail: [
      'Rest restores all health and stamina.',
      'Rest freely. +20 maximum stamina.',
      'Rest freely. +20 maximum health and stamina.',
    ],
    costs: [
      { wood: 10, fiber: 6 },
      { wood: 12, stone: 8, plank: 4 },
      { plank: 10, stone: 12, ore: 6 },
    ],
  },
  campfire: {
    name: 'Campfire',
    icon: 'fire',
    position: p(10, 11),
    detail: [
      'Heal 2 health/second near the fire.',
      'Heal 4 health/second near the fire.',
      'Heal 6 health/second near the fire.',
    ],
    costs: [
      { wood: 8, stone: 6 },
      { wood: 10, stone: 10 },
      { stone: 14, ore: 5 },
    ],
  },
  chest: {
    name: 'Storage chest',
    icon: 'chest',
    position: p(7, 15),
    detail: [
      '+40 inventory capacity everywhere.',
      '+80 total inventory capacity.',
      '+120 total inventory capacity.',
    ],
    costs: [
      { wood: 10, stone: 2 },
      { plank: 6, fiber: 6 },
      { plank: 10, ore: 4 },
    ],
  },
  garden: {
    name: 'Berry garden',
    icon: 'leaf',
    position: p(6, 12),
    detail: [
      'Harvest 4 berries every 90 active seconds.',
      'Harvest 8 berries every 90 active seconds.',
      'Harvest 12 berries every 90 active seconds.',
    ],
    costs: [
      { wood: 6, fiber: 4, seed: 6 },
      { wood: 10, seed: 8 },
      { plank: 6, seed: 10, ore: 2 },
    ],
  },
};
export function build(s: SurvivalSave, key: Building): Result {
  const b = BUILDINGS[key],
    lv = s.buildings[key];
  if (s.area !== 'forest' || distance(s.position, BURROW) > 170)
    return result(s, 'Return to the burrow clearing to build or upgrade.');
  if (lv >= 3) return result(s, 'This structure is fully upgraded.');
  if (!afford(s, b.costs[lv]))
    return result(s, 'Gather the missing materials shown for this structure.');
  return result(
    {
      ...s,
      inventory: pay(s, b.costs[lv]),
      buildings: { ...s.buildings, [key]: lv + 1 },
      xp: s.xp + 40,
      stats: { ...s.stats, built: s.stats.built + 1 },
      gardenAt: key === 'garden' ? s.playSeconds : s.gardenAt,
    },
    `${b.name} ${lv ? 'upgraded' : 'built'}. +40 XP.`,
    true,
  );
}
export function consume(s: SurvivalSave, item: Item): Result {
  if (!s.inventory[item]) return result(s, 'You have none of that item.');
  const effects: Partial<Record<Item, [number, number]>> = {
    berry: [10, 18],
    bandage: [45, 0],
    mix: [20, 60],
  };
  const effect = effects[item];
  if (!effect) return result(s, 'Use this material in crafting or building.');
  if (
    s.health >= maxHealth(s) &&
    (effect[1] === 0 || (s.stamina >= maxStamina(s) && s.adventure.hunger >= 100))
  )
    return result(s, 'Already fully restored. Your supplies were kept.');
  return result(
    {
      ...s,
      inventory: { ...s.inventory, [item]: s.inventory[item] - 1 },
      adventure: {
        ...s.adventure,
        hunger: Math.min(
          100,
          s.adventure.hunger + (item === 'berry' ? 18 : item === 'mix' ? 50 : 0),
        ),
      },
      health: Math.min(maxHealth(s), s.health + effect[0]),
      stamina: Math.min(maxStamina(s), s.stamina + effect[1]),
    },
    `${ITEMS[item].name} used. Feeling better.`,
    true,
  );
}
export function discard(s: SurvivalSave, item: Item): Result {
  if (!s.inventory[item]) return result(s, 'This stack is empty.');
  return result(
    { ...s, inventory: { ...s.inventory, [item]: s.inventory[item] - 1 } },
    `Dropped 1 ${ITEMS[item].name.toLowerCase()}.`,
    true,
  );
}
export function rest(s: SurvivalSave): Result {
  if (s.area !== 'forest' || distance(s.position, BURROW) > 170)
    return result(s, 'Walk back to the burrow clearing to rest.');
  if (!s.buildings.shelter) return result(s, 'Build a burrow shelter to rest here.');
  return result(
    {
      ...s,
      health: maxHealth(s),
      stamina: maxStamina(s),
      adventure: { ...s.adventure, hunger: Math.max(s.adventure.hunger, 50) },
    },
    'Rested at home. Health and stamina restored.',
    true,
  );
}
export function harvest(s: SurvivalSave): Result {
  if (!s.buildings.garden) return result(s, 'Build a berry garden first.');
  if (s.area !== 'forest' || distance(s.position, BUILDINGS.garden.position) > 170)
    return result(s, 'Walk to your garden to harvest.');
  if (s.playSeconds - s.gardenAt < 90)
    return result(
      s,
      `Berries ready in ${Math.ceil(90 - s.playSeconds + s.gardenAt)} active seconds.`,
    );
  const amount = s.buildings.garden * 4;
  if (bagCount(s) + amount > capacity(s))
    return result(s, 'Make room in your bag before harvesting.');
  return result(
    {
      ...s,
      inventory: { ...s.inventory, berry: s.inventory.berry + amount },
      gardenAt: s.playSeconds,
    },
    `Harvested ${amount} berries.`,
    true,
  );
}
export function travel(s: SurvivalSave, exit: Exit): Result {
  if (!WORLDS[s.area].exits.includes(exit) || distance(s.position, exit) > 65)
    return result(s, 'Walk to the trail marker to travel.');
  const locked = areaLock(s, exit.to);
  if (locked && !s.visited.includes(exit.to)) return result(s, locked);
  const first = !s.visited.includes(exit.to);
  return result(
    {
      ...s,
      area: exit.to,
      position: { ...exit.arrival },
      visited: first ? [...s.visited, exit.to] : s.visited,
      xp: s.xp + (first ? 35 : 0),
    },
    `Entered ${AREA_NAMES[exit.to]}.${first ? ' +35 discovery XP.' : ''}`,
    true,
  );
}
export function tick(s: SurvivalSave, dt: number, moving = false, sprinting = false): Result {
  dt = Math.min(dt, 0.1);
  const thorns = WORLDS[s.area].rects.some((r) => r.kind === 'thorns' && inside(s.position, r));
  const fire =
    s.area === 'forest' && distance(s.position, BUILDINGS.campfire.position) < 110
      ? s.buildings.campfire * 2
      : 0;
  const health = Math.min(maxHealth(s), s.health + ((thorns ? -12 : 0) + fire) * dt);
  if (s.adventure.dead) return result(s, '');
  if (health <= 0)
    return result(
      { ...s, health: 0, adventure: { ...s.adventure, dead: true } },
      'Your adventure needs a little breather. Recover at the burrow.',
    );
  return result(
    {
      ...s,
      health,
      playSeconds: s.playSeconds + dt,
      stamina: Math.min(maxStamina(s), s.stamina + (!sprinting ? (moving ? 3 : 10) * dt : 0)),
    },
    '',
  );
}
export const DAILY_QUESTS = [
  {
    id: 'gather',
    name: 'Stock the pantry',
    detail: 'Gather 20 resources.',
    target: 20,
    field: 'gathered',
    xp: 60,
  },
  {
    id: 'craft',
    name: 'Made with little paws',
    detail: 'Craft 2 items or tools.',
    target: 2,
    field: 'crafted',
    xp: 50,
  },
  {
    id: 'run',
    name: 'A pocketful of sunshine',
    detail: 'Finish a five-seed foraging run.',
    target: 1,
    field: 'run',
    xp: 80,
  },
] as const;
export function claimQuest(s: SurvivalSave, id: string): Result {
  s = rollDaily(s);
  const q = DAILY_QUESTS.find((q) => q.id === id);
  if (!q || s.daily[q.field] < q.target) return result(s, 'Finish the quest objective first.');
  if (s.daily.claimed.includes(id))
    return result(s, 'Already claimed today. Quests reset at 00:00 UTC.');
  return result(
    { ...s, xp: s.xp + q.xp, daily: { ...s.daily, claimed: [...s.daily.claimed, id] } },
    `${q.name} complete. +${q.xp} XP.`,
    true,
  );
}
export function recordRun(s: SurvivalSave, seeds: number, seconds: number): Result {
  s = rollDaily(s);
  const run = {
    id: globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}-${s.stats.runs}`,
    name: s.name,
    date: new Date().toISOString(),
    seeds,
    seconds,
    xp: 80 as const,
  };
  return result(
    {
      ...s,
      runs: [run, ...s.runs].slice(0, 50),
      daily: { ...s.daily, run: s.daily.run + 1 },
      stats: { ...s.stats, runs: s.stats.runs + 1 },
      inventory: {
        ...s.inventory,
        seed: s.inventory.seed + Math.min(seeds, Math.max(0, capacity(s) - bagCount(s))),
      },
    },
    'Run saved. Seeds added if space allows. Claim your daily XP in the journal.',
    true,
  );
}
export function survivalAchievements(s: SurvivalSave) {
  return [
    { name: 'First provisions', detail: 'Gather 20 resources.', earned: s.stats.gathered >= 20 },
    {
      name: 'Little maker',
      detail: 'Craft your first tool or item.',
      earned: s.stats.crafted >= 1,
    },
    {
      name: 'Home sweet burrow',
      detail: 'Build your first structure.',
      earned: s.stats.built >= 1,
    },
    { name: 'Beyond the trees', detail: 'Explore three wild areas.', earned: s.visited.length >= 3 },
    {
      name: 'Hidden in plain sight',
      detail: 'Find three hidden supply caches.',
      earned: s.treasures.length >= 3,
    },
    { name: 'Happy cheeks', detail: 'Finish a foraging run.', earned: s.stats.runs > 0 },
    {
      name: 'A place to thrive',
      detail: 'Fully upgrade a structure.',
      earned: Object.values(s.buildings).some((v) => v === 3),
    },
  ];
}

export function areaLock(s: SurvivalSave, area: Area): string | null {
  if (area === 'village' && playerLevel(s) < 2)
    return 'Ancient Ruins unlock at level 2. Gather, craft and claim quests to gain XP.';
  if (area === 'cave' && (playerLevel(s) < 3 || !s.tools.lantern || !s.tools.pickaxe))
    return 'The cave needs level 3, a pickaxe and a glowroot lantern.';
  return null;
}
