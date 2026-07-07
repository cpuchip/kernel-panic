// Kernel Panic — maps. Each map is a polyline the kernels walk (position =
// f(distance), no pathfinding). The map is part of the game config, so
// state(t) = f(seed + mapId + commands) stays a pure function → deterministic
// MP + replay-verified scores are unaffected by which kitchen you play.
//
// The four "new maps" are Michael's son's hand-drawn designs (2026-07-06):
// Twisty, Corn Meadow, Loop-de-doop, Triangle Chaos. The point arrays capture
// the CHARACTER of each drawing (a tight switchback, a meander with a loop, a
// self-crossing coil, a sharp sawtooth); they're data, easy to re-shape.

import { buildPath, type Path } from './path.ts'
import type { Vec2 } from '../vec.ts'

export interface GameMap {
  id: string
  name: string
  blurb: string
  points: Vec2[]
  path: Path
}

// Paths enter just off one edge and exit just off another (world is 640×640).
// A kernel spawns at dist 0 (the first point) and leaks at path.total (the last).

const CLASSIC: Vec2[] = [
  { x: -24, y: 80 },
  { x: 560, y: 80 },
  { x: 560, y: 240 },
  { x: 80, y: 240 },
  { x: 80, y: 400 },
  { x: 560, y: 400 },
  { x: 560, y: 560 },
  { x: 80, y: 560 },
  { x: 80, y: 664 },
]

// Twisty — a tight switchback staircase, entering left and winding down-right.
const TWISTY: Vec2[] = [
  { x: -24, y: 180 },
  { x: 210, y: 180 },
  { x: 210, y: 90 },
  { x: 410, y: 90 },
  { x: 410, y: 300 },
  { x: 160, y: 300 },
  { x: 160, y: 460 },
  { x: 480, y: 460 },
  { x: 480, y: 600 },
  { x: 300, y: 600 },
  { x: 300, y: 664 },
]

// Corn Meadow — enters top-center, meanders through the field with a small
// rectangular loop, and wanders out the left side.
const CORN_MEADOW: Vec2[] = [
  { x: 330, y: -24 },
  { x: 330, y: 120 },
  { x: 170, y: 120 },
  { x: 170, y: 210 },
  { x: 360, y: 210 },
  { x: 360, y: 330 },
  { x: 500, y: 330 },
  { x: 500, y: 440 },
  { x: 150, y: 440 },
  { x: -24, y: 440 },
]

// Loop-de-doop — a genuine loop-de-loop: the path spears down from the top and
// coils one full descending turn (so the ring overlaps and the line crosses
// itself), then drops out the bottom. Computed purely from sin/cos (no RNG).
function loopDeDoop(): Vec2[] {
  const cx = 320
  const cyStart = 250 // ring center at the top of the coil
  const R = 135
  const drop = 150 // how far the coil sinks over one turn (< 2R → it overlaps)
  const steps = 22
  const pts: Vec2[] = [{ x: 320, y: -24 }, { x: 320, y: cyStart - R }]
  for (let i = 1; i <= steps; i++) {
    const th = -Math.PI / 2 + (i / steps) * Math.PI * 2 // start at top, clockwise
    const cy = cyStart + (i / steps) * drop
    pts.push({ x: cx + R * Math.cos(th), y: cy + R * Math.sin(th) })
  }
  // exit straight down from where the coil ends (top of the sunk ring)
  const endY = cyStart + drop - R
  pts.push({ x: 320, y: Math.max(endY + 40, 520) })
  pts.push({ x: 320, y: 664 })
  return pts
}

// Triangle Chaos — sharp acute switchbacks crisscrossing the board in a
// sawtooth, entering top and tearing out the bottom-left.
const TRIANGLE_CHAOS: Vec2[] = [
  { x: 330, y: -24 },
  { x: 330, y: 90 },
  { x: 120, y: 190 },
  { x: 520, y: 250 },
  { x: 140, y: 330 },
  { x: 500, y: 410 },
  { x: 160, y: 480 },
  { x: 460, y: 550 },
  { x: 120, y: 610 },
  { x: -24, y: 600 },
]

function m(id: string, name: string, blurb: string, points: Vec2[]): GameMap {
  return { id, name, blurb, points, path: buildPath(points) }
}

export const MAPS: Record<string, GameMap> = {
  classic: m('classic', 'Classic Kitchen', 'Four clean straightaways — the original.', CLASSIC),
  twisty: m('twisty', 'Twisty', 'A tight switchback staircase. Lots of corners to catch mobs.', TWISTY),
  meadow: m('meadow', 'Corn Meadow', 'A wandering meadow path with a little loop.', CORN_MEADOW),
  loop: m('loop', 'Loop-de-doop', 'A real loop-de-loop — the path crosses over itself.', loopDeDoop()),
  chaos: m('chaos', 'Triangle Chaos', 'Sharp sawtooth switchbacks. Bring range.', TRIANGLE_CHAOS),
}

export const DEFAULT_MAP = 'classic'
export const MAP_ORDER = ['classic', 'twisty', 'meadow', 'loop', 'chaos'] as const

/** The classic path, kept as a named export for back-compat with the oracle. */
export const PATH: Path = MAPS.classic.path
