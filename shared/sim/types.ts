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
export const START_BUTTER = 320

// ── Content (data) ───────────────────────────────────────────────────────────

export type KernelTypeId = 'plain' | 'buttered' | 'caramel' | 'cob'

export interface KernelType {
  id: KernelTypeId
  name: string
  hp: number
  speed: number // world units / second
  bounty: number // butter awarded on pop
  leak: number // lives lost if it reaches the bowl
  radius: number
  color: string
  boss?: boolean
  /** on pop, spawn these (dist-staggered behind the pop point) */
  children?: { type: KernelTypeId; count: number; spread: number }
}

export type TowerKind = 'dart' | 'pulse' | 'beam' | 'econ'
export type TargetPolicy = 'first' | 'last' | 'strong' | 'close'

export interface TowerType {
  id: string
  name: string
  kind: TowerKind
  cost: number
  range: number
  cooldown: number // seconds between shots
  damage: number
  color: string
  projSpeed?: number // dart
  beamWidth?: number // beam
  income?: number // econ: butter per round clear
  blurb: string
  upgrade: {
    name: string
    cost: number
    patch: Partial<Pick<TowerType, 'range' | 'cooldown' | 'damage' | 'income' | 'beamWidth'>>
  }
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
  level: number // 0 base, 1 upgraded
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
  | { t: 'upgrade'; id: number }
  | { t: 'sell'; id: number }
  | { t: 'target'; id: number; policy: TargetPolicy }
  | { t: 'startRound' }
