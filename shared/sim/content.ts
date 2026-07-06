// Kernel Panic — Phase 0 content. One kitchen, three heat towers + a butter
// churn, three kernel varieties + one cob boss, ~15 rounds. All DATA: adding a
// tower/kernel/round is authoring, not engine work.

import { buildPath, type Path } from './path.ts'
import type { Vec2 } from '../vec.ts'
import type { KernelType, KernelTypeId, RoundDef, TowerType } from './types.ts'

// ── The map: a snake path with three straightaways for towers ────────────────

const PATH_POINTS: Vec2[] = [
  { x: -24, y: 90 },
  { x: 120, y: 90 },
  { x: 120, y: 330 },
  { x: 300, y: 330 },
  { x: 300, y: 90 },
  { x: 480, y: 90 },
  { x: 480, y: 330 },
  { x: 664, y: 330 },
]

export const PATH: Path = buildPath(PATH_POINTS)

// ── Kernels (the "bloon" layers) ─────────────────────────────────────────────

export const KERNELS: Record<KernelTypeId, KernelType> = {
  plain: { id: 'plain', name: 'Kernel', hp: 1, speed: 46, bounty: 3, leak: 1, radius: 8, color: '#f4d58d' },
  buttered: { id: 'buttered', name: 'Buttered', hp: 1, speed: 82, bounty: 4, leak: 1, radius: 8, color: '#f6b73c' },
  caramel: {
    id: 'caramel',
    name: 'Caramel Cluster',
    hp: 4,
    speed: 34,
    bounty: 7,
    leak: 3,
    radius: 11,
    color: '#b5651d',
    children: { type: 'plain', count: 3, spread: 9 },
  },
  cob: {
    id: 'cob',
    name: 'COB',
    hp: 60,
    speed: 24,
    bounty: 60,
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
    cost: 400,
    range: 0,
    cooldown: 0,
    damage: 0,
    color: '#f2e2b0',
    income: 80,
    blurb: 'No attack. Churns out butter every round you clear.',
    upgrade: { name: 'Extra Cream', cost: 350, patch: { income: 170 } },
  },
}

export const TOWER_ORDER = ['fire', 'microwave', 'laser', 'churn'] as const

// ── Rounds (~15, escalating) ─────────────────────────────────────────────────

function g(type: KernelTypeId, count: number, gap: number, delay = 0) {
  return { type, count, gap, delay }
}

export const ROUNDS: RoundDef[] = [
  { groups: [g('plain', 8, 26)], bonus: 30 }, // 1
  { groups: [g('plain', 14, 20)], bonus: 32 }, // 2
  { groups: [g('plain', 10, 18), g('buttered', 4, 30, 220)], bonus: 36 }, // 3
  { groups: [g('buttered', 10, 20)], bonus: 40 }, // 4
  { groups: [g('plain', 12, 14), g('caramel', 3, 60, 120)], bonus: 46 }, // 5
  { groups: [g('buttered', 14, 16), g('caramel', 4, 50, 200)], bonus: 52 }, // 6
  { groups: [g('caramel', 8, 40)], bonus: 60 }, // 7
  { groups: [g('cob', 1, 0), g('plain', 16, 14, 120)], bonus: 90 }, // 8 — first boss
  { groups: [g('buttered', 20, 12), g('caramel', 5, 44, 260)], bonus: 70 }, // 9
  { groups: [g('caramel', 10, 34), g('buttered', 12, 14, 100)], bonus: 80 }, // 10
  { groups: [g('cob', 1, 0), g('caramel', 8, 40, 120)], bonus: 110 }, // 11
  { groups: [g('cob', 2, 260), g('buttered', 24, 11, 90)], bonus: 130 }, // 12
  { groups: [g('caramel', 16, 26)], bonus: 100 }, // 13
  { groups: [g('cob', 2, 220), g('caramel', 10, 34, 120)], bonus: 150 }, // 14
  { groups: [g('cob', 3, 200), g('buttered', 30, 10, 80), g('caramel', 8, 40, 400)], bonus: 300 }, // 15 finale
]

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
