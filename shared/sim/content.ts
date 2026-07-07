// Kernel Panic — Phase 0 content. One kitchen, three heat towers + a butter
// churn, three kernel varieties + one cob boss, ~15 rounds. All DATA: adding a
// tower/kernel/round is authoring, not engine work.

import type { KernelType, KernelTypeId, RoundDef, TowerType } from './types.ts'

// The map is now data in maps.ts (Michael's son drew four; the classic kitchen
// is the default). PATH is re-exported for the oracle's path tests.
export { PATH } from './maps.ts'

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
    cobShape: true,
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
    resistLaser: true, // the shiny coat bounces the beam right off
    children: { type: 'kernel', count: 1, spread: 10 },
  },
  // The buttery trio: leak 0 (can't hurt you), huge bounty, very fast — catch them for the payout.
  bkernel: { id: 'bkernel', name: 'Buttery Corn Kernel', hp: 8, speed: 500, bounty: 1000, leak: 0, radius: 10, color: '#ffd54a' },
  bpopcorn: { id: 'bpopcorn', name: 'Buttery Popcorn', hp: 12, speed: 750, bounty: 2500, leak: 0, radius: 11, color: '#ffe07a' },
  bcob: { id: 'bcob', name: 'Buttery Corn Cob', hp: 50, speed: 500, bounty: 10000, leak: 0, radius: 16, color: '#ffd54a', cobShape: true },
}

// ── Towers — the crosspath trees (Michael's son's "Tower Update" sheet) ──────
// Each attacking tower has 3 paths (damage / fire-rate / range), 2 tiers each;
// you may invest in at most maxPaths (2) of them. SPS = shots/sec (cooldown =
// 1/sps), DPH = damage/hit, pierce = mobs hit per shot (999 = all in line/ring),
// range tiers multiply the base range. Full table + rationale: docs/tower-design.md.

