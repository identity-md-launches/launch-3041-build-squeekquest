import {
  BURROW,
  SPAWN,
  bagCount,
  canStand,
  capacity,
  distance,
  maxHealth,
  maxStamina,
  playerLevel,
  type Result,
  type SurvivalSave,
  type Vec,
} from './survival';
import { type Enemy, type PulseEvent } from './adventure-state';
const result = (save: SurvivalSave, message = '', success = false): Result => ({
  save,
  message,
  success,
});
export const weaponName = (s: SurvivalSave) =>
  s.adventure.weapon === 'ironSword'
    ? 'Iron fang'
    : s.adventure.weapon === 'sword'
      ? 'Bramble blade'
      : 'Little paws';
export const attackDamage = (s: SurvivalSave) =>
  (s.adventure.weapon === 'ironSword' ? 42 : s.adventure.weapon === 'sword' ? 25 : 10) +
  s.adventure.skills.combat * 6;
export const skillPoints = (s: SurvivalSave) =>
  Math.max(0, playerLevel(s) - 1 - Object.values(s.adventure.skills).reduce((a, b) => a + b, 0));
export function learn(s: SurvivalSave, key: keyof SurvivalSave['adventure']['skills']): Result {
  if (!skillPoints(s) || s.adventure.skills[key] >= 3)
    return result(s, 'Earn a level for another skill point. Each skill has three ranks.');
  return result(
    {
      ...s,
      adventure: {
        ...s.adventure,
        skills: { ...s.adventure.skills, [key]: s.adventure.skills[key] + 1 },
      },
    },
    `${key[0].toUpperCase() + key.slice(1)} improved.`,
    true,
  );
}
export function equip(s: SurvivalSave, weapon: SurvivalSave['adventure']['weapon']): Result {
  if (weapon !== 'paws' && !s.tools[weapon]) return result(s, 'Craft this weapon first.');
  const next = { ...s, adventure: { ...s.adventure, weapon } };
  return result(next, `${weaponName(next)} equipped.`, true);
}
export function attack(s: SurvivalSave): Result {
  const a = s.adventure;
  if (a.dead || a.attackCooldown > 0) return result(s);
  if (s.stamina < 5) return result(s, 'Catch your breath before swinging.');
  const damage = attackDamage(s);
  let kills = 0,
    boss = false;
  const drops = [...a.drops];
  const enemies = a.enemies.map((e) => {
    if (e.area !== s.area || e.hp <= 0 || distance(e, s.position) > 68) return e;
    const hp = Math.max(0, e.hp - damage);
    if (!hp) {
      kills++;
      boss ||= e.kind === 'warden';
      drops.push({
        id: `drop:${e.id}`,
        area: e.area,
        x: e.x,
        y: e.y,
        item: e.kind === 'warden' ? 'ore' : e.kind === 'beetle' ? 'fiber' : 'berry',
        amount: e.kind === 'warden' ? 8 : 2,
      });
    }
    return { ...e, hp };
  });
  return result(
    {
      ...s,
      stamina: s.stamina - 5,
      xp: s.xp + kills * 30 + (boss ? 370 : 0),
      adventure: {
        ...a,
        enemies,
        drops: drops.slice(-150),
        kills: a.kills + kills,
        bossDefeated: a.bossDefeated || boss,
        attackCooldown: 0.42,
        attackFlash: 0.2,
      },
    },
    boss
      ? 'The Root Warden is defeated! +400 XP. Claim the Heart of the forest quest.'
      : kills
        ? `Enemy defeated. +${kills * 30} XP. Press E to collect its drop.`
        : '',
    true,
  );
}
export function dodge(s: SurvivalSave): Result {
  if (s.adventure.dead || s.stamina < 20 || s.adventure.dodgeTime > 0)
    return result(s, 'Dodge needs 20 stamina.');
  return result(
    {
      ...s,
      stamina: s.stamina - 20,
      adventure: { ...s.adventure, dodgeTime: 0.28, invulnerable: 0.48 },
    },
    'Dodged. Briefly protected from damage.',
    true,
  );
}
export function recover(s: SurvivalSave): Result {
  if (!s.adventure.dead) return result(s);
  return result(
    {
      ...s,
      area: 'forest',
      position: { ...SPAWN },
      health: maxHealth(s),
      stamina: maxStamina(s),
      xp: Math.max(0, s.xp - 20),
      adventure: {
        ...s.adventure,
        dead: false,
        hunger: 70,
        invulnerable: 2,
        dodgeTime: 0,
        enemies: s.adventure.enemies.map((e) =>
          e.kind === 'warden' && e.hp > 0
            ? { ...e, hp: e.maxHp, x: e.homeX, y: e.homeY, windup: 0 }
            : e,
        ),
      },
    },
    'Recovered at the burrow. Supplies kept; up to 20 XP lost.',
    true,
  );
}
export function collectDrop(s: SurvivalSave): Result | null {
  const drop = s.adventure.drops.find((d) => d.area === s.area && distance(d, s.position) < 58);
  if (!drop) return null;
  if (bagCount(s) + drop.amount > capacity(s))
    return result(s, 'Make room in your satchel to collect this drop.');
  return result(
    {
      ...s,
      inventory: { ...s.inventory, [drop.item]: s.inventory[drop.item] + drop.amount },
      adventure: { ...s.adventure, drops: s.adventure.drops.filter((d) => d.id !== drop.id) },
    },
    `Collected ${drop.amount} ${drop.item}.`,
    true,
  );
}
export function stepAdventure(s: SurvivalSave, seconds: number): Result {
  if (s.adventure.dead) return result(s);
  const dt = Math.max(0, Math.min(0.1, seconds)),
    a = s.adventure;
  let health = s.health;
  let protectedFromHit = a.invulnerable > 0;
  const invulnerable = Math.max(0, a.invulnerable - dt),
    hunger = Math.max(0, a.hunger - dt * 0.1);
  if (hunger === 0) health -= dt * 1.2;
  const enemies = a.enemies.map((enemy) => {
    if (enemy.hp <= 0 || enemy.area !== s.area) return enemy;
    let e = { ...enemy, cooldown: Math.max(0, enemy.cooldown - dt) };
    const d = distance(e, s.position),
      boss = e.kind === 'warden',
      reach = boss ? 78 : 29;
    const homeSafe = s.area === 'forest' && distance(s.position, BURROW) < 160;
    if (homeSafe || d > (boss ? 310 : 210)) {
      e.windup = 0;
      return e;
    }
    if (e.windup > 0) {
      e.windup = Math.max(0, e.windup - dt);
      if (e.windup === 0) {
        if (d < reach + 10 && !protectedFromHit) {
          health -= (boss ? 23 : e.kind === 'beetle' ? 10 : 7) * (a.armored ? 0.65 : 1);
          protectedFromHit = true;
        }
        e.cooldown = boss ? (e.hp < e.maxHp / 2 ? 1.1 : 1.8) : 1.3;
      }
      return e;
    }
    if (d < reach && e.cooldown === 0) {
      e.windup = boss ? 0.85 : 0.4;
      return e;
    }
    if (d > reach * 0.8) {
      const speed =
        (boss
          ? e.hp < e.maxHp / 2
            ? 65
            : 42
          : e.kind === 'bat'
            ? 76
            : e.kind === 'beetle'
              ? 42
              : 34) * dt;
      const dx = ((s.position.x - e.x) / Math.max(1, d)) * speed,
        dy = ((s.position.y - e.y) / Math.max(1, d)) * speed;
      if (canStand(s.area, { x: e.x + dx, y: e.y }, boss ? 14 : 6)) e.x += dx;
      if (canStand(s.area, { x: e.x, y: e.y + dy }, boss ? 14 : 6)) e.y += dy;
    }
    return e;
  });
  const hit = health < s.health;
  const dead = health <= 0;
  return result(
    {
      ...s,
      health: Math.max(0, health),
      adventure: {
        ...a,
        enemies,
        hunger,
        dead,
        invulnerable: hit ? 0.65 : invulnerable,
        attackCooldown: Math.max(0, a.attackCooldown - dt),
        attackFlash: Math.max(0, a.attackFlash - dt),
        dodgeTime: Math.max(0, a.dodgeTime - dt),
      },
    },
    dead
      ? 'You fell in the wild. Recover at the burrow to continue.'
      : hit && a.invulnerable === 0
        ? 'Hit! Move out of the warning ring, or dodge with Q.'
        : '',
  );
}
export const STORY_QUESTS = [
  {
    id: 'roots',
    name: 'Put down roots',
    detail: 'Craft an axe and build a shelter.',
    xp: 120,
    ready: (s: SurvivalSave) => s.tools.axe && s.buildings.shelter > 0,
  },
  {
    id: 'ruins',
    name: 'Echoes in the ruins',
    detail: 'Explore Ancient Ruins and defeat 3 enemies.',
    xp: 150,
    ready: (s: SurvivalSave) => s.visited.includes('village') && s.adventure.kills >= 3,
  },
  {
    id: 'depths',
    name: 'A light in the dark',
    detail: 'Craft a pickaxe and lantern. Reach the Underground Cave.',
    xp: 180,
    ready: (s: SurvivalSave) => s.visited.includes('cave'),
  },
  {
    id: 'heart',
    name: 'Heart of the forest',
    detail: 'Defeat the Root Warden in the northeast cave chamber.',
    xp: 300,
    ready: (s: SurvivalSave) => s.adventure.bossDefeated,
  },
  {
    id: 'guardian',
    name: 'Clearing keeper',
    detail: 'Defeat 5 enemies across the wilds.',
    xp: 100,
    ready: (s: SurvivalSave) => s.adventure.kills >= 5,
  },
  {
    id: 'caches',
    name: 'A nose for treasure',
    detail: 'Find 3 hidden supply caches.',
    xp: 120,
    ready: (s: SurvivalSave) => s.treasures.length >= 3,
  },
] as const;
export function claimStory(s: SurvivalSave, id: string): Result {
  const q = STORY_QUESTS.find((q) => q.id === id);
  if (!q || !q.ready(s) || s.adventure.claimed.includes(id))
    return result(s, 'Complete this quest before claiming its reward.');
  return result(
    { ...s, xp: s.xp + q.xp, adventure: { ...s.adventure, claimed: [...s.adventure.claimed, id] } },
    `${q.name} complete. +${q.xp} XP.`,
    true,
  );
}
export const pulseNames: Record<PulseEvent['kind'], string> = {
  cache: 'Settled supply cache',
  wave: 'Bramble invasion',
  portal: 'Secret glade portal',
  encounter: 'Wandering herbalist',
};
export function nearPulse(s: SurvivalSave) {
  return s.area === 'forest'
    ? s.pulse.events.find((e) => !e.resolved && distance(e, s.position) < 60)
    : undefined;
}
export function resolvePulse(s: SurvivalSave, id: string): Result {
  const e = s.pulse.events.find((e) => e.id === id && !e.resolved);
  if (!e || s.area !== 'forest' || distance(s.position, e) > 60)
    return result(s, 'Walk to the Chain Pulse marker in the forest.');
  const enemies: Enemy[] = [...s.adventure.enemies.filter((e) => e.hp > 0 || e.kind === 'warden')];
  if (e.kind === 'wave' && enemies.length > 146)
    return result(s, 'Defeat some enemies before summoning this wave.');
  let inventory = { ...s.inventory },
    position = { ...s.position };
  if (e.kind === 'wave') {
    for (let i = 0; i < 2; i++)
      enemies.push({
        id: `${e.id}:${i}`,
        kind: 'slime',
        area: 'forest',
        x: e.x + i * 36,
        y: e.y + 50,
        homeX: e.x,
        homeY: e.y + 50,
        hp: 40,
        maxHp: 40,
        cooldown: 1,
        windup: 0,
      });
  } else {
    const loot =
      e.kind === 'cache'
        ? { wood: 3, stone: 3 }
        : e.kind === 'portal'
          ? { seed: 3, berry: 2 }
          : { herb: 2, bandage: 1 };
    if (bagCount(s) + Object.values(loot).reduce((a, b) => a + b, 0) > capacity(s))
      return result(s, 'Make room in your satchel before completing this encounter.');
    for (const [k, v] of Object.entries(loot)) inventory[k as keyof typeof inventory] += v ?? 0;
    if (e.kind === 'portal') position = { x: 190, y: 190 };
  }
  return result(
    {
      ...s,
      inventory,
      position,
      xp: s.xp + 20,
      adventure: { ...s.adventure, enemies },
      pulse: {
        ...s.pulse,
        completed: s.pulse.completed + 1,
        events: s.pulse.events.map((v) => (v.id === id ? { ...v, resolved: true } : v)),
      },
    },
    `${pulseNames[e.kind]} completed. +20 local XP.${e.kind === 'wave' ? ' Defeat the incoming slimes.' : ''}`,
    true,
  );
}
