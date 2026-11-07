import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Icon } from './icons';
import { attack, dodge, stepAdventure, nearPulse, pulseNames } from '../lib/adventure';
import type { Enemy, PulseEvent } from '../lib/adventure-state';
import {
  AREA_NAMES,
  BUILDINGS,
  BURROW,
  HEIGHT,
  TILE,
  WIDTH,
  WORLDS,
  distance,
  consume,
  findPath,
  gather,
  movePlayer,
  nearestNode,
  nodeReady,
  tick,
  travel,
  type Area,
  type Result,
  type SurvivalSave,
  type Vec,
  type WorldNode,
} from '../lib/survival';

const PALETTES = {
  cave: {
    ground: '#3d4952',
    light: '#424e56',
    dark: '#38434b',
    path: '#667071',
    tree: '#354047',
    treeTop: '#53656a',
    trunk: '#31434b',
  },
  forest: {
    ground: '#93ae68',
    light: '#9ab66f',
    dark: '#88a45f',
    path: '#c6b27e',
    tree: '#3d7551',
    treeTop: '#578c59',
    trunk: '#6c543b',
  },
  village: {
    ground: '#9b9b75',
    light: '#a5a17c',
    dark: '#90916b',
    path: '#c1b493',
    tree: '#627555',
    treeTop: '#7c8c62',
    trunk: '#74604a',
  },
  wilderness: {
    ground: '#78988a',
    light: '#82a393',
    dark: '#6e8f80',
    path: '#a8b399',
    tree: '#365e55',
    treeTop: '#4f7c68',
    trunk: '#605a45',
  },
};
const hash = (x: number, y: number) => Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, area: Area, small = false) {
  const c = PALETTES[area];
  if (area === 'cave') {
    ctx.fillStyle = c.trunk;
    ctx.fillRect(x - 16, y - 20, 32, 34);
    ctx.fillStyle = c.treeTop;
    ctx.fillRect(x - 12, y - 26, 22, 22);
    ctx.fillStyle = '#79b9b2';
    ctx.fillRect(x - 6, y - 32, 7, 19);
    ctx.fillRect(x + 4, y - 21, 5, 15);
    return;
  }
  ctx.fillStyle = '#344d3833';
  ctx.fillRect(x - 17, y + 8, 36, 8);
  ctx.fillStyle = c.trunk;
  ctx.fillRect(x - 4, y - 3, 8, 19);
  ctx.fillStyle = '#493e30';
  ctx.fillRect(x + 2, y, 3, 15);
  if (small) {
    ctx.fillStyle = c.tree;
    ctx.fillRect(x - 13, y - 26, 26, 26);
    ctx.fillRect(x - 19, y - 15, 38, 16);
    ctx.fillStyle = c.treeTop;
    ctx.fillRect(x - 10, y - 23, 21, 11);
    return;
  }
  ctx.fillStyle = c.tree;
  ctx.fillRect(x - 22, y - 25, 44, 23);
  ctx.fillRect(x - 16, y - 43, 32, 24);
  ctx.fillRect(x - 9, y - 51, 18, 10);
  ctx.fillStyle = c.treeTop;
  ctx.fillRect(x - 15, y - 40, 24, 10);
  ctx.fillRect(x - 20, y - 23, 23, 9);
  ctx.fillRect(x - 8, y - 48, 13, 9);
  ctx.fillStyle = '#9bb96c';
  ctx.fillRect(x - 13, y - 35, 7, 4);
  ctx.fillRect(x + 3, y - 19, 10, 4);
}
function drawNode(ctx: CanvasRenderingContext2D, n: WorldNode, s: SurvivalSave) {
  const x = Math.round(n.x),
    y = Math.round(n.y),
    ready = nodeReady(s, n);
  if (n.kind === 'cache') {
    if (s.treasures.includes(n.id) || distance(s.position, n) > 150) return;
    ctx.fillStyle = '#665138';
    ctx.fillRect(x - 11, y - 8, 23, 17);
    ctx.fillStyle = '#bc9357';
    ctx.fillRect(x - 10, y - 11, 21, 8);
    ctx.fillStyle = '#e2c67f';
    ctx.fillRect(x - 2, y - 7, 4, 9);
    return;
  }
  if (n.kind === 'wood') {
    if (ready) drawTree(ctx, x, y, s.area);
    else {
      ctx.fillStyle = '#6c543b';
      ctx.fillRect(x - 7, y - 1, 14, 10);
      ctx.fillStyle = '#b99b6c';
      ctx.fillRect(x - 7, y - 3, 14, 4);
    }
    return;
  }
  if (n.kind === 'stone' || n.kind === 'ore') {
    ctx.fillStyle = ready ? '#647771' : '#85927c';
    ctx.fillRect(x - 14, y - 7, 28, 17);
    ctx.fillRect(x - 9, y - 14, 18, 8);
    ctx.fillStyle = ready ? '#acb5a0' : '#939e89';
    ctx.fillRect(x - 10, y - 11, 14, 7);
    ctx.fillStyle = '#4b615a';
    ctx.fillRect(x + 7, y - 4, 6, 12);
    if (n.kind === 'ore') {
      ctx.fillStyle = ready ? '#d09f65' : '#8a8f79';
      ctx.fillRect(x - 8, y - 5, 5, 4);
      ctx.fillRect(x + 3, y + 1, 6, 5);
    }
    return;
  }
  ctx.fillStyle = ready ? '#527548' : '#6c854e';
  for (let i = 0; i < 5; i++)
    ctx.fillRect(x - 13 + i * 5, y - 5 - (i % 3) * 4, 3, 16 + (i % 3) * 4);
  if (!ready) return;
  if (n.kind === 'berry') {
    ctx.fillStyle = '#426c45';
    ctx.fillRect(x - 13, y - 11, 26, 19);
    ctx.fillRect(x - 8, y - 16, 16, 8);
    ctx.fillStyle = '#a84148';
    for (const [ox, oy] of [
      [-8, -8],
      [1, -12],
      [6, -3],
      [-3, 0],
    ])
      ctx.fillRect(x + ox, y + oy, 5, 5);
  }
  if (n.kind === 'seed') {
    ctx.fillStyle = '#e7c06b';
    ctx.fillRect(x - 9, y - 13, 6, 9);
    ctx.fillRect(x + 3, y - 17, 6, 10);
    ctx.fillStyle = '#775a35';
    ctx.fillRect(x - 7, y - 10, 2, 3);
  }
  if (n.kind === 'herb') {
    ctx.fillStyle = '#e2d0b1';
    ctx.fillRect(x - 7, y - 15, 5, 5);
    ctx.fillRect(x + 4, y - 19, 5, 5);
    ctx.fillStyle = '#b294c5';
    ctx.fillRect(x - 10, y - 12, 8, 5);
    ctx.fillRect(x + 1, y - 16, 8, 5);
  }
}
function drawBurrow(ctx: CanvasRenderingContext2D, s: SurvivalSave) {
  const x = BURROW.x,
    y = BURROW.y;
  ctx.fillStyle = '#829b58';
  ctx.fillRect(x - 42, y - 18, 84, 43);
  ctx.fillRect(x - 29, y - 30, 58, 16);
  ctx.fillStyle = '#b6c783';
  ctx.fillRect(x - 26, y - 28, 52, 7);
  ctx.fillStyle = '#5e5234';
  ctx.fillRect(x - 17, y - 13, 34, 34);
  ctx.fillRect(x - 11, y - 21, 22, 10);
  ctx.fillStyle = '#2e3a2e';
  ctx.fillRect(x - 11, y - 11, 22, 31);
  if (s.buildings.shelter) {
    ctx.fillStyle = '#a27b48';
    ctx.fillRect(x - 20, y - 13, 6, 34);
    ctx.fillRect(x + 14, y - 13, 6, 34);
    ctx.fillRect(x - 20, y - 19, 40, 7);
    ctx.fillStyle = '#ead19a';
    ctx.fillRect(x + 23, y - 7, 8, 10);
  }
  ctx.fillStyle = '#685238';
  ctx.fillRect(x - 28, y + 38, 6, 12);
  ctx.fillStyle = '#d8c69a';
  ctx.fillRect(x - 43, y + 25, 38, 16);
  const fire = BUILDINGS.campfire.position;
  if (s.buildings.campfire) {
    ctx.fillStyle = '#69796b';
    ctx.fillRect(fire.x - 15, fire.y + 5, 30, 7);
    ctx.fillStyle = '#775437';
    ctx.fillRect(fire.x - 10, fire.y, 20, 7);
    ctx.fillStyle = '#e6a65a';
    ctx.fillRect(fire.x - 6, fire.y - 13, 12, 15);
    ctx.fillStyle = '#f2d88c';
    ctx.fillRect(fire.x - 3, fire.y - 7, 6, 11);
  } else {
    ctx.strokeStyle = '#6c8052';
    ctx.setLineDash([3, 4]);
    ctx.strokeRect(fire.x - 12, fire.y - 9, 24, 20);
    ctx.setLineDash([]);
  }
  const chest = BUILDINGS.chest.position;
  if (s.buildings.chest) {
    ctx.fillStyle = '#705238';
    ctx.fillRect(chest.x - 13, chest.y - 7, 26, 20);
    ctx.fillStyle = '#b88e53';
    ctx.fillRect(chest.x - 13, chest.y - 12, 26, 10);
    ctx.fillStyle = '#e8cd83';
    ctx.fillRect(chest.x - 2, chest.y - 5, 4, 8);
  }
  const garden = BUILDINGS.garden.position;
  if (s.buildings.garden) {
    ctx.fillStyle = '#84674b';
    ctx.fillRect(garden.x - 25, garden.y - 15, 48, 35);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#507747';
      ctx.fillRect(garden.x - 19 + (i % 3) * 15, garden.y - 10 + Math.floor(i / 3) * 15, 9, 9);
      if (s.playSeconds - s.gardenAt >= 90) {
        ctx.fillStyle = '#ba5351';
        ctx.fillRect(garden.x - 17 + (i % 3) * 15, garden.y - 10 + Math.floor(i / 3) * 15, 4, 4);
      }
    }
  }
}
function drawPlayer(ctx: CanvasRenderingContext2D, p: Vec, moving: boolean, time: number) {
  const x = Math.round(p.x),
    y = Math.round(p.y),
    bob = moving ? Math.round(Math.sin(time * 0.014) * 1.5) : 0;
  ctx.fillStyle = '#2f463d55';
  ctx.fillRect(x - 12, y + 7, 24, 6);
  ctx.fillStyle = '#76503b';
  ctx.fillRect(x - 11, y - 23 + bob, 8, 10);
  ctx.fillRect(x + 4, y - 23 + bob, 8, 10);
  ctx.fillStyle = '#e3a57b';
  ctx.fillRect(x - 9, y - 21 + bob, 4, 6);
  ctx.fillRect(x + 6, y - 21 + bob, 4, 6);
  ctx.fillStyle = '#b77c49';
  ctx.fillRect(x - 13, y - 14 + bob, 26, 20);
  ctx.fillRect(x - 9, y - 19 + bob, 18, 25);
  ctx.fillStyle = '#e8b775';
  ctx.fillRect(x - 11, y - 12 + bob, 22, 14);
  ctx.fillStyle = '#f3ddae';
  ctx.fillRect(x - 8, y - 4 + bob, 16, 10);
  ctx.fillStyle = '#3b392d';
  ctx.fillRect(x - 7, y - 11 + bob, 3, 4);
  ctx.fillRect(x + 5, y - 11 + bob, 3, 4);
  ctx.fillRect(x - 1, y - 3 + bob, 3, 2);
  ctx.fillStyle = '#f6efd3';
  ctx.fillRect(x - 7, y - 11 + bob, 1, 1);
  ctx.fillRect(x + 5, y - 11 + bob, 1, 1);
  ctx.fillStyle = '#5c7a47';
  ctx.fillRect(x - 4, y - 20 + bob, 9, 5);
  ctx.fillRect(x + 1, y - 23 + bob, 8, 3);
  ctx.fillStyle = '#77533e';
  ctx.fillRect(x - 9, y + 6, 5, 3);
  ctx.fillRect(x + 5, y + 6, 5, 3);
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number, reduced: boolean) {
  const x = Math.round(e.x),
    y = Math.round(e.y),
    boss = e.kind === 'warden',
    size = boss ? 29 : 13;
  ctx.fillStyle = '#172d3344';
  ctx.fillRect(x - size, y + 8, size * 2, 8);
  if (e.windup > 0) {
    ctx.strokeStyle = '#ffe2a2';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(x, y, boss ? 88 : 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#aa403c44';
    ctx.beginPath();
    ctx.arc(x, y, boss ? 78 : 29, 0, Math.PI * 2);
    ctx.fill();
  }
  const bob = reduced ? 0 : Math.round(Math.sin(time * 0.008 + e.homeX) * 2);
  ctx.fillStyle = boss
    ? '#634b40'
    : e.kind === 'beetle'
      ? '#7d4549'
      : e.kind === 'bat'
        ? '#85759a'
        : '#527c56';
  ctx.fillRect(x - size, y - size + bob, size * 2, size + 14);
  ctx.fillRect(x - size + 5, y - size - 5 + bob, size * 2 - 10, 8);
  if (boss) {
    ctx.fillStyle = '#78905b';
    ctx.fillRect(x - 29, y - 33, 15, 18);
    ctx.fillRect(x + 17, y - 38, 10, 24);
    ctx.fillRect(x - 12, y - 36, 22, 10);
    ctx.fillStyle = '#baa779';
    ctx.fillRect(x - 20, y - 10, 40, 14);
  } else if (e.kind === 'bat') {
    ctx.fillRect(x - 25, y - 7 + bob, 14, 7);
    ctx.fillRect(x + 12, y - 7 + bob, 14, 7);
  }
  ctx.fillStyle = boss ? '#ffd998' : '#f8eac5';
  ctx.fillRect(x - (boss ? 14 : 7), y - 10 + bob, boss ? 7 : 4, 5);
  ctx.fillRect(x + (boss ? 8 : 4), y - 10 + bob, boss ? 7 : 4, 5);
  ctx.fillStyle = '#263e35';
  ctx.fillRect(x - size, y - size - 16, size * 2, 4);
  ctx.fillStyle = boss ? '#e8bb78' : '#e3d7a5';
  ctx.fillRect(x - size, y - size - 16, size * 2 * (e.hp / e.maxHp), 4);
}
function drawPulse(ctx: CanvasRenderingContext2D, e: PulseEvent, time: number, reduced: boolean) {
  const x = e.x,
    y = e.y,
    kind = e.kind;
  ctx.strokeStyle = '#f6e2aa';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 18, y - 28, 36, 40);
  ctx.fillStyle = kind === 'portal' ? '#83bfc1' : kind === 'wave' ? '#ab5357' : '#d9b464';
  ctx.fillRect(x - 12, y - 19, 24, 23);
  ctx.fillStyle = '#304b42';
  ctx.fillRect(x - 7, y - 14, 14, 15);
  ctx.fillStyle = '#f6e2aa';
  if (kind === 'wave') {
    ctx.fillRect(x - 2, y - 13, 4, 10);
    ctx.fillRect(x - 2, y, 4, 3);
  } else {
    ctx.fillRect(x - 2, y - 11, 4, 16);
    ctx.fillRect(x - 7, y - 5, 14, 4);
  }
  if (!reduced) {
    ctx.fillStyle = '#f8e3a4';
    const offset = Math.round(Math.sin(time * 0.003) * 4);
    ctx.fillRect(x - 21, y - 13 + offset, 3, 3);
    ctx.fillRect(x + 19, y - 24 - offset, 3, 3);
  }
}

