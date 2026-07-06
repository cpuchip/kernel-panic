// Sound — WebAudio SFX generated on the local asset-harness. The mute flag lives
// in settings.svelte.ts (shared with the settings gear). Loads whatever exists
// under /assets/sfx and silently no-ops for anything missing, so call sites never
// need to change as the set grows.

import { settings } from './settings.svelte.ts'

export type SfxName =
  | 'pop' | 'bosspop' | 'laser' | 'microwave' | 'fire' | 'leak'
  | 'roundclear' | 'bossin' | 'place' | 'sell' | 'start'

const GAIN: Record<SfxName, number> = {
  pop: 0.4, bosspop: 0.6, laser: 0.3, microwave: 0.35, fire: 0.22, leak: 0.5,
  roundclear: 0.5, bossin: 0.6, place: 0.4, sell: 0.4, start: 0.4,
}

let ctx: AudioContext | null = null
const buffers = new Map<SfxName, AudioBuffer>()
let loaded = false

async function loadAll(): Promise<void> {
  if (loaded || ctx === null) return
  loaded = true
  await Promise.all(
    (Object.keys(GAIN) as SfxName[]).map(async (name) => {
      try {
        const res = await fetch(`/assets/sfx/${name}.ogg`)
        if (!res.ok) return
        buffers.set(name, await ctx!.decodeAudioData(await res.arrayBuffer()))
      } catch {
        /* not present yet (Phase 1) — silent */
      }
    }),
  )
}

export function playSfx(name: SfxName): void {
  if (!settings.sfx || ctx === null || ctx.state !== 'running') return
  const buf = buffers.get(name)
  if (!buf) return
  const src = ctx.createBufferSource()
  src.buffer = buf
  const g = ctx.createGain()
  g.gain.value = GAIN[name]
  src.connect(g).connect(ctx.destination)
  src.start()
}

export function unlock(): void {
  if (ctx === null) {
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
    void loadAll()
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

export function initSound(): void {
  const once = () => {
    unlock()
    window.removeEventListener('pointerdown', once)
    window.removeEventListener('keydown', once)
  }
  window.addEventListener('pointerdown', once)
  window.addEventListener('keydown', once)
}
