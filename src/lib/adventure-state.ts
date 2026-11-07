import { z } from 'zod';
const point = { x: z.number().finite(), y: z.number().finite() };
export const areas = ['forest', 'village', 'wilderness', 'cave'] as const;
export const enemySchema = z.object({
  id: z.string().max(180),
  area: z.enum(areas),
  kind: z.enum(['slime', 'beetle', 'bat', 'warden']),
  ...point,
  homeX: z.number(),
  homeY: z.number(),
  hp: z.number().min(0).max(1000),
  maxHp: z.number().positive().max(1000),
  cooldown: z.number().min(0).max(10),
  windup: z.number().min(0).max(3),
});
export type Enemy = z.infer<typeof enemySchema>;
export const adventureSchema = z.object({
  hunger: z.number().min(0).max(100).default(100),
  dead: z.boolean().default(false),
  weapon: z.enum(['paws', 'sword', 'ironSword']).default('paws'),
  armored: z.boolean().default(false),
  skills: z
    .object({
      vitality: z.number().int().min(0).max(3),
      combat: z.number().int().min(0).max(3),
      foraging: z.number().int().min(0).max(3),
    })
    .default({ vitality: 0, combat: 0, foraging: 0 }),
  kills: z.number().int().nonnegative().default(0),
  bossDefeated: z.boolean().default(false),
  claimed: z.array(z.string().max(80)).max(50).default([]),
  enemies: z.array(enemySchema).max(150),
  drops: z
    .array(
      z.object({
        id: z.string().max(180),
        area: z.enum(areas),
        ...point,
        item: z.enum(['berry', 'ore', 'fiber', 'herb', 'seed', 'bandage']),
        amount: z.number().int().positive().max(20),
      }),
    )
    .max(150)
    .default([]),
  invulnerable: z.number().min(0).max(5).default(0),
  attackCooldown: z.number().min(0).max(3).default(0),
  attackFlash: z.number().min(0).max(1).default(0),
  dodgeTime: z.number().min(0).max(1).default(0),
  facing: z.object(point).default({ x: 1, y: 0 }),
});
export type Adventure = z.infer<typeof adventureSchema>;
export function newAdventure(): Adventure {
  const enemies: Enemy[] = [];
  const add = (area: Enemy['area'], kind: Enemy['kind'], xs: number[][], hp: number) =>
    xs.forEach(([x, y], i) =>
      enemies.push({
        id: `${area}-${kind}-${i}`,
        area,
        kind,
        x,
        y,
        homeX: x,
        homeY: y,
        hp,
        maxHp: hp,
        cooldown: 1,
        windup: 0,
      }),
    );
  add(
    'forest',
    'slime',
    [
      [650, 465],
      [960, 530],
      [700, 170],
    ],
    36,
  );
  add(
    'village',
    'beetle',
    [
      [420, 430],
      [670, 420],
      [960, 600],
      [850, 170],
    ],
    65,
  );
  add(
    'wilderness',
    'slime',
    [
      [600, 640],
      [900, 530],
      [320, 530],
    ],
    50,
  );
  add(
    'wilderness',
    'beetle',
    [
      [790, 250],
      [380, 200],
    ],
    65,
  );
  add(
    'cave',
    'bat',
    [
      [380, 440],
      [600, 570],
      [850, 440],
      [550, 220],
    ],
    52,
  );
  add('cave', 'warden', [[950, 270]], 420);
  return adventureSchema.parse({ enemies });
}
export const pulseEventSchema = z.object({
  id: z.string().max(180),
  height: z.string().regex(/^\d+$/),
  kind: z.enum(['cache', 'wave', 'portal', 'encounter']),
  x: z.number(),
  y: z.number(),
  resolved: z.boolean(),
  tx: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});
export type PulseEvent = z.infer<typeof pulseEventSchema>;
export const pulseSchema = z.object({
  baseline: z.string().regex(/^\d+$/).nullable(),
  cursor: z.string().regex(/^\d+$/).nullable(),
  target: z.string().regex(/^\d+$/).nullable(),
  events: z.array(pulseEventSchema).max(100),
  measurementIds: z.array(z.string().max(250)).max(4000),
  measurementClaims: z.array(z.string().max(250)).max(100000),
  measurements: z
    .array(
      z.object({
        id: z.string().max(250),
        type: z.string().max(100),
        at: z.string(),
        provenance: z.enum(['hardware', 'simulated', 'replay', 'derived', 'unknown']),
      }),
    )
    .max(40),
  completed: z.number().int().nonnegative(),
});
export type PulseState = z.infer<typeof pulseSchema>;
export const newPulse = (): PulseState => ({
  baseline: null,
  cursor: null,
  target: null,
  events: [],
  measurementIds: [],
  measurementClaims: [],
  measurements: [],
  completed: 0,
});
