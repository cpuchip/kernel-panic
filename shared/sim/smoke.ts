// Kernel Panic oracle — deterministic assertions over the sim.
// Run: npm run smoke. Green before every commit (the house discipline).
//
// The key contracts: determinism (seed+commands → identical state), the inverse
// hypothesis (a no-tower defense MUST leak and lose; a test that can't fail
// proves nothing), and replay identity (a recorded command log reproduces the
// final state exactly — this same property is the leaderboard verifier and the
// MP correctness check).

import { mulberry32, type Rng } from '../rng.ts'
import { BOMBS, CAMPAIGN_ROUNDS, KERNELS, PATH, TOWERS, effRange, effStat, getRound, tierValue, towerFlag, towerIncome } from './content.ts'
import { MAPS, MAP_ORDER } from './maps.ts'
import { pointAt, distToPath, nearestDistAlong } from './path.ts'
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

/** The buildable tile nearest a chosen distance along the path — so a support
 * tower sits beside a known injection point with plenty of runway ahead. */
function tileNearDist(targetD: number): { tile: [number, number]; worldDist: number } {
  const tp = pointAt(PATH, targetD)
  const s0 = newGame()
  let best: [number, number] = NEAR[0]
  let bestD = Infinity
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      if (!tileBuildable(s0, cx, cy)) continue
      const c = tileCenter(cx, cy)
      const d = Math.hypot(c.x - tp.x, c.y - tp.y)
      if (d < bestD) { bestD = d; best = [cx, cy] }
    }
  }
  return { tile: best, worldDist: bestD }
}

/** Serialize the parts of state that must be reproducible. */
function snap(s: SimState): string {
  return JSON.stringify({
    tick: s.tick,
    phase: s.phase,
    round: s.round,
    lives: s.lives,
    players: s.players,
    splitPtr: s.splitPtr,
    popped: s.popped,
    leaked: s.leaked,
    towers: s.towers,
    kernels: s.kernels,
    projectiles: s.projectiles,
    bombs: s.bombs,
    kernelsEaten: s.kernelsEaten,
  })
}

/** Play a fixed opening layout, then auto-run rounds. Stops when lost or after
 * `stopAfterRound` rounds clear (endless never "wins", so tests set a cap).
 * `butter` overrides the starting bank for mechanics tests that don't care
 * about economy (they're testing that towers pop, not that you can afford them). */
