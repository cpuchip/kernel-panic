// Canvas renderer — draws the board each frame from the current SimState.
// Phase 0 is shapes (art comes in Phase 1 via the asset harness). Kernels =
// kernels, cobs = bosses, towers by kind, plus transient FX from sim events.

import { KERNELS, TOWERS, effRange } from '../shared/sim/content.ts'
import { MAPS, DEFAULT_MAP } from '../shared/sim/maps.ts'
import type { Path } from '../shared/sim/path.ts'
import { kernelHeading, kernelWorld, tileBuildable, tileCenter } from '../shared/sim/sim.ts'
import { TILE, WORLD_H, WORLD_W, type SimState, type Tower } from '../shared/sim/types.ts'

export interface FxItem {
  kind: 'pop' | 'beam' | 'pulse' | 'leak'
  x: number
  y: number
  tx?: number
  ty?: number
  r?: number
  life: number
  max: number
  color: string
}

export interface View {
  hoverTile: { cx: number; cy: number } | null
  placingType: string | null
  selectedId: number | null
  canPlace: boolean
  fx: FxItem[]
}

// ── Sprites (carnival-cartoon art; fall back to shapes until loaded) ─────────
const SPRITES: Record<string, HTMLImageElement> = {}
if (typeof Image !== 'undefined') {
  for (const n of [
    // all 21 mobs + 4 towers (missing files fall back to drawn shapes)
    'poppable', 'kernel', 'hard', 'kettle', 'candy', 'black', 'white', 'blackwhite',
    'purple', 'melted', 'rainbow', 'superhard', 'shiney',
    'cob', 'quickcob', 'bunch', 'ton', 'bigcorn', 'bkernel', 'bpopcorn', 'bcob',
    'fire', 'microwave', 'laser', 'churn',
  ]) {
    const img = new Image()
    img.src = `/assets/sprites/${n}.png`
    SPRITES[n] = img
  }
}
function sprite(name: string): HTMLImageElement | null {
  const img = SPRITES[name]
  return img && img.complete && img.naturalWidth > 0 ? img : null
}
/** Draw a sprite centered at the current origin, fit into a size×size box (aspect kept). */
function drawSpriteFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number): void {
  const ar = img.width / img.height
  let w = size
  let h = size
  if (ar > 1) h = size / ar
  else w = size * ar
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
}

export function draw(ctx: CanvasRenderingContext2D, s: SimState, v: View): void {
  background(ctx)
  drawPath(ctx, (MAPS[s.mapId] ?? MAPS[DEFAULT_MAP]).path)
  if (v.placingType) buildableHints(ctx, s)
  drawTowers(ctx, s, v)
  drawKernels(ctx, s)
  drawProjectiles(ctx, s)
  drawFx(ctx, v.fx)
  if (v.placingType && v.hoverTile) placeGhost(ctx, v)
}

function background(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#1b1410'
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  // faint warm vignette
  const g = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 60, WORLD_W / 2, WORLD_H / 2, 460)
  g.addColorStop(0, 'rgba(60,40,20,0.14)')
  g.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
}

function drawPath(ctx: CanvasRenderingContext2D, path: Path): void {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // outer band (counter)
  ctx.strokeStyle = '#41301d'
  ctx.lineWidth = 36
  tracePath(ctx, path)
  ctx.stroke()
  // inner track
  ctx.strokeStyle = '#523c24'
  ctx.lineWidth = 26
  tracePath(ctx, path)
  ctx.stroke()
  // dashed center line
  ctx.setLineDash([6, 12])
  ctx.strokeStyle = 'rgba(244,213,141,0.25)'
  ctx.lineWidth = 2
  tracePath(ctx, path)
  ctx.stroke()
  ctx.setLineDash([])
  // the bowl at the end
  const end = path.points[path.points.length - 1]
  ctx.fillStyle = '#2c2113'
  ctx.beginPath()
  ctx.arc(end.x - 14, end.y, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f4d58d'
  ctx.font = '20px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🥣', end.x - 14, end.y)
}

function tracePath(ctx: CanvasRenderingContext2D, path: Path): void {
  ctx.beginPath()
  ctx.moveTo(path.points[0].x, path.points[0].y)
  for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y)
}

function buildableHints(ctx: CanvasRenderingContext2D, s: SimState): void {
  ctx.fillStyle = 'rgba(120,200,120,0.10)'
  for (let cy = 0; cy < Math.floor(WORLD_H / TILE); cy++) {
    for (let cx = 0; cx < Math.floor(WORLD_W / TILE); cx++) {
      if (tileBuildable(s, cx, cy)) {
        ctx.fillRect(cx * TILE + 2, cy * TILE + 2, TILE - 4, TILE - 4)
      }
    }
  }
}

