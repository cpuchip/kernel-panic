// Kernel Panic oracle — deterministic assertions over the sim.
// Run: npm run smoke. Green before every commit (the house discipline).
//
// The key contracts: determinism (seed+commands → identical state), the inverse
// hypothesis (a no-tower defense MUST leak and lose; a test that can't fail
// proves nothing), and replay identity (a recorded command log reproduces the
// final state exactly — this same property is the leaderboard verifier and the
// MP correctness check).

import { mulberry32, type Rng } from '../rng.ts'
import { KERNELS, PATH, ROUNDS, TOWERS, effRange, effStat, getRound } from './content.ts'
import { pointAt, distToPath } from './path.ts'
import { apply, earlyBonus, newGame, roundHpMul, roundSpeedMul, tick, tileBuildable, tileCenter, kernelWorld, RuleError } from './sim.ts'
import { EARLY_WINDOW_TICKS, START_LIVES, WORLD_H, WORLD_W, TILE, type Command, type SimState } from './types.ts'

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

/** Play a fixed opening layout, then auto-run rounds. Stops when lost or after
 * `stopAfterRound` rounds clear (endless never "wins", so tests set a cap).
 * `butter` overrides the starting bank for mechanics tests that don't care
 * about economy (they're testing that towers pop, not that you can afford them). */
