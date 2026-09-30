import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SafeImage } from '../components/SafeMedia.jsx'
import { isAudioUnlocked, playGlassClink } from '../audioGate.js'

const STAGES = ['shaking', 'pouring', 'serving']
const CHEERS_TO_BRIDGE_MS = 520

function CoyNoButton({ beforeLabel, afterLabel, onConfirm, reduceMotion }) {
  const [flipped, setFlipped] = useState(false)
  const [bounceKey, setBounceKey] = useState(0)
  const flippedRef = useRef(false)
  const suppressClickRef = useRef(false)

  const reveal = useCallback(() => {
    if (flippedRef.current) return
    flippedRef.current = true
    setFlipped(true)
    setBounceKey((value) => value + 1)
  }, [])

  const conceal = useCallback(() => {
    if (!flippedRef.current) return
    flippedRef.current = false
    setFlipped(false)
  }, [])

  const onPointerDown = useCallback(
    (event) => {
      if (event.pointerType !== 'touch' || flippedRef.current) return
      // First touch only reveals the playful label; block the synthetic click.
      suppressClickRef.current = true
      reveal()
    },
    [reveal],
  )

  const onClick = useCallback(
    (event) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (!flippedRef.current) {
        reveal()
        return
      }

      onConfirm()
    },
    [onConfirm, reveal],
  )

  return (
    <button
      type="button"
      className={`cocktail-choice cocktail-choice-coy${flipped ? ' is-flipped' : ''}`}
      aria-label={flipped ? afterLabel : beforeLabel}
      onMouseEnter={reveal}
      onMouseOver={reveal}
      onMouseLeave={conceal}
      onFocus={reveal}
      onBlur={conceal}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
          reveal()
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
          conceal()
        }
      }}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <span className="cocktail-choice-stack">
        <span className="cocktail-choice-measure" aria-hidden="true">
          {afterLabel}
        </span>
        <span className="cocktail-choice-measure" aria-hidden="true">
          {beforeLabel}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${bounceKey}-${flipped ? 'after' : 'before'}`}
            className="cocktail-choice-live"
            initial={
              reduceMotion || bounceKey === 0
                ? false
                : { opacity: 0.35, y: 6, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={
              reduceMotion
                ? { duration: 0.01 }
                : { type: 'spring', stiffness: 420, damping: 18, mass: 0.7 }
            }
          >
            {flipped ? afterLabel : beforeLabel}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  )
}

export function Cocktail({ copy, media, onNext, onBridgeStart }) {
  const reduceMotion = useReducedMotion()
  const [stageKey, setStageKey] = useState('shaking')
  const [toasting, setToasting] = useState(false)
  const [bridge, setBridge] = useState(false)
  const leavingRef = useRef(false)
  const advancedRef = useRef(false)
  const cheersTimerRef = useRef(0)
  const bridgeFallbackRef = useRef(0)
  const bridgeVideoRef = useRef(null)

  const stage = copy.stages[stageKey]
  const imageSrc = media[stage.image] || ''
  const bridgeSrc = media.cocktailBridgeVideo || ''
  const stageIndex = STAGES.indexOf(stageKey)

  const goNextStage = useCallback(() => {
    const next = STAGES[stageIndex + 1]
    if (!next) return
    setStageKey(next)
  }, [stageIndex])

  const advanceAfterCheers = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true
    window.clearTimeout(cheersTimerRef.current)
    window.clearTimeout(bridgeFallbackRef.current)
    onNext()
  }, [onNext])

  const onCheers = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    setToasting(true)

    if (isAudioUnlocked()) {
      playGlassClink()
    }

    window.clearTimeout(cheersTimerRef.current)
    cheersTimerRef.current = window.setTimeout(
      () => {
        if (!bridgeSrc) {
          onBridgeStart?.()
          advanceAfterCheers()
          return
        }
        onBridgeStart?.()
        setBridge(true)
      },
      reduceMotion ? 120 : CHEERS_TO_BRIDGE_MS,
    )
  }, [advanceAfterCheers, bridgeSrc, onBridgeStart, reduceMotion])

  useEffect(() => {
    return () => {
      window.clearTimeout(cheersTimerRef.current)
      window.clearTimeout(bridgeFallbackRef.current)
    }
  }, [])

  useEffect(() => {
    if (!bridge) return undefined

    const video = bridgeVideoRef.current
    const fallbackMs = copy.bridgeFallbackMs ?? 2800

    bridgeFallbackRef.current = window.setTimeout(() => {
      advanceAfterCheers()
    }, fallbackMs)

    if (!video || !bridgeSrc) {
      advanceAfterCheers()
      return () => window.clearTimeout(bridgeFallbackRef.current)
    }

    video.muted = false
    video.playsInline = true
    const attempt = video.play()
    if (attempt && typeof attempt.then === 'function') {
      attempt.catch(() => {
        video.muted = true
        video.play().catch(() => advanceAfterCheers())
      })
    }

    return () => window.clearTimeout(bridgeFallbackRef.current)
  }, [advanceAfterCheers, bridge, bridgeSrc, copy.bridgeFallbackMs])

  return (
    <article
      className={`scene scene-cocktail is-${stageKey}${toasting ? ' is-toasting' : ''}${bridge ? ' is-bridge' : ''}`}
    >
      <h1 className="scene-title visually-hidden" tabIndex={-1}>
        {stage.prompt}
      </h1>

      <div className="cocktail-stage" aria-hidden={bridge ? true : undefined}>
        <AnimatePresence mode="wait">
          <motion.div
            key={stageKey}
            className="cocktail-frame"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.45 }}
          >
            <motion.div
              className="cocktail-media"
              animate={{
                scale: reduceMotion ? 1 : toasting ? 1.06 : 1,
              }}
              transition={{
                duration: reduceMotion ? 0.01 : toasting ? 0.7 : 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <SafeImage
                src={imageSrc}
                alt={stage.alt}
                className={`cocktail-photo${stageKey === 'serving' ? ' is-close' : ''}`}
              />
            </motion.div>
            <div className="cocktail-scrim" />
            {toasting && !bridge ? (
              <div className="cocktail-accent cocktail-accent-sparkle" aria-hidden="true">
                {Array.from({ length: 14 }, (_, i) => (
                  <span key={i} className="cocktail-spark" style={{ '--i': i }} />
                ))}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {bridge && bridgeSrc ? (
          <motion.div
            key="cocktail-bridge"
            className="cocktail-bridge"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.35 }}
          >
            <video
              ref={bridgeVideoRef}
              className="cocktail-bridge-video"
              src={bridgeSrc}
              playsInline
              preload="auto"
              onEnded={advanceAfterCheers}
              onError={advanceAfterCheers}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!bridge ? (
        <div className="cocktail-ui">
          <AnimatePresence mode="wait">
            <motion.p
              key={`${stageKey}-prompt`}
              className="cocktail-prompt"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.4 }}
            >
              {stage.prompt}
            </motion.p>
          </AnimatePresence>

          {stageKey === 'shaking' ? (
            <div
              className="cocktail-choices"
              role="group"
              aria-label={stage.choicesLabel}
            >
              <button
                type="button"
                className="cocktail-choice"
                onClick={goNextStage}
              >
                {stage.yesLabel}
              </button>
              <CoyNoButton
                beforeLabel={stage.noLabel}
                afterLabel={stage.noRevealLabel}
                onConfirm={goNextStage}
                reduceMotion={reduceMotion}
              />
            </div>
          ) : null}

          {stageKey === 'pouring' ? (
            <button type="button" className="cta cta-primary" onClick={goNextStage}>
              {stage.continueLabel}
            </button>
          ) : null}

          {stageKey === 'serving' ? (
            <button
              type="button"
              className="cta cta-primary"
              onClick={onCheers}
              disabled={toasting}
              aria-busy={toasting || undefined}
            >
              {stage.cheersLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
