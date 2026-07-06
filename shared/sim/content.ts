// Kernel Panic — Phase 0 content. One kitchen, three heat towers + a butter
// churn, three kernel varieties + one cob boss, ~15 rounds. All DATA: adding a
// tower/kernel/round is authoring, not engine work.

import { buildPath, type Path } from './path.ts'
import type { Vec2 } from '../vec.ts'
import type { KernelType, KernelTypeId, RoundDef, TowerType } from './types.ts'

// ── The map: a near-square boustrophedon with four straightaways ─────────────
// (640×640 fills phone screens far better than the old wide 640×420, and the
//  longer path gives more room for towers.)

const PATH_POINTS: Vec2[] = [
  { x: -24, y: 80 },
  { x: 560, y: 80 },
  { x: 560, y: 240 },
  { x: 80, y: 240 },
  { x: 80, y: 400 },
  { x: 560, y: 400 },
  { x: 560, y: 560 },
  { x: 80, y: 560 },
  { x: 80, y: 664 },
]

export const PATH: Path = buildPath(PATH_POINTS)

// ── Enemies (Michael's son's design — docs/enemy-design.md) ──────────────────
// The main pop-chain, biggest first. Speeds are the sheet's numbers (small mobs
// are FAST, fat mobs slow). "leak" is the sheet's D (lives lost on escape).

export const KERNELS: Record<KernelTypeId, KernelType> = {
  poppable: { id: 'poppable', name: 'Poppable Corn Kernel', hp: 1, speed: 100, bounty: 1, leak: 1, radius: 7, color: '#f4d58d' },
  kernel: {
    id: 'kernel', name: 'Corn Kernel', hp: 2, speed: 125, bounty: 2, leak: 2, radius: 8, color: '#f0c85a',
    children: { type: 'poppable', count: 1, spread: 10 },
  },
  hard: {
    id: 'hard', name: 'Hard Kernel', hp: 3, speed: 150, bounty: 3, leak: 3, radius: 9, color: '#d9a441',
    children: { type: 'kernel', count: 1, spread: 10 },
  },
  cob: {
    id: 'cob', name: 'Corn Cob', hp: 20, speed: 75, bounty: 10, leak: 20, radius: 15, color: '#e8c14a', cobShape: true,
    children: { type: 'hard', count: 4, spread: 12 },
  },
  bunch: {
    id: 'bunch', name: 'Corn Bunch', hp: 50, speed: 50, bounty: 20, leak: 50, radius: 19, color: '#e0b53a',
    cobShape: true, resistLaser: true,
    children: { type: 'cob', count: 4, spread: 16 },
  },
  ton: {
    id: 'ton', name: 'Corn Ton', hp: 100, speed: 25, bounty: 50, leak: 100, radius: 24, color: '#e8c14a',
    boss: true, cobShape: true,
    children: { type: 'bunch', count: 4, spread: 20 },
  },
  // ── Bonus mobs ──
  shiney: {
    id: 'shiney', name: 'Shiney Kernel', hp: 5, speed: 100, bounty: 10, leak: 5, radius: 9, color: '#fff3b0',
    children: { type: 'kernel', count: 1, spread: 10 },
  },
  // The buttery trio: leak 0 (can't hurt you), huge bounty, very fast — catch them for the payout.
  bkernel: { id: 'bkernel', name: 'Buttery Corn Kernel', hp: 8, speed: 500, bounty: 1000, leak: 0, radius: 10, color: '#ffd54a' },
  bpopcorn: { id: 'bpopcorn', name: 'Buttery Popcorn', hp: 12, speed: 750, bounty: 2500, leak: 0, radius: 11, color: '#ffe07a' },
  bcob: { id: 'bcob', name: 'Buttery Corn Cob', hp: 50, speed: 500, bounty: 10000, leak: 0, radius: 16, color: '#ffd54a', cobShape: true },
}

// ── Towers (heat is the through-line) ────────────────────────────────────────

// Two upgrade tiers each — damage scales to the new HP curve (a Corn Ton is
// ~1000 effective HP through its whole pop-chain, so late towers hit HARD).

