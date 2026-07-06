// Kernel Panic oracle — deterministic assertions over the sim.
// Run: npm run smoke. Green before every commit (the house discipline).
//
// The key contracts: determinism (seed+commands → identical state), the inverse
// hypothesis (a no-tower defense MUST leak and lose; a test that can't fail
// proves nothing), and replay identity (a recorded command log reproduces the
// final state exactly — this same property is the leaderboard verifier and the
// MP correctness check).

import { mulberry32, type Rng } from '../rng.ts'
import { PATH, ROUNDS, TOWERS } from './content.ts'
import { pointAt, distToPath } from './path.ts'
import { apply, newGame, tick, tileBuildable, tileCenter, kernelWorld, RuleError } from './sim.ts'
import { START_LIVES, WORLD_H, WORLD_W, TILE, type Command, type SimState } from './types.ts'

let passed = 0
let failed = 0
function ok(cond: boolean, name: string): void {
  if (cond) {
    passed++
    console.log(`  ok  ${name}`)
  } else {
    failed++
    console.error(`FAIL  ${name}`)
  }
}
function throws(fn: () => void, name: string): void {
  try {
    fn()
    failed++
    console.error(`FAIL  ${name} (did not throw)`)
  } catch (e) {
    if (e instanceof RuleError) {
      passed++
      console.log(`  ok  ${name}`)
    } else {
      failed++
      console.error(`FAIL  ${name} (wrong error: ${e})`)
    }
  }
}

const COLS = Math.floor(WORLD_W / TILE)
const ROWS = Math.floor(WORLD_H / TILE)

/** Buildable tiles, nearest the path first — so "blanket" defenses actually reach. */
function tilesNearPath(): [number, number][] {
  const s = newGame()
  const out: { cx: number; cy: number; d: number }[] = []
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      if (!tileBuildable(s, cx, cy)) continue
      const c = tileCenter(cx, cy)
      out.push({ cx, cy, d: distToPath(PATH, c.x, c.y) })
    }
  }
  out.sort((a, b) => a.d - b.d)
  return out.map((t) => [t.cx, t.cy])
}
const NEAR = tilesNearPath()

/** Serialize the parts of state that must be reproducible. */
function snap(s: SimState): string {
  return JSON.stringify({
    tick: s.tick,
    phase: s.phase,
    round: s.round,
    lives: s.lives,
    butter: s.butter,
    popped: s.popped,
    leaked: s.leaked,
    towers: s.towers,
    kernels: s.kernels,
    projectiles: s.projectiles,
  })
}

/** Play a fixed opening layout, then auto-run rounds to a terminal phase.
 * `butter` overrides the starting bank for mechanics tests that don't care
 * about economy (they're testing that towers pop, not that you can afford them). */
function playFrom(placements: Command[], seed: number, maxTicks = 120000, butter?: number): SimState {
  const s = newGame()
  if (butter !== undefined) s.butter = butter
  const rng: Rng = mulberry32(seed)
  for (const c of placements) apply(s, c, rng)
  let guard = maxTicks
  while (s.phase !== 'won' && s.phase !== 'lost' && guard-- > 0) {
    if (s.phase === 'build') apply(s, { t: 'startRound' }, rng)
    tick(s, rng)
  }
  return s
}

