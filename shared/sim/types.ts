// Kernel Panic — sim types. Everything the deterministic tick touches.

export const TPS = 30 // fixed timestep: ticks per second
export const DT = 1 / TPS

export const WORLD_W = 640
export const WORLD_H = 640 // near-square board fills phones far better than the old 420
export const TILE = 32

/** Ticks after a round clears during which starting early still pays a bonus. */
export const EARLY_WINDOW_TICKS = 12 * TPS
/** Max early-start bonus = this fraction of the round's clear bonus. */
export const EARLY_BONUS_FRAC = 0.5

export const START_LIVES = 100
export const START_BUTTER = 500 // the new roster needs a bigger opening defense

// The enemy sheet's speeds (design) are relative values on a 25–750 scale; this
// maps them onto the board so mobs are catchable. Tune this one number to make
// the whole game faster/slower without touching the roster.
export const SPEED_SCALE = 0.45

// Free Play (past round 100) compounds +2%/round: ALL mobs get faster, and the
// cob family (cob/bunch/ton) also gains HP. Within the 100-round campaign the
// procedural generator handles escalation, so scaling only kicks in AFTER it.
// round 101 = ×1.02, round 102 = ×1.0404, … (design by Michael's son).
export const DIFFICULTY_SCALE_START = 101
export const DIFFICULTY_SCALE_PER_ROUND = 0.02

// ── Content (data) ───────────────────────────────────────────────────────────

// The enemy roster v2 (design by Michael's son — docs/enemy-design-v2.md), a
// faithful Bloons-TD port in corn. Ratified 2026-07-07.
//   Basic chain:  hard → kernel → poppable → gone (each 1 HP)
//   Rush:         kettle, candy (fast, no split, high leak)
//   Immunity:     black(bomb) white(freeze) blackwhite(both) purple(laser+freeze)
//                 melted(laser) rainbow superhard(ceramic) shiney(laser)
//   Cob bosses:   cob→bunch→ton→bigcorn (MOAB class) + quickcob (fast)
//   Buttery:      bkernel, bpopcorn, bcob (leak 0, huge bounty)
export type KernelTypeId =
  | 'poppable'
  | 'kernel'
  | 'hard'
  | 'kettle'
  | 'candy'
  | 'black'
  | 'white'
  | 'blackwhite'
  | 'purple'
  | 'melted'
  | 'rainbow'
  | 'superhard'
  | 'shiney'
  | 'cob'
  | 'quickcob'
  | 'bunch'
  | 'ton'
  | 'bigcorn'
  | 'bkernel'
  | 'bpopcorn'
  | 'bcob'

export interface KernelType {
  id: KernelTypeId
  name: string
  hp: number
  speed: number // world units / second
  bounty: number // butter awarded on pop
  leak: number // lives lost if it reaches the bowl (the "D" on the sheet)
  radius: number
  color: string
  boss?: boolean // triggers the boss-incoming cue + heading rotation
  cobShape?: boolean // rendered as a cob (rotates to heading)
  resistLaser?: boolean // immune to the laser beam (Shiney/Melted/Purple)
  resistFreeze?: boolean // LATENT until the freeze tower ships (White/Zebra/Purple)
  resistBomb?: boolean // LATENT until the bomb tower ships (Black/Zebra)
  /** on pop, spawn these child groups (dist-staggered behind the pop point).
   * An array so a mob can spawn several TYPES (Zebra → 1 black + 1 white; Big
   * Corn of Doom → 2 Corn Ton + 3 Quick Cob). */
  children?: { type: KernelTypeId; count: number; spread: number }[]
}

export type TowerKind = 'dart' | 'pulse' | 'beam' | 'econ'
export type TargetPolicy = 'first' | 'last' | 'strong' | 'close'

// Crosspath upgrade trees (design by Michael's son): each attacking tower has
// three paths — damage / fire-rate / range — and you may invest in at most
// `maxPaths` of them (2). A tier sets the ABSOLUTE new value for its stat; range
// tiers give a multiplier on the base range. Butter Churn has one deep path.
export type PathKey = 'dmg' | 'rate' | 'range' | 'butter' | 'bank' | 'boost'

export interface TowerTier {
  name: string
  cost: number
  dph?: number // damage per hit
  sps?: number // shots per second
  rangeMul?: number // × base range
  income?: number // butter per round (econ)
  interest?: number // Butter Bank: fraction of held butter earned each round clear
  boostRadius?: number // Butter Boost: aura radius (world units)
  boostPerPop?: number // Butter Boost: extra butter per pop inside the aura
}

export interface TowerPath {
  key: PathKey
  label: string
  tiers: TowerTier[]
}

export interface TowerType {
  id: string
  name: string
  kind: TowerKind
  cost: number
  dph: number // base damage per hit
  sps: number // base shots per second (cooldown = 1/sps)
  pierce: number // mobs hit per shot (999 = "all in the line/ring")
  range: number // base range (world units)
  income?: number // econ base butter per round
  color: string
  projSpeed?: number // dart
  beamWidth?: number // beam
  blurb: string
  maxPaths: number // how many of the paths you may invest in
  paths: TowerPath[]
}

export interface SpawnGroup {
  type: KernelTypeId
  count: number
  gap: number // ticks between spawns in this group
  delay: number // ticks before this group begins (from round start)
}

export interface RoundDef {
  groups: SpawnGroup[]
  bonus: number // butter awarded on clearing this round
}

// ── Runtime entities ─────────────────────────────────────────────────────────

export interface Kernel {
  id: number
  type: KernelTypeId
  dist: number
  hp: number
}

export interface Tower {
  id: number
  type: string
  x: number
  y: number
  cx: number
  cy: number
  cd: number // current cooldown remaining (seconds)
  target: TargetPolicy
  pathLevels: number[] // tier bought per path (parallel to TowerType.paths)
}

export interface Projectile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  ttl: number // ticks
}

// No 'won' terminal: beating the campaign flows into endless. Only 'lost' ends a run.
export type Phase = 'build' | 'round' | 'lost'

export interface SimEvent {
  t: 'pop' | 'leak' | 'fire' | 'pulse' | 'beam' | 'roundClear' | 'bossIn' | 'lifeLoss' | 'campaignClear'
  x?: number
  y?: number
  tx?: number
  ty?: number
  r?: number
  kind?: string // tower kind or kernel type, for FX/sound selection
  boss?: boolean
}

export interface SimState {
  seed: number
  mapId: string // which map's path the kernels walk (part of the deterministic config)
  tick: number
  phase: Phase
  round: number // rounds cleared so far; the active/next round index
  buildStartTick: number // tick the current build phase began (for the early bonus)
  lives: number
  butter: number
  kernels: Kernel[]
  towers: Tower[]
  projectiles: Projectile[]
  nextId: number
  spawnQueue: { type: KernelTypeId; atTick: number }[]
  roundActive: boolean
  popped: number
  leaked: number
  bestRound: number // furthest round reached this run (the score)
  events: SimEvent[]
}

export type Command =
  | { t: 'place'; tower: string; cx: number; cy: number }
  | { t: 'upgrade'; id: number; path: number }
  | { t: 'sell'; id: number }
  | { t: 'target'; id: number; policy: TargetPolicy }
  | { t: 'startRound' }
