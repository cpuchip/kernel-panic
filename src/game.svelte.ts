// Client controller: owns the SimState, runs the fixed-timestep loop, maps
// pointer input to commands, and exposes a reactive `ui` snapshot for the HUD.
// The canvas draws imperatively (render.ts) — Svelte reactivity is only for the
// chrome around it.

import { mulberry32, type Rng } from '../shared/rng.ts'
import { ROUNDS, TOWERS, TOWER_ORDER, towerSpent } from '../shared/sim/content.ts'
import { apply, earlyBonus, newGame, tick, tileBuildable, RuleError } from '../shared/sim/sim.ts'
import { DT, TPS, TILE, WORLD_H, WORLD_W, type Command, type SimState, type TargetPolicy, type TowerType } from '../shared/sim/types.ts'
import { draw, type FxItem } from './render.ts'
import { playSfx } from './sound.svelte.ts'
import { settings } from './settings.svelte.ts'

const AUTO_DELAY_TICKS = 3 * TPS // grace before auto-start fires (time to place)
const CAMPAIGN_ROUNDS = ROUNDS.length

export const ui = $state({
  lives: 0,
  butter: 0,
  round: 0, // 1-based, the active/next round
  totalRounds: CAMPAIGN_ROUNDS,
  best: 0,
  endless: false, // past the scripted campaign
  earlyBonus: 0, // butter you'd grab by starting now
  banner: '', // transient celebration (campaign cleared)
  phase: 'build' as SimState['phase'],
  roundActive: false,
  speed: 1,
  paused: false,
  placingType: null as string | null,
  selectedId: null as number | null,
  error: '',
  version: 0, // bump to poke Svelte when selection details change
})

let sim: SimState = newGame()
let rng: Rng = mulberry32(1)
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let acc = 0
let last = 0
const fx: FxItem[] = []
let hoverTile: { cx: number; cy: number } | null = null
let errorTimer: ReturnType<typeof setTimeout> | null = null

export function towerOrder(): TowerType[] {
  return TOWER_ORDER.map((id) => TOWERS[id])
}

function syncUi(): void {
  ui.lives = sim.lives
  ui.butter = sim.butter
  ui.round = sim.round + 1 // the active/next round, 1-based (endless goes past 15)
  ui.best = sim.bestRound
  ui.endless = sim.round >= CAMPAIGN_ROUNDS
  ui.earlyBonus = earlyBonus(sim)
  ui.phase = sim.phase
  ui.roundActive = sim.roundActive
}

let bannerTimer: ReturnType<typeof setTimeout> | null = null
function showBanner(msg: string): void {
  ui.banner = msg
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => (ui.banner = ''), 5000)
}

function flashError(msg: string): void {
  ui.error = msg
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => (ui.error = ''), 1600)
}

function dispatch(cmd: Command): boolean {
  try {
    apply(sim, cmd, rng)
    syncUi()
    ui.version++
    return true
  } catch (e) {
    if (e instanceof RuleError) flashError(e.message)
    else throw e
    return false
  }
}

// ── Loop ─────────────────────────────────────────────────────────────────────

export function start(cv: HTMLCanvasElement): void {
  canvas = cv
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  cv.width = WORLD_W * dpr
  cv.height = WORLD_H * dpr
  ctx = cv.getContext('2d')
  ctx?.scale(dpr, dpr)
  last = performance.now()
  loop(last)
}

export function stop(): void {
  cancelAnimationFrame(raf)
}

function loop(now: number): void {
  raf = requestAnimationFrame(loop)
  const realDt = Math.min((now - last) / 1000, 0.1)
  last = now
  const speed = ui.paused ? 0 : ui.speed
  acc += realDt * speed
  let steps = 0
  while (acc >= DT && steps < 8) {
    tick(sim, rng)
    ingestEvents()
    acc -= DT
    steps++
  }
  if (steps > 0) syncUi()
  // auto-start the next round after a short grace, if enabled
  if (sim.phase === 'build' && settings.autoStart && sim.tick - sim.buildStartTick >= AUTO_DELAY_TICKS) {
    dispatch({ t: 'startRound' })
    playSfx('start')
  }
  advanceFx(realDt)
  if (ctx) {
    draw(ctx, sim, {
      hoverTile,
      placingType: ui.placingType,
      selectedId: ui.selectedId,
      canPlace: hoverTile ? canPlaceHover() : false,
      fx,
    })
  }
}

function ingestEvents(): void {
  for (const e of sim.events) {
    switch (e.t) {
      case 'pop':
        fx.push({ kind: 'pop', x: e.x!, y: e.y!, life: e.boss ? 0.5 : 0.3, max: e.boss ? 0.5 : 0.3, r: e.boss ? 30 : 12, color: kernelColor(e.kind) })
        playSfx(e.boss ? 'bosspop' : 'pop')
        break
      case 'beam':
        fx.push({ kind: 'beam', x: e.x!, y: e.y!, tx: e.tx!, ty: e.ty!, life: 0.09, max: 0.09, color: '#ff4d6d' })
        playSfx('laser')
        break
      case 'pulse':
        fx.push({ kind: 'pulse', x: e.x!, y: e.y!, life: 0.28, max: 0.28, r: e.r!, color: '#5ad1e8' })
        playSfx('microwave')
        break
      case 'fire':
        playSfx('fire')
        break
      case 'leak':
        fx.push({ kind: 'leak', x: e.x!, y: e.y!, life: 0.4, max: 0.4, r: 22, color: '#f87171' })
        playSfx('leak')
        break
      case 'roundClear':
        playSfx('roundclear')
        break
      case 'campaignClear':
        showBanner('🏆 Campaign cleared! Endless mode — how far can you go?')
        playSfx('roundclear')
        break
      case 'bossIn':
        playSfx('bossin')
        break
    }
  }
}

