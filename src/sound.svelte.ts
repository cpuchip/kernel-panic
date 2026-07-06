// Sound — Phase 0 plumbing. The renderer/controller emit playSfx(...) at every
// game moment; Phase 1 fills /assets/sfx/<name>.ogg (generated on the local
// asset-harness) + a settings toggle. Until then this loads whatever exists and
// silently no-ops for the rest, so the call sites never need to change.

export const audio = $state({ sfx: loadPref('kp-sfx', true) })

function loadPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

export function setSfx(on: boolean): void {
  audio.sfx = on
  try {
    localStorage.setItem('kp-sfx', on ? '1' : '0')
  } catch {
    /* private browsing */
  }
  if (on) unlock()
}

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
  if (!audio.sfx || ctx === null || ctx.state !== 'running') return
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
