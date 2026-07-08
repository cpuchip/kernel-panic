// Kernel Panic — the deterministic simulation. One fixed-timestep tick over
// kernels, towers, and projectiles. Pure: no Date.now, no bare Math.random
// (RNG injected). state(t) = f(seed, commands up to t).

import { dist, pointSegDist } from '../vec.ts'
import type { Rng } from '../rng.ts'
import { BOMBS, BOMB_RADIUS, COB_UNITS, CAMPAIGN_ROUNDS, KERNELS, TOWERS, activePaths, effRange, effStat, getRound, tierValue, towerFlag, towerIncome, towerSpent } from './content.ts'
import { DEFAULT_MAP, MAPS } from './maps.ts'
import { distToPath, pointAt, type Path } from './path.ts'
import {
  DIFFICULTY_SCALE_PER_ROUND,
  DIFFICULTY_SCALE_START,
  DT,
  EARLY_BONUS_FRAC,
  EARLY_WINDOW_TICKS,
  SPEED_SCALE,
  START_BUTTER,
  START_LIVES,
  TILE,
  TPS,
  WORLD_H,
  WORLD_W,
  type Command,
  type Kernel,
  type KernelTypeId,
  type SimState,
  type TargetPolicy,
  type Tower,
} from './types.ts'

export class RuleError extends Error {}
function fail(msg: string): never {
  throw new RuleError(msg)
}

const BUILD_CLEARANCE = 22 // world units a tower must sit off the path
const HIT_RADIUS = 6 // dart collision padding beyond kernel radius
const MAX_INTEREST_RATE = 0.5 // Butter Bank: cap total interest so it can't run away

/** The path the kernels walk this game (chosen at newGame, part of the config). */
function pathOf(s: SimState): Path {
  return (MAPS[s.mapId] ?? MAPS[DEFAULT_MAP]).path
}

// ── Endless difficulty scaling (round 20+, compounding +2%/round) ────────────
const cobFamily = (type: KernelTypeId): boolean => type === 'cob' || type === 'bunch' || type === 'ton'

/** Speed multiplier for a wave — ALL mobs get faster from round 20 on. */
export function roundSpeedMul(round1: number): number {
  if (round1 < DIFFICULTY_SCALE_START) return 1
  return Math.pow(1 + DIFFICULTY_SCALE_PER_ROUND, round1 - (DIFFICULTY_SCALE_START - 1))
}

/** HP multiplier — only the cob family (cob/bunch/ton) gains HP from round 20 on. */
export function roundHpMul(round1: number, type: KernelTypeId): number {
  if (!cobFamily(type) || round1 < DIFFICULTY_SCALE_START) return 1
  return Math.pow(1 + DIFFICULTY_SCALE_PER_ROUND, round1 - (DIFFICULTY_SCALE_START - 1))
}

/** The 1-based number of the wave currently in progress (or next to start). */
function activeRound(s: SimState): number {
  return s.round + 1
}

export function newGame(seed = 1, mapId: string = DEFAULT_MAP): SimState {
  return {
    seed,
    mapId: MAPS[mapId] ? mapId : DEFAULT_MAP,
    tick: 0,
    phase: 'build',
    round: 0,
    buildStartTick: 0,
    lives: START_LIVES,
    butter: START_BUTTER,
    kernels: [],
    towers: [],
    projectiles: [],
    bombs: [],
    kernelsEaten: 0,
    nextId: 1,
    spawnQueue: [],
    roundActive: false,
    popped: 0,
    leaked: 0,
    bestRound: 0,
    events: [],
  }
}

/** Butter you'd collect by starting the next round right now (decays over the
 * build window from a fraction of the round's clear bonus to 0). */
export function earlyBonus(s: SimState): number {
  if (s.phase !== 'build') return 0
  const def = getRound(s.round, s.seed)
  const maxBonus = Math.round(def.bonus * EARLY_BONUS_FRAC)
  const elapsed = s.tick - s.buildStartTick
  const frac = Math.max(0, 1 - elapsed / EARLY_WINDOW_TICKS)
  return Math.round(maxBonus * frac)
}

