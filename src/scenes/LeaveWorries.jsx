import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function LeaveWorries({ copy, media, onNext }) {
  const reduceMotion = useReducedMotion()
  const fadeSeconds = reduceMotion ? 0.01 : (copy.fadeMs ?? 700) / 1000
  const completeAt = copy.completeAt ?? 0.92

  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const draggingRef = useRef(false)
  const progressRef = useRef(0)
  const releasedRef = useRef(false)
  const durationRef = useRef(0)

  const [lineIndex, setLineIndex] = useState(-1)
  const [linesDone, setLinesDone] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [released, setReleased] = useState(false)
  const [cloudGone, setCloudGone] = useState(false)

  const currentLine = lineIndex >= 0 && !linesDone ? copy.lines[lineIndex] : null
  const showSlider = linesDone && !released
  const showReveal = released

  const scrubVideo = useCallback((nextProgress) => {
    const video = videoRef.current
    const duration = durationRef.current
    if (!video || !duration || !Number.isFinite(duration)) return
    const time = clamp(nextProgress, 0, 1) * duration
    if (Math.abs(video.currentTime - time) > 0.02) {
      try {
        video.currentTime = time
      } catch {
        // Ignore seek errors while metadata is still settling.
      }
    }
  }, [])

  const updateProgress = useCallback(
    (next, { complete = false } = {}) => {
      const value = clamp(next, 0, 1)
      progressRef.current = value
      setProgress(value)
      scrubVideo(value)
      if (complete || value >= completeAt) {
        if (releasedRef.current) return
        releasedRef.current = true
        progressRef.current = 1
        setProgress(1)
        scrubVideo(1)
        setReleased(true)
      }
    },
    [completeAt, scrubVideo],
  )

  useEffect(() => {
    const { lines, startDelayMs, holdMs, gapMs = 0 } = copy
    const timers = lines.map((_, index) => {
      const at = startDelayMs + index * (holdMs + gapMs)
      return window.setTimeout(() => setLineIndex(index), at)
    })

    const lastLineAt = startDelayMs + (lines.length - 1) * (holdMs + gapMs)
    const clearAt = lastLineAt + holdMs
    const sliderAt = clearAt + gapMs + (copy.fadeMs ?? 700)

    timers.push(window.setTimeout(() => setLineIndex(-1), clearAt))
    timers.push(window.setTimeout(() => setLinesDone(true), sliderAt))

    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [copy])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !media.worryVideo) return undefined

    let cancelled = false

    const markReady = () => {
      if (cancelled) return
      durationRef.current = video.duration || 0
      setVideoReady(Number.isFinite(video.duration) && video.duration > 0)
    }

    const paintFirstFrame = () => {
      if (cancelled) return
      markReady()
      // Force-decode a near-first frame so paused scrubbers are not a black box.
      const paint = () => {
        try {
          video.currentTime = 0.04
        } catch {
          // Ignore seek errors while the element is settling.
        }
      }
      if (video.readyState >= 2) paint()
      else video.addEventListener('loadeddata', paint, { once: true })
    }

    const onError = () => {
      if (!cancelled) setVideoReady(false)
    }

    video.addEventListener('loadedmetadata', paintFirstFrame)
    video.addEventListener('loadeddata', markReady)
    video.addEventListener('error', onError)
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    // Kick loading on iOS / Safari.
    try {
      video.load()
    } catch {
      // Ignore.
    }

    if (video.readyState >= 1) paintFirstFrame()

    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', paintFirstFrame)
      video.removeEventListener('loadeddata', markReady)
      video.removeEventListener('error', onError)
      video.pause()
    }
  }, [media.worryVideo])

  const progressFromClientX = useCallback((clientX) => {
    const track = trackRef.current
    if (!track) return progressRef.current
    const thumb = track.querySelector('.worry-slide-thumb')
    const thumbWidth = thumb?.offsetWidth || 72
    const rect = track.getBoundingClientRect()
    const usable = Math.max(rect.width - thumbWidth, 1)
    const fromLeft = clamp(clientX - rect.left - thumbWidth / 2, 0, usable)
    // 0 = cloud on the right (start); 1 = cloud on the left (done)
    return 1 - fromLeft / usable
  }, [])

  const onPointerDown = useCallback(
    (event) => {
      if (releasedRef.current) return
      draggingRef.current = true
      setDragging(true)
      event.currentTarget.setPointerCapture?.(event.pointerId)
      updateProgress(progressFromClientX(event.clientX))
    },
    [progressFromClientX, updateProgress],
  )

  const onPointerMove = useCallback(
    (event) => {
      if (!draggingRef.current || releasedRef.current) return
      updateProgress(progressFromClientX(event.clientX))
    },
    [progressFromClientX, updateProgress],
  )

  const springHome = useCallback(() => {
    const start = progressRef.current
    if (start <= 0.001) {
      updateProgress(0)
      return
    }
    const startedAt = performance.now()
    const durationMs = reduceMotion ? 1 : 320
    const step = (now) => {
      if (releasedRef.current || draggingRef.current) return
      const t = clamp((now - startedAt) / durationMs, 0, 1)
      const eased = 1 - (1 - t) ** 3
      updateProgress(start * (1 - eased))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [reduceMotion, updateProgress])

  const onPointerUp = useCallback(
    (event) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      setDragging(false)
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      } catch {
        // Pointer may already be released.
      }
      if (releasedRef.current) return
      if (progressRef.current >= completeAt) {
        updateProgress(1, { complete: true })
        return
      }
      springHome()
    },
    [completeAt, springHome, updateProgress],
  )

  const onKeyDown = useCallback(
    (event) => {
      if (releasedRef.current) return
      if (event.key === 'ArrowLeft' || event.key === 'Home') {
        event.preventDefault()
        updateProgress(event.key === 'Home' ? 1 : progressRef.current + 0.08)
      }
      if (event.key === 'ArrowRight' || event.key === 'End') {
        event.preventDefault()
        updateProgress(event.key === 'End' ? 0 : progressRef.current - 0.08)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        updateProgress(1, { complete: true })
      }
    },
    [updateProgress],
  )

  const thumbStyle = {
    // Sit on the right at 0; travel to the left as progress rises.
    left: `calc((100% - var(--worry-thumb-size)) * ${1 - progress})`,
  }

  return (
    <article
      className={`scene scene-worries${linesDone ? ' has-slider' : ' has-lines'}${cloudGone ? ' is-revealed' : ''}`}
    >
      <div className="worries-atmosphere" aria-hidden="true" />

      {media.worryVideo || media.worryPoster ? (
        <div
          className={`worries-video-layer is-visible${showReveal ? ' is-fading' : ''}`}
          aria-hidden="true"
        >
          {media.worryPoster ? (
            <img
              className="worries-poster"
              src={media.worryPoster}
              alt=""
              decoding="async"
            />
          ) : null}
          {media.worryVideo ? (
            <video
              ref={videoRef}
              className={`worries-video${videoReady ? ' is-ready' : ' is-pending'}`}
              src={media.worryVideo}
              poster={media.worryPoster || undefined}
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
            />
          ) : null}
          <div className="worries-video-scrim" />
        </div>
      ) : null}

      <h1 className="scene-title visually-hidden" tabIndex={-1}>
        {copy.slideHint}
      </h1>

      <div className="worries-stage">
        <div className="worries-copy" aria-live="polite">
          <AnimatePresence mode="wait">
            {currentLine ? (
              <motion.p
                key={currentLine}
                className="worries-line"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={{ duration: fadeSeconds, ease: [0.22, 1, 0.36, 1] }}
              >
                {currentLine}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="worries-interact">
          <AnimatePresence onExitComplete={() => setCloudGone(true)}>
            {showSlider ? (
              <motion.div
                key="worry-slider"
                className="worry-slider-wrap"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0.01 } }
                    : { opacity: 0, y: 16, transition: { duration: 0.45 } }
                }
                transition={{ duration: reduceMotion ? 0.01 : 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  ref={trackRef}
                  className="worry-slide-track"
                  role="slider"
                  tabIndex={0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  aria-valuetext={`${copy.slideHint}: ${Math.round(progress * 100)}%`}
                  aria-label={copy.releaseLabel}
                  style={{ '--worry-progress': progress }}
                  onKeyDown={onKeyDown}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <span className="worry-slide-hint" aria-hidden="true">
                    <span className="worry-slide-chevrons">‹‹‹</span>
                    <span className="worry-slide-hint-text">{copy.slideHint}</span>
                  </span>

                  <div
                    className={`worry-slide-thumb${dragging ? ' is-dragging' : ''}`}
                    style={thumbStyle}
                  >
                    <span className="worry-slide-knob" aria-hidden="true" />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showReveal ? (
            <motion.div
              key="smile-reveal"
              className="worries-reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: reduceMotion ? 0.01 : 1.05,
                delay: reduceMotion ? 0 : 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <motion.p
                className="worries-smile-line"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0.01 : 0.7,
                  delay: reduceMotion ? 0 : 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {copy.smileReveal}
              </motion.p>
              <motion.button
                type="button"
                className="cta cta-primary"
                onClick={onNext}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0.01 : 0.55,
                  delay: reduceMotion ? 0 : 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {copy.keepGoingLabel}
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </article>
  )
}