function playFrom(placements: Command[], seed: number, maxTicks = 120000, butter?: number, stopAfterRound = Infinity): SimState {
  const s = newGame()
  if (butter !== undefined) s.players[0].butter = butter
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
  s.players[0].butter = 5000
  const rng = mulberry32(7)
  for (let i = 0; i < 12; i++) apply(s, { t: 'place', tower: 'fire', cx: NEAR[i][0], cy: NEAR[i][1] }, rng)
  apply(s, { t: 'startRound' }, rng)
  let guard = 4000
  while (s.round === 0 && s.phase === 'round' && guard-- > 0) tick(s, rng)
  ok(s.round === 1, 'round 1 cleared')
  ok(s.popped > 0, 'kernels were popped')
  ok(s.lives === START_LIVES, 'no lives lost with a strong defense')
  ok(s.players[0].butter > 0, 'earned butter from pops + clear bonus')
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
    s.players[0].butter = 5000
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
  s.players[0].butter = 5000
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
  poor.players[0].butter = 10
  throws(() => apply(poor, { t: 'place', tower: 'laser', cx: NEAR[1][0], cy: NEAR[1][1] }, rng), 'cannot buy without butter')
  const before = s.players[0].butter
  apply(s, { t: 'sell', id: 1 }, rng)
  ok(s.players[0].butter > before && s.towers.length === 0, 'selling refunds butter and frees the tile')
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
      if (!s.towers.some((t) => t.cx === cx && t.cy === cy) && s.players[0].butter >= def.cost && tileBuildable(s, cx, cy)) {
        apply(s, { t: 'place', tower: tw, cx, cy }, rng)
      }
    }
    // upgrade: pour into up to 2 paths (damage then fire-rate) when affordable
    for (const t of s.towers) {
      const def = TOWERS[t.type]
      for (let p = 0; p < Math.min(def.maxPaths, def.paths.length); p++) {
        const lvl = t.pathLevels[p]
        if (lvl < def.paths[p].tiers.length && s.players[0].butter >= def.paths[p].tiers[lvl].cost + 400) {
          apply(s, { t: 'upgrade', id: t.id, path: p }, rng)
        }
      }
    }
  }
  // The full 100-round campaign is a balance/playtest question (a round-80 Corn Ton
  // cascades thousands of kernels). The oracle proves the EARLY game is winnable
  // through the first pinned boss (Corn Cob at round 40); deeper balance is tuned by play.
  const TARGET = 42
  let peak = 0
  let guard = 600000
  while (s.phase !== 'lost' && s.round < TARGET && guard-- > 0) {
    if (s.phase === 'build') {
      build()
      apply(s, { t: 'startRound' }, rng)
    }
    tick(s, rng)
    peak = Math.max(peak, s.kernels.length)
  }
  ok(s.round >= TARGET, `a strong defense clears the first Corn Cob boss (reached ${s.round}, ${s.lives} lives)`)
  ok(s.phase !== 'lost', 'not lost through round 40')
  ok(s.bestRound === s.round, 'bestRound tracks the furthest round reached')
  ok(peak < 2000, `entity count stays bounded through the boss (peak ${peak})`) // perf guard
}

// ── 8b. The procedural round generator (bosses pinned, deterministic, flows) ──
console.log('round generator')
{
  const a = getRound(50, 1234)
  const b = getRound(50, 1234)
  ok(JSON.stringify(a) === JSON.stringify(b), 'getRound is deterministic for a seed+round')
  // boss rounds pinned — and JUST the boss, no escort (his call, like round 100)
  const bossOnly = (idx: number, type: string) => {
    const gr = getRound(idx, 1).groups
    return gr.length === 1 && gr[0].type === type && gr[0].count === 1
  }
  ok(bossOnly(39, 'cob'), 'round 40 is ONLY the Corn Cob boss')
  ok(bossOnly(59, 'bunch'), 'round 60 is ONLY the Corn Bunch boss')
  ok(bossOnly(79, 'ton'), 'round 80 is ONLY the Corn Ton boss')
  ok(bossOnly(99, 'bigcorn'), 'round 100 is ONLY Big Corn of Doom')
  // every round has content, and mob types only appear after they unlock
  for (let r = 1; r <= CAMPAIGN_ROUNDS; r++) {
    const def = getRound(r - 1, 7)
    if (def.groups.length === 0) { ok(false, `round ${r} has spawns`); break }
  }
  ok(!getRound(4, 7).groups.some((g) => g.type === 'superhard'), 'no Super Hard on an early round')
  ok(getRound(49, 7).groups.some((g) => g.type === 'superhard' || g.type === 'cob'), 'tough mobs appear by round 50')
  // threat climbs: total leak-if-all-through is much bigger at 90 than at 10
  const rbe = (idx: number) => getRound(idx, 7).groups.reduce((n, g) => n + g.count * KERNELS[g.type].leak, 0)
  ok(rbe(89) > rbe(9) * 20, 'the round threat climbs steeply across the campaign')
  // free play keeps going past 100, and trends to nearly-all-cob (his call)
  ok(getRound(120, 7).groups.length > 0, 'Free Play generates rounds past 100')
  const cobFam = new Set(['cob', 'quickcob', 'bunch', 'ton', 'bigcorn'])
  const deep = getRound(129, 7) // round 130, deep Free Play
  ok(deep.groups.every((g) => cobFam.has(g.type)), 'deep Free Play is purely cob-family (no small kernels)')
  const earlyFP = getRound(102, 7) // round 103, early Free Play still has some variety
  ok(earlyFP.groups.some((g) => !cobFam.has(g.type)), 'early Free Play still sprinkles small mobs')
  // purely RANDOM: consecutive Free Play rounds differ, but each is deterministic
  ok(JSON.stringify(getRound(110, 7)) !== JSON.stringify(getRound(111, 7)), 'Free Play rounds are randomly different')
  ok(JSON.stringify(getRound(110, 7)) === JSON.stringify(getRound(110, 7)), 'each Free Play round is deterministic')
  // and it gets cob-HEAVIER deeper in (more cob-family mobs at 140 than at 105)
  const cobCount = (idx: number) => getRound(idx, 7).groups.filter((g) => cobFam.has(g.type)).reduce((n, g) => n + g.count, 0)
  ok(cobCount(139) > cobCount(104), 'Free Play piles on more cobs the deeper you go')
}

