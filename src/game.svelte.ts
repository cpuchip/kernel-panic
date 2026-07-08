// Client controller: owns the SimState, runs the fixed-timestep loop, maps
// pointer input to commands, and exposes a reactive `ui` snapshot for the HUD.
// The canvas draws imperatively (render.ts) — Svelte reactivity is only for the
// chrome around it.

import { mulberry32, type Rng } from '../shared/rng.ts'
import { BOMBS, CAMPAIGN_ROUNDS, TOWERS, TOWER_ORDER, towerSpent } from '../shared/sim/content.ts'
import { DEFAULT_MAP, MAPS, MAP_ORDER, type GameMap } from '../shared/sim/maps.ts'
import { nearestDistAlong } from '../shared/sim/path.ts'
import { apply, earlyBonus, newGame, tick, tileBuildable, RuleError } from '../shared/sim/sim.ts'
import { DT, TPS, TILE, WORLD_H, WORLD_W, type BombType, type Command, type SimState, type TargetPolicy, type TowerType } from '../shared/sim/types.ts'
import { draw, type FxItem } from './render.ts'
import { playSfx } from './sound.svelte.ts'
import { settings } from './settings.svelte.ts'
import * as net from './net.ts'
import type { LobbyPlayer } from '../shared/protocol.ts'

const AUTO_DELAY_TICKS = 3 * TPS // grace before auto-start fires (time to place)

