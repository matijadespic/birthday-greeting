import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { isAudioUnlocked, markAudioUnlocked } from '../audioGate.js'
import { resumeAmbient } from '../ambientBed.js'
import { content } from '../content.js'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function SingAndDance({ copy, onNext }) {
  const reduceMotion = useReducedMotion()
  const fadeSeconds = reduceMotion ? 0.01 : (copy.fadeMs ?? 700) / 1000
  const buttonLeadMs = copy.buttonLeadMs ?? 2600
  const musicFadeMs = copy.musicFadeMs ?? 4500
  const videoSrc = copy.videoSrc || ''
  const musicSrc = copy.musicSrc || ''
  const isFinale = typeof onNext !== 'function'

  const videoRef = useRef(null)
  const musicRef = useRef(null)
  const musicReadyRef = useRef(false)
  const musicStartedRef = useRef(false)

  const [phase, setPhase] = useState(videoSrc ? 'boot' : 'ended')
  const [lineIndex, setLineIndex] = useState(-1)
  const [showButton, setShowButton] = useState(false)
  const [muted, setMuted] = useState(true)
  const [typedClosing, setTypedClosing] = useState('')

  const currentLine = lineIndex >= 0 ? copy.lines[lineIndex] : null
  const videoOn = phase === 'boot' || phase === 'playing' || phase === 'ended'
  const showClosing = phase === 'closing'
  const closingMessage = copy.closingMessage || ''

  const stopMusic = useCallback(() => {
    const music = musicRef.current
    if (!music) return
    music.pause()
    try {
      music.currentTime = 0
    } catch {
      // Ignore seek errors.
    }
  }, [])

  const freezeLastFrame = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    if (Number.isFinite(video.duration) && video.duration > 0) {
      try {
        video.currentTime = Math.max(0, video.duration - 0.05)
      } catch {
        // Ignore seek errors while the element is settling.
      }
    }
  }, [])

  const finish = useCallback(() => {
    stopMusic()
    const video = videoRef.current
    video?.pause()

    if (isFinale && closingMessage) {
      setLineIndex(-1)
      setShowButton(false)
      setTypedClosing('')
      setPhase('closing')
      return
    }

    freezeLastFrame()
    setLineIndex(copy.lines.length - 1)
    if (!isFinale) setShowButton(true)
    setPhase('ended')
  }, [closingMessage, copy.lines.length, freezeLastFrame, isFinale, stopMusic])

  useEffect(() => {
    if (phase !== 'closing' || !closingMessage) return undefined

    resumeAmbient(content.ambient?.creditsVolume ?? 0.8, 1200, { fromStart: true })

    const delayMs = copy.closingDelayMs ?? 700
    const charMs = reduceMotion ? 0 : (copy.typeCharMs ?? 55)
    let cancelled = false
    let intervalId = 0

    const startId = window.setTimeout(() => {
      if (cancelled) return
      if (charMs <= 0) {
        setTypedClosing(closingMessage)
        return
      }

      let i = 0
      intervalId = window.setInterval(() => {
        i += 1
        setTypedClosing(closingMessage.slice(0, i))
        if (i >= closingMessage.length) {
          window.clearInterval(intervalId)
        }
      }, charMs)
    }, delayMs)

    return () => {
      cancelled = true
      window.clearTimeout(startId)
      window.clearInterval(intervalId)
    }
  }, [closingMessage, copy.closingDelayMs, copy.typeCharMs, phase, reduceMotion])

  const startMusic = useCallback(() => {
    const music = musicRef.current
    if (!music || !musicSrc || musicStartedRef.current) return
    if (!musicReadyRef.current && music.readyState < 2) return

    musicStartedRef.current = true
    music.volume = 1
    try {
      music.currentTime = 0
    } catch {
      // Ignore seek errors.
    }

    const attempt = music.play()
    if (attempt && typeof attempt.then === 'function') {
      attempt.catch(() => {
        musicStartedRef.current = false
      })
    }
  }, [musicSrc])

  const applyMusicVideoMix = useCallback(
    (video) => {
      const music = musicRef.current
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return

      const fadeSec = Math.max(musicFadeMs / 1000, 0.05)
      const remaining = video.duration - video.currentTime
      const inFade = remaining <= fadeSec
      const musicGain = inFade ? clamp(remaining / fadeSec, 0, 1) : 1
      const clipGain = inFade ? clamp(1 - remaining / fadeSec, 0, 1) : 0

      if (music && musicStartedRef.current) {
        music.volume = musicGain
      }

      // Keep the clip silent under the song, then rise as the song fades out.
      if (phase !== 'ended') {
        if (clipGain <= 0.02) {
          video.muted = true
          video.volume = 0
          setMuted(true)
        } else {
          video.muted = false
          video.volume = clipGain
          setMuted(false)
          markAudioUnlocked()
        }
      }
    },
    [musicFadeMs, phase],
  )

  const tryUnmute = useCallback(() => {
    const video = videoRef.current
    if (!video || phase === 'ended') return

    markAudioUnlocked()
    startMusic()

    // If the song is already covering the middle of the clip, leave the video
    // muted until the end fade; otherwise unlock clip audio normally.
    const music = musicRef.current
    const songActive = Boolean(music && musicStartedRef.current && !music.paused && music.volume > 0.05)
    if (songActive) {
      applyMusicVideoMix(video)
      return
    }

    video.muted = false
    video.volume = 1
    setMuted(false)

    if (video.paused) {
      video.muted = true
      setMuted(true)
      video.play().catch(() => {})
      return
    }

    const resume = video.play()
    if (resume && typeof resume.then === 'function') {
      resume.catch(() => {
        video.muted = true
        setMuted(true)
        video.play().catch(() => {})
      })
    }
  }, [applyMusicVideoMix, phase, startMusic])

  useEffect(() => {
    const video = videoRef.current
    const music = musicRef.current
    return () => {
      video?.pause()
      music?.pause()
    }
  }, [])

  useEffect(() => {
    musicReadyRef.current = false
    musicStartedRef.current = false
    const music = musicRef.current
    if (!music || !musicSrc) return undefined

    const onReady = () => {
      musicReadyRef.current = true
      if (phase === 'playing' && isAudioUnlocked()) {
        startMusic()
      }
    }

    music.addEventListener('canplaythrough', onReady)
    music.addEventListener('loadeddata', onReady)
    if (music.readyState >= 2) onReady()

    return () => {
      music.removeEventListener('canplaythrough', onReady)
      music.removeEventListener('loadeddata', onReady)
    }
  }, [musicSrc, phase, startMusic])

  useEffect(() => {
    if (!videoSrc) {
      if (isFinale && closingMessage) {
        setPhase('closing')
      } else {
        setPhase('ended')
        setShowButton(true)
      }
      return undefined
    }

    const video = videoRef.current
    if (!video) {
      if (isFinale && closingMessage) {
        setPhase('closing')
      } else {
        setPhase('ended')
        setShowButton(true)
      }
      return undefined
    }

    let cancelled = false

    const startPlayback = () => {
      if (cancelled) return
      // Stay muted for autoplay policy — first tap can unlock sound.
      video.muted = true
      video.volume = 0
      setMuted(true)
      video.playsInline = true

      const attempt = video.play()
      if (attempt && typeof attempt.then === 'function') {
        attempt
          .then(() => {
            if (cancelled) return
            setPhase('playing')
            if (isAudioUnlocked()) {
              startMusic()
            }
          })
          .catch(() => {
            if (cancelled) return
            // One more muted attempt after metadata settles.
            video.muted = true
            setMuted(true)
            video
              .play()
              .then(() => {
                if (!cancelled) setPhase('playing')
              })
              .catch(() => {
                if (!cancelled) setPhase('playing')
              })
          })
      } else {
        setPhase('playing')
      }
    }

    if (video.readyState >= 2) {
      startPlayback()
    } else {
      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay)
        startPlayback()
      }
      video.addEventListener('canplay', onCanPlay)
      video.load()
      return () => {
        cancelled = true
        video.removeEventListener('canplay', onCanPlay)
      }
    }

    return () => {
      cancelled = true
    }
  }, [startMusic, videoSrc])

  useEffect(() => {
    if (phase !== 'playing') return undefined

    const { lines, startDelayMs, holdMs, gapMs = 0 } = copy
    const timers = lines.map((_, index) => {
      const at = startDelayMs + index * (holdMs + gapMs)
      return window.setTimeout(() => setLineIndex(index), at)
    })

    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [phase, copy])

  useEffect(() => {
    if (phase !== 'playing') return undefined

    const onGesture = () => tryUnmute()
    window.addEventListener('pointerdown', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [phase, tryUnmute])

  const onTimeUpdate = useCallback(() => {
    if (phase !== 'playing') return
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return

    if (isAudioUnlocked() || musicStartedRef.current) {
      startMusic()
      applyMusicVideoMix(video)
    }

    if (!isFinale && !showButton && video.currentTime >= video.duration - buttonLeadMs / 1000) {
      setShowButton(true)
    }
  }, [applyMusicVideoMix, buttonLeadMs, isFinale, phase, showButton, startMusic])

  return (
    <article className={`scene scene-sing${showClosing ? ' is-closing' : ''}`}>
      <div className="sing-atmosphere" aria-hidden="true" />

      {musicSrc ? (
        <audio
          ref={musicRef}
          src={musicSrc}
          preload="auto"
          playsInline
          aria-hidden="true"
        />
      ) : null}

      {!showClosing ? (
        <div className="sing-cinematic" aria-hidden={!videoSrc}>
          {videoSrc ? (
            <video
              ref={videoRef}
              className={`sing-cinematic-video${videoOn ? ' is-on' : ''}`}
              src={videoSrc}
              muted={muted}
              playsInline
              preload="auto"
              autoPlay
              onTimeUpdate={onTimeUpdate}
              onEnded={finish}
              onError={() => {
                setPhase('playing')
                if (!isFinale) setShowButton(true)
              }}
            />
          ) : (
            <div
              className="media-placeholder sing-cinematic-fallback"
              role="img"
              aria-label={copy.placeholderLabel}
            >
              <span className="media-placeholder-kind">Video</span>
              <span className="media-placeholder-label">{copy.placeholderLabel}</span>
            </div>
          )}
          <div className="sing-cinematic-scrim" />
        </div>
      ) : null}

      <h1 className="scene-title visually-hidden" tabIndex={-1}>
        {closingMessage || copy.lines[0]}
      </h1>

      {!showClosing ? (
        <div className="sing-overlay" aria-live="polite">
          <AnimatePresence mode="wait">
            {currentLine ? (
              <motion.p
                key={currentLine}
                className="sing-line"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -14 }}
                transition={{ duration: fadeSeconds, ease: [0.22, 1, 0.36, 1] }}
              >
                {currentLine}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      <AnimatePresence>
        {!isFinale && showButton ? (
          <motion.div
            key="sing-continue"
            className="sing-end"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <button
              type="button"
              className="cta cta-primary"
              onClick={() => {
                tryUnmute()
                onNext()
              }}
            >
              {copy.keepGoingLabel}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showClosing ? (
          <motion.div
            key="sing-closing"
            className="sing-closing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.55 }}
          >
            <p className="sing-closing-text" aria-live="polite">
              {typedClosing}
              <span
                className={`sing-closing-caret${typedClosing.length >= closingMessage.length ? ' is-done' : ''}`}
                aria-hidden="true"
              />
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  )
}
