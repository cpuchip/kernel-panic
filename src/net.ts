// Thin WebSocket client for co-op. Connects to the same-origin /ws, joins a room,
// relays commands, and hands snapshots/lobby/notices back through callbacks. The
// server is authoritative — this never runs the sim, it just renders what arrives.

import type { ClientMessage, LobbyPlayer, ServerMessage } from '../shared/protocol.ts'
import type { Command, SimState } from '../shared/sim/types.ts'

export interface NetHandlers {
  onWelcome(index: number, isHost: boolean, room: string): void
  onLobby(players: LobbyPlayer[], isHost: boolean, mapId: string, started: boolean): void
  onSnapshot(state: SimState, players: LobbyPlayer[]): void
  onNotice(text: string): void
  onError(message: string): void
  onClose(): void
}

let ws: WebSocket | null = null

function url(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

function sendMsg(msg: ClientMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

export function connect(room: string, name: string, h: NetHandlers): void {
  disconnect()
  ws = new WebSocket(url())
  ws.onopen = () => sendMsg({ type: 'join', room, name })
  ws.onmessage = (ev) => {
    let msg: ServerMessage
    try {
      msg = JSON.parse(ev.data as string)
    } catch {
      return
    }
    switch (msg.type) {
      case 'welcome': h.onWelcome(msg.index, msg.isHost, msg.room); break
      case 'lobby': h.onLobby(msg.players, msg.isHost, msg.mapId, msg.started); break
      case 'snapshot': h.onSnapshot(msg.state, msg.players); break
      case 'notice': h.onNotice(msg.text); break
      case 'error': h.onError(msg.message); break
    }
  }
  ws.onclose = () => h.onClose()
  ws.onerror = () => h.onError('Lost the connection.')
}

export function isConnected(): boolean {
  return !!ws && ws.readyState === WebSocket.OPEN
}
export function startGame(mapId: string): void {
  sendMsg({ type: 'start', mapId })
}
export function sendCmd(cmd: Command): void {
  sendMsg({ type: 'cmd', cmd })
}
export function askForButter(): void {
  sendMsg({ type: 'requestButter' })
}
export function disconnect(): void {
  if (ws) {
    ws.onclose = null // don't fire onClose on an intentional teardown
    try {
      ws.close()
    } catch {
      /* already closed */
    }
    ws = null
  }
}