export const TOWERS: Record<string, TowerType> = {
  fire: {
    id: 'fire', name: 'Fire Tosser', kind: 'dart',
    cost: 200, dph: 1, sps: 1, pierce: 1, range: 96, projSpeed: 320, color: '#ff7a3c', maxPaths: 2,
    blurb: 'Throws a flame dart at one kernel. Cheap, fast, single-target.',
    paths: [
      { key: 'dmg', label: 'Damage', tiers: [
        { name: 'Hot Shot', cost: 250, dph: 3 },
        { name: 'Blazing Shot', cost: 750, dph: 5 },
      ] },
      { key: 'rate', label: 'Fire Rate', tiers: [
        { name: 'Quick Load', cost: 250, sps: 2 },
        { name: 'Triple Shot', cost: 750, sps: 3 },
      ] },
      { key: 'range', label: 'Range', tiers: [
        { name: 'High-Power Launcher', cost: 300, rangeMul: 1.25 },
        { name: 'Mega Launcher', cost: 800, rangeMul: 1.5 },
      ] },
    ],
  },
  microwave: {
    id: 'microwave', name: 'Microwave', kind: 'pulse',
    cost: 750, dph: 3, sps: 0.5, pierce: 999, range: 74, color: '#5ad1e8', maxPaths: 2,
    blurb: 'Pulses heat in a ring — hits every kernel around it.',
    paths: [
      { key: 'dmg', label: 'Damage', tiers: [
        { name: 'High-Power Wave', cost: 750, dph: 5 },
        { name: 'Mega Wave', cost: 1000, dph: 10 },
      ] },
      { key: 'rate', label: 'Fire Rate', tiers: [
        { name: 'Faster Wave', cost: 1000, sps: 1 },
        { name: 'Super-Fast Wave', cost: 1500, sps: 1.5 },
      ] },
      { key: 'range', label: 'Range', tiers: [
        { name: 'Long Wave', cost: 750, rangeMul: 1.25 },
        { name: 'Super Long Wave', cost: 1000, rangeMul: 1.5 },
      ] },
    ],
  },
  laser: {
    id: 'laser', name: 'Laser', kind: 'beam',
    cost: 500, dph: 5, sps: 0.5, pierce: 999, range: 240, beamWidth: 14, color: '#ff4d6d', maxPaths: 2,
    blurb: 'Piercing beam down a line — slow but heavy. Shiney Kernels bounce it off.',
    paths: [
      { key: 'dmg', label: 'Damage', tiers: [
        { name: 'Focus Lens', cost: 500, dph: 10 },
        { name: 'Death Ray', cost: 1000, dph: 15 },
      ] },
      { key: 'rate', label: 'Fire Rate', tiers: [
        { name: 'Faster Fire', cost: 500, sps: 1 },
        { name: 'Fastest Fire', cost: 1000, sps: 2 },
      ] },
      { key: 'range', label: 'Range', tiers: [
        { name: 'Mega Range', cost: 500, rangeMul: 1.25 },
        { name: 'Super Range', cost: 1000, rangeMul: 1.5 },
      ] },
    ],
  },
  churn: {
    id: 'churn', name: 'Butter Churn', kind: 'econ',
    cost: 1500, dph: 0, sps: 0, pierce: 0, range: 0, income: 250, color: '#f2e2b0', maxPaths: 2,
    blurb: 'No attack. Churns out butter every round — now with three paths (pick 2).',
    paths: [
      // Path 1 — flat income each round you clear (the original churn).
      { key: 'butter', label: 'Butter', tiers: [
        { name: 'More Butter', cost: 1000, income: 300 },
        { name: 'Even More Butter', cost: 1250, income: 500 },
        { name: 'More More More!', cost: 1500, income: 750 },
        { name: 'All The BUTTER!', cost: 3000, income: 1000 },
      ] },
      // Path 2 — Butter Bank: interest on the butter you're holding at round clear.
      { key: 'bank', label: 'Butter Bank', tiers: [
        { name: 'Piggy Churn', cost: 1000, interest: 0.05 },
        { name: 'Savings Churn', cost: 1500, interest: 0.10 },
        { name: 'Compound Churn', cost: 2500, interest: 0.20 },
      ] },
      // Path 3 — Butter Boost: an aura that tips nearby attacking towers extra butter per pop.
      { key: 'boost', label: 'Butter Boost', tiers: [
        { name: 'Buttery Aura', cost: 1200, boostRadius: 90, boostPerPop: 1 },
        { name: 'Golden Aura', cost: 2000, boostRadius: 115, boostPerPop: 2 },
        { name: 'Butter Storm', cost: 3500, boostRadius: 140, boostPerPop: 3 },
      ] },
    ],
  },
}

export const TOWER_ORDER = ['fire', 'microwave', 'laser', 'churn'] as const

// ── Waves 1-20 — Michael's son's wave chart (2026-07-06) ─────────────────────
// Transcribed exactly from his hand-drawn sheet: per-wave counts are HIS; the
// spawn timing (gaps/delays) and clear bonuses are tuned to keep it winnable.
// After wave 20 it's Free Play (the endless generator below). Every mob pops
// into a chain of children, so a single Corn Cob is really 4 Hard = a dozen+
// small kernels. Counts/bonuses are DATA — his to tune.

function g(type: KernelTypeId, count: number, gap: number, delay = 0) {
  return { type, count, gap, delay }
}

