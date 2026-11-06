import { z } from 'zod';

export const COLS = 17,
  ROWS = 11;
export type Point = { x: number; y: number };
export const HOME: Point = { x: 3, y: 8 };
export const STATIONS = {
  blocks: { x: 12, y: 3, name: 'Wheel works', mission: 'block-scout', icon: 'wheel' },
  events: { x: 7, y: 3, name: 'Signal station', mission: 'signal-hunter', icon: 'radio' },
  nft: { x: 13, y: 8, name: 'Squeek grove', mission: 'squeek-friend', icon: 'leaf' },
} as const;
export type Station = keyof typeof STATIONS;
export const SEEDS: Point[] = [
  { x: 5, y: 8 },
  { x: 6, y: 6 },
  { x: 8, y: 7 },
  { x: 10, y: 6 },
  { x: 11, y: 8 },
  { x: 9, y: 9 },
  { x: 5, y: 4 },
  { x: 10, y: 3 },
];
export const xpFor = {
  forage: 80,
  'block-scout': 120,
  'signal-hunter': 150,
  'squeek-friend': 100,
  daily: 50,
} as const;
export type Quest = keyof typeof xpFor;
export const today = () => new Date().toISOString().slice(0, 10);
export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const near = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
export function stepToward(from: Point, target: Point): Point {
  if (from.x !== target.x) return { x: from.x + Math.sign(target.x - from.x), y: from.y };
  if (from.y !== target.y) return { x: from.x, y: from.y + Math.sign(target.y - from.y) };
  return from;
}
export function bound(p: Point): Point {
  return {
    x: Math.max(1, Math.min(COLS - 2, Math.round(p.x))),
    y: Math.max(2, Math.min(ROWS - 2, Math.round(p.y))),
  };
}

const receipt = z.object({
  quest: z.enum(['forage', 'block-scout', 'signal-hunter', 'squeek-friend', 'daily']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  evidence: z.string().max(400),
  earnedAt: z.string().datetime(),
});
const run = z.object({
  id: z.string().max(80),
  name: z.string().min(1).max(24),
  date: z.string(),
  seeds: z.number().int().min(5).max(8),
  seconds: z.number().int().min(0).max(86400),
  xp: z.literal(80),
});
const achievementId = z.enum([
  'first-forage',
  'chain-scout',
  'signal-hunter',
  'squeek-friend',
  'well-rounded',
]);
export const saveSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(24),
  receipts: z.array(receipt).max(1000),
  archivedXp: z.number().int().nonnegative().default(0),
  unlocked: z.array(achievementId).default([]),
  runs: z.array(run).max(50),
  sound: z.boolean(),
  theme: z.enum(['light', 'dark']),
});
export type Save = z.infer<typeof saveSchema>;
export const freshSave = (): Save => ({
  version: 1,
  name: 'Little explorer',
  receipts: [],
  archivedXp: 0,
  unlocked: [],
  runs: [],
  sound: false,
  theme: 'light',
});
export const STORAGE_KEY = 'squeekquest.v1';
export function loadSave(raw: string | null): Save {
  if (!raw) return freshSave();
  try {
    const p = saveSchema.safeParse(JSON.parse(raw));
    return p.success ? p.data : freshSave();
  } catch {
    return freshSave();
  }
}
export function totalXp(save: Save) {
  return save.archivedXp + save.receipts.reduce((sum, r) => sum + xpFor[r.quest], 0);
}
export function level(save: Save) {
  return Math.floor(totalXp(save) / 400) + 1;
}
export function hasQuest(save: Save, quest: Quest, date = today()) {
  return save.receipts.some((r) => r.quest === quest && r.date === date);
}
export function award(save: Save, quest: Quest, evidence: string, date = today()): Save {
  if (hasQuest(save, quest, date)) return save;
  const updated: Save = {
    ...save,
    receipts: [...save.receipts, { quest, date, evidence, earnedAt: new Date().toISOString() }],
  };
  updated.unlocked = achievements(updated)
    .filter((a) => a.earned)
    .map((a) => a.id as Save['unlocked'][number]);
  const removed = updated.receipts.splice(0, Math.max(0, updated.receipts.length - 1000));
  updated.archivedXp += removed.reduce((sum, r) => sum + xpFor[r.quest], 0);
  return updated;
}
export function addRun(save: Save, seeds: number, seconds: number): Save {
  return {
    ...save,
    runs: [
      {
        id: crypto.randomUUID(),
        name: save.name,
        date: new Date().toISOString(),
        seeds,
        seconds,
        xp: 80 as const,
      },
      ...save.runs,
    ].slice(0, 50),
  };
}
export function achievements(save: Save) {
  return [
    {
      id: 'first-forage',
      name: 'Happy cheeks',
      description: 'Finish a foraging run.',
      icon: 'seed',
      earned:
        save.unlocked.includes('first-forage') ||
        save.runs.length > 0 ||
        save.receipts.some((r) => r.quest === 'forage'),
    },
    {
      id: 'chain-scout',
      name: 'Chain scout',
      description: 'Discover a settled Squeek block.',
      icon: 'cube',
      earned:
        save.unlocked.includes('chain-scout') ||
        save.receipts.some((r) => r.quest === 'block-scout'),
    },
    {
      id: 'signal-hunter',
      name: 'Signal hunter',
      description: 'Log a safe blockchain event.',
      icon: 'radio',
      earned:
        save.unlocked.includes('signal-hunter') ||
        save.receipts.some((r) => r.quest === 'signal-hunter'),
    },
    {
      id: 'squeek-friend',
      name: 'Squeek friend',
      description: 'Discover a real Squeek NFT.',
      icon: 'leaf',
      earned:
        save.unlocked.includes('squeek-friend') ||
        save.receipts.some((r) => r.quest === 'squeek-friend'),
    },
    {
      id: 'well-rounded',
      name: 'Full circle',
      description: 'Complete all four quests in a day.',
      icon: 'star',
      earned:
        save.unlocked.includes('well-rounded') ||
        save.receipts.some((r) =>
          ['forage', 'block-scout', 'signal-hunter', 'squeek-friend'].every((q) =>
            save.receipts.some((s) => s.date === r.date && s.quest === q),
          ),
        ),
    },
  ];
}