export const ui = $state({
  screen: 'menu' as 'menu' | 'coop' | 'lobby' | 'playing', // picker / co-op setup / waiting room / board
  mapId: DEFAULT_MAP,
  lives: 0,
  butter: 0, // MY pot (players[myIndex]) — the HUD number
  butters: [] as number[], // every player's pot (co-op HUD)
  myIndex: 0, // which player this client is (0 in single-player)
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
  placingBomb: null as number | null, // bomb size index being placed on the track
  selectedId: null as number | null,
  error: '',
  version: 0, // bump to poke Svelte when selection details change
  // ── co-op ──
  online: false, // true once connected to a room (server-authoritative)
  roomCode: '', // the shareable code
  myName: '', // this client's display name
  lobby: [] as LobbyPlayer[], // seats in the room
  isHost: false,
  notice: '', // transient co-op toast (gift arrived / teammate needs butter)
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
let hoverWorld: { x: number; y: number } | null = null // raw board point (for the bomb ghost)
let errorTimer: ReturnType<typeof setTimeout> | null = null

export function towerOrder(): TowerType[] {
  return TOWER_ORDER.map((id) => TOWERS[id])
}

/** This client's own butter pot (players[myIndex]; players[0] in single-player). */
function myButter(): number {
  return sim.players[ui.myIndex]?.butter ?? 0
}

function syncUi(): void {
  ui.lives = sim.lives
  ui.butter = myButter()
  ui.butters = sim.players.map((p) => p.butter)
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
  // In co-op the server is authoritative: send the command and let the next
  // snapshot update state (the server stamps our seat + validates).
  if (ui.online) {
    net.sendCmd(cmd)
    return true
  }
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
  // Menu up: hold the sim, just paint the empty board behind the picker.
  if (ui.screen !== 'playing') {
    if (ctx) draw(ctx, sim, { hoverTile: null, placingType: null, placingBomb: null, bombGhostDist: null, selectedId: null, canPlace: false, fx })
    return
  }
  // Co-op: the SERVER runs the sim. We just render the latest snapshot (set by
  // the net handler) — no local tick, no local auto-start.
  if (!ui.online) {
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
  }
  advanceFx(realDt)
  if (ctx) {
    const bombGhostDist =
      ui.placingBomb !== null && hoverWorld ? nearestDistAlong(MAPS[sim.mapId].path, hoverWorld.x, hoverWorld.y) : null
    draw(ctx, sim, {
      hoverTile,
      placingType: ui.placingType,
      placingBomb: ui.placingBomb,
      bombGhostDist,
      selectedId: ui.selectedId,
      canPlace: hoverTile ? canPlaceHover() : false,
      fx,
    })
  }
}

function ingestEvents(): void {
  for (const e of sim.events) {
    switch (e.t) {
      case 'pop': {
        const buttery = e.kind === 'bkernel' || e.kind === 'bpopcorn' || e.kind === 'bcob'
        fx.push({ kind: 'pop', x: e.x!, y: e.y!, life: e.boss ? 0.5 : 0.3, max: e.boss ? 0.5 : 0.3, r: e.boss ? 30 : 12, color: kernelColor(e.kind) })
        playSfx(buttery ? 'jackpot' : e.boss ? 'bosspop' : 'pop') // buttery mobs = a big payout
        break
      }
      case 'beam':
        fx.push({ kind: 'beam', x: e.x!, y: e.y!, tx: e.tx!, ty: e.ty!, life: 0.09, max: 0.09, color: '#ff4d6d' })
        playSfx('laser')
        break
      case 'pulse':
        fx.push({ kind: 'pulse', x: e.x!, y: e.y!, life: 0.28, max: 0.28, r: e.r!, color: '#5ad1e8' })
        playSfx('microwave')
        break
      case 'freeze':
        fx.push({ kind: 'freeze', x: e.x!, y: e.y!, life: 0.3, max: 0.3, r: e.r!, color: '#8fe3ff' })
        playSfx('freeze')
        break
      case 'butter':
        fx.push({ kind: 'butter', x: e.x!, y: e.y!, life: 0.3, max: 0.3, r: e.r!, color: '#ffd98a' })
        playSfx('butter')
        break
      case 'bomb':
        fx.push({ kind: 'bomb', x: e.x!, y: e.y!, life: 0.4, max: 0.4, r: e.r ?? 45, color: '#ffb454' })
        playSfx('bomb')
        break
      case 'suck':
        fx.push({ kind: 'suck', x: e.x!, y: e.y!, life: 0.25, max: 0.25, r: e.r!, color: '#f6e7c4' })
        playSfx('suck')
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

function pxToWorld(clientX: number, clientY: number): { x: number; y: number } | null {
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * WORLD_W
  const y = ((clientY - rect.top) / rect.height) * WORLD_H
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return null
  return { x, y }
}

function pxToTile(clientX: number, clientY: number): { cx: number; cy: number } | null {
  const w = pxToWorld(clientX, clientY)
  return w ? { cx: Math.floor(w.x / TILE), cy: Math.floor(w.y / TILE) } : null
}

export function onPointerMove(clientX: number, clientY: number): void {
  hoverTile = pxToTile(clientX, clientY)
  hoverWorld = pxToWorld(clientX, clientY)
}

export function onPointerLeave(): void {
  hoverTile = null
  hoverWorld = null
}

function canPlaceHover(): boolean {
  if (!ui.placingType || !hoverTile) return false
  const def = TOWERS[ui.placingType]
  return myButter() >= def.cost && tileBuildable(sim, hoverTile.cx, hoverTile.cy)
}

export function onCanvasClick(clientX: number, clientY: number): void {
  // placing a bomb: snap the tap to the nearest point on the track.
  if (ui.placingBomb !== null) {
    const w = pxToWorld(clientX, clientY)
    if (!w) return
    const d = nearestDistAlong(MAPS[sim.mapId].path, w.x, w.y)
    if (dispatch({ t: 'placeBomb', size: ui.placingBomb, dist: d })) {
      playSfx('place')
      if (myButter() < BOMBS[ui.placingBomb].cost) ui.placingBomb = null // out of butter → exit
    }
    return
  }
  const tile = pxToTile(clientX, clientY)
  if (!tile) return
  // clicked an existing tower? select it.
  const hit = sim.towers.find((t) => t.cx === tile.cx && t.cy === tile.cy)
  if (ui.placingType) {
    if (dispatch({ t: 'place', tower: ui.placingType, cx: tile.cx, cy: tile.cy })) {
      playSfx('place')
      // stay in place-mode if still affordable, else exit
      if (myButter() < TOWERS[ui.placingType].cost) ui.placingType = null
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
  ui.placingBomb = null
  ui.selectedId = null
}

/** The five Butter Bomb sizes for the bomb tray. */
export function bombChoices(): BombType[] {
  return BOMBS
}

/** Enter (or leave) bomb-placing mode for a given size. */
export function selectBomb(size: number): void {
  ui.placingBomb = ui.placingBomb === size ? null : size
  ui.placingType = null
  ui.selectedId = null
}

export function cancelPlacing(): void {
  ui.placingType = null
  ui.placingBomb = null
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
      canUpgrade: nextTier !== null && !blockedByCrosspath && myButter() >= nextTier.cost,
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
  if (ui.selectedId !== null && dispatch({ t: 'upgrade', id: ui.selectedId, path })) playSfx('upgrade')
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
  startGame(ui.mapId)
}

// ── Maps / menu ──────────────────────────────────────────────────────────────

export function mapChoices(): GameMap[] {
  return MAP_ORDER.map((id) => MAPS[id])
}

/** SVG polyline for a map's path, clamped to the 0..640 viewBox for a preview. */
export function mapPreviewPoints(m: GameMap): string {
  return m.points
    .map((p) => `${Math.max(0, Math.min(640, p.x))},${Math.max(0, Math.min(640, p.y))}`)
    .join(' ')
}

function startGame(mapId: string): void {
  net.disconnect()
  ui.online = false
  sim = newGame(1, mapId)
  rng = mulberry32(1)
  fx.length = 0
  ui.mapId = sim.mapId
  ui.myIndex = 0
  ui.placingType = null
  ui.placingBomb = null
  ui.selectedId = null
  ui.paused = false
  ui.speed = 1
  ui.screen = 'playing'
  syncUi()
  ui.version++
}

/** Pick a map from the menu and start playing it (single-player). */
export function chooseMap(mapId: string): void {
  startGame(mapId)
}

/** Back to the map picker (from the lost screen / lobby). */
export function openMenu(): void {
  net.disconnect()
  ui.online = false
  ui.screen = 'menu'
  ui.selectedId = null
  ui.placingType = null
  ui.placingBomb = null
  ui.version++
}

// ── Co-op multiplayer ─────────────────────────────────────────────────────────

let noticeTimer: ReturnType<typeof setTimeout> | null = null
function showNotice(text: string): void {
  ui.notice = text
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (ui.notice = ''), 3500)
}

/** A short, friendly, shareable room code (client-side only — not the sim). */
export function suggestRoomCode(): string {
  const words = ['corn', 'butter', 'kernel', 'pop', 'cob', 'salt', 'kettle', 'movie']
  const w = words[Math.floor(Math.random() * words.length)]
  return `${w}-${Math.floor(1000 + Math.random() * 9000)}`
}

/** Open the co-op setup form (enter a name + room code). */
export function openCoop(): void {
  ui.screen = 'coop'
  if (!ui.roomCode) ui.roomCode = suggestRoomCode()
}

/** Connect to a room and enter its lobby (creates the room if you're first). */
export function joinCoop(name: string, code: string): void {
  ui.myName = (name || '').trim().slice(0, 16) || 'Player'
  ui.roomCode = (code || '').trim() || suggestRoomCode()
  ui.online = true
  fx.length = 0
  net.connect(ui.roomCode, ui.myName, {
    onWelcome(index, isHost) {
      ui.myIndex = index
      ui.isHost = isHost
      if (ui.screen !== 'playing') ui.screen = 'lobby'
    },
    onLobby(players, isHost, mapId) {
      ui.lobby = players
      ui.isHost = isHost
      ui.mapId = mapId
      ui.version++
    },
    onSnapshot(state) {
      sim = state
      if (ui.screen !== 'playing') ui.screen = 'playing'
      ingestEvents() // best-effort FX from the tick this snapshot captured
      syncUi()
      ui.version++
    },
    onNotice: showNotice,
    onError: flashError,
    onClose() {
      if (!ui.online) return
      ui.online = false
      ui.screen = 'menu'
      flashError('Disconnected from the room.')
    },
  })
}

/** Host starts the co-op match on the chosen map (the server builds the sim). */
export function coopStart(mapId: string): void {
  net.startGame(mapId)
}

/** Gift butter to a teammate (co-op). */
export function sendButterTo(to: number, amount: number): void {
  if (amount > 0) dispatch({ t: 'sendButter', to, amount })
}

/** Nudge teammates that you need butter (a toast, not a transfer). */
export function askForButter(): void {
  net.askForButter()
}

// initialize UI mirror
syncUi()