export function paintWorld(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: SurvivalSave,
  camera: Vec,
  time: number,
  moving = false,
  path: Vec[] = [],
) {
  const reduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scale = w < 500 ? 1.35 : 1.7,
    viewW = w / scale,
    viewH = h / scale;
  const left = Math.max(0, Math.min(WIDTH - viewW, camera.x - viewW / 2)),
    top = Math.max(0, Math.min(HEIGHT - viewH, camera.y - viewH / 2));
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-Math.round(left), -Math.round(top));
  const c = PALETTES[s.area];
  ctx.fillStyle = c.ground;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let y = Math.floor(top / TILE); y < Math.ceil((top + viewH) / TILE); y++)
    for (let x = Math.floor(left / TILE); x < Math.ceil((left + viewW) / TILE); x++) {
      const v = hash(x, y);
      ctx.fillStyle = v > 0.5 ? c.light : c.dark;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.fillStyle = '#d6cd8a';
      if (v > 0.78) {
        ctx.fillRect(x * TILE + 8, y * TILE + 11, 2, 3);
        ctx.fillRect(x * TILE + 11, y * TILE + 10, 2, 2);
      } else {
        ctx.fillStyle = '#57784e55';
        ctx.fillRect(x * TILE + 10, y * TILE + 12, 2, 3);
        ctx.fillRect(x * TILE + 12, y * TILE + 10, 2, 4);
      }
    }
  // Fine grass, fallen leaves and flowers share a deterministic pixel palette.
  for (let i = 0; i < 210; i++) {
    const x = Math.floor(hash(i, 71) * WIDTH),
      y = Math.floor(hash(i, 19) * HEIGHT);
    if (x < left - 10 || x > left + viewW + 10 || y < top - 10 || y > top + viewH + 10) continue;
    ctx.fillStyle = s.area === 'cave' ? '#83a6aa' : i % 5 === 0 ? '#dfd5a0' : c.treeTop;
    ctx.fillRect(x, y, 2, i % 5 === 0 ? 2 : 4);
    if (i % 5 === 0) {
      ctx.fillStyle = '#c49b75';
      ctx.fillRect(x + 2, y + 2, 2, 2);
    }
  }
  // The route stays clear across each area; branching trails lead into resources.
  ctx.fillStyle = c.path;
  ctx.fillRect(TILE, 13 * TILE, WIDTH - 2 * TILE, TILE * 2);
  if (s.area !== 'forest') ctx.fillRect(20 * TILE, TILE, TILE * 2, HEIGHT - 2 * TILE);
  ctx.fillStyle = '#ad9a6c55';
  for (let x = 2; x < 37; x += 3) ctx.fillRect(x * TILE, 13 * TILE + 12, 17, 3);
  for (const r of WORLDS[s.area].rects) {
    if (r.kind === 'water') {
      ctx.fillStyle = '#668c7b';
      ctx.fillRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10);
      ctx.fillStyle = '#6a9f9a';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#97bdb0';
      for (let i = 0; i < 10; i++)
        ctx.fillRect(r.x + 9 + ((i * 33) % (r.w - 30)), r.y + 12 + Math.floor(i / 4) * 29, 17, 2);
    }
    if (r.kind === 'wall') {
      ctx.fillStyle = '#6c7365';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#b8b59a';
      ctx.fillRect(r.x + 5, r.y + 8, r.w - 10, r.h - 17);
      ctx.fillStyle = '#72634d';
      ctx.fillRect(r.x + 20, r.y + 26, 24, 28);
      ctx.fillRect(r.x + r.w - 44, r.y + 26, 24, 28);
      ctx.fillStyle = '#524e40';
      ctx.fillRect(r.x + r.w / 2 - 9, r.y + r.h - 34, 18, 34);
      ctx.fillStyle = '#807856';
      ctx.fillRect(r.x - 5, r.y - 6, r.w + 10, 12);
      ctx.fillStyle = '#a4956d';
      ctx.fillRect(r.x + 12, r.y - 13, r.w - 24, 8);
    }
    if (r.kind === 'thorns') {
      ctx.fillStyle = '#6e6976';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      for (let y = r.y + 5; y < r.y + r.h; y += 13)
        for (let x = r.x + 5; x < r.x + r.w; x += 13) {
          ctx.fillStyle = '#a68caa';
          ctx.fillRect(x, y, 4, 7);
          ctx.fillRect(x - 3, y + 3, 10, 3);
        }
    }
    if (r.kind === 'mud') {
      ctx.fillStyle = '#77765a';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#96916c';
      for (let i = 0; i < 8; i++) ctx.fillRect(r.x + 8 + i * 10, r.y + 9 + (i % 3) * 10, 9, 4);
    }
  }
  for (let x = 0; x < 38; x += 2)
    for (const y of [0, 25]) drawTree(ctx, x * TILE + 16, y * TILE + 16, s.area, true);
  for (let y = 1; y < 25; y += 2)
    for (const x of [0, 37]) drawTree(ctx, x * TILE + 16, y * TILE + 16, s.area, true);
  for (const e of WORLDS[s.area].exits) {
    ctx.fillStyle = '#725d3e';
    ctx.fillRect(e.x - 2, e.y - 8, 4, 22);
    ctx.fillStyle = '#e3d1a1';
    ctx.fillRect(e.x - 13, e.y - 18, 26, 14);
    ctx.fillStyle = '#5c6e48';
    ctx.fillRect(e.x - 6, e.y - 13, 12, 4);
  }
  if (path.length) {
    const t = path[path.length - 1];
    ctx.strokeStyle = '#f4e6b0';
    ctx.lineWidth = 2;
    ctx.strokeRect(t.x - 7, t.y - 6, 14, 12);
  }
  const drawable: { y: number; draw: () => void }[] = WORLDS[s.area].nodes.map((n) => ({
    y: n.y,
    draw: () => drawNode(ctx, n, s),
  }));
  if (s.area === 'forest') drawable.push({ y: BURROW.y, draw: () => drawBurrow(ctx, s) });
  for (const e of s.adventure.enemies)
    if (e.area === s.area && e.hp > 0)
      drawable.push({ y: e.y, draw: () => drawEnemy(ctx, e, time, reduced) });
  for (const d of s.adventure.drops)
    if (d.area === s.area)
      drawable.push({
        y: d.y,
        draw: () => {
          ctx.fillStyle = '#f3dca2';
          ctx.fillRect(d.x - 6, d.y - 8, 12, 10);
          ctx.fillStyle = '#916244';
          ctx.fillRect(d.x - 3, d.y - 5, 6, 6);
        },
      });
  if (s.area === 'forest')
    for (const e of s.pulse.events)
      if (!e.resolved) drawable.push({ y: e.y, draw: () => drawPulse(ctx, e, time, reduced) });
  drawable.push({
    y: s.position.y,
    draw: () => {
      const a = s.adventure;
      ctx.save();
      if (a.invulnerable > 0 && !reduced) ctx.globalAlpha = 0.6;
      if (a.dodgeTime > 0) {
        ctx.fillStyle = '#f7e6ae88';
        ctx.fillRect(s.position.x - 22, s.position.y - 15, 44, 25);
      }
      drawPlayer(ctx, s.position, moving, reduced ? 0 : time);
      if (a.armored) {
        ctx.fillStyle = '#5a7a69';
        ctx.fillRect(s.position.x - 10, s.position.y, 20, 6);
      }
      if (a.weapon !== 'paws') {
        ctx.fillStyle = a.weapon === 'ironSword' ? '#c4dfdb' : '#c4b789';
        ctx.fillRect(s.position.x + 15, s.position.y - 17, 4, 24);
        ctx.fillStyle = '#815c3d';
        ctx.fillRect(s.position.x + 11, s.position.y + 2, 12, 3);
      }
      if (a.attackFlash > 0) {
        ctx.strokeStyle = '#fff1bf';
        ctx.lineWidth = 5;
        ctx.beginPath();
        const angle = Math.atan2(a.facing.y, a.facing.x);
        ctx.arc(s.position.x, s.position.y - 5, 45, angle - 1.8, angle + 1.8);
        ctx.stroke();
      }
      ctx.restore();
    },
  });
  drawable.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
  const nearest = nearestNode(s);
  if (nearest && distance(s.position, nearest) < 58) {
    ctx.strokeStyle = '#f6e7ad';
    ctx.lineWidth = 2;
    ctx.strokeRect(nearest.x - 19, nearest.y - 24, 38, 40);
  }
  ctx.restore();
  if (s.area === 'cave') {
    const glow = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.22,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.7,
    );
    glow.addColorStop(0, '#12272b00');
    glow.addColorStop(1, '#0f1d29aa');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
  // Small overview of the whole area, with an actual player-position marker.
  const mw = 104,
    mh = 72,
    mx = w - mw - 16,
    my = h - mh - 16;
  ctx.fillStyle = '#263e35e8';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#99ad80';
  ctx.fillRect(mx + 4, my + 4, mw - 8, mh - 8);
  for (const r of WORLDS[s.area].rects) {
    ctx.fillStyle = r.kind === 'water' ? '#5c8c89' : r.kind === 'thorns' ? '#7a607f' : '#6f7859';
    ctx.fillRect(
      mx + 4 + (r.x / WIDTH) * (mw - 8),
      my + 4 + (r.y / HEIGHT) * (mh - 8),
      (r.w / WIDTH) * (mw - 8),
      (r.h / HEIGHT) * (mh - 8),
    );
  }
  for (const e of WORLDS[s.area].exits) {
    ctx.fillStyle = '#ecdaa5';
    ctx.fillRect(mx + 3 + (e.x / WIDTH) * (mw - 8), my + 3 + (e.y / HEIGHT) * (mh - 8), 4, 4);
  }
  for (const e of s.adventure.enemies)
    if (e.area === s.area && e.hp > 0) {
      ctx.fillStyle = e.kind === 'warden' ? '#a83144' : '#884c51';
      ctx.fillRect(mx + 3 + (e.x / WIDTH) * (mw - 8), my + 3 + (e.y / HEIGHT) * (mh - 8), 3, 3);
    }
  ctx.fillStyle = '#fff3d3';
  ctx.fillRect(
    mx + 2 + (s.position.x / WIDTH) * (mw - 8),
    my + 2 + (s.position.y / HEIGHT) * (mh - 8),
    5,
    5,
  );
  return { left, top, scale };
}