function advanceFx(dt: number): void {
  for (let i = fx.length - 1; i >= 0; i--) {
    fx[i].life -= dt
    if (fx[i].life <= 0) fx.splice(i, 1)
  }
}

function kernelColor(id?: string): string {
  switch (id) {
    case 'buttered': return '#f6b73c'
    case 'caramel': return '#b5651d'
    case 'cob': return '#e8c14a'
    default: return '#f4d58d'
  }
}

// ── Input → commands ─────────────────────────────────────────────────────────

function pxToTile(clientX: number, clientY: number): { cx: number; cy: number } | null {
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const wx = ((clientX - rect.left) / rect.width) * WORLD_W
  const wy = ((clientY - rect.top) / rect.height) * WORLD_H
  if (wx < 0 || wy < 0 || wx > WORLD_W || wy > WORLD_H) return null
  return { cx: Math.floor(wx / TILE), cy: Math.floor(wy / TILE) }
}

export function onPointerMove(clientX: number, clientY: number): void {
  hoverTile = pxToTile(clientX, clientY)
}

export function onPointerLeave(): void {
  hoverTile = null
}

function canPlaceHover(): boolean {
  if (!ui.placingType || !hoverTile) return false
  const def = TOWERS[ui.placingType]
  return sim.butter >= def.cost && tileBuildable(sim, hoverTile.cx, hoverTile.cy)
}

export function onCanvasClick(clientX: number, clientY: number): void {
  const tile = pxToTile(clientX, clientY)
  if (!tile) return
  // clicked an existing tower? select it.
  const hit = sim.towers.find((t) => t.cx === tile.cx && t.cy === tile.cy)
  if (ui.placingType) {
    if (dispatch({ t: 'place', tower: ui.placingType, cx: tile.cx, cy: tile.cy })) {
      playSfx('place')
      // stay in place-mode if still affordable, else exit
      if (sim.butter < TOWERS[ui.placingType].cost) ui.placingType = null
    }
    return
  }
  if (hit) {
    ui.selectedId = hit.id
    ui.version++
  } else {
    ui.selectedId = null
  }
}

export function selectType(id: string): void {
  ui.placingType = ui.placingType === id ? null : id
  ui.selectedId = null
}

export function cancelPlacing(): void {
  ui.placingType = null
}

export function deselect(): void {
  ui.selectedId = null
  ui.version++
}

export function selectedTower() {
  if (ui.selectedId === null) return null
  const t = sim.towers.find((w) => w.id === ui.selectedId)
  if (!t) return null
  const def = TOWERS[t.type]
  const active = t.pathLevels.filter((l) => l > 0).length
  const paths = def.paths.map((p, i) => {
    const level = t.pathLevels[i]
    const maxed = level >= p.tiers.length
    const nextTier = maxed ? null : p.tiers[level]
    // can't OPEN a new path once maxPaths are active
    const blockedByCrosspath = level === 0 && active >= def.maxPaths
    return {
      index: i,
      label: p.label,
      level,
      maxLevel: p.tiers.length,
      nextTier, // { name, cost } | null
      canUpgrade: nextTier !== null && !blockedByCrosspath && sim.butter >= nextTier.cost,
      locked: blockedByCrosspath,
    }
  })
  return {
    tower: t,
    def,
    tiers: t.pathLevels.reduce((a, b) => a + b, 0),
    paths,
    sellValue: Math.floor(towerSpent(def, t.pathLevels) * 0.7),
  }
}

export function upgradeSelected(path: number): void {
  if (ui.selectedId !== null && dispatch({ t: 'upgrade', id: ui.selectedId, path })) playSfx('place')
}

export function sellSelected(): void {
  if (ui.selectedId !== null && dispatch({ t: 'sell', id: ui.selectedId })) {
    ui.selectedId = null
    playSfx('sell')
  }
}

export function setTargetSelected(policy: TargetPolicy): void {
  if (ui.selectedId !== null) dispatch({ t: 'target', id: ui.selectedId, policy })
}

export function startRound(): void {
  if (dispatch({ t: 'startRound' })) playSfx('start')
}

export function setSpeed(n: number): void {
  ui.speed = n
  ui.paused = false
}

export function togglePause(): void {
  ui.paused = !ui.paused
}

export function restart(): void {
  sim = newGame()
  rng = mulberry32(1)
  fx.length = 0
  ui.placingType = null
  ui.selectedId = null
  ui.paused = false
  ui.speed = 1
  syncUi()
  ui.version++
}

// initialize UI mirror
syncUi()
