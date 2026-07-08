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

// Tower kinds: dart/pulse/beam damage; econ (churn, no per-tick action);
// freeze (stops kernels); butter (slows + can poison); popcorn (eats kernels
// off the track and banks them into lives). Freeze/butter/popcorn are the son's
// "Tower Update part 2" sheet.
export type TowerKind = 'dart' | 'pulse' | 'beam' | 'econ' | 'freeze' | 'butter' | 'popcorn'
export type TargetPolicy = 'first' | 'last' | 'strong' | 'close'

// Crosspath upgrade trees (design by Michael's son): each attacking tower has
// three paths — damage / fire-rate / range — and you may invest in at most
// `maxPaths` of them (2). A tier sets the ABSOLUTE new value for its stat; range
// tiers give a multiplier on the base range. Butter Churn has one deep path.
export type PathKey =
  | 'dmg' | 'rate' | 'range' | 'butter' | 'bank' | 'popcorn'
  | 'freezeStr' | 'slowTime' | 'poison' | 'store' | 'eff'

export interface TowerTier {
  name: string
  cost: number
  dph?: number // damage per hit
  sps?: number // shots per second
  rangeMul?: number // × base range
  income?: number // butter per round (econ)
  interest?: number // Butter Bank: fraction of held butter earned each round clear
  pierce?: number // mobs hit per shot (Butter Turret's Sharp/Poison path)
  freezeSec?: number // Freeze Ray: seconds a hit kernel is frozen (Ft)
  slowSec?: number // Butter Turret: seconds a hit kernel is slowed (Bt)
  poisonDps?: number // Butter Turret's Poison tier: damage/sec while buttered
  mega?: boolean // Freeze Ray's Mega tier: can freeze cobs (all but RTF and BCD)
  affectsCobs?: boolean // Butter/Popcorn top tier: works on cobs too (never BCD)
  capacity?: number // Popcorn Machine: kernels eaten per activation (KS)
  kernelsPerPopcorn?: number // Popcorn Machine: kernels banked per popcorn (→ life)
  popcornYield?: number // Popcorn Machine: lives granted per conversion
  livesPerRound?: number // Butter Churn's Popcorn path: lives gained each round clear
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
  freezeSec?: number // Freeze Ray base freeze duration (Ft)
  slowSec?: number // Butter Turret base slow duration (Bt)
  capacity?: number // Popcorn Machine base kernels-eaten per activation (KS)
  kernelsPerPopcorn?: number // Popcorn Machine base kernels per popcorn (100)
  popcornYield?: number // Popcorn Machine base lives per conversion (1)
  color: string
  projSpeed?: number // dart
  beamWidth?: number // beam
  blurb: string
  maxPaths: number // how many of the paths you may invest in
  paths: TowerPath[]
}

// Butter Bomb — a consumable placed ON the track; detonates on the first kernel
// to reach it, dealing AoE damage, then it's gone (1 use). Five sizes you buy
// à la carte (the son's sheet). Black/Zebra kernels (resistBomb) shrug it off.
export interface BombType {
  name: string
  cost: number
  dmg: number
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
  freeze?: number // ticks of freeze remaining (no movement while > 0)
  slow?: number // ticks of butter-slow remaining (speed ×0.5 while > 0)
  poison?: number // ticks of poison remaining (takes poisonDps/tick while > 0)
  poisonDps?: number // damage per second applied while poisoned
}

/** A placed Butter Bomb sitting on the track (world position = pointAt(dist)). */
export interface Bomb {
  id: number
  dist: number // arc-distance along the path where it sits
  dmg: number
  radius: number // AoE radius (world units)
  size: number // index into content BOMBS (for render scale)
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
  t: 'pop' | 'leak' | 'fire' | 'pulse' | 'beam' | 'freeze' | 'butter' | 'bomb' | 'suck' | 'roundClear' | 'bossIn' | 'lifeLoss' | 'campaignClear'
  x?: number
  y?: number
  tx?: number
  ty?: number
  r?: number
  kind?: string // tower kind or kernel type, for FX/sound selection
  boss?: boolean
}

/** One player's butter pot. Lives are shared (co-op); butter is per-player: you
 * spend your own, earnings split evenly across pots, and you can send/request. */
export interface PlayerState {
  butter: number
}

export interface SimState {
  seed: number
  mapId: string // which map's path the kernels walk (part of the deterministic config)
  tick: number
  phase: Phase
  round: number // rounds cleared so far; the active/next round index
  buildStartTick: number // tick the current build phase began (for the early bonus)
  lives: number // SHARED across all players (win/lose together)
  players: PlayerState[] // one butter pot each; players[0] is the solo player in SP
  splitPtr: number // rotating index so the remainder of an even split is shared fairly
  kernels: Kernel[]
  towers: Tower[]
  projectiles: Projectile[]
  bombs: Bomb[] // placed Butter Bombs waiting on the track
  kernelsEaten: number // running bank in the Popcorn Machine (→ lives at threshold)
  nextId: number
  spawnQueue: { type: KernelTypeId; atTick: number }[]
  roundActive: boolean
  popped: number
  leaked: number
  bestRound: number // furthest round reached this run (the score)
  events: SimEvent[]
}

// `player` is the pot a spend/refund/earning hits (default 0 = the solo player).
// In MP the server stamps it from the sender's seat, never trusting the client.
export type Command =
  | { t: 'place'; tower: string; cx: number; cy: number; player?: number }
  | { t: 'placeBomb'; size: number; dist: number; player?: number } // drop a Butter Bomb on the track
  | { t: 'upgrade'; id: number; path: number; player?: number }
  | { t: 'sell'; id: number; player?: number }
  | { t: 'sendButter'; to: number; amount: number; player?: number } // gift butter to a teammate
  | { t: 'target'; id: number; policy: TargetPolicy }
  | { t: 'startRound'; player?: number }