// ── Tile geometry ────────────────────────────────────────────────────────────

export function tileCenter(cx: number, cy: number): { x: number; y: number } {
  return { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 }
}

export function tileBuildable(s: SimState, cx: number, cy: number): boolean {
  const { x, y } = tileCenter(cx, cy)
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false
  if (distToPath(pathOf(s), x, y) < BUILD_CLEARANCE) return false
  return !s.towers.some((t) => t.cx === cx && t.cy === cy)
}

// ── Commands ─────────────────────────────────────────────────────────────────

export function apply(s: SimState, cmd: Command, _rng: Rng): void {
  switch (cmd.t) {
    case 'place': {
      const def = TOWERS[cmd.tower]
      if (!def) fail('unknown tower')
      if (!tileBuildable(s, cmd.cx, cmd.cy)) fail('tile not buildable')
      if (s.butter < def.cost) fail('not enough butter')
      s.butter -= def.cost
      const { x, y } = tileCenter(cmd.cx, cmd.cy)
      s.towers.push({ id: s.nextId++, type: def.id, x, y, cx: cmd.cx, cy: cmd.cy, cd: 0, target: 'first', pathLevels: def.paths.map(() => 0) })
      return
    }
    case 'placeBomb': {
      const b = BOMBS[cmd.size]
      if (!b) fail('unknown bomb')
      if (cmd.dist < 0 || cmd.dist > pathOf(s).total) fail('bomb must sit on the track')
      if (s.butter < b.cost) fail('not enough butter')
      s.butter -= b.cost
      s.bombs.push({ id: s.nextId++, dist: cmd.dist, dmg: b.dmg, radius: BOMB_RADIUS, size: cmd.size })
      return
    }
    case 'upgrade': {
      const t = s.towers.find((w) => w.id === cmd.id)
      if (!t) fail('no such tower')
      const def = TOWERS[t.type]
      const p = cmd.path
      if (p < 0 || p >= def.paths.length) fail('no such path')
      const lvl = t.pathLevels[p]
      if (lvl >= def.paths[p].tiers.length) fail('path fully upgraded')
      // crosspath gate: opening a NEW path can't exceed maxPaths
      if (lvl === 0 && activePaths(t.pathLevels) >= def.maxPaths) fail(`only ${def.maxPaths} upgrade paths per tower`)
      const cost = def.paths[p].tiers[lvl].cost
      if (s.butter < cost) fail('not enough butter')
      s.butter -= cost
      t.pathLevels[p]++
      return
    }
    case 'sell': {
      const i = s.towers.findIndex((w) => w.id === cmd.id)
      if (i < 0) fail('no such tower')
      const t = s.towers[i]
      s.butter += Math.floor(towerSpent(TOWERS[t.type], t.pathLevels) * 0.7) // 70% refund
      s.towers.splice(i, 1)
      return
    }
    case 'target': {
      const t = s.towers.find((w) => w.id === cmd.id)
      if (!t) fail('no such tower')
      t.target = cmd.policy
      return
    }
    case 'startRound': {
      if (s.phase !== 'build') fail('not in build phase')
      s.butter += earlyBonus(s) // reward starting early (0 once the window elapses)
      startRound(s)
      return
    }
  }
}

function startRound(s: SimState): void {
  const def = getRound(s.round, s.seed)
  const queue: { type: KernelTypeId; atTick: number }[] = []
  for (const grp of def.groups) {
    for (let i = 0; i < grp.count; i++) {
      queue.push({ type: grp.type, atTick: s.tick + grp.delay + i * grp.gap })
    }
  }
  queue.sort((a, b) => a.atTick - b.atTick)
  s.spawnQueue = queue
  s.roundActive = true
  s.phase = 'round'
  if (def.groups.some((grp) => KERNELS[grp.type].boss)) {
    s.events.push({ t: 'bossIn' })
  }
}