export function contextAction(s: SurvivalSave) {
  const pulse = nearPulse(s);
  if (pulse) return pulseNames[pulse.kind];
  if (s.adventure.drops.some((d) => d.area === s.area && distance(d, s.position) < 58))
    return 'Collect item drop';
  const exit = WORLDS[s.area].exits.find((e) => distance(s.position, e) < 65);
  if (exit) return exit.name;
  const n = nearestNode(s);
  if (n && distance(s.position, n) < 58)
    return n.kind === 'cache'
      ? 'Open hidden cache'
      : `Gather ${n.kind === 'berry' ? 'berries' : n.kind}`;
  if (s.area === 'forest' && distance(s.position, BURROW) < 115) return 'Tend the burrow';
  return 'Find a resource';
}

export function SurvivalMap({
  stateRef,
  running,
  onSnapshot,
  onResult,
  onPause,
  onPanel,
  onInteract,
  navigateTo,
}: {
  stateRef: MutableRefObject<SurvivalSave>;
  running: boolean;
  onSnapshot: () => void;
  onResult: (r: Result) => void;
  onPause: () => void;
  onPanel: (p: 'inventory' | 'crafting' | 'building' | 'quests' | 'map') => void;
  onInteract: () => void;
  navigateTo: Vec | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    wrapper = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>()),
    path = useRef<Vec[]>([]),
    pending = useRef<WorldNode | null>(null);
  const camera = useRef<Vec>({ ...stateRef.current.position }),
    geometry = useRef({ left: 0, top: 0, scale: 1.7 });
  const callbacks = useRef({ onSnapshot, onResult, onPause, onPanel, onInteract });
  callbacks.current = { onSnapshot, onResult, onPause, onPanel, onInteract };
  const active = useRef(running);
  active.current = running;
  const [sprinting, setSprinting] = useState(false);
  const sprintRef = useRef(sprinting);
  sprintRef.current = sprinting;
  const state = stateRef.current;
  useEffect(() => {
    if (navigateTo) {
      path.current = findPath(stateRef.current.area, stateRef.current.position, navigateTo);
      pending.current = null;
      canvas.current?.focus();
    }
  }, [navigateTo, stateRef]);
  useEffect(() => {
    if (!running) {
      keys.current.clear();
      path.current = [];
      pending.current = null;
    }
  }, [running]);
  useEffect(() => {
    const c = canvas.current!,
      host = wrapper.current!,
      ctx = c.getContext('2d');
    if (!ctx) return;
    let w = host.clientWidth,
      h = host.clientHeight,
      frame = 0,
      last = 0,
      snapshot = 0,
      oldArea = stateRef.current.area;
    const resize = () => {
      w = host.clientWidth;
      h = host.clientHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    const animate = (time: number) => {
      const dt = last ? Math.min((time - last) / 1000, 0.04) : 0;
      last = time;
      let s = stateRef.current,
        moving = false;
      if (active.current && !document.hidden && !s.adventure.dead) {
        let dx = 0,
          dy = 0;
        const k = keys.current;
        if (k.has('w') || k.has('arrowup')) dy--;
        if (k.has('s') || k.has('arrowdown')) dy++;
        if (k.has('a') || k.has('arrowleft')) dx--;
        if (k.has('d') || k.has('arrowright')) dx++;
        if (dx || dy) {
          path.current = [];
          pending.current = null;
        } else if (path.current.length) {
          const next = path.current[0],
            d = distance(s.position, next);
          if (d < 5) path.current.shift();
          else {
            dx = (next.x - s.position.x) / d;
            dy = (next.y - s.position.y) / d;
          }
        }
        if (s.adventure.dodgeTime > 0 && !dx && !dy) {
          dx = s.adventure.facing.x;
          dy = s.adventure.facing.y;
        }
        moving = !!(dx || dy);
        const sprint = (k.has('shift') || sprintRef.current) && moving && s.stamina > 2;
        s = movePlayer(s, dx, dy, dt, sprint);
        const survival = tick(s, dt, moving, sprint);
        const combat = stepAdventure(survival.save, dt);
        const advanced = { ...combat, message: combat.message || survival.message };
        s = advanced.save;
        stateRef.current = s;
        if (advanced.message) {
          path.current = [];
          pending.current = null;
          callbacks.current.onResult(advanced);
        }
        if (pending.current && distance(s.position, pending.current) < 55) {
          const r = gather(s, pending.current.id);
          stateRef.current = r.save;
          callbacks.current.onResult(r);
          pending.current = null;
          path.current = [];
        }
        if (time - snapshot > 120) {
          callbacks.current.onSnapshot();
          snapshot = time;
        }
      }
      s = stateRef.current;
      if (oldArea !== s.area || distance(camera.current, s.position) > 400) {
        camera.current = { ...s.position };
        path.current = [];
        oldArea = s.area;
      }
      const smoothing = matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 1
        : Math.min(1, dt * 10);
      camera.current = {
        x: camera.current.x + (s.position.x - camera.current.x) * smoothing,
        y: camera.current.y + (s.position.y - camera.current.y) * smoothing,
      };
      geometry.current = paintWorld(ctx, w, h, s, camera.current, time, moving, path.current);
      c.dataset.x = s.position.x.toFixed(2);
      c.dataset.y = s.position.y.toFixed(2);
      c.dataset.area = s.area;
      c.dataset.health = s.health.toFixed(1);
      c.dataset.kills = String(s.adventure.kills);
      c.dataset.dead = String(s.adventure.dead);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [stateRef]);
  function walk(dx: number, dy: number) {
    if (!running) return;
    const s = stateRef.current;
    path.current = findPath(s.area, s.position, {
      x: s.position.x + dx * TILE * 2,
      y: s.position.y + dy * TILE * 2,
    });
    pending.current = null;
    canvas.current?.focus();
  }
  return (
    <>
      <div className="survival-viewport" ref={wrapper}>
        <canvas
          ref={canvas}
          role="group"
          tabIndex={running ? 0 : -1}
          className="survival-canvas"
          aria-label={`${AREA_NAMES[state.area]} adventure. Arrow keys or W A S D to move. E to interact. Space to attack. Q to dodge. R to eat berries. Shift to sprint. I inventory, C crafting, B building, J quests, M map. Escape pauses.`}
          onKeyDown={(e) => {
            if (!running) return;
            const k = e.key.toLowerCase();
            if (['q', 'r'].includes(k)) e.preventDefault();
            if (
              [
                'w',
                'a',
                's',
                'd',
                'arrowup',
                'arrowdown',
                'arrowleft',
                'arrowright',
                'shift',
                'e',
                'i',
                'c',
                'b',
                'j',
                'm',
                'escape',
                ' ',
              ].includes(k)
            )
              e.preventDefault();
            if (
              [
                'w',
                'a',
                's',
                'd',
                'arrowup',
                'arrowdown',
                'arrowleft',
                'arrowright',
                'shift',
              ].includes(k)
            )
              keys.current.add(k);
            if (e.repeat) return;
            if (k === 'e') callbacks.current.onInteract();
            if (k === ' ') callbacks.current.onResult(attack(stateRef.current));
            if (k === 'q') callbacks.current.onResult(dodge(stateRef.current));
            if (k === 'r') callbacks.current.onResult(consume(stateRef.current, 'berry'));
            if (k === 'escape') callbacks.current.onPause();
            const panels = {
              i: 'inventory',
              c: 'crafting',
              b: 'building',
              j: 'quests',
              m: 'map',
            } as const;
            if (k in panels) callbacks.current.onPanel(panels[k as keyof typeof panels]);
          }}
          onPointerDown={(e) => {
            if (!running) return;
            e.currentTarget.focus();
            const r = e.currentTarget.getBoundingClientRect(),
              geo = geometry.current;
            const goal = {
                x: (e.clientX - r.left) / geo.scale + geo.left,
                y: (e.clientY - r.top) / geo.scale + geo.top,
              },
              s = stateRef.current;
            const enemy = s.adventure.enemies.find(
              (v) => v.area === s.area && v.hp > 0 && distance(v, goal) < 25,
            );
            if (enemy && distance(s.position, enemy) < 68) {
              callbacks.current.onResult(attack(s));
              return;
            }
            const n = WORLDS[s.area].nodes.find(
              (n) =>
                distance(n, goal) < 24 &&
                nodeReady(s, n) &&
                !(n.kind === 'cache' && s.treasures.includes(n.id)),
            );
            const exit = WORLDS[s.area].exits.find((v) => distance(v, goal) < 27);
            if (exit && distance(s.position, exit) < 65) {
              callbacks.current.onResult(travel(s, exit));
              return;
            }
            if (
              s.area === 'forest' &&
              distance(goal, BURROW) < 35 &&
              distance(s.position, BURROW) < 170
            ) {
              callbacks.current.onPanel('building');
              return;
            }
            path.current = findPath(s.area, s.position, n ?? goal);
            pending.current = n ?? null;
            if (n && distance(s.position, n) < 55) {
              const res = gather(s, n.id);
              callbacks.current.onResult(res);
              pending.current = null;
              path.current = [];
            }
          }}
        />
        {state.area === 'cave' && !state.adventure.bossDefeated && (
          <div className="boss-hud">
            <span>
              Root Warden {state.adventure.enemies.find((e) => e.kind === 'warden')?.hp.toFixed(0)}{' '}
              / 420
            </span>
            <progress
              aria-label="Root Warden health"
              max={420}
              value={state.adventure.enemies.find((e) => e.kind === 'warden')?.hp ?? 420}
            />
          </div>
        )}
        <div className="scene-corner" aria-hidden="true">
          <span className="scene-dot" /> {AREA_NAMES[state.area]}
          <span className="scene-weather">
            {state.area === 'forest'
              ? 'Sunlit clearing'
              : state.area === 'village'
                ? 'Quiet ruins'
                : state.area === 'cave'
                  ? 'Warden’s hollow'
                  : 'The wilds'}
          </span>
        </div>
      </div>
      <div className="world-controls">
        <div className="movement-pad" role="group" aria-label="Movement controls">
          <button aria-label="Move up" onClick={() => walk(0, -1)} disabled={!running}>
            <Icon name="up" />
          </button>
          <button aria-label="Move left" onClick={() => walk(-1, 0)} disabled={!running}>
            <Icon name="left" />
          </button>
          <button aria-label="Move down" onClick={() => walk(0, 1)} disabled={!running}>
            <Icon name="down" />
          </button>
          <button aria-label="Move right" onClick={() => walk(1, 0)} disabled={!running}>
            <Icon name="right" />
          </button>
        </div>
        <button
          className="sq-button sq-primary interact-button"
          disabled={!running}
          onClick={() => {
            onInteract();
            canvas.current?.focus();
          }}
        >
          <span className="key-hint">E</span>
          {contextAction(state)}
        </button>
        <button
          className="sq-button combat-button"
          disabled={!running}
          onClick={() => {
            onResult(attack(stateRef.current));
            canvas.current?.focus();
          }}
        >
          <span className="key-hint">Space</span> Attack
        </button>
        <button
          className="sq-button combat-button"
          disabled={!running}
          onClick={() => {
            onResult(dodge(stateRef.current));
            canvas.current?.focus();
          }}
        >
          <span className="key-hint">Q</span> Dodge
        </button>
        <button
          className="sq-button sprint-button"
          aria-label="Sprint"
          title="Sprint (uses stamina)"
          aria-pressed={sprinting}
          disabled={!running}
          onClick={() => setSprinting((v) => !v)}
        >
          <Icon name="bolt" size={17} />
          <span>Sprint</span>
        </button>
      </div>
    </>
  );
}
