// Polyline path — the spine of the sim. Kernels are a distance `d` along the
// path; position = pointAt(d). No pathfinding, fully deterministic, trivially
// serializable. This is what makes the whole game a pure function of time.

import { pointSegDist, type Vec2 } from '../vec.ts'

export interface Path {
  points: Vec2[]
  segLen: number[] // length of each segment
  total: number
}

export function buildPath(points: Vec2[]): Path {
  const segLen: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    const l = Math.sqrt(dx * dx + dy * dy)
    segLen.push(l)
    total += l
  }
  return { points, segLen, total }
}

/** World position at distance d along the path (clamped to [0, total]). */
export function pointAt(path: Path, d: number): Vec2 {
  if (d <= 0) return { ...path.points[0] }
  if (d >= path.total) return { ...path.points[path.points.length - 1] }
  let acc = 0
  for (let i = 0; i < path.segLen.length; i++) {
    const l = path.segLen[i]
    if (acc + l >= d) {
      const t = (d - acc) / l
      const a = path.points[i]
      const b = path.points[i + 1]
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    acc += l
  }
  return { ...path.points[path.points.length - 1] }
}

/** Shortest distance from a world point to the path (for buildable checks). */
export function distToPath(path: Path, px: number, py: number): number {
  let best = Infinity
  for (let i = 0; i < path.points.length - 1; i++) {
    const d = pointSegDist(px, py, path.points[i].x, path.points[i].y, path.points[i + 1].x, path.points[i + 1].y)
    if (d < best) best = d
  }
  return best
}