// ── The tick ─────────────────────────────────────────────────────────────────

export function tick(s: SimState, rng: Rng): void {
  s.events = []
  // Tick advances in every phase (build too) so the early-start bonus can decay.
  // The round simulation only runs while a wave is live.
  s.tick++
  if (s.phase !== 'round') return

  spawn(s)
  advanceKernels(s)
  detonateBombs(s)
  fireTowers(s, rng)
  moveProjectiles(s)
  resolveDeaths(s)
  checkRoundEnd(s)
}

// ── Status-effect rules (Freeze Ray / Butter Turret) ─────────────────────────
// Freeze: RTF kernels (resistFreeze) never freeze; cobs freeze only with a Mega
// Freeze, and the Big Corn of Doom never freezes at all. Butter (slow): cobs
// only stick with the Big Stick tier, and again never the Big Corn of Doom.
function canFreeze(type: KernelTypeId, mega: boolean): boolean {
  const kt = KERNELS[type]
  if (kt.resistFreeze) return false
  if (type === 'bigcorn') return false
  if (kt.cobShape && !mega) return false
  return true
}
function canSlow(type: KernelTypeId, affectsCobs: boolean): boolean {
  if (type === 'bigcorn') return false
  if (KERNELS[type].cobShape && !affectsCobs) return false
  return true
}

/** Spawn a mob, applying the round's HP scaling (cob family only, round 20+). */
function makeKernel(s: SimState, type: KernelTypeId, dist: number): Kernel {
  return { id: s.nextId++, type, dist, hp: KERNELS[type].hp * roundHpMul(activeRound(s), type) }
}

function spawn(s: SimState): void {
  // spawnQueue is sorted by atTick; pull everything due this tick.
  while (s.spawnQueue.length && s.spawnQueue[0].atTick <= s.tick) {
    const item = s.spawnQueue.shift()!
    s.kernels.push(makeKernel(s, item.type, 0))
  }
}

function advanceKernels(s: SimState): void {
  const survivors: Kernel[] = []
  const path = pathOf(s)
  const speedMul = SPEED_SCALE * roundSpeedMul(activeRound(s))
  for (const k of s.kernels) {
    const kt = KERNELS[k.type]
    // poison drip (Butter Turret's Poison tier) — ticks even while frozen
    if (k.poison && k.poison > 0) {
      k.hp -= (k.poisonDps ?? 0) * DT
      k.poison--
    }
    // frozen kernels hold still — they can still be shot, but they don't advance
    if (k.freeze && k.freeze > 0) {
      k.freeze--
      survivors.push(k)
      continue
    }
    let mul = speedMul
    if (k.slow && k.slow > 0) {
      mul *= 0.5 // buttered kernels crawl at half speed
      k.slow--
    }
    k.dist += kt.speed * mul * DT
    if (k.dist >= path.total) {
      // leaked into the bowl
      s.lives -= kt.leak
      s.leaked++
      const p = pointAt(path, path.total)
      s.events.push({ t: 'leak', x: p.x, y: p.y, kind: k.type, boss: kt.boss })
      s.events.push({ t: 'lifeLoss' })
      continue
    }
    survivors.push(k)
  }
  s.kernels = survivors
  if (s.lives <= 0) {
    s.lives = 0
    s.phase = 'lost'
  }
}

function kernelPos(path: Path, k: Kernel): { x: number; y: number } {
  return pointAt(path, k.dist)
}

/** Butter Bombs: a placed bomb goes off the moment any kernel reaches its point,
 * dealing AoE damage to every kernel nearby (Black/Zebra shrug it off), then it's
 * spent. Kills flow through the normal death/child cascade in resolveDeaths. */