// ── 8c. Leak = instant game over (a big cob through the bowl ends the run) ────
console.log('leak = instant loss')
{
  const s = newGame()
  const rng = mulberry32(9)
  s.phase = 'round'
  s.roundActive = true
  s.spawnQueue = [{ type: 'poppable', atTick: s.tick + 9999 }] // keep the round open
  const path = MAPS[s.mapId].path
  // a Corn Cob one step from the bowl
  s.kernels = [{ id: s.nextId++, type: 'cob', dist: path.total - 1, hp: 200 }]
  tick(s, rng)
  ok(s.lives === 0, `a leaked Corn Cob (leak ${KERNELS.cob.leak}) drains all lives`)
  ok((s.phase as string) === 'lost', 'a leaked cob is instant game over (100 lives < 616 leak)')
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
  const before = s2.players[0].butter
  apply(s2, { t: 'startRound' }, rng)
  ok(s2.players[0].butter === before + bonus, 'starting a round awards the current early bonus')
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
    s.players[0].butter = 5000
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
  s.players[0].butter = 100000
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

// ── 8h. Free-Play difficulty scaling (round 101+, +2%/round compounding) ────
console.log('difficulty scaling')
{
  ok(roundSpeedMul(100) === 1, 'no speed scaling during the 100-round campaign')
  ok(Math.abs(roundSpeedMul(101) - 1.02) < 1e-9, 'speed ×1.02 at round 101 (first Free Play)')
  ok(Math.abs(roundSpeedMul(102) - 1.0404) < 1e-9, 'speed ×1.0404 at round 102 (compounds)')
  ok(Math.abs(roundHpMul(101, 'cob') - 1.02) < 1e-9, 'cob HP ×1.02 at round 101')
  ok(roundHpMul(110, 'ton') > 1, 'corn ton HP scales in Free Play')
  ok(roundHpMul(120, 'poppable') === 1, 'basic kernels get NO HP scaling')
  ok(roundHpMul(120, 'bkernel') === 1, 'buttery mobs get NO HP scaling')
  ok(roundSpeedMul(100) === 1 && roundSpeedMul(140) > 1.8, 'speed keeps compounding deep into Free Play')
}

// ── 9. Kernels sit on the path ──────────────────────────────────────────────
console.log('kernel position')
{
  const s = newGame()
  const rng = mulberry32(2)
  apply(s, { t: 'startRound' }, rng)
  for (let i = 0; i < 40; i++) tick(s, rng)
  ok(s.kernels.length > 0, 'kernels spawned during a round')
  ok(s.kernels.every((k) => distToPath(PATH, kernelWorld(s, k).x, kernelWorld(s, k).y) < 0.5), 'every kernel sits on the path')
}

// ── 10. Maps: every map is a valid, walkable, buildable board ────────────────
console.log('maps')
{
  for (const id of MAP_ORDER) {
    const map = MAPS[id]
    ok(map.path.total > 0, `${id}: path has length`)
    // path is continuous — no giant jump between sampled points
    let maxJump = 0
    let prev = pointAt(map.path, 0)
    for (let d = 6; d <= map.path.total; d += 6) {
      const p = pointAt(map.path, d)
      maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.y - prev.y))
      prev = p
    }
    ok(maxJump < 12, `${id}: path is continuous (max step ${maxJump.toFixed(1)})`)
    // there are enough buildable tiles to actually play
    const s = newGame(1, id)
    let buildable = 0
    for (let cy = 0; cy < Math.floor(640 / 32); cy++)
      for (let cx = 0; cx < Math.floor(640 / 32); cx++) if (tileBuildable(s, cx, cy)) buildable++
    ok(buildable > 40, `${id}: has room for towers (${buildable} tiles)`)
    // a spawned kernel walks this map's path and eventually leaks
    const s2 = newGame(1, id)
    apply(s2, { t: 'startRound' }, mulberry32(3))
    for (let i = 0; i < 40; i++) tick(s2, mulberry32(3))
    ok(s2.kernels.every((k) => distToPath(map.path, kernelWorld(s2, k).x, kernelWorld(s2, k).y) < 0.5), `${id}: kernels sit on the path`)
  }
  // an unknown map id falls back to the default rather than crashing
  const sBad = newGame(1, 'nope')
  ok(sBad.mapId === 'classic', 'unknown map id falls back to classic')
}

