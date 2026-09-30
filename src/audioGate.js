/** Shared gate: only play optional SFX after the greeting has unmuted audio once. */

let audioUnlocked = false
const unlockListeners = new Set()

export function markAudioUnlocked() {
  if (audioUnlocked) return
  audioUnlocked = true
  unlockListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Ignore listener errors so one bad subscriber cannot block others.
    }
  })
}

export function isAudioUnlocked() {
  return audioUnlocked
}

export function onAudioUnlocked(listener) {
  unlockListeners.add(listener)
  if (audioUnlocked) {
    try {
      listener()
    } catch {
      // Ignore.
    }
  }
  return () => unlockListeners.delete(listener)
}

/** Soft glass-clink via Web Audio — no media file required. */
export function playGlassClink() {
  if (!audioUnlocked) return

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return

  const ctx = new AudioCtx()
  const now = ctx.currentTime

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(0.22, now + 0.01)
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
  master.connect(ctx.destination)

  const ring = ctx.createOscillator()
  ring.type = 'sine'
  ring.frequency.setValueAtTime(2100, now)
  ring.frequency.exponentialRampToValueAtTime(1400, now + 0.28)
  ring.connect(master)
  ring.start(now)
  ring.stop(now + 0.3)

  const tick = ctx.createOscillator()
  tick.type = 'triangle'
  tick.frequency.setValueAtTime(3200, now)
  tick.frequency.exponentialRampToValueAtTime(900, now + 0.12)
  const tickGain = ctx.createGain()
  tickGain.gain.setValueAtTime(0.12, now)
  tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  tick.connect(tickGain)
  tickGain.connect(ctx.destination)
  tick.start(now)
  tick.stop(now + 0.14)

  window.setTimeout(() => {
    ctx.close().catch(() => {})
  }, 500)
}
