// Wire protocol between the Kernel Panic client and the co-op server.

import type { Command, SimState } from './sim/types.ts'

export interface LobbyPlayer {
  index: number
  name: string
  color: string
  online: boolean
}

export type ClientMessage =
  | { type: 'join'; room: string; name: string }
  | { type: 'start'; mapId?: string } // host only
  | { type: 'cmd'; cmd: Command } // the server stamps the sender's seat onto cmd.player
  | { type: 'requestButter' } // ask teammates for butter (a nudge, not a state change)
  | { type: 'ping' }

export type ServerMessage =
  | { type: 'welcome'; index: number; room: string; isHost: boolean; you: string }
  | { type: 'lobby'; room: string; players: LobbyPlayer[]; isHost: boolean; mapId: string; started: boolean }
  | { type: 'snapshot'; state: SimState; players: LobbyPlayer[] }
  | { type: 'notice'; text: string } // toast: a gift arrived, a teammate needs butter, etc.
  | { type: 'error'; message: string }
  | { type: 'pong' }