function detonateBombs(s: SimState): void {
  if (s.bombs.length === 0) return
  const path = pathOf(s)
  const remaining: typeof s.bombs = []
  for (const bomb of s.bombs) {
    const triggered = s.kernels.some((k) => k.dist >= bomb.dist)
    if (!triggered) {
      remaining.push(bomb)
      continue
    }
    const bp = pointAt(path, bomb.dist)
    for (const k of s.kernels) {
      if (KERNELS[k.type].resistBomb) continue // Black/Zebra kernels are bomb-proof
      const p = kernelPos(path, k)
      if (dist(bp.x, bp.y, p.x, p.y) <= bomb.radius + KERNELS[k.type].radius) k.hp -= bomb.dmg
    }
    s.events.push({ t: 'bomb', x: bp.x, y: bp.y, r: bomb.radius })
    // consumed (1 use) — not pushed to remaining
  }
  s.bombs = remaining
}

function pickTarget(s: SimState, path: Path, t: Tower, range: number): Kernel | null {
  let best: Kernel | null = null
  let bestScore = -Infinity
  for (const k of s.kernels) {
    const p = kernelPos(path, k)
    if (dist(t.x, t.y, p.x, p.y) > range) continue
    let score: number
    switch (t.target) {
      case 'first': score = k.dist; break // closest to the bowl
      case 'last': score = -k.dist; break
      case 'strong': score = k.hp * 1000 + k.dist; break
      case 'close': score = -dist(t.x, t.y, p.x, p.y); break
    }
    if (score > bestScore) {
      bestScore = score
      best = k
    }
  }
  return best
}

