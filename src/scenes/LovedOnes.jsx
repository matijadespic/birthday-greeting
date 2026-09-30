import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SafeImage } from '../components/SafeMedia.jsx'

const SWIPE_THRESHOLD = 56

export function LovedOnes({ copy, onNext }) {
  const reduceMotion = useReducedMotion()
  const slides = copy.slides ?? []
  const lastIndex = Math.max(slides.length - 1, 0)
  const [index, setIndex] = useState(0)
  const pointerStart = useRef(null)
  const dragLocked = useRef(false)

  const slide = slides[index] ?? null
  const isFirst = index <= 0
  const isLast = index >= lastIndex

  const goTo = useCallback(
    (nextIndex) => {
      if (!slides.length) return
      setIndex(Math.min(Math.max(nextIndex, 0), lastIndex))
    },
    [lastIndex, slides.length],
  )

  const goPrev = useCallback(() => {
    if (isFirst) return
    goTo(index - 1)
  }, [goTo, index, isFirst])

  const goNext = useCallback(() => {
    if (isLast) return
    goTo(index + 1)
  }, [goTo, index, isLast])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrev()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goNext, goPrev])

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
    dragLocked.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event) => {
    if (!pointerStart.current || dragLocked.current) return
    const dx = event.clientX - pointerStart.current.x
    const dy = event.clientY - pointerStart.current.y
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
    // Prefer horizontal swipes; ignore mostly-vertical scrolls.
    if (Math.abs(dy) > Math.abs(dx)) {
      pointerStart.current = null
      return
    }
    dragLocked.current = true
  }, [])

  const onPointerUp = useCallback(
    (event) => {
      const start = pointerStart.current
      pointerStart.current = null
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      } catch {
        // Pointer may already be released.
      }
      if (!start) return

      const dx = event.clientX - start.x
      if (Math.abs(dx) < SWIPE_THRESHOLD) return
      if (dx < 0) goNext()
      else goPrev()
    },
    [goNext, goPrev],
  )

  if (!slide) {
    return (
      <article className="scene scene-loved">
        <h1 className="scene-title" tabIndex={-1}>
          Loved ones
        </h1>
        <p className="scene-body">Add photos in content.js to begin this story.</p>
        <button type="button" className="cta cta-primary" onClick={onNext}>
          {copy.keepGoingLabel}
        </button>
      </article>
    )
  }

  return (
    <article className="scene scene-loved">
      <h1 className="scene-title visually-hidden" tabIndex={-1}>
        {copy.progressLabel}
      </h1>

      <div
        className="loved-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <AnimatePresence mode="wait">
          <motion.figure
            key={slide.id ?? slide.src ?? index}
            className="loved-frame"
            initial={{ opacity: 0, x: reduceMotion ? 0 : 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduceMotion ? 0 : -18 }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <SafeImage
              src={slide.src}
              alt={slide.alt || slide.caption}
              placeholderLabel={copy.placeholderLabel}
              className="loved-photo"
              objectPosition={slide.focus || '50% 30%'}
            />
            <figcaption className="loved-caption">{slide.caption}</figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>

      <div className="loved-controls">
        <button
          type="button"
          className="loved-nav"
          onClick={goPrev}
          disabled={isFirst}
          aria-label={copy.previousLabel}
        >
          {copy.previousLabel}
        </button>

        <div
          className="loved-dots"
          role="tablist"
          aria-label={copy.progressLabel}
        >
          {slides.map((item, dotIndex) => (
            <button
              key={item.id ?? item.src ?? dotIndex}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`Photo ${dotIndex + 1} of ${slides.length}`}
              className={`loved-dot${dotIndex === index ? ' is-current' : ''}`}
              onClick={() => goTo(dotIndex)}
            />
          ))}
        </div>

        <button
          type="button"
          className="loved-nav"
          onClick={goNext}
          disabled={isLast}
          aria-label={copy.nextLabel}
        >
          {copy.nextLabel}
        </button>
      </div>

      {isLast ? (
        <button type="button" className="cta cta-primary" onClick={onNext}>
          {copy.keepGoingLabel}
        </button>
      ) : (
        <div className="loved-cta-spacer" aria-hidden="true" />
      )}
    </article>
  )
}
