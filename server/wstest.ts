// End-to-end co-op network test: two clients join a room over a real WebSocket
// against a running server (npm run serve), the host starts, and we assert the
// co-op contract over the wire — per-player pots, spend-your-own, split earnings,
// and gifting. Usage: start the server, then `npm run wstest`.

import WebSocket from 'ws'
import { newGame, tileBuildable, tileCenter } from '../shared/sim/sim.ts'
import { distToPath } from '../shared/sim/path.ts'
import { PATH } from '../shared/sim/content.ts'
import { TILE, WORLD_H, WORLD_W } from '../shared/sim/types.ts'
import type { ClientMessage, ServerMessage } from '../shared/protocol.ts'
import type { SimState } from '../shared/sim/types.ts'

const URL = process.env.WS_URL || 'ws://localhost:8080/ws'
const ROOM = 'wstest-' + Math.floor(Math.random() * 100000)

let failures = 0
function assert(cond: boolean, msg: string): void {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) failures++
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// buildable tiles nearest the classic path (same idea as the oracle's NEAR)
function nearTiles(n: number): [number, number][] {
  const s = newGame()
  const out: { cx: number; cy: number; d: number }[] = []
  for (let cy = 0; cy < Math.floor(WORLD_H / TILE); cy++)
    for (let cx = 0; cx < Math.floor(WORLD_W / TILE); cx++) {
      if (!tileBuildable(s, cx, cy)) continue
      const c = tileCenter(cx, cy)
      out.push({ cx, cy, d: distToPath(PATH, c.x, c.y) })
    }
  out.sort((a, b) => a.d - b.d)
  return out.slice(0, n).map((t) => [t.cx, t.cy])
}
const NEAR = nearTiles(8)

interface Client {
  ws: WebSocket
  index: number
  isHost: boolean
  snap: SimState | null
  notices: string[]
}
function open(name: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL)
    const c: Client = { ws, index: -1, isHost: false, snap: null, notices: [] }
    const t = setTimeout(() => reject(new Error('open timeout')), 5000)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', name, room: ROOM } as ClientMessage)))
    ws.on('message', (data) => {
      const msg: ServerMessage = JSON.parse(data.toString())
      if (msg.type === 'welcome') {
        c.index = msg.index
        c.isHost = msg.isHost
        clearTimeout(t)
        resolve(c)
      } else if (msg.type === 'snapshot') c.snap = msg.state
      else if (msg.type === 'notice') c.notices.push(msg.text)
    })
    ws.on('error', reject)
  })
}
function sendCmd(c: Client, cmd: ClientMessage): void {
  c.ws.send(JSON.stringify(cmd))
}
const pot = (c: Client, i: number) => c.snap?.players[i]?.butter ?? -1

async function main(): Promise<void> {
  console.log(`connecting to ${URL} room ${ROOM}`)
  const dad = await open('Dad')
  const kid = await open('Kiddo')
  assert(dad.index === 0 && kid.index === 1, 'two players get seats 0 and 1')
  assert(dad.isHost && !kid.isHost, 'first joiner is the host')

  sendCmd(dad, { type: 'start', mapId: 'classic' })
  await sleep(500)
  assert(!!dad.snap && !!kid.snap, 'both clients receive snapshots after start')
  assert(dad.snap!.players.length === 2, 'the shared sim has two pots')
  const start0 = pot(dad, 0)
  const start1 = pot(dad, 1)
  assert(start0 > 0 && start0 === start1, 'both pots start equal and funded')

  // Dad places a Fire Tosser (200) — only Dad's pot pays
  sendCmd(dad, { type: 'cmd', cmd: { t: 'place', tower: 'fire', cx: NEAR[0][0], cy: NEAR[0][1] } })
  await sleep(300)
  assert(pot(dad, 0) === start0 - 200, "placing pays from the placer's pot")
  assert(pot(dad, 1) === start1, "a teammate's pot is untouched by the other's spend")

  // Kiddo places from pot 1
  sendCmd(kid, { type: 'cmd', cmd: { t: 'place', tower: 'fire', cx: NEAR[1][0], cy: NEAR[1][1] } })
  await sleep(300)
  assert(pot(kid, 1) === start1 - 200, 'each seat spends its own pot over the wire')
  assert(dad.snap!.towers.length === 2, 'both placements land on the one shared board')

  // Dad gifts butter to Kiddo
  const d0 = pot(dad, 0)
  const k1 = pot(dad, 1)
  sendCmd(dad, { type: 'cmd', cmd: { t: 'sendButter', to: 1, amount: 100 } })
  await sleep(300)
  assert(pot(dad, 0) === d0 - 100 && pot(dad, 1) === k1 + 100, 'sendButter moves butter between pots over the wire')

  // request nudge broadcasts a notice to teammates
  sendCmd(kid, { type: 'requestButter' })
  await sleep(300)
  assert(dad.notices.some((n) => n.includes('Kiddo')), 'a butter request reaches teammates as a notice')

  // start a round and confirm the shared wave advances + earnings split
  const before0 = pot(dad, 0)
  const before1 = pot(dad, 1)
  sendCmd(dad, { type: 'cmd', cmd: { t: 'startRound' } })
  let ran = false
  for (let i = 0; i < 30; i++) {
    await sleep(400)
    if (dad.snap!.phase === 'round' || dad.snap!.popped > 0) ran = true
    if (dad.snap!.round >= 1) break
  }
  assert(ran, 'the shared round runs on the server')
  // after some pops both pots should have grown (split earnings), staying close
  const grew = pot(dad, 0) >= before0 && pot(dad, 1) >= before1 && (pot(dad, 0) > before0 || pot(dad, 1) > before1)
  assert(grew, 'pop/round earnings credit both pots (split)')

  dad.ws.close()
  kid.ws.close()
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} assertion(s) failed`)
      process.exit(1)
    }
    console.log('\nall co-op network assertions passed ✓')
    process.exit(0)
  })
  .catch((e) => {
    console.error('wstest error:', e)
    process.exit(1)
  })
