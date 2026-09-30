import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { markAudioUnlocked } from '../audioGate.js'

export function FireworksIntro({ copy, recipientName, videoSrc, onNext }) {
  const videoRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const fadeSeconds = reduceMotion ? 0.01 : (copy.fadeMs ?? 800) / 1000
  const buttonLeadMs = copy.buttonLeadMs ?? 2800
  const [phase, setPhase] = useState('boot')
  const [lineIndex, setLineIndex] = useState(-1)
  const [showButton, setShowButton] = useState(false)
  const [muted, setMuted] = useState(true)
  const soundUnlocked = useRef(false)

  const showingCinematic = phase === 'playing' || phase === 'fallback'
  const currentLine = lineIndex >= 0 ? copy.lines[lineIndex] : null
  const videoOn = phase === 'playing' || phase === 'boot' || phase === 'ended'
  const showLines = showingCinematic || phase === 'ended'

  const freezeLastFrame = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    if (Number.isFinite(video.duration) && video.duration > 0) {
      try {
        // Nudge off the absolute end so the browser keeps painting the last frame.
        video.currentTime = Math.max(0, video.duration - 0.05)
      } catch {
        // Ignore seek errors while the element is settling.
      }
    }
  }, [])

  const unlockSound = useCallback(() => {
    if (soundUnlocked.current) return
    const video = videoRef.current
    if (!video || phase !== 'playing') return

    soundUnlocked.current = true
    video.muted = false
    setMuted(false)

    if (video.paused) {
      video.muted = true
      setMuted(true)
      soundUnlocked.current = false
      video.play().catch(() => {})
      return
    }

    const resume = video.play()
    if (resume && typeof resume.then === 'function') {
      resume
        .then(() => {
          markAudioUnlocked()
        })
        .catch(() => {
          video.muted = true
          setMuted(true)
          soundUnlocked.current = false
          video.play().catch(() => {})
        })
    } else {
      markAudioUnlocked()
    }
  }, [phase])

  const finish = useCallback(() => {
    freezeLastFrame()
    setLineIndex(copy.lines.length - 1)
    setShowButton(true)
    setPhase('ended')
  }, [copy.lines.length, freezeLastFrame])

  const skipCinematic = useCallback(() => {
    unlockSound()
    finish()
  }, [finish, unlockSound])

  useEffect(() => {
    const video = videoRef.current
    return () => video?.pause()
  }, [])

  useEffect(() => {
    if (!videoSrc) {
      setPhase('fallback')
      return undefined
    }

    const video = videoRef.current
    if (!video) {
      setPhase('fallback')
      return undefined
    }

    let cancelled = false
    // Stay muted for autoplay policy — sound unlocks on first tap.
    video.muted = true
    video.playsInline = true

    const attempt = video.play()
    if (attempt && typeof attempt.then === 'function') {
      attempt
        .then(() => {
          if (cancelled) return
          setPhase('playing')
        })
        .catch(() => {
          if (cancelled) return
          setPhase('fallback')
        })
    } else {
      setPhase('playing')
    }

    return () => {
      cancelled = true
    }
  }, [videoSrc])

  useEffect(() => {
    if (phase !== 'playing') return undefined

    const onGesture = () => unlockSound()
    window.addEventListener('pointerdown', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture)

    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [phase, unlockSound])

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'fallback') return undefined

    const { lines, startDelayMs, holdMs, gapMs = 0 } = copy
    const timers = lines.map((_, index) => {
      const at = startDelayMs + index * (holdMs + gapMs)
      return window.setTimeout(() => setLineIndex(index), at)
    })

    // Keep the final line on screen through the frozen ending.
    const lastAt = startDelayMs + (lines.length - 1) * (holdMs + gapMs)

    if (phase === 'fallback') {
      const buttonAt = Math.max(0, lastAt + holdMs - buttonLeadMs)
      const endAt = lastAt + holdMs
      timers.push(window.setTimeout(() => setShowButton(true), buttonAt))
      timers.push(window.setTimeout(() => setPhase('ended'), endAt))
    }

    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [phase, copy, buttonLeadMs])

  const onTimeUpdate = useCallback(() => {
    if (phase !== 'playing' || showButton) return
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return
    const leadSec = buttonLeadMs / 1000
    if (video.currentTime >= video.duration - leadSec) {
      setShowButton(true)
    }
  }, [buttonLeadMs, phase, showButton])

  return (
    <article className="scene scene-intro">
      <div className="intro-stage">
        <div className="intro-atmosphere" />
        {videoSrc ? (
          <video
            ref={videoRef}
            className={`intro-video${videoOn ? ' is-on' : ''}`}
            src={videoSrc}
            muted={muted}
            playsInline
            preload="auto"
            autoPlay
            onTimeUpdate={onTimeUpdate}
            onEnded={finish}
            onError={() => {
              setPhase((current) =>
                current === 'playing' || current === 'boot' ? 'fallback' : current,
              )
            }}
          />
        ) : null}
        <div className="intro-scrim" />
      </div>

      <h1 className="scene-title visually-hidden" tabIndex={-1}>
        {recipientName}
      </h1>

      {showingCinematic ? (
        <button type="button" className="intro-skip" onClick={skipCinematic}>
          {copy.skipLabel}
        </button>
      ) : null}

      {showLines ? (
        <div className="intro-overlay" aria-live="polite">
          {phase === 'fallback' && !currentLine ? (
            <p className="intro-fallback">{copy.fallbackMessage}</p>
          ) : null}
          <AnimatePresence mode="wait">
            {currentLine ? (
              <motion.p
                key={currentLine}
                className={`intro-line${phase === 'ended' ? ' is-settled' : ''}`}
                initial={phase === 'ended' ? false : { opacity: 0, y: reduceMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                transition={{ duration: fadeSeconds, ease: [0.22, 1, 0.36, 1] }}
              >
                {currentLine}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      <AnimatePresence>
        {showButton ? (
          <motion.div
            key="intro-continue"
            className="intro-end"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <button
              type="button"
              className="cta cta-primary"
              onClick={() => {
                unlockSound()
                onNext()
              }}
            >
              {copy.keepGoingLabel}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  )
}
