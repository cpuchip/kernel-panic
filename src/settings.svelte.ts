// Player settings — persisted per browser. Sound effects + auto-start-next-round.

export const settings = $state({
  sfx: loadPref('kp-sfx', true),
  autoStart: loadPref('kp-autostart', false),
})

function loadPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function save(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* private browsing */
  }
}

export function setSfx(on: boolean): void {
  settings.sfx = on
  save('kp-sfx', on)
}

export function setAutoStart(on: boolean): void {
  settings.autoStart = on
  save('kp-autostart', on)
}
