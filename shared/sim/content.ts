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

// ── Kernels (the "bloon" layers) ─────────────────────────────────────────────

export const KERNELS: Record<KernelTypeId, KernelType> = {
  plain: { id: 'plain', name: 'Kernel', hp: 1, speed: 52, bounty: 3, leak: 1, radius: 8, color: '#f4d58d' },
  buttered: { id: 'buttered', name: 'Buttered', hp: 1, speed: 92, bounty: 4, leak: 1, radius: 8, color: '#f6b73c' },
  caramel: {
    id: 'caramel',
    name: 'Caramel Cluster',
    hp: 5,
    speed: 38,
    bounty: 6,
    leak: 3,
    radius: 11,
    color: '#b5651d',
    children: { type: 'plain', count: 3, spread: 9 },
  },
  cob: {
    id: 'cob',
    name: 'COB',
    hp: 70,
    speed: 27,
    bounty: 55,
    leak: 12,
    radius: 20,
    color: '#e8c14a',
    boss: true,
    children: { type: 'buttered', count: 8, spread: 10 },
  },
}

// ── Towers (heat is the through-line) ────────────────────────────────────────

export const TOWERS: Record<string, TowerType> = {
  fire: {
    id: 'fire',
    name: 'Fire Tosser',
    kind: 'dart',
    cost: 100,
    range: 96,
    cooldown: 0.55,
    damage: 1,
    color: '#ff7a3c',
    projSpeed: 300,
    blurb: 'Throws flame darts at one kernel. Cheap and reliable.',
    upgrade: { name: 'Double Roast', cost: 90, patch: { cooldown: 0.32, damage: 2 } },
  },
  microwave: {
    id: 'microwave',
    name: 'Microwave',
    kind: 'pulse',
    cost: 250,
    range: 74,
    cooldown: 1.1,
    damage: 1,
    color: '#5ad1e8',
    blurb: 'Pulses heat in a ring — hits every kernel around it.',
    upgrade: { name: 'Overcharge', cost: 240, patch: { range: 98, damage: 2 } },
  },
  laser: {
    id: 'laser',
    name: 'Laser',
    kind: 'beam',
    cost: 320,
    range: 240,
    cooldown: 0.9,
    damage: 2,
    color: '#ff4d6d',
    beamWidth: 12,
    blurb: 'Fires a piercing beam down a line. Loves straightaways.',
    upgrade: { name: 'Focus Lens', cost: 300, patch: { cooldown: 0.62, damage: 3, beamWidth: 16 } },
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
    income: 36, // nerfed: was cheap (400) + flooded (80/round). Now a real long-term bet.
    blurb: 'No attack. Slowly churns out a little butter every round you clear.',
    upgrade: { name: 'Extra Cream', cost: 500, patch: { income: 82 } },
  },
}

export const TOWER_ORDER = ['fire', 'microwave', 'laser', 'churn'] as const

// ── Rounds (~15, escalating) ─────────────────────────────────────────────────

function g(type: KernelTypeId, count: number, gap: number, delay = 0) {
  return { type, count, gap, delay }
}

export const ROUNDS: RoundDef[] = [
  // Early rounds bump up + bonuses trim down (2026-07-05 balance: 3 fire tossers
  // held 9 rounds unscathed; early game needs teeth and less of a money flood).
  { groups: [g('plain', 12, 22)], bonus: 26 }, // 1
  { groups: [g('plain', 20, 16)], bonus: 28 }, // 2
  { groups: [g('plain', 16, 15), g('buttered', 6, 26, 200)], bonus: 32 }, // 3
  { groups: [g('buttered', 16, 16)], bonus: 36 }, // 4
  { groups: [g('plain', 18, 12), g('caramel', 4, 54, 120)], bonus: 42 }, // 5
  { groups: [g('buttered', 20, 13), g('caramel', 6, 44, 200)], bonus: 48 }, // 6
  { groups: [g('caramel', 11, 34)], bonus: 56 }, // 7
  { groups: [g('cob', 1, 0), g('plain', 16, 14, 120)], bonus: 90 }, // 8 — first boss
  { groups: [g('buttered', 20, 12), g('caramel', 5, 44, 260)], bonus: 70 }, // 9
  { groups: [g('caramel', 10, 34), g('buttered', 12, 14, 100)], bonus: 80 }, // 10
  { groups: [g('cob', 1, 0), g('caramel', 8, 40, 120)], bonus: 110 }, // 11
  { groups: [g('cob', 2, 260), g('buttered', 24, 11, 90)], bonus: 130 }, // 12
  { groups: [g('caramel', 16, 26)], bonus: 100 }, // 13
  { groups: [g('cob', 2, 220), g('caramel', 10, 34, 120)], bonus: 150 }, // 14
  { groups: [g('cob', 3, 200), g('buttered', 30, 10, 80), g('caramel', 8, 40, 400)], bonus: 300 }, // 15 finale
]

/** Endless: rounds past the scripted campaign, escalating deterministically from
 * the seed. Each round beyond 15 adds more kernels and more cobs. */
export function getRound(index: number, seed: number): RoundDef {
  if (index < ROUNDS.length) return ROUNDS[index]
  const over = index - ROUNDS.length + 1 // 1, 2, 3, …
  // deterministic small variation per round so endless doesn't feel identical
  const r = ((seed ^ Math.imul(index + 1, 2654435761)) >>> 0) / 4294967296
  const cobs = 3 + Math.floor(over / 2)
  const buttered = 28 + over * 5
  const caramel = 8 + over * 2
  const gap = Math.max(6, 11 - Math.floor(over / 3))
  const groups = [
    g('cob', cobs, Math.max(140, 220 - over * 6)),
    g('buttered', buttered, gap, 70),
    g('caramel', caramel, 32 + Math.floor(r * 10), 260),
  ]
  return { groups, bonus: 200 + over * 20 }
}

/** Butter income of a tower at a given level (base or upgraded). */
export function towerIncome(t: TowerType, level: number): number {
  const inc = t.income ?? 0
  return level >= 1 && t.upgrade.patch.income !== undefined ? t.upgrade.patch.income : inc
}

/** A tower's effective stat at a level, applying the upgrade patch at level 1. */
export function stat<K extends keyof TowerType>(t: TowerType, level: number, key: K): TowerType[K] {
  if (level >= 1 && key in t.upgrade.patch) {
    const v = (t.upgrade.patch as Record<string, unknown>)[key as string]
    if (v !== undefined) return v as TowerType[K]
  }
  return t[key]
}