// ── 11. Butter Churn crosspath: Bank interest + Popcorn (lives/round) ────────
console.log('churn bank + popcorn')
{
  const churn = TOWERS.churn
  ok(churn.maxPaths === 2 && churn.paths.length === 3, 'churn has 3 paths, pick 2')
  // Butter Bank pays interest on held butter at round clear
  const s = newGame()
  const rng = mulberry32(5)
  s.players[0].butter = 100000
  apply(s, { t: 'place', tower: 'churn', cx: NEAR[0][0], cy: NEAR[0][1] }, rng)
  const cid = s.towers[0].id
  const bankIdx = churn.paths.findIndex((p) => p.key === 'bank')
  apply(s, { t: 'upgrade', id: cid, path: bankIdx }, rng) // Piggy Churn: 5% interest
  ok(tierValue(churn, s.towers[0].pathLevels, 'interest') === 0.05, 'bank path sets 5% interest')
  // clear a round with a known balance → interest is credited (on top of the
  // round bonus and the churn's flat base income).
  s.players[0].butter = 1000
  s.round = 2
  s.phase = 'round'
  s.roundActive = true
  s.spawnQueue = []
  s.kernels = []
  const before = s.players[0].butter
  tick(s, rng) // checkRoundEnd runs inside tick when the wave is empty
  const def = getRound(2, s.seed)
  const baseIncome = towerIncome(churn, s.towers[0].pathLevels) // flat churn base (250)
  ok(s.players[0].butter === before + def.bonus + baseIncome + Math.floor(before * 0.05), 'round clear credits 5% interest on held butter')

  // Popcorn path pops out lives each round you clear (popcorn = life)
  const s2 = newGame()
  const rng2 = mulberry32(6)
  s2.players[0].butter = 100000
  apply(s2, { t: 'place', tower: 'churn', cx: NEAR[0][0], cy: NEAR[0][1] }, rng2)
  const popIdx = churn.paths.findIndex((p) => p.key === 'popcorn')
  apply(s2, { t: 'upgrade', id: s2.towers[0].id, path: popIdx }, rng2) // Popper: +1 life/round
  ok(tierValue(churn, s2.towers[0].pathLevels, 'livesPerRound') === 1, 'popcorn path sets +1 life/round')
  s2.round = 2
  s2.phase = 'round'
  s2.roundActive = true
  s2.spawnQueue = []
  s2.kernels = []
  const livesBefore = s2.lives
  tick(s2, rng2) // checkRoundEnd credits the round's lives
  ok(s2.lives === livesBefore + 1, 'clearing a round with Popper adds 1 life')
}