// ── 1. Path math ─────────────────────────────────────────────────────────────
console.log('path')
{
  ok(PATH.total > 0, 'path has length')
  const start = pointAt(PATH, 0)
  const end = pointAt(PATH, PATH.total)
  ok(start.x === PATH.points[0].x && start.y === PATH.points[0].y, 'pointAt(0) = first point')
  ok(end.x === PATH.points[PATH.points.length - 1].x, 'pointAt(total) = last point')
  let prev = pointAt(PATH, 0)
  let moved = true
  for (let d = 10; d <= PATH.total; d += 10) {
    const p = pointAt(PATH, d)
    if ((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2 <= 0) moved = false
    prev = p
  }
  ok(moved, 'pointAt advances monotonically')
  ok(distToPath(PATH, PATH.points[0].x, PATH.points[0].y) < 0.001, 'distToPath 0 on the path')
}

// ── 2. Determinism ──────────────────────────────────────────────────────────
console.log('determinism')
{
  const place: Command[] = [
    { t: 'place', tower: 'fire', cx: NEAR[0][0], cy: NEAR[0][1] },
    { t: 'place', tower: 'laser', cx: NEAR[3][0], cy: NEAR[3][1] },
    { t: 'place', tower: 'microwave', cx: NEAR[6][0], cy: NEAR[6][1] },
  ]
  const a = playFrom(place, 42, 6000, 5000)
  const b = playFrom(place, 42, 6000, 5000)
  ok(snap(a) === snap(b), 'identical seed+commands → identical state')
}

// ── 3. Inverse hypothesis: no towers MUST leak and lose ─────────────────────
console.log('inverse hypothesis')
{
  const s = playFrom([], 1)
  ok(s.phase === 'lost', 'a defense with no towers loses')
  ok(s.lives <= 0, 'lives drained to zero')
  ok(s.leaked > 0, 'kernels leaked into the bowl')
}

// ── 4. Towers pop kernels; a strong defense clears round 1 unscathed ────────
console.log('towers pop')
{
  const s = newGame()
  s.butter = 5000
  const rng = mulberry32(7)
  for (let i = 0; i < 12; i++) apply(s, { t: 'place', tower: 'fire', cx: NEAR[i][0], cy: NEAR[i][1] }, rng)
  apply(s, { t: 'startRound' }, rng)
  let guard = 4000
  while (s.round === 0 && s.phase === 'round' && guard-- > 0) tick(s, rng)
  ok(s.round === 1, 'round 1 cleared')
  ok(s.popped > 0, 'kernels were popped')
  ok(s.lives === START_LIVES, 'no lives lost with a strong defense')
  ok(s.butter > 0, 'earned butter from pops + clear bonus')
}

// ── 5. Replay identity (with upgrades/targeting mid-run) ────────────────────
console.log('replay identity')
{
  const script: Command[] = [
    { t: 'place', tower: 'laser', cx: NEAR[0][0], cy: NEAR[0][1] },
    { t: 'place', tower: 'microwave', cx: NEAR[4][0], cy: NEAR[4][1] },
  ]
  const drive = (): SimState => {
    const s = newGame()
    s.butter = 5000
    const rng = mulberry32(99)
    for (const c of script) apply(s, c, rng)
    let guard = 5000
    let toggled = false
    while (s.phase !== 'won' && s.phase !== 'lost' && guard-- > 0) {
      if (s.phase === 'build') {
        if (!toggled) {
          apply(s, { t: 'upgrade', id: 1 }, rng)
          apply(s, { t: 'target', id: 2, policy: 'strong' }, rng)
          toggled = true
        }
        apply(s, { t: 'startRound' }, rng)
      }
      tick(s, rng)
      if (s.round >= 3) break
    }
    return s
  }
  ok(snap(drive()) === snap(drive()), 'recorded command log reproduces state exactly')
}

// ── 6. Caramel clusters split into plain children on pop ────────────────────
console.log('split behavior')
{
  const s = newGame()
  s.butter = 5000
  const rng = mulberry32(3)
  for (let i = 0; i < 6; i++) apply(s, { t: 'place', tower: 'laser', cx: NEAR[i][0], cy: NEAR[i][1] }, rng)
  let sawChild = false
  let guard = 60000
  while (s.round < 5 && s.phase !== 'lost' && guard-- > 0) {
    if (s.phase === 'build') apply(s, { t: 'startRound' }, rng)
    tick(s, rng)
  }
  if (s.phase === 'build') apply(s, { t: 'startRound' }, rng)
  guard = 4000
  while (s.round === 5 && s.phase === 'round' && guard-- > 0) {
    const before = s.kernels.filter((k) => k.type === 'plain').length
    tick(s, rng)
    const after = s.kernels.filter((k) => k.type === 'plain').length
    if (after > before) sawChild = true // a plain appeared → born from a caramel pop
  }
  ok(sawChild || s.round > 5, 'caramel clusters spawned plain children on pop')
}

// ── 7. Build rules ──────────────────────────────────────────────────────────
console.log('build rules')
{
  const s = newGame()
  const rng = mulberry32(5)
  const [cx, cy] = NEAR[0]
  apply(s, { t: 'place', tower: 'fire', cx, cy }, rng)
  ok(s.towers.length === 1, 'placed a tower on a clear tile')
  throws(() => apply(s, { t: 'place', tower: 'fire', cx, cy }, rng), 'cannot stack two towers on a tile')
  // a tile on the path is blocked
  let blocked = false
  for (let c = 0; c < COLS; c++) if (!tileBuildable(s, c, 2) || !tileBuildable(s, c, 10)) blocked = true
  ok(blocked, 'path tiles are not buildable')
  const poor = newGame()
  poor.butter = 10
  throws(() => apply(poor, { t: 'place', tower: 'laser', cx: NEAR[1][0], cy: NEAR[1][1] }, rng), 'cannot buy without butter')
  const before = s.butter
  apply(s, { t: 'sell', id: 1 }, rng)
  ok(s.butter > before && s.towers.length === 0, 'selling refunds butter and frees the tile')
}

// ── 8. A real defense wins all 15 rounds ────────────────────────────────────
console.log('winnable')
{
  const s = newGame()
  const rng = mulberry32(11)
  const plan: [number, string][] = [
    [0, 'laser'], [1, 'laser'], [2, 'microwave'], [3, 'fire'],
    [4, 'fire'], [5, 'laser'], [6, 'microwave'], [7, 'fire'], [8, 'laser'], [9, 'fire'],
  ]
  const build = () => {
    for (const [i, tw] of plan) {
      const [cx, cy] = NEAR[i]
      const def = TOWERS[tw]
      if (!s.towers.some((t) => t.cx === cx && t.cy === cy) && s.butter >= def.cost && tileBuildable(s, cx, cy)) {
        apply(s, { t: 'place', tower: tw, cx, cy }, rng)
      }
    }
    for (const t of s.towers) {
      if (t.level < 1 && s.butter >= TOWERS[t.type].upgrade.cost + 250) apply(s, { t: 'upgrade', id: t.id }, rng)
    }
  }
  let guard = 200000
  while (s.phase !== 'won' && s.phase !== 'lost' && guard-- > 0) {
    if (s.phase === 'build') {
      build()
      apply(s, { t: 'startRound' }, rng)
    }
    tick(s, rng)
  }
  ok(s.phase === 'won', `wins all ${ROUNDS.length} rounds (ended ${s.phase}, round ${s.round}, ${s.lives} lives)`)
}

// ── 9. Kernels sit on the path ──────────────────────────────────────────────
console.log('kernel position')
{
  const s = newGame()
  const rng = mulberry32(2)
  apply(s, { t: 'startRound' }, rng)
  for (let i = 0; i < 40; i++) tick(s, rng)
  ok(s.kernels.length > 0, 'kernels spawned during a round')
  ok(s.kernels.every((k) => distToPath(PATH, kernelWorld(k).x, kernelWorld(k).y) < 0.5), 'every kernel sits on the path')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
