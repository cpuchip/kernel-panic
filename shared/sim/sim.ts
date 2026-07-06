// Kernel Panic — the deterministic simulation. One fixed-timestep tick over
// kernels, towers, and projectiles. Pure: no Date.now, no bare Math.random
// (RNG injected). state(t) = f(seed, commands up to t).

import { dist, pointSegDist } from '../vec.ts'
import type { Rng } from '../rng.ts'
import { KERNELS, PATH, ROUNDS, TOWERS, stat, towerIncome } from './content.ts'
import { distToPath, pointAt } from './path.ts'
import {
  DT,
  START_BUTTER,
  START_LIVES,
  TILE,
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

export function newGame(): SimState {
  return {
    tick: 0,
    phase: 'build',
    round: 0,
    lives: START_LIVES,
    butter: START_BUTTER,
    kernels: [],
    towers: [],
    projectiles: [],
    nextId: 1,
    spawnQueue: [],
    roundActive: false,
    popped: 0,
    leaked: 0,
    events: [],
  }
}

// ── Tile geometry ────────────────────────────────────────────────────────────

export function tileCenter(cx: number, cy: number): { x: number; y: number } {
  return { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 }
}

export function tileBuildable(s: SimState, cx: number, cy: number): boolean {
  const { x, y } = tileCenter(cx, cy)
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false
  if (distToPath(PATH, x, y) < BUILD_CLEARANCE) return false
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
      s.towers.push({ id: s.nextId++, type: def.id, x, y, cx: cmd.cx, cy: cmd.cy, cd: 0, target: 'first', level: 0 })
      return
    }
    case 'upgrade': {
      const t = s.towers.find((w) => w.id === cmd.id)
      if (!t) fail('no such tower')
      if (t.level >= 1) fail('already upgraded')
      const def = TOWERS[t.type]
      if (s.butter < def.upgrade.cost) fail('not enough butter')
      s.butter -= def.upgrade.cost
      t.level = 1
      return
    }
    case 'sell': {
      const i = s.towers.findIndex((w) => w.id === cmd.id)
      if (i < 0) fail('no such tower')
      const t = s.towers[i]
      const def = TOWERS[t.type]
      const spent = def.cost + (t.level >= 1 ? def.upgrade.cost : 0)
      s.butter += Math.floor(spent * 0.7) // 70% refund
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
      startRound(s)
      return
    }
  }
}

function startRound(s: SimState): void {
  const def = ROUNDS[s.round]
  if (!def) fail('no such round')
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
  if (s.phase !== 'round') return
  s.tick++

  spawn(s)
  advanceKernels(s)
  fireTowers(s, rng)
  moveProjectiles(s)
  resolveDeaths(s)
  checkRoundEnd(s)
}

function spawn(s: SimState): void {
  // spawnQueue is sorted by atTick; pull everything due this tick.
  while (s.spawnQueue.length && s.spawnQueue[0].atTick <= s.tick) {
    const item = s.spawnQueue.shift()!
    s.kernels.push({ id: s.nextId++, type: item.type, dist: 0, hp: KERNELS[item.type].hp })
  }
}

function advanceKernels(s: SimState): void {
  const survivors: Kernel[] = []
  for (const k of s.kernels) {
    const kt = KERNELS[k.type]
    k.dist += kt.speed * DT
    if (k.dist >= PATH.total) {
      // leaked into the bowl
      s.lives -= kt.leak
      s.leaked++
      const p = pointAt(PATH, PATH.total)
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

function kernelPos(k: Kernel): { x: number; y: number } {
  return pointAt(PATH, k.dist)
}

function pickTarget(s: SimState, t: Tower, range: number): Kernel | null {
  let best: Kernel | null = null
  let bestScore = -Infinity
  for (const k of s.kernels) {
    const p = kernelPos(k)
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
  for (const t of s.towers) {
    const def = TOWERS[t.type]
    if (def.kind === 'econ') continue
    if (t.cd > 0) {
      t.cd -= DT
      continue
    }
    const range = stat(def, t.level, 'range') as number
    const dmg = stat(def, t.level, 'damage') as number
    const cooldown = stat(def, t.level, 'cooldown') as number

    if (def.kind === 'pulse') {
      // AoE ring: fire only when a kernel is in range, then damage all in range.
      const inRange = s.kernels.filter((k) => {
        const p = kernelPos(k)
        return dist(t.x, t.y, p.x, p.y) <= range
      })
      if (inRange.length === 0) continue // hold the pulse ready
      for (const k of inRange) k.hp -= dmg
      t.cd = cooldown
      s.events.push({ t: 'pulse', x: t.x, y: t.y, r: range, kind: 'microwave' })
      continue
    }

    const target = pickTarget(s, t, range)
    if (!target) continue
    const tp = kernelPos(target)

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
      const width = (stat(def, t.level, 'beamWidth') as number) ?? 12
      const dx = tp.x - t.x
      const dy = tp.y - t.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const ex = t.x + (dx / len) * range
      const ey = t.y + (dy / len) * range
      for (const k of s.kernels) {
        const p = kernelPos(k)
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
  const alive: typeof s.projectiles = []
  for (const pr of s.projectiles) {
    pr.x += pr.vx * DT
    pr.y += pr.vy * DT
    pr.ttl--
    let consumed = false
    for (const k of s.kernels) {
      if (k.hp <= 0) continue
      const p = kernelPos(k)
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
  const survivors: Kernel[] = []
  const children: Kernel[] = []
  for (const k of s.kernels) {
    if (k.hp > 0) {
      survivors.push(k)
      continue
    }
    const kt = KERNELS[k.type]
    s.butter += kt.bounty
    s.popped++
    const p = kernelPos(k)
    s.events.push({ t: 'pop', x: p.x, y: p.y, kind: k.type, boss: kt.boss })
    if (kt.children) {
      for (let i = 0; i < kt.children.count; i++) {
        const cd = Math.max(0, k.dist - i * kt.children.spread)
        children.push({ id: s.nextId++, type: kt.children.type, dist: cd, hp: KERNELS[kt.children.type].hp })
      }
    }
  }
  // children join next tick (spawned after this tick's advance/fire)
  s.kernels = survivors.concat(children)
}

function checkRoundEnd(s: SimState): void {
  if (!s.roundActive) return
  if (s.spawnQueue.length === 0 && s.kernels.length === 0) {
    const def = ROUNDS[s.round]
    // round-clear bonus + churn income
    let income = def.bonus
    for (const t of s.towers) income += towerIncome(TOWERS[t.type], t.level)
    s.butter += income
    s.projectiles = []
    s.roundActive = false
    s.round++
    s.events.push({ t: 'roundClear' })
    if (s.round >= ROUNDS.length) {
      s.phase = 'won'
    } else {
      s.phase = 'build'
    }
  }
}

// ── Convenience for the client / oracle ──────────────────────────────────────

export function kernelWorld(k: Kernel): { x: number; y: number } {
  return kernelPos(k)
}

export function targetPolicies(): TargetPolicy[] {
  return ['first', 'last', 'strong', 'close']
}
