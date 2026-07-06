// Sound — WebAudio SFX generated on the local asset-harness. The mute flag lives
// in settings.svelte.ts (shared with the settings gear). Loads whatever exists
// under /assets/sfx and silently no-ops for anything missing.
//
// Mobile autoplay is finicky: a suspended AudioContext produces no sound even
// with buffers loaded. So we (1) keep retrying unlock on EVERY gesture until the
// context actually reaches 'running' (a single first-gesture unlock can silently
// fail to stick on mobile Chrome), and (2) self-heal inside playSfx by resuming a
// suspended context. Gains are set to be clearly audible on a phone speaker.

import { settings } from './settings.svelte.ts'

export type SfxName =
  | 'pop' | 'bosspop' | 'laser' | 'microwave' | 'fire' | 'leak'
  | 'roundclear' | 'bossin' | 'place' | 'sell' | 'start'

const GAIN: Record<SfxName, number> = {
  pop: 0.6, bosspop: 0.8, laser: 0.45, microwave: 0.5, fire: 0.32, leak: 0.65,
  roundclear: 0.65, bossin: 0.75, place: 0.5, sell: 0.5, start: 0.55,
}

let ctx: AudioContext | null = null
const buffers = new Map<SfxName, AudioBuffer>()
let loading = false

async function loadAll(): Promise<void> {
  if (loading || ctx === null) return
  loading = true
  await Promise.all(
    (Object.keys(GAIN) as SfxName[]).map(async (name) => {
      try {
        const res = await fetch(`/assets/sfx/${name}.ogg`)
        if (!res.ok) return
        buffers.set(name, await ctx!.decodeAudioData(await res.arrayBuffer()))
      } catch {
        /* missing/undecodable — silent */
      }
    }),
  )
}

export function playSfx(name: SfxName): void {
  if (!settings.sfx) return
  const c = ctx
  if (c === null) return
  if (c.state === 'suspended') void c.resume() // self-heal a context that dozed off
  if (c.state !== 'running') return
  const buf = buffers.get(name)
  if (!buf) return
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = GAIN[name]
  src.connect(g).connect(c.destination)
  src.start()
}

/** Create/resume the AudioContext. Safe to call repeatedly (idempotent). */
export function unlock(): void {
  if (ctx === null) {
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
    void loadAll()
  }
  if (ctx.state !== 'running') void ctx.resume()
}

export function initSound(): void {
  // Retry on every gesture (don't detach after the first) — the first unlock can
  // silently fail to stick on mobile, and a later tap should then take.
  const kinds: (keyof WindowEventMap)[] = ['pointerdown', 'touchend', 'click', 'keydown']
  for (const k of kinds) window.addEventListener(k, unlock, { passive: true })
  // resume when returning to the tab (mobile suspends the context on background)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) unlock()
  })
}
