// Multiplayer knobs shared by the server and the client.

export const SIM_HZ = 30 // server-authoritative tick rate (matches TPS)
export const SNAPSHOT_HZ = 20 // how often the server pushes state to clients
export const MAX_PLAYERS = 4 // co-op seats per room (the economy split handles any N)

// per-seat accent colours (butter-orange host, then freeze-cyan, corn-green, berry)
export const PLAYER_COLORS = ['#ff8a4c', '#5ad1e8', '#a6e05a', '#e05ac8']

/** Deterministic seed from a room code — same room code → same wave sequence. */
export function seedFromCode(code: string): number {
  let h = 2166136261
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 0x7fffffff || 1
}