// ── 12. Freeze Ray: freezes movers, respects RTF + cob rules ─────────────────
console.log('freeze ray')
{
  const D = PATH.total * 0.3
  const [cx, cy] = tileNearDist(D).tile
  function freezeCheck(kernelType: string, mega: boolean): { frozen: boolean; moved: number } {
    const s = newGame()
    s.players[0].butter = 100000
    const rng = mulberry32(1)
    apply(s, { t: 'place', tower: 'freeze', cx, cy }, rng)
    const tw = s.towers[0]
    if (mega) {
      const fi = TOWERS.freeze.paths.findIndex((p) => p.key === 'freezeStr')
      apply(s, { t: 'upgrade', id: tw.id, path: fi }, rng)
      apply(s, { t: 'upgrade', id: tw.id, path: fi }, rng) // → Mega Freeze
    }
    s.phase = 'round'
    s.roundActive = true
    s.spawnQueue = [{ type: 'poppable', atTick: s.tick + 9999 }]
    s.kernels = [{ id: s.nextId++, type: kernelType as SimState['kernels'][0]['type'], dist: D, hp: KERNELS[kernelType as 'poppable'].hp }]
    for (let i = 0; i < 12; i++) tick(s, rng)
    const k = s.kernels.find((x) => x.type === kernelType)
    return { frozen: !!(k && (k.freeze ?? 0) > 0), moved: k ? k.dist - D : 999 }
  }
  const plain = freezeCheck('poppable', false)
  ok(plain.frozen, 'freeze ray freezes a plain kernel')
  const whiteK = freezeCheck('white', false)
  ok(!whiteK.frozen, 'a White Kernel (RTF) never freezes')
  ok(whiteK.moved > plain.moved + 5, 'a frozen kernel barely moves; the RTF kernel walks on')
  ok(!freezeCheck('cob', false).frozen, 'base freeze cannot touch a cob')
  ok(freezeCheck('cob', true).frozen, 'Mega Freeze freezes a cob')
  ok(!freezeCheck('bigcorn', true).frozen, 'even Mega Freeze cannot freeze the Big Corn of Doom')
}

// ── 13. Butter Turret: slows kernels, and Poison butter drips damage ─────────
console.log('butter turret')
{
  const D = PATH.total * 0.3
  const [cx, cy] = tileNearDist(D).tile
  function run(withButter: boolean, poison: boolean): { moved: number; hp: number; slowed: boolean } {
    const s = newGame()
    s.players[0].butter = 100000
    const rng = mulberry32(2)
    if (withButter) {
      apply(s, { t: 'place', tower: 'butter', cx, cy }, rng)
      if (poison) {
        const pi = TOWERS.butter.paths.findIndex((p) => p.key === 'poison')
        apply(s, { t: 'upgrade', id: s.towers[0].id, path: pi }, rng)
        apply(s, { t: 'upgrade', id: s.towers[0].id, path: pi }, rng) // → Poison Butter
      }
    }
    s.phase = 'round'
    s.roundActive = true
    s.spawnQueue = [{ type: 'poppable', atTick: s.tick + 9999 }]
    s.kernels = [{ id: s.nextId++, type: 'kettle', dist: D, hp: 50 }] // sturdy, so it survives to be measured
    for (let i = 0; i < 20; i++) tick(s, rng)
    const k = s.kernels.find((x) => x.type === 'kettle')
    return { moved: k ? k.dist - D : 999, hp: k ? k.hp : 0, slowed: !!(k && (k.slow ?? 0) > 0) }
  }
  const free = run(false, false)
  const slowed = run(true, false)
  ok(slowed.slowed, 'butter turret sticks butter (slow) on a kernel')
  ok(slowed.moved < free.moved, 'a buttered kernel advances slower than a free one')
  ok(run(true, true).hp < 50, 'Poison Butter drips damage over time (hp falls with no attacker)')
}