export const ROUNDS: RoundDef[] = [
  { groups: [g('poppable', 10, 20)], bonus: 60 }, // 1
  { groups: [g('poppable', 20, 16)], bonus: 70 }, // 2
  { groups: [g('poppable', 25, 14), g('kernel', 5, 30, 120)], bonus: 80 }, // 3
  { groups: [g('poppable', 30, 12), g('kernel', 10, 22, 120)], bonus: 95 }, // 4
  { groups: [g('poppable', 15, 16), g('hard', 3, 40, 120), g('bkernel', 1, 0, 260)], bonus: 120 }, // 5 — first buttery
  { groups: [g('poppable', 20, 12), g('kernel', 15, 16, 120), g('hard', 10, 24, 320)], bonus: 140 }, // 6
  { groups: [g('hard', 20, 16)], bonus: 150 }, // 7
  { groups: [g('poppable', 50, 8)], bonus: 170 }, // 8
  { groups: [g('shiney', 5, 40)], bonus: 160 }, // 9 — laser-proof
  { groups: [g('kernel', 50, 10)], bonus: 220 }, // 10
  { groups: [g('poppable', 25, 10), g('kernel', 20, 14, 150), g('hard', 15, 20, 360), g('bkernel', 1, 0, 300)], bonus: 280 }, // 11
  { groups: [g('hard', 15, 18), g('kernel', 20, 12, 200), g('shiney', 10, 30, 420)], bonus: 300 }, // 12
  { groups: [g('poppable', 60, 7), g('kernel', 40, 9, 160), g('hard', 25, 16, 380)], bonus: 360 }, // 13
  { groups: [g('poppable', 100, 5)], bonus: 340 }, // 14
  { groups: [g('cob', 1, 0)], bonus: 300 }, // 15 — first Corn Cob
  { groups: [g('hard', 20, 14), g('kernel', 25, 10, 140), g('cob', 1, 0, 360)], bonus: 420 }, // 16
  { groups: [g('cob', 2, 120)], bonus: 480 }, // 17
  { groups: [g('kernel', 100, 6)], bonus: 520 }, // 18
  { groups: [g('cob', 3, 110)], bonus: 640 }, // 19
  { groups: [g('bunch', 1, 0), g('bpopcorn', 1, 0, 240)], bonus: 900 }, // 20 — Corn Bunch + buttery jackpot
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

/** Effective dph/sps/income given the tiers bought across all paths (each stat
 * lives in one path; a later tier of that path overrides the earlier value). */
export function effStat(t: TowerType, levels: number[], key: 'dph' | 'sps' | 'income'): number {
  let v = (t[key] as number | undefined) ?? 0
  t.paths.forEach((p, i) => {
    for (let tier = 0; tier < (levels[i] ?? 0); tier++) {
      const val = p.tiers[tier][key]
      if (val !== undefined) v = val
    }
  })
  return v
}

/** Effective range = base × the highest range-tier multiplier bought. */
export function effRange(t: TowerType, levels: number[]): number {
  let mul = 1
  t.paths.forEach((p, i) => {
    for (let tier = 0; tier < (levels[i] ?? 0); tier++) {
      if (p.tiers[tier].rangeMul !== undefined) mul = p.tiers[tier].rangeMul!
    }
  })
  return t.range * mul
}

export function towerIncome(t: TowerType, levels: number[]): number {
  return effStat(t, levels, 'income')
}

/** Last value of an arbitrary tier field across bought tiers (0 if unbought).
 * Used for the Butter Churn's Bank (interest) and Boost (aura) paths. */
export function tierValue(t: TowerType, levels: number[], key: 'interest' | 'boostRadius' | 'boostPerPop'): number {
  let v = 0
  t.paths.forEach((p, i) => {
    for (let tier = 0; tier < (levels[i] ?? 0); tier++) {
      const val = p.tiers[tier][key]
      if (val !== undefined) v = val
    }
  })
  return v
}

/** How many paths have at least one tier bought (the crosspath "pick 2" gate). */
export function activePaths(levels: number[]): number {
  return levels.filter((l) => l > 0).length
}

/** Total butter spent (base + every purchased tier) — for the 70% sell refund. */
export function towerSpent(t: TowerType, levels: number[]): number {
  let spent = t.cost
  t.paths.forEach((p, i) => {
    for (let tier = 0; tier < (levels[i] ?? 0); tier++) spent += p.tiers[tier].cost
  })
  return spent
}