export const TOWERS: Record<string, TowerType> = {
  fire: {
    id: 'fire',
    name: 'Fire Tosser',
    kind: 'dart',
    cost: 100,
    range: 96,
    cooldown: 0.5,
    damage: 1,
    color: '#ff7a3c',
    projSpeed: 320,
    blurb: 'Throws flame darts at one kernel. Cheap and reliable.',
    upgrades: [
      { name: 'Double Roast', cost: 120, patch: { cooldown: 0.34, damage: 3 } },
      { name: 'Inferno', cost: 300, patch: { cooldown: 0.24, damage: 9, range: 112 } },
    ],
  },
  microwave: {
    id: 'microwave',
    name: 'Microwave',
    kind: 'pulse',
    cost: 250,
    range: 74,
    cooldown: 1.0,
    damage: 1,
    color: '#5ad1e8',
    blurb: 'Pulses heat in a ring — hits every kernel around it.',
    upgrades: [
      { name: 'Overcharge', cost: 240, patch: { range: 98, damage: 3 } },
      { name: 'Meltdown', cost: 560, patch: { range: 122, damage: 8, cooldown: 0.8 } },
    ],
  },
  laser: {
    id: 'laser',
    name: 'Laser',
    kind: 'beam',
    cost: 320,
    range: 240,
    cooldown: 0.85,
    damage: 2,
    color: '#ff4d6d',
    beamWidth: 12,
    blurb: 'Piercing beam down a line. Loves straightaways — but Corn Bunches shrug it off.',
    upgrades: [
      { name: 'Focus Lens', cost: 300, patch: { cooldown: 0.6, damage: 5, beamWidth: 16 } },
      { name: 'Death Ray', cost: 680, patch: { cooldown: 0.45, damage: 12, beamWidth: 20 } },
    ],
  },
  churn: {
    id: 'churn',
    name: 'Butter Churn',
    kind: 'econ',
    cost: 525,
    range: 0,
    cooldown: 0,
    damage: 0,
    color: '#f2e2b0',
    income: 36,
    blurb: 'No attack. Slowly churns out butter every round you clear.',
    upgrades: [
      { name: 'Extra Cream', cost: 500, patch: { income: 82 } },
      { name: 'Creamery', cost: 900, patch: { income: 175 } },
    ],
  },
}

export const TOWER_ORDER = ['fire', 'microwave', 'laser', 'churn'] as const

// ── Rounds (~15, escalating) — the new roster ────────────────────────────────
// Counts are modest because every mob pops into a chain of children (one Corn
// Cob = 4 Hard = a dozen+ smaller kernels). Tune these numbers freely.

function g(type: KernelTypeId, count: number, gap: number, delay = 0) {
  return { type, count, gap, delay }
}

export const ROUNDS: RoundDef[] = [
  { groups: [g('poppable', 12, 22)], bonus: 60 }, // 1
  { groups: [g('poppable', 16, 16), g('kernel', 5, 26, 200)], bonus: 70 }, // 2
  { groups: [g('kernel', 14, 16)], bonus: 80 }, // 3
  { groups: [g('kernel', 12, 14), g('hard', 6, 26, 160)], bonus: 95 }, // 4
  { groups: [g('hard', 12, 16), g('shiney', 2, 60, 120)], bonus: 110 }, // 5
  { groups: [g('hard', 10, 14), g('cob', 2, 90, 140)], bonus: 130 }, // 6
  { groups: [g('cob', 3, 80), g('bkernel', 1, 0, 300)], bonus: 150 }, // 7 — first buttery bonus
  { groups: [g('cob', 4, 70), g('hard', 12, 12, 120)], bonus: 175 }, // 8
  { groups: [g('cob', 3, 80), g('shiney', 3, 50, 100), g('bpopcorn', 1, 0, 400)], bonus: 200 }, // 9
  { groups: [g('bunch', 2, 200), g('cob', 4, 60, 120)], bonus: 240 }, // 10 — first Corn Bunch
  { groups: [g('bunch', 3, 180), g('hard', 16, 10, 100)], bonus: 280 }, // 11
  { groups: [g('ton', 1, 0), g('cob', 4, 70, 180)], bonus: 360 }, // 12 — first Corn Ton
  { groups: [g('bunch', 5, 130), g('bcob', 1, 0, 500)], bonus: 320 }, // 13 — jackpot
  { groups: [g('ton', 2, 260), g('bunch', 4, 120, 120)], bonus: 450 }, // 14
  { groups: [g('ton', 3, 220), g('bunch', 6, 90, 100), g('bkernel', 2, 200, 500)], bonus: 800 }, // 15 finale
]

/** Endless: rounds past the campaign, escalating deterministically from seed. */
export function getRound(index: number, seed: number): RoundDef {
  if (index < ROUNDS.length) return ROUNDS[index]
  const over = index - ROUNDS.length + 1 // 1, 2, 3, …
  const r = ((seed ^ Math.imul(index + 1, 2654435761)) >>> 0) / 4294967296
  const tons = 3 + Math.floor(over / 2)
  const bunches = 6 + over * 2
  const gap = Math.max(60, 220 - over * 12)
  const groups = [
    g('ton', tons, gap),
    g('bunch', bunches, Math.max(50, 90 - over * 3), 120),
    g('bcob', 1 + Math.floor(over / 3), 0, 400 + Math.floor(r * 60)),
  ]
  return { groups, bonus: 400 + over * 40 }
}

/** A tower's effective stat at a level — later tiers override earlier ones. */
export function stat<K extends keyof TowerType>(t: TowerType, level: number, key: K): TowerType[K] {
  let v = t[key]
  for (let i = 0; i < level && i < t.upgrades.length; i++) {
    const patch = t.upgrades[i].patch as Record<string, unknown>
    if (key in patch && patch[key as string] !== undefined) v = patch[key as string] as TowerType[K]
  }
  return v
}

/** Butter income of a tower at a given level. */
export function towerIncome(t: TowerType, level: number): number {
  return (stat(t, level, 'income') as number | undefined) ?? 0
}

/** Total butter spent on a tower at a level (base + purchased tiers) — for sell refunds. */
export function towerSpent(t: TowerType, level: number): number {
  let spent = t.cost
  for (let i = 0; i < level && i < t.upgrades.length; i++) spent += t.upgrades[i].cost
  return spent
}