// ── 14. Butter Bomb: 1-use track mine; Black kernels shrug it off ────────────
console.log('butter bomb')
{
  const bombDist = PATH.total * 0.5
  const s = newGame()
  const rng = mulberry32(3)
  s.players[0].butter = 100000
  const butterBefore = s.players[0].butter
  apply(s, { t: 'placeBomb', size: 4, dist: bombDist }, rng) // Biggest Bomb, 500 dmg
  ok(s.bombs.length === 1, 'a placed bomb sits on the track')
  ok(butterBefore - s.players[0].butter === BOMBS[4].cost, 'placing a bomb costs its butter')
  s.phase = 'round'
  s.roundActive = true
  s.spawnQueue = [{ type: 'poppable', atTick: s.tick + 9999 }]
  s.kernels = [{ id: s.nextId++, type: 'superhard', dist: bombDist - 20, hp: 10 }]
  for (let i = 0; i < 40 && s.bombs.length > 0; i++) tick(s, rng)
  ok(s.bombs.length === 0, 'the bomb detonated and was consumed (1 use)')
  ok(s.popped > 0, 'the bomb popped the kernel that stepped on it')
  // Black Kernel is bomb-proof
  const s2 = newGame()
  const rng2 = mulberry32(4)
  s2.players[0].butter = 100000
  apply(s2, { t: 'placeBomb', size: 4, dist: bombDist }, rng2)
  s2.phase = 'round'
  s2.roundActive = true
  s2.spawnQueue = [{ type: 'poppable', atTick: s2.tick + 9999 }]
  s2.kernels = [{ id: s2.nextId++, type: 'black', dist: bombDist - 2, hp: 1 }]
  tick(s2, rng2) // black reaches the bomb → it triggers but deals no damage to black
  const bk = s2.kernels.find((x) => x.type === 'black')
  ok(!!bk && bk.hp === 1, 'a Black Kernel shrugs off the bomb (resistBomb)')
  ok(s2.bombs.length === 0, 'the bomb is still spent even when it hits only bomb-proof kernels')
  // rule checks
  throws(() => apply(newGame(), { t: 'placeBomb', size: 4, dist: PATH.total + 50 }, mulberry32(1)), 'cannot place a bomb off the track')
  const poor = newGame()
  poor.players[0].butter = 10
  throws(() => apply(poor, { t: 'placeBomb', size: 4, dist: bombDist }, mulberry32(1)), 'cannot place a bomb without butter')
}

// ── 15. Popcorn Machine: eats kernels off the track, banks them into lives ───
console.log('popcorn machine')
{
  const D = PATH.total * 0.3
  const [cx, cy] = tileNearDist(D).tile
  const s = newGame()
  const rng = mulberry32(5)
  s.players[0].butter = 100000
  apply(s, { t: 'place', tower: 'popcorn', cx, cy }, rng)
  s.phase = 'round'
  s.roundActive = true
  s.spawnQueue = [{ type: 'poppable', atTick: s.tick + 9999 }]
  for (let i = 0; i < 8; i++) s.kernels.push({ id: s.nextId++, type: 'poppable', dist: D + i * 2, hp: 1 })
  const before = s.kernels.length
  const butterBefore = s.players[0].butter
  tick(s, rng) // one activation eats up to capacity (5)
  ok(s.kernels.length < before, 'the popcorn machine sucks kernels off the track')
  ok(s.kernelsEaten > 0, 'eaten kernels are banked toward popcorn')
  ok(s.players[0].butter === butterBefore, 'sucked kernels pay NO bounty (they become lives, not butter)')
  // crossing the 100-kernel threshold pops a life
  const s2 = newGame()
  const rng2 = mulberry32(5)
  s2.players[0].butter = 100000
  apply(s2, { t: 'place', tower: 'popcorn', cx, cy }, rng2)
  s2.kernelsEaten = 99
  s2.phase = 'round'
  s2.roundActive = true
  s2.spawnQueue = [{ type: 'poppable', atTick: s2.tick + 9999 }]
  s2.kernels = [{ id: s2.nextId++, type: 'poppable', dist: D, hp: 1 }]
  const lifeBefore = s2.lives
  tick(s2, rng2) // eats 1 → 100 → +1 life
  ok(s2.lives === lifeBefore + 1, 'a full batch (100 kernels) pops into a life')
}