function playFrom(placements: Command[], seed: number, maxTicks = 120000, butter?: number, stopAfterRound = Infinity): SimState {
  const s = newGame()
  if (butter !== undefined) s.butter = butter
  const rng: Rng = mulberry32(seed)
  for (const c of placements) apply(s, c, rng)
  let guard = maxTicks
  while (s.phase !== 'lost' && s.round < stopAfterRound && guard-- > 0) {
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
    while (s.phase !== 'lost' && guard-- > 0) {
      if (s.phase === 'build') {
        if (!toggled) {
          apply(s, { t: 'upgrade', id: 1, path: 0 }, rng)
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
    const before = s.kernels.filter((k) => k.type === 'kernel').length
    tick(s, rng)
    const after = s.kernels.filter((k) => k.type === 'kernel').length
    if (after > before) sawChild = true // a corn kernel appeared → born from a hard-kernel pop
  }
  ok(sawChild || s.round > 5, 'the pop-chain spawns children (hard → corn kernel)')
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

// ── 8. A real defense clears the campaign, then endless keeps going ──────────
console.log('winnable + endless')
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
    // upgrade: pour into up to 2 paths (damage then fire-rate) when affordable
    for (const t of s.towers) {
      const def = TOWERS[t.type]
      for (let p = 0; p < Math.min(def.maxPaths, def.paths.length); p++) {
        const lvl = t.pathLevels[p]
        if (lvl < def.paths[p].tiers.length && s.butter >= def.paths[p].tiers[lvl].cost + 400) {
          apply(s, { t: 'upgrade', id: t.id, path: p }, rng)
        }
      }
    }
  }
  let sawCampaignClear = false
  let guard = 300000
  while (s.phase !== 'lost' && s.round < 18 && guard-- > 0) {
    if (s.phase === 'build') {
      build()
      apply(s, { t: 'startRound' }, rng)
    }
    tick(s, rng)
    if (s.events.some((e) => e.t === 'campaignClear')) sawCampaignClear = true
  }
  ok(s.round >= ROUNDS.length, `clears the ${ROUNDS.length}-round campaign (reached ${s.round}, ${s.lives} lives)`)
  ok(sawCampaignClear, 'campaignClear fired once past the final scripted round')
  ok(s.phase !== 'lost', 'no "won" terminal — endless continues past the campaign')
  ok(s.round >= 16, 'played generated endless rounds beyond the script')
  ok(s.bestRound === s.round, 'bestRound tracks the furthest round reached')
}

// ── 8b. Endless generator is deterministic + escalates ──────────────────────
console.log('endless generator')
{
  const a = getRound(20, 1234)
  const b = getRound(20, 1234)
  ok(JSON.stringify(a) === JSON.stringify(b), 'getRound is deterministic for a seed+index')
  const early = getRound(15, 1)
  const later = getRound(25, 1)
  const count = (r: typeof early) => r.groups.reduce((n, g) => n + g.count, 0)
  ok(count(later) > count(early), 'later endless rounds spawn more than earlier ones')
}

// ── 8c. Early-start bonus decays and is awarded ─────────────────────────────
console.log('early-start bonus')
{
  const s = newGame()
  const atStart = earlyBonus(s) // build phase, tick 0
  ok(atStart > 0, 'early bonus available at the start of a build phase')
  // let the window fully elapse
  for (let i = 0; i < EARLY_WINDOW_TICKS + 5; i++) tick(s, mulberry32(1))
  ok(earlyBonus(s) === 0, 'early bonus decays to zero after the window')
  // fresh game: starting immediately grabs the bonus
  const s2 = newGame()
  const rng = mulberry32(1)
  const bonus = earlyBonus(s2)
  const before = s2.butter
  apply(s2, { t: 'startRound' }, rng)
  ok(s2.butter === before + bonus, 'starting a round awards the current early bonus')
}

// ── 8d. Balance floor: a lazy minimal defense must NOT coast the campaign ───
console.log('balance floor')
{
  // two fire tossers, no further building — the early game should have teeth.
  const s = newGame()
  const rng = mulberry32(5)
  apply(s, { t: 'place', tower: 'fire', cx: NEAR[0][0], cy: NEAR[0][1] }, rng)
  apply(s, { t: 'place', tower: 'fire', cx: NEAR[1][0], cy: NEAR[1][1] }, rng)
  let guard = 100000
  while (s.phase !== 'lost' && s.round < 15 && guard-- > 0) {
    if (s.phase === 'build') apply(s, { t: 'startRound' }, rng)
    tick(s, rng)
  }
  ok(s.phase === 'lost' || s.lives < START_LIVES, `a 2-tower defense can't coast (ended ${s.phase}, round ${s.round}, ${s.lives} lives)`)
}

// ── 8e. Laser resistance: a Shiney Kernel bounces the beam, a Corn Cob doesn't ─
console.log('laser resistance')
{
  function laserHits(kernelType: 'shiney' | 'cob'): { before: number; after: number } {
    const s = newGame()
    s.butter = 5000
    const rng = mulberry32(1)
    apply(s, { t: 'place', tower: 'laser', cx: NEAR[0][0], cy: NEAR[0][1] }, rng)
    const tw = s.towers[0]
    // inject one kernel on the path within the laser's range
    let injectDist = 0
    for (let d = 0; d < PATH.total; d += 4) {
      const p = pointAt(PATH, d)
      if (Math.hypot(p.x - tw.x, p.y - tw.y) < 180) {
        injectDist = d
        break
      }
    }
    s.phase = 'round'
    s.roundActive = true
    s.kernels.push({ id: s.nextId++, type: kernelType, dist: injectDist, hp: KERNELS[kernelType].hp })
    const before = s.kernels[0].hp
    for (let i = 0; i < 40; i++) tick(s, rng) // a couple of laser shots
    const k = s.kernels.find((x) => x.type === kernelType)
    return { before, after: k ? k.hp : 0 }
  }
  const shiney = laserHits('shiney')
  const cob = laserHits('cob')
  ok(shiney.after === shiney.before, 'laser does NOT damage a Shiney Kernel (resistLaser)')
  ok(cob.after < cob.before, 'laser DOES damage a Corn Cob')
}

// ── 8f. Bonus mobs pay out but can't hurt you (leak 0) ──────────────────────
console.log('bonus mobs')
{
  ok(KERNELS.bcob.leak === 0 && KERNELS.bcob.bounty === 10000, 'Buttery Corn Cob: 0 damage, 10000 butter')
  const s = newGame()
  s.phase = 'round'
  s.roundActive = true
  const rng = mulberry32(2)
  s.kernels.push({ id: s.nextId++, type: 'bkernel', dist: PATH.total - 2, hp: 8 })
  const before = s.lives
  tick(s, rng) // it reaches the bowl this tick
  ok(s.lives === before, 'a buttery mob reaching the bowl costs 0 lives')
}

// ── 8g. Crosspath: at most 2 paths per tower; upgrades change stats ─────────
console.log('crosspath')
{
  const s = newGame()
  s.butter = 100000
  const rng = mulberry32(1)
  apply(s, { t: 'place', tower: 'laser', cx: NEAR[0][0], cy: NEAR[0][1] }, rng)
  const id = s.towers[0].id
  const def = TOWERS.laser
  // base dph 5; buy Damage path tier 1 (Focus Lens → dph 10)
  apply(s, { t: 'upgrade', id, path: 0 }, rng)
  ok(effStat(def, s.towers[0].pathLevels, 'dph') === 10, 'damage path raises dph 5 → 10')
  // open a 2nd path (fire-rate) — allowed
  apply(s, { t: 'upgrade', id, path: 1 }, rng)
  ok(effStat(def, s.towers[0].pathLevels, 'sps') === 1, 'fire-rate path raises sps 0.5 → 1')
  ok(s.towers[0].pathLevels.filter((l) => l > 0).length === 2, 'two paths active')
  // opening a 3rd path is blocked (maxPaths 2)
  throws(() => apply(s, { t: 'upgrade', id, path: 2 }, rng), 'cannot open a 3rd upgrade path')
  // but deepening an already-open path is fine
  apply(s, { t: 'upgrade', id, path: 0 }, rng)
  ok(effStat(def, s.towers[0].pathLevels, 'dph') === 15, 'Death Ray → dph 15')
  // range multiplier
  const baseRange = effRange(def, [0, 0, 0])
  apply(s, { t: 'place', tower: 'fire', cx: NEAR[4][0], cy: NEAR[4][1] }, rng)
  const fid = s.towers[1].id
  apply(s, { t: 'upgrade', id: fid, path: 2 }, rng) // High-Power Launcher ×1.25
  ok(Math.abs(effRange(TOWERS.fire, s.towers[1].pathLevels) - TOWERS.fire.range * 1.25) < 1e-9, 'range path multiplies base ×1.25')
  void baseRange
}

// ── 8h. Endless difficulty scaling (round 20+, +2%/round compounding) ───────
console.log('difficulty scaling')
{
  ok(roundSpeedMul(19) === 1, 'no speed scaling before round 20')
  ok(Math.abs(roundSpeedMul(20) - 1.02) < 1e-9, 'speed ×1.02 at round 20')
  ok(Math.abs(roundSpeedMul(21) - 1.0404) < 1e-9, 'speed ×1.0404 at round 21 (compounds)')
  ok(Math.abs(roundHpMul(20, 'cob') - 1.02) < 1e-9, 'cob HP ×1.02 at round 20')
  ok(roundHpMul(25, 'ton') > 1, 'corn ton HP scales')
  ok(roundHpMul(30, 'poppable') === 1, 'basic kernels get NO HP scaling')
  ok(roundHpMul(30, 'bkernel') === 1, 'buttery mobs get NO HP scaling')
  ok(roundSpeedMul(19) === 1 && roundSpeedMul(50) > 1.8, 'speed keeps compounding deep into endless')
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
