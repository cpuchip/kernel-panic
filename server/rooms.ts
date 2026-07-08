// Co-op room registry. Each room owns ONE authoritative SimState; clients send
// commands (the server stamps the sender's seat), the server ticks the sim and
// broadcasts snapshots. Because the sim is a pure function of (seed + commands),
// this is all the multiplayer that's needed — no per-entity reconciliation.

import { WebSocket } from 'ws'
import { MAPS, DEFAULT_MAP } from '../shared/sim/maps.ts'
import { apply, newGame, RuleError, tick } from '../shared/sim/sim.ts'
import type { Command, SimState } from '../shared/sim/types.ts'
import { MAX_PLAYERS, PLAYER_COLORS, seedFromCode } from '../shared/mpConfig.ts'
import type { ClientMessage, LobbyPlayer, ServerMessage } from '../shared/protocol.ts'
import { mulberry32, type Rng } from '../shared/rng.ts'

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

interface Seat {
  name: string
  color: string
  online: boolean
}

export class Room {
  readonly code: string
  readonly seed: number
  mapId = DEFAULT_MAP
  started = false
  sim: SimState | null = null
  private rng: Rng
  private seats: Seat[] = [] // index = player index; index 0 is the host
  private members = new Map<WebSocket, number>() // ws -> seat index
  private emptyAt: number | null = null

  constructor(code: string) {
    this.code = code
    this.seed = seedFromCode(code)
    this.rng = mulberry32(this.seed)
  }

  get empty(): boolean {
    return this.members.size === 0
  }
  emptyForMs(now: number): number {
    return this.emptyAt === null ? 0 : now - this.emptyAt
  }

  handle(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join': return this.join(ws, msg.name)
      case 'start': return this.start(ws, msg.mapId)
      case 'cmd': return this.command(ws, msg.cmd)
      case 'requestButter': return this.requestButter(ws)
      case 'ping': return send(ws, { type: 'pong' })
    }
  }

  private online(i: number): boolean {
    for (const idx of this.members.values()) if (idx === i) return true
    return false
  }

  private join(ws: WebSocket, rawName: string): void {
    const name = (rawName || '').trim().slice(0, 16) || 'Player'

    // reconnect: reclaim an offline seat of the same name (refresh / dropped phone)
    const reI = this.seats.findIndex((s, i) => s.name === name && !this.online(i))
    if (reI >= 0) {
      this.members.set(ws, reI)
      this.emptyAt = null
      this.welcome(ws, reI)
      this.broadcastLobby()
      return
    }
    if (this.started) {
      send(ws, { type: 'error', message: 'That game already started. Try another room code.' })
      return
    }
    if (this.seats.length >= MAX_PLAYERS) {
      send(ws, { type: 'error', message: 'This room is full.' })
      return
    }
    if (this.seats.some((s, i) => s.name === name && this.online(i))) {
      send(ws, { type: 'error', message: `"${name}" is already here. Pick another name.` })
      return
    }
    const index = this.seats.length
    this.seats.push({ name, color: PLAYER_COLORS[index % PLAYER_COLORS.length], online: true })
    this.members.set(ws, index)
    this.emptyAt = null
    this.welcome(ws, index)
    this.broadcastLobby()
  }

  private start(ws: WebSocket, mapId?: string): void {
    const idx = this.members.get(ws)
    if (idx === undefined) return
    if (idx !== 0) {
      send(ws, { type: 'error', message: 'Only the host can start the game.' })
      return
    }
    if (this.started) return
    this.mapId = MAPS[mapId ?? ''] ? mapId! : DEFAULT_MAP
    this.sim = newGame(this.seed, this.mapId, Math.max(1, this.seats.length))
    this.started = true
    this.broadcastLobby() // flips clients to the board once snapshots start flowing
  }

  private command(ws: WebSocket, cmd: Command): void {
    const idx = this.members.get(ws)
    if (idx === undefined || !this.sim) return
    // the server owns the seat mapping — never trust a client-supplied player field
    const stamped = { ...cmd, player: idx } as Command
    try {
      apply(this.sim, stamped, this.rng)
    } catch (e) {
      if (e instanceof RuleError) send(ws, { type: 'error', message: e.message })
    }
  }

  private requestButter(ws: WebSocket): void {
    const idx = this.members.get(ws)
    if (idx === undefined) return
    const name = this.seats[idx]?.name ?? 'A teammate'
    this.broadcast({ type: 'notice', text: `${name} needs butter! 🧈` })
  }

  private welcome(ws: WebSocket, index: number): void {
    send(ws, { type: 'welcome', index, room: this.code, isHost: index === 0, you: this.seats[index].name })
  }

  private lobbyPlayers(): LobbyPlayer[] {
    return this.seats.map((s, i) => ({ index: i, name: s.name, color: s.color, online: this.online(i) }))
  }

  private broadcast(msg: ServerMessage): void {
    const payload = JSON.stringify(msg)
    for (const ws of this.members.keys()) if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  }

  private broadcastLobby(): void {
    const players = this.lobbyPlayers()
    for (const [ws, idx] of this.members) {
      send(ws, { type: 'lobby', room: this.code, players, isHost: idx === 0, mapId: this.mapId, started: this.started })
    }
  }

  /** advance the authoritative sim one tick (called by the server loop). */
  tickSim(): void {
    if (this.started && this.sim) tick(this.sim, this.rng)
  }

  broadcastSnapshot(): void {
    if (!this.started || !this.sim || this.members.size === 0) return
    this.broadcast({ type: 'snapshot', state: this.sim, players: this.lobbyPlayers() })
  }

  handleClose(ws: WebSocket): void {
    if (!this.members.has(ws)) return
    this.members.delete(ws)
    if (this.members.size === 0) this.emptyAt = Date.now()
    this.broadcastLobby()
  }
}

export class RoomRegistry {
  private rooms = new Map<string, Room>()
  private socketRoom = new Map<WebSocket, Room>()

  route(ws: WebSocket, raw: string): void {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (msg.type === 'join') {
      const room = this.getOrCreate(normalizeRoom(msg.room))
      this.socketRoom.set(ws, room)
      room.handle(ws, msg)
      return
    }
    const room = this.socketRoom.get(ws)
    if (room) room.handle(ws, msg)
  }

  close(ws: WebSocket): void {
    const room = this.socketRoom.get(ws)
    if (!room) return
    room.handleClose(ws)
    this.socketRoom.delete(ws)
    if (room.empty && !room.started) this.rooms.delete(room.code)
  }

  /** drop rooms empty (abandoned) longer than ttlMs so idle sims don't tick forever. */
  sweep(now: number, ttlMs: number): void {
    for (const room of [...this.rooms.values()]) {
      if (room.empty && room.emptyForMs(now) > ttlMs) this.rooms.delete(room.code)
    }
  }

  all(): Room[] {
    return [...this.rooms.values()]
  }

  private getOrCreate(code: string): Room {
    let room = this.rooms.get(code)
    if (!room) {
      room = new Room(code)
      this.rooms.set(code, room)
    }
    return room
  }
}

function normalizeRoom(code: string): string {
  const c = (code || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
  return c.slice(0, 24) || 'popcorn'
}
