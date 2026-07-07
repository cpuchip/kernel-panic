// Kernel Panic — Phase 0 content. One kitchen, three heat towers + a butter
// churn, three kernel varieties + one cob boss, ~15 rounds. All DATA: adding a
// tower/kernel/round is authoring, not engine work.

import { mulberry32 } from '../rng.ts'
import type { KernelType, KernelTypeId, RoundDef, TowerType } from './types.ts'

// The map is now data in maps.ts (Michael's son drew four; the classic kitchen
// is the default). PATH is re-exported for the oracle's path tests.
export { PATH } from './maps.ts'

// ── Enemies — roster v2 (Michael's son — docs/enemy-design-v2.md) ────────────
// Faithful Bloons-TD port. Speeds are his relative "×" units (SPEED_SCALE maps
// them onto the board). "leak" is his D — lives lost on escape; a big cob leak
// is instant game over. bounty 0 on the cobs is intentional: their butter comes
// from the cascade of children they pop into. Freeze/bomb resistances are LATENT
// (recorded, but do nothing until those towers ship next update).
const g1 = (type: KernelTypeId, count: number, spread = 12) => ({ type, count, spread })

export const KERNELS: Record<KernelTypeId, KernelType> = {
  // ── Basic chain (1 HP each, Bloons layers) ──
  poppable: { id: 'poppable', name: 'Poppable Corn Kernel', hp: 1, speed: 100, bounty: 1, leak: 1, radius: 7, color: '#f4d58d' },
  kernel: { id: 'kernel', name: 'Corn Kernel', hp: 1, speed: 125, bounty: 2, leak: 2, radius: 8, color: '#f0c85a', children: [g1('poppable', 1)] },
  hard: { id: 'hard', name: 'Hard Kernel', hp: 1, speed: 150, bounty: 3, leak: 3, radius: 9, color: '#d9a441', children: [g1('kernel', 1)] },
  // ── Rush kernels (fast, no split, they HURT if they leak) ──
  kettle: { id: 'kettle', name: 'Kettle Corn', hp: 1, speed: 200, bounty: 1, leak: 4, radius: 8, color: '#c8822e' },
  candy: { id: 'candy', name: 'Candy Corn', hp: 1, speed: 250, bounty: 1, leak: 5, radius: 8, color: '#f0932e' },
  // ── Immunity kernels (freeze/bomb resist LATENT) ──
  black: { id: 'black', name: 'Black Kernel', hp: 1, speed: 150, bounty: 1, leak: 6, radius: 9, color: '#3a3330', resistBomb: true },
  white: { id: 'white', name: 'White Kernel', hp: 1, speed: 150, bounty: 1, leak: 6, radius: 9, color: '#f5f0e0', resistFreeze: true },
  blackwhite: { id: 'blackwhite', name: 'Black-and-White Kernel', hp: 1, speed: 175, bounty: 1, leak: 7, radius: 9, color: '#9a9088', resistBomb: true, resistFreeze: true, children: [g1('black', 1), g1('white', 1)] },
  purple: { id: 'purple', name: 'Purple Kernel', hp: 1, speed: 200, bounty: 1, leak: 7, radius: 9, color: '#9a5cc8', resistLaser: true, resistFreeze: true },
  melted: { id: 'melted', name: 'Melted Kernel', hp: 5, speed: 100, bounty: 1, leak: 7, radius: 10, color: '#b06a3a', resistLaser: true },
  rainbow: { id: 'rainbow', name: 'Rainbow Kernel', hp: 1, speed: 200, bounty: 1, leak: 8, radius: 10, color: '#d94f8a', children: [g1('blackwhite', 2)] },
  superhard: { id: 'superhard', name: 'Super Hard Kernel', hp: 10, speed: 200, bounty: 1, leak: 9, radius: 11, color: '#8a8f9a', children: [g1('rainbow', 2)] },
  shiney: { id: 'shiney', name: 'Shiney Kernel', hp: 5, speed: 100, bounty: 10, leak: 5, radius: 9, color: '#fff3b0', resistLaser: true, children: [g1('kernel', 1)] },
  // ── Cob bosses (MOAB class; bounty 0, butter comes from the cascade) ──
  cob: { id: 'cob', name: 'Corn Cob', hp: 200, speed: 75, bounty: 0, leak: 616, radius: 15, color: '#e8c14a', cobShape: true, children: [g1('superhard', 4, 14)] },
  quickcob: { id: 'quickcob', name: 'Quick Cob', hp: 400, speed: 200, bounty: 0, leak: 816, radius: 14, color: '#e8b84a', cobShape: true, children: [g1('superhard', 4, 14)] },
  bunch: { id: 'bunch', name: 'Corn Bunch', hp: 1400, speed: 50, bounty: 0, leak: 3064, radius: 19, color: '#e0b53a', cobShape: true, children: [g1('cob', 4, 16)] },
  ton: { id: 'ton', name: 'Corn Ton', hp: 4000, speed: 25, bounty: 0, leak: 16656, radius: 24, color: '#e8c14a', boss: true, cobShape: true, children: [g1('bunch', 4, 20)] },
  bigcorn: { id: 'bigcorn', name: 'Big Corn of Doom', hp: 20000, speed: 25, bounty: 0, leak: 55760, radius: 30, color: '#caa63a', boss: true, cobShape: true, children: [g1('ton', 2, 24), g1('quickcob', 3, 18)] },
  // ── Buttery trio (leak 0, huge bounty, very fast — catch for the payout) ──
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

// ── The round system — a procedural 100-round curve (docs/enemy-design-v2.md) ──
// Boss rounds are PINNED (Corn Cob 40, Corn Bunch 60, Corn Ton 80, Big Corn of
// Doom 100); everything in between FLOWS: a threat budget grows with the round
// and is spent on whatever mob types have unlocked, strongest-first but kept a
// mix. After round 100 it's Free Play (endless, ever-escalating). Fully
// deterministic in (seed, round). Ratified: our own numbers in the BTD spirit,
// nobody hand-authors 100 rounds. It's all DATA — balance rides on this curve.

export const CAMPAIGN_ROUNDS = 100

function g(type: KernelTypeId, count: number, gap: number, delay = 0) {
  return { type, count, gap, delay }
}

// round at which each mob first shows up in NORMAL rounds (bosses also pinned below)
const UNLOCK: [KernelTypeId, number][] = [
  ['poppable', 1], ['kernel', 2], ['hard', 4],
  ['kettle', 11], ['candy', 12], ['black', 13], ['white', 15],
  ['blackwhite', 21], ['melted', 23], ['purple', 25], ['rainbow', 27],
  ['superhard', 31],
  ['cob', 41], ['bunch', 61], ['quickcob', 62], ['ton', 81],
]
// rough threat cost per mob — drives how many fit in a round's budget
const THREAT: Partial<Record<KernelTypeId, number>> = {
  poppable: 1, kernel: 2, hard: 3, kettle: 4, candy: 5,
  black: 6, white: 6, blackwhite: 7, purple: 8, melted: 9,
  rainbow: 16, superhard: 34, cob: 320, quickcob: 380, bunch: 1300, ton: 5200,
}

function threatBudget(r: number): number {
  return Math.round(4 * Math.pow(r, 1.7))
}
function roundBonus(r: number): number {
  // generous: cob bodies pay 0 bounty, so bonuses + the child-cascade carry the economy
  return Math.round(45 + r * 9 + Math.pow(r, 1.5) * 1.4)
}
function rng01(seed: number, r: number): number {
  return ((seed ^ Math.imul(r + 1, 2654435761)) >>> 0) / 4294967296
}

function normalRound(r: number, seed: number): RoundDef {
  let budget = threatBudget(r)
  const unlocked = UNLOCK.filter(([, u]) => u <= r).map(([t]) => t)
    .sort((a, b) => (THREAT[b] ?? 0) - (THREAT[a] ?? 0)) // strong → weak
  const groups: ReturnType<typeof g>[] = []
  let delay = 0
  for (let i = 0; i < unlocked.length && budget > 4; i++) {
    const t = unlocked[i]
    const cost = THREAT[t] ?? 1
    // stronger tiers take a smaller share so a round stays a MIX, not a wall of the toughest
    const share = i === 0 ? 0.5 : 0.55
    const count = Math.floor((budget * share) / cost)
    if (count <= 0) continue
    const gap = Math.max(6, Math.round(280 / Math.max(4, count))) // denser groups spawn faster
    groups.push(g(t, count, gap, delay))
    budget -= count * cost
    delay += 40
  }
  if (budget > 0) groups.push(g('poppable', budget, 10, delay)) // leftover → fodder
  // sprinkle a buttery reward now and then (mid-round, late)
  if (r >= 5 && r % 8 === 5) {
    const b: KernelTypeId = r < 30 ? 'bkernel' : r < 60 ? 'bpopcorn' : 'bcob'
    groups.push(g(b, 1, 0, 260 + Math.floor(rng01(seed, r) * 120)))
  }
  return { groups, bonus: roundBonus(r) }
}

function bossRound(boss: KernelTypeId, r: number): RoundDef {
  // JUST the boss — no escort kernels (his call). It's a pure duel with the one
  // mob; it breaks into its own children when popped, and that's the whole round.
  return { groups: [g(boss, 1, 0, 0)], bonus: roundBonus(r) + 300 }
}

/** The round for a 0-based index. Rounds 1-100 are the campaign; 101+ is Free Play. */
export function getRound(index: number, seed: number): RoundDef {
  const r = index + 1
  if (r === 40) return bossRound('cob', r)
  if (r === 60) return bossRound('bunch', r)
  if (r === 80) return bossRound('ton', r)
  if (r === 100) return { groups: [g('bigcorn', 1, 0, 0)], bonus: roundBonus(r) + 2000 }
  if (r <= CAMPAIGN_ROUNDS) return normalRound(r, seed)
  return freePlayRound(r, seed)
}

/** Free Play (round 101+) — PURELY RANDOM and cob-heavy (his call): fewer small
 * kernels and more/bigger cobs the deeper you go, trending to nearly all
 * cob-family mobs. Still deterministic in (seed, round). */
function freePlayRound(r: number, seed: number): RoundDef {
  const over = r - CAMPAIGN_ROUNDS
  const rand = mulberry32((seed ^ Math.imul(r + 1, 2654435761)) >>> 0)
  const budget = Math.round(threatBudget(CAMPAIGN_ROUNDS) * (1 + over * 0.15))
  const groups: ReturnType<typeof g>[] = []
  let b = budget
  let delay = 0
  // a SHRINKING sprinkle of small mobs — gone by ~round 113, then it's pure cobs
  const smallFrac = Math.max(0, 0.35 - over * 0.028)
  if (smallFrac > 0) {
    let sb = b * smallFrac
    const pool: KernelTypeId[] = ['superhard', 'rainbow', 'kettle', 'candy', 'black', 'white', 'purple']
    let guardS = 40
    while (sb > 20 && guardS-- > 0) {
      const t = pool[Math.floor(rand() * pool.length)]
      const cost = THREAT[t] ?? 6
      const count = 1 + Math.floor(rand() * Math.min(24, sb / cost))
      groups.push(g(t, count, Math.max(6, Math.round(240 / Math.max(4, count))), delay))
      sb -= count * cost
      delay += 30
    }
    b -= budget * smallFrac
  }
  // the bulk: random cob-family, weighted toward BIGGER cobs as over grows
  const cobPool: [KernelTypeId, number][] = [
    ['cob', Math.max(1, 12 - over * 0.3)],
    ['quickcob', Math.max(1, 9 - over * 0.2)],
    ['bunch', 2 + over * 0.35],
    ['ton', 1 + over * 0.45],
  ]
  const totalW = cobPool.reduce((n, [, w]) => n + w, 0)
  let guardC = 300
  while (b > (THREAT.cob ?? 320) && guardC-- > 0) {
    let pick = rand() * totalW
    let type: KernelTypeId = 'cob'
    for (const [t, w] of cobPool) { if ((pick -= w) <= 0) { type = t; break } }
    const cost = THREAT[type] ?? 320
    if (cost > b) type = 'cob' // can't afford the big one; a cob always fits
    groups.push(g(type, 1, 90, delay))
    b -= THREAT[type] ?? 320
    delay += 40
  }
  // an occasional Big Corn of Doom deep in Free Play
  if (over > 12 && rand() < 0.2) groups.push(g('bigcorn', 1, 0, delay + 200))
  if (groups.length === 0) groups.push(g('cob', 1, 0, 0)) // safety net
  return { groups, bonus: roundBonus(CAMPAIGN_ROUNDS) + over * 220 }
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