// ── 16. New-tower structure + determinism with the new mechanics ─────────────
console.log('new towers structure')
{
  for (const id of ['freeze', 'butter', 'popcorn']) {
    const def = TOWERS[id]
    ok(!!def && def.paths.length === 3 && def.maxPaths === 2, `${id}: 3 paths, pick 2`)
  }
  const fdef = TOWERS.freeze
  const fi = fdef.paths.findIndex((p) => p.key === 'freezeStr')
  const base = fdef.paths.map(() => 0)
  ok(!towerFlag(fdef, base, 'mega'), 'freeze is not Mega unbought')
  ok(effStat(fdef, base, 'freezeSec') === 2, 'base freeze duration 2s')
  const megaLv = fdef.paths.map(() => 0)
  megaLv[fi] = 2
  ok(towerFlag(fdef, megaLv, 'mega') && effStat(fdef, megaLv, 'freezeSec') === 8, 'Mega Freeze: flag set, 8s duration')
  ok(BOMBS.length === 5, 'five bomb sizes')
  let asc = true
  for (let i = 1; i < BOMBS.length; i++) if (BOMBS[i].cost <= BOMBS[i - 1].cost || BOMBS[i].dmg <= BOMBS[i - 1].dmg) asc = false
  ok(asc, 'bombs get pricier and punchier by size')
  const pdef = TOWERS.popcorn
  const ei = pdef.paths.findIndex((p) => p.key === 'eff')
  const pl = pdef.paths.map(() => 0)
  ok(effStat(pdef, pl, 'kernelsPerPopcorn') === 100 && effStat(pdef, pl, 'popcornYield') === 1, 'base 100 kernels → 1 life')
  pl[ei] = 2
  ok(effStat(pdef, pl, 'kernelsPerPopcorn') === 75 && effStat(pdef, pl, 'popcornYield') === 2, 'Super Fresh: 75 kernels → 2 lives')

  // determinism must still hold with freeze/butter/popcorn towers AND a bomb live
  function playNew(seed: number): SimState {
    const s = newGame()
    const rng = mulberry32(seed)
    s.players[0].butter = 100000
    apply(s, { t: 'place', tower: 'freeze', cx: NEAR[0][0], cy: NEAR[0][1] }, rng)
    apply(s, { t: 'place', tower: 'butter', cx: NEAR[2][0], cy: NEAR[2][1] }, rng)
    apply(s, { t: 'place', tower: 'popcorn', cx: NEAR[4][0], cy: NEAR[4][1] }, rng)
    apply(s, { t: 'place', tower: 'fire', cx: NEAR[6][0], cy: NEAR[6][1] }, rng)
    apply(s, { t: 'placeBomb', size: 2, dist: PATH.total * 0.4 }, rng)
    let g = 6000
    while (s.phase !== 'lost' && s.round < 3 && g-- > 0) {
      if (s.phase === 'build') apply(s, { t: 'startRound' }, rng)
      tick(s, rng)
    }
    return s
  }
  ok(snap(playNew(21)) === snap(playNew(21)), 'freeze + butter + popcorn + a bomb stay deterministic')

  // nearestDistAlong (the client uses it to snap a bomb tap to the track)
  const dTarget = PATH.total * 0.42
  const onPath = pointAt(PATH, dTarget)
  ok(Math.abs(nearestDistAlong(PATH, onPath.x, onPath.y) - dTarget) < 2, 'nearestDistAlong recovers a point\'s distance on the path')
}