function fireTowers(s: SimState, _rng: Rng): void {
  const path = pathOf(s)
  for (const t of s.towers) {
    const def = TOWERS[t.type]
    if (def.kind === 'econ') continue
    if (t.cd > 0) {
      t.cd -= DT
      continue
    }
    const range = effRange(def, t.pathLevels)
    const dmg = effStat(def, t.pathLevels, 'dph')
    const sps = effStat(def, t.pathLevels, 'sps')
    const cooldown = sps > 0 ? 1 / sps : 1

    if (def.kind === 'pulse') {
      // AoE ring: fire only when a kernel is in range, then damage all in range.
      const inRange = s.kernels.filter((k) => {
        const p = kernelPos(path, k)
        return dist(t.x, t.y, p.x, p.y) <= range
      })
      if (inRange.length === 0) continue // hold the pulse ready
      for (const k of inRange) k.hp -= dmg
      t.cd = cooldown
      s.events.push({ t: 'pulse', x: t.x, y: t.y, r: range, kind: 'microwave' })
      continue
    }

    if (def.kind === 'freeze') {
      // Freeze the frontmost freezable kernels in range (up to pierce). No damage.
      const isMega = towerFlag(def, t.pathLevels, 'mega')
      const ftTicks = Math.round(effStat(def, t.pathLevels, 'freezeSec') * TPS)
      const pierce = effStat(def, t.pathLevels, 'pierce')
      const cand = s.kernels
        .filter((k) => {
          const p = kernelPos(path, k)
          return dist(t.x, t.y, p.x, p.y) <= range && canFreeze(k.type, isMega)
        })
        .sort((a, b) => b.dist - a.dist)
      if (cand.length === 0) continue // hold the ray ready
      for (let i = 0; i < Math.min(pierce, cand.length); i++) cand[i].freeze = ftTicks
      t.cd = cooldown
      s.events.push({ t: 'freeze', x: t.x, y: t.y, r: range, kind: 'freeze' })
      continue
    }

    if (def.kind === 'butter') {
      // Butter the frontmost sluggable kernels in range (up to pierce): slow +
      // maybe a poison drip. No direct damage (the poison is the only damage).
      const affectsCobs = towerFlag(def, t.pathLevels, 'affectsCobs')
      const btTicks = Math.round(effStat(def, t.pathLevels, 'slowSec') * TPS)
      const pierce = effStat(def, t.pathLevels, 'pierce')
      const poisonDps = tierValue(def, t.pathLevels, 'poisonDps')
      const cand = s.kernels
        .filter((k) => {
          const p = kernelPos(path, k)
          return dist(t.x, t.y, p.x, p.y) <= range && canSlow(k.type, affectsCobs)
        })
        .sort((a, b) => b.dist - a.dist)
      if (cand.length === 0) continue
      for (let i = 0; i < Math.min(pierce, cand.length); i++) {
        cand[i].slow = btTicks
        if (poisonDps > 0) {
          cand[i].poison = btTicks
          cand[i].poisonDps = poisonDps
        }
      }
      t.cd = cooldown
      s.events.push({ t: 'butter', x: t.x, y: t.y, r: range, kind: 'butter' })
      continue
    }

    if (def.kind === 'popcorn') {
      // Suck kernels off the track (up to capacity), bank them, and bake full
      // batches into lives. Eaten kernels are gone — no bounty, no leak. The top
      // storage tier can also swallow a single cob (never the Big Corn of Doom).
      const capacity = effStat(def, t.pathLevels, 'capacity')
      const perPop = effStat(def, t.pathLevels, 'kernelsPerPopcorn')
      const yieldPer = effStat(def, t.pathLevels, 'popcornYield')
      const canCob = towerFlag(def, t.pathLevels, 'affectsCobs')
      const inR = s.kernels
        .filter((k) => {
          const p = kernelPos(path, k)
          return dist(t.x, t.y, p.x, p.y) <= range
        })
        .sort((a, b) => b.dist - a.dist)
      const eaten = new Set<number>()
      let cnt = 0
      for (const k of inR) {
        if (cnt >= capacity) break
        if (KERNELS[k.type].cobShape) continue // cobs handled below
        eaten.add(k.id)
        s.kernelsEaten += 1
        cnt++
      }
      if (canCob) {
        const cob = inR.find((k) => KERNELS[k.type].cobShape && k.type !== 'bigcorn' && !eaten.has(k.id))
        if (cob) {
          eaten.add(cob.id)
          s.kernelsEaten += COB_UNITS
        }
      }
      if (eaten.size === 0) continue // nothing in reach — stay ready
      s.kernels = s.kernels.filter((k) => !eaten.has(k.id))
      while (s.kernelsEaten >= perPop) {
        s.kernelsEaten -= perPop
        s.lives += yieldPer
      }
      t.cd = cooldown
      s.events.push({ t: 'suck', x: t.x, y: t.y, r: range, kind: 'popcorn' })
      continue
    }

    const target = pickTarget(s, path, t, range)
    if (!target) continue
    const tp = kernelPos(path, target)

    if (def.kind === 'dart') {
      const d = dist(t.x, t.y, tp.x, tp.y) || 1
      const speed = def.projSpeed ?? 300
      s.projectiles.push({
        id: s.nextId++,
        x: t.x,
        y: t.y,
        vx: ((tp.x - t.x) / d) * speed,
        vy: ((tp.y - t.y) / d) * speed,
        dmg,
        ttl: Math.ceil((range / speed) / DT) + 6,
      })
      t.cd = cooldown
      s.events.push({ t: 'fire', x: t.x, y: t.y, tx: tp.x, ty: tp.y, kind: 'fire' })
    } else if (def.kind === 'beam') {
      // Piercing line from tower through the target: hit all kernels near the ray.
      const width = def.beamWidth ?? 12
      const dx = tp.x - t.x
      const dy = tp.y - t.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const ex = t.x + (dx / len) * range
      const ey = t.y + (dy / len) * range
      for (const k of s.kernels) {
        if (KERNELS[k.type].resistLaser) continue // Shiney Kernel shrugs off the beam
        const p = kernelPos(path, k)
        if (pointSegDist(p.x, p.y, t.x, t.y, ex, ey) <= width + KERNELS[k.type].radius) {
          k.hp -= dmg
        }
      }
      t.cd = cooldown
      s.events.push({ t: 'beam', x: t.x, y: t.y, tx: ex, ty: ey, kind: 'laser' })
    }
  }
}