function towerBody(ctx: CanvasRenderingContext2D, t: Tower): void {
  const def = TOWERS[t.type]
  ctx.save()
  ctx.translate(t.x, t.y)
  const img = sprite(t.type)
  if (img) {
    drawSpriteFit(ctx, img, 32)
    if (t.pathLevels.some((l) => l > 0)) {
      ctx.fillStyle = '#ffd166'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('★', 13, -13)
    }
    ctx.restore()
    return
  }
  const R = 12
  ctx.fillStyle = def.color
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 2
  switch (def.kind) {
    case 'dart':
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#fff2d0'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('🔥', 0, 1)
      break
    case 'pulse':
      ctx.beginPath(); roundRect(ctx, -R, -R, R * 2, R * 2, 4); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#0b2b33'; ctx.fillRect(-R + 3, -3, R * 2 - 6, 6)
      break
    case 'beam':
      ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(R, 0); ctx.lineTo(0, R); ctx.lineTo(-R, 0); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#3a0d16'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill()
      break
    case 'econ':
      ctx.beginPath(); roundRect(ctx, -R + 2, -R, R * 2 - 4, R * 2, 6); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = 'rgba(120,90,40,0.7)'; ctx.beginPath(); ctx.moveTo(-R + 2, -3); ctx.lineTo(R - 2, -3); ctx.moveTo(-R + 2, 4); ctx.lineTo(R - 2, 4); ctx.stroke()
      break
  }
  if (t.pathLevels.some((l) => l > 0)) {
    ctx.fillStyle = '#ffd166'
    ctx.beginPath(); ctx.arc(R - 2, -R + 2, 3.5, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function drawTowers(ctx: CanvasRenderingContext2D, s: SimState, v: View): void {
  for (const t of s.towers) {
    const def = TOWERS[t.type]
    if (v.selectedId === t.id && def.kind !== 'econ') {
      // Every tower that reaches out (attack / freeze / butter / popcorn suck)
      // shows its range; the Butter Churn has no range, so nothing to draw.
      const range = effRange(def, t.pathLevels)
      ctx.fillStyle = 'rgba(255,209,102,0.08)'
      ctx.strokeStyle = 'rgba(255,209,102,0.4)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(t.x, t.y, range, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
    towerBody(ctx, t)
  }
}

// Each of the 10 mobs now has its own sprite (kp mob art, 2026-07-07). The map
// is identity, but keeping it explicit lets any mob fall back to a sibling if a
// sprite is ever missing (the renderer also falls back to drawn shapes).
const KERNEL_SPRITE: Record<string, string> = {
  poppable: 'poppable', kernel: 'kernel', hard: 'hard', shiney: 'shiney',
  cob: 'cob', bunch: 'bunch', ton: 'ton', bcob: 'bcob',
  bkernel: 'bkernel', bpopcorn: 'bpopcorn',
}

function drawKernels(ctx: CanvasRenderingContext2D, s: SimState): void {
  for (const k of s.kernels) {
    const kt = KERNELS[k.type]
    const p = kernelWorld(s, k)
    const img = sprite(KERNEL_SPRITE[k.type] ?? k.type)
    ctx.save()
    ctx.translate(p.x, p.y)
    if (img) {
      // cob-shaped mobs' art faces right; rotate it to the travel heading
      if (kt.cobShape) ctx.rotate(kernelHeading(s, k))
      drawSpriteFit(ctx, img, kt.radius * 2.9)
    } else if (kt.cobShape) {
      ctx.rotate(kernelHeading(s, k))
      ctx.fillStyle = '#7a9a3a'
      ctx.beginPath(); ellipse(ctx, -kt.radius * 0.5, 0, kt.radius + 6, kt.radius - 1); ctx.fill()
      ctx.fillStyle = kt.color
      ctx.beginPath(); ellipse(ctx, 0, 0, kt.radius, kt.radius - 3); ctx.fill()
    } else {
      ctx.fillStyle = kt.color
      ctx.beginPath(); ctx.arc(0, 0, kt.radius, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath(); ctx.arc(-kt.radius * 0.3, -kt.radius * 0.3, kt.radius * 0.35, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    // hp arc for multi-hp kernels (drawn unrotated, around the sprite)
    if (kt.hp > 1 && k.hp < kt.hp) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, kt.radius * 1.5 + 3, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * k.hp) / kt.hp)
      ctx.stroke()
    }
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, s: SimState): void {
  ctx.fillStyle = '#ffb454'
  for (const pr of s.projectiles) {
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 3.2, 0, Math.PI * 2); ctx.fill()
  }
}

function drawFx(ctx: CanvasRenderingContext2D, fx: FxItem[]): void {
  for (const f of fx) {
    const a = f.life / f.max
    if (f.kind === 'pop') {
      // popped popcorn puff
      ctx.globalAlpha = a
      ctx.fillStyle = '#fff6e0'
      const rr = (f.r ?? 12) * (1.2 - a * 0.6)
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2
        ctx.beginPath(); ctx.arc(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr, 3, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    } else if (f.kind === 'beam') {
      ctx.globalAlpha = a
      ctx.strokeStyle = f.color
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx!, f.ty!); ctx.stroke()
      ctx.globalAlpha = 1
    } else if (f.kind === 'pulse') {
      ctx.globalAlpha = a * 0.6
      ctx.strokeStyle = f.color
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(f.x, f.y, (f.r ?? 40) * (1 - a) + 6, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
    } else if (f.kind === 'leak') {
      ctx.globalAlpha = a * 0.7
      ctx.fillStyle = f.color
      ctx.beginPath(); ctx.arc(f.x, f.y, (f.r ?? 20) * (1 + (1 - a)), 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }
  }
}

function placeGhost(ctx: CanvasRenderingContext2D, v: View): void {
  const tile = v.hoverTile!
  const c = tileCenter(tile.cx, tile.cy)
  const def = TOWERS[v.placingType!]
  const range = effRange(def, def.paths.map(() => 0))
  const okColor = v.canPlace ? 'rgba(120,220,120,' : 'rgba(240,110,110,'
  if (def.kind !== 'econ') {
    ctx.fillStyle = okColor + '0.08)'
    ctx.strokeStyle = okColor + '0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(c.x, c.y, range, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  ctx.fillStyle = okColor + '0.5)'
  ctx.fillRect(tile.cx * TILE + 3, tile.cy * TILE + 3, TILE - 6, TILE - 6)
}

// ── tiny canvas helpers ──────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
}

function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
}
