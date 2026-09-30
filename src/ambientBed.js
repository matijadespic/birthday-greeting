/** App-wide ambient bed (Septembar) — plays under early scenes until the bar bridge. */

import { isAudioUnlocked, onAudioUnlocked } from './audioGate.js'

let bed = null
let src = ''
let targetVolume = 1
let stopped = false
let fadeRaf = 0

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function ensureElement() {
  if (bed || !src) return bed
  bed = new Audio(src)
  bed.preload = 'auto'
  bed.loop = true
  bed.volume = 0
  return bed
}

function cancelFade() {
  if (fadeRaf) {
    window.cancelAnimationFrame(fadeRaf)
    fadeRaf = 0
  }
}

function fadeTo(nextVolume, durationMs, onDone) {
  const audio = ensureElement()
  if (!audio) {
    onDone?.()
    return
  }

  cancelFade()
  const from = audio.volume
  const to = clamp(nextVolume, 0, 1)
  const duration = Math.max(durationMs, 1)
  const startedAt = performance.now()

  const step = (now) => {
    const t = clamp((now - startedAt) / duration, 0, 1)
    const eased = 1 - (1 - t) ** 2
    audio.volume = from + (to - from) * eased
    if (t < 1) {
      fadeRaf = window.requestAnimationFrame(step)
      return
    }
    fadeRaf = 0
    audio.volume = to
    onDone?.()
  }

  fadeRaf = window.requestAnimationFrame(step)
}

export function initAmbientBed(musicSrc) {
  src = musicSrc || ''
  stopped = false
  if (!src) return
  ensureElement()
}

export function ensureAmbientPlaying() {
  if (stopped || !isAudioUnlocked()) return
  const audio = ensureElement()
  if (!audio) return

  if (audio.paused) {
    const attempt = audio.play()
    if (attempt && typeof attempt.then === 'function') {
      attempt.catch(() => {})
    }
  }

  fadeTo(targetVolume, 700)
}

export function setAmbientVolume(volume, fadeMs = 900) {
  if (stopped) return
  targetVolume = clamp(volume, 0, 1)
  if (!isAudioUnlocked()) return
  ensureAmbientPlaying()
  fadeTo(targetVolume, fadeMs)
}

export function stopAmbient(fadeMs = 1400) {
  stopped = true
  const audio = bed
  if (!audio) return

  fadeTo(0, fadeMs, () => {
    audio.pause()
    try {
      audio.currentTime = 0
    } catch {
      // Ignore seek errors.
    }
  })
}

/** Resume bed after stop (back-nav, or closing credits). */
export function resumeAmbient(volume = 1, fadeMs = 900, { fromStart = false } = {}) {
  stopped = false
  targetVolume = clamp(volume, 0, 1)
  const audio = ensureElement()
  if (fromStart && audio) {
    try {
      audio.currentTime = 0
    } catch {
      // Ignore seek errors.
    }
  }
  if (!isAudioUnlocked()) return
  if (audio && audio.paused) {
    const attempt = audio.play()
    if (attempt && typeof attempt.then === 'function') {
      attempt.catch(() => {})
    }
  }
  fadeTo(targetVolume, fadeMs)
}

export function bindAmbientToUnlock() {
  return onAudioUnlocked(() => {
    if (!stopped) ensureAmbientPlaying()
  })
}