function moveProjectiles(s: SimState): void {
  const path = pathOf(s)
  const alive: typeof s.projectiles = []
  for (const pr of s.projectiles) {
    pr.x += pr.vx * DT
    pr.y += pr.vy * DT
    pr.ttl--
    let consumed = false
    for (const k of s.kernels) {
      if (k.hp <= 0) continue
      const p = kernelPos(path, k)
      if (dist(pr.x, pr.y, p.x, p.y) <= KERNELS[k.type].radius + HIT_RADIUS) {
        k.hp -= pr.dmg
        consumed = true // pierce 1
        break
      }
    }
    if (!consumed && pr.ttl > 0 && pr.x > -20 && pr.x < WORLD_W + 20 && pr.y > -20 && pr.y < WORLD_H + 20) {
      alive.push(pr)
    }
  }
  s.projectiles = alive
}

function resolveDeaths(s: SimState): void {
  const path = pathOf(s)
  const survivors: Kernel[] = []
  const children: Kernel[] = []
  for (const k of s.kernels) {
    if (k.hp > 0) {
      survivors.push(k)
      continue
    }
    const kt = KERNELS[k.type]
    const p = kernelPos(path, k)
    s.butter += kt.bounty
    s.popped++
    s.events.push({ t: 'pop', x: p.x, y: p.y, kind: k.type, boss: kt.boss })
    if (kt.children) {
      for (const grp of kt.children) {
        for (let i = 0; i < grp.count; i++) {
          const cd = Math.max(0, k.dist - i * grp.spread)
          children.push(makeKernel(s, grp.type, cd))
        }
      }
    }
  }
  // children join next tick (spawned after this tick's advance/fire)
  s.kernels = survivors.concat(children)
}

function checkRoundEnd(s: SimState): void {
  if (!s.roundActive) return
  if (s.spawnQueue.length === 0 && s.kernels.length === 0) {
    const def = getRound(s.round, s.seed)
    // Butter Bank interest is paid on the butter you're HOLDING as the round
    // clears (rewards saving up), before the round bonus + flat churn income.
    let bankRate = 0
    for (const t of s.towers) bankRate += tierValue(TOWERS[t.type], t.pathLevels, 'interest')
    const interest = Math.floor(s.butter * Math.min(bankRate, MAX_INTEREST_RATE))
    // round-clear bonus + flat churn income
    let income = def.bonus + interest
    for (const t of s.towers) income += towerIncome(TOWERS[t.type], t.pathLevels)
    s.butter += income
    // Butter Churn's Popcorn path pops out a few lives each round you clear.
    let livesGain = 0
    for (const t of s.towers) livesGain += tierValue(TOWERS[t.type], t.pathLevels, 'livesPerRound')
    if (livesGain > 0) s.lives += livesGain
    s.projectiles = []
    s.roundActive = false
    s.round++
    if (s.round > s.bestRound) s.bestRound = s.round
    s.events.push({ t: 'roundClear' })
    // Beating the scripted campaign is a milestone, not an ending — endless
    // continues. Only running out of lives ends a run.
    if (s.round === CAMPAIGN_ROUNDS) s.events.push({ t: 'campaignClear' })
    s.phase = 'build'
    s.buildStartTick = s.tick
  }
}

// ── Convenience for the client / oracle ──────────────────────────────────────

export function kernelWorld(s: SimState, k: Kernel): { x: number; y: number } {
  return kernelPos(pathOf(s), k)
}

/** Travel heading (radians) at a kernel's position — for facing sprites. */
export function kernelHeading(s: SimState, k: Kernel): number {
  const path = pathOf(s)
  const a = pointAt(path, k.dist)
  const b = pointAt(path, Math.min(path.total, k.dist + 4))
  return Math.atan2(b.y - a.y, b.x - a.x)
}

export function targetPolicies(): TargetPolicy[] {
  return ['first', 'last', 'strong', 'close']
}