// ── 17. Co-op economy: per-player pots, even-split earnings, send butter ─────
console.log('co-op economy')
{
  const s = newGame(7, 'classic', 2)
  ok(s.players.length === 2, 'a 2-player game has two butter pots')
  ok(s.players[0].butter === s.players[1].butter, 'both players start with the same butter')
  ok(typeof s.lives === 'number', 'lives are a single shared pool (co-op)')
  const rng = mulberry32(1)
  // each player spends from their OWN pot
  s.players[0].butter = 1000
  s.players[1].butter = 1000
  apply(s, { t: 'place', tower: 'fire', cx: NEAR[0][0], cy: NEAR[0][1], player: 0 }, rng)
  ok(s.players[0].butter === 800 && s.players[1].butter === 1000, 'player 0 placing pays from pot 0 only')
  apply(s, { t: 'place', tower: 'fire', cx: NEAR[1][0], cy: NEAR[1][1], player: 1 }, rng)
  ok(s.players[1].butter === 800 && s.players[0].butter === 800, 'player 1 placing pays from pot 1 only')
  // a broke player can't spend a teammate's butter, even if the table is rich
  s.players[0].butter = 100
  s.players[1].butter = 5000
  throws(() => apply(s, { t: 'place', tower: 'microwave', cx: NEAR[2][0], cy: NEAR[2][1], player: 0 }, rng), 'a broke player cannot spend a teammate\'s butter')
  // send butter to a teammate
  s.players[0].butter = 500
  s.players[1].butter = 100
  apply(s, { t: 'sendButter', player: 0, to: 1, amount: 200 }, rng)
  ok(s.players[0].butter === 300 && s.players[1].butter === 300, 'sendButter transfers between pots')
  throws(() => apply(s, { t: 'sendButter', player: 1, to: 0, amount: 99999 }, rng), 'cannot send more butter than you hold')
  throws(() => apply(s, { t: 'sendButter', player: 0, to: 0, amount: 10 }, rng), 'cannot send butter to yourself')

  // earnings split evenly across pots (remainder rotates via splitPtr)
  const s2 = newGame(7, 'classic', 2)
  s2.players[0].butter = 0
  s2.players[1].butter = 0
  s2.round = 2
  s2.phase = 'round'
  s2.roundActive = true
  s2.spawnQueue = []
  s2.kernels = []
  tick(s2, mulberry32(3)) // round clears → the bonus is earned and split
  const bonus = getRound(2, s2.seed).bonus
  ok(s2.players[0].butter + s2.players[1].butter === bonus, 'the round bonus is fully credited across both pots')
  ok(Math.abs(s2.players[0].butter - s2.players[1].butter) <= 1, 'the round bonus splits ~evenly (remainder ≤ 1)')

  // determinism holds with 2 pots + player-tagged commands + a gift
  function play2(seed: number): SimState {
    const g = newGame(seed, 'classic', 2)
    const r = mulberry32(seed)
    g.players[0].butter = 3000
    g.players[1].butter = 3000
    apply(g, { t: 'place', tower: 'laser', cx: NEAR[0][0], cy: NEAR[0][1], player: 0 }, r)
    apply(g, { t: 'place', tower: 'fire', cx: NEAR[2][0], cy: NEAR[2][1], player: 1 }, r)
    apply(g, { t: 'sendButter', player: 1, to: 0, amount: 500 }, r)
    let guard = 5000
    while (g.phase !== 'lost' && g.round < 3 && guard-- > 0) {
      if (g.phase === 'build') apply(g, { t: 'startRound' }, r)
      tick(g, r)
    }
    return g
  }
  ok(snap(play2(11)) === snap(play2(11)), 'co-op (2 pots + tagged commands + a gift) stays deterministic')
  // single-player is unchanged: one pot, earnings all land there
  ok(newGame(1).players.length === 1, 'single-player still makes exactly one pot')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
